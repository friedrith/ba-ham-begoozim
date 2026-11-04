import type { Metadata } from 'next'

import { GameLoader } from '@/features/game/components/game-loader'
import { isLocale, MESSAGES } from '@/features/game/i18n'

import { size } from './preview-image'

const ROOM_CODE = /^\d{6}$/

const OG_LOCALES = { en: 'en_US', fa: 'fa_IR' }

/** Previews follow the link's `lang`, and invite links preview as an invitation. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ room?: string | string[]; lang?: string | string[] }>
}): Promise<Metadata> {
  const { room, lang } = await searchParams
  const locale = typeof lang === 'string' && isLocale(lang) ? lang : 'en'
  const isInvite = typeof room === 'string' && ROOM_CODE.test(room)
  const kind = isInvite ? 'invite' : 'game'
  const { title, description, alt } = MESSAGES[locale].linkPreview[kind]

  const query = new URLSearchParams()
  if (isInvite) query.set('room', room)
  if (locale !== 'en') query.set('lang', locale)
  const search = query.size > 0 ? `?${query}` : ''

  const images = [{ url: `/preview/${kind}/${locale}`, ...size, alt }]
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      // Some apps fetch this URL for the preview instead, so it has to keep the query.
      url: `/${search}`,
      siteName: MESSAGES[locale].menuTitle,
      locale: OG_LOCALES[locale],
      title,
      description,
      images,
    },
    twitter: { card: 'summary_large_image', title, description, images },
  }
}

export default function GamePage() {
  return <GameLoader />
}
