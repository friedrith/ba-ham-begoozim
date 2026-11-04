import { applySnapshot, type Snapshot } from '../game/engine/snapshot'
import { STEP, stepWorld, type World } from '../game/engine/world'

/** A client's own input, labelled with the sim clock at which it will reach the room. */
export type OwnInput = { clock: number; seat: number; on: boolean }

/**
 * Rewinds `scratch` to a snapshot and replays up to `target`, with this client's own
 * inputs applied and teammates assumed to keep doing what they were doing. Their real
 * inputs can't be known yet, so this is what drifts, and later snapshots correct it.
 */
export function forecast(
  scratch: World,
  snapshot: Snapshot,
  own: readonly OwnInput[],
  mySeats: ReadonlySet<number>,
  target: number,
  maxSteps = 60,
) {
  applySnapshot(scratch, snapshot)
  const held = scratch.seats.map((seat) => seat.held)

  let next = own.findIndex((input) => input.clock > scratch.clock)
  if (next < 0) next = own.length

  // Own inputs beat the snapshot's flags: the room may not have heard the latest yet.
  for (const seat of mySeats) {
    const latest = own.findLast(
      (input) => input.seat === seat && input.clock <= scratch.clock,
    )
    if (latest) held[seat] = latest.on
  }

  let steps = 0
  while (scratch.clock + STEP / 2 < target && steps < maxSteps) {
    while (next < own.length && own[next].clock <= scratch.clock + STEP / 2) {
      held[own[next].seat] = own[next].on
      next++
    }
    stepWorld(scratch, held)
    steps++
  }
  scratch.events.length = 0
  return scratch
}

export function dropOldInputs(own: OwnInput[], clock: number) {
  const keepFrom = own.findIndex((input) => input.clock > clock - 2)
  if (keepFrom > 0) own.splice(0, keepFrom)
}
