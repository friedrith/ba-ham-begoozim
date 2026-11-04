import { describe, expect, test } from 'bun:test'

import { createRateLimit, MAX_MESSAGE_LENGTH, parseFeedback } from './feedback'

const valid = { kind: 'bug', message: 'The tub sank', locale: 'en' }

describe('parseFeedback', () => {
  test('keeps a trimmed message', () => {
    expect(parseFeedback({ ...valid, message: '  The tub sank\n' })).toEqual(
      valid as never,
    )
  })

  test('keeps a valid reply address', () => {
    expect(parseFeedback({ ...valid, email: ' a@b.co ' })?.email).toBe('a@b.co')
  })

  test('drops an empty reply address', () => {
    expect(parseFeedback({ ...valid, email: '  ' })).not.toHaveProperty('email')
  })

  test('refuses what cannot be delivered', () => {
    for (const body of [
      null,
      'text',
      { ...valid, kind: 'spam' },
      { ...valid, kind: 'constructor' },
      { ...valid, message: 3 },
      { ...valid, message: '   ' },
      { ...valid, message: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) },
      { ...valid, email: 'nope' },
      { ...valid, email: 'a@b.co\nBcc: c@d.co' },
    ]) {
      expect(parseFeedback(body)).toBeNull()
    }
  })

  test('falls back to English for an unknown locale', () => {
    expect(parseFeedback({ ...valid, locale: 'xx' })?.locale).toBe('en')
  })
})

describe('createRateLimit', () => {
  test('refuses a sender over the limit until the window passes', () => {
    const allow = createRateLimit(2, 1000)
    expect(allow('a', 0)).toBe(true)
    expect(allow('a', 1)).toBe(true)
    expect(allow('a', 2)).toBe(false)
    expect(allow('b', 2)).toBe(true)
    expect(allow('a', 1001)).toBe(true)
  })
})
