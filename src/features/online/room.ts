import { autopilot } from '../game/engine/autopilot'
import { LEVELS } from '../game/engine/levels'
import {
  applySnapshot,
  encodeSnapshot,
  type Snapshot,
} from '../game/engine/snapshot'
import {
  createWorld,
  SEATS,
  STEP,
  stepWorld,
  type World,
} from '../game/engine/world'
import {
  CLOSE_ABUSE,
  CLOSE_CODES,
  HEARTBEAT,
  parseClientMessage,
  PROTOCOL,
  type ClientMessage,
  type RoomError,
  type RoomView,
  type SeatStatus,
  type SeatView,
  type ServerMessage,
} from './protocol'

const STEP_MS = STEP * 1000
const SNAPSHOT_MS = 1000 / 30
const CHECKPOINT_MS = 5000
const HOUSEKEEPING_MS = 1000
const MAX_CATCH_UP_MS = 250
/** How long a press may claim to be late. Co-op, so this only has to stop nonsense. */
const MAX_LATE_S = 0.25
const MAX_QUEUED_EDGES = 32
/** How long a dropped player keeps their seat before a bot or teammate can have it. */
export const SEAT_HOLD_MS = 15_000
/** A race nobody has touched for this long goes back to the lobby and stops billing. */
export const IDLE_RACE_MS = 5 * 60_000
export const MAX_PEERS = 8
const MAX_MESSAGES_PER_SECOND = 200

export type Peer = {
  send: (text: string) => void
  close: (code: number, reason: string) => void
  /** Set by `hello`. The host keeps this with the socket, across hibernation. */
  token: string | null
}

export type RoomHost = {
  now: () => number
  /** Open connections, including ones that haven't said hello yet. */
  peers: () => Peer[]
  save: (room: SavedRoom) => void
  /** The host calls `tick` often while this is on. Off lets the room hibernate. */
  setTicking: (on: boolean) => void
}

type Player = { number: number; goneAt: number | null }

/** All that survives a reset. Tokens stay in here and never reach other players. */
export type SavedRoom = {
  code: string
  players: Record<string, Player>
  seats: (string | null)[]
  bots: boolean
  level: string
  raceId: number
  world: Snapshot | null
}

export function newRoom(code: string): SavedRoom {
  return {
    code,
    players: {},
    seats: SEATS.map(() => null),
    bots: true,
    level: LEVELS[0].id,
    raceId: 0,
    world: null,
  }
}

const levelById = (id: string) => LEVELS.find((level) => level.id === id)

type Edge = { on: boolean; pressedAt: number }

/**
 * One room's authoritative simulation. It knows nothing about the platform it runs on:
 * see `workers/rooms` for the Durable Object that hosts it, and `room.test.ts` for one
 * made of plain objects.
 */
export class Room {
  private world: World | null = null
  private edges: Edge[][] = SEATS.map(() => [])
  private held = SEATS.map(() => false)
  private ticking = false
  private lastTick = 0
  private accumulator = 0
  private snapshotDue = 0
  private checkpointDue = 0
  private housekeepingDue = 0
  private lastInputAt = 0
  private wasRunning = false
  private lastSeats = ''
  private largestGap = 0
  private gapThisSecond = 0
  private budgets = new WeakMap<Peer, { second: number; count: number }>()

  constructor(
    private readonly host: RoomHost,
    private readonly saved: SavedRoom,
  ) {
    const level = levelById(saved.level)
    if (level && saved.world) {
      this.world = createWorld(level)
      applySnapshot(this.world, saved.world)
      this.held = this.world.seats.map((seat) => seat.held)
    }
    // Sockets don't always survive a reset, so whoever has none now has gone.
    const now = host.now()
    const here = new Set(host.peers().map((peer) => peer.token))
    for (const [token, player] of Object.entries(saved.players)) {
      if (!here.has(token)) player.goneAt ??= now
    }
    this.lastInputAt = now
    this.syncTicking()
  }

  receive(peer: Peer, text: string) {
    // Hosts that can answer this without waking the room never get as far as here.
    if (text === HEARTBEAT) {
      peer.send(HEARTBEAT)
      return
    }
    if (this.overBudget(peer)) {
      peer.close(CLOSE_ABUSE, 'too many messages')
      return
    }
    const message = parseClientMessage(text)
    if (!message) {
      peer.close(CLOSE_ABUSE, 'bad message')
      return
    }
    if (message.t === 'hello') {
      this.hello(peer, message.protocol, message.token)
      return
    }
    if (peer.token === null) {
      peer.close(CLOSE_ABUSE, 'hello first')
      return
    }
    this.handle(peer, peer.token, message)
  }

  /** The host calls this after a socket has closed. */
  left(peer: Peer) {
    const token = peer.token
    if (token === null) return
    const player = this.saved.players[token]
    // A reconnect may have replaced this socket before the old one finished closing.
    if (!player || this.peersOf(token).length > 0) return
    player.goneAt = this.host.now()
    this.saved.seats.forEach((owner, seat) => {
      if (owner === token) this.pushRelease(seat)
    })
    if (!this.saved.seats.includes(token)) delete this.saved.players[token]
    this.announce()
    this.save()
    this.syncTicking()
  }

  tick() {
    const now = this.host.now()
    const gap = now - this.lastTick
    this.lastTick = now
    this.gapThisSecond = Math.max(this.gapThisSecond, gap)
    const world = this.world
    const running = this.running()
    if (world && running) {
      this.accumulator += Math.min(gap, MAX_CATCH_UP_MS)
      while (this.accumulator >= STEP_MS && world.status !== 'finished') {
        this.stepOnce(world)
        this.accumulator -= STEP_MS
      }
    }

    if (now >= this.housekeepingDue) this.housekeeping(now)
    if (!world || !running || this.world !== world) return
    if (world.status === 'finished') {
      this.sendSnapshot(world, now)
      this.save()
      this.syncTicking()
      return
    }
    if (now >= this.snapshotDue) {
      this.snapshotDue = now + SNAPSHOT_MS
      this.sendSnapshot(world, now)
    }
    if (now >= this.checkpointDue) {
      this.checkpointDue = now + CHECKPOINT_MS
      this.save()
    }
  }

  private handle(peer: Peer, token: string, message: ClientMessage) {
    switch (message.t) {
      case 'ping':
        this.send(peer, {
          t: 'pong',
          c: message.c,
          s: this.host.now(),
          g: Math.round(this.largestGap),
        })
        break
      case 'seat':
        this.setSeat(token, message.seat, message.take)
        break
      case 'in':
        this.input(token, message.seat, message.on, message.at)
        break
      case 'start':
        this.start(message.level)
        break
      case 'lobby':
        this.backToLobby()
        break
      case 'bots':
        this.saved.bots = message.on
        this.announce()
        this.save()
        break
      case 'leave':
        this.leave(token)
        break
      default:
        break
    }
  }

  private hello(peer: Peer, protocol: string, token: string) {
    if (protocol !== PROTOCOL) {
      this.refuse(peer, 'update')
      return
    }
    const others = this.host.peers().filter((other) => other !== peer)
    // Rejoining often beats the old socket's close, so the token's old socket makes way.
    for (const other of others) {
      if (other.token === token) this.refuse(other, 'replaced')
    }
    const remaining = others.filter((other) => other.token !== token)
    if (remaining.length >= MAX_PEERS) {
      this.refuse(peer, 'full')
      return
    }
    peer.token = token
    const players = this.saved.players
    players[token] ??= { number: this.nextPlayerNumber(), goneAt: null }
    players[token].goneAt = null
    this.announce()
    this.save()
    if (this.world) {
      this.send(peer, {
        t: 'snap',
        s: this.host.now(),
        w: encodeSnapshot(this.world),
        ev: [],
      })
    }
    this.syncTicking()
  }

  private nextPlayerNumber() {
    const taken = new Set(Object.values(this.saved.players).map((p) => p.number))
    let number = 1
    while (taken.has(number)) number++
    return number
  }

  private setSeat(token: string, seat: number, take: boolean) {
    if (take) {
      if (!this.claim(token, seat)) return
    } else {
      if (this.saved.seats[seat] !== token) return
      this.saved.seats[seat] = null
      this.pushRelease(seat)
    }
    this.announce()
    this.save()
  }

  /** A seat is free if nobody has it, or its owner's hold ran out. */
  private claim(token: string, seat: number) {
    if (this.saved.seats[seat] === token) return true
    const status = this.seatStatus(seat)
    if (status === 'here' || status === 'away') return false
    const previous = this.saved.seats[seat]
    this.saved.seats[seat] = token
    if (previous) this.forgetIfSeatless(previous)
    return true
  }

  private forgetIfSeatless(token: string) {
    const player = this.saved.players[token]
    if (player?.goneAt !== null && !this.saved.seats.includes(token)) {
      delete this.saved.players[token]
    }
  }

  private input(token: string, seat: number, on: boolean, at: number) {
    const world = this.world
    if (!world) return
    if (this.saved.seats[seat] !== token) {
      // Pressing a free seat's key is how a player fills in mid-race.
      if (!on || !this.claim(token, seat)) return
      this.announce()
    }
    this.lastInputAt = this.host.now()
    const late = (this.host.now() - at) / 1000
    const clamped = Math.max(0, Math.min(MAX_LATE_S, late))
    if (this.edges[seat].length < MAX_QUEUED_EDGES) {
      this.edges[seat].push({ on, pressedAt: world.clock - clamped })
    }
  }

  private pushRelease(seat: number) {
    if (this.world) {
      this.edges[seat].push({ on: false, pressedAt: this.world.clock })
    } else {
      this.held[seat] = false
    }
  }

  private start(levelId: string) {
    const level = levelById(levelId)
    if (!level) return
    if (!this.saved.bots && this.saved.seats.every((owner) => owner === null))
      return
    this.saved.level = levelId
    this.saved.raceId++
    this.world = createWorld(level)
    this.edges = SEATS.map(() => [])
    this.held = SEATS.map(() => false)
    this.lastInputAt = this.host.now()
    this.snapshotDue = 0
    this.announce()
    this.save()
    this.syncTicking()
  }

  private backToLobby() {
    this.world = null
    this.edges = SEATS.map(() => [])
    this.held = SEATS.map(() => false)
    this.announce()
    this.save()
    this.syncTicking()
  }

  private leave(token: string) {
    this.saved.seats = this.saved.seats.map((owner, seat) => {
      if (owner !== token) return owner
      this.pushRelease(seat)
      return null
    })
    delete this.saved.players[token]
    for (const peer of this.peersOf(token)) peer.token = null
    this.announce()
    this.save()
    this.syncTicking()
  }

  private stepOnce(world: World) {
    let botWants: boolean[] | null = null
    const wants = SEATS.map(() => false)
    const pressedAt: (number | null)[] = SEATS.map(() => null)
    for (let seat = 0; seat < SEATS.length; seat++) {
      const edge = this.edges[seat].shift()
      if (edge) {
        this.held[seat] = edge.on
        if (edge.on) pressedAt[seat] = edge.pressedAt
      }
      const status = this.seatStatus(seat)
      if (status === 'here') wants[seat] = this.held[seat]
      if (status === 'bot') {
        botWants ??= autopilot(world)
        wants[seat] = botWants[seat]
      }
    }
    stepWorld(world, wants, STEP, pressedAt)
  }

  private seatStatus(seat: number): SeatStatus {
    const owner = this.saved.seats[seat]
    const player = owner ? this.saved.players[owner] : null
    if (player) {
      if (player.goneAt === null) return 'here'
      if (this.host.now() - player.goneAt < SEAT_HOLD_MS) return 'away'
    }
    return this.saved.bots ? 'bot' : 'free'
  }

  private seatViews(): SeatView[] {
    return this.saved.seats.map((owner, seat) => {
      const status = this.seatStatus(seat)
      const showOwner = owner && (status === 'here' || status === 'away')
      return {
        status,
        owner: showOwner ? (this.saved.players[owner]?.number ?? null) : null,
      }
    })
  }

  private housekeeping(now: number) {
    this.housekeepingDue = now + HOUSEKEEPING_MS
    this.largestGap = this.gapThisSecond
    this.gapThisSecond = 0
    // Holds expire with no message to trigger an update, so look for them here.
    if (JSON.stringify(this.seatViews()) !== this.lastSeats) this.announce()
    if (this.running() && now - this.lastInputAt > IDLE_RACE_MS) this.backToLobby()
    this.syncTicking()
  }

  private sendSnapshot(world: World, now: number) {
    this.broadcast({
      t: 'snap',
      s: now,
      w: encodeSnapshot(world),
      ev: world.events,
    })
    world.events.length = 0
  }

  private announce() {
    const seats = this.seatViews()
    this.lastSeats = JSON.stringify(seats)
    const view: Omit<RoomView, 'you'> = {
      code: this.saved.code,
      phase: this.world ? 'race' : 'lobby',
      level: this.saved.level,
      raceId: this.saved.raceId,
      bots: this.saved.bots,
      seats,
    }
    for (const peer of this.host.peers()) {
      const player = peer.token ? this.saved.players[peer.token] : null
      if (player) this.send(peer, { t: 'room', ...view, you: player.number })
    }
  }

  private broadcast(message: ServerMessage) {
    const text = JSON.stringify(message)
    for (const peer of this.host.peers()) {
      if (peer.token !== null) peer.send(text)
    }
  }

  private send(peer: Peer, message: ServerMessage) {
    peer.send(JSON.stringify(message))
  }

  private refuse(peer: Peer, code: RoomError) {
    this.send(peer, { t: 'error', code })
    peer.close(CLOSE_CODES[code], code)
  }

  private peersOf(token: string) {
    return this.host.peers().filter((peer) => peer.token === token)
  }

  private overBudget(peer: Peer) {
    const second = Math.floor(this.host.now() / 1000)
    const budget = this.budgets.get(peer)
    if (budget?.second !== second) {
      this.budgets.set(peer, { second, count: 1 })
      return false
    }
    budget.count++
    return budget.count > MAX_MESSAGES_PER_SECOND
  }

  private save() {
    this.saved.world = this.world ? encodeSnapshot(this.world) : null
    this.host.save(this.saved)
  }

  /** Whether there's a race on and anyone there for it. Otherwise it waits for them. */
  private running() {
    return (
      this.world !== null &&
      this.world.status !== 'finished' &&
      Object.values(this.saved.players).some((player) => player.goneAt === null)
    )
  }

  /** Whether a seat is being kept for someone, which has to run out with no message. */
  private holdingSeat() {
    return SEATS.some((_, seat) => this.seatStatus(seat) === 'away')
  }

  private syncTicking() {
    const running = this.running()
    if (running && !this.wasRunning) {
      this.accumulator = 0
      this.lastInputAt = this.host.now()
    }
    this.wasRunning = running
    const wanted = running || this.holdingSeat()
    if (wanted === this.ticking) return
    this.ticking = wanted
    if (wanted) this.lastTick = this.host.now()
    this.host.setTicking(wanted)
  }
}
