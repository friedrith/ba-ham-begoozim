import { ImageResponse } from 'next/og'

import { SEATS } from '@/features/game/engine/world'
import { en } from '@/features/game/i18n/en'
import { BEAN_COLORS } from '@/features/game/render/scene'

export const alt =
  'Four baked beans in a clawfoot bathtub, blasting their way down a canal.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const SLOGAN = 'Become the Fart King!'

const INK = '#2b1a12'
const CREAM = '#fff4dc'
const SAUCE = '#d9441f'
const GOLD = '#d9a441'
const GAS = '#8fbf3a'
const BANK = '#f6efe2'
const BANK_LINE = '#d9cfbb'
const WATER = '#37c1c7'
const WATER_DEEP = '#22a3ae'

const RIPPLES = [
  [640, 70],
  [960, 44],
  [1090, 210],
  [610, 300],
  [1110, 420],
  [650, 560],
  [930, 590],
]

// Rear seats are mid-blast, with their gas trailing behind the tub.
const PUFFS = [
  [-30, 70, 10],
  [-42, 84, 14],
  [-30, 98, 9],
  [-52, 104, 8],
  [30, 70, 10],
  [42, 82, 12],
  [32, 98, 14],
  [52, 100, 7],
]

/** Only the glyphs we draw, as a TTF because the image renderer can't read WOFF2. */
async function loadFont(family: string, text: string) {
  const query = `family=${family}&text=${encodeURIComponent(text)}`
  const css = await fetch(`https://fonts.googleapis.com/css2?${query}`).then(
    (response) => response.text(),
  )
  const url = css.match(/src: url\((.+?)\) format\('truetype'\)/)?.[1]
  if (!url) throw new Error(`No TTF for font ${family}`)
  return fetch(url).then((response) => response.arrayBuffer())
}

function Scene() {
  return (
    <svg
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      <rect width={size.width} height={size.height} fill={WATER} />
      {RIPPLES.map(([x, y]) => (
        <path
          key={`${x}-${y}`}
          d={`M${x} ${y}q22 -14 44 0t44 0`}
          fill="none"
          stroke={WATER_DEEP}
          strokeWidth="7"
          strokeLinecap="round"
        />
      ))}

      <path
        d="M-20 -20H640C590 110 690 210 640 320C590 430 680 520 630 650H-20Z"
        fill={BANK}
        stroke={BANK_LINE}
        strokeWidth="14"
      />

      <g transform="translate(925 262) rotate(14) scale(3.1)">
        {PUFFS.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={GAS} opacity="0.85" />
        ))}

        <rect x="-36" y="-58" width="72" height="124" rx="30" fill="#0003" />
        {[
          [-34, -40],
          [34, -40],
          [-34, 40],
          [34, 40],
        ].map(([x, y]) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r="8"
            fill={GOLD}
            stroke={INK}
            strokeWidth="3"
          />
        ))}
        <rect
          x="-34"
          y="-62"
          width="68"
          height="124"
          rx="30"
          fill="#fffdf7"
          stroke={INK}
          strokeWidth="4"
        />
        <rect
          x="-26"
          y="-54"
          width="52"
          height="108"
          rx="22"
          fill="#9fe3e0"
          stroke={INK}
          strokeWidth="2.5"
        />
        <rect
          x="-11"
          y="-60"
          width="22"
          height="8"
          rx="3"
          fill={GOLD}
          stroke={INK}
          strokeWidth="2.5"
        />
        {[-11, 11].map((x) => (
          <circle
            key={x}
            cx={x}
            cy="-56"
            r="4"
            fill={GOLD}
            stroke={INK}
            strokeWidth="2.5"
          />
        ))}

        {SEATS.map((seat, i) => {
          const blasting = seat.ly < 0
          return (
            <g key={i} transform={`translate(${seat.lx * 0.8} ${-seat.ly * 0.92})`}>
              <path
                d="M-14-3C-18-20 18-20 14-3C19 12 8 18 3 11C1 8-1 8-3 11C-8 18-19 12-14-3Z"
                fill={BEAN_COLORS[i]}
                stroke={INK}
                strokeWidth="3"
              />
              <ellipse cx="-7" cy="-10" rx="4" ry="2.4" fill="#fff" opacity="0.4" />
              {[-6, 6].map((x) => (
                <g key={x}>
                  <circle cx={x} cy="-6" r={blasting ? 5.6 : 4.6} fill="#fff" />
                  <circle cx={x} cy="-7.5" r="2.2" fill={INK} />
                </g>
              ))}
              {blasting ? (
                <ellipse cx="0" cy="3" rx="4.5" ry="5.5" fill={INK} />
              ) : (
                <path
                  d="M-5 2Q0 8 5 2"
                  fill="none"
                  stroke={INK}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

export default async function OpengraphImage() {
  const [display, sans] = await Promise.all([
    loadFont('Bagel+Fat+One', en.menuTitle),
    loadFont('Nunito:wght@800', SLOGAN),
  ])

  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <Scene />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: 32,
          width: 600,
          height: '100%',
          paddingLeft: 56,
        }}
      >
        <div
          style={{
            width: 520,
            fontFamily: 'Bagel Fat One',
            fontSize: 118,
            lineHeight: 1.02,
            color: SAUCE,
            WebkitTextStroke: `3px ${INK}`,
          }}
        >
          {en.menuTitle}
        </div>
        <div
          style={{
            padding: '10px 24px',
            fontFamily: 'Nunito',
            fontSize: 36,
            whiteSpace: 'nowrap',
            color: INK,
            backgroundColor: CREAM,
            border: `4px solid ${INK}`,
            borderRadius: 999,
          }}
        >
          {SLOGAN}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Bagel Fat One', data: display, weight: 400 },
        { name: 'Nunito', data: sans, weight: 800 },
      ],
    },
  )
}
