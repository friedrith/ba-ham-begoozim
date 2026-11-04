import { clsx } from 'clsx'
import { Star } from 'lucide-react'
import { useState } from 'react'

import { LEVELS } from '../engine/levels'
import { SEATS } from '../engine/world'
import { formatTime, type Progress } from '../progress'
import { PALETTES } from '../render/scene'
import { BeanFace } from './bean-face'

type MenuProps = {
  progress: Progress
  onPlay: (levelIndex: number) => void
}

export function Stars({ count, small }: { count: number; small?: boolean }) {
  const size = small ? 'size-3.5' : 'size-5'
  return (
    <span className="flex gap-0.5">
      <span className="sr-only">{count} of 3 stars</span>
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

export function Menu({ progress, onPlay }: MenuProps) {
  const [selected, setSelected] = useState(() => nextLevelIndex(progress))
  const level = LEVELS[selected]
  const record = progress[level.id]
  const totalStars = LEVELS.reduce(
    (total, { id }) => total + (progress[id]?.stars ?? 0),
    0,
  )

  return (
    <div className="bg-ink/45 absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-4 px-4 py-6">
        <header className="flex flex-col items-center gap-1 text-center">
          <h1 className="font-display text-sauce text-6xl leading-none [-webkit-text-stroke:2px_var(--color-ink)] [paint-order:stroke_fill] md:text-7xl">
            Toot Canal
          </h1>
          <p className="bg-cream border-ink rounded-full border-2 px-4 py-1 text-sm font-bold md:text-base">
            Four beans. One bathtub. No engine.
          </p>
        </header>

        <section
          aria-label="Levels"
          className="bg-cream border-ink shadow-ink grid gap-4 rounded-2xl border-[3px] p-3 shadow-[0_5px_0] md:grid-cols-[1fr_17rem] md:p-4"
        >
          <div className="flex flex-col gap-2 md:order-last">
            <h2 className="font-display text-3xl leading-tight">{level.name}</h2>
            <p className="text-ink/75 flex-1 text-sm leading-snug">{level.blurb}</p>
            <dl className="grid grid-cols-2 gap-x-3 text-sm">
              <dt>Par</dt>
              <dd className="text-right font-bold tabular-nums">
                {formatTime(level.par)}
              </dd>
              {record && (
                <>
                  <dt>Best</dt>
                  <dd className="text-right font-bold tabular-nums">
                    {formatTime(record.bestTime)}
                  </dd>
                </>
              )}
            </dl>
            <Stars count={record?.stars ?? 0} />
            <button
              type="button"
              onClick={() => onPlay(selected)}
              className="bg-mustard border-ink shadow-ink font-display cursor-pointer rounded-xl border-[3px] px-4 py-2 text-2xl shadow-[0_4px_0] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
            >
              Play
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {LEVELS.map(({ id, name, theme }, index) => (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={index === selected}
                    // A second click on the chosen course is as good as pressing Play.
                    onClick={() =>
                      index === selected ? onPlay(index) : setSelected(index)
                    }
                    className={clsx(
                      'border-ink flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border-[3px] text-left transition-transform hover:-translate-y-0.5',
                      index === selected ? 'bg-mustard/60' : 'bg-white',
                    )}
                  >
                    <span
                      className="flex items-center justify-between gap-2 px-2 py-1"
                      style={{ backgroundColor: PALETTES[theme].water }}
                    >
                      <span className="bg-cream border-ink rounded-md border-2 px-1.5 text-xs font-bold tabular-nums">
                        {index + 1}
                      </span>
                      <Stars count={progress[id]?.stars ?? 0} small />
                    </span>
                    <span className="font-display px-2 py-1.5 text-sm leading-tight md:text-base">
                      {name}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <p className="flex items-center gap-1 text-sm font-bold tabular-nums">
              <Star aria-hidden="true" className="fill-mustard text-ink size-4" />
              {totalStars} of {LEVELS.length * 3} stars
            </p>
          </div>
        </section>

        <section
          aria-label="How to play"
          className="bg-cream border-ink rounded-2xl border-[3px] p-4"
        >
          <h2 className="font-display mb-2 text-xl">
            Grab a corner of the keyboard
          </h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
            {SEATS.map((seat, i) => (
              <li key={seat.key} className="flex items-center gap-2">
                <BeanFace seat={i} className="size-8 shrink-0" />
                <kbd className="bg-ink text-cream rounded-md px-2 py-0.5 font-bold">
                  {seat.key}
                </kbd>
                <span className="leading-tight">{seat.name}</span>
              </li>
            ))}
          </ul>
          <p className="text-ink/80 mt-3 text-sm leading-snug">
            <strong>Rear beans</strong> push forward, <strong>front beans</strong>{' '}
            push back, and a blast from one side turns the tub. Blast within a blink
            of each other for a <strong>harmony</strong>: a bigger shove, gas back,
            and a chord. Solo? <kbd className="font-bold">←</kbd>{' '}
            <kbd className="font-bold">→</kbd> work the rear and{' '}
            <kbd className="font-bold">↓</kbd> the front. On a touch screen, use the
            corner pads.
          </p>
        </section>
      </div>
    </div>
  )
}
