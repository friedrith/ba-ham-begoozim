import type { GameEvent } from './engine/world'

/** A wipeout this long after the last blast is nobody's fault, or everybody's. */
const BLAME_WINDOW = 4

export type SeatTally = {
  blasts: number
  harmonies: number
  /** Presses on an empty tank, and holds that ran out. */
  dry: number
  heldSeconds: number
  blamed: number
  lastBlast: number
  holdStart: number | null
}

/**
 * Who did what in a race. Built from the event stream rather than kept in `World`, so the
 * snapshots stay small and the room service doesn't change. Online it has to be fed the
 * room's events, because each device plays its own blasts before the room confirms them.
 */
export type Tally = {
  seats: SeatTally[]
  /** The bean to blame for the latest wipeout, or null if nobody was blasting. */
  lastBlame: number | null
}

export type AwardId =
  | 'suspect'
  | 'fumes'
  | 'guzzler'
  | 'choir'
  | 'trigger'
  | 'passenger'
  | 'alsoThere'

export type Award = { id: AwardId; value: number }

export function createTally(): Tally {
  return {
    seats: Array.from({ length: 4 }, () => ({
      blasts: 0,
      harmonies: 0,
      dry: 0,
      heldSeconds: 0,
      blamed: 0,
      lastBlast: -Infinity,
      holdStart: null,
    })),
    lastBlame: null,
  }
}

function endHold(seat: SeatTally, clock: number) {
  if (seat.holdStart === null) return
  seat.heldSeconds += clock - seat.holdStart
  seat.holdStart = null
}

export function tallyEvent(tally: Tally, event: GameEvent, clock: number) {
  switch (event.type) {
    case 'blast': {
      const seat = tally.seats[event.seat]
      seat.blasts++
      if (event.harmony) seat.harmonies++
      seat.lastBlast = clock
      seat.holdStart = clock
      break
    }
    case 'release':
      endHold(tally.seats[event.seat], clock)
      break
    case 'empty':
      tally.seats[event.seat].dry++
      break
    case 'respawn': {
      let latest = clock - BLAME_WINDOW
      tally.lastBlame = null
      tally.seats.forEach((seat, i) => {
        if (seat.lastBlast > latest) {
          latest = seat.lastBlast
          tally.lastBlame = i
        }
      })
      if (tally.lastBlame !== null) tally.seats[tally.lastBlame].blamed++
      break
    }
    case 'finish':
      for (const seat of tally.seats) endHold(seat, clock)
      break
    default:
      break
  }
}

/** Earlier awards are the better jokes, so they go out first. */
const CONTESTS: { id: AwardId; score: (seat: SeatTally) => number }[] = [
  { id: 'suspect', score: (seat) => seat.blamed },
  { id: 'fumes', score: (seat) => seat.dry },
  { id: 'guzzler', score: (seat) => Math.round(seat.heldSeconds * 10) / 10 },
  { id: 'choir', score: (seat) => seat.harmonies },
  { id: 'trigger', score: (seat) => seat.blasts },
]

/** One award per bean, in seat order. Nobody wins a contest with a score of nothing. */
export function awardsFor(tally: Tally): Award[] {
  const awards: (Award | null)[] = tally.seats.map(() => null)
  for (const { id, score } of CONTESTS) {
    let winner = -1
    let best = 0
    tally.seats.forEach((seat, i) => {
      if (!awards[i] && score(seat) > best) {
        best = score(seat)
        winner = i
      }
    })
    if (winner >= 0) awards[winner] = { id, value: best }
  }
  const idle = tally.seats.findIndex((seat, i) => !awards[i] && seat.blasts === 0)
  if (idle >= 0) awards[idle] = { id: 'passenger', value: 0 }
  return awards.map((award) => award ?? { id: 'alsoThere', value: 0 })
}
