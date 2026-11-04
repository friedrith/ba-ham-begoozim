'use client'

import dynamic from 'next/dynamic'

// The game is all canvas, audio and local progress, so there is nothing to server-render.
const Game = dynamic(
  () => import('@/features/game/components/game').then((module) => module.Game),
  { ssr: false },
)

export default function GamePage() {
  return <Game />
}
