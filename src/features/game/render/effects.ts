import {
  forwardOf,
  SEATS,
  tubToWorld,
  type GameEvent,
  type World,
} from '../engine/world'
import type { Messages } from '../i18n'

export type Puff = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  age: number
  life: number
  color: string
}

export type Word = {
  x: number
  y: number
  text: string
  color: string
  size: number
  age: number
  life: number
}

export type Effects = {
  puffs: Puff[]
  words: Word[]
  shake: number
  /** Seconds left of the squash-and-stretch on each bean. */
  squash: number[]
  wordIndex: number
}

const MAX_PUFFS = 320
const GAS_COLORS = ['#c9d65a', '#b4c94a', '#dfe07e']
const FIRE_COLORS = ['#ffb627', '#ff7a1a', '#ffd166']
const ICE_COLORS = ['#ffffff', '#d6f0fb', '#a8dcf2']

export function createEffects(): Effects {
  return { puffs: [], words: [], shake: 0, squash: [0, 0, 0, 0], wordIndex: 0 }
}

function spawnPuff(fx: Effects, puff: Omit<Puff, 'age'>) {
  if (fx.puffs.length >= MAX_PUFFS) fx.puffs.shift()
  fx.puffs.push({ ...puff, age: 0 })
}

function emitBlast(
  fx: Effects,
  world: World,
  seat: number,
  count: number,
  colors: string[],
) {
  const s = SEATS[seat]
  const f = forwardOf(world.angle)
  // Gas leaves opposite to the way it shoves the tub, from the bean's end of the hull.
  const pos = tubToWorld(world, s.lx, s.ly + -s.thrust * 30)
  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * 70
    const speed = 90 + Math.random() * 120
    spawnPuff(fx, {
      x: pos.x + (Math.random() - 0.5) * 10,
      y: pos.y + (Math.random() - 0.5) * 10,
      vx: world.vx * 0.3 - f.x * s.thrust * speed - f.y * spread,
      vy: world.vy * 0.3 - f.y * s.thrust * speed + f.x * spread,
      size: 7 + Math.random() * 9,
      life: 0.5 + Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
}

function burst(fx: Effects, x: number, y: number, count: number, colors: string[]) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const speed = 40 + Math.random() * 180
    spawnPuff(fx, {
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: 5 + Math.random() * 11,
      life: 0.4 + Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
}

function addWord(
  fx: Effects,
  x: number,
  y: number,
  text: string,
  color: string,
  size: number,
  life = 0.85,
) {
  fx.words.push({ x, y, text, color, size, age: 0, life })
}

export function applyEvent(
  fx: Effects,
  world: World,
  event: GameEvent,
  t: Messages,
  blamed: number | null,
) {
  const words = t.fx
  switch (event.type) {
    case 'blast': {
      fx.squash[event.seat] = 0.25
      emitBlast(
        fx,
        world,
        event.seat,
        event.ignited ? 34 : 12,
        event.ignited ? FIRE_COLORS : GAS_COLORS,
      )
      const s = SEATS[event.seat]
      const p = tubToWorld(world, s.lx, s.ly + -s.thrust * 58)
      const text = words.toots[fx.wordIndex++ % words.toots.length]
      if (!event.harmony) addWord(fx, p.x, p.y, text, '#fff4dc', 24)
      if (event.ignited) fx.shake = Math.max(fx.shake, 12)
      break
    }
    case 'harmony':
      addWord(fx, world.x, world.y - 70, words.harmony, '#f2b632', 34)
      burst(fx, event.x, event.y, 10, ['#f2b632', '#fff4dc'])
      break
    case 'ignite':
      addWord(fx, event.x, event.y - 40, words.ignite, '#ff7a1a', 38)
      burst(fx, event.x, event.y, 26, FIRE_COLORS)
      break
    case 'can':
      addWord(fx, event.x, event.y - 30, words.can, '#7dffb2', 26)
      burst(fx, event.x, event.y, 12, ['#fff4dc', '#e4572e', '#f2b632'])
      break
    case 'bump':
      fx.shake = Math.max(fx.shake, Math.min(10, event.force / 22))
      burst(fx, event.x, event.y, 6, ['#ffffff', '#cfeff0'])
      break
    case 'smash':
      fx.shake = Math.max(fx.shake, 5)
      addWord(fx, event.x, event.y - 30, words.smash, '#d6f0fb', 32)
      burst(fx, event.x, event.y, 22, ICE_COLORS)
      break
    case 'skid':
      addWord(fx, event.x, event.y - 50, words.skid, '#d6f0fb', 28)
      burst(fx, event.x, event.y, 10, ICE_COLORS)
      break
    case 'respawn':
      fx.shake = 14
      addWord(fx, event.x, event.y - 30, words.respawn, '#ff6b6b', 40)
      burst(fx, event.x, event.y, 30, ['#ffffff', '#cfeff0', '#e4572e'])
      // The tub has already moved to the checkpoint, and the camera with it, so the
      // accusation goes where everyone is looking and stays long enough to read.
      addWord(
        fx,
        world.x,
        world.y - 80,
        blamed === null
          ? words.blameNobody
          : words.blame[fx.wordIndex++ % words.blame.length](t.seats[blamed].name),
        '#fff4dc',
        30,
        2,
      )
      break
    default:
      break
  }
}

export function updateEffects(fx: Effects, world: World, dt: number) {
  fx.shake = Math.max(0, fx.shake - dt * 40)
  fx.squash = fx.squash.map((s) => Math.max(0, s - dt))

  world.seats.forEach((seat, i) => {
    if (seat.blasting && Math.random() < dt * 45)
      emitBlast(fx, world, i, 1, GAS_COLORS)
  })

  for (const puff of fx.puffs) {
    puff.age += dt
    puff.x += puff.vx * dt
    puff.y += puff.vy * dt
    puff.vx *= Math.exp(-2.5 * dt)
    puff.vy *= Math.exp(-2.5 * dt)
  }
  fx.puffs = fx.puffs.filter((p) => p.age < p.life)

  for (const word of fx.words) {
    word.age += dt
    word.y -= 40 * dt
  }
  fx.words = fx.words.filter((w) => w.age < w.life)
}
