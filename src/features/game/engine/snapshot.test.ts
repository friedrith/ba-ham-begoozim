import { describe, expect, test } from 'bun:test'

import { autopilot } from './autopilot'
import { LEVELS } from './levels'
import { applySnapshot, encodeSnapshot } from './snapshot'
import { createWorld, STEP, stepWorld, type World } from './world'

const TOLERANCE = 0.002

/** Paths where two worlds differ, ignoring what snapshots don't need to carry. */
function differences(a: unknown, b: unknown, path = ''): string[] {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= TOLERANCE ? [] : [`${path}: ${a} != ${b}`]
  }
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return a === b ? [] : [`${path}: ${String(a)} != ${String(b)}`]
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  return Object.keys({ ...left, ...right }).flatMap((key) =>
    differences(left[key], right[key], `${path}.${key}`),
  )
}

function comparable(world: World) {
  const { level: _level, course: _course, events: _events, ...state } = world
  return state
}

describe('snapshots', () => {
  for (const level of LEVELS) {
    test(`${level.id} survives a round trip at any moment`, () => {
      const world = createWorld(level)
      const copy = createWorld(level)
      // Long enough for every hazard on the level to have fired at least once.
      for (let step = 0; step < 60 / STEP; step++) {
        stepWorld(world, autopilot(world))
        world.events.length = 0
        if (step % 120 !== 0) continue
        applySnapshot(copy, encodeSnapshot(world))
        expect(differences(comparable(copy), comparable(world))).toEqual([])
      }
    })
  }

  test('a restored world carries on like the original', () => {
    const world = createWorld(LEVELS[1])
    for (let step = 0; step < 8 / STEP; step++) {
      stepWorld(world, [false, false, true, true])
      world.events.length = 0
    }
    const copy = createWorld(LEVELS[1])
    applySnapshot(copy, encodeSnapshot(world))
    for (let step = 0; step < 12; step++) {
      stepWorld(world, [false, false, true, false])
      stepWorld(copy, [false, false, true, false])
    }
    expect(Math.hypot(copy.x - world.x, copy.y - world.y)).toBeLessThan(0.5)
    expect(Math.abs(copy.angle - world.angle)).toBeLessThan(0.01)
  })

  test('stays small enough to send 30 times a second', () => {
    const world = createWorld(LEVELS[1])
    for (let step = 0; step < 8 / STEP; step++) stepWorld(world, autopilot(world))
    expect(JSON.stringify(encodeSnapshot(world)).length).toBeLessThan(320)
  })
})
