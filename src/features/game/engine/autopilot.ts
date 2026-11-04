import { SAMPLE_SPACING } from './course'
import {
  forwardOf,
  gateBar,
  paddleBar,
  urchinPosition,
  type Gate,
  type Paddle,
  type World,
} from './world'

const HORIZON = 34
const SIGHT = 1100
const LANES = 11
const REPLAN_EVERY = 0.08
const LANE_CHANGE_COST = 0.03
const CENTRE_COST = 0.0005
/** The sharpest sideways move per sample that the tub can really make. */
const MAX_SHIFT = 26
/** Timing guesses further ahead than this are too rough to slow down for. */
const RISK_WINDOW = 1.8
/** Distance kept between the centreline of the tub and a wall. */
const WALL_CLEARANCE = 36
/** Reach from the middle of the tub to anything lethal it might clip. */
const URCHIN_REACH = 80
const BAR_REACH = 34
const SWALLOW_REACH = 60
const TUB_HALF_LENGTH = 62
const BLOCKED = 100
/** Steers the line towards a gate's gap, without counting as a risk to slow down for. */
const OFF_THE_GAP = 60
const GATE_SIGHT = 450
const HOLD_AT = 200
const GAP_NEEDED = 70
const BACK_OFF_SPEED = -60
const CREEP_SPEED = 70
const FATAL = 1000
const CAN_BONUS = 10
const ACCELERATION = 800
const DASH_SPEED = 260
const PATIENCE = 5
const RISK_RANGE = 16
const SWERVE_SPAN = 8
const SWERVE_RANGE = 22
const MIN_SWERVE_SPEED = 100
const BACK_OFF_WITHIN = 7
const REST_UNTIL_GAS = 0.2
/** Leaves something in the tank for steering. */
const CRUISE_GAS = 0.35
/** One kick moves the steering error by about 0.63, so a smaller band would fight itself. */
const STEER_DEADBAND = 0.36
/** A harmony pair moves the speed by about 210, so a smaller band would fight itself. */
const SPEED_DEADBAND = 130
const BRAKE_DEADBAND = 180
const TAP_EVERY = 0.26
const TAP_LENGTH = 0.04

type Plan = {
  aimX: number
  aimY: number
  speed: number
  /** When the tub started waiting for a gap, or -1 if it isn't waiting. */
  waitingSince: number
  replanAt: number
}

const plans = new WeakMap<World, Plan>()

function wrapAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

function distanceToBar(
  bar: { ax: number; ay: number; bx: number; by: number },
  x: number,
  y: number,
) {
  const abx = bar.bx - bar.ax
  const aby = bar.by - bar.ay
  const t = Math.max(
    0,
    Math.min(1, ((x - bar.ax) * abx + (y - bar.ay) * aby) / (abx * abx + aby * aby)),
  )
  return Math.hypot(bar.ax + abx * t - x, bar.ay + aby * t - y)
}

/** Where a point sits relative to a gate: `ahead` is how far short of it, along the flow. */
function gatePosition(gate: Gate, x: number, y: number) {
  const dx = gate.x - x
  const dy = gate.y - y
  return { across: -dx * gate.nx - dy * gate.ny, ahead: dx * gate.ny - dy * gate.nx }
}

/** The width of the gap between a gate's bar and the wall on one side. */
function gateGap(gate: Gate, side: number, clock: number) {
  const bar = gateBar(gate, clock)
  const middle =
    ((bar.ax + bar.bx) / 2 - gate.x) * gate.nx +
    ((bar.ay + bar.by) / 2 - gate.y) * gate.ny
  return gate.hw * 0.38 - side * middle
}

function nearestGate(world: World) {
  let nearest: Gate | null = null
  let nearestAhead = GATE_SIGHT
  for (const gate of world.gates) {
    const { ahead } = gatePosition(gate, world.x, world.y)
    if (ahead < -TUB_HALF_LENGTH || ahead >= nearestAhead) continue
    if (Math.hypot(gate.x - world.x, gate.y - world.y) > GATE_SIGHT + gate.hw) continue
    nearest = gate
    nearestAhead = ahead
  }
  return nearest
}

/**
 * Gates are passed the way a person would: line up with one side, hold back, and
 * dash as soon as that side will stay open for the whole crossing.
 */
function gateSpeed(world: World, gate: Gate, cruise: number) {
  const { across, ahead } = gatePosition(gate, world.x, world.y)
  // Too late to stop: the bar is alongside already.
  if (ahead < TUB_HALF_LENGTH + BAR_REACH) return DASH_SPEED
  const side = across >= 0 ? 1 : -1
  const arrive = (ahead - TUB_HALF_LENGTH) / DASH_SPEED
  const leave = (ahead + TUB_HALF_LENGTH) / DASH_SPEED
  const linedUp = Math.abs(across - side * gate.hw * 0.62) < gate.hw * 0.38 - 8
  let open = true
  for (let t = arrive; open && t <= leave + 0.1; t += 0.1) {
    open = gateGap(gate, side, world.clock + t) >= GAP_NEEDED
  }
  if (linedUp && open) return DASH_SPEED
  if (ahead > HOLD_AT + 60) return Math.min(cruise, ahead - HOLD_AT + 60)
  if (ahead < HOLD_AT - 30) return BACK_OFF_SPEED
  // The tub can only shift sideways by moving, so creep until it is lined up.
  return linedUp ? 0 : CREEP_SPEED
}

function paddleClearance(paddle: Paddle, clock: number, x: number, y: number) {
  return distanceToBar(paddleBar(paddle, clock), x, y)
}

/** Only what is close enough to matter, so planning stays cheap on long courses. */
function nearbyHazards(world: World) {
  const near = (p: { x: number; y: number }) =>
    Math.hypot(p.x - world.x, p.y - world.y) < SIGHT
  return {
    urchins: world.urchins.filter(near),
    whirls: world.whirls.filter(near),
    gates: world.gates.filter(near).map((gate) => ({
      gate,
      side: gatePosition(gate, world.x, world.y).across >= 0 ? 1 : -1,
    })),
    paddles: world.paddles.filter(near),
    cans: world.cans.filter((can) => !can.taken && near(can)),
  }
}

type Hazards = ReturnType<typeof nearbyHazards>

/** What it would cost to have the tub at this spot at this moment. */
function spotCost(world: Hazards, x: number, y: number, clock: number) {
  let cost = 0
  for (const urchin of world.urchins) {
    const p = urchinPosition(urchin, clock)
    const d = Math.hypot(p.x - x, p.y - y)
    if (d < URCHIN_REACH) cost += FATAL
    else if (d < URCHIN_REACH + 40) cost += (URCHIN_REACH + 40 - d) * 0.6
  }
  for (const whirl of world.whirls) {
    const d = Math.hypot(whirl.x - x, whirl.y - y)
    if (d < SWALLOW_REACH) cost += FATAL
    else if (d < whirl.radius) cost += (1 - d / whirl.radius) * whirl.pull * 0.2
  }
  for (const { gate, side } of world.gates) {
    const { across, ahead } = gatePosition(gate, x, y)
    // Being lined up by the time the tub reaches its holding spot is the whole trick.
    if (ahead < -TUB_HALF_LENGTH - BAR_REACH || ahead > HOLD_AT + 40) continue
    const fromGap = Math.abs(across - side * gate.hw * 0.62)
    if (fromGap > gate.hw * 0.38 - 20) cost += OFF_THE_GAP
  }
  for (const paddle of world.paddles) {
    if (Math.hypot(paddle.x - x, paddle.y - y) > paddle.length + BAR_REACH) continue
    if (paddleClearance(paddle, clock, x, y) < BAR_REACH) cost += BLOCKED
  }
  for (const can of world.cans) {
    if (Math.hypot(can.x - x, can.y - y) < 44) cost -= CAN_BONUS
  }
  return cost
}

/**
 * Picks a line through the next stretch of channel, assuming the tub travels at
 * `speed`. Hazards are judged at the moment the tub would reach them.
 */
function planLine(world: World, hazards: Hazards, speed: number) {
  const { samples } = world.course
  const start = world.sampleIndex
  const count = Math.min(HORIZON, samples.length - start)
  const costs: number[][] = []
  const offsets: number[][] = []

  let travelSpeed = Math.hypot(world.vx, world.vy)
  let clock = world.clock
  let window = count
  for (let i = 0; i < count; i++) {
    if (clock - world.clock < RISK_WINDOW || i < RISK_RANGE) window = i + 1
    const s = samples[start + i]
    const room = Math.max(0, s.hw - WALL_CLEARANCE)
    offsets[i] = []
    costs[i] = []
    for (let lane = 0; lane < LANES; lane++) {
      const offset = room * ((lane / (LANES - 1)) * 2 - 1)
      offsets[i][lane] = offset
      costs[i][lane] =
        spotCost(hazards, s.x + s.nx * offset, s.y + s.ny * offset, clock) +
        offset * offset * CENTRE_COST
    }
    const step = SAMPLE_SPACING / Math.max(travelSpeed, 100)
    travelSpeed +=
      Math.sign(speed - travelSpeed) *
      Math.min(Math.abs(speed - travelSpeed), ACCELERATION * step)
    clock += step
  }

  const here = samples[start]
  const current = (world.x - here.x) * here.nx + (world.y - here.y) * here.ny
  const best = costs.map((row) => row.slice())
  const next: number[][] = costs.map(() => [])
  for (let i = count - 2; i >= 0; i--) {
    for (let lane = 0; lane < LANES; lane++) {
      let lowest = Infinity
      for (let to = 0; to < LANES; to++) {
        const shift = offsets[i][lane] - offsets[i + 1][to]
        if (Math.abs(shift) > MAX_SHIFT) continue
        const total = best[i + 1][to] + shift * shift * LANE_CHANGE_COST
        if (total < lowest) {
          lowest = total
          next[i][lane] = to
        }
      }
      best[i][lane] += lowest
    }
  }

  let lane = 0
  let lowest = Infinity
  for (let l = 0; l < LANES; l++) {
    const shift = offsets[0][l] - current
    const total = best[0][l] + shift * shift * LANE_CHANGE_COST
    if (total < lowest) {
      lowest = total
      lane = l
    }
  }

  const line = [lane]
  let risk = 0
  let firstBlocked = count
  for (let i = 0; i < count - 1; i++) {
    if (i < window && costs[i][lane] >= BLOCKED) {
      risk += costs[i][lane]
      firstBlocked = Math.min(firstBlocked, i)
    }
    lane = next[i][lane]
    line.push(lane)
  }
  return { line, offsets, risk, firstBlocked, count }
}

/** The fastest the channel ahead can be taken: bends and narrow water both slow it. */
function cruiseSpeed(world: World) {
  const { samples } = world.course
  const here = samples[world.sampleIndex]
  let bend = 0
  let narrowest = here.hw
  for (let i = 1; i <= 18; i++) {
    const s = samples[Math.min(samples.length - 1, world.sampleIndex + i)]
    bend = Math.max(
      bend,
      Math.abs(Math.atan2(here.tx * s.ty - here.ty * s.tx, here.tx * s.tx + here.ty * s.ty)),
    )
    narrowest = Math.min(narrowest, s.hw)
  }
  return Math.max(110, narrowest * 2 * (1 - Math.min(bend, 1.4) / 2.2))
}

function replan(world: World, previous?: Plan): Plan {
  const { samples } = world.course
  const cruise = cruiseSpeed(world)
  const hazards = nearbyHazards(world)
  let chosen = planLine(world, hazards, cruise)
  let speed = cruise
  for (const choice of [cruise * 0.7, cruise * 0.45]) {
    if (chosen.risk === 0) break
    chosen = planLine(world, hazards, choice)
    speed = choice
  }

  // A line that swerves soon has to be taken slower than a straight one.
  let swerve = 0
  for (let i = 0; i + SWERVE_SPAN < Math.min(chosen.count, SWERVE_RANGE); i++) {
    const from = chosen.offsets[i][chosen.line[i]]
    const to = chosen.offsets[i + SWERVE_SPAN][chosen.line[i + SWERVE_SPAN]]
    swerve = Math.max(swerve, Math.abs(to - from))
  }
  speed = Math.min(speed, Math.max(MIN_SWERVE_SPEED, cruise * (1 - swerve / 160)))

  // Hold back when nothing gets through. Bars only shove, so after a while it goes
  // anyway, but it never rushes at anything that would wipe it out.
  const gate = nearestGate(world)
  if (chosen.risk > 0) {
    speed = chosen.firstBlocked < BACK_OFF_WITHIN ? BACK_OFF_SPEED : 0
  } else if (gate) {
    speed = gateSpeed(world, gate, cruise)
  }
  const waiting = chosen.risk > 0 || (gate !== null && speed < DASH_SPEED)
  const waitingSince = !waiting
    ? -1
    : previous && previous.waitingSince >= 0
      ? previous.waitingSince
      : world.clock
  if (
    waiting &&
    chosen.risk < FATAL &&
    world.clock - waitingSince > PATIENCE &&
    world.clock - waitingSince < PATIENCE + 2
  ) {
    speed = DASH_SPEED
  }

  const travel = Math.hypot(world.vx, world.vy)
  const lookahead = Math.round(
    Math.min(chosen.count - 1, Math.max(3, (travel * 0.5) / SAMPLE_SPACING)),
  )
  const s = samples[world.sampleIndex + lookahead]
  const offset = chosen.offsets[lookahead][chosen.line[lookahead]]
  return {
    aimX: s.x + s.nx * offset,
    aimY: s.y + s.ny * offset,
    speed,
    waitingSince,
    replanAt: world.clock + REPLAN_EVERY,
  }
}

/**
 * A planning bot: every few frames it searches for the safest line through the
 * hazards ahead and the fastest speed that keeps that line safe, then steers along
 * it with the same four beans a player has. It drives the menu demo and proves in
 * tests that every level can be finished.
 */
export function autopilot(world: World): boolean[] {
  let plan = plans.get(world)
  if (!plan || world.clock >= plan.replanAt) {
    plan = replan(world, plan)
    plans.set(world, plan)
  }

  // Aim the bow so that thrust also cancels any sideways slide.
  const ax = plan.aimX - world.x
  const ay = plan.aimY - world.y
  const length = Math.hypot(ax, ay) || 1
  const travel = Math.max(Math.hypot(world.vx, world.vy), 80)
  const wantX = ax / length + ((ax / length) * travel - world.vx) / 400
  const wantY = ay / length + ((ay / length) * travel - world.vy) / 400
  const desired = Math.atan2(wantX, -wantY)
  const error = wrapAngle(desired - world.angle) - world.spin * 0.45

  const f = forwardOf(world.angle)
  const speed = world.vx * f.x + world.vy * f.y
  const tapping = (a: number, b: number) => {
    const since = world.clock - Math.max(world.seats[a].lastPress, world.seats[b].lastPress)
    return since < TAP_LENGTH || since >= TAP_EVERY
  }
  const tooFast = speed > (plan.speed < 0 ? plan.speed * 0.4 : plan.speed + BRAKE_DEADBAND)
  const tooSlow =
    speed <
    (plan.speed > 0
      ? Math.max(plan.speed - SPEED_DEADBAND, plan.speed * 0.4)
      : plan.speed - SPEED_DEADBAND)

  const held = [false, false, false, false]
  if (Math.abs(error) > 0.9) {
    // Spin on the spot: a rear bean and the opposite front bean.
    held[error > 0 ? 2 : 3] = true
    held[error > 0 ? 1 : 0] = true
  } else if (Math.abs(error) > STEER_DEADBAND) {
    // Turn with the rear bean, or with the front bean if that also helps to slow down.
    if (tooFast) held[error > 0 ? 1 : 0] = true
    else held[error > 0 ? 2 : 3] = true
  } else if (tooFast) {
    held[0] = held[1] = tapping(0, 1)
  } else if (
    tooSlow &&
    world.seats[2].gas > CRUISE_GAS &&
    world.seats[3].gas > CRUISE_GAS
  ) {
    // Tapping together is a harmony every time, and it hardly costs any gas.
    held[2] = held[3] = tapping(2, 3)
  }
  // Rest an empty bean: a dry seat needs a fresh press once it has refilled.
  return held.map((wants, i) => {
    const seat = world.seats[i]
    return wants && (seat.blasting || seat.gas > REST_UNTIL_GAS)
  })
}
