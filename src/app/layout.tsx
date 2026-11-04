import type { Metadata, Viewport } from 'next'
import { Bagel_Fat_One, Nunito } from 'next/font/google'
import type { ReactNode } from 'react'

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

export const metadata: Metadata = {
  title: 'Toot Canal',
  description:
    'A couch co-op browser game: four baked beans steer one bathtub by blasting in harmony.',
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
    <html lang="en" className={`${bagel.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  )
}
