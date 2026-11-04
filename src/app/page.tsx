import type { Metadata } from 'next'

import { GameLoader } from '@/features/game/components/game-loader'

import { size } from './preview-image'

const ROOM_CODE = /^\d{6}$/

const title = 'A farter invited you to a fart game'
const description =
  'Hop in the bathtub! Four baked beans, one tub, and the only way forward is blasting in harmony.'

/** Invite links preview as an invitation. Any other link keeps the layout's preview. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ room?: string | string[] }>
}): Promise<Metadata> {
  const { room } = await searchParams
  if (typeof room !== 'string' || !ROOM_CODE.test(room)) return {}

  const images = [{ url: '/invite-image', ...size, alt: title }]
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      // Some apps fetch this URL for the preview instead, so it has to stay the invite.
      url: `/?room=${room}`,
      siteName: 'Ba Ham Begoozim',
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
