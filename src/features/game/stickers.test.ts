import { describe, expect, test } from 'bun:test'

import {
  MAX_STICKERS_PER_BEAN,
  noStickers,
  normalizeStickers,
  STICKER_IDS,
  STICKER_SPOTS,
  toggleSticker,
} from './stickers'

describe('stickers', () => {
  test('every sticker a bean can hold has a spot to go', () => {
    expect(STICKER_SPOTS).toHaveLength(MAX_STICKERS_PER_BEAN)
  })

  test('toggling puts a sticker on and peels it off', () => {
    const on = toggleSticker(noStickers(), 2, 'duck')
    expect(on[2]).toEqual(['duck'])
    expect(on[0]).toEqual([])
    expect(toggleSticker(on, 2, 'duck')[2]).toEqual([])
  })

  test('a full bean takes no more', () => {
    let stickers = noStickers()
    for (const id of STICKER_IDS.slice(0, MAX_STICKERS_PER_BEAN + 1)) {
      stickers = toggleSticker(stickers, 0, id)
    }
    expect(stickers[0]).toEqual(STICKER_IDS.slice(0, MAX_STICKERS_PER_BEAN))
  })

  test('only what the game can draw gets through', () => {
    const clean = normalizeStickers([
      ['duck', 'duck', 'nope', 7, 'constructor', 'star', 'can', 'moon'],
      'not a list',
    ])
    expect(clean).toEqual([['duck', 'star', 'can'], [], [], []])
  })

  test.each([null, 'hello', 7, {}])('%p counts as no stickers', (raw) => {
    expect(normalizeStickers(raw)).toEqual(noStickers())
  })
})
