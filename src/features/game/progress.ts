const STORAGE_KEY = 'toot-canal:progress'

export type LevelRecord = { stars: number; bestTime: number }
export type Progress = Record<string, LevelRecord>

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
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

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`
}
