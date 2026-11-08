import { describe, expect, test } from 'bun:test'

import { LEVELS } from './engine/levels'
import { needsTutorial } from './tutorial'

describe('tutorial', () => {
  test('shows to a brand new player', () => {
    expect(needsTutorial(false, {})).toBe(true)
  })

  test('shows only once', () => {
    expect(needsTutorial(true, {})).toBe(false)
  })

  test('skips players who already finished a level', () => {
    expect(
      needsTutorial(false, { [LEVELS[0].id]: { stars: 1, bestTime: 30 } }),
    ).toBe(false)
  })
})
