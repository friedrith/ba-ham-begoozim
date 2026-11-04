import { useCallback, useLayoutEffect, useState } from 'react'

import {
  loadLocale,
  MESSAGES,
  saveLocale,
  setLinkLocale,
  type Locale,
} from './index'

/**
 * The server renders `<html lang="en">` and no game at all, so choosing the language in
 * the browser can't cause a hydration mismatch. Attributes change before the first paint.
 */
export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(loadLocale)
  const t = MESSAGES[locale]

  useLayoutEffect(() => {
    const root = document.documentElement
    root.lang = t.locale
    root.dir = t.dir

    // Link previews can't see the saved language, so a copied address has to carry it.
    const url = new URL(window.location.href)
    setLinkLocale(url, t.locale)
    window.history.replaceState(window.history.state, '', url)

    const syncTitle = () => {
      if (document.title !== t.title) document.title = t.title
    }
    syncTitle()
    // Hydrating Next's metadata writes the English title once, possibly after this runs.
    const observer = new MutationObserver(syncTitle)
    observer.observe(document.head, {
      characterData: true,
      childList: true,
      subtree: true,
    })
    return () => observer.disconnect()
  }, [t])

  const setLocale = useCallback((next: Locale) => {
    saveLocale(next)
    setLocaleState(next)
  }, [])

  return { t, setLocale }
}
