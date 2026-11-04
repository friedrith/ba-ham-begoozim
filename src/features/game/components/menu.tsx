import { clsx } from 'clsx'
import { Star } from 'lucide-react'

import { LEVELS } from '../engine/levels'
import {
  formatNumber,
  formatTime,
  MESSAGES,
  type Locale,
  type Messages,
} from '../i18n'
import type { Progress } from '../progress'
import { BeanFace } from './bean-face'
import { RichText } from './rich-text'

type MenuProps = {
  t: Messages
  progress: Progress
  touchMode: boolean
  onPlay: (levelIndex: number) => void
  onLocaleChange: (locale: Locale) => void
}

export function Stars({ count, t }: { count: number; t: Messages }) {
  return (
    <span className="flex gap-0.5">
      <span className="sr-only">{t.menu.stars(formatNumber(count, t.locale))}</span>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={
            i < count
              ? 'fill-mustard text-ink size-5'
              : 'text-ink/25 size-5 fill-transparent'
          }
        />
      ))}
    </span>
  )
}

export function Menu({
  t,
  progress,
  touchMode,
  onPlay,
  onLocaleChange,
}: MenuProps) {
  const other = MESSAGES[t.locale === 'fa' ? 'en' : 'fa']
  return (
    <div className="bg-ink/45 absolute inset-0 touch-pan-y overflow-y-auto overscroll-contain">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-5 px-4 py-8">
        <div className="flex justify-end">
          <button
            type="button"
            lang={other.locale}
            onClick={() => onLocaleChange(other.locale)}
            className="bg-cream border-ink cursor-pointer rounded-full border-[3px] px-3 py-1 text-sm font-bold"
          >
            {other.languageName}
          </button>
        </div>

        <header className="flex flex-col items-center gap-1 text-center">
          <h1 className="font-display text-sauce pb-[0.15em] text-6xl leading-none [-webkit-text-stroke:2px_var(--color-ink)] [paint-order:stroke_fill] md:text-[5.5rem]">
            {t.menuTitle}
          </h1>
          <p className="bg-cream border-ink rounded-full border-2 px-4 py-1 text-sm font-bold md:text-base">
            {t.tagline}
          </p>
        </header>

        <section aria-label={t.menu.levels} className="grid gap-3 md:grid-cols-3">
          {LEVELS.map((level, index) => {
            const record = progress[level.id]
            const text = t.levels[level.id]
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => onPlay(index)}
                className="bg-cream border-ink shadow-ink hover:bg-mustard/40 flex cursor-pointer flex-col gap-2 rounded-2xl border-[3px] p-4 text-start shadow-[0_5px_0] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
              >
                <span className="font-display text-2xl leading-tight">
                  {text.name}
                </span>
                <span className="text-ink/75 flex-1 text-sm leading-snug">
                  {text.blurb}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <Stars count={record?.stars ?? 0} t={t} />
                  <span className="text-sm font-bold tabular-nums">
                    {record
                      ? formatTime(record.bestTime, t.locale)
                      : t.menu.par(formatTime(level.par, t.locale))}
                  </span>
                </span>
              </button>
            )
          })}
        </section>

        <section
          aria-label={t.menu.howToPlay}
          className="bg-cream border-ink rounded-2xl border-[3px] p-4"
        >
          <h2 className="font-display mb-2 text-xl">
            {touchMode ? t.menu.howToPlayTitleTouch : t.menu.howToPlayTitle}
          </h2>
          {/* Laid out like the corners, so left-hand seats stay on the left in Persian. */}
          <ul
            dir="ltr"
            className={clsx(
              'grid grid-cols-2 gap-x-4 gap-y-2 text-sm',
              !touchMode && 'md:grid-cols-4',
            )}
          >
            {t.seats.map((seat, i) => (
              <li key={i} dir={t.dir} className="flex items-center gap-2">
                <BeanFace seat={i} className="size-8 shrink-0" />
                {!touchMode && (
                  <kbd className="bg-ink text-cream rounded-md px-2 py-0.5 font-bold">
                    {seat.key}
                  </kbd>
                )}
                <span className="leading-tight">{seat.name}</span>
              </li>
            ))}
          </ul>
          <p className="text-ink/80 mt-3 text-sm leading-snug">
            <RichText
              text={
                touchMode
                  ? `${t.hud.holdCorner} ${t.menu.howToPlayBody}`
                  : `${t.menu.howToPlayBody} ${t.menu.howToPlaySolo}`
              }
            />
          </p>
        </section>
      </div>
    </div>
  )
}
