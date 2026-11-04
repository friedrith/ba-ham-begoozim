import { LEVELS } from '../game/engine/levels'
import { SNAPSHOT_LAYOUT, type Snapshot } from '../game/engine/snapshot'
import type { GameEvent } from '../game/engine/world'
import { isShoutId, SHOUT_IDS, type ShoutId } from '../game/shouts'
import { STICKER_IDS, type StickerId } from '../game/stickers'

/** Bump when messages change in a way the derived part below can't see. */
const PROTOCOL_VERSION = 3

function hash(text: string) {
  let value = 5381
  for (let i = 0; i < text.length; i++) {
    value = (value * 33 + text.charCodeAt(i)) >>> 0
  }
  return value.toString(36)
}

/**
 * The game and the room service deploy separately, so for a moment they can disagree.
 * Levels are part of this because a snapshot's length depends on what a level contains.
 * Stickers are because a client can't draw one it has never heard of, and shouts because
 * it can't say one.
 */
export const PROTOCOL = `${PROTOCOL_VERSION}-${hash(
  SNAPSHOT_LAYOUT + JSON.stringify(LEVELS) + STICKER_IDS.join() + SHOUT_IDS.join(),
)}`

export const MAX_MESSAGE_LENGTH = 512

export const MAX_NAME_LENGTH = 16

/** Sent as plain text and answered by the host without waking a hibernating room. */
export const HEARTBEAT = 'hb'

export type SeatStatus = 'here' | 'away' | 'bot' | 'free'

export type SeatView = {
  owner: number | null
  status: SeatStatus
  /** What the owner calls themselves, if they've said. */
  name?: string
  /** What the owner stuck on this bean, if anything. */
  stickers?: StickerId[]
}

export type RoomView = {
  code: string
  you: number
  phase: 'lobby' | 'race'
  level: string
  /** Changes every time a level starts, including a restart of the same one. */
  raceId: number
  bots: boolean
  seats: SeatView[]
}

export type ClientMessage =
  | { t: 'hello'; protocol: string; token: string }
  | { t: 'ping'; c: number }
  | { t: 'seat'; seat: number; take: boolean }
  /** A seat being pressed or released. `at` is when it happened, on the room's clock. */
  | { t: 'in'; seat: number; on: boolean; at: number }
  | { t: 'start'; level: string }
  | { t: 'lobby' }
  | { t: 'bots'; on: boolean }
  | { t: 'leave' }
  | { t: 'name'; name: string }
  /** One list per seat. Each only shows while its sender owns that seat. */
  | { t: 'stickers'; stickers: StickerId[][] }
  | { t: 'shout'; id: ShoutId }

export type ServerMessage =
  /** `g` is the room's largest gap between ticks over the last second, in ms. */
  | { t: 'pong'; c: number; s: number; g: number }
  | ({ t: 'room' } & RoomView)
  | { t: 'snap'; s: number; w: Snapshot; ev: GameEvent[] }
  /** `from` is the player's number, as in `SeatView.owner`. */
  | { t: 'shout'; from: number; id: ShoutId }
  | { t: 'error'; code: RoomError }

export type RoomError = 'update' | 'full' | 'missing' | 'replaced'

/** Close codes. Clients reconnect after anything other than these. */
export const CLOSE_CODES: Record<RoomError, number> = {
  update: 4000,
  full: 4001,
  missing: 4002,
  replaced: 4003,
}
export const CLOSE_ABUSE = 4004

/**
 * Keeps the joiners Persian spelling and emoji need, but not the invisible characters
 * that could reverse the text around a name on someone else's screen.
 */
export function normalizeName(text: string) {
  const clean = text
    .replace(/\s+/g, ' ')
    .replace(/(?![\u200C\u200D])\p{C}/gu, '')
    .trim()
  return Array.from(clean).slice(0, MAX_NAME_LENGTH).join('').trim()
}

const isSeat = (value: unknown) =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) < 4

/** Rooms take anything off the internet, so nothing is trusted until it passes here. */
export function parseClientMessage(text: string): ClientMessage | null {
  if (text.length > MAX_MESSAGE_LENGTH) return null
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const message = raw as Record<string, unknown>
  switch (message.t) {
    case 'hello':
      return typeof message.protocol === 'string' &&
        typeof message.token === 'string' &&
        message.token.length >= 16 &&
        message.token.length <= 64
        ? (message as ClientMessage)
        : null
    case 'ping':
      return Number.isFinite(message.c) ? (message as ClientMessage) : null
    case 'seat':
      return isSeat(message.seat) && typeof message.take === 'boolean'
        ? (message as ClientMessage)
        : null
    case 'in':
      return isSeat(message.seat) &&
        typeof message.on === 'boolean' &&
        Number.isFinite(message.at)
        ? (message as ClientMessage)
        : null
    case 'start':
      return typeof message.level === 'string' ? (message as ClientMessage) : null
    case 'bots':
      return typeof message.on === 'boolean' ? (message as ClientMessage) : null
    case 'name':
      return typeof message.name === 'string' ? (message as ClientMessage) : null
    case 'stickers':
      return Array.isArray(message.stickers) ? (message as ClientMessage) : null
    case 'shout':
      return isShoutId(message.id) ? (message as ClientMessage) : null
    case 'lobby':
    case 'leave':
      return message as ClientMessage
    default:
      return null
  }
}
