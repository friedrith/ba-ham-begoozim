'use client'

import dynamic from 'next/dynamic'

// The game is all canvas, audio and local progress, so there is nothing to server-render.
export const GameLoader = dynamic(
  () => import('./game').then((module) => module.Game),
  {
    ssr: false,
  },
)
