// Measures a running room service with four bots on real sockets, each pressing the way
// a person following a shared cue would.
//
//   bun workers/rooms/probe.ts <service url> [trials] [one-way lag per bot in ms...]
//   bun workers/rooms/probe.ts https://rooms.example.workers.dev 40
//   bun workers/rooms/probe.ts http://localhost:8787 40 20 90 20 90
import { LEVELS } from '../../src/features/game/engine/levels'
import { applySnapshot } from '../../src/features/game/engine/snapshot'
import { createWorld } from '../../src/features/game/engine/world'
import {
  PROTOCOL,
  type ClientMessage,
  type ServerMessage,
} from '../../src/features/online/protocol'

const [url = 'http://localhost:8787', trialsArg = '40', ...lagArgs] =
  process.argv.slice(2)
const TRIALS = Number(trialsArg)
const LAGS = [0, 1, 2, 3].map((i) => Number(lagArgs[i] ?? 0))
/** Spread of human presses against a voice-style cue, from the spike's reading. */
const PRESS_SIGMA_MS = 50

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function gaussian() {
  const u = 1 - Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random())
}

function percentile(values: number[], p: number) {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
}

const res = await fetch(`${url}/rooms`, { method: 'POST' })
if (!res.ok) throw new Error(`could not create a room: ${res.status}`)
const { code } = (await res.json()) as { code: string }
console.log(`room ${code}`)

const world = createWorld(LEVELS[0])

class Bot {
  private socket: WebSocket
  private pings: { rtt: number; offset: number }[] = []
  rtts: number[] = []
  tickGaps: number[] = []
  snapshots = 0
  firstSnapshotAt = 0

  constructor(
    index: number,
    private lag: number,
  ) {
    this.socket = new WebSocket(`${url.replace(/^http/, 'ws')}/rooms/${code}/ws`)
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage
      setTimeout(() => this.receive(message), this.lag)
    })
    this.socket.addEventListener('open', () => {
      this.send({
        t: 'hello',
        protocol: PROTOCOL,
        token: `probe-bot-number-${index}-${code}`,
      })
    })
    this.socket.addEventListener('close', (event) => {
      if (event.code >= 4000) console.log(`bot ${index} closed: ${event.code}`)
    })
  }

  ready() {
    return new Promise<void>((resolve) => {
      if (this.socket.readyState === WebSocket.OPEN) resolve()
      else this.socket.addEventListener('open', () => resolve())
    })
  }

  send(message: ClientMessage) {
    const text = JSON.stringify(message)
    setTimeout(() => this.socket.send(text), this.lag)
  }

  ping() {
    this.send({ t: 'ping', c: performance.now() })
  }

  roomNow() {
    const best = this.pings.reduce((a, b) => (b.rtt < a.rtt ? b : a))
    return performance.now() + best.offset
  }

  press(seat: number) {
    this.send({ t: 'in', seat, on: true, at: this.roomNow() })
    setTimeout(
      () => this.send({ t: 'in', seat, on: false, at: this.roomNow() }),
      40,
    )
  }

  close() {
    this.socket.close()
  }

  private receive(message: ServerMessage) {
    if (message.t === 'pong') {
      const rtt = performance.now() - message.c
      this.rtts.push(rtt)
      this.tickGaps.push(message.g)
      this.pings.push({ rtt, offset: message.s + rtt / 2 - performance.now() })
      if (this.pings.length > 8) this.pings.shift()
    }
    if (message.t === 'snap') {
      applySnapshot(world, message.w)
      if (this.snapshots === 0) this.firstSnapshotAt = performance.now()
      this.snapshots++
    }
  }
}

const bots = LAGS.map((lag, i) => new Bot(i, lag))
await Promise.all(bots.map((bot) => bot.ready()))
await sleep(200)
for (let i = 0; i < 8; i++) {
  bots.forEach((bot) => bot.ping())
  await sleep(80)
}
bots.forEach((bot, seat) => bot.send({ t: 'seat', seat, take: true }))
await sleep(200)
bots[0].send({ t: 'start', level: LEVELS[0].id })
await sleep(3500)

const pinger = setInterval(() => bots.forEach((bot) => bot.ping()), 1000)
let hits = 0
for (let trial = 0; trial < TRIALS; trial++) {
  const before = world.harmonies
  // Alternate rear and front pairs so the tub stays roughly where it is.
  const pair = trial % 2 === 0 ? [2, 3] : [0, 1]
  const cue = performance.now() + 100
  for (const seat of pair) {
    const at = cue + gaussian() * PRESS_SIGMA_MS
    setTimeout(() => bots[seat].press(seat), Math.max(0, at - performance.now()))
  }
  await sleep(650 + Math.max(...LAGS) * 2)
  if (world.harmonies > before) hits++
}
clearInterval(pinger)

const seconds = (performance.now() - bots[0].firstSnapshotAt) / 1000
console.log(
  JSON.stringify(
    {
      lagsMs: LAGS,
      harmony: `${Math.round((hits / TRIALS) * 100)}%`,
      snapshotsPerSecond: Math.round((bots[0].snapshots / seconds) * 10) / 10,
      rttMs: bots.map((bot) => ({
        median: Math.round(percentile(bot.rtts, 0.5)),
        p95: Math.round(percentile(bot.rtts, 0.95)),
      })),
      roomTickGapMs: {
        median: percentile(bots[0].tickGaps, 0.5),
        p95: percentile(bots[0].tickGaps, 0.95),
        worst: Math.max(...bots[0].tickGaps),
      },
    },
    null,
    2,
  ),
)
bots.forEach((bot) => bot.close())
await sleep(100)
process.exit(0)
