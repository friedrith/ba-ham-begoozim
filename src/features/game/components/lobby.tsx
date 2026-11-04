import { clsx } from 'clsx'
import { useEffect, useState } from 'react'

import {
  MAX_NAME_LENGTH,
  normalizeName,
  type SeatView,
  type RoomView,
} from '../../online/protocol'
import type { OnlineSession, SessionError } from '../../online/session'
import { LEVELS } from '../engine/levels'
import { formatNumber, setLinkLocale, type Messages } from '../i18n'
import { BeanFace } from './bean-face'
import { Panel, PanelButton } from './panel'

const COPIED_MS = 2000
const NAME_KEY = 'ba-ham-begoozim:player-name'

export function loadPlayerName() {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function savePlayerName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name)
  } catch {
    // Private windows can refuse storage. The name still lasts as long as the room.
  }
}

/** What to call whoever is in a seat. */
export function seatLabel(t: Messages, seat: SeatView, you: number) {
  if (seat.owner === you) return t.online.you
  if (seat.status === 'bot') return t.online.bot
  if (seat.status === 'free') return t.online.empty
  if (seat.status === 'away') return t.online.away
  return seat.name ?? t.online.player(formatNumber(seat.owner ?? 0, t.locale))
}

export function sessionErrorText(t: Messages, error: SessionError) {
  switch (error) {
    case 'missing':
      return t.online.notFound
    case 'unreachable':
      return t.online.unreachable
    case 'update':
      return t.online.update
    case 'full':
      return t.online.full
    case 'replaced':
      return t.online.replaced
    default:
      return t.online.unreachable
  }
}

/** Sent as it's typed, so a race starting mid-word doesn't lose it. */
export function NameField({
  t,
  you,
  session,
}: {
  t: Messages
  you: number
  session: OnlineSession
}) {
  const [draft, setDraft] = useState(session.getName)

  return (
    <label className="flex items-center gap-2 text-sm font-bold">
      {t.online.yourName}
      <input
        dir="auto"
        autoComplete="off"
        enterKeyHint="done"
        maxLength={MAX_NAME_LENGTH}
        placeholder={t.online.player(formatNumber(you, t.locale))}
        value={draft}
        onChange={(event) => {
          const name = normalizeName(event.target.value)
          setDraft(event.target.value)
          savePlayerName(name)
          session.setName(name)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className="border-ink placeholder:text-ink/50 w-full min-w-0 flex-1 rounded-xl border-[3px] bg-white px-2 py-1 text-base select-text placeholder:font-normal"
      />
    </label>
  )
}

export function Lobby({
  t,
  room,
  session,
  onStickers,
  onLeave,
}: {
  t: Messages
  /** Null until the room has answered. */
  room: RoomView | null
  session: OnlineSession
  onStickers: () => void
  onLeave: () => void
}) {
  if (!room) {
    return (
      <Panel title={t.online.title}>
        <p className="text-center font-bold">{t.online.connecting}</p>
        <PanelButton onClick={onLeave}>{t.online.backToMenu}</PanelButton>
      </Panel>
    )
  }
  // Keyed so that the level picker follows whatever the room last played.
  return (
    <RoomPanel
      key={room.level}
      t={t}
      room={room}
      session={session}
      onStickers={onStickers}
      onLeave={onLeave}
    />
  )
}

function RoomPanel({
  t,
  room,
  session,
  onStickers,
  onLeave,
}: {
  t: Messages
  room: RoomView
  session: OnlineSession
  onStickers: () => void
  onLeave: () => void
}) {
  const [level, setLevel] = useState(room.level)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const copyLink = async () => {
    const link = new URL(window.location.href)
    link.search = `?room=${room.code}`
    setLinkLocale(link, t.locale)
    try {
      await navigator.clipboard.writeText(link.href)
      setCopied(true)
    } catch {
      // The code is on screen, so there's still a way to share the room.
    }
  }

  const canStart = room.bots || room.seats.some((seat) => seat.owner !== null)

  return (
    <Panel title={t.online.room(formatNumber(room.code, t.locale))}>
      <PanelButton onClick={() => void copyLink()}>
        {copied ? t.online.copied : t.online.copyLink}
      </PanelButton>

      <NameField t={t} you={room.you} session={session} />

      <section aria-label={t.online.seatsTitle} className="flex flex-col gap-2">
        <div>
          <h3 className="font-display text-xl">{t.online.seatsTitle}</h3>
          <p className="text-ink/80 text-sm leading-snug">{t.online.seatsHint}</p>
        </div>
        {/* Laid out like the corners, so left-hand seats stay on the left in Persian. */}
        <ul dir="ltr" className="grid grid-cols-2 gap-2">
          {room.seats.map((seat, i) => {
            const mine = seat.owner === room.you
            const taken =
              !mine && (seat.status === 'here' || seat.status === 'away')
            return (
              <li key={i}>
                <button
                  type="button"
                  dir={t.dir}
                  disabled={taken}
                  aria-pressed={mine}
                  onClick={() => session.toggleSeat(i)}
                  className={clsx(
                    'border-ink flex w-full cursor-pointer items-center gap-2 rounded-xl border-[3px] p-2 text-start disabled:cursor-default',
                    mine ? 'bg-mustard' : 'bg-white',
                    taken && 'opacity-60',
                  )}
                >
                  <BeanFace
                    seat={i}
                    stickers={seat.stickers}
                    className="size-9 shrink-0"
                  />
                  <span className="min-w-0 leading-tight">
                    <span className="block text-sm font-bold">
                      {t.seats[i].name}
                    </span>
                    <span className="block truncate text-xs">
                      {seatLabel(t, seat, room.you)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <PanelButton onClick={onStickers}>{t.stickers.open}</PanelButton>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={room.bots}
          onChange={(event) => session.setBots(event.target.checked)}
          className="accent-sauce size-5"
        />
        {t.online.botFill}
      </label>

      <label className="flex items-center gap-2 text-sm font-bold">
        {t.online.level}
        <select
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="border-ink min-w-0 flex-1 rounded-xl border-[3px] bg-white px-2 py-1"
        >
          {LEVELS.map(({ id }, index) => (
            <option key={id} value={id}>
              {`${formatNumber(index + 1, t.locale)}. ${t.levels[id].name}`}
            </option>
          ))}
        </select>
      </label>

      <PanelButton
        primary
        disabled={!canStart}
        onClick={() => session.start(level)}
      >
        {t.online.start}
      </PanelButton>
      <PanelButton onClick={onLeave}>{t.online.leave}</PanelButton>
    </Panel>
  )
}
