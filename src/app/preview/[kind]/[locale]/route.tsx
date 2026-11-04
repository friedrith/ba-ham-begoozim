import { isLocale, MESSAGES } from '@/features/game/i18n'

import { renderPreviewImage } from '../../../preview-image'

const HEADLINE_SIZES = { game: 118, invite: 88 }

function isKind(value: string): value is keyof typeof HEADLINE_SIZES {
  return Object.hasOwn(HEADLINE_SIZES, value)
}

// One picture per kind and language, so each only needs drawing once.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(HEADLINE_SIZES).flatMap((kind) =>
    Object.keys(MESSAGES).map((locale) => ({ kind, locale })),
  )
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; locale: string }> },
) {
  const { kind, locale } = await params
  if (!isKind(kind) || !isLocale(locale)) return new Response(null, { status: 404 })

  const t = MESSAGES[locale]
  const { headline, badge } = t.linkPreview[kind]
  return renderPreviewImage({
    headline,
    headlineSize: HEADLINE_SIZES[kind],
    badge,
    dir: t.dir,
  })
}
