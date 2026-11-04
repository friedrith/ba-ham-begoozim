import { beforeEach, describe, expect, test } from 'bun:test'

import { LEVELS } from '../game/engine/levels'
import type { GameEvent } from '../game/engine/world'
import { CLOSE_CODES } from './protocol'
import { newRoom, Room, SEAT_HOLD_MS, type Peer, type RoomHost } from './room'
import { OnlineSession, type SocketLike } from './session'

const FRAME_MS = 16
const COUNTDOWN_MS = 3200
const CONNECT_TIMEOUT_MS = 9000

type Delivery = { at: number; action: () => void }

let now: number
let queue: Delivery[]
let room: Room
let peers: FakeSocket[]
let ticking: boolean
let saved = newRoom('123456')
let networkDown = false

class FakeSocket implements Peer {
  readyState = 0
  private listeners = new Map<string, ((event: never) => void)[]>()
  token: string | null = null
  private outAt = 0
  private inAt = 0

  constructor(private readonly lag: number) {
    deliver(lag, () => {
      if (networkDown) return
      this.readyState = 1
      peers.push(this)
      this.emit('open', undefined)
    })
  }

  /** From the client. */
  sendClient(text: string) {
    this.outAt = Math.max(this.outAt, now + this.lag)
    deliverAt(this.outAt, () => {
      if (peers.includes(this)) room.receive(this, text)
    })
  }

  /** From the room. */
  send(text: string) {
    this.inAt = Math.max(this.inAt, now + this.lag)
    deliverAt(this.inAt, () => this.emit('message', { data: text }))
  }

  close(code = 1000) {
    this.readyState = 3
    if (peers.includes(this)) {
      peers = peers.filter((peer) => peer !== this)
      room.left(this)
    }
    deliver(this.lag, () => this.emit('close', { code }))
  }

  /** A client closing goes through the network like anything else it sends. */
  closeClient(code = 1000) {
    this.readyState = 3
    this.outAt = Math.max(this.outAt, now + this.lag)
    deliverAt(this.outAt, () => {
      if (!peers.includes(this)) return
      peers = peers.filter((peer) => peer !== this)
      room.left(this)
    })
    deliver(this.lag, () => this.emit('close', { code }))
  }

  /** The network falling over, with neither side having said anything. */
  cut() {
    this.listeners.clear()
    this.close()
  }

  addEventListener(type: string, listener: (event: never) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  emit(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event as never)
  }
}

/** The same object plays both ends, so `send` has to mean the client's end to a session. */
function clientEnd(socket: FakeSocket) {
  return new Proxy(socket, {
    get(target, key) {
      if (key === 'send') return (text: string) => target.sendClient(text)
      if (key === 'close') return (code?: number) => target.closeClient(code)
      return Reflect.get(target, key)
    },
  }) as unknown as SocketLike
}

function deliver(delay: number, action: () => void) {
  deliverAt(now + delay, action)
}

function deliverAt(at: number, action: () => void) {
  queue.push({ at, action })
}

const host: RoomHost = {
  now: () => now,
  peers: () => peers,
  save: () => {},
  setTicking: (on) => {
    ticking = on
  },
}

const isTicking = () => ticking

/** A room full of bots, to watch rather than play. */
function botRace(starter: Client) {
  starter.session.setBots(true)
  run(50)
  starter.session.start(LEVELS[0].id)
  run(COUNTDOWN_MS)
}

type Client = {
  session: OnlineSession
  sockets: FakeSocket[]
  events: GameEvent[]
  /** Stops its timers, so that it can't reconnect until a test wants it to. */
  offline: boolean
}

const clients: Client[] = []

function join(name: string, lag = 0): Client {
  const sockets: FakeSocket[] = []
  const client: Client = {
    sockets,
    events: [],
    offline: false,
    session: new OnlineSession({
      url: 'http://rooms.test',
      code: '123456',
      token: `token-of-player-${name}`,
      now: () => now,
      autoPump: false,
      createSocket: () => {
        const socket = new FakeSocket(lag)
        sockets.push(socket)
        return clientEnd(socket)
      },
    }),
  }
  clients.push(client)
  return client
}

/** Runs the network, the room and everyone's frames. */
function run(ms: number) {
  const end = now + ms
  while (now < end) {
    now += 4
    const due = queue.filter((delivery) => delivery.at <= now)
    queue = queue.filter((delivery) => delivery.at > now)
    due.toSorted((a, b) => a.at - b.at).forEach((delivery) => delivery.action())
    if (ticking && now % FRAME_MS === 0) room.tick()
    if (now % FRAME_MS === 0) {
      for (const client of clients) {
        if (!client.offline) client.session.pump()
        client.session.display(FRAME_MS / 1000)
        client.events.push(...client.session.takeEvents())
      }
    }
  }
}

function events(client: Client, type: GameEvent['type']) {
  return client.events.filter((event) => event.type === type)
}

function seats(client: Client, ...taken: number[]) {
  for (const seat of taken) client.session.toggleSeat(seat)
}

function holding(...seatsHeld: number[]) {
  return [0, 1, 2, 3].map((seat) => seatsHeld.includes(seat))
}

function race(starter: Client) {
  starter.session.start(LEVELS[0].id)
  run(COUNTDOWN_MS)
}

beforeEach(() => {
  now = 1_000_000
  queue = []
  peers = []
  ticking = false
  networkDown = false
  clients.length = 0
  saved = { ...newRoom('123456'), bots: false }
  room = new Room(host, saved)
})

describe('joining', () => {
  test('a new session says hello and hears about the room', () => {
    const a = join('a', 30)
    expect(a.session.getState().status).toBe('connecting')
    run(200)
    const state = a.session.getState()
    expect(state.status).toBe('open')
    expect(state.room?.you).toBe(1)
    expect(state.room?.code).toBe('123456')
  })

  test('works out the room’s clock and the round trip', () => {
    const a = join('a', 40)
    run(1000)
    expect(a.session.getState().rtt).toBeCloseTo(80, -1)
    expect(Math.abs(a.session.roomNow() - now)).toBeLessThan(10)
  })

  test('a room that says to update is not retried', () => {
    const a = join('a', 10)
    run(100)
    a.sockets[0].emit('close', { code: CLOSE_CODES.update })
    run(10_000)
    expect(a.session.getState().error).toBe('update')
    expect(a.sockets).toHaveLength(1)
  })

  test('gives up on a service that never answers', () => {
    networkDown = true
    const a = join('a', 10)
    run(CONNECT_TIMEOUT_MS * 6)
    expect(a.session.getState().status).toBe('closed')
    expect(a.session.getState().error).toBe('unreachable')
  })
})

describe('prediction', () => {
  test('a press shows and sounds at once, whatever the ping', () => {
    const a = join('a', 100)
    run(500)
    seats(a, 2)
    run(500)
    race(a)
    const before = a.session.display(0)?.seats[2].gas ?? 0
    a.session.setHeld(holding(2))
    expect(a.session.takeEvents()).toContainEqual({
      type: 'blast',
      seat: 2,
      harmony: false,
      ignited: false,
    })
    run(FRAME_MS * 3)
    // Well under the 200 ms it takes the room to hear about it and answer.
    expect(a.session.display(0)?.seats[2].blasting).toBe(true)
    expect(a.session.display(0)?.seats[2].gas).toBeLessThan(before)
  })

  test('the room’s echo of a predicted blast does not play twice', () => {
    const a = join('a', 60)
    run(300)
    seats(a, 2)
    run(300)
    race(a)
    a.events.length = 0
    a.session.setHeld(holding(2))
    run(400)
    a.session.setHeld(holding())
    run(400)
    expect(events(a, 'blast')).toHaveLength(1)
    expect(events(a, 'release')).toHaveLength(1)
  })

  test('tapping quickly doesn’t lose the blast still being held', () => {
    const a = join('a', 100)
    run(500)
    seats(a, 2)
    run(500)
    race(a)
    a.events.length = 0
    a.session.setHeld(holding(2))
    run(40)
    a.session.setHeld(holding())
    run(40)
    a.session.setHeld(holding(2))
    run(500)
    expect(events(a, 'blast')).toHaveLength(2)
    expect(events(a, 'release')).toHaveLength(1)
  })

  test('running out of gas stops the sound even with the key held', () => {
    const a = join('a', 30)
    run(300)
    seats(a, 2)
    run(300)
    race(a)
    a.events.length = 0
    a.session.setHeld(holding(2))
    run(5000)
    expect(events(a, 'release').length).toBeGreaterThanOrEqual(1)
  })

  test('teammates’ blasts arrive from the room', () => {
    const a = join('a', 30)
    const b = join('b', 30)
    run(300)
    seats(a, 2)
    seats(b, 3)
    run(300)
    race(a)
    a.events.length = 0
    b.session.setHeld(holding(3))
    run(300)
    expect(events(a, 'blast')).toContainEqual({
      type: 'blast',
      seat: 3,
      harmony: false,
      ignited: false,
    })
  })

  test('what a player sees agrees with the room, despite the ping', () => {
    const a = join('a', 80)
    const nearby = join('nearby')
    run(500)
    seats(a, 2, 3)
    run(500)
    race(a)
    a.session.setHeld(holding(2, 3))
    run(400)
    a.session.setHeld(holding())
    run(800)
    const seen = a.session.display(FRAME_MS / 1000)
    const truth = nearby.session.display(FRAME_MS / 1000)
    // A player sees slightly ahead of the room, so that their presses land on time.
    expect(
      Math.hypot(
        (seen?.x ?? 0) - (truth?.x ?? 0),
        (seen?.y ?? 0) - (truth?.y ?? 0),
      ),
    ).toBeLessThan(15)
  })

  test('unequal pings still make a harmony', () => {
    const a = join('a', 20)
    const b = join('b', 120)
    run(1000)
    seats(a, 2)
    seats(b, 3)
    run(1000)
    race(a)
    a.session.setHeld(holding(2))
    b.session.setHeld(holding(3))
    run(100)
    a.session.setHeld(holding())
    b.session.setHeld(holding())
    run(500)
    expect(events(a, 'harmony').length).toBeGreaterThanOrEqual(1)
  })
})

describe('races', () => {
  test('a new race starts with a new world, even on the same level', () => {
    const a = join('a')
    run(100)
    botRace(a)
    const first = a.session.display(0)
    botRace(a)
    expect(a.session.display(0)).not.toBe(first)
  })

  test('going back to the room stops showing a race', () => {
    const a = join('a')
    run(100)
    botRace(a)
    expect(a.session.display(0)).not.toBeNull()
    a.session.toLobby()
    run(100)
    expect(a.session.display(0)).toBeNull()
  })

  test('a key held as the race begins counts', () => {
    const a = join('a')
    run(100)
    seats(a, 2)
    run(100)
    a.session.setHeld(holding(2))
    a.session.start(LEVELS[0].id)
    run(COUNTDOWN_MS + 200)
    expect(a.session.display(0)?.seats[2].blasting).toBe(true)
  })

  test('each player gets one finish, and so does someone arriving after it', () => {
    const a = join('a', 10)
    run(100)
    botRace(a)
    // The bots drive, so this just takes a while.
    for (let i = 0; i < 400 && isTicking(); i++) run(1000)
    run(100)
    expect(ticking).toBe(false)
    expect(events(a, 'finish')).toHaveLength(1)
    const late = join('late', 10)
    run(100)
    expect(events(late, 'finish')).toHaveLength(1)
  })
})

function raceWithTwo() {
  const a = join('a', 20)
  const b = join('b', 20)
  run(200)
  seats(a, 2)
  seats(b, 3)
  run(200)
  race(a)
  return { a, b }
}

describe('connection trouble', () => {
  test('a lost socket comes back with the same player and seat', () => {
    const { a, b } = raceWithTwo()
    b.sockets[0].cut()
    run(6000)
    expect(b.sockets.length).toBeGreaterThan(1)
    const state = b.session.getState()
    expect(state.status).toBe('open')
    expect(state.room?.you).toBe(2)
    expect(state.room?.seats[3]).toEqual({ owner: 2, status: 'here' })
    expect(a.session.getState().room?.seats[3].status).toBe('here')
  })

  test('a line that goes quiet counts as lost', () => {
    const { b } = raceWithTwo()
    // Whatever was still on its way vanishes, and nothing new gets through.
    b.sockets[0].cut()
    expect(b.session.getState().status).toBe('open')
    run(5100)
    expect(b.sockets.length).toBeGreaterThan(1)
  })

  test('a key still held after a reconnect is pressed again', () => {
    const { b } = raceWithTwo()
    b.session.setHeld(holding(3))
    run(100)
    b.sockets[0].cut()
    run(6000)
    expect(b.session.display(0)?.seats[3].held).toBe(true)
  })

  test('says so when someone took the seat in the meantime', () => {
    const { a, b } = raceWithTwo()
    b.offline = true
    b.sockets[0].cut()
    run(SEAT_HOLD_MS + 1500)
    a.session.setHeld(holding(2, 3))
    run(200)
    expect(a.session.getState().room?.seats[3].owner).toBe(1)

    b.offline = false
    run(6000)
    const state = b.session.getState()
    expect(state.status).toBe('open')
    expect(state.lostSeat).toBe(3)
  })

  test('giving a seat up on purpose is not reported as losing it', () => {
    const a = join('a')
    run(100)
    seats(a, 2)
    run(100)
    a.session.toggleSeat(2)
    run(100)
    expect(a.session.getState().room?.seats[2].owner).toBeNull()
    expect(a.session.getState().lostSeat).toBeNull()
  })

  test('leaving closes the session and frees the seats', () => {
    const { a, b } = raceWithTwo()
    b.session.leave()
    run(200)
    expect(b.session.getState().status).toBe('closed')
    expect(a.session.getState().room?.seats[3].owner).toBeNull()
  })
})
