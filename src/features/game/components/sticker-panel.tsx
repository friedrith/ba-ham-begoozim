import { clsx } from 'clsx'
import { useEffect, useState } from 'react'

import type { Messages } from '../i18n'
import {
  MAX_STICKERS_PER_BEAN,
  STICKER_IDS,
  toggleSticker,
  type BeanStickers,
} from '../stickers'
import { BeanFace, StickerIcon } from './bean-face'
import { Panel, PanelButton } from './panel'

export function StickerPanel({
  t,
  stickers,
  initialSeat = 0,
  onChange,
  onClose,
}: {
  t: Messages
  stickers: BeanStickers
  /** The bean to open on. */
  initialSeat?: number
  onChange: (stickers: BeanStickers) => void
  onClose: () => void
}) {
  const [seat, setSeat] = useState(initialSeat)
  const chosen = stickers[seat]
  const full = chosen.length >= MAX_STICKERS_PER_BEAN

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <Panel title={t.stickers.title}>
      <p className="text-ink/80 text-center text-sm leading-snug">
        {t.stickers.hint}
      </p>

      {/* Laid out like the corners, so left-hand seats stay on the left in Persian. */}
      <ul dir="ltr" className="grid grid-cols-4 gap-2">
        {t.seats.map((text, i) => (
          <li key={i}>
            <button
              type="button"
              aria-label={text.name}
              aria-pressed={i === seat}
              onClick={() => setSeat(i)}
              className={clsx(
                'border-ink flex w-full cursor-pointer justify-center rounded-xl border-[3px] p-1',
                i === seat ? 'bg-mustard' : 'bg-white',
              )}
            >
              <BeanFace seat={i} stickers={stickers[i]} className="size-12" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center">
        <BeanFace seat={seat} stickers={chosen} className="size-32" />
        <p className="font-bold">{t.seats[seat].name}</p>
      </div>

      <ul className="grid grid-cols-5 gap-2">
        {STICKER_IDS.map((id) => {
          const on = chosen.includes(id)
          return (
            <li key={id}>
              <button
                type="button"
                aria-label={t.stickers.names[id]}
                title={t.stickers.names[id]}
                aria-pressed={on}
                disabled={full && !on}
                onClick={() => onChange(toggleSticker(stickers, seat, id))}
                className={clsx(
                  'border-ink flex w-full cursor-pointer justify-center rounded-xl border-[3px] p-1 disabled:cursor-default disabled:opacity-40',
                  on ? 'bg-mustard' : 'bg-white',
                )}
              >
                <StickerIcon id={id} className="size-9" />
              </button>
            </li>
          )
        })}
      </ul>

      <PanelButton
        disabled={chosen.length === 0}
        onClick={() =>
          onChange(stickers.map((list, i) => (i === seat ? [] : list)))
        }
      >
        {t.stickers.peel}
      </PanelButton>
      <PanelButton primary onClick={onClose}>
        {t.stickers.done}
      </PanelButton>
    </Panel>
  )
}
