import type { Metadata, Viewport } from 'next'
import { Bagel_Fat_One, Lalezar, Nunito, Vazirmatn } from 'next/font/google'
import type { ReactNode } from 'react'

import { en } from '@/features/game/i18n/en'

import './globals.css'

const bagel = Bagel_Fat_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bagel',
  display: 'swap',
})

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
})

// Persian text only. Without a preload, English players download them only if they're used.
const lalezar = Lalezar({
  subsets: ['arabic'],
  weight: '400',
  variable: '--font-lalezar',
  display: 'swap',
  preload: false,
})

const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  variable: '--font-vazirmatn',
  display: 'swap',
  preload: false,
})

// The game page replaces this with a preview in the link's language.
export const metadata: Metadata = {
  metadataBase: new URL('https://gooz.zendegi.io'),
  title: en.linkPreview.game.title,
  description: en.linkPreview.game.description,
}

export const viewport: Viewport = {
  themeColor: '#2b1a12',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bagel.variable} ${nunito.variable} ${lalezar.variable} ${vazirmatn.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
