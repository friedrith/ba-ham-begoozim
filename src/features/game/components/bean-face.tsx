import { BEAN_COLORS, BEAN_ICON_PATH } from '../render/scene'
import {
  STICKER_EDGE,
  STICKER_SCALE,
  STICKER_SPOTS,
  STICKERS,
  type StickerId,
} from '../stickers'

type BeanFaceProps = {
  seat: number
  stickers?: StickerId[]
  className?: string
}

/** A sticker's paper edge, then its picture on top. */
function StickerShapes({ id }: { id: StickerId }) {
  const shapes = STICKERS[id]
  return (
    <>
      {shapes.map(({ d }) => (
        <path
          key={d}
          d={d}
          fill="#fff"
          stroke="#fff"
          strokeWidth={STICKER_EDGE}
          strokeLinejoin="round"
        />
      ))}
      {shapes.map(({ d, fill }) => (
        <path key={d} d={d} fill={fill} />
      ))}
    </>
  )
}

/** A sticker on its own, for the picker. */
export function StickerIcon({
  id,
  className,
}: {
  id: StickerId
  className?: string
}) {
  return (
    <svg viewBox="-7 -7 14 14" className={className} aria-hidden="true">
      <StickerShapes id={id} />
    </svg>
  )
}

/** The in-game bean as an icon, for the menu and the seat pads. */
export function BeanFace({ seat, stickers, className }: BeanFaceProps) {
  return (
    <svg viewBox="-22 -22 44 44" className={className} aria-hidden="true">
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
      {stickers?.map((id, i) => {
        const { x, y, degrees } = STICKER_SPOTS[i]
        return (
          <g
            key={id}
            transform={`translate(${x} ${y}) rotate(${degrees}) scale(${STICKER_SCALE})`}
          >
            <StickerShapes id={id} />
          </g>
        )
      })}
    </svg>
  )
}
