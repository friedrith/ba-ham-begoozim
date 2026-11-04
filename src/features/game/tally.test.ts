import { describe, expect, test } from 'bun:test'

import { awardsFor, createTally, tallyEvent, type Tally } from './tally'

const blast = (tally: Tally, seat: number, clock: number, harmony = false) =>
  tallyEvent(tally, { type: 'blast', seat, harmony, ignited: false }, clock)

const wipeout = (tally: Tally, clock: number) =>
  tallyEvent(tally, { type: 'respawn', x: 0, y: 0 }, clock)

describe('blame', () => {
  test('a wipeout lands on the last bean to blast', () => {
    const tally = createTally()
    blast(tally, 2, 1)
    blast(tally, 3, 2)
    wipeout(tally, 3)
    expect(tally.lastBlame).toBe(3)
    expect(tally.seats[3].blamed).toBe(1)
    expect(tally.seats[2].blamed).toBe(0)
  })

  test('a wipeout long after the last blast is nobody’s fault', () => {
    const tally = createTally()
    blast(tally, 2, 1)
    wipeout(tally, 20)
    expect(tally.lastBlame).toBeNull()
    expect(tally.seats[2].blamed).toBe(0)
  })

  test('a wipeout before anyone blasted is nobody’s fault', () => {
    const tally = createTally()
    wipeout(tally, 1)
    expect(tally.lastBlame).toBeNull()
  })
})

describe('holding', () => {
  test('counts the time between blast and release', () => {
    const tally = createTally()
    blast(tally, 0, 1)
    tallyEvent(tally, { type: 'release', seat: 0 }, 3.5)
    expect(tally.seats[0].heldSeconds).toBeCloseTo(2.5)
  })

  test('the finish line ends a hold in progress', () => {
    const tally = createTally()
    blast(tally, 0, 1)
    tallyEvent(tally, { type: 'finish' }, 2)
    tallyEvent(tally, { type: 'release', seat: 0 }, 9)
    expect(tally.seats[0].heldSeconds).toBeCloseTo(1)
  })
})

describe('awards', () => {
  test('every bean gets exactly one, and no award goes out twice', () => {
    const tally = createTally()
    blast(tally, 0, 1)
    tallyEvent(tally, { type: 'release', seat: 0 }, 2)
    wipeout(tally, 2)
    blast(tally, 1, 3)
    tallyEvent(tally, { type: 'empty', seat: 1 }, 4)
    tallyEvent(tally, { type: 'release', seat: 1 }, 4)
    blast(tally, 2, 5)
    tallyEvent(tally, { type: 'release', seat: 2 }, 9)
    blast(tally, 3, 10, true)
    tallyEvent(tally, { type: 'release', seat: 3 }, 10)

    expect(awardsFor(tally).map(({ id }) => id)).toEqual([
      'suspect',
      'fumes',
      'guzzler',
      'choir',
    ])
  })

  test('beans that never blasted are called out', () => {
    const tally = createTally()
    blast(tally, 2, 1)
    tallyEvent(tally, { type: 'release', seat: 2 }, 2)
    blast(tally, 3, 3)

    expect(awardsFor(tally)).toEqual([
      { id: 'passenger', value: 0 },
      { id: 'alsoThere', value: 0 },
      { id: 'guzzler', value: 1 },
      { id: 'trigger', value: 1 },
    ])
  })

  test('nobody wins anything for doing nothing', () => {
    expect(awardsFor(createTally()).map(({ id }) => id)).toEqual([
      'passenger',
      'alsoThere',
      'alsoThere',
      'alsoThere',
    ])
  })
})
