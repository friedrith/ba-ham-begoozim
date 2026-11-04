export type Locale = 'en' | 'fa'

export type LevelText = { name: string; blurb: string; hint: string }

/** `key` is the letter printed on the physical key that seat uses on this layout. */
export type SeatText = { name: string; key: string }

/**
 * Everything a player can read. Numbers reach these strings already localized, so a
 * function's arguments are always strings. Text passed to `RichText` may use
 * `**strong**` and `` `key` ``.
 */
export type Messages = {
  locale: Locale
  dir: 'ltr' | 'rtl'
  /** The language's own name, shown on the switcher when it is the other language. */
  languageName: string
  /** Shown on the browser tab. */
  title: string
  menuTitle: string
  tagline: string
  menu: {
    levels: string
    howToPlay: string
    howToPlayTitle: string
    howToPlayTitleTouch: string
    howToPlayBody: string
    /** Added to the body on the keyboard layout only. */
    howToPlaySolo: string
    stars: (count: string) => string
    par: (time: string) => string
    best: (time: string) => string
    play: string
    previousLevel: string
    nextLevel: string
    /** `count` is already written as position out of the total, like 3/12. */
    levelCount: (count: string) => string
    /** `count` is already written as stars out of the total, like 3/36. */
    totalStars: (count: string) => string
  }
  hud: {
    time: string
    cans: string
    mute: string
    unmute: string
    restartLevel: string
    pause: string
    seatPad: (seat: SeatText) => string
    seatPadTouch: (seat: SeatText) => string
    /** Shown before the level hint and the menu instructions in touch mode. */
    holdCorner: string
  }
  paused: { title: string; resume: string; restart: string; menu: string }
  result: {
    title: string
    time: (par: string) => string
    cans: string
    harmonies: string
    wipeouts: string
    nextLevel: string
    again: string
    menu: string
  }
  /** Words that pop up on the canvas. */
  fx: {
    toots: readonly string[]
    harmony: string
    ignite: string
    can: string
    respawn: string
    go: string
    smash: string
    skid: string
  }
  /** In seat order: front left, front right, rear left, rear right. */
  seats: readonly [SeatText, SeatText, SeatText, SeatText]
  /** One entry per level in `engine/levels.ts`, by level id. */
  levels: Record<string, LevelText>
}
