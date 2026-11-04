import { describe, expect, test } from 'bun:test'

import { LEVELS } from '../engine/levels'
import { SEATS } from '../engine/world'
import { en } from './en'
import { fa } from './fa'
import { formatNumber, formatTime, MESSAGES, pickLocale } from './index'

/** Every string a message tree can produce, calling templates with a sample value. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value === 'function') {
    return strings(value({ name: 'نام', key: 'ض', toString: () => '۱' }))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(strings)
  }
  return []
}

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.length
  if (typeof value !== 'object' || value === null) return typeof value
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [key, shape(entry)] as const)
      .toSorted(([a], [b]) => a.localeCompare(b)),
  )
}

describe('translations', () => {
  test.each(Object.values(MESSAGES))('$locale covers every level', (messages) => {
    expect(Object.keys(messages.levels).toSorted()).toEqual(
      LEVELS.map((level) => level.id).toSorted(),
    )
  })

  test('languages have the same keys', () => {
    expect(shape(fa)).toEqual(shape(en))
    expect(fa.seats).toHaveLength(SEATS.length)
  })

  test('Persian shows no Latin letters or Latin digits', () => {
    const { locale: _locale, dir: _dir, ...text } = fa
    for (const string of strings(text)) {
      expect(string).not.toMatch(/[A-Za-z0-9]/)
    }
  })

  test('Persian uses Persian yeh and kaf, not the Arabic letters', () => {
    for (const string of strings(fa)) expect(string).not.toMatch(/[يك]/)
  })

  test('Persian key labels are the letters on Q, P, Z and M', () => {
    expect(fa.seats.map((seat) => seat.key)).toEqual(['ض', 'ح', 'ظ', 'پ'])
  })
})

describe('pickLocale', () => {
  test('a saved choice beats the browser', () => {
    expect(pickLocale('en', ['fa-IR'])).toBe('en')
    expect(pickLocale('fa', ['en-US'])).toBe('fa')
  })

  test('uses the first browser language we speak', () => {
    expect(pickLocale(null, ['fa-IR', 'en'])).toBe('fa')
    expect(pickLocale(null, ['FA'])).toBe('fa')
    expect(pickLocale(null, ['fr-FR', 'fa', 'en'])).toBe('fa')
    expect(pickLocale(null, ['en-GB', 'fa'])).toBe('en')
  })

  test('falls back to English', () => {
    expect(pickLocale(null, ['fr-FR'])).toBe('en')
    expect(pickLocale(null, [])).toBe('en')
    expect(pickLocale('constructor', [])).toBe('en')
  })
})

describe('numbers', () => {
  test('stay as they are in English', () => {
    expect(formatNumber(12, 'en')).toBe('12')
    expect(formatTime(65.25, 'en')).toBe('1:05.3')
  })

  test('use Persian digits in Persian', () => {
    expect(formatNumber(1234567890, 'fa')).toBe('۱۲۳۴۵۶۷۸۹۰')
    expect(formatTime(45, 'fa')).toBe('۰:۴۵٫۰')
    expect(formatTime(65.25, 'fa')).toBe('۱:۰۵٫۳')
  })
})
