import { en } from '@/features/game/i18n/en'

import { renderPreviewImage } from '../preview-image'

// The same picture for every room, so it only needs drawing once.
export const dynamic = 'force-static'

export function GET() {
  return renderPreviewImage({
    headline: 'A farter invited you to a fart game',
    headlineSize: 88,
    badge: en.menuTitle,
  })
}
