import { describe, expect, test } from 'bun:test'

import { autopilot } from './autopilot'
import { buildCourse, indexAt } from './course'
import { LEVELS, type LevelDef } from './levels'
import {
  anarPosition,
  createWorld,
  CAN_RADIUS,
  forwardOf,
  ICICLE_WARNING,
  icicleLanding,
  isBurning,
  isSteaming,
  SAMOVAR_RADIUS,
  STEP,
  stepWorld,
  type World,
} from './world'

const FRONT_LEFT = 0
const REAR_LEFT = 2
const REAR_RIGHT = 3

function startedWorld(): World {
  const world = createWorld(LEVELS[0])
  while (world.status === 'countdown') stepWorld(world, [])
  world.events.length = 0
  return world
}

function press(world: World, ...seats: number[]) {
  const held = [false, false, false, false]
  for (const seat of seats) held[seat] = true
  stepWorld(world, held)
}

const speedAlong = (world: World) => {
  const f = forwardOf(world.angle)
  return world.vx * f.x + world.vy * f.y
}

describe('steering', () => {
  test('controls stay locked during the countdown', () => {
    const world = createWorld(LEVELS[0])
    press(world, REAR_LEFT, REAR_RIGHT)
    expect(world.vx).toBe(0)
    expect(world.vy).toBe(0)
    expect(world.seats[REAR_LEFT].gas).toBe(1)
  })

  test('a rear-left blast moves forward and turns right', () => {
    const world = startedWorld()
    press(world, REAR_LEFT)
    expect(speedAlong(world)).toBeGreaterThan(0)
    expect(world.spin).toBeGreaterThan(0)
  })

  test('a front-left blast moves backward and turns left', () => {
    const world = startedWorld()
    press(world, FRONT_LEFT)
    expect(speedAlong(world)).toBeLessThan(0)
    expect(world.spin).toBeLessThan(0)
  })

  test('a balanced rear pair drives straight', () => {
    const world = startedWorld()
    press(world, REAR_LEFT, REAR_RIGHT)
    expect(Math.abs(world.spin)).toBeLessThan(1e-9)
  })
})

describe('harmony', () => {
  test('blasting together beats blasting apart', () => {
    const together = startedWorld()
    press(together, REAR_LEFT, REAR_RIGHT)
    expect(together.harmonies).toBe(1)

    const apart = startedWorld()
    press(apart, REAR_LEFT)
    for (let i = 0; i < 60; i++) press(apart)
    const before = speedAlong(apart)
    press(apart, REAR_RIGHT)
    expect(apart.harmonies).toBe(0)
    expect(speedAlong(together)).toBeGreaterThan(speedAlong(apart) - before + 70)
  })
})

describe('harmony across a network', () => {
  const pressAt = (world: World, seat: number, pressedAt: number) => {
    const held = [false, false, false, false]
    held[seat] = true
    const times = [null, null, null, null] as (number | null)[]
    times[seat] = pressedAt
    stepWorld(world, held, STEP, times)
  }

  test('presses close together count, however late one of them arrives', () => {
    const world = startedWorld()
    const pressed = world.clock
    pressAt(world, REAR_LEFT, pressed)
    for (let t = 0; t < 0.3; t += STEP) press(world, REAR_LEFT)
    pressAt(world, REAR_RIGHT, pressed + 0.05)
    expect(world.harmonies).toBe(1)
  })

  test('a late arrival can pair with a press made after it', () => {
    const world = startedWorld()
    const pressed = world.clock
    pressAt(world, REAR_LEFT, pressed)
    pressAt(world, REAR_RIGHT, pressed - 0.05)
    expect(world.harmonies).toBe(1)
  })

  test('presses far apart do not count, however close they arrive', () => {
    const world = startedWorld()
    pressAt(world, REAR_LEFT, world.clock)
    pressAt(world, REAR_RIGHT, world.clock - 0.2)
    expect(world.harmonies).toBe(0)
  })

  test('the harmony bonus reaches the bean who pressed first', () => {
    const paired = startedWorld()
    pressAt(paired, REAR_LEFT, paired.clock)
    pressAt(paired, REAR_RIGHT, paired.clock - 0.05)

    const alone = startedWorld()
    pressAt(alone, REAR_LEFT, alone.clock)
    pressAt(alone, REAR_RIGHT, alone.clock - 0.2)

    expect(speedAlong(paired)).toBeGreaterThan(speedAlong(alone))
  })
})

describe('gas', () => {
  test('holding a blast runs the tank dry, then stops pushing', () => {
    const world = startedWorld()
    for (let t = 0; t < 3; t += STEP) press(world, REAR_LEFT)
    expect(world.seats[REAR_LEFT].gas).toBeLessThan(0.1)
    expect(world.seats[REAR_LEFT].blasting).toBe(false)
    expect(world.events.some((e) => e.type === 'empty')).toBe(true)
  })

  test('a resting bean refills', () => {
    const world = startedWorld()
    world.seats[REAR_LEFT].gas = 0.2
    for (let t = 0; t < 1; t += STEP) press(world)
    expect(world.seats[REAR_LEFT].gas).toBeCloseTo(0.4, 1)
  })
})

describe('wipeouts', () => {
  test('hitting an urchin returns the tub to the last checkpoint', () => {
    const world = startedWorld()
    const urchin = world.urchins[0]
    world.x = urchin.x
    world.y = urchin.y
    world.sampleIndex = world.checkpoint
    press(world)
    expect(world.wipeouts).toBe(1)
    const start = world.course.samples[world.checkpoint]
    expect(Math.hypot(world.x - start.x, world.y - start.y)).toBeLessThan(5)
  })
})

function worldWith(items: LevelDef['items']) {
  const world = createWorld({
    id: 'test',
    theme: 'frost',
    par: 10,
    path: [
      [0, 0, 200],
      [0, -1000, 200],
      [0, -2000, 200],
    ],
    checkpoints: [],
    items,
  })
  while (world.status === 'countdown') stepWorld(world, [])
  world.events.length = 0
  return world
}

describe('icicles', () => {
  test('warns before landing and only hurts at the moment it lands', () => {
    const world = worldWith([{ kind: 'icicle', at: 0.1, period: 6 }])
    const icicle = world.icicles[0]
    world.x = icicle.x
    world.y = icicle.y
    world.sampleIndex = indexAt(world.course, 0.1)

    while (icicleLanding(icicle, world.clock) > ICICLE_WARNING + 0.1) {
      world.x = icicle.x
      world.y = icicle.y
      press(world)
    }
    expect(world.wipeouts).toBe(0)
    expect(world.events.some((e) => e.type === 'creak')).toBe(false)

    let landed = false
    while (!landed) {
      world.x = icicle.x
      world.y = icicle.y
      world.vx = 0
      world.vy = 0
      press(world)
      landed = world.events.some((e) => e.type === 'smash')
    }
    expect(world.events.some((e) => e.type === 'creak')).toBe(true)
    expect(world.wipeouts).toBe(1)
  })

  test('misses a tub that got out of the way', () => {
    const world = worldWith([{ kind: 'icicle', at: 0.3, period: 6 }])
    for (let t = 0; t < 8; t += STEP) press(world)
    expect(world.wipeouts).toBe(0)
  })
})

function coastingSpeed(items: LevelDef['items']) {
  const world = worldWith(items)
  world.vy = -200
  for (let t = 0; t < 1; t += STEP) press(world)
  return Math.hypot(world.vx, world.vy)
}

describe('ice', () => {
  test('keeps the tub sliding far longer than water does', () => {
    const onIce = coastingSpeed([{ kind: 'ice', from: 0, to: 1 }])
    expect(onIce).toBeGreaterThan(coastingSpeed([]) * 1.5)
  })

  test('skids once on the way onto a sheet', () => {
    const world = worldWith([{ kind: 'ice', from: 0.2, to: 0.9 }])
    const onSheet = world.course.samples[indexAt(world.course, 0.5)]
    world.x = onSheet.x
    world.y = onSheet.y
    world.sampleIndex = indexAt(world.course, 0.5)
    press(world)
    press(world)
    expect(world.events.filter((e) => e.type === 'skid')).toHaveLength(1)
  })
})

describe('samovars', () => {
  test('stop the tub from passing through', () => {
    const world = worldWith([
      { kind: 'samovar', at: 0.2, period: 1000, phase: 500 },
    ])
    const samovar = world.samovars[0]
    world.x = samovar.x
    world.y = samovar.y + 150
    world.vy = -300
    world.angle = 0
    world.sampleIndex = indexAt(world.course, 0.2)
    for (let t = 0; t < 1; t += STEP) press(world)
    expect(world.y).toBeGreaterThan(samovar.y)
    expect(world.events.some((e) => e.type === 'bump')).toBe(true)
    expect(world.wipeouts).toBe(0)
  })

  test('shove the tub away while steaming, and leave it alone otherwise', () => {
    const shoved = (clock: number) => {
      const world = worldWith([{ kind: 'samovar', at: 0.2, period: 100 }])
      const samovar = world.samovars[0]
      world.x = samovar.x + 90
      world.y = samovar.y
      world.sampleIndex = indexAt(world.course, 0.2)
      world.clock = clock
      expect(isSteaming(samovar, clock)).toBe(clock === 100)
      press(world)
      return world.vx
    }
    expect(shoved(100)).toBeGreaterThan(0)
    expect(shoved(50)).toBe(0)
  })
})

describe('farshes', () => {
  const coasting = (offset: number) => {
    const world = worldWith([
      { kind: 'farsh', from: 0, to: 1, offset: 0.6, width: 0.4 },
    ])
    world.x = offset
    world.vy = -200
    for (let t = 0; t < 1; t += STEP) press(world)
    return world
  }

  test('drag a tub on the carpet, but not one beside it', () => {
    const on = coasting(100)
    const beside = coasting(-100)
    expect(on.onFarsh).toBe(true)
    expect(beside.onFarsh).toBe(false)
    expect(Math.abs(on.vy)).toBeLessThan(Math.abs(beside.vy) * 0.5)
  })

  test('squelch once on the way onto a carpet', () => {
    const world = coasting(100)
    expect(world.events.filter((e) => e.type === 'soak')).toHaveLength(1)
  })
})

describe('atashes', () => {
  const standingOn = (atash: { x: number; y: number }, world: World) => {
    world.x = atash.x
    world.y = atash.y
    world.vx = 0
    world.vy = 0
    world.sampleIndex = indexAt(world.course, 0.2)
  }

  test('are safe to cross while they smoulder, and lethal once they burn', () => {
    const world = worldWith([{ kind: 'atash', at: 0.2, period: 4 }])
    const atash = world.atashes[0]
    while (isBurning(atash, world.clock)) press(world)
    world.grace = 0
    world.wipeouts = 0
    while (!isBurning(atash, world.clock + STEP)) {
      standingOn(atash, world)
      press(world)
    }
    expect(world.wipeouts).toBe(0)
    standingOn(atash, world)
    press(world)
    expect(world.wipeouts).toBe(1)
    expect(world.events.some((e) => e.type === 'kindle')).toBe(true)
  })
})

describe('anars', () => {
  test('roll from bank to bank and wipe out anything in the way', () => {
    const world = worldWith([{ kind: 'anar', at: 0.2, period: 4 }])
    const anar = world.anars[0]
    const left = anarPosition(anar, 3)
    const right = anarPosition(anar, 1)
    expect(Math.hypot(left.x - right.x, left.y - right.y)).toBeCloseTo(280, 0)

    const p = anarPosition(anar, world.clock + STEP)
    world.x = p.x
    world.y = p.y
    world.sampleIndex = indexAt(world.course, 0.2)
    press(world)
    expect(world.wipeouts).toBe(1)
  })
})

function measureLevel(level: LevelDef) {
  const { samples } = buildCourse(level.path)
  const length = samples.length * 24
  const hazards = level.items.filter((item) => item.kind !== 'can').length
  return {
    width: samples.reduce((sum, s) => sum + s.hw, 0) / samples.length,
    hazardsPerKm: (hazards / length) * 1000,
    kinds: new Set(level.items.map((item) => item.kind)).size,
  }
}

describe('levels', () => {
  test('ids are unique, because progress is saved against them', () => {
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length)
  })

  test('the last level is clearly harder than Noruz Nightmare', () => {
    const boiler = measureLevel(LEVELS.find((level) => level.id === 'boiler-room')!)
    const last = measureLevel(LEVELS[LEVELS.length - 1])
    expect(last.width).toBeLessThan(boiler.width * 0.8)
    expect(last.hazardsPerKm).toBeGreaterThan(boiler.hazardsPerKm * 1.5)
    expect(last.kinds).toBeGreaterThan(boiler.kinds)
  })

  for (const level of LEVELS) {
    test(`${level.id} stays fair`, () => {
      const { samples } = buildCourse(level.path)
      const world = createWorld(level)
      // Wide enough for the tub, which is 124 long and 64 wide, to turn around.
      expect(Math.min(...samples.map((s) => s.hw))).toBeGreaterThanOrEqual(100)
      // Channels mustn't run into each other, or the walls stop making sense.
      for (let i = 0; i < samples.length; i += 2) {
        for (let j = i + 30; j < samples.length; j += 2) {
          const a = samples[i]
          const b = samples[j]
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.hw + b.hw)
        }
      }
      for (const gate of world.gates) {
        // Its widest gap has to let the hull through with a little to spare.
        expect(gate.hw * 0.76).toBeGreaterThanOrEqual(84)
      }
      // Nothing sits on a respawn point, which would feel like a cheap shot.
      const lethal = [
        ...world.urchins,
        ...world.icicles,
        ...world.whirls,
        ...world.atashes,
        ...world.anars,
        ...world.samovars,
      ]
      for (const index of [...world.checkpoints, 6]) {
        const s = samples[index]
        for (const hazard of lethal) {
          expect(Math.hypot(hazard.x - s.x, hazard.y - s.y)).toBeGreaterThan(110)
        }
      }
      // A samovar must not stand on a can, or the can is out of reach.
      for (const samovar of world.samovars) {
        for (const can of world.cans) {
          expect(Math.hypot(samovar.x - can.x, samovar.y - can.y)).toBeGreaterThan(
            SAMOVAR_RADIUS + CAN_RADIUS + 70,
          )
        }
      }
    })
  }

  test('every level has a Persian obstacle from its own theme', () => {
    const own: Record<LevelDef['theme'], LevelDef['items'][number]['kind']> = {
      tile: 'samovar',
      brick: 'farsh',
      iron: 'atash',
      frost: 'anar',
    }
    for (const level of LEVELS) {
      expect(level.items.some((item) => item.kind === own[level.theme])).toBe(true)
    }
  })

  for (const level of LEVELS) {
    test(`${level.id} can be finished`, () => {
      const world = createWorld(level)
      let steps = 0
      const limit = 240 / STEP
      while (world.status !== 'finished' && steps < limit) {
        stepWorld(world, autopilot(world))
        steps++
      }
      console.log(
        `${level.id}: ${world.raceTime.toFixed(1)}s (par ${level.par}), ` +
          `${world.cansTaken}/${world.cans.length} cans, ` +
          `${world.wipeouts} wipeouts, ${world.harmonies} harmonies`,
      )
      expect(world.status).toBe('finished')
    })
  }
})
