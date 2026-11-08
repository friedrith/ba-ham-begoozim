import type { Progress } from './progress'

const STORAGE_KEY = 'ba-ham-begoozim:tutorial-seen'

/**
 * Whether the first race should open on the tutorial. Players who have finished a level
 * before it existed already know where to press, so their progress counts as having seen it.
 */
export function needsTutorial(seen: boolean, progress: Progress) {
  return !seen && Object.keys(progress).length === 0
}

export function loadTutorialSeen() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    // Storage can be refused. Better to show it again than never.
    return false
  }
}

export function saveTutorialSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Private windows can refuse storage. The tutorial will just show again next time.
  }
}
