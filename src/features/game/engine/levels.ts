import type { ControlPoint } from './course'

export type Theme = 'tile' | 'brick' | 'iron'

export type LevelItem =
  | { kind: 'can'; at: number; offset?: number }
  | { kind: 'urchin'; at: number; offset?: number; orbit?: number; speed?: number }
  | { kind: 'whirl'; at: number; offset?: number; radius: number; pull: number }
  | { kind: 'gate'; at: number; period: number; phase?: number }
  | { kind: 'paddle'; at: number; offset?: number; length: number; speed: number }
  | { kind: 'current'; from: number; to: number; strength: number }
  | { kind: 'flame'; at: number; offset?: number }

export type LevelDef = {
  /** Also the key for this level's name, blurb and hint in `i18n/en.ts` and `i18n/fa.ts`. */
  id: string
  theme: Theme
  /** Seconds to beat for the time star. */
  par: number
  path: readonly ControlPoint[]
  /** Fractions along the course where the tub respawns after a wipeout. */
  checkpoints: readonly number[]
  items: readonly LevelItem[]
}

export const LEVELS: readonly LevelDef[] = [
  {
    id: 'bathwater-bend',
    theme: 'tile',
    par: 45,
    path: [
      [0, 0, 200],
      [0, -500, 200],
      [200, -1000, 190],
      [650, -1350, 180],
      [1150, -1500, 170],
      [1550, -1900, 170],
      [1500, -2450, 170],
      [1050, -2800, 165],
      [600, -3050, 160],
      [350, -3550, 160],
      [550, -4050, 165],
      [1000, -4350, 170],
      [1200, -4800, 190],
      [1200, -5300, 210],
    ],
    checkpoints: [0.33, 0.66],
    items: [
      { kind: 'can', at: 0.07 },
      { kind: 'can', at: 0.14, offset: 0.5 },
      { kind: 'can', at: 0.24, offset: -0.5 },
      { kind: 'can', at: 0.38, offset: 0.55 },
      { kind: 'can', at: 0.5, offset: -0.55 },
      { kind: 'can', at: 0.62 },
      { kind: 'can', at: 0.76, offset: 0.55 },
      { kind: 'can', at: 0.9, offset: -0.5 },
      { kind: 'current', from: 0.44, to: 0.56, strength: 70 },
      { kind: 'urchin', at: 0.27, offset: 0.6 },
      { kind: 'urchin', at: 0.78, offset: -0.6 },
    ],
  },
  {
    id: 'storm-drain',
    theme: 'brick',
    par: 75,
    path: [
      [0, 0, 190],
      [0, -450, 180],
      [-300, -900, 170],
      [-300, -1450, 170],
      [100, -1900, 160],
      [600, -2100, 160],
      [1100, -2050, 170],
      [1500, -2400, 160],
      [1500, -2950, 165],
      [1100, -3350, 160],
      [600, -3450, 160],
      [200, -3800, 150],
      [200, -4350, 170],
      [500, -4800, 165],
      [900, -5100, 165],
      [900, -5700, 190],
    ],
    checkpoints: [0.25, 0.5, 0.75],
    items: [
      { kind: 'can', at: 0.06, offset: -0.5 },
      { kind: 'gate', at: 0.13, period: 5 },
      { kind: 'can', at: 0.2, offset: 0.5 },
      { kind: 'current', from: 0.28, to: 0.4, strength: -90 },
      { kind: 'can', at: 0.34, offset: -0.6 },
      { kind: 'paddle', at: 0.44, length: 105, speed: 1.1 },
      { kind: 'can', at: 0.47, offset: 0.6 },
      { kind: 'gate', at: 0.57, period: 4.4, phase: 1.5 },
      { kind: 'urchin', at: 0.63, offset: 0.5, orbit: 45, speed: 1.4 },
      { kind: 'can', at: 0.66, offset: -0.55 },
      { kind: 'paddle', at: 0.71, offset: -0.2, length: 95, speed: -1.3 },
      { kind: 'current', from: 0.78, to: 0.88, strength: 110 },
      { kind: 'can', at: 0.83, offset: 0.55 },
      { kind: 'gate', at: 0.92, period: 3.8 },
    ],
  },
  {
    id: 'boiler-room',
    theme: 'iron',
    par: 50,
    path: [
      [0, 0, 180],
      [250, -450, 170],
      [750, -650, 165],
      [1200, -950, 165],
      [1250, -1500, 170],
      [800, -1850, 160],
      [300, -2000, 160],
      [-100, -2400, 160],
      [-50, -2950, 170],
      [400, -3300, 165],
      [950, -3350, 165],
      [1400, -3700, 160],
      [1400, -4250, 170],
      [950, -4650, 160],
      [450, -4750, 165],
      [100, -5150, 170],
      [100, -5700, 190],
    ],
    checkpoints: [0.25, 0.5, 0.75],
    items: [
      { kind: 'flame', at: 0.05 },
      { kind: 'can', at: 0.09, offset: 0.5 },
      { kind: 'whirl', at: 0.15, offset: -0.6, radius: 130, pull: 150 },
      { kind: 'can', at: 0.19, offset: 0.6 },
      { kind: 'gate', at: 0.31, period: 4.6 },
      { kind: 'flame', at: 0.36, offset: -0.3 },
      { kind: 'urchin', at: 0.41, offset: 0.4, orbit: 50, speed: -1.6 },
      { kind: 'can', at: 0.45, offset: -0.55 },
      { kind: 'whirl', at: 0.56, offset: 0.6, radius: 130, pull: 170 },
      { kind: 'can', at: 0.6, offset: -0.6 },
      { kind: 'paddle', at: 0.68, length: 100, speed: 1.5 },
      { kind: 'current', from: 0.77, to: 0.85, strength: -80 },
      { kind: 'flame', at: 0.8, offset: 0.3 },
      { kind: 'can', at: 0.83, offset: -0.55 },
      { kind: 'whirl', at: 0.9, offset: -0.6, radius: 125, pull: 170 },
      { kind: 'can', at: 0.95, offset: 0.55 },
    ],
  },
]
