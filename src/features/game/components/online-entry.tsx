import { useState } from 'react'

import { createRoom } from '../../online/session'
import { formatNumber, type Messages } from '../i18n'

const CODE_LENGTH = 6
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Whatever digits a phone's keyboard produced, in the form rooms are looked up by. */
export function normalizeCode(text: string) {
  return [...text]
    .map((char) => {
      const persian = PERSIAN_DIGITS.indexOf(char)
      if (persian !== -1) return String(persian)
      const arabic = ARABIC_DIGITS.indexOf(char)
      return arabic === -1 ? char : String(arabic)
    })
    .join('')
    .replace(/\D/g, '')
    .slice(0, CODE_LENGTH)
}

export function OnlineEntry({
  t,
  url,
  onEnter,
}: {
  t: Messages
  url: string
  onEnter: (code: string) => void
}) {
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [failed, setFailed] = useState(false)

  const create = async () => {
    setCreating(true)
    setFailed(false)
    try {
      onEnter(await createRoom(url))
    } catch {
      setFailed(true)
    } finally {
      setCreating(false)
    }
  }

  return (
    <section
      aria-label={t.online.title}
      className="bg-cream border-ink flex flex-col gap-3 rounded-2xl border-[3px] p-4"
    >
      <div>
        <h2 className="font-display text-xl">{t.online.title}</h2>
        <p className="text-ink/80 text-sm leading-snug">{t.online.intro}</p>
      </div>
      <div className="flex flex-wrap items-stretch gap-3">
        <button
          type="button"
          disabled={creating}
          onClick={() => void create()}
          className="bg-mustard border-ink font-display cursor-pointer rounded-xl border-[3px] px-4 py-2 text-lg disabled:opacity-50"
        >
          {t.online.create}
        </button>
        <form
          className="flex min-w-48 flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (code.length === CODE_LENGTH) onEnter(code)
          }}
        >
          <input
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            aria-label={t.online.codeLabel}
            placeholder={t.online.codeLabel}
            value={formatNumber(code, t.locale)}
            onChange={(event) => setCode(normalizeCode(event.target.value))}
            className="border-ink placeholder:text-ink/50 w-full min-w-0 flex-1 rounded-xl border-[3px] bg-white px-3 py-2 text-center text-lg font-bold tracking-widest select-text placeholder:font-normal placeholder:tracking-normal"
          />
          <button
            type="submit"
            disabled={code.length !== CODE_LENGTH}
            className="border-ink font-display cursor-pointer rounded-xl border-[3px] bg-white px-4 py-2 text-lg disabled:cursor-default disabled:opacity-50"
          >
            {t.online.join}
          </button>
        </form>
      </div>
      {failed && (
        <p role="alert" className="text-sauce text-sm font-bold">
          {t.online.unreachable}
        </p>
      )}
    </section>
  )
}
