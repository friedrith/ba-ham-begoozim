import { buildCourse, indexAt, pointAt, type Course } from './course'
import type { LevelDef } from './levels'

export const STEP = 1 / 120

const INERTIA = 850
const FORWARD_DRAG = 0.9
const LATERAL_DRAG = 2.8
const ANGULAR_DRAG = 2.4
const RESTITUTION = 0.45

const KICK = 70
const HOLD_THRUST = 130
const KICK_GAS = 0.1
const HOLD_GAS = 0.32
const REGEN_GAS = 0.2
const CAN_GAS = 0.4

const SYNC_WINDOW = 0.14
const HARMONY_KICK = 1.5
const HARMONY_GAS = 0.06
const IGNITE_KICK = 3.2
const FLAME_RADIUS = 120

export const CAN_RADIUS = 16
export const URCHIN_RADIUS = 22
const SWALLOW_RADIUS = 18
const HULL_RADIUS = 32
const HULL_OFFSETS = [-30, 0, 30]
const WALL_WINDOW = 14
const PROGRESS_WINDOW = 22
const COUNTDOWN = 3
const RESPAWN_GRACE = 1.5
/** Far enough along that the hull clears the sealed back wall. */
const START_INDEX = 6

/** Seats mirror the keyboard corners: Q, P up top and Z, M along the bottom. */
export const SEATS = [
  { name: 'Front left', key: 'Q', lx: -17, ly: 30, thrust: -1 },
  { name: 'Front right', key: 'P', lx: 17, ly: 30, thrust: -1 },
  { name: 'Rear left', key: 'Z', lx: -17, ly: -30, thrust: 1 },
  { name: 'Rear right', key: 'M', lx: 17, ly: -30, thrust: 1 },
] as const

export type SeatState = {
  gas: number
  blasting: boolean
  held: boolean
  lastPress: number
  paired: boolean
}

export type GameEvent =
  | { type: 'tick'; value: number }
  | { type: 'go' }
  | { type: 'blast'; seat: number; harmony: boolean; ignited: boolean }
  | { type: 'release'; seat: number }
  | { type: 'empty'; seat: number }
  | { type: 'harmony'; x: number; y: number }
  | { type: 'ignite'; x: number; y: number }
  | { type: 'bump'; x: number; y: number; force: number }
  | { type: 'can'; x: number; y: number }
  | { type: 'checkpoint' }
  | { type: 'respawn'; x: number; y: number }
  | { type: 'finish' }

export type Can = { x: number; y: number; taken: boolean }
export type Urchin = { x: number; y: number; orbit: number; speed: number }
export type Whirl = { x: number; y: number; radius: number; pull: number }
export type Gate = {
  x: number
  y: number
  nx: number
  ny: number
  hw: number
  period: number
  phase: number
}
export type Paddle = { x: number; y: number; length: number; speed: number }
export type Current = { from: number; to: number; strength: number }
export type Flame = { x: number; y: number; cooldown: number }

export type World = {
  level: LevelDef
  course: Course
  checkpoints: number[]
  cans: Can[]
  urchins: Urchin[]
  whirls: Whirl[]
  gates: Gate[]
  paddles: Paddle[]
  currents: Current[]
  flames: Flame[]
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  seats: SeatState[]
  status: 'countdown' | 'racing' | 'finished'
  countdown: number
  /** Always runs, so hazards keep moving during the countdown. */
  clock: number
  raceTime: number
  sampleIndex: number
  furthest: number
  checkpoint: number
  grace: number
  bumpCooldown: number
  harmonies: number
  wipeouts: number
  cansTaken: number
  events: GameEvent[]
}

/** The finish sits short of the end wall, so the hull can cross it before touching. */
export function finishIndex(course: Course) {
  return course.samples.length - 9
}

export function createWorld(level: LevelDef): World {
  const course = buildCourse(level.path)
  const world: World = {
    level,
    course,
    checkpoints: level.checkpoints.map((at) => indexAt(course, at)),
    cans: [],
    urchins: [],
    whirls: [],
    gates: [],
    paddles: [],
    currents: [],
    flames: [],
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    spin: 0,
    seats: SEATS.map(() => ({
      gas: 1,
      blasting: false,
      held: false,
      lastPress: -1,
      paired: false,
    })),
    status: 'countdown',
    countdown: COUNTDOWN,
    clock: 0,
    raceTime: 0,
    sampleIndex: START_INDEX,
    furthest: START_INDEX,
    checkpoint: START_INDEX,
    grace: 0,
    bumpCooldown: 0,
    harmonies: 0,
    wipeouts: 0,
    cansTaken: 0,
    events: [],
  }

  for (const item of level.items) {
    if (item.kind === 'current') {
      world.currents.push({
        from: indexAt(course, item.from),
        to: indexAt(course, item.to),
        strength: item.strength,
      })
      continue
    }
    if (item.kind === 'gate') {
      const s = course.samples[indexAt(course, item.at)]
      world.gates.push({
        x: s.x,
        y: s.y,
        nx: s.nx,
        ny: s.ny,
        hw: s.hw,
        period: item.period,
        phase: item.phase ?? 0,
      })
      continue
    }
    const { x, y } = pointAt(course, item.at, item.offset ?? 0)
    if (item.kind === 'can') world.cans.push({ x, y, taken: false })
    if (item.kind === 'urchin') {
      world.urchins.push({ x, y, orbit: item.orbit ?? 0, speed: item.speed ?? 0 })
    }
    if (item.kind === 'whirl') {
      world.whirls.push({ x, y, radius: item.radius, pull: item.pull })
    }
    if (item.kind === 'paddle') {
      world.paddles.push({ x, y, length: item.length, speed: item.speed })
    }
    if (item.kind === 'flame') world.flames.push({ x, y, cooldown: 0 })
  }

  placeAt(world, world.checkpoint)
  return world
}

function placeAt(world: World, index: number) {
  const s = world.course.samples[index]
  world.x = s.x
  world.y = s.y
  world.vx = 0
  world.vy = 0
  world.spin = 0
  world.angle = Math.atan2(s.tx, -s.ty)
  world.sampleIndex = index
}

/** Forward (bow) direction of the tub. An angle of 0 points up the screen. */
export function forwardOf(angle: number) {
  return { x: Math.sin(angle), y: -Math.cos(angle) }
}

/** World position of a point given in tub space (lx to starboard, ly to the bow). */
export function tubToWorld(world: World, lx: number, ly: number) {
  const f = forwardOf(world.angle)
  return { x: world.x - f.y * lx + f.x * ly, y: world.y + f.x * lx + f.y * ly }
}

export function urchinPosition(urchin: Urchin, clock: number) {
  if (!urchin.orbit) return { x: urchin.x, y: urchin.y }
  const a = clock * urchin.speed
  return {
    x: urchin.x + Math.cos(a) * urchin.orbit,
    y: urchin.y + Math.sin(a) * urchin.orbit,
  }
}

/** The moving bar of a gate: it always spans 62% of the channel and slides across. */
export function gateBar(gate: Gate, clock: number) {
  const w = (Math.PI * 2) / gate.period
  const travel = gate.hw * 0.38
  const offset = Math.sin(clock * w + gate.phase) * travel
  const speed = Math.cos(clock * w + gate.phase) * travel * w
  const cx = gate.x + gate.nx * offset
  const cy = gate.y + gate.ny * offset
  const half = gate.hw * 0.62
  return {
    ax: cx - gate.nx * half,
    ay: cy - gate.ny * half,
    bx: cx + gate.nx * half,
    by: cy + gate.ny * half,
    ux: gate.nx * speed,
    uy: gate.ny * speed,
  }
}

export function paddleBar(paddle: Paddle, clock: number) {
  const a = clock * paddle.speed
  const dx = Math.cos(a) * paddle.length
  const dy = Math.sin(a) * paddle.length
  return {
    ax: paddle.x - dx,
    ay: paddle.y - dy,
    bx: paddle.x + dx,
    by: paddle.y + dy,
  }
}

function push(world: World, seatIndex: number, amount: number) {
  const seat = SEATS[seatIndex]
  const f = forwardOf(world.angle)
  const r = tubToWorld(world, seat.lx, seat.ly)
  const fx = f.x * seat.thrust * amount
  const fy = f.y * seat.thrust * amount
  world.vx += fx
  world.vy += fy
  world.spin += ((r.x - world.x) * fy - (r.y - world.y) * fx) / INERTIA
}

function pressSeat(world: World, index: number) {
  const seat = world.seats[index]
  if (seat.gas < KICK_GAS) {
    world.events.push({ type: 'empty', seat: index })
    return
  }

  let harmony = false
  world.seats.forEach((other, i) => {
    if (i === index || world.clock - other.lastPress >= SYNC_WINDOW) return
    harmony = true
    if (!other.paired) {
      other.paired = true
      push(world, i, KICK * (HARMONY_KICK - 1))
    }
  })

  const pos = tubToWorld(world, SEATS[index].lx, SEATS[index].ly)
  let ignited = false
  for (const flame of world.flames) {
    if (flame.cooldown > 0) continue
    if (Math.hypot(flame.x - pos.x, flame.y - pos.y) < FLAME_RADIUS) {
      flame.cooldown = 0.6
      ignited = true
      world.events.push({ type: 'ignite', x: flame.x, y: flame.y })
    }
  }

  let kick = KICK
  if (harmony) kick *= HARMONY_KICK
  if (ignited) kick *= IGNITE_KICK
  push(world, index, kick)

  seat.gas -= KICK_GAS
  seat.blasting = true
  seat.lastPress = world.clock
  seat.paired = harmony
  if (harmony) {
    seat.gas = Math.min(1, seat.gas + HARMONY_GAS)
    world.harmonies++
    world.events.push({ type: 'harmony', x: pos.x, y: pos.y })
  }
  world.events.push({ type: 'blast', seat: index, harmony, ignited })
}

function updateSeats(world: World, held: readonly boolean[], dt: number) {
  const canBlast = world.status === 'racing'
  world.seats.forEach((seat, i) => {
    const wants = canBlast && Boolean(held[i])
    if (wants && !seat.held) pressSeat(world, i)
    if (!wants && seat.blasting) {
      seat.blasting = false
      world.events.push({ type: 'release', seat: i })
    }
    seat.held = wants

    if (seat.blasting) {
      seat.gas -= HOLD_GAS * dt
      push(world, i, HOLD_THRUST * dt)
      if (seat.gas <= 0) {
        seat.gas = 0
        seat.blasting = false
        world.events.push({ type: 'release', seat: i }, { type: 'empty', seat: i })
      }
    } else {
      seat.gas = Math.min(1, seat.gas + REGEN_GAS * dt)
    }
  })
}

function applyWater(world: World, dt: number) {
  const f = forwardOf(world.angle)
  const along = world.vx * f.x + world.vy * f.y
  const side = -world.vx * f.y + world.vy * f.x
  const newAlong = along * Math.exp(-FORWARD_DRAG * dt)
  const newSide = side * Math.exp(-LATERAL_DRAG * dt)
  world.vx = f.x * newAlong - f.y * newSide
  world.vy = f.y * newAlong + f.x * newSide
  world.spin *= Math.exp(-ANGULAR_DRAG * dt)

  const s = world.course.samples[world.sampleIndex]
  for (const current of world.currents) {
    if (world.sampleIndex >= current.from && world.sampleIndex <= current.to) {
      world.vx += s.tx * current.strength * dt
      world.vy += s.ty * current.strength * dt
    }
  }

  for (const whirl of world.whirls) {
    const dx = whirl.x - world.x
    const dy = whirl.y - world.y
    const d = Math.hypot(dx, dy)
    if (d > whirl.radius || d === 0) continue
    const force = whirl.pull * (1 - d / whirl.radius)
    world.vx += ((dx / d) * force + (-dy / d) * force * 0.6) * dt
    world.vy += ((dy / d) * force + (dx / d) * force * 0.6) * dt
    if (d < SWALLOW_RADIUS && world.grace <= 0) wipeout(world)
  }
}

type Surface = {
  ux?: number
  uy?: number
  cx?: number
  cy?: number
  omega?: number
}

function collideSegment(
  world: World,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  surface: Surface = {},
) {
  const abx = bx - ax
  const aby = by - ay
  const lengthSq = abx * abx + aby * aby || 1

  for (const offset of HULL_OFFSETS) {
    const c = tubToWorld(world, 0, offset)
    const t = Math.max(
      0,
      Math.min(1, ((c.x - ax) * abx + (c.y - ay) * aby) / lengthSq),
    )
    const px = ax + abx * t
    const py = ay + aby * t
    const dx = c.x - px
    const dy = c.y - py
    const d = Math.hypot(dx, dy)
    if (d >= HULL_RADIUS || d === 0) continue

    const nx = dx / d
    const ny = dy / d
    world.x += nx * (HULL_RADIUS - d)
    world.y += ny * (HULL_RADIUS - d)

    const rx = px - world.x
    const ry = py - world.y
    const omega = surface.omega ?? 0
    const surfaceX = (surface.ux ?? 0) - omega * (py - (surface.cy ?? 0))
    const surfaceY = (surface.uy ?? 0) + omega * (px - (surface.cx ?? 0))
    const relX = world.vx - world.spin * ry - surfaceX
    const relY = world.vy + world.spin * rx - surfaceY
    const closing = relX * nx + relY * ny
    if (closing >= 0) continue

    const rn = rx * ny - ry * nx
    const impulse = (-(1 + RESTITUTION) * closing) / (1 + (rn * rn) / INERTIA)
    world.vx += impulse * nx
    world.vy += impulse * ny
    world.spin += (rn * impulse) / INERTIA

    if (-closing > 70 && world.bumpCooldown <= 0) {
      world.bumpCooldown = 0.2
      world.events.push({ type: 'bump', x: px, y: py, force: -closing })
    }
  }
}

function collideWalls(world: World) {
  const { left, right } = world.course
  const from = Math.max(0, world.sampleIndex - WALL_WINDOW)
  const to = Math.min(left.length - 1, world.sampleIndex + WALL_WINDOW)
  for (let i = from; i < to; i++) {
    collideSegment(world, left[i].x, left[i].y, left[i + 1].x, left[i + 1].y)
    collideSegment(world, right[i].x, right[i].y, right[i + 1].x, right[i + 1].y)
  }
  // Both ends of the course are sealed, so the tub can't leave the water.
  if (from === 0) {
    collideSegment(world, left[0].x, left[0].y, right[0].x, right[0].y)
  }
  if (to === left.length - 1) {
    collideSegment(world, left[to].x, left[to].y, right[to].x, right[to].y)
  }
}

function collideHazards(world: World) {
  for (const gate of world.gates) {
    if (Math.hypot(gate.x - world.x, gate.y - world.y) > gate.hw + 90) continue
    const bar = gateBar(gate, world.clock)
    collideSegment(world, bar.ax, bar.ay, bar.bx, bar.by, {
      ux: bar.ux,
      uy: bar.uy,
    })
  }
  for (const paddle of world.paddles) {
    if (Math.hypot(paddle.x - world.x, paddle.y - world.y) > paddle.length + 90) {
      continue
    }
    const bar = paddleBar(paddle, world.clock)
    collideSegment(world, bar.ax, bar.ay, bar.bx, bar.by, {
      cx: paddle.x,
      cy: paddle.y,
      omega: paddle.speed,
    })
  }
  if (world.grace > 0) return
  for (const urchin of world.urchins) {
    const p = urchinPosition(urchin, world.clock)
    for (const offset of HULL_OFFSETS) {
      const c = tubToWorld(world, 0, offset)
      if (Math.hypot(c.x - p.x, c.y - p.y) < HULL_RADIUS + URCHIN_RADIUS - 6) {
        wipeout(world)
        return
      }
    }
  }
}

function collectCans(world: World) {
  for (const can of world.cans) {
    if (can.taken) continue
    const hit = HULL_OFFSETS.some((offset) => {
      const c = tubToWorld(world, 0, offset)
      return Math.hypot(c.x - can.x, c.y - can.y) < HULL_RADIUS + CAN_RADIUS
    })
    if (!hit) continue
    can.taken = true
    world.cansTaken++
    for (const seat of world.seats) seat.gas = Math.min(1, seat.gas + CAN_GAS)
    world.events.push({ type: 'can', x: can.x, y: can.y })
  }
}

function updateProgress(world: World) {
  const { samples } = world.course
  const from = Math.max(0, world.sampleIndex - PROGRESS_WINDOW)
  const to = Math.min(samples.length - 1, world.sampleIndex + PROGRESS_WINDOW)
  let best = world.sampleIndex
  let bestD = Infinity
  for (let i = from; i <= to; i++) {
    const d = Math.hypot(samples[i].x - world.x, samples[i].y - world.y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  world.sampleIndex = best
  world.furthest = Math.max(world.furthest, best)

  // A squeeze against a wall can pop the hull out of the channel.
  if (bestD > samples[best].hw + 60) {
    wipeout(world)
    return
  }

  for (const index of world.checkpoints) {
    if (world.furthest >= index && world.checkpoint < index) {
      world.checkpoint = index
      world.events.push({ type: 'checkpoint' })
    }
  }

  if (world.status === 'racing' && best >= finishIndex(world.course)) {
    world.status = 'finished'
    world.events.push({ type: 'finish' })
  }
}

function wipeout(world: World) {
  world.wipeouts++
  world.events.push({ type: 'respawn', x: world.x, y: world.y })
  placeAt(world, world.checkpoint)
  world.grace = RESPAWN_GRACE
}

export function stepWorld(world: World, held: readonly boolean[], dt = STEP) {
  world.clock += dt
  world.grace = Math.max(0, world.grace - dt)
  world.bumpCooldown = Math.max(0, world.bumpCooldown - dt)
  for (const flame of world.flames) {
    flame.cooldown = Math.max(0, flame.cooldown - dt)
  }

  if (world.status === 'countdown') {
    const before = Math.ceil(world.countdown)
    world.countdown -= dt
    const after = Math.ceil(world.countdown)
    if (after <= 0) {
      world.status = 'racing'
      world.events.push({ type: 'go' })
    } else if (after !== before) {
      world.events.push({ type: 'tick', value: after })
    }
  } else if (world.status === 'racing') {
    world.raceTime += dt
  }

  updateSeats(world, held, dt)
  applyWater(world, dt)

  world.x += world.vx * dt
  world.y += world.vy * dt
  world.angle += world.spin * dt

  collideWalls(world)
  collideHazards(world)
  collectCans(world)
  updateProgress(world)
}

/** One star for finishing, one for beating par, one for every can. */
export function starsFor(world: World) {
  return (
    1 +
    (world.raceTime <= world.level.par ? 1 : 0) +
    (world.cansTaken === world.cans.length ? 1 : 0)
  )
}
