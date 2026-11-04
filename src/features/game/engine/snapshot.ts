import type { World } from './world'

type FieldKind = 'number' | 'fixed' | 'custom'

/**
 * How each `World` field gets across a network. A new field fails the typecheck until
 * it is listed here: `number` fields travel as they are, `fixed` ones are rebuilt from
 * the level by `createWorld`, and `custom` ones are handled by hand below. Mutable state
 * inside a hazard, like `Flame.cooldown`, is what `custom` is for, and `snapshot.test.ts`
 * fails if some is left behind.
 */
const FIELDS = {
  level: 'fixed',
  course: 'fixed',
  checkpoints: 'fixed',
  urchins: 'fixed',
  whirls: 'fixed',
  gates: 'fixed',
  paddles: 'fixed',
  currents: 'fixed',
  ice: 'fixed',
  cans: 'custom',
  flames: 'custom',
  icicles: 'custom',
  onIce: 'custom',
  seats: 'custom',
  status: 'custom',
  // Events travel beside the snapshot, because each one must arrive exactly once.
  events: 'custom',
  x: 'number',
  y: 'number',
  vx: 'number',
  vy: 'number',
  angle: 'number',
  spin: 'number',
  countdown: 'number',
  clock: 'number',
  raceTime: 'number',
  sampleIndex: 'number',
  furthest: 'number',
  checkpoint: 'number',
  grace: 'number',
  bumpCooldown: 'number',
  harmonies: 'number',
  wipeouts: 'number',
  cansTaken: 'number',
} satisfies Record<keyof World, FieldKind>

type NumberField = {
  [Field in keyof typeof FIELDS]: (typeof FIELDS)[Field] extends 'number'
    ? Field
    : never
}[keyof typeof FIELDS]

const NUMBERS = (Object.keys(FIELDS) as (keyof typeof FIELDS)[]).filter(
  (field): field is NumberField => FIELDS[field] === 'number',
)
const STATUSES: readonly World['status'][] = ['countdown', 'racing', 'finished']

/** Changes when the shape of a snapshot does, so old clients can be told to refresh. */
export const SNAPSHOT_LAYOUT = `${NUMBERS.join()};onIce;seats:5;cans:1;flames:1;icicles:2`

/** A world's changing state as a flat list: about a third smaller than named fields. */
export type Snapshot = number[]

const round = (value: number) => Math.round(value * 1000) / 1000

export function encodeSnapshot(world: World): Snapshot {
  const snapshot = [STATUSES.indexOf(world.status), world.onIce ? 1 : 0]
  for (const field of NUMBERS) snapshot.push(round(world[field]))
  for (const seat of world.seats) {
    snapshot.push(
      round(seat.gas),
      seat.blasting ? 1 : 0,
      seat.held ? 1 : 0,
      round(seat.lastPress),
      seat.paired ? 1 : 0,
    )
  }
  for (const can of world.cans) snapshot.push(can.taken ? 1 : 0)
  for (const flame of world.flames) snapshot.push(round(flame.cooldown))
  for (const icicle of world.icicles) snapshot.push(icicle.landed, icicle.warned)
  return snapshot
}

/** Writes a snapshot over a world made by `createWorld` from the same level. */
export function applySnapshot(world: World, snapshot: Snapshot) {
  let next = 0
  const read = () => snapshot[next++]
  world.status = STATUSES[read()]
  world.onIce = read() === 1
  for (const field of NUMBERS) world[field] = read()
  for (const seat of world.seats) {
    seat.gas = read()
    seat.blasting = read() === 1
    seat.held = read() === 1
    seat.lastPress = read()
    seat.paired = read() === 1
  }
  for (const can of world.cans) can.taken = read() === 1
  for (const flame of world.flames) flame.cooldown = read()
  for (const icicle of world.icicles) {
    icicle.landed = read()
    icicle.warned = read()
  }
  world.events.length = 0
}
