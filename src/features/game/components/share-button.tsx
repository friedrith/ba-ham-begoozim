import { useEffect, useState } from 'react'

import { track } from '../analytics'
import type { Messages } from '../i18n'
import { drawShareCard, type ShareCardRun } from '../render/share-card'
import { PanelButton } from './panel'

const FILE_NAME = 'ba-ham-begoozim.png'

function fontOf(variable: string) {
  return (
    getComputedStyle(document.documentElement).getPropertyValue(variable).trim() ||
    'sans-serif'
  )
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Draws the picture as soon as the result appears, not on the click. Safari only lets a
 * page share straight after a tap, and waiting for an encoded image can outlast that.
 */
export function ShareButton({ run, t }: { run: ShareCardRun; t: Messages }) {
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    let current = true
    const canvas = document.createElement('canvas')
    drawShareCard(canvas, run, t, {
      display: fontOf('--font-display'),
      body: fontOf('--font-sans'),
    })
    canvas.toBlob((blob) => {
      if (current && blob) {
        setFile(new File([blob], FILE_NAME, { type: 'image/png' }))
      }
    }, 'image/png')
    return () => {
      current = false
    }
  }, [run, t])

  const share = async () => {
    if (!file) return
    const data = {
      files: [file],
      title: t.title,
      text: `${t.ranks[run.rank]}. ${t.tagline}`,
    }
    if (!navigator.canShare?.(data)) {
      download(file)
      track('card_shared', { rank: run.rank, method: 'download' })
      return
    }
    try {
      await navigator.share(data)
      track('card_shared', { rank: run.rank, method: 'share' })
    } catch (error) {
      // Closing the share sheet counts as an error, but it isn't one.
      if (error instanceof DOMException && error.name === 'AbortError') return
      download(file)
      track('card_shared', { rank: run.rank, method: 'download' })
    }
  }

  return (
    <PanelButton disabled={!file} onClick={share}>
      {t.result.share}
    </PanelButton>
  )
}
