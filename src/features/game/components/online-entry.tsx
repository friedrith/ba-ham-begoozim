import { useEffect, useRef, useState } from 'react'

import { createRoom } from '../../online/session'
import { formatNumber, type Messages } from '../i18n'
import { Panel, PanelButton } from './panel'

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
  onJoin,
}: {
  t: Messages
  url: string
  onEnter: (code: string) => void
  onJoin: () => void
}) {
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
      <button
        type="button"
        disabled={creating}
        onClick={() => void create()}
        className="bg-mustard border-ink font-display w-full cursor-pointer rounded-xl border-[3px] px-4 py-4 text-3xl disabled:opacity-50"
      >
        {t.online.create}
      </button>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="bg-ink/30 h-0.5 flex-1 rounded-full" />
        <span className="font-display text-ink/70">{t.online.or}</span>
        <span aria-hidden="true" className="bg-ink/30 h-0.5 flex-1 rounded-full" />
      </div>
      <PanelButton onClick={onJoin}>{t.online.joinRoom}</PanelButton>
      {failed && (
        <p role="alert" className="text-sauce text-sm font-bold">
          {t.online.unreachable}
        </p>
      )}
    </section>
  )
}

export function JoinRoomPanel({
  t,
  onEnter,
  onClose,
}: {
  t: Messages
  onEnter: (code: string) => void
  onClose: () => void
}) {
  const [code, setCode] = useState('')

  const codeRef = useRef<HTMLInputElement>(null)

  // Brings keyboard players into the popup, which opens over the menu.
  useEffect(() => codeRef.current?.focus(), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <Panel title={t.online.joinRoom}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (code.length === CODE_LENGTH) onEnter(code)
        }}
      >
        <input
          ref={codeRef}
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          aria-label={t.online.codeLabel}
          placeholder={t.online.codeLabel}
          value={formatNumber(code, t.locale)}
          onChange={(event) => setCode(normalizeCode(event.target.value))}
          className="border-ink placeholder:text-ink/50 w-full rounded-xl border-[3px] bg-white px-3 py-2 text-center text-2xl font-bold tracking-widest select-text placeholder:font-normal placeholder:tracking-normal"
        />
        <button
          type="submit"
          disabled={code.length !== CODE_LENGTH}
          className="bg-mustard border-ink font-display cursor-pointer rounded-xl border-[3px] px-4 py-2 text-lg disabled:cursor-default disabled:opacity-50"
        >
          {t.online.join}
        </button>
        <PanelButton onClick={onClose}>{t.online.cancel}</PanelButton>
      </form>
    </Panel>
  )
}
