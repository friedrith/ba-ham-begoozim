import { useEffect, useRef, useState } from 'react'

import { FEEDBACK_KINDS, MAX_MESSAGE_LENGTH, type FeedbackKind } from '../feedback'
import type { Messages } from '../i18n'
import { Panel, PanelButton } from './panel'

const field =
  'border-ink placeholder:text-ink/50 w-full rounded-xl border-[3px] bg-white px-3 py-2 select-text'

export function FeedbackPanel({
  t,
  onClose,
}: {
  t: Messages
  onClose: () => void
}) {
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>(
    'idle',
  )

  const messageRef = useRef<HTMLTextAreaElement>(null)

  // Brings keyboard players into the popup, which opens over the menu.
  useEffect(() => messageRef.current?.focus(), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const send = async (website: FormDataEntryValue | null) => {
    setStatus('sending')
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message, email, locale: t.locale, website }),
      })
      setStatus(response.ok ? 'sent' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  if (status === 'sent') {
    return (
      <Panel title={t.feedback.title}>
        <output className="block text-center font-bold">{t.feedback.sent}</output>
        <PanelButton primary onClick={onClose}>
          {t.feedback.close}
        </PanelButton>
      </Panel>
    )
  }

  return (
    <Panel title={t.feedback.title}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void send(new FormData(event.currentTarget).get('website'))
        }}
      >
        <fieldset className="flex gap-2">
          <legend className="sr-only">{t.feedback.kind}</legend>
          {FEEDBACK_KINDS.map((option) => (
            <label
              key={option}
              className="border-ink has-checked:bg-mustard has-focus-visible:outline-ink flex-1 cursor-pointer rounded-xl border-[3px] bg-white px-2 py-1 text-center font-bold has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
            >
              <input
                type="radio"
                name="kind"
                checked={kind === option}
                onChange={() => setKind(option)}
                className="sr-only"
              />
              {t.feedback.kinds[option]}
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1 text-sm font-bold">
          {t.feedback.message}
          <textarea
            ref={messageRef}
            required
            dir="auto"
            rows={4}
            maxLength={MAX_MESSAGE_LENGTH}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={`${field} resize-none font-normal`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold">
          {t.feedback.email}
          <input
            dir="ltr"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={`${field} font-normal`}
          />
        </label>

        {/* A trap for bots: people never see or reach this field. */}
        <input
          aria-hidden="true"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="sr-only"
        />

        {status === 'failed' && (
          <p role="alert" className="text-sauce text-sm font-bold">
            {t.feedback.failed}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'sending' || !message.trim()}
          className="bg-mustard border-ink font-display cursor-pointer rounded-xl border-[3px] px-4 py-2 text-lg disabled:cursor-default disabled:opacity-50"
        >
          {status === 'sending' ? t.feedback.sending : t.feedback.send}
        </button>
        <PanelButton onClick={onClose}>{t.feedback.cancel}</PanelButton>
      </form>
    </Panel>
  )
}
