import { describe, expect, test } from 'bun:test'

import { LEVELS } from './engine/levels'
import { MAX_STARS, rankFor, totalStars } from './progress'

describe('ranks', () => {
  test('rise with stars, in order', () => {
    expect(rankFor(0)).toBe('squeak')
    expect(rankFor(Math.ceil(MAX_STARS / 4))).toBe('regular')
    expect(rankFor(Math.ceil(MAX_STARS / 2))).toBe('menace')
    expect(rankFor(Math.ceil((MAX_STARS * 3) / 4))).toBe('duke')
  })

  test('the crown takes every star in the game', () => {
    expect(rankFor(MAX_STARS - 1)).toBe('duke')
    expect(rankFor(MAX_STARS)).toBe('king')
  })

  test('total stars ignores levels that no longer exist', () => {
    const [first, second] = LEVELS
    expect(
      totalStars({
        [first.id]: { stars: 3, bestTime: 10 },
        [second.id]: { stars: 1, bestTime: 10 },
        gone: { stars: 3, bestTime: 10 },
      }),
    ).toBe(4)
  })
})
