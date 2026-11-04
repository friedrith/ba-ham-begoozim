export const FEEDBACK_KINDS = ['bug', 'feature', 'feedback'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export const MAX_MESSAGE_LENGTH = 5000
const MAX_EMAIL_LENGTH = 254
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60 * 1000

export type Feedback = {
  kind: FeedbackKind
  message: string
  email?: string
  locale: string
}

/** What a player's browser sent, or null when it can't be delivered as is. */
export function parseFeedback(body: unknown): Feedback | null {
  if (typeof body !== 'object' || body === null) return null
  const { kind, message, email, locale } = body as Record<string, unknown>

  if (!FEEDBACK_KINDS.includes(kind as FeedbackKind)) return null
  if (typeof message !== 'string') return null
  const text = message.trim()
  if (!text || text.length > MAX_MESSAGE_LENGTH) return null

  const reply = typeof email === 'string' ? email.trim() : ''
  if (reply && (reply.length > MAX_EMAIL_LENGTH || !EMAIL.test(reply))) return null

  return {
    kind: kind as FeedbackKind,
    message: text,
    ...(reply && { email: reply }),
    locale: locale === 'fa' ? 'fa' : 'en',
  }
}

/** Sends per sender in memory: each server instance counts on its own, so it only slows floods. */
export function createRateLimit(limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS) {
  const sends = new Map<string, number[]>()
  return (sender: string, now = Date.now()) => {
    for (const [key, times] of sends) {
      if (times.every((time) => now - time >= windowMs)) sends.delete(key)
    }
    const recent = (sends.get(sender) ?? []).filter((time) => now - time < windowMs)
    if (recent.length >= limit) return false
    sends.set(sender, [...recent, now])
    return true
  }
}
