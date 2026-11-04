import { clsx } from 'clsx'
import { Star } from 'lucide-react'

import { LEVELS } from '../engine/levels'
import { SEATS } from '../engine/world'
import { formatTime, type Progress } from '../progress'
import { BeanFace } from './bean-face'

type MenuProps = {
  progress: Progress
  touchMode: boolean
  onPlay: (levelIndex: number) => void
}

export function Stars({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5">
      <span className="sr-only">{count} of 3 stars</span>
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

export function Menu({ progress, touchMode, onPlay }: MenuProps) {
  return (
    <div className="bg-ink/45 absolute inset-0 touch-pan-y overflow-y-auto overscroll-contain">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-5 px-4 py-8">
        <header className="flex flex-col items-center gap-1 text-center">
          <h1 className="font-display text-sauce text-6xl leading-none [-webkit-text-stroke:2px_var(--color-ink)] [paint-order:stroke_fill] md:text-8xl">
            Toot Canal
          </h1>
          <p className="bg-cream border-ink rounded-full border-2 px-4 py-1 text-sm font-bold md:text-base">
            Four beans. One bathtub. No engine.
          </p>
        </header>

        <section aria-label="Levels" className="grid gap-3 md:grid-cols-3">
          {LEVELS.map((level, index) => {
            const record = progress[level.id]
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => onPlay(index)}
                className="bg-cream border-ink shadow-ink hover:bg-mustard/40 flex cursor-pointer flex-col gap-2 rounded-2xl border-[3px] p-4 text-left shadow-[0_5px_0] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
              >
                <span className="font-display text-2xl leading-tight">
                  {level.name}
                </span>
                <span className="text-ink/75 flex-1 text-sm leading-snug">
                  {level.blurb}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <Stars count={record?.stars ?? 0} />
                  <span className="text-sm font-bold tabular-nums">
                    {record
                      ? formatTime(record.bestTime)
                      : 'Par ' + formatTime(level.par)}
                  </span>
                </span>
              </button>
            )
          })}
        </section>

        <section
          aria-label="How to play"
          className="bg-cream border-ink rounded-2xl border-[3px] p-4"
        >
          <h2 className="font-display mb-2 text-xl">
            Grab a corner of the {touchMode ? 'screen' : 'keyboard'}
          </h2>
          <ul
            className={clsx(
              'grid grid-cols-2 gap-x-4 gap-y-2 text-sm',
              !touchMode && 'md:grid-cols-4',
            )}
          >
            {SEATS.map((seat, i) => (
              <li key={seat.key} className="flex items-center gap-2">
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
            {touchMode && 'Hold your corner to blast. '}
            <strong>Rear beans</strong> push forward, <strong>front beans</strong>{' '}
            push back, and a blast from one side turns the tub. Blast within a blink
            of each other for a <strong>harmony</strong>: a bigger shove, gas back,
            and a chord.
            {!touchMode && (
              <>
                {' '}
                Solo? <kbd className="font-bold">←</kbd>{' '}
                <kbd className="font-bold">→</kbd> work the rear and{' '}
                <kbd className="font-bold">↓</kbd> the front. On a touch screen, use
                the corner pads.
              </>
            )}
          </p>
        </section>
      </div>
    </div>
  )
}
