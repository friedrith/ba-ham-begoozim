import { createRateLimit, parseFeedback } from '@/features/game/feedback'

const SUBJECTS = {
  bug: 'Bug report',
  feature: 'Feature idea',
  feedback: 'Feedback',
}

const allowSend = createRateLimit()

export async function POST(request: Request) {
  const { RESEND_API_KEY, RESEND_EMAIL_DOMAIN, FEEDBACK_EMAIL } = process.env
  if (!RESEND_API_KEY || !RESEND_EMAIL_DOMAIN || !FEEDBACK_EMAIL) {
    return new Response(null, { status: 503 })
  }

  const body: unknown = await request.json().catch(() => null)

  // Only bots fill the field players never see. They get told it worked.
  if ((body as { website?: unknown } | null)?.website) {
    return new Response(null, { status: 204 })
  }

  const feedback = parseFeedback(body)
  if (!feedback) return new Response(null, { status: 400 })

  const sender = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  if (!allowSend(sender)) return new Response(null, { status: 429 })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Ba Ham Begoozim <feedback@${RESEND_EMAIL_DOMAIN}>`,
      to: [FEEDBACK_EMAIL],
      subject: `[Ba Ham Begoozim] ${SUBJECTS[feedback.kind]}`,
      text: [
        feedback.message,
        '',
        '--',
        `Reply to: ${feedback.email ?? 'not given'}`,
        `Language: ${feedback.locale}`,
        `Browser: ${request.headers.get('user-agent') ?? 'unknown'}`,
      ].join('\n'),
      ...(feedback.email && { reply_to: feedback.email }),
    }),
  })

  if (!response.ok) {
    console.error('Resend refused the feedback email', response.status)
    return new Response(null, { status: 502 })
  }
  return new Response(null, { status: 204 })
}
