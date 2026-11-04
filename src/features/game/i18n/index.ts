import { en } from './en'
import { fa } from './fa'
import type { Locale, Messages } from './messages'

export type { Locale, Messages } from './messages'

export const MESSAGES: Record<Locale, Messages> = { en, fa }

const STORAGE_KEY = 'toot-canal:locale'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

function isLocale(value: string | null): value is Locale {
  return value !== null && Object.hasOwn(MESSAGES, value)
}

/** A saved choice wins, then the first browser language we speak, then English. */
export function pickLocale(
  saved: string | null,
  languages: readonly string[],
): Locale {
  if (isLocale(saved)) return saved
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return 'en'
}

export function loadLocale(): Locale {
  let saved: string | null = null
  try {
    saved = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private windows can refuse storage. Fall back to the browser's language.
  }
  return pickLocale(saved, navigator.languages)
}

export function saveLocale(locale: Locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Private windows can refuse storage. The game still plays, it just won't remember.
  }
}

export function formatNumber(value: number | string, locale: Locale) {
  const text = String(value)
  if (locale !== 'fa') return text
  return text
    .replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)])
    .replace('.', '٫')
}

export function formatTime(seconds: number, locale: Locale) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return formatNumber(`${minutes}:${rest.toFixed(1).padStart(4, '0')}`, locale)
}
