import { clsx } from 'clsx'

import { BEAN_COLORS } from '../render/scene'

const CONFETTI_COLORS = [...BEAN_COLORS, '#f2b632', '#d9441f', '#fff4dc']

/** Spread by the golden ratio, so it looks scattered but stays the same between renders. */
const CONFETTI = Array.from({ length: 36 }, (_, i) => {
  const scatter = (i * 0.618) % 1
  return {
    left: `${scatter * 100}%`,
    delay: `${(i % 9) * 0.12}s`,
    duration: `${1.9 + ((i * 7) % 5) * 0.25}s`,
    drift: `${(i % 2 ? 1 : -1) * (1 + (i % 4))}rem`,
    spin: `${(i % 2 ? -1 : 1) * (360 + i * 40)}deg`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    // Every third piece is a bean, the rest are scraps of the can's label.
    bean: i % 3 === 0,
  }
})

function Confetti() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
    >
      {CONFETTI.map((piece, i) => (
        <span
          key={i}
          className={clsx(
            'border-ink animate-confetti absolute top-0 border',
            piece.bean ? 'h-2.5 w-4 rounded-full' : 'h-3.5 w-2',
          )}
          style={
            {
              left: piece.left,
              backgroundColor: piece.color,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              '--drift': piece.drift,
              '--spin': piece.spin,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

export function Panel({
  title,
  celebrate,
  children,
}: {
  title: string
  /** The card pops in under a shower of confetti, for when the group has won. */
  celebrate?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="bg-ink/50 absolute inset-0 flex touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain p-4">
      <dialog
        open
        aria-label={title}
        className={clsx(
          'text-ink bg-cream border-ink shadow-ink static m-auto flex w-full max-w-sm flex-col gap-3 rounded-3xl border-4 p-6 shadow-[0_8px_0]',
          celebrate && 'motion-safe:animate-card-pop',
        )}
      >
        <h2 className="font-display text-sauce text-center text-4xl">{title}</h2>
        {children}
      </dialog>
      {celebrate && <Confetti />}
    </div>
  )
}

export function PanelButton({
  primary,
  disabled,
  onClick,
  children,
}: {
  primary?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'border-ink font-display cursor-pointer rounded-xl border-[3px] px-4 py-2 text-lg disabled:cursor-default disabled:opacity-50',
        primary ? 'bg-mustard' : 'bg-white',
      )}
    >
      {children}
    </button>
  )
}
