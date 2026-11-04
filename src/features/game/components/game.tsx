'use client'

import { clsx } from 'clsx'
import { Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import { laggySocket, OnlineSession, type SessionState } from '../../online/session'
import { setInputMode, track } from '../analytics'
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
import { formatNumber, formatTime } from '../i18n'
import { useLocale } from '../i18n/use-locale'
import {
  hasTrophy,
  loadProgress,
  rankFor,
  recordRun,
  totalStars,
  type Progress,
} from '../progress'
import { applyEvent, createEffects, updateEffects } from '../render/effects'
import {
  createCamera,
  drawCountdown,
  drawScene,
  updateCamera,
} from '../render/scene'
import type { ShareCardRun } from '../render/share-card'
import { Sound } from '../render/sound'
import { awardsFor, createTally, tallyEvent, type Tally } from '../tally'
import { BeanFace } from './bean-face'
import { FeedbackPanel } from './feedback-panel'
import {
  loadPlayerName,
  Lobby,
  NameField,
  seatLabel,
  sessionErrorText,
} from './lobby'
import { isTextField, Menu, Stars } from './menu'
import { JoinRoomPanel, normalizeCode, OnlineEntry } from './online-entry'
import { Panel, PanelButton } from './panel'
import { ShareButton } from './share-button'

const KEY_SEATS: Record<string, number[]> = {
  KeyQ: [0],
  KeyP: [1],
  KeyZ: [2],
  KeyM: [3],
  ArrowLeft: [2],
  ArrowRight: [3],
  ArrowDown: [0, 1],
}

// Physical on purpose: each seat keeps its screen corner in right-to-left languages too.
// The pads also set dir="ltr", because flex alignment would otherwise follow the language.
const PAD_POSITIONS = [
  'top-16 left-3 md:top-20',
  'top-16 right-3 md:top-20',
  'bottom-3 left-3',
  'right-3 bottom-3',
]

// In touch mode each pad fills its quarter of a phone screen, so no touch is wasted.
// A tablet's quarter is far bigger than a thumb needs, so its pads stay in the corners.
const TOUCH_PADS = [
  'top-0 left-0 items-start justify-start',
  'top-0 right-0 items-start justify-end',
  'bottom-0 left-0 items-end justify-start',
  'right-0 bottom-0 items-end justify-end',
]

const TOUCH_BADGES = [
  'rounded-br-[2rem] border-r-[3px] border-b-[3px]',
  'rounded-bl-[2rem] border-b-[3px] border-l-[3px]',
  'rounded-tr-[2rem] border-t-[3px] border-r-[3px]',
  'rounded-tl-[2rem] border-t-[3px] border-l-[3px]',
]

type Result = {
  levelIndex: number
  time: number
  stars: number
  cans: number
  totalCans: number
  harmonies: number
  wipeouts: number
  rankUp: boolean
  trophyUnlocked: boolean
  card: ShareCardRun
}

type Screen =
  | { name: 'menu' }
  | { name: 'play'; levelIndex: number }
  | { name: 'online' }

/** Online play stays hidden until a room service has been deployed and named here. */
const ROOMS_URL = process.env.NEXT_PUBLIC_ROOMS_URL
const TOKEN_KEY = 'ba-ham-begoozim-room-token'
const ROOM_CODE = /^\d{6}$/

const noSubscribe = () => () => {}
const noState = () => null as SessionState | null

/**
 * Who this tab is to a room. Kept for the tab, so a reload gets the same seats back while
 * a second tab counts as someone else.
 */
function roomToken() {
  try {
    const saved = sessionStorage.getItem(TOKEN_KEY)
    if (saved) return saved
    const token = crypto.randomUUID()
    sessionStorage.setItem(TOKEN_KEY, token)
    return token
  } catch {
    return crypto.randomUUID()
  }
}

function setRoomInUrl(code: string | null) {
  const url = new URL(window.location.href)
  if (code) url.searchParams.set('room', code)
  else url.searchParams.delete('room')
  window.history.replaceState(null, '', url)
}

/** `?lag=100&jitter=20` fakes a slow network while developing. */
function devSocket() {
  if (process.env.NODE_ENV === 'production') return undefined
  const params = new URLSearchParams(window.location.search)
  const lag = Number(params.get('lag') ?? 0)
  const jitter = Number(params.get('jitter') ?? 0)
  if (!lag && !jitter) return undefined
  return (url: string) => laggySocket(url, lag, jitter)
}

/**
 * Asks whether a finger is the main pointer rather than reading the user agent,
 * because iPads report themselves as Macs. A touch laptop's main pointer is its
 * trackpad, so it stays on the keyboard layout until someone touches the screen.
 */
function startsInTouchMode() {
  return (
    navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches
  )
}

/** Reports a run left before the finish line. The demo behind the menu never counts. */
function trackAbandoned(screen: Screen, world: World, reason: 'restart' | 'menu') {
  if (screen.name !== 'play' || world.status === 'finished') return
  track('level_abandoned', {
    level_id: world.level.id,
    reason,
    race_time: world.raceTime,
  })
}

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [demoWorld] = useState(() => createWorld(LEVELS[0]))
  const worldRef = useRef<World>(demoWorld)
  const frameRef = useRef(0)
  const heldRef = useRef([false, false, false, false])
  const pressedKeys = useRef(new Set<string>())
  const padPointers = useRef(SEATS.map(() => new Set<number>()))
  const padRefs = useRef<(HTMLButtonElement | null)[]>([])
  const fxRef = useRef(createEffects())
  /** Who did what on this device's race. Online the session keeps it instead. */
  const tallyRef = useRef(createTally())
  const soundRef = useRef<Sound | null>(null)
  const timerRef = useRef<HTMLSpanElement>(null)
  const cansRef = useRef<HTMLSpanElement>(null)
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const screenRef = useRef<Screen>({ name: 'menu' })
  const pausedRef = useRef(false)
  const sessionRef = useRef<OnlineSession | null>(null)
  /** The world on screen, which online is the session's rather than `worldRef`'s. */
  const shownRef = useRef<World>(demoWorld)
  /** Online nothing can pause the race, so "paused" is only a menu over it. */
  const overlayRef = useRef(false)

  const { t, setLocale } = useLocale()
  const tRef = useRef(t)
  const fontRef = useRef('sans-serif')

  const [screen, setScreen] = useState<Screen>({ name: 'menu' })
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const closeFeedback = useCallback(() => setFeedbackOpen(false), [])
  const [joinOpen, setJoinOpen] = useState(false)
  const closeJoin = useCallback(() => setJoinOpen(false), [])
  const [result, setResult] = useState<Result | null>(null)
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [touchMode, setTouchMode] = useState(startsInTouchMode)
  const [session, setSession] = useState<OnlineSession | null>(null)
  const [debug] = useState(() =>
    new URLSearchParams(window.location.search).has('debug'),
  )
  const online = useSyncExternalStore(
    session?.subscribe ?? noSubscribe,
    session?.getState ?? noState,
    noState,
  )
  const room = online?.room ?? null
  const inOnlineRace = screen.name === 'online' && room?.phase === 'race'

  useEffect(() => {
    soundRef.current = new Sound()
  }, [])

  useEffect(() => {
    setInputMode(touchMode ? 'touch' : 'keyboard')
  }, [touchMode])

  useLayoutEffect(() => {
    tRef.current = t
    fontRef.current =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--font-display')
        .trim() || 'sans-serif'
  }, [t])

  const syncHeld = useCallback(() => {
    const held = padPointers.current.map((pointers) => pointers.size > 0)
    for (const code of pressedKeys.current) {
      for (const seat of KEY_SEATS[code] ?? []) held[seat] = true
    }
    heldRef.current = held
    sessionRef.current?.setHeld(held)
  }, [])

  const releaseAll = useCallback(() => {
    pressedKeys.current.clear()
    padPointers.current.forEach((pointers) => pointers.clear())
    syncHeld()
    soundRef.current?.stopAll()
  }, [syncHeld])

  const startLevel = useCallback(
    (levelIndex: number) => {
      trackAbandoned(screenRef.current, worldRef.current, 'restart')
      track('level_started', { level_id: LEVELS[levelIndex].id })
      soundRef.current?.unlock()
      soundRef.current?.stopAll()
      worldRef.current = createWorld(LEVELS[levelIndex])
      fxRef.current = createEffects()
      tallyRef.current = createTally()
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
    trackAbandoned(screenRef.current, worldRef.current, 'menu')
    soundRef.current?.stopAll()
    worldRef.current = createWorld(LEVELS[0])
    fxRef.current = createEffects()
    tallyRef.current = createTally()
    releaseAll()
    setResult(null)
    setPaused(false)
    pausedRef.current = false
    overlayRef.current = false
    const next: Screen = { name: 'menu' }
    screenRef.current = next
    setScreen(next)
  }, [releaseAll])

  const enterRoom = useCallback((code: string) => {
    if (!ROOMS_URL) return
    soundRef.current?.unlock()
    sessionRef.current?.close()
    const next = new OnlineSession({
      url: ROOMS_URL,
      code,
      token: roomToken(),
      name: loadPlayerName(),
      createSocket: devSocket(),
    })
    sessionRef.current = next
    setSession(next)
    setRoomInUrl(code)
    const screenNext: Screen = { name: 'online' }
    screenRef.current = screenNext
    setScreen(screenNext)
  }, [])

  const leaveRoom = useCallback(() => {
    sessionRef.current?.leave()
    sessionRef.current = null
    setSession(null)
    setRoomInUrl(null)
    goToMenu()
  }, [goToMenu])

  /** Whether seat keys do anything right now. */
  const racing = useCallback(() => {
    if (screenRef.current.name === 'play') return true
    return sessionRef.current?.getState().room?.phase === 'race'
  }, [])

  /** Plays a level: for this device alone, or for everyone in the room. */
  const playLevel = useCallback(
    (levelIndex: number) => {
      if (sessionRef.current) sessionRef.current.start(LEVELS[levelIndex].id)
      else startLevel(levelIndex)
    },
    [startLevel],
  )

  const togglePause = useCallback(() => {
    if (!racing()) return
    if (shownRef.current.status === 'finished') return
    if (sessionRef.current) {
      overlayRef.current = !overlayRef.current
      setPaused(overlayRef.current)
    } else {
      const next = !pausedRef.current
      pausedRef.current = next
      setPaused(next)
    }
    releaseAll()
  }, [racing, releaseAll])

  // A link with a room in it goes straight there, and so does reloading while in one.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = normalizeCode(params.get('room') ?? '')
    // Not done here and now, so that React's double-run effects can't connect twice.
    const timer = setTimeout(() => {
      if (ROOMS_URL && ROOM_CODE.test(code)) enterRoom(code)
    })
    return () => {
      clearTimeout(timer)
      sessionRef.current?.close()
      sessionRef.current = null
    }
  }, [enterRoom])

  // Each race starts clean, whoever started it.
  const raceKey = room ? `${room.phase}-${room.raceId}` : null
  const [seenRaceKey, setSeenRaceKey] = useState(raceKey)
  if (raceKey !== seenRaceKey) {
    setSeenRaceKey(raceKey)
    setPaused(false)
    setResult(null)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTextField(event.target)) return
      soundRef.current?.unlock()
      if (
        KEY_SEATS[event.code] &&
        padPointers.current.every((pointers) => pointers.size === 0)
      ) {
        setTouchMode(false)
      }
      if (event.code === 'Escape') {
        togglePause()
        return
      }
      if (!racing()) return
      if (screenRef.current.name === 'play' && event.code === 'KeyR') {
        startLevel(screenRef.current.levelIndex)
        return
      }
      if (KEY_SEATS[event.code] && !overlayRef.current) {
        event.preventDefault()
        pressedKeys.current.add(event.code)
        syncHeld()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      pressedKeys.current.delete(event.code)
      syncHeld()
    }
    const onPointerDown = (event: PointerEvent) => {
      soundRef.current?.unlock()
      if (event.pointerType === 'touch') setTouchMode(true)
    }
    // A touch only counts as the gesture audio needs once the finger lifts.
    const unlockSound = () => soundRef.current?.unlock()
    // Safari ignores user-scalable=no, so pinches have to be refused here too.
    const refuseGesture = (event: Event) => event.preventDefault()
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
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', unlockSound)
    window.addEventListener('touchend', unlockSound)
    document.addEventListener('gesturestart', refuseGesture)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseAll)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', unlockSound)
      window.removeEventListener('touchend', unlockSound)
      document.removeEventListener('gesturestart', refuseGesture)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [racing, releaseAll, startLevel, syncHeld, togglePause])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

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

    const handleFinish = (world: World, tally: Tally) => {
      if (screenRef.current.name === 'menu') return
      overlayRef.current = false
      setPaused(false)
      const stars = starsFor(world)
      const before = loadProgress()
      let after = before
      // Watching the bots finish an online race doesn't earn anything.
      const onlineRoom = sessionRef.current?.getState().room
      if (
        !onlineRoom ||
        onlineRoom.seats.some(({ owner }) => owner === onlineRoom.you)
      ) {
        after = recordRun(world.level.id, stars, world.raceTime)
        setProgress(after)
      }
      const rank = rankFor(totalStars(after))
      // Online races have no `level_started` yet, so counting these would skew the funnel.
      if (screenRef.current.name === 'play') {
        track('level_finished', {
          level_id: world.level.id,
          time: world.raceTime,
          par: world.level.par,
          stars,
          cans: world.cansTaken,
          total_cans: world.cans.length,
          harmonies: world.harmonies,
          wipeouts: world.wipeouts,
        })
      }
      setResult({
        levelIndex: LEVELS.indexOf(world.level),
        time: world.raceTime,
        stars,
        cans: world.cansTaken,
        totalCans: world.cans.length,
        harmonies: world.harmonies,
        wipeouts: world.wipeouts,
        rankUp: rank !== rankFor(totalStars(before)),
        trophyUnlocked: hasTrophy(after) && !hasTrophy(before),
        card: {
          rank,
          stars: totalStars(after),
          levelName: tRef.current.levels[world.level.id].name,
          time: world.raceTime,
          harmonies: world.harmonies,
          wipeouts: world.wipeouts,
          awards: awardsFor(tally),
        },
      })
    }

    const loop = (now: number) => {
      frameRef.current = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const live = sessionRef.current
      const raced = live?.display(dt) ?? null
      let world = raced ?? worldRef.current
      shownRef.current = world
      // The lobby and the menu both have the bot driving behind them.
      const demo = !raced && screenRef.current.name !== 'play'
      if (world !== cameraWorld) {
        cameraWorld = world
        camera.x = world.x
        camera.y = world.y
        fxRef.current = createEffects()
        // Online a new world can arrive at any moment, with no click here to prompt it.
        overlayRef.current = false
        soundRef.current?.stopAll()
      }

      if (raced || !pausedRef.current) {
        if (!raced) {
          accumulator += dt
          while (accumulator >= STEP) {
            stepWorld(world, demo ? autopilot(world) : heldRef.current)
            accumulator -= STEP
          }
        }

        const events = live && raced ? live.takeEvents() : world.events
        const tally = live && raced ? live.tally : tallyRef.current
        for (const event of events) {
          if (!raced) tallyEvent(tally, event, world.clock)
          applyEvent(fxRef.current, world, event, tRef.current, tally.lastBlame)
          if (!demo) soundRef.current?.handle(event)
          if (event.type === 'finish') handleFinish(world, tally)
        }
        if (!raced) world.events.length = 0
        updateEffects(fxRef.current, world, dt)
        updateCamera(camera, world, canvas.clientWidth, canvas.clientHeight, dt)

        if (demo && world.status === 'finished') {
          world = createWorld(world.level)
          worldRef.current = world
        }
      }

      const text = tRef.current
      const font = fontRef.current
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
          dir: text.dir,
        },
      )
      if (!demo)
        drawCountdown(
          ctx,
          world,
          canvas.clientWidth,
          canvas.clientHeight,
          font,
          text,
        )

      if (timerRef.current)
        timerRef.current.textContent = formatTime(world.raceTime, text.locale)
      if (cansRef.current) {
        cansRef.current.textContent = formatNumber(
          `${world.cansTaken}/${world.cans.length}`,
          text.locale,
        )
      }
      world.seats.forEach((seat, i) => {
        const bar = barRefs.current[i]
        if (bar) bar.style.transform = `scaleX(${seat.gas})`
        padRefs.current[i]?.toggleAttribute('data-blasting', seat.blasting)
      })
    }
    frameRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  // Tracked per finger, so a hand resting on a big pad can't cut off its blast.
  const setPad = (seat: number, pointerId: number, down: boolean) => {
    if (down) padPointers.current[seat].add(pointerId)
    else padPointers.current[seat].delete(pointerId)
    syncHeld()
  }

  const level =
    screen.name === 'play'
      ? LEVELS[screen.levelIndex]
      : inOnlineRace
        ? (LEVELS.find(({ id }) => id === room?.level) ?? LEVELS[0])
        : null
  const levelIndex = level ? LEVELS.indexOf(level) : 0
  const hudButton = clsx(
    'bg-cream border-ink cursor-pointer rounded-full border-[3px]',
    touchMode ? 'p-3' : 'p-2',
  )

  return (
    <main className="bg-ink fixed inset-0 touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]">
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />

      {screen.name === 'menu' && (
        <Menu
          t={t}
          progress={progress}
          touchMode={touchMode}
          onPlay={startLevel}
          onLocaleChange={setLocale}
          onFeedback={() => setFeedbackOpen(true)}
          online={
            ROOMS_URL && (
              <OnlineEntry
                t={t}
                url={ROOMS_URL}
                onEnter={enterRoom}
                onJoin={() => setJoinOpen(true)}
              />
            )
          }
        />
      )}

      {screen.name === 'menu' && feedbackOpen && (
        <FeedbackPanel t={t} onClose={closeFeedback} />
      )}

      {screen.name === 'menu' && joinOpen && (
        <JoinRoomPanel
          t={t}
          onEnter={(code) => {
            closeJoin()
            enterRoom(code)
          }}
          onClose={closeJoin}
        />
      )}

      {screen.name === 'online' && session && !inOnlineRace && !online?.error && (
        <Lobby t={t} room={room} session={session} onLeave={leaveRoom} />
      )}

      {screen.name === 'online' && online?.error && (
        <Panel title={t.online.title}>
          <p role="alert" className="text-center font-bold">
            {sessionErrorText(t, online.error)}
          </p>
          <PanelButton primary onClick={leaveRoom}>
            {t.online.backToMenu}
          </PanelButton>
        </Panel>
      )}

      {level && (
        <>
          {t.seats.map((seat, i) => {
            const roomSeat = inOnlineRace ? room?.seats[i] : undefined
            const someoneElse =
              roomSeat &&
              roomSeat.owner !== room?.you &&
              (roomSeat.status === 'here' || roomSeat.status === 'away')
            const owner = roomSeat && room && (
              <span className="max-w-full truncate text-xs leading-none font-bold">
                {seatLabel(t, roomSeat, room.you)}
              </span>
            )
            return (
              <button
                key={i}
                dir="ltr"
                ref={(element) => {
                  padRefs.current[i] = element
                }}
                type="button"
                aria-label={
                  touchMode ? t.hud.seatPadTouch(seat) : t.hud.seatPad(seat)
                }
                tabIndex={-1}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId)
                  setPad(i, event.pointerId, true)
                }}
                onPointerUp={(event) => setPad(i, event.pointerId, false)}
                onPointerCancel={(event) => setPad(i, event.pointerId, false)}
                onContextMenu={(event) => event.preventDefault()}
                className={clsx(
                  'absolute flex cursor-pointer',
                  someoneElse && 'opacity-60',
                  touchMode
                    ? [
                        'data-blasting:bg-mustard/20 group tablet:size-64 size-1/2',
                        TOUCH_PADS[i],
                      ]
                    : [
                        'bg-cream/90 border-ink w-24 flex-col items-center gap-1 rounded-2xl border-[3px] p-2 active:brightness-90 md:w-28',
                        PAD_POSITIONS[i],
                      ],
                )}
              >
                <span
                  dir={t.dir}
                  className={
                    touchMode
                      ? clsx(
                          'bg-cream/90 border-ink group-data-blasting:bg-mustard flex w-32 flex-col gap-2 p-3 md:w-44 md:p-4',
                          TOUCH_BADGES[i],
                        )
                      : 'contents'
                  }
                >
                  <span className="flex items-center gap-1">
                    <BeanFace
                      seat={i}
                      className={
                        touchMode ? 'size-12 shrink-0 md:size-16' : 'size-9'
                      }
                    />
                    {touchMode ? (
                      <span className="text-start text-sm leading-tight font-bold md:text-base">
                        {seat.name}
                      </span>
                    ) : (
                      <kbd className="bg-ink text-cream rounded-md px-2 py-0.5 text-sm font-bold">
                        {seat.key}
                      </kbd>
                    )}
                  </span>
                  {owner}
                  <span
                    className={clsx(
                      'bg-ink/20 w-full overflow-hidden rounded-full',
                      touchMode ? 'h-3' : 'h-2',
                    )}
                  >
                    <span
                      ref={(element) => {
                        barRefs.current[i] = element
                      }}
                      className="bg-gas block h-full w-full origin-left rtl:origin-right"
                    />
                  </span>
                </span>
              </button>
            )
          })}

          <div
            className={clsx(
              'pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 p-3',
              touchMode
                ? 'flex-wrap justify-center pt-24 sm:px-36 sm:pt-3 md:px-48'
                : 'justify-between',
            )}
          >
            <div className="bg-cream border-ink font-display flex items-center gap-3 rounded-full border-[3px] px-4 py-1 text-lg md:text-2xl">
              <span
                ref={timerRef}
                className="tabular-nums rtl:inline-block rtl:min-w-[3.4em] rtl:text-center"
                aria-label={t.hud.time}
              >
                {formatTime(0, t.locale)}
              </span>
              <span
                className="text-sauce flex items-center gap-1"
                aria-label={t.hud.cans}
              >
                🥫 <span ref={cansRef}>{formatNumber('0/0', t.locale)}</span>
              </span>
            </div>
            <div className="pointer-events-auto flex gap-2">
              <button
                type="button"
                aria-label={muted ? t.hud.unmute : t.hud.mute}
                onClick={() => {
                  soundRef.current?.setMuted(!muted)
                  setMuted(!muted)
                }}
                className={hudButton}
              >
                {muted ? (
                  <VolumeX className="size-5" />
                ) : (
                  <Volume2 className="size-5" />
                )}
              </button>
              {/* Online this would restart everyone's race, so it's kept behind pause. */}
              {!inOnlineRace && (
                <button
                  type="button"
                  aria-label={t.hud.restartLevel}
                  onClick={() => startLevel(levelIndex)}
                  className={hudButton}
                >
                  <RotateCcw className="size-5" />
                </button>
              )}
              <button
                type="button"
                aria-label={t.hud.pause}
                onClick={togglePause}
                className={hudButton}
              >
                <Pause className="size-5" />
              </button>
            </div>
          </div>

          <p
            key={level.id}
            className={clsx(
              'animate-hint bg-cream border-ink pointer-events-none absolute left-1/2 w-max max-w-[85vw] -translate-x-1/2 rounded-xl border-2 px-3 py-1 text-center text-sm font-bold md:top-20 md:max-w-[50vw] md:text-base',
              touchMode ? 'top-40 sm:top-20' : 'top-36',
            )}
          >
            {touchMode && `${t.hud.holdCorner} `}
            {t.levels[level.id].hint}
          </p>

          {inOnlineRace && online && (
            <div className="pointer-events-none absolute inset-x-0 bottom-20 flex flex-col items-center gap-2 px-4">
              {online.status === 'reconnecting' && (
                <output className="bg-sauce border-ink text-cream rounded-xl border-2 px-3 py-1 text-sm font-bold">
                  {t.online.reconnecting}
                </output>
              )}
              {online.lostSeat !== null && (
                <output className="bg-cream border-ink rounded-xl border-2 px-3 py-1 text-center text-sm font-bold">
                  {t.online.seatLost(t.seats[online.lostSeat].name)}
                </output>
              )}
            </div>
          )}

          {paused && (
            <Panel title={t.paused.title}>
              {inOnlineRace && (
                <p className="text-center font-bold">{t.online.raceGoesOn}</p>
              )}
              {inOnlineRace && session && room && (
                <NameField t={t} you={room.you} session={session} />
              )}
              <PanelButton primary onClick={togglePause}>
                {t.paused.resume}
              </PanelButton>
              <PanelButton onClick={() => playLevel(levelIndex)}>
                {t.paused.restart}
              </PanelButton>
              {inOnlineRace ? (
                <>
                  <PanelButton onClick={() => session?.toLobby()}>
                    {t.online.backToRoom}
                  </PanelButton>
                  <PanelButton onClick={leaveRoom}>{t.online.leave}</PanelButton>
                </>
              ) : (
                <PanelButton onClick={goToMenu}>{t.paused.menu}</PanelButton>
              )}
            </Panel>
          )}

          {result && (
            <Panel title={t.result.title} celebrate>
              <div className="flex flex-col items-center gap-3">
                <Stars count={result.stars} t={t} celebrate />
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <dt>
                    {t.result.time(
                      formatTime(LEVELS[result.levelIndex].par, t.locale),
                    )}
                  </dt>
                  <dd className="text-end font-bold tabular-nums">
                    {formatTime(result.time, t.locale)}
                  </dd>
                  <dt>{t.result.cans}</dt>
                  <dd className="text-end font-bold tabular-nums">
                    {formatNumber(`${result.cans}/${result.totalCans}`, t.locale)}
                  </dd>
                  <dt>{t.result.harmonies}</dt>
                  <dd className="text-end font-bold tabular-nums">
                    {formatNumber(result.harmonies, t.locale)}
                  </dd>
                  <dt>{t.result.wipeouts}</dt>
                  <dd className="text-end font-bold tabular-nums">
                    {formatNumber(result.wipeouts, t.locale)}
                  </dd>
                </dl>
                <ul className="flex w-full flex-col gap-1">
                  {result.card.awards.map((award, seat) => (
                    <li key={seat} className="flex items-center gap-3">
                      <BeanFace seat={seat} className="size-9 shrink-0" dance />
                      <span className="flex min-w-0 flex-col text-xs leading-tight">
                        <span className="font-display text-base leading-tight">
                          {t.awards[award.id].title}
                        </span>
                        <span>
                          {t.seats[seat].name} ·{' '}
                          {t.awards[award.id].detail(
                            formatNumber(award.value, t.locale),
                          )}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p
                  className={clsx(
                    'text-center font-bold',
                    result.rankUp && 'font-display text-sauce text-2xl font-normal',
                  )}
                >
                  {(result.rankUp ? t.result.rankUp : t.result.rank)(
                    t.ranks[result.card.rank],
                  )}
                </p>
                {result.trophyUnlocked && (
                  <p className="font-display text-sauce text-center text-2xl">
                    {t.result.trophyUnlocked(t.trophy)}
                  </p>
                )}
              </div>
              <ShareButton run={result.card} t={t} />
              {result.levelIndex + 1 < LEVELS.length && (
                <PanelButton
                  primary
                  onClick={() => playLevel(result.levelIndex + 1)}
                >
                  {t.result.nextLevel}
                </PanelButton>
              )}
              <PanelButton onClick={() => playLevel(result.levelIndex)}>
                {t.result.again}
              </PanelButton>
              {inOnlineRace ? (
                <>
                  <PanelButton onClick={() => session?.toLobby()}>
                    {t.online.backToRoom}
                  </PanelButton>
                  <PanelButton onClick={leaveRoom}>{t.online.leave}</PanelButton>
                </>
              ) : (
                <PanelButton onClick={goToMenu}>{t.result.menu}</PanelButton>
              )}
            </Panel>
          )}
        </>
      )}

      {debug && online && (
        <p
          dir="ltr"
          className="bg-ink text-cream pointer-events-none absolute start-1/2 bottom-1 -translate-x-1/2 rounded px-2 text-xs tabular-nums"
        >
          {`${online.status} · rtt ${Math.round(online.rtt)}ms · room tick gap ${online.tickGap}ms`}
        </p>
      )}
    </main>
  )
}
