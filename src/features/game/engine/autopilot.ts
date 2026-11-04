import { forwardOf, urchinPosition, type World } from './world'

const LOOKAHEAD = 9
const AVOID_RADIUS = 240
const REST_UNTIL_GAS = 0.35

function wrapAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/**
 * A simple bot: aims at a point ahead on the centreline, nudged away from hazards.
 * It drives the menu demo and proves in tests that every level can be finished.
 */
export function autopilot(world: World): boolean[] {
  const { samples } = world.course
  const target =
    samples[Math.min(samples.length - 1, world.sampleIndex + LOOKAHEAD)]
  let aimX = target.x
  let aimY = target.y

  const hazards = [
    ...world.urchins.map((u) => urchinPosition(u, world.clock)),
    ...world.whirls,
  ]
  for (const hazard of hazards) {
    const d = Math.min(
      Math.hypot(hazard.x - target.x, hazard.y - target.y),
      Math.hypot(hazard.x - world.x, hazard.y - world.y),
    )
    if (d > AVOID_RADIUS) continue
    const away =
      target.nx * (target.x - hazard.x) + target.ny * (target.y - hazard.y)
    const side = away === 0 ? 1 : Math.sign(away)
    const room = Math.max(0, target.hw - 50)
    const shift = room * Math.min(1, (AVOID_RADIUS - d) / 100)
    aimX += target.nx * side * shift
    aimY += target.ny * side * shift
  }

  const desired = Math.atan2(aimX - world.x, -(aimY - world.y))
  const error = wrapAngle(desired - world.angle) - world.spin * 0.45
  const f = forwardOf(world.angle)
  const speed = world.vx * f.x + world.vy * f.y

  const held = [false, false, false, false]
  if (Math.abs(error) > 0.9) {
    // Spin on the spot: a rear bean and the opposite front bean.
    held[error > 0 ? 2 : 3] = true
    held[error > 0 ? 1 : 0] = true
  } else if (Math.abs(error) > 0.16) {
    held[error > 0 ? 2 : 3] = true
  } else if (speed < 240) {
    held[2] = true
    held[3] = true
  }
  // Rest an empty bean: a dry seat needs a fresh press once it has refilled.
  return held.map((wants, i) => {
    const seat = world.seats[i]
    return wants && (seat.blasting || seat.gas > REST_UNTIL_GAS)
  })
}
