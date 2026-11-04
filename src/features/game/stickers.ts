import { SEATS } from './engine/world'

const STORAGE_KEY = 'ba-ham-begoozim:stickers'

export const MAX_STICKERS_PER_BEAN = 3

/** One layer of a sticker, as an SVG path that fits in a box 10 wide centred on the origin. */
export type StickerShape = { d: string; fill: string }

function circle(x: number, y: number, r: number) {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`
}

/** Drawn from paths so that the canvas and the menu's icons show the same thing. */
export const STICKERS = {
  star: [
    {
      d: 'M0 -5L1.5 -1.6L5.2 -1.5L2.3 .8L3.2 4.4L0 2.4L-3.2 4.4L-2.3 .8L-5.2 -1.5L-1.5 -1.6Z',
      fill: '#f2b632',
    },
  ],
  heart: [
    {
      d: 'M0 4.6C-6 .6 -5 -4.4 -2.4 -4.4C-1 -4.4 0 -3.4 0 -2.4C0 -3.4 1 -4.4 2.4 -4.4C5 -4.4 6 .6 0 4.6Z',
      fill: '#e63950',
    },
  ],
  bolt: [{ d: 'M1.6 -5L-3.4 .8H-.4L-1.6 5L3.4 -1H.4Z', fill: '#4c8dff' }],
  flower: [
    {
      d: [0, 1, 2, 3, 4]
        .map((petal) => {
          const angle = (petal * 2 * Math.PI) / 5 - Math.PI / 2
          const x = Math.round(Math.cos(angle) * 28) / 10
          const y = Math.round(Math.sin(angle) * 28) / 10
          return circle(x, y, 2)
        })
        .join(''),
      fill: '#f472b6',
    },
    { d: circle(0, 0, 1.6), fill: '#f2b632' },
  ],
  moon: [{ d: 'M2 -4.8A5 5 0 1 0 2 4.8A3.8 3.8 0 1 1 2 -4.8Z', fill: '#3d405b' }],
  duck: [
    { d: 'M-4.8 .4C-4.8 5 3.8 5 4.6 .6C3 1.4 1 1 -.4 .2Z', fill: '#f2b632' },
    { d: circle(-1, -1.8, 2.6), fill: '#f2b632' },
    { d: 'M-3.2 -2.6L-5.4 -1.4L-3.2 -.8Z', fill: '#e8772e' },
    { d: circle(-1.6, -2.4, 0.6), fill: '#2b1a12' },
  ],
  cloud: [
    {
      d: `${circle(-2.5, 1, 2.4)}${circle(0, -1, 3)}${circle(2.6, 1, 2.3)}`,
      fill: '#8fce5a',
    },
  ],
  can: [
    { d: 'M-3.4 -4.8H3.4V4.8H-3.4Z', fill: '#c9ccd1' },
    { d: 'M-3.4 -2.2H3.4V2.6H-3.4Z', fill: '#d9441f' },
  ],
  drop: [
    {
      d: 'M0 -5C3 -1 4 .6 4 1.6A4 3.4 0 0 1 -4 1.6C-4 .6 -3 -1 0 -5Z',
      fill: '#38bdf8',
    },
  ],
  pizza: [
    { d: 'M0 5L-4.4 -3.4Q0 -5.4 4.4 -3.4Z', fill: '#f2b632' },
    { d: 'M-4.4 -3.4Q0 -5.4 4.4 -3.4L3.7 -2Q0 -3.8 -3.7 -2Z', fill: '#b8692e' },
    { d: `${circle(-1, -0.8, 1)}${circle(1, 1.2, 0.8)}`, fill: '#d9441f' },
  ],
} satisfies Record<string, StickerShape[]>

export type StickerId = keyof typeof STICKERS

export const STICKER_IDS = Object.keys(STICKERS) as StickerId[]

/** Where a bean's stickers go, in the order they're added, clear of its eyes and mouth. */
export const STICKER_SPOTS = [
  { x: -10.5, y: 3.5, degrees: -12 },
  { x: 10.5, y: 3.5, degrees: 12 },
  { x: 0, y: -12.8, degrees: -6 },
]
export const STICKER_SCALE = 0.7
/** The white paper edge around a sticker, in the sticker's own units. */
export const STICKER_EDGE = 2.6

/** One list per seat. */
export type BeanStickers = StickerId[][]

export function noStickers(): BeanStickers {
  return SEATS.map(() => [])
}

/** Storage and rooms can hold anything, so only what the game can draw gets through. */
export function normalizeStickers(raw: unknown): BeanStickers {
  return SEATS.map((_, seat) => {
    const list = Array.isArray(raw) ? (raw as unknown[])[seat] : null
    if (!Array.isArray(list)) return []
    const known = (list as unknown[]).filter(
      (id): id is StickerId =>
        typeof id === 'string' && Object.hasOwn(STICKERS, id),
    )
    return [...new Set(known)].slice(0, MAX_STICKERS_PER_BEAN)
  })
}

/** Puts a sticker on the bean or peels it off. A full bean takes no more. */
export function toggleSticker(
  stickers: BeanStickers,
  seat: number,
  id: StickerId,
): BeanStickers {
  return stickers.map((list, i) => {
    if (i !== seat) return list
    if (list.includes(id)) return list.filter((other) => other !== id)
    return list.length < MAX_STICKERS_PER_BEAN ? [...list, id] : list
  })
}

export function loadStickers(): BeanStickers {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeStickers(JSON.parse(raw)) : noStickers()
  } catch {
    return noStickers()
  }
}

export function saveStickers(stickers: BeanStickers) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stickers))
  } catch {
    // Private windows can refuse storage. The stickers just last until the page closes.
  }
}
