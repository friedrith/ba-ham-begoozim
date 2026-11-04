import { BEAN_COLORS } from '../render/scene'

type BeanFaceProps = {
  seat: number
  className?: string
}

/** The in-game bean as an icon, for the menu and the seat pads. */
export function BeanFace({ seat, className }: BeanFaceProps) {
  return (
    <svg viewBox="-22 -22 44 44" className={className} aria-hidden="true">
      <path
        d="M-14-3C-18-20 18-20 14-3C19 12 8 18 3 11C1 8-1 8-3 11C-8 18-19 12-14-3Z"
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
