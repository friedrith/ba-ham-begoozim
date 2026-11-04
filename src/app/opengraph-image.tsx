import { en } from '@/features/game/i18n/en'

import { renderPreviewImage, size } from './preview-image'

export const alt =
  'Four baked beans in a clawfoot bathtub, blasting their way down a canal.'
export { size }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return renderPreviewImage({
    headline: en.menuTitle,
    headlineSize: 118,
    badge: 'Become the Fart King!',
  })
}
