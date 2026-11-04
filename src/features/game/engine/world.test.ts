import { describe, expect, test } from 'bun:test'

import { autopilot } from './autopilot'
import { LEVELS } from './levels'
import { createWorld, forwardOf, STEP, stepWorld, type World } from './world'

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

describe('levels', () => {
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
