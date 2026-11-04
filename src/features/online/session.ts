import { LEVELS } from '../game/engine/levels'
import { applySnapshot, type Snapshot } from '../game/engine/snapshot'
import {
  createWorld,
  KICK_GAS,
  SEATS,
  type GameEvent,
  type World,
} from '../game/engine/world'
import { dropOldInputs, forecast, type OwnInput } from './predict'
import {
  CLOSE_CODES,
  HEARTBEAT,
  PROTOCOL,
  type ClientMessage,
  type RoomError,
  type RoomView,
  type ServerMessage,
} from './protocol'

const PING_SAMPLES = 8
const PING_BURST = 6
const PING_BURST_MS = 100
const PING_RACE_MS = 1000
const HEARTBEAT_MS = 20_000
/** A race sends 30 snapshots a second, so a few silent seconds mean the line is dead. */
const SILENCE_IN_RACE_MS = 5000
const SILENCE_IN_LOBBY_MS = 50_000
const CONNECT_TIMEOUT_MS = 8000
const BACKOFF_START_MS = 250
const BACKOFF_MAX_MS = 5000
const ATTEMPTS_BEFORE_GIVING_UP = 4
/** Long enough for a predicted blast's echo to come back, or to give up on it. */
const ECHO_MS = 1500
/** Sounds older than this are dropped, so a hidden tab doesn't play them all at once. */
const STALE_EVENT_MS = 1000
/** How fast the shown tub catches the forecast. */
const SMOOTHING = 18
/** Past this the tub really has gone somewhere else, like a respawn. */
const SNAP_DISTANCE = 200
const SNAP_ANGLE = 1

export type SessionError = RoomError | 'unreachable'

export type SessionState = {
  status: 'connecting' | 'open' | 'reconnecting' | 'closed'
  error: SessionError | null
  room: RoomView | null
  /** A seat this player had, which someone else took while they were away. */
  lostSeat: number | null
  rtt: number
  tickGap: number
}

/** The part of a WebSocket used here, so tests and fake lag can stand in for one. */
export type SocketLike = {
  readonly readyState: number
  addEventListener(type: 'open', listener: () => void): void
  addEventListener(type: 'close', listener: (event: { code: number }) => void): void
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void,
  ): void
  send(text: string): void
  close(code?: number, reason?: string): void
}

const SOCKET_OPEN = 1

type SessionOptions = {
  url: string
  code: string
  token: string
  /** What to call this player. The room hears it on every connection. */
  name?: string
  createSocket?: (url: string) => SocketLike
  now?: () => number
  /** Off in tests, which call `pump` themselves. */
  autoPump?: boolean
}

function angleBetween(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

/** Asks for a new room, near whoever asked. */
export async function createRoom(url: string) {
  const response = await fetch(`${url}/rooms`, { method: 'POST' })
  if (!response.ok) throw new Error(`rooms: ${response.status}`)
  const { code } = (await response.json()) as { code: string }
  return code
}

/**
 * One device's connection to a room. Holds what the room last said, and from it works
 * out what to show right now: see `display`.
 */
export class OnlineSession {
  private state: SessionState = {
    status: 'connecting',
    error: null,
    room: null,
    lostSeat: null,
    rtt: 0,
    tickGap: 0,
  }
  private listeners = new Set<() => void>()
  private readonly now: () => number
  private readonly createSocket: (url: string) => SocketLike
  private readonly socketUrl: string
  private readonly token: string
  private name: string

  private socket: SocketLike | null = null
  private pumpTimer: ReturnType<typeof setInterval> | null = null
  private everOpened = false
  private attempts = 0
  private reconnectAt = 0
  private connectingSince = 0
  private lastHeard = 0
  private nextPingAt = 0
  private burstLeft = 0
  private nextHeartbeatAt = 0

  private pings: { rtt: number; offset: number }[] = []
  private offset = 0
  private bestRtt = 0

  private world: World | null = null
  private snapshot: { w: Snapshot; s: number; clock: number } | null = null
  private shown: { x: number; y: number; angle: number } | null = null
  private finishedRace: number | null = null
  private own: OwnInput[] = []
  private mySeats = new Set<number>()
  private held = SEATS.map(() => false)
  private sent = SEATS.map(() => false)
  private released = new Set<number>()

  private predicted = SEATS.map(() => false)
  private blastEchoes: number[][] = SEATS.map(() => [])
  private releaseEchoes: number[][] = SEATS.map(() => [])
  private events: { at: number; event: GameEvent }[] = []

  constructor(options: SessionOptions) {
    this.now = options.now ?? Date.now
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url))
    this.socketUrl = `${options.url.replace(/^http/, 'ws')}/rooms/${options.code}/ws`
    this.token = options.token
    this.name = options.name ?? ''
    this.open()
    if (options.autoPump !== false) {
      this.pumpTimer = setInterval(() => this.pump(), PING_BURST_MS)
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState = () => this.state

  getName = () => this.name

  /** Timers run here so that they all keep going without animation frames. */
  pump() {
    if (this.state.status === 'closed') return
    const now = this.now()
    const socket = this.socket
    if (!socket) {
      if (now >= this.reconnectAt) this.open()
      return
    }
    if (socket.readyState !== SOCKET_OPEN) {
      if (now - this.connectingSince > CONNECT_TIMEOUT_MS) this.dropped()
      return
    }
    const inRace = this.state.room?.phase === 'race'
    if (
      now - this.lastHeard >
      (inRace ? SILENCE_IN_RACE_MS : SILENCE_IN_LOBBY_MS)
    ) {
      this.dropped()
      return
    }
    if (this.burstLeft > 0 || inRace) {
      if (now >= this.nextPingAt) {
        this.burstLeft = Math.max(0, this.burstLeft - 1)
        this.nextPingAt = now + (this.burstLeft > 0 ? PING_BURST_MS : PING_RACE_MS)
        this.send({ t: 'ping', c: now })
      }
    } else if (now >= this.nextHeartbeatAt) {
      // Unlike a ping, this doesn't wake a hibernating room or get billed as a message.
      this.nextHeartbeatAt = now + HEARTBEAT_MS
      socket.send(HEARTBEAT)
    }
  }

  /** The room's clock, as near as this device can tell. */
  roomNow() {
    return this.now() + this.offset
  }

  /** Which seats this device is pressing. Only changes get sent. */
  setHeld(held: readonly boolean[]) {
    this.held = [...held]
    this.flushHeld()
  }

  /**
   * The world to draw this frame, or null when not in a race. Starts from the room's
   * latest word and runs on to the moment this device's input would land, so that a
   * press moves the tub at once whatever the ping is.
   */
  display(dt: number) {
    const world = this.world
    if (!world) return null
    const snapshot = this.snapshot
    if (!snapshot) return world

    forecast(
      world,
      snapshot.w,
      this.own,
      this.mySeats,
      this.simNow(snapshot) + this.bestRtt / 2000,
    )

    // Corrections from the room get eased in rather than popping the tub sideways.
    const target = { x: world.x, y: world.y, angle: world.angle }
    const shown = this.shown ?? target
    const turn = angleBetween(shown.angle, target.angle)
    if (
      Math.hypot(target.x - shown.x, target.y - shown.y) > SNAP_DISTANCE ||
      Math.abs(turn) > SNAP_ANGLE
    ) {
      this.shown = target
    } else {
      const blend = 1 - Math.exp(-SMOOTHING * dt)
      this.shown = {
        x: shown.x + (target.x - shown.x) * blend,
        y: shown.y + (target.y - shown.y) * blend,
        angle: shown.angle + turn * blend,
      }
      world.x = this.shown.x
      world.y = this.shown.y
      world.angle = this.shown.angle
    }
    return world
  }

  /** Sounds and effects to play. Own seats' blasts are in here before the room hears them. */
  takeEvents() {
    const oldest = this.now() - STALE_EVENT_MS
    const events = this.events
      .filter(({ at, event }) => at >= oldest || event.type === 'finish')
      .map(({ event }) => event)
    this.events = []
    return events
  }

  start(level: string) {
    this.send({ t: 'start', level })
  }

  toLobby() {
    this.send({ t: 'lobby' })
  }

  setBots(on: boolean) {
    this.send({ t: 'bots', on })
  }

  toggleSeat(seat: number) {
    const take = !this.mySeats.has(seat)
    if (!take) this.released.add(seat)
    this.send({ t: 'seat', seat, take })
    if (take && this.state.lostSeat === seat) this.update({ lostSeat: null })
  }

  setName(name: string) {
    if (name === this.name) return
    this.name = name
    this.send({ t: 'name', name })
  }

  leave() {
    this.send({ t: 'leave' })
    this.close()
  }

  /** Stops everything without giving up any seats, as when a page goes away. */
  close() {
    if (this.pumpTimer) clearInterval(this.pumpTimer)
    this.pumpTimer = null
    const socket = this.socket
    this.socket = null
    socket?.close(1000, 'bye')
    this.update({ status: 'closed' })
  }

  private update(changes: Partial<SessionState>) {
    this.state = { ...this.state, ...changes }
    for (const listener of this.listeners) listener()
  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === SOCKET_OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }

  private open() {
    const socket = this.createSocket(this.socketUrl)
    this.socket = socket
    this.connectingSince = this.now()
    // A socket given up on can still fire, and has nothing more to say to this session.
    const isCurrent = () => this.socket === socket
    socket.addEventListener('open', () => {
      if (!isCurrent()) return
      this.everOpened = true
      this.attempts = 0
      this.lastHeard = this.now()
      this.sent = SEATS.map(() => false)
      this.nextHeartbeatAt = this.now() + HEARTBEAT_MS
      this.burstLeft = PING_BURST
      this.nextPingAt = 0
      this.send({ t: 'hello', protocol: PROTOCOL, token: this.token })
      // Also when empty, since it may have been cleared while the line was down.
      this.send({ t: 'name', name: this.name })
      this.update({ status: 'open', error: null })
      this.pump()
    })
    socket.addEventListener('message', (event) => {
      if (!isCurrent()) return
      this.lastHeard = this.now()
      if (event.data === HEARTBEAT) return
      this.receive(JSON.parse(String(event.data)) as ServerMessage)
    })
    socket.addEventListener('close', (event) => {
      if (!isCurrent()) return
      const final = Object.entries(CLOSE_CODES).find(
        ([, code]) => code === event.code,
      )
      if (final) this.stop(final[0] as RoomError)
      else this.dropped()
    })
  }

  /** The room said not to come back, so don't. */
  private stop(error: RoomError) {
    this.close()
    this.update({ error })
  }

  private dropped() {
    const socket = this.socket
    this.socket = null
    socket?.close()
    this.attempts++
    if (!this.everOpened && this.attempts >= ATTEMPTS_BEFORE_GIVING_UP) {
      this.close()
      this.update({ error: 'unreachable' })
      return
    }
    // The room has let go of these blasts, and any echo is lost with the socket.
    this.predicted.forEach((blasting, seat) => {
      if (blasting) this.queueEvent({ type: 'release', seat })
    })
    this.resetPrediction()
    const backoff = BACKOFF_START_MS * 2 ** Math.min(this.attempts - 1, 8)
    this.reconnectAt = this.now() + Math.min(backoff, BACKOFF_MAX_MS)
    this.update({ status: this.everOpened ? 'reconnecting' : 'connecting' })
  }

  private receive(message: ServerMessage) {
    switch (message.t) {
      case 'pong':
        this.pong(message.c, message.s, message.g)
        break
      case 'room': {
        const { t: _t, ...view } = message
        this.roomChanged(view)
        break
      }
      case 'snap':
        this.snap(message.s, message.w, message.ev)
        break
      case 'error':
        this.update({ error: message.code })
        break
      default:
        break
    }
  }

  private pong(sentAt: number, roomTime: number, tickGap: number) {
    const now = this.now()
    const rtt = now - sentAt
    this.pings.push({ rtt, offset: roomTime + rtt / 2 - now })
    if (this.pings.length > PING_SAMPLES) this.pings.shift()
    // The quickest round trip is the one with the least queueing to skew its halves.
    const best = this.pings.reduce((a, b) => (b.rtt < a.rtt ? b : a))
    this.offset = best.offset
    this.bestRtt = best.rtt
    this.update({ rtt: best.rtt, tickGap })
  }

  private roomChanged(view: RoomView) {
    const before = this.state.room
    const mine = new Set<number>()
    view.seats.forEach((seat, i) => {
      if (seat.owner === view.you) mine.add(i)
    })

    let lostSeat = this.state.lostSeat
    for (const seat of this.mySeats) {
      if (!mine.has(seat) && !this.released.has(seat)) lostSeat = seat
    }
    this.released.clear()
    this.mySeats = mine

    const raceChanged =
      view.raceId !== before?.raceId || view.phase !== before.phase
    if (raceChanged) {
      lostSeat = null
      this.world =
        view.phase === 'race'
          ? createWorld(
              LEVELS.find((level) => level.id === view.level) ?? LEVELS[0],
            )
          : null
      this.snapshot = null
      this.shown = null
      this.own = []
      this.events = []
      this.sent = SEATS.map(() => false)
      this.resetPrediction()
      if (view.phase === 'race') this.burstLeft = PING_BURST
    }
    this.update({ room: view, lostSeat })
    this.flushHeld()
  }

  private snap(roomTime: number, snapshot: Snapshot, events: GameEvent[]) {
    const world = this.world
    if (!world) return
    applySnapshot(world, snapshot)
    this.snapshot = { w: snapshot, s: roomTime, clock: world.clock }
    dropOldInputs(this.own, world.clock)
    for (const event of events) {
      if (!this.isEcho(event) && event.type !== 'finish') this.queueEvent(event)
    }
    // Someone who rejoins at the finish never saw the event, but still gets the result.
    const raceId = this.state.room?.raceId ?? 0
    if (world.status === 'finished' && this.finishedRace !== raceId) {
      this.finishedRace = raceId
      this.queueEvent({ type: 'finish' })
    }
  }

  /** Whether an event from the room is one this device already played by predicting it. */
  private isEcho(event: GameEvent) {
    if (event.type !== 'blast' && event.type !== 'release') return false
    if (!this.mySeats.has(event.seat)) return false
    const echoes = event.type === 'blast' ? this.blastEchoes : this.releaseEchoes
    const live = echoes[event.seat].filter((deadline) => deadline > this.now())
    const isEcho = live.length > 0
    live.shift()
    echoes[event.seat] = live
    if (event.type === 'blast') return isEcho && !event.ignited
    // Not one of this device's, so gas ran out while the key was still down.
    if (!isEcho) this.predicted[event.seat] = false
    return isEcho
  }

  private queueEvent(event: GameEvent) {
    this.events.push({ at: this.now(), event })
  }

  private resetPrediction() {
    this.predicted = SEATS.map(() => false)
    this.blastEchoes = SEATS.map(() => [])
    this.releaseEchoes = SEATS.map(() => [])
  }

  private flushHeld() {
    const room = this.state.room
    if (room?.phase !== 'race' || this.socket?.readyState !== SOCKET_OPEN) return
    this.held.forEach((on, seat) => {
      if (on === this.sent[seat]) return
      const { status } = room.seats[seat]
      const pressable =
        this.mySeats.has(seat) || status === 'bot' || status === 'free'
      if (on && !pressable) return
      this.sent[seat] = on
      this.send({ t: 'in', seat, on, at: this.roomNow() })
      if (this.mySeats.has(seat)) this.predictInput(seat, on)
    })
  }

  private predictInput(seat: number, on: boolean) {
    const world = this.world
    const snapshot = this.snapshot
    if (!world || !snapshot) return
    this.own.push({
      clock: this.simNow(snapshot) + this.bestRtt / 2000,
      seat,
      on,
    })
    if (world.status !== 'racing') return
    const deadline = this.now() + ECHO_MS
    if (on && world.seats[seat].gas >= KICK_GAS) {
      this.predicted[seat] = true
      this.blastEchoes[seat].push(deadline)
      this.queueEvent({ type: 'blast', seat, harmony: false, ignited: false })
    }
    if (!on && this.predicted[seat]) {
      this.predicted[seat] = false
      this.releaseEchoes[seat].push(deadline)
      this.queueEvent({ type: 'release', seat })
    }
  }

  /** The room's sim clock right now, by the room's own clock. */
  private simNow(snapshot: { s: number; clock: number }) {
    return snapshot.clock + (this.roomNow() - snapshot.s) / 1000
  }
}

function later(when: number, run: () => void) {
  setTimeout(run, Math.max(0, when - performance.now()))
}

/** Fake network conditions for trying things out: `?lag=100&jitter=20` in development. */
export function laggySocket(url: string, lag: number, jitter: number) {
  const real = new WebSocket(url)
  let outAt = 0
  let inAt = 0
  const delay = () => lag + Math.random() * jitter
  // Everything stays in order, as it would over TCP.
  return {
    get readyState() {
      return real.readyState
    },
    addEventListener(type: string, listener: (event: never) => void) {
      if (type !== 'message') {
        real.addEventListener(type, listener as EventListener)
        return
      }
      real.addEventListener('message', (event) => {
        inAt = Math.max(inAt, performance.now() + delay())
        later(inAt, () => listener(event as never))
      })
    },
    send(text: string) {
      outAt = Math.max(outAt, performance.now() + delay())
      later(outAt, () => {
        if (real.readyState === SOCKET_OPEN) real.send(text)
      })
    },
    close(code?: number, reason?: string) {
      later(outAt, () => real.close(code, reason))
    },
  } as SocketLike
}
