import { clsx } from 'clsx'
import { Star } from 'lucide-react'
import { useState } from 'react'

import { LEVELS } from '../engine/levels'
import {
  formatNumber,
  formatTime,
  MESSAGES,
  type Locale,
  type Messages,
} from '../i18n'
import type { Progress } from '../progress'
import { PALETTES } from '../render/scene'
import { BeanFace } from './bean-face'
import { RichText } from './rich-text'

type MenuProps = {
  t: Messages
  progress: Progress
  touchMode: boolean
  onPlay: (levelIndex: number) => void
  onLocaleChange: (locale: Locale) => void
}

export function Stars({
  count,
  t,
  small,
}: {
  count: number
  t: Messages
  small?: boolean
}) {
  const size = small ? 'size-3.5' : 'size-5'
  return (
    <span className="flex gap-0.5">
      <span className="sr-only">{t.menu.stars(formatNumber(count, t.locale))}</span>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={clsx(
            size,
            i < count ? 'fill-mustard text-ink' : 'text-ink/25 fill-transparent',
          )}
        />
      ))}
    </span>
  )
}

/** The course to offer first: the next one nobody has finished, else the first one. */
function nextLevelIndex(progress: Progress) {
  const next = LEVELS.findIndex((level) => !progress[level.id])
  return next === -1 ? 0 : next
}

export function Menu({
  t,
  progress,
  touchMode,
  onPlay,
  onLocaleChange,
}: MenuProps) {
  const [selected, setSelected] = useState(() => nextLevelIndex(progress))
  const level = LEVELS[selected]
  const text = t.levels[level.id]
  const record = progress[level.id]
  const totalStars = LEVELS.reduce(
    (total, { id }) => total + (progress[id]?.stars ?? 0),
    0,
  )
  const other = MESSAGES[t.locale === 'fa' ? 'en' : 'fa']

  return (
    <div className="bg-ink/45 absolute inset-0 touch-pan-y overflow-y-auto overscroll-contain">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-4 px-4 py-6">
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

        <section
          aria-label={t.menu.levels}
          className="bg-cream border-ink shadow-ink grid gap-4 rounded-2xl border-[3px] p-3 shadow-[0_5px_0] md:grid-cols-[1fr_17rem] md:p-4"
        >
          <div className="flex flex-col gap-2 md:order-last">
            <h2 className="font-display text-3xl leading-tight">{text.name}</h2>
            <p className="text-ink/75 flex-1 text-sm leading-snug">{text.blurb}</p>
            <p className="flex justify-between gap-3 text-sm font-bold tabular-nums">
              <span>{t.menu.par(formatTime(level.par, t.locale))}</span>
              {record && (
                <span>{t.menu.best(formatTime(record.bestTime, t.locale))}</span>
              )}
            </p>
            <Stars count={record?.stars ?? 0} t={t} />
            <button
              type="button"
              onClick={() => onPlay(selected)}
              className="bg-mustard border-ink shadow-ink font-display cursor-pointer rounded-xl border-[3px] px-4 py-2 text-2xl shadow-[0_4px_0] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
            >
              {t.menu.play}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {LEVELS.map(({ id, theme }, index) => (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={index === selected}
                    // A second click on the chosen course is as good as pressing Play.
                    onClick={() =>
                      index === selected ? onPlay(index) : setSelected(index)
                    }
                    className={clsx(
                      'border-ink flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border-[3px] text-start transition-transform hover:-translate-y-0.5',
                      index === selected ? 'bg-mustard/60' : 'bg-white',
                    )}
                  >
                    <span
                      className="flex items-center justify-between gap-2 px-2 py-1"
                      style={{ backgroundColor: PALETTES[theme].water }}
                    >
                      <span className="bg-cream border-ink rounded-md border-2 px-1.5 text-xs font-bold tabular-nums">
                        {formatNumber(index + 1, t.locale)}
                      </span>
                      <Stars count={progress[id]?.stars ?? 0} t={t} small />
                    </span>
                    <span className="font-display px-2 py-1.5 text-sm leading-tight md:text-base">
                      {t.levels[id].name}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <p className="flex items-center gap-1 text-sm font-bold tabular-nums">
              <Star aria-hidden="true" className="fill-mustard text-ink size-4" />
              {t.menu.totalStars(
                `${formatNumber(totalStars, t.locale)}/${formatNumber(LEVELS.length * 3, t.locale)}`,
              )}
            </p>
          </div>
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
