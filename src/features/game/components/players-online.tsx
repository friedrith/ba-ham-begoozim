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
    <p className="bg-mustard border-ink flex items-center gap-1.5 rounded-full border-2 px-3 py-0.5 text-sm font-bold tabular-nums">
      <Users aria-hidden="true" className="size-4" />
      {t.online.playersNow(formatNumber(players, t.locale))}
    </p>
  )
}
