'use client'

import { clsx } from 'clsx'
import { Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { autopilot } from '../engine/autopilot'
import { LEVELS } from '../engine/levels'
import {
  createWorld,
  SEATS,
  starsFor,
  STEP,
  stepWorld,
  type World,
} from '../engine/world'
import { formatTime, loadProgress, recordRun, type Progress } from '../progress'
import { applyEvent, createEffects, updateEffects } from '../render/effects'
import {
  createCamera,
  drawCountdown,
  drawScene,
  updateCamera,
} from '../render/scene'
import { Sound } from '../render/sound'
import { BeanFace } from './bean-face'
import { Menu, Stars } from './menu'

const KEY_SEATS: Record<string, number[]> = {
  KeyQ: [0],
  KeyP: [1],
  KeyZ: [2],
  KeyM: [3],
  ArrowLeft: [2],
  ArrowRight: [3],
  ArrowDown: [0, 1],
}

const PAD_POSITIONS = [
  'top-16 left-3 md:top-20',
  'top-16 right-3 md:top-20',
  'bottom-3 left-3',
  'right-3 bottom-3',
]

type Result = {
  levelIndex: number
  time: number
  stars: number
  cans: number
  totalCans: number
  harmonies: number
  wipeouts: number
}

type Screen = { name: 'menu' } | { name: 'play'; levelIndex: number }

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [demoWorld] = useState(() => createWorld(LEVELS[0]))
  const worldRef = useRef<World>(demoWorld)
  const frameRef = useRef(0)
  const heldRef = useRef([false, false, false, false])
  const pressedKeys = useRef(new Set<string>())
  const padHeld = useRef([false, false, false, false])
  const fxRef = useRef(createEffects())
  const soundRef = useRef<Sound | null>(null)
  const timerRef = useRef<HTMLSpanElement>(null)
  const cansRef = useRef<HTMLSpanElement>(null)
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const screenRef = useRef<Screen>({ name: 'menu' })
  const pausedRef = useRef(false)

  const [screen, setScreen] = useState<Screen>({ name: 'menu' })
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [progress, setProgress] = useState<Progress>(loadProgress)

  useEffect(() => {
    soundRef.current = new Sound()
  }, [])

  const syncHeld = useCallback(() => {
    const held = [...padHeld.current]
    for (const code of pressedKeys.current) {
      for (const seat of KEY_SEATS[code] ?? []) held[seat] = true
    }
    heldRef.current = held
  }, [])

  const releaseAll = useCallback(() => {
    pressedKeys.current.clear()
    padHeld.current = [false, false, false, false]
    syncHeld()
    soundRef.current?.stopAll()
  }, [syncHeld])

  const startLevel = useCallback(
    (levelIndex: number) => {
      soundRef.current?.unlock()
      soundRef.current?.stopAll()
      worldRef.current = createWorld(LEVELS[levelIndex])
      fxRef.current = createEffects()
      releaseAll()
      setResult(null)
      setPaused(false)
      pausedRef.current = false
      const next: Screen = { name: 'play', levelIndex }
      screenRef.current = next
      setScreen(next)
    },
    [releaseAll],
  )

  const goToMenu = useCallback(() => {
    soundRef.current?.stopAll()
    worldRef.current = createWorld(LEVELS[0])
    fxRef.current = createEffects()
    releaseAll()
    setResult(null)
    setPaused(false)
    pausedRef.current = false
    const next: Screen = { name: 'menu' }
    screenRef.current = next
    setScreen(next)
  }, [releaseAll])

  const togglePause = useCallback(() => {
    if (screenRef.current.name !== 'play') return
    if (worldRef.current.status === 'finished') return
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
    releaseAll()
  }, [releaseAll])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      soundRef.current?.unlock()
      if (event.code === 'Escape') {
        togglePause()
        return
      }
      if (screenRef.current.name !== 'play') return
      if (event.code === 'KeyR') {
        startLevel(screenRef.current.levelIndex)
        return
      }
      if (KEY_SEATS[event.code]) {
        event.preventDefault()
        pressedKeys.current.add(event.code)
        syncHeld()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      pressedKeys.current.delete(event.code)
      syncHeld()
    }
    const onHidden = () => {
      if (
        document.hidden &&
        screenRef.current.name === 'play' &&
        !pausedRef.current
      ) {
        togglePause()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', releaseAll)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseAll)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [releaseAll, startLevel, syncHeld, togglePause])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const font =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--font-bagel')
        .trim() || 'sans-serif'
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const camera = createCamera(worldRef.current)
    let cameraWorld = worldRef.current
    let last = performance.now()
    let accumulator = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const handleFinish = (world: World) => {
      const current = screenRef.current
      if (current.name !== 'play') return
      const stars = starsFor(world)
      setProgress(recordRun(world.level.id, stars, world.raceTime))
      setResult({
        levelIndex: current.levelIndex,
        time: world.raceTime,
        stars,
        cans: world.cansTaken,
        totalCans: world.cans.length,
        harmonies: world.harmonies,
        wipeouts: world.wipeouts,
      })
    }

    const loop = (now: number) => {
      frameRef.current = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      let world = worldRef.current
      const demo = screenRef.current.name === 'menu'
      if (world !== cameraWorld) {
        cameraWorld = world
        camera.x = world.x
        camera.y = world.y
      }

      if (!pausedRef.current) {
        accumulator += dt
        while (accumulator >= STEP) {
          stepWorld(world, demo ? autopilot(world) : heldRef.current)
          accumulator -= STEP
        }

        for (const event of world.events) {
          applyEvent(fxRef.current, world, event)
          if (!demo) soundRef.current?.handle(event)
          if (event.type === 'finish') handleFinish(world)
        }
        world.events.length = 0
        updateEffects(fxRef.current, world, dt)
        updateCamera(camera, world, canvas.clientWidth, canvas.clientHeight, dt)

        if (demo && world.status === 'finished') {
          world = createWorld(world.level)
          worldRef.current = world
        }
      }

      const dpr = canvas.width / (canvas.clientWidth || 1)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawScene(
        ctx,
        world,
        camera,
        fxRef.current,
        canvas.clientWidth,
        canvas.clientHeight,
        {
          font,
          reducedMotion,
        },
      )
      if (!demo)
        drawCountdown(ctx, world, canvas.clientWidth, canvas.clientHeight, font)

      if (timerRef.current)
        timerRef.current.textContent = formatTime(world.raceTime)
      if (cansRef.current) {
        cansRef.current.textContent = `${world.cansTaken}/${world.cans.length}`
      }
      world.seats.forEach((seat, i) => {
        const bar = barRefs.current[i]
        if (bar) bar.style.transform = `scaleX(${seat.gas})`
      })
    }
    frameRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const setPad = (seat: number, down: boolean) => {
    padHeld.current[seat] = down
    syncHeld()
  }

  const level = screen.name === 'play' ? LEVELS[screen.levelIndex] : null

  return (
    <main className="bg-ink fixed inset-0 touch-none select-none">
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />

      {screen.name === 'menu' && <Menu progress={progress} onPlay={startLevel} />}

      {level && screen.name === 'play' && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
            <div className="bg-cream border-ink font-display flex items-center gap-3 rounded-full border-[3px] px-4 py-1 text-lg md:text-2xl">
              <span ref={timerRef} className="tabular-nums" aria-label="Time">
                0:00.0
              </span>
              <span
                className="text-sauce flex items-center gap-1"
                aria-label="Cans collected"
              >
                🥫 <span ref={cansRef}>0/0</span>
              </span>
            </div>
            <div className="pointer-events-auto flex gap-2">
              <button
                type="button"
                aria-label={muted ? 'Unmute' : 'Mute'}
                onClick={() => {
                  soundRef.current?.setMuted(!muted)
                  setMuted(!muted)
                }}
                className="bg-cream border-ink cursor-pointer rounded-full border-[3px] p-2"
              >
                {muted ? (
                  <VolumeX className="size-5" />
                ) : (
                  <Volume2 className="size-5" />
                )}
              </button>
              <button
                type="button"
                aria-label="Restart level"
                onClick={() => startLevel(screen.levelIndex)}
                className="bg-cream border-ink cursor-pointer rounded-full border-[3px] p-2"
              >
                <RotateCcw className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Pause"
                onClick={togglePause}
                className="bg-cream border-ink cursor-pointer rounded-full border-[3px] p-2"
              >
                <Pause className="size-5" />
              </button>
            </div>
          </div>

          <p
            key={level.id}
            className="animate-hint bg-cream border-ink pointer-events-none absolute top-36 left-1/2 w-max max-w-[85vw] -translate-x-1/2 rounded-xl border-2 px-3 py-1 text-center text-sm font-bold md:top-20 md:max-w-[50vw] md:text-base"
          >
            {level.hint}
          </p>

          {SEATS.map((seat, i) => (
            <button
              key={seat.key}
              type="button"
              aria-label={`${seat.name} bean, key ${seat.key}`}
              tabIndex={-1}
              onPointerDown={(event) => {
                soundRef.current?.unlock()
                event.currentTarget.setPointerCapture(event.pointerId)
                setPad(i, true)
              }}
              onPointerUp={() => setPad(i, false)}
              onPointerCancel={() => setPad(i, false)}
              onContextMenu={(event) => event.preventDefault()}
              className={clsx(
                'bg-cream/90 border-ink absolute flex w-24 cursor-pointer flex-col items-center gap-1 rounded-2xl border-[3px] p-2 active:brightness-90 md:w-28',
                PAD_POSITIONS[i],
              )}
            >
              <span className="flex items-center gap-1">
                <BeanFace seat={i} className="size-9" />
                <kbd className="bg-ink text-cream rounded-md px-2 py-0.5 text-sm font-bold">
                  {seat.key}
                </kbd>
              </span>
              <span className="bg-ink/20 h-2 w-full overflow-hidden rounded-full">
                <span
                  ref={(element) => {
                    barRefs.current[i] = element
                  }}
                  className="bg-gas block h-full w-full origin-left"
                />
              </span>
            </button>
          ))}

          {paused && (
            <Panel title="Paused">
              <PanelButton primary onClick={togglePause}>
                Keep tooting
              </PanelButton>
              <PanelButton onClick={() => startLevel(screen.levelIndex)}>
                Restart
              </PanelButton>
              <PanelButton onClick={goToMenu}>Menu</PanelButton>
            </Panel>
          )}

          {result && (
            <Panel title="Canal cleared!">
              <div className="flex flex-col items-center gap-3">
                <Stars count={result.stars} />
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <dt>Time (par {formatTime(LEVELS[result.levelIndex].par)})</dt>
                  <dd className="text-right font-bold tabular-nums">
                    {formatTime(result.time)}
                  </dd>
                  <dt>Cans</dt>
                  <dd className="text-right font-bold tabular-nums">
                    {result.cans}/{result.totalCans}
                  </dd>
                  <dt>Harmonies</dt>
                  <dd className="text-right font-bold tabular-nums">
                    {result.harmonies}
                  </dd>
                  <dt>Wipeouts</dt>
                  <dd className="text-right font-bold tabular-nums">
                    {result.wipeouts}
                  </dd>
                </dl>
              </div>
              {result.levelIndex + 1 < LEVELS.length && (
                <PanelButton
                  primary
                  onClick={() => startLevel(result.levelIndex + 1)}
                >
                  Next canal
                </PanelButton>
              )}
              <PanelButton onClick={() => startLevel(result.levelIndex)}>
                Go again
              </PanelButton>
              <PanelButton onClick={goToMenu}>Menu</PanelButton>
            </Panel>
          )}
        </>
      )}
    </main>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-ink/50 absolute inset-0 flex items-center justify-center p-4">
      <dialog
        open
        aria-label={title}
        className="text-ink bg-cream border-ink shadow-ink static flex w-full max-w-sm flex-col gap-3 rounded-3xl border-4 p-6 shadow-[0_8px_0]"
      >
        <h2 className="font-display text-sauce text-center text-4xl">{title}</h2>
        {children}
      </dialog>
    </div>
  )
}

function PanelButton({
  primary,
  onClick,
  children,
}: {
  primary?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'border-ink font-display cursor-pointer rounded-xl border-[3px] px-4 py-2 text-lg',
        primary ? 'bg-mustard' : 'bg-white',
      )}
    >
      {children}
    </button>
  )
}
