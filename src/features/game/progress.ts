import { LEVELS } from './engine/levels'

const STORAGE_KEY = 'ba-ham-begoozim:progress'
// Saves from before the rename. Read as a fallback so players keep their stars.
const LEGACY_STORAGE_KEY = 'toot-canal:progress'

export type LevelRecord = { stars: number; bestTime: number }
export type Progress = Record<string, LevelRecord>

export const MAX_STARS = LEVELS.length * 3

export type RankId = 'squeak' | 'regular' | 'menace' | 'duke' | 'king'

/** In rising order. The crown takes every star in the game, however many levels get added. */
const RANKS: { id: RankId; stars: number }[] = [
  { id: 'squeak', stars: 0 },
  { id: 'regular', stars: Math.ceil(MAX_STARS / 4) },
  { id: 'menace', stars: Math.ceil(MAX_STARS / 2) },
  { id: 'duke', stars: Math.ceil((MAX_STARS * 3) / 4) },
  { id: 'king', stars: MAX_STARS },
]

export function totalStars(progress: Progress) {
  return LEVELS.reduce((total, { id }) => total + (progress[id]?.stars ?? 0), 0)
}

/** The trophy asks for every level finished, however badly. The crown asks for more. */
export function hasTrophy(progress: Progress) {
  return LEVELS.every(({ id }) => progress[id])
}

export function rankFor(stars: number): RankId {
  return RANKS.findLast((rank) => stars >= rank.stars)?.id ?? 'squeak'
}

export function loadProgress(): Progress {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Progress) : {}
  } catch {
    return {}
  }
}

export function recordRun(id: string, stars: number, time: number): Progress {
  const progress = loadProgress()
  const previous = progress[id]
  progress[id] = {
    stars: Math.max(stars, previous?.stars ?? 0),
    bestTime: Math.min(time, previous?.bestTime ?? Infinity),
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Private windows can refuse storage. The game still plays, it just won't remember.
  }
  return progress
}
