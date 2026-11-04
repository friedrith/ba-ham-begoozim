import type { RankId } from '../progress'
import type { ShoutId } from '../shouts'
import type { StickerId } from '../stickers'
import type { AwardId } from '../tally'

export type Locale = 'en' | 'fa'

export type LevelText = { name: string; hint: string }

/** `key` is the letter printed on the physical key that seat uses on this layout. */
export type SeatText = { name: string; key: string }

/**
 * What a link shows when it's pasted into a chat. `headline` and `badge` go on the
 * picture, where Persian only wraps at a `\n` and can't end a line with punctuation.
 */
export type LinkPreviewText = {
  title: string
  description: string
  alt: string
  headline: string
  badge: string
}

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
  linkPreview: { game: LinkPreviewText; invite: LinkPreviewText }
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
    /** Spoken name of the GitHub icon link. */
    sourceCode: string
    /** Spoken name of the Buy Me a Coffee icon link. */
    buyCoffee: string
    /** Spoken name and tooltip of the feedback icon button. */
    feedback: string
  }
  feedback: {
    title: string
    /** Spoken name of the group of kinds. */
    kind: string
    kinds: { bug: string; feature: string; feedback: string }
    message: string
    email: string
    send: string
    sending: string
    cancel: string
    close: string
    sent: string
    failed: string
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
    /** Spoken name of the buttons that shout at the team, and of the one that shows them. */
    shout: string
  }
  /** What online players can shout at each other in a race. Keep them short. */
  shouts: Record<ShoutId, string>
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
    rank: (rank: string) => string
    rankUp: (rank: string) => string
    /** Shown on the button once the picture of the result is ready. */
    share: string
  }
  /** Earned by total stars, lowest first. */
  ranks: Record<RankId, string>
  /** One goes to each bean at the end of a race. `detail` gets the winning score. */
  stickers: {
    /** On the buttons that open the sticker panel. */
    open: string
    title: string
    hint: string
    peel: string
    done: string
    /** Spoken names and tooltips of the stickers. */
    names: Record<StickerId, string>
  }
  awards: Record<AwardId, { title: string; detail: (value: string) => string }>
  online: {
    title: string
    /** How many people are in online rooms right now. */
    playersNow: (count: string) => string
    intro: string
    create: string
    or: string
    joinRoom: string
    join: string
    cancel: string
    codeLabel: string
    connecting: string
    notFound: string
    unreachable: string
    update: string
    full: string
    replaced: string
    backToMenu: string
    room: (code: string) => string
    copyLink: string
    copied: string
    seatsTitle: string
    seatsHint: string
    you: string
    yourName: string
    player: (number: string) => string
    empty: string
    bot: string
    away: string
    botFill: string
    level: string
    start: string
    leave: string
    backToRoom: string
    raceGoesOn: string
    reconnecting: string
    seatLost: (seat: string) => string
  }
  /** Words that pop up on the canvas. */
  fx: {
    toots: readonly string[]
    harmony: string
    ignite: string
    can: string
    respawn: string
    /** Accuses a bean of the wipeout, in turn. Gets the seat's name. */
    blame: readonly ((seat: string) => string)[]
    /** Shown when nobody had blasted for a while before the wipeout. */
    blameNobody: string
    go: string
    smash: string
    skid: string
    soak: string
  }
  /** In seat order: front left, front right, rear left, rear right. */
  seats: readonly [SeatText, SeatText, SeatText, SeatText]
  /** One entry per level in `engine/levels.ts`, by level id. */
  levels: Record<string, LevelText>
}
