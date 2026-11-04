import { clsx } from 'clsx'

import { BEAN_COLORS, BEAN_ICON_PATH } from '../render/scene'

type BeanFaceProps = {
  seat: number
  className?: string
  /** Arms up for a Persian dance: swaying hips, swaying arms, twirling wrists. */
  dance?: boolean
}

/** One raised arm, with `side` -1 for the left and 1 for the right. */
function DancingArm({
  seat,
  side,
  delay,
}: {
  seat: number
  side: -1 | 1
  delay: string
}) {
  return (
    <g
      className="motion-safe:animate-arm-sway"
      style={{ transformOrigin: `${side * 13}px 0px`, animationDelay: delay }}
    >
      <path
        d={`M${side * 13} 0Q${side * 21} -4 ${side * 20} -14`}
        fill="none"
        stroke="#2b1a12"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse
        className="motion-safe:animate-wrist-twirl"
        style={{
          transformOrigin: `${side * 20}px -14px`,
          animationDelay: delay,
          animationDirection: side < 0 ? 'reverse' : 'normal',
        }}
        cx={side * 20}
        cy="-18"
        rx="2.8"
        ry="4.2"
        fill={BEAN_COLORS[seat]}
        stroke="#2b1a12"
        strokeWidth="1.6"
      />
    </g>
  )
}

/** The in-game bean as an icon, for the menu and the seat pads. */
export function BeanFace({ seat, className, dance }: BeanFaceProps) {
  // Each bean joins in just after the one before, once the card has landed.
  const delay = `${1 + seat * 0.15}s`
  return (
    <svg
      viewBox="-22 -22 44 44"
      className={clsx(
        className,
        dance && 'motion-safe:animate-bean-sway overflow-visible',
      )}
      style={dance ? { animationDelay: delay } : undefined}
      aria-hidden="true"
    >
      {dance && (
        <>
          <DancingArm seat={seat} side={-1} delay={delay} />
          <DancingArm seat={seat} side={1} delay={delay} />
        </>
      )}
      <path
        d={BEAN_ICON_PATH}
        fill={BEAN_COLORS[seat]}
        stroke="#2b1a12"
        strokeWidth="3"
      />
      <ellipse cx="-7" cy="-10" rx="4" ry="2.4" fill="#fff" opacity="0.4" />
      <circle cx="-6" cy="-6" r="4.6" fill="#fff" />
      <circle cx="6" cy="-6" r="4.6" fill="#fff" />
      <circle cx="-6" cy="-7.5" r="2.2" fill="#2b1a12" />
      <circle cx="6" cy="-7.5" r="2.2" fill="#2b1a12" />
      <path
        d="M-5 2Q0 8 5 2"
        fill="none"
        stroke="#2b1a12"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
