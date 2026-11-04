import { describe, expect, test } from 'bun:test'

import { LEVELS } from './engine/levels'
import { hasTrophy, MAX_STARS, rankFor, totalStars } from './progress'

describe('trophy', () => {
  const finished = (levels: typeof LEVELS) =>
    Object.fromEntries(levels.map(({ id }) => [id, { stars: 1, bestTime: 99 }]))

  test('takes every level, at any star count', () => {
    expect(hasTrophy(finished(LEVELS))).toBe(true)
  })

  test('one level short is not enough', () => {
    expect(hasTrophy(finished(LEVELS.slice(1)))).toBe(false)
    expect(hasTrophy({})).toBe(false)
  })
})

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
