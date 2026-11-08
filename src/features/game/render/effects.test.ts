import { describe, expect, test } from 'bun:test'

import { LEVELS } from '../engine/levels'
import { createWorld, type World } from '../engine/world'
import { createEffects, trackWrongWay } from './effects'

function racing() {
  const world = createWorld(LEVELS[0])
  world.status = 'racing'
  world.sampleIndex = 40
  return world
}

/** Moves the tub `step` samples per frame, drifting the way it moves. */
function drift(
  world: World,
  fx: ReturnType<typeof createEffects>,
  steps: number[],
) {
  let wrong = false
  for (const step of steps) {
    world.sampleIndex += step
    const s = world.course.samples[world.sampleIndex]
    world.vx = s.tx * step * 60
    world.vy = s.ty * step * 60
    wrong = trackWrongWay(fx, world)
  }
  return wrong
}

describe('trackWrongWay', () => {
  test('stays hidden while the tub heads downstream', () => {
    const fx = createEffects()
    expect(drift(racing(), fx, Array(20).fill(1))).toBe(false)
  })

  test('stays hidden for a short drift back', () => {
    const fx = createEffects()
    expect(drift(racing(), fx, [0, ...Array(5).fill(-1)])).toBe(false)
  })

  test('shows once the tub drifts too far back', () => {
    const fx = createEffects()
    expect(drift(racing(), fx, [0, ...Array(12).fill(-1)])).toBe(true)
  })

  test('hides again as soon as the tub turns round', () => {
    const fx = createEffects()
    const world = racing()
    drift(world, fx, [0, ...Array(12).fill(-1)])
    expect(drift(world, fx, [1])).toBe(false)
  })

  test('ignores a respawn back to a checkpoint', () => {
    const fx = createEffects()
    const world = racing()
    drift(world, fx, [0, 1])
    world.sampleIndex = 6
    world.vx = 0
    world.vy = 0
    expect(trackWrongWay(fx, world)).toBe(false)
  })

  test('stays hidden outside a race', () => {
    const fx = createEffects()
    const world = racing()
    world.status = 'finished'
    expect(drift(world, fx, [0, ...Array(12).fill(-1)])).toBe(false)
  })
})
