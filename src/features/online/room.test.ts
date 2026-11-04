import { beforeEach, describe, expect, test } from 'bun:test'

import { LEVELS } from '../game/engine/levels'
import { applySnapshot } from '../game/engine/snapshot'
import { createWorld } from '../game/engine/world'
import {
  CLOSE_ABUSE,
  MAX_NAME_LENGTH,
  normalizeName,
  PROTOCOL,
  type ClientMessage,
  type ServerMessage,
} from './protocol'
import {
  IDLE_RACE_MS,
  MAX_PEERS,
  newRoom,
  Room,
  SEAT_HOLD_MS,
  type Peer,
  type RoomHost,
  type SavedRoom,
} from './room'

const TICK_MS = 16
const COUNTDOWN_MS = 3100

class TestPeer implements Peer {
  token: string | null = null
  received: ServerMessage[] = []
  closed: number | null = null

  send(text: string) {
    this.received.push(JSON.parse(text) as ServerMessage)
  }

  close(code: number) {
    this.closed = code
  }

  last<T extends ServerMessage['t']>(type: T) {
    return this.received.findLast(
      (message): message is Extract<ServerMessage, { t: T }> => message.t === type,
    )
  }
}

let now: number
let open: TestPeer[]
let saved: SavedRoom | null
let ticking: boolean
let room: Room
let reports: [string, number][]

const isTicking = () => ticking

const host: RoomHost = {
  now: () => now,
  peers: () => open,
  save: (state) => {
    saved = JSON.parse(JSON.stringify(state)) as SavedRoom
  },
  setTicking: (on) => {
    ticking = on
  },
  reportPlayers: (code, count) => {
    reports.push([code, count])
  },
}

function say(peer: TestPeer, message: ClientMessage) {
  room.receive(peer, JSON.stringify(message))
}

function join(name: string) {
  const peer = new TestPeer()
  open.push(peer)
  say(peer, { t: 'hello', protocol: PROTOCOL, token: `token-of-player-${name}` })
  return peer
}

function drop(peer: TestPeer) {
  open = open.filter((other) => other !== peer)
  room.left(peer)
}

function run(ms: number) {
  const end = now + ms
  while (now < end) {
    now += TICK_MS
    if (ticking) room.tick()
  }
}

function worldSeenBy(peer: TestPeer) {
  const world = createWorld(LEVELS[0])
  const snap = peer.last('snap')
  if (!snap) throw new Error('no snapshot yet')
  applySnapshot(world, snap.w)
  return world
}

function startRacing(peer: TestPeer) {
  say(peer, { t: 'start', level: LEVELS[0].id })
  run(COUNTDOWN_MS)
}

beforeEach(() => {
  now = 1_000_000
  open = []
  saved = null
  ticking = false
  reports = []
  room = new Room(host, newRoom('123456'))
})

const counts = () => reports.map(([, count]) => count)

describe('player count', () => {
  test('reports people arriving and leaving, under the room code', () => {
    const a = join('a')
    const b = join('b')
    say(a, { t: 'leave' })
    open = open.filter((peer) => peer !== a)
    room.left(a)
    drop(b)
    expect(reports[0]).toEqual(['123456', 1])
    expect(counts()).toEqual([1, 2, 1, 0])
  })

  test('stays quiet when the room changes but the number does not', () => {
    const a = join('a')
    join('b')
    reports = []
    say(a, { t: 'seat', seat: 0, take: true })
    say(a, { t: 'name', name: 'Sam' })
    expect(reports).toEqual([])
  })

  test('counts a rejoining player once', () => {
    join('a')
    join('a')
    expect(counts()).toEqual([1])
  })

  test('the last person leaving a room that hibernated still gets reported', () => {
    const a = join('a')
    if (!saved) throw new Error('nothing saved')
    room = new Room(host, saved)
    reports = []
    drop(a)
    expect(counts()).toEqual([0])
  })

  test('the host can repeat the report', () => {
    join('a')
    reports = []
    room.reportPlayers()
    expect(counts()).toEqual([1])
  })
})

describe('seats', () => {
  test('players are numbered in order of joining', () => {
    expect(join('a').last('room')?.you).toBe(1)
    expect(join('b').last('room')?.you).toBe(2)
  })

  test('a player can take several seats, but not someone else’s', () => {
    const a = join('a')
    const b = join('b')
    say(a, { t: 'seat', seat: 0, take: true })
    say(a, { t: 'seat', seat: 1, take: true })
    say(b, { t: 'seat', seat: 0, take: true })
    const seats = b.last('room')?.seats
    expect(seats?.[0]).toEqual({ owner: 1, status: 'here' })
    expect(seats?.[1]).toEqual({ owner: 1, status: 'here' })
  })

  test('tokens never reach other players', () => {
    const a = join('a')
    say(a, { t: 'seat', seat: 0, take: true })
    const b = join('b')
    expect(JSON.stringify(b.received)).not.toContain('token-of-player')
  })

  test('input on someone else’s seat does nothing', () => {
    const a = join('a')
    const b = join('b')
    say(a, { t: 'seat', seat: 2, take: true })
    startRacing(a)
    say(b, { t: 'in', seat: 2, on: true, at: now })
    run(50)
    expect(worldSeenBy(a).seats[2].held).toBe(false)
  })
})

describe('names', () => {
  test('teammates see a seat’s owner by the name they chose', () => {
    const a = join('a')
    const b = join('b')
    say(a, { t: 'seat', seat: 0, take: true })
    say(a, { t: 'name', name: 'Bean Queen' })
    expect(b.last('room')?.seats[0].name).toBe('Bean Queen')
    say(a, { t: 'name', name: 'Bean King' })
    expect(b.last('room')?.seats[0].name).toBe('Bean King')
  })

  test('clearing a name goes back to no name', () => {
    const a = join('a')
    say(a, { t: 'seat', seat: 0, take: true })
    say(a, { t: 'name', name: 'Bean Queen' })
    say(a, { t: 'name', name: '   ' })
    expect(a.last('room')?.seats[0].name).toBeUndefined()
  })

  test('a name can change in the middle of a race without restarting it', () => {
    const a = join('a')
    say(a, { t: 'seat', seat: 0, take: true })
    startRacing(a)
    const raceId = a.last('room')?.raceId
    say(a, { t: 'name', name: 'Bean Queen' })
    expect(a.last('room')?.phase).toBe('race')
    expect(a.last('room')?.raceId).toBe(raceId)
    expect(a.last('room')?.seats[0].name).toBe('Bean Queen')
  })

  test('a name goes when its seat does', () => {
    const a = join('a')
    say(a, { t: 'seat', seat: 0, take: true })
    say(a, { t: 'name', name: 'Bean Queen' })
    say(a, { t: 'seat', seat: 0, take: false })
    expect(a.last('room')?.seats[0].name).toBeUndefined()
  })

  test('saying the same name again doesn’t tell everyone again', () => {
    const a = join('a')
    say(a, { t: 'name', name: 'Bean Queen' })
    const before = a.received.length
    say(a, { t: 'name', name: ' Bean  Queen ' })
    expect(a.received.length).toBe(before)
  })

  test('a name that isn’t text is refused', () => {
    const a = join('a')
    room.receive(a, JSON.stringify({ t: 'name', name: 7 }))
    expect(a.closed).toBe(CLOSE_ABUSE)
  })

  test('names are tidied and cut to length', () => {
    expect(normalizeName('  Bean \n Queen ')).toBe('Bean Queen')
    expect(normalizeName('x'.repeat(40))).toBe('x'.repeat(MAX_NAME_LENGTH))
    expect(normalizeName('a\u202Eb\u0000c')).toBe('abc')
    expect(normalizeName('کف\u200Cصابون')).toBe('کف\u200Cصابون')
  })
})

describe('racing', () => {
  test('an owned seat blasts, and everyone sees the same world', () => {
    const a = join('a')
    const b = join('b')
    say(a, { t: 'bots', on: false })
    say(a, { t: 'seat', seat: 2, take: true })
    startRacing(a)
    say(a, { t: 'in', seat: 2, on: true, at: now })
    run(100)
    expect(worldSeenBy(b).seats[2].blasting).toBe(true)
    expect(a.last('snap')).toEqual(b.last('snap'))
  })

  test('harmony counts press times, so unequal latency does not break it', () => {
    const a = join('a')
    const b = join('b')
    say(a, { t: 'bots', on: false })
    say(a, { t: 'seat', seat: 2, take: true })
    say(b, { t: 'seat', seat: 3, take: true })
    startRacing(a)

    const pressed = now
    run(20)
    say(a, { t: 'in', seat: 2, on: true, at: pressed })
    run(100)
    say(b, { t: 'in', seat: 3, on: true, at: pressed })
    run(50)
    expect(worldSeenBy(a).harmonies).toBe(1)
  })

  test('a press claiming to be very late is clamped', () => {
    const a = join('a')
    const b = join('b')
    say(a, { t: 'bots', on: false })
    say(a, { t: 'seat', seat: 2, take: true })
    say(b, { t: 'seat', seat: 3, take: true })
    startRacing(a)
    say(a, { t: 'in', seat: 2, on: true, at: now })
    run(1000)
    // Claims to have pressed with the other bean, a whole second ago.
    say(b, { t: 'in', seat: 3, on: true, at: now - 1000 })
    run(50)
    expect(worldSeenBy(a).harmonies).toBe(0)
  })

  test('a tap shorter than a step still blasts', () => {
    const a = join('a')
    say(a, { t: 'bots', on: false })
    say(a, { t: 'seat', seat: 2, take: true })
    startRacing(a)
    const gas = worldSeenBy(a).seats[2].gas
    say(a, { t: 'in', seat: 2, on: true, at: now })
    say(a, { t: 'in', seat: 2, on: false, at: now })
    run(50)
    expect(worldSeenBy(a).seats[2].gas).toBeLessThan(gas)
  })

  test('snapshots carry each event once', () => {
    const a = join('a')
    startRacing(a)
    const goes = a.received.flatMap((message) =>
      message.t === 'snap' ? message.ev.filter((e) => e.type === 'go') : [],
    )
    expect(goes).toHaveLength(1)
  })

  test('sends 30 snapshots a second, though ticks don’t divide into that', () => {
    const a = join('a')
    startRacing(a)
    const before = a.received.filter((message) => message.t === 'snap').length
    run(3000)
    const sent =
      a.received.filter((message) => message.t === 'snap').length - before
    expect(sent / 3).toBeGreaterThan(29)
    expect(sent / 3).toBeLessThan(31)
  })

  test('steps at 120 Hz whatever the timer does', () => {
    const a = join('a')
    say(a, { t: 'start', level: LEVELS[0].id })
    for (let i = 0; i < 20; i++) {
      now += 50
      room.tick()
    }
    expect(worldSeenBy(a).clock).toBeCloseTo(1, 1)
  })

  test('stops ticking at the finish, and the result still arrives', () => {
    const a = join('a')
    say(a, { t: 'start', level: LEVELS[0].id })
    // The bot holds every seat, so this just takes a while.
    for (let i = 0; i < 300_000 && isTicking(); i++) {
      now += TICK_MS
      room.tick()
    }
    expect(ticking).toBe(false)
    expect(worldSeenBy(a).status).toBe('finished')
  })

  test('an idle race goes back to the lobby', () => {
    const a = join('a')
    say(a, { t: 'bots', on: false })
    say(a, { t: 'seat', seat: 2, take: true })
    startRacing(a)
    run(IDLE_RACE_MS + 2000)
    expect(a.last('room')?.phase).toBe('lobby')
    expect(ticking).toBe(false)
  })

  test('a room with no seats and no bots will not start', () => {
    const a = join('a')
    say(a, { t: 'bots', on: false })
    say(a, { t: 'start', level: LEVELS[0].id })
    expect(a.last('room')?.phase).toBe('lobby')
  })
})

function raceWithTwo() {
  const a = join('a')
  const b = join('b')
  say(a, { t: 'bots', on: false })
  say(a, { t: 'seat', seat: 2, take: true })
  say(b, { t: 'seat', seat: 3, take: true })
  startRacing(a)
  return { a, b }
}

describe('disconnects', () => {
  test('a dropped player’s blast stops, and their seat is held', () => {
    const { a, b } = raceWithTwo()
    say(b, { t: 'in', seat: 3, on: true, at: now })
    run(50)
    expect(worldSeenBy(a).seats[3].blasting).toBe(true)
    drop(b)
    run(50)
    expect(worldSeenBy(a).seats[3].blasting).toBe(false)
    expect(a.last('room')?.seats[3]).toEqual({ owner: 2, status: 'away' })
  })

  test('rejoining with the same token gets the seat and number back', () => {
    const { b } = raceWithTwo()
    drop(b)
    run(1000)
    const again = join('b')
    expect(again.last('room')?.you).toBe(2)
    expect(again.last('room')?.seats[3]).toEqual({ owner: 2, status: 'here' })
    say(again, { t: 'in', seat: 3, on: true, at: now })
    run(50)
    expect(worldSeenBy(again).seats[3].blasting).toBe(true)
  })

  test('a teammate cannot take a held seat, but can once the hold runs out', () => {
    const { a, b } = raceWithTwo()
    drop(b)
    say(a, { t: 'in', seat: 3, on: true, at: now })
    run(50)
    expect(worldSeenBy(a).seats[3].held).toBe(false)
    expect(a.last('room')?.seats[3].status).toBe('away')

    run(SEAT_HOLD_MS)
    expect(a.last('room')?.seats[3].status).toBe('free')
    say(a, { t: 'in', seat: 3, on: true, at: now })
    run(50)
    expect(worldSeenBy(a).seats[3].held).toBe(true)
    expect(a.last('room')?.seats[3]).toEqual({ owner: 1, status: 'here' })
  })

  test('a bot takes over once the hold runs out, if bots are on', () => {
    const { a, b } = raceWithTwo()
    say(a, { t: 'bots', on: true })
    drop(b)
    expect(a.last('room')?.seats[3].status).toBe('away')
    run(SEAT_HOLD_MS + 1100)
    expect(a.last('room')?.seats[3].status).toBe('bot')
  })

  test('a hold runs out in the lobby too, with nothing else going on', () => {
    const a = join('a')
    const b = join('b')
    say(b, { t: 'seat', seat: 3, take: true })
    drop(b)
    expect(a.last('room')?.seats[3].status).toBe('away')
    run(SEAT_HOLD_MS + 1100)
    expect(a.last('room')?.seats[3].status).toBe('bot')
    say(a, { t: 'seat', seat: 3, take: true })
    expect(a.last('room')?.seats[3]).toEqual({ owner: 1, status: 'here' })
    // Nothing to wait for now, so the room can hibernate.
    expect(ticking).toBe(false)
  })

  test('a late return still reclaims a seat nobody took', () => {
    const { b } = raceWithTwo()
    drop(b)
    run(SEAT_HOLD_MS * 2)
    const again = join('b')
    expect(again.last('room')?.seats[3]).toEqual({ owner: 2, status: 'here' })
  })

  test('the world pauses when everyone has gone, and resumes on return', () => {
    const { a, b } = raceWithTwo()
    drop(a)
    drop(b)
    const clock = saved?.world
    run(SEAT_HOLD_MS + 1100)
    // Timers can stop too, now that no seats are being held.
    expect(ticking).toBe(false)
    now += 60_000
    const again = join('a')
    expect(ticking).toBe(true)
    expect(again.last('snap')?.w).toEqual(clock as number[])
  })

  test('a new socket for the same token replaces the old one', () => {
    const a = join('a')
    const fresh = join('a')
    expect(a.closed).toBe(4003)
    expect(fresh.closed).toBeNull()
    open = open.filter((peer) => peer !== a)
    room.left(a)
    expect(fresh.last('room')?.you).toBe(1)
  })

  test('leaving on purpose frees seats straight away', () => {
    const { a, b } = raceWithTwo()
    say(b, { t: 'leave' })
    expect(a.last('room')?.seats[3].status).toBe('free')
  })
})

describe('resets', () => {
  test('a room restored from its save carries on', () => {
    const a = join('a')
    say(a, { t: 'seat', seat: 2, take: true })
    startRacing(a)
    say(a, { t: 'in', seat: 2, on: true, at: now })
    run(6000)
    const before = worldSeenBy(a)
    const state = saved as SavedRoom
    expect(state.world).not.toBeNull()

    // Everything in memory is lost, and so are the sockets.
    open = []
    ticking = false
    room = new Room(host, state)
    const again = join('a')
    expect(again.last('room')?.phase).toBe('race')
    expect(again.last('room')?.you).toBe(1)
    expect(again.last('room')?.seats[2].owner).toBe(1)
    const restored = worldSeenBy(again)
    expect(restored.status).toBe('racing')
    // At most one checkpoint interval behind.
    expect(before.clock - restored.clock).toBeLessThan(5.5)
    expect(ticking).toBe(true)
  })

  test('sockets that survive hibernation keep their players', () => {
    const a = join('a')
    say(a, { t: 'seat', seat: 2, take: true })
    room = new Room(host, saved as SavedRoom)
    say(a, { t: 'bots', on: false })
    expect(a.last('room')?.seats[2]).toEqual({ owner: 1, status: 'here' })
  })
})

describe('bad input', () => {
  test('an old client is told to update', () => {
    const peer = new TestPeer()
    open.push(peer)
    say(peer, { t: 'hello', protocol: 'old', token: 'token-of-player-old' })
    expect(peer.last('error')?.code).toBe('update')
    expect(peer.closed).toBe(4000)
  })

  test('the room refuses more than its limit of devices', () => {
    for (let i = 0; i < MAX_PEERS; i++) join(`p${i}`)
    const extra = join('extra')
    expect(extra.last('error')?.code).toBe('full')
    expect(open.filter((peer) => peer.closed === null)).toHaveLength(MAX_PEERS)
  })

  test('nothing works before hello', () => {
    const peer = new TestPeer()
    open.push(peer)
    say(peer, { t: 'seat', seat: 0, take: true })
    expect(peer.closed).toBe(4004)
  })

  test.each([
    ['not JSON', 'nope'],
    ['an unknown type', '{"t":"nuke"}'],
    ['a seat out of range', '{"t":"seat","seat":9,"take":true}'],
    ['a time that is not a number', '{"t":"in","seat":0,"on":true,"at":"soon"}'],
    ['a huge message', JSON.stringify({ t: 'start', level: 'x'.repeat(1000) })],
  ])('%s closes the socket', (_name, text) => {
    const a = join('a')
    room.receive(a, text)
    expect(a.closed).toBe(4004)
  })

  test('an unknown level is ignored', () => {
    const a = join('a')
    say(a, { t: 'start', level: 'no-such-level' })
    expect(a.last('room')?.phase).toBe('lobby')
    expect(a.closed).toBeNull()
  })

  test('flooding closes the socket', () => {
    const a = join('a')
    for (let i = 0; i < 300; i++) say(a, { t: 'ping', c: i })
    expect(a.closed).toBe(4004)
  })
})
