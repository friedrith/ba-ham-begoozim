import { clsx } from 'clsx'
import {
  ChevronLeft,
  ChevronRight,
  Coffee,
  Github,
  MessageSquarePlus,
  Star,
  Sticker,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { LEVELS } from '../engine/levels'
import {
  formatNumber,
  formatTime,
  MESSAGES,
  type Locale,
  type Messages,
} from '../i18n'
import { MAX_STARS, rankFor, totalStars, type Progress } from '../progress'
import type { BeanStickers } from '../stickers'
import { BeanFace } from './bean-face'
import { LevelPreview } from './level-preview'
import { RichText } from './rich-text'

const REPO_URL = 'https://github.com/friedrith/ba-ham-begoozim'
const COFFEE_URL = 'https://buymeacoffee.com/friedrith'

const arrowButton =
  'bg-white border-ink shrink-0 cursor-pointer rounded-full border-[3px] p-2 transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-30 disabled:hover:translate-y-0'

type MenuProps = {
  t: Messages
  progress: Progress
  stickers: BeanStickers
  touchMode: boolean
  onPlay: (levelIndex: number) => void
  onLocaleChange: (locale: Locale) => void
  onFeedback: () => void
  onStickers: () => void
  /** Shown between the levels and the instructions. */
  online?: React.ReactNode
  /** Pinned over the menu, outside its scrolling. */
  players?: React.ReactNode
}

export function Stars({
  count,
  t,
  small,
  celebrate,
}: {
  count: number
  t: Messages
  small?: boolean
  /** Big, with each earned star stamped on after the card has landed. */
  celebrate?: boolean
}) {
  const size = small ? 'size-3.5' : celebrate ? 'size-10' : 'size-5'
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
            celebrate && i < count && 'motion-safe:animate-star-stamp',
          )}
          style={celebrate ? { animationDelay: `${0.45 + i * 0.2}s` } : undefined}
        />
      ))}
    </span>
  )
}

/** Keys pressed in a form belong to the form, not to the game. */
export function isTextField(target: EventTarget | null) {
  return target instanceof Element && target.closest('input, textarea') !== null
}

/** The course to offer first: the next one nobody has finished, else the first one. */
function nextLevelIndex(progress: Progress) {
  const next = LEVELS.findIndex((level) => !progress[level.id])
  return next === -1 ? 0 : next
}

export function Menu({
  t,
  progress,
  stickers,
  touchMode,
  onPlay,
  onLocaleChange,
  onFeedback,
  onStickers,
  online,
  players,
}: MenuProps) {
  const sliderRef = useRef<HTMLOListElement>(null)
  const [selected, setSelected] = useState(() => nextLevelIndex(progress))
  const selectedRef = useRef(selected)
  const stars = totalStars(progress)
  const other = MESSAGES[t.locale === 'fa' ? 'en' : 'fa']

  /** The slider scrolls into negative numbers in right-to-left layouts. */
  const scrollPosition = useCallback(
    (slider: HTMLElement, index: number) =>
      index * slider.clientWidth * (t.dir === 'rtl' ? -1 : 1),
    [t.dir],
  )

  const goTo = useCallback(
    (index: number) => {
      const slider = sliderRef.current
      if (!slider) return
      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      slider.scrollTo({
        left: scrollPosition(slider, index),
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
    },
    [scrollPosition],
  )

  const syncSelected = () => {
    const slider = sliderRef.current
    if (!slider) return
    const index = Math.round(
      Math.abs(slider.scrollLeft) / (slider.clientWidth || 1),
    )
    selectedRef.current = index
    setSelected(index)
  }

  // Opens on the offered level, and holds it when the language flips the slider.
  useLayoutEffect(() => {
    const slider = sliderRef.current
    if (slider) {
      slider.scrollLeft = scrollPosition(slider, selectedRef.current)
    }
  }, [scrollPosition])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTextField(event.target)) return
      if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return
      const forwards = event.code === (t.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight')
      const next = selectedRef.current + (forwards ? 1 : -1)
      if (next >= 0 && next < LEVELS.length) goTo(next)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goTo, t.dir])

  return (
    <div className="bg-ink/45 absolute inset-0 touch-pan-y overflow-y-auto overscroll-contain">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-4 px-4 pt-6 pb-14">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onStickers}
            className="bg-cream border-ink me-auto flex cursor-pointer items-center gap-1.5 rounded-full border-[3px] px-3 py-1 text-sm font-bold"
          >
            <Sticker aria-hidden="true" className="size-4" />
            {t.stickers.open}
          </button>
          <button
            type="button"
            aria-label={t.menu.feedback}
            title={t.menu.feedback}
            onClick={onFeedback}
            className="bg-cream border-ink flex size-9 cursor-pointer items-center justify-center rounded-full border-[3px]"
          >
            <MessageSquarePlus aria-hidden="true" className="text-ink size-4" />
          </button>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={t.menu.sourceCode}
            className="bg-cream border-ink flex size-9 items-center justify-center rounded-full border-[3px]"
          >
            <Github aria-hidden="true" className="text-ink size-4" />
          </a>
          <a
            href={COFFEE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={t.menu.buyCoffee}
            className="bg-cream border-ink flex size-9 items-center justify-center rounded-full border-[3px]"
          >
            <Coffee aria-hidden="true" className="text-ink size-4" />
          </a>
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
          className="bg-cream border-ink shadow-ink flex flex-col gap-3 rounded-2xl border-[3px] p-3 shadow-[0_5px_0] md:p-4"
        >
          {/* Relative so it clips the absolute sr-only text of the levels out of view. */}
          <ol
            ref={sliderRef}
            dir={t.dir}
            onScroll={syncSelected}
            className="relative flex touch-pan-x touch-pan-y snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
          >
            {LEVELS.map((level, index) => {
              const text = t.levels[level.id]
              const record = progress[level.id]
              return (
                <li
                  key={level.id}
                  // Only the level in view can take focus or be pressed.
                  inert={index !== selected}
                  className="grid w-full shrink-0 snap-center snap-always content-start gap-3 p-1 pb-2 md:grid-cols-[1fr_17rem] md:gap-4"
                >
                  <LevelPreview level={level} />
                  <div className="flex flex-col gap-2">
                    <h2 className="font-display text-3xl leading-tight">
                      {text.name}
                    </h2>
                    <p className="text-ink/75 flex-1 text-sm leading-snug">
                      {text.blurb}
                    </p>
                    <p className="flex justify-between gap-3 text-sm font-bold tabular-nums">
                      <span>{t.menu.par(formatTime(level.par, t.locale))}</span>
                      {record && (
                        <span>
                          {t.menu.best(formatTime(record.bestTime, t.locale))}
                        </span>
                      )}
                    </p>
                    <Stars count={record?.stars ?? 0} t={t} />
                    <button
                      type="button"
                      onClick={() => onPlay(index)}
                      className="bg-mustard border-ink shadow-ink font-display cursor-pointer rounded-xl border-[3px] px-4 py-2 text-2xl shadow-[0_4px_0] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
                    >
                      {t.menu.play}
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label={t.menu.previousLevel}
              disabled={selected === 0}
              onClick={() => goTo(selected - 1)}
              className={arrowButton}
            >
              <ChevronLeft aria-hidden="true" className="size-6 rtl:-scale-x-100" />
            </button>

            <div className="flex flex-col items-center gap-1.5">
              <span aria-hidden="true" className="flex items-center gap-1">
                {LEVELS.map(({ id }, index) => (
                  <span
                    key={id}
                    className={clsx(
                      'border-ink size-2.5 rounded-full border-2 transition-transform',
                      index === selected && 'bg-sauce scale-125',
                      index !== selected && progress[id] && 'bg-mustard',
                    )}
                  />
                ))}
              </span>
              <p
                aria-live="polite"
                className="flex items-center gap-3 text-sm font-bold tabular-nums"
              >
                <span>
                  {t.menu.levelCount(
                    formatNumber(`${selected + 1}/${LEVELS.length}`, t.locale),
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Star
                    aria-hidden="true"
                    className="fill-mustard text-ink size-4"
                  />
                  {t.menu.totalStars(
                    `${formatNumber(stars, t.locale)}/${formatNumber(MAX_STARS, t.locale)}`,
                  )}
                </span>
              </p>
              <p className="font-display text-sauce text-lg leading-none">
                {t.ranks[rankFor(stars)]}
              </p>
            </div>

            <button
              type="button"
              aria-label={t.menu.nextLevel}
              disabled={selected === LEVELS.length - 1}
              onClick={() => goTo(selected + 1)}
              className={arrowButton}
            >
              <ChevronRight
                aria-hidden="true"
                className="size-6 rtl:-scale-x-100"
              />
            </button>
          </div>
        </section>

        {online}

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
                <BeanFace
                  seat={i}
                  stickers={stickers[i]}
                  className="size-8 shrink-0"
                />
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
      {players}
    </div>
  )
}
