import { clsx } from 'clsx'

import type { Messages } from '../i18n/messages'
import { Panel, PanelButton } from './panel'
import { RichText } from './rich-text'

// Physical like the pads: each callout hangs off its pad toward the middle of the screen,
// and its arrow points back at the pad.
const CALLOUT_POSITIONS = [
  'top-full left-2 mt-3 [--nudge:-0.4rem]',
  'top-full right-2 mt-3 [--nudge:-0.4rem]',
  'bottom-full left-2 mb-3 [--nudge:0.4rem]',
  'bottom-full right-2 mb-3 [--nudge:0.4rem]',
]

const ARROW_POSITIONS = [
  'bottom-full left-5 border-b-ink',
  'bottom-full right-5 border-b-ink',
  'top-full left-5 border-t-ink',
  'top-full right-5 border-t-ink',
]

/** Hangs off a bean's pad while the tutorial is up, saying how to blast with it. */
export function TutorialCallout({
  t,
  seat,
  touchMode,
}: {
  t: Messages
  seat: number
  touchMode: boolean
}) {
  return (
    <span
      dir={t.dir}
      className={clsx(
        'bg-mustard border-ink pointer-events-none absolute flex w-max max-w-40 flex-col rounded-xl border-[3px] px-3 py-1 text-start leading-tight shadow-[0_4px_0] md:max-w-48',
        'motion-safe:animate-nudge',
        CALLOUT_POSITIONS[seat],
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'absolute border-8 border-transparent',
          ARROW_POSITIONS[seat],
        )}
      />
      <span className="font-display text-base md:text-lg">
        <RichText
          text={
            touchMode ? t.tutorial.holdHere : t.tutorial.holdKey(t.seats[seat].key)
          }
        />
      </span>
      <span className="text-xs font-bold md:text-sm">
        {t.tutorial.effects[seat]}
      </span>
    </span>
  )
}

/** Explains the pads over the first race. The pads themselves stay above it to be pressed. */
export function TutorialPanel({
  t,
  touchMode,
  onClose,
}: {
  t: Messages
  touchMode: boolean
  onClose: () => void
}) {
  return (
    <Panel title={t.tutorial.title}>
      <p className="text-center">
        <RichText text={touchMode ? t.tutorial.bodyTouch : t.tutorial.body} />
      </p>
      <PanelButton primary onClick={onClose}>
        {t.tutorial.start}
      </PanelButton>
    </Panel>
  )
}
