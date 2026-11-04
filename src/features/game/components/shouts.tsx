import type { RoomView } from '../../online/protocol'
import type { HeardShout, OnlineSession } from '../../online/session'
import { formatNumber, type Messages } from '../i18n'
import { SHOUT_IDS } from '../shouts'
import { BeanFace } from './bean-face'

/** What the team just shouted. Someone with no seat has no bean and no name to show. */
export function ShoutFeed({
  t,
  room,
  shouts,
}: {
  t: Messages
  room: RoomView
  shouts: HeardShout[]
}) {
  return shouts.map(({ key, from, id }) => {
    const seat = room.seats.findIndex(({ owner }) => owner === from)
    const who =
      room.seats[seat]?.name ?? t.online.player(formatNumber(from, t.locale))
    return (
      <output
        key={key}
        className="animate-card-pop bg-cream border-ink flex items-center gap-2 rounded-xl border-2 px-3 py-1 text-sm font-bold motion-reduce:animate-none"
      >
        {seat >= 0 && (
          <BeanFace
            seat={seat}
            stickers={room.seats[seat].stickers ?? []}
            className="size-6 shrink-0"
          />
        )}
        <span className="font-normal">{who}</span>
        {t.shouts[id]}
      </output>
    )
  })
}

export function ShoutButtons({
  t,
  session,
}: {
  t: Messages
  session: OnlineSession
}) {
  return (
    <fieldset
      aria-label={t.hud.shout}
      className="pointer-events-auto flex max-w-sm flex-wrap justify-center gap-1 lg:max-w-2xl"
    >
      {SHOUT_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => session.shout(id)}
          className="bg-cream border-ink cursor-pointer rounded-full border-2 px-3 py-1 text-sm font-bold active:brightness-90"
        >
          {t.shouts[id]}
        </button>
      ))}
    </fieldset>
  )
}
