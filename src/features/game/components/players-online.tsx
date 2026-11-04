import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { fetchPlayerCount } from '../../online/session'
import { formatNumber, type Messages } from '../i18n'

const POLL_MS = 60_000
/** One person is nobody to play with, and they may well be the one reading this. */
const MIN_SHOWN = 2

export function PlayersOnline({ t, url }: { t: Messages; url: string }) {
  const [players, setPlayers] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      if (document.hidden) return
      const count = await fetchPlayerCount(url)
      if (!cancelled) setPlayers(count)
    }
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [url])

  if (players === null || players < MIN_SHOWN) return null
  return (
    <p className="motion-safe:animate-players-pop pointer-events-none fixed end-3 bottom-3 text-sm font-bold tabular-nums">
      {/* Keyed by the count, so the flash plays again each time it changes. */}
      <span
        key={`glow-${players}`}
        aria-hidden="true"
        className="bg-mustard motion-safe:animate-players-glow absolute inset-0 rounded-full opacity-0"
      />
      <span className="bg-mustard border-ink shadow-ink relative flex items-center gap-1.5 overflow-hidden rounded-full border-2 px-3 py-0.5 shadow-[0_3px_0]">
        <span
          key={`sweep-${players}`}
          aria-hidden="true"
          className="motion-safe:animate-players-sweep absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white to-transparent opacity-0"
        />
        <span aria-hidden="true" className="relative flex size-2.5">
          <span className="bg-gas absolute inset-0 rounded-full opacity-75 motion-safe:animate-ping" />
          <span className="bg-gas border-ink relative size-full rounded-full border" />
        </span>
        <Users aria-hidden="true" className="relative size-4" />
        <span
          key={`count-${players}`}
          className="motion-safe:animate-players-bump relative"
        >
          {t.online.playersNow(formatNumber(players, t.locale))}
        </span>
      </span>
    </p>
  )
}
