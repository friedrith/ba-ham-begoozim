import { bankAt, pointAt, type Course } from '../engine/course'
import { SCENERY_GAP, type Scenery, type Theme } from '../engine/levels'
import {
  CAN_RADIUS,
  finishIndex,
  gateBar,
  ICICLE_RADIUS,
  ICICLE_WARNING,
  icicleLanding,
  paddleBar,
  SEATS,
  URCHIN_RADIUS,
  urchinPosition,
  type World,
} from '../engine/world'
import { formatNumber, type Messages } from '../i18n'
import {
  STICKER_EDGE,
  STICKER_SCALE,
  STICKER_SPOTS,
  STICKERS,
  type BeanStickers,
  type StickerId,
} from '../stickers'
import type { Effects } from './effects'

export const BEAN_COLORS = ['#e4572e', '#f2b632', '#2ec4b6', '#a05195']
/** The bean's outline as an icon, in a box 44 wide centred on the origin. */
export const BEAN_ICON_PATH =
  'M-14-3C-18-20 18-20 14-3C19 12 8 18 3 11C1 8-1 8-3 11C-8 18-19 12-14-3Z'
const INK = '#2b1a12'

type Palette = {
  bank: string
  bankLine: string
  water: string
  waterDeep: string
  ripple: string
  lip: string
}

export const PALETTES: Record<Theme, Palette> = {
  tile: {
    bank: '#f6efe2',
    bankLine: '#d9cfbb',
    water: '#37c1c7',
    waterDeep: '#22a3ae',
    ripple: 'rgba(255,255,255,0.45)',
    lip: '#ffffff',
  },
  brick: {
    bank: '#8a4b38',
    bankLine: '#6a3626',
    water: '#5f8f5a',
    waterDeep: '#47753f',
    ripple: 'rgba(214,240,180,0.35)',
    lip: '#b9a58f',
  },
  iron: {
    bank: '#37343a',
    bankLine: '#27252a',
    water: '#b5581f',
    waterDeep: '#8f3f13',
    ripple: 'rgba(255,190,110,0.4)',
    lip: '#7c7780',
  },
  frost: {
    bank: '#dcebf5',
    bankLine: '#b7d3e6',
    water: '#6fb7dd',
    waterDeep: '#4f9ccb',
    ripple: 'rgba(255,255,255,0.55)',
    lip: '#f6fbff',
  },
}

export type Camera = { x: number; y: number; scale: number }

export function createCamera(world: World): Camera {
  return { x: world.x, y: world.y, scale: 1 }
}

export function updateCamera(
  cam: Camera,
  world: World,
  w: number,
  h: number,
  dt: number,
) {
  const speed = Math.hypot(world.vx, world.vy)
  const targetScale = (Math.min(w, h) / 640) * (1 - Math.min(speed, 400) / 1600)
  const ease = 1 - Math.exp(-3.5 * dt)
  cam.scale += (targetScale - cam.scale) * ease
  cam.x += (world.x + world.vx * 0.7 - cam.x) * ease
  cam.y += (world.y + world.vy * 0.7 - cam.y) * ease
}

function tracePolyline(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
) {
  ctx.beginPath()
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
}

function drawBank(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  palette: Palette,
  bounds: { x0: number; y0: number; x1: number; y1: number },
) {
  ctx.fillStyle = palette.bank
  ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0)
  ctx.strokeStyle = palette.bankLine
  ctx.fillStyle = palette.bankLine
  ctx.lineWidth = 3

  if (theme === 'tile') {
    const size = 90
    ctx.beginPath()
    for (let x = Math.floor(bounds.x0 / size) * size; x < bounds.x1; x += size) {
      ctx.moveTo(x, bounds.y0)
      ctx.lineTo(x, bounds.y1)
    }
    for (let y = Math.floor(bounds.y0 / size) * size; y < bounds.y1; y += size) {
      ctx.moveTo(bounds.x0, y)
      ctx.lineTo(bounds.x1, y)
    }
    ctx.stroke()
  } else if (theme === 'brick') {
    const bw = 110
    const bh = 46
    ctx.beginPath()
    const firstRow = Math.floor(bounds.y0 / bh)
    for (let row = firstRow; row * bh < bounds.y1; row++) {
      const y = row * bh
      ctx.moveTo(bounds.x0, y)
      ctx.lineTo(bounds.x1, y)
      const shift = row % 2 === 0 ? 0 : bw / 2
      for (
        let x = Math.floor(bounds.x0 / bw) * bw + shift;
        x < bounds.x1;
        x += bw
      ) {
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + bh)
      }
    }
    ctx.stroke()
  } else if (theme === 'frost') {
    // Snowflakes in a staggered drift, each with six arms.
    const size = 130
    ctx.lineCap = 'round'
    ctx.beginPath()
    const firstRow = Math.floor(bounds.y0 / size)
    for (let row = firstRow; row * size < bounds.y1 + size; row++) {
      const shift = row % 2 === 0 ? 0 : size / 2
      const firstColumn = Math.floor(bounds.x0 / size) - 1
      for (let column = firstColumn; column * size < bounds.x1 + size; column++) {
        const x = column * size + shift
        const y = row * size
        for (let arm = 0; arm < 3; arm++) {
          const a = (arm / 3) * Math.PI
          const dx = Math.cos(a) * 20
          const dy = Math.sin(a) * 20
          ctx.moveTo(x - dx, y - dy)
          ctx.lineTo(x + dx, y + dy)
        }
      }
    }
    ctx.stroke()
  } else {
    const size = 170
    ctx.beginPath()
    for (let x = Math.floor(bounds.x0 / size) * size; x < bounds.x1; x += size) {
      ctx.moveTo(x, bounds.y0)
      ctx.lineTo(x, bounds.y1)
    }
    for (let y = Math.floor(bounds.y0 / size) * size; y < bounds.y1; y += size) {
      ctx.moveTo(bounds.x0, y)
      ctx.lineTo(bounds.x1, y)
    }
    ctx.stroke()
    for (let x = Math.floor(bounds.x0 / size) * size; x < bounds.x1; x += size) {
      for (let y = Math.floor(bounds.y0 / size) * size; y < bounds.y1; y += size) {
        for (const [dx, dy] of [
          [16, 16],
          [size - 16, 16],
          [16, size - 16],
          [size - 16, size - 16],
        ]) {
          ctx.beginPath()
          ctx.arc(x + dx, y + dy, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }
}

function drawWater(
  ctx: CanvasRenderingContext2D,
  world: World,
  palette: Palette,
  bounds: { x0: number; y0: number; x1: number; y1: number },
) {
  const { left, right, samples } = world.course
  const channel = new Path2D()
  left.forEach((p, i) =>
    i === 0 ? channel.moveTo(p.x, p.y) : channel.lineTo(p.x, p.y),
  )
  for (let i = right.length - 1; i >= 0; i--) channel.lineTo(right[i].x, right[i].y)
  channel.closePath()

  ctx.fillStyle = palette.water
  ctx.fill(channel)

  ctx.save()
  ctx.clip(channel)

  // Ripples are a fixed scatter in world space, drifting gently with the clock.
  ctx.strokeStyle = palette.ripple
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  const grid = 120
  for (let gx = Math.floor(bounds.x0 / grid); gx * grid < bounds.x1; gx++) {
    for (let gy = Math.floor(bounds.y0 / grid); gy * grid < bounds.y1; gy++) {
      const seed = Math.abs(Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453) % 1
      const x = gx * grid + seed * 80
      const y =
        gy * grid + ((seed * 7) % 1) * 80 + Math.sin(world.clock + seed * 6) * 6
      const len = 14 + seed * 18
      ctx.beginPath()
      ctx.moveTo(x - len, y)
      ctx.quadraticCurveTo(x, y - 8, x + len, y)
      ctx.stroke()
    }
  }

  // Ice sheets sit on top of the water, scratched by everyone who slid off them.
  for (const sheet of world.ice) {
    const ice = new Path2D()
    for (let i = sheet.from; i <= sheet.to; i++) {
      if (i === sheet.from) ice.moveTo(left[i].x, left[i].y)
      else ice.lineTo(left[i].x, left[i].y)
    }
    for (let i = sheet.to; i >= sheet.from; i--) ice.lineTo(right[i].x, right[i].y)
    ice.closePath()
    ctx.fillStyle = 'rgba(176,228,250,0.9)'
    ctx.fill(ice)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 3
    ctx.stroke(ice)
    for (let i = sheet.from + 1; i < sheet.to; i += 2) {
      const s = samples[i]
      if (s.x < bounds.x0 - 100 || s.x > bounds.x1 + 100) continue
      if (s.y < bounds.y0 - 100 || s.y > bounds.y1 + 100) continue
      const seed = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1
      const across = (seed * 2 - 1) * s.hw * 0.75
      const length = 16 + seed * 26
      const x = s.x + s.nx * across
      const y = s.y + s.ny * across
      ctx.beginPath()
      ctx.moveTo(x - s.tx * length, y - s.ty * length)
      ctx.lineTo(x + s.tx * length + s.nx * 10, y + s.ty * length + s.ny * 10)
      ctx.stroke()
    }
  }

  // Currents read as streaks running along the channel.
  for (const current of world.currents) {
    ctx.fillStyle = palette.waterDeep
    for (let i = current.from; i < current.to; i += 2) {
      const s = samples[i]
      if (s.x < bounds.x0 - 300 || s.x > bounds.x1 + 300) continue
      if (s.y < bounds.y0 - 300 || s.y > bounds.y1 + 300) continue
      for (let lane = -2; lane <= 2; lane++) {
        const flow =
          (world.clock * Math.sign(current.strength) * 2.2 + i * 0.5 + lane) % 1
        const px = s.x + s.nx * lane * s.hw * 0.35 + s.tx * flow * 40
        const py = s.y + s.ny * lane * s.hw * 0.35 + s.ty * flow * 40
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(Math.atan2(s.ty, s.tx))
        ctx.fillRect(-16, -2.5, 32, 5)
        ctx.restore()
      }
    }
  }
  ctx.restore()
}

function drawBanding(
  ctx: CanvasRenderingContext2D,
  world: World,
  index: number,
  flag: boolean,
) {
  const { left, right } = world.course
  const a = left[index]
  const b = right[index]
  const squares = 14
  const dx = (b.x - a.x) / squares
  const dy = (b.y - a.y) / squares
  const nx = -dy
  const ny = dx
  const depth = flag ? 1 : 0.35
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < squares; i++) {
      ctx.fillStyle = (i + row) % 2 === 0 ? (flag ? '#fff' : '#fff4dc') : INK
      ctx.globalAlpha = flag ? 1 : 0.55
      ctx.beginPath()
      const ox = a.x + dx * i + nx * row * depth
      const oy = a.y + dy * i + ny * row * depth
      ctx.moveTo(ox, oy)
      ctx.lineTo(ox + dx, oy + dy)
      ctx.lineTo(ox + dx + nx * depth, oy + dy + ny * depth)
      ctx.lineTo(ox + nx * depth, oy + ny * depth)
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

/** A Persian bathroom hose, coiled on the bank with its nozzle dripping over the wall. */
function drawShelang(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  clock: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(5, 0)
  // Two and a half turns outwards, ending on the side facing the water.
  for (let turn = 0; turn <= 2.5; turn += 0.05) {
    const a = turn * Math.PI * 2 + Math.PI
    const r = 5 + turn * 15
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.quadraticCurveTo(55, 30, SCENERY_GAP - 10, 0)
  ctx.strokeStyle = INK
  ctx.lineWidth = 12
  ctx.stroke()
  ctx.strokeStyle = '#7cc142'
  ctx.lineWidth = 7
  ctx.stroke()
  ctx.strokeStyle = '#f2e23c'
  ctx.lineWidth = 2
  ctx.setLineDash([7, 9])
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = '#c9c9c9'
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(SCENERY_GAP - 12, -7, 24, 14, 3)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 3; i++) {
    const drip = (clock * 0.9 + i / 3) % 1
    ctx.globalAlpha = 1 - drip
    ctx.beginPath()
    ctx.arc(SCENERY_GAP + 16 + drip * 28, Math.sin(i * 2) * 4, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** The plastic ewer found beside every Persian toilet. Its spout faces the water. */
function drawAftabeh(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  flip: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(flip, 1)
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = INK

  // The handle goes first, so that the body covers where it joins.
  ctx.beginPath()
  ctx.moveTo(-14, -22)
  ctx.bezierCurveTo(-46, -30, -46, 12, -20, 8)
  ctx.lineWidth = 9
  ctx.stroke()
  ctx.strokeStyle = '#e4572e'
  ctx.lineWidth = 4
  ctx.stroke()

  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.fillStyle = '#e4572e'
  ctx.beginPath()
  ctx.moveTo(14, -6)
  ctx.lineTo(42, -36)
  ctx.lineTo(50, -30)
  ctx.lineTo(20, 12)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-12, -30)
  ctx.bezierCurveTo(-34, -10, -32, 30, -18, 34)
  ctx.lineTo(18, 34)
  ctx.bezierCurveTo(32, 30, 34, -10, 12, -30)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#fff4dc'
  ctx.beginPath()
  ctx.ellipse(0, -30, 13, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/** A brass samovar with a teapot warming on top, gently steaming. */
function drawSamovar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  clock: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = INK

  ctx.fillStyle = '#d8a13a'
  ctx.beginPath()
  ctx.moveTo(-14, 26)
  ctx.lineTo(-22, 44)
  ctx.lineTo(22, 44)
  ctx.lineTo(14, 26)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(dir * 31, -2, 7, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.roundRect(-26, -24, 52, 52, 14)
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = '#8f6516'
  ctx.beginPath()
  ctx.moveTo(-26, -6)
  ctx.lineTo(26, -6)
  ctx.stroke()
  ctx.strokeStyle = INK

  // The tap.
  ctx.fillStyle = '#2b1a12'
  ctx.fillRect(-4, 6, 8, 16)

  // The teapot on top.
  ctx.fillStyle = '#3f7fbf'
  ctx.beginPath()
  ctx.ellipse(0, -36, 16, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(14, -38)
  ctx.lineTo(25, -44)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 4
  for (let i = 0; i < 2; i++) {
    const rise = (clock * 0.5 + i / 2) % 1
    ctx.globalAlpha = 1 - rise
    ctx.beginPath()
    ctx.moveTo(26, -48 - rise * 14)
    ctx.quadraticCurveTo(32, -54 - rise * 14, 26, -60 - rise * 14)
    ctx.stroke()
  }
  ctx.restore()
}

/** A Persian rug laid out on the bank, with a medallion and a fringe on each end. */
function drawFarsh(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const w = 96
  const h = 66
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.sin(x + y) * 0.2)
  ctx.lineCap = 'butt'

  ctx.strokeStyle = '#fff4dc'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = -h / 2 + 3; i < h / 2; i += 6) {
    ctx.moveTo(-w / 2 - 8, i)
    ctx.lineTo(w / 2 + 8, i)
  }
  ctx.stroke()

  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.fillStyle = '#9e2a2b'
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeRect(-w / 2, -h / 2, w, h)

  ctx.strokeStyle = '#1f3a68'
  ctx.lineWidth = 5
  ctx.strokeRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14)
  ctx.strokeStyle = '#f2b632'
  ctx.lineWidth = 2
  ctx.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24)

  ctx.fillStyle = '#1f3a68'
  ctx.strokeStyle = '#f2b632'
  ctx.beginPath()
  ctx.moveTo(-26, 0)
  ctx.lineTo(0, -17)
  ctx.lineTo(26, 0)
  ctx.lineTo(0, 17)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fff4dc'
  ctx.beginPath()
  ctx.arc(0, 0, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** A pair of plastic bathroom slippers, left a little carelessly. */
function drawDampayi(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.sin(x + y) * 0.4)
  for (const dir of [-1, 1]) {
    ctx.save()
    ctx.translate(dir * 15, dir * -5)
    ctx.rotate(dir * 0.14)
    ctx.lineWidth = 3
    ctx.strokeStyle = INK
    ctx.fillStyle = '#2f6fb5'
    ctx.beginPath()
    ctx.roundRect(-12, -27, 24, 54, 12)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#f6efe2'
    ctx.beginPath()
    ctx.roundRect(-12, -16, 24, 15, 3)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

function drawScenery(
  ctx: CanvasRenderingContext2D,
  course: Course,
  scenery: Scenery,
  clock: number,
) {
  const { x, y } = bankAt(course, scenery.at, scenery.side, SCENERY_GAP)
  const wall = pointAt(course, scenery.at, scenery.side)
  switch (scenery.kind) {
    case 'shelang':
      return drawShelang(ctx, x, y, Math.atan2(wall.y - y, wall.x - x), clock)
    case 'aftabeh':
      return drawAftabeh(ctx, x, y, wall.x < x ? -1 : 1)
    case 'samovar':
      return drawSamovar(ctx, x, y, clock)
    case 'farsh':
      return drawFarsh(ctx, x, y)
    case 'dampayi':
      return drawDampayi(ctx, x, y)
  }
}

function drawCan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  clock: number,
) {
  ctx.save()
  ctx.translate(x, y + Math.sin(clock * 3 + x) * 3)
  ctx.rotate(Math.sin(clock * 2 + y) * 0.15)
  ctx.lineWidth = 3
  ctx.strokeStyle = INK
  ctx.fillStyle = '#e4572e'
  ctx.beginPath()
  ctx.roundRect(
    -CAN_RADIUS * 0.75,
    -CAN_RADIUS,
    CAN_RADIUS * 1.5,
    CAN_RADIUS * 2,
    5,
  )
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fff4dc'
  ctx.fillRect(-CAN_RADIUS * 0.75 + 1.5, -5, CAN_RADIUS * 1.5 - 3, 10)
  ctx.fillStyle = '#c9c9c9'
  ctx.beginPath()
  ctx.ellipse(0, -CAN_RADIUS, CAN_RADIUS * 0.75, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawUrchin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  clock: number,
) {
  const spikes = 12
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(clock * 0.5)
  ctx.fillStyle = '#3c2a4d'
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? URCHIN_RADIUS + 8 : URCHIN_RADIUS - 8
    const a = (i / (spikes * 2)) * Math.PI * 2
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = '#fff'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(x + side * 6, y - 2, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = INK
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(x + side * 5, y - 1, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawWhirl(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  clock: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'rgba(0,0,0,0.13)'
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.rotate(clock * 2.2)
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  for (let arm = 0; arm < 4; arm++) {
    ctx.rotate(Math.PI / 2)
    ctx.beginPath()
    for (let t = 0; t <= 1; t += 0.05) {
      const r = 14 + t * (radius - 22)
      const a = t * 2.4
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.stroke()
  }
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(0, 0, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  ctx.lineCap = 'round'
  ctx.strokeStyle = INK
  ctx.lineWidth = 24
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()
  ctx.strokeStyle = '#f2b632'
  ctx.lineWidth = 16
  ctx.stroke()
  ctx.strokeStyle = INK
  ctx.lineWidth = 16
  ctx.setLineDash([16, 24])
  ctx.lineCap = 'butt'
  ctx.stroke()
  ctx.setLineDash([])
}

function drawFlame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  clock: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = 'rgba(255,190,80,0.35)'
  ctx.lineWidth = 3
  ctx.setLineDash([8, 10])
  ctx.beginPath()
  ctx.arc(0, 0, 120, clock * 0.5, clock * 0.5 + Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#6f6a72'
  ctx.strokeStyle = INK
  ctx.beginPath()
  ctx.arc(0, 0, 20, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  const flicker = 1 + Math.sin(clock * 17 + x) * 0.12
  ctx.fillStyle = '#ff7a1a'
  ctx.beginPath()
  ctx.moveTo(0, -30 * flicker)
  ctx.quadraticCurveTo(15, -4, 0, 8)
  ctx.quadraticCurveTo(-15, -4, 0, -30 * flicker)
  ctx.fill()
  ctx.fillStyle = '#ffd166'
  ctx.beginPath()
  ctx.moveTo(0, -16 * flicker)
  ctx.quadraticCurveTo(7, -2, 0, 5)
  ctx.quadraticCurveTo(-7, -2, 0, -16 * flicker)
  ctx.fill()
  ctx.restore()
}

/** A growing shadow on the water, then the icicle itself comes down into it. */
function drawIcicle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  landing: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 3
  ctx.setLineDash([6, 9])
  ctx.beginPath()
  ctx.arc(0, 0, ICICLE_RADIUS, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  if (landing < ICICLE_WARNING) {
    const closing = 1 - landing / ICICLE_WARNING
    ctx.fillStyle = `rgba(20,50,80,${0.2 + closing * 0.4})`
    ctx.beginPath()
    ctx.arc(0, 0, ICICLE_RADIUS * (0.3 + closing * 0.7), 0, Math.PI * 2)
    ctx.fill()

    // It stays out of sight until the last moment, then drops in from above.
    const falling = Math.max(0, 1 - landing / 0.45)
    if (falling > 0) {
      const lift = (1 - falling * falling) * 260
      ctx.translate(0, -lift)
      ctx.lineWidth = 3
      ctx.strokeStyle = INK
      ctx.fillStyle = '#e4f6ff'
      ctx.beginPath()
      ctx.moveTo(-16, -70)
      ctx.lineTo(16, -70)
      ctx.lineTo(0, 10)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(-8, -64)
      ctx.lineTo(-1, -64)
      ctx.lineTo(-3, -20)
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.restore()
}

const stickerPaths = new Map<string, Path2D>()

function stickerPath(d: string) {
  let path = stickerPaths.get(d)
  if (!path) {
    path = new Path2D(d)
    stickerPaths.set(d, path)
  }
  return path
}

/** Sits on a bean drawn at the origin, whatever scale the bean is drawn at. */
export function drawStickers(ctx: CanvasRenderingContext2D, stickers: StickerId[]) {
  stickers.forEach((id, i) => {
    const { x, y, degrees } = STICKER_SPOTS[i]
    const shapes = STICKERS[id]
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((degrees * Math.PI) / 180)
    ctx.scale(STICKER_SCALE, STICKER_SCALE)
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = STICKER_EDGE
    ctx.lineJoin = 'round'
    for (const { d } of shapes) {
      ctx.fill(stickerPath(d))
      ctx.stroke(stickerPath(d))
    }
    for (const { d, fill } of shapes) {
      ctx.fillStyle = fill
      ctx.fill(stickerPath(d))
    }
    ctx.restore()
  })
}

/** How a bean wobbles right now, as a scale to draw it at. */
function wobbleBean(
  ctx: CanvasRenderingContext2D,
  seat: number,
  blasting: boolean,
  squash: number,
  clock: number,
) {
  const bounce = blasting
    ? Math.sin(clock * 40) * 0.05
    : Math.sin(clock * 3 + seat) * 0.02
  const pop = squash * 1.1
  ctx.scale(1 + pop + bounce, 1 - pop * 0.6 - bounce)
}

/** A kidney-shaped bean, drawn pointing to the bow of the tub. */
function drawBean(
  ctx: CanvasRenderingContext2D,
  seat: number,
  blasting: boolean,
  empty: boolean,
) {
  ctx.fillStyle = BEAN_COLORS[seat]
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-14, -3)
  ctx.bezierCurveTo(-18, -20, 18, -20, 14, -3)
  ctx.bezierCurveTo(19, 12, 8, 18, 3, 11)
  ctx.bezierCurveTo(1, 8, -1, 8, -3, 11)
  ctx.bezierCurveTo(-8, 18, -19, 12, -14, -3)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.beginPath()
  ctx.ellipse(-7, -9, 4, 2.4, -0.5, 0, Math.PI * 2)
  ctx.fill()

  for (const side of [-1, 1]) {
    if (empty) {
      ctx.strokeStyle = INK
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(side * 6 - 3, -7)
      ctx.lineTo(side * 6 + 3, -5)
      ctx.stroke()
    } else {
      const size = blasting ? 5.6 : 4.6
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(side * 6, -6, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.arc(side * 6, -7.5, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.fillStyle = INK
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.2
  ctx.beginPath()
  if (blasting) {
    ctx.ellipse(0, 3, 4.5, 5.5, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.arc(0, 1, 5, 0.25, Math.PI - 0.25)
    ctx.stroke()
  }
}

function drawTub(
  ctx: CanvasRenderingContext2D,
  world: World,
  fx: Effects,
  stickers: BeanStickers,
) {
  ctx.save()
  ctx.translate(world.x, world.y)
  ctx.rotate(world.angle)
  const respawning = world.grace > 0 && Math.floor(world.clock * 12) % 2 === 0
  ctx.globalAlpha = respawning ? 0.45 : 1

  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.roundRect(-36, -58, 72, 124, 30)
  ctx.fill()

  // Claw feet peek out from under the hull.
  ctx.fillStyle = '#d9a441'
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  for (const [x, y] of [
    [-34, -40],
    [34, -40],
    [-34, 40],
    [34, 40],
  ]) {
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  ctx.fillStyle = '#fffdf7'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(-34, -62, 68, 124, 30)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#9fe3e0'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(-26, -54, 52, 108, 22)
  ctx.fill()
  ctx.stroke()

  // Gold taps mark the bow, so everyone can tell which way the tub is facing.
  ctx.fillStyle = '#d9a441'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(-11, -60, 22, 8, 3)
  ctx.fill()
  ctx.stroke()
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(side * 11, -56, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  // Stickers go on last, because the beans sit close enough to cover each other's cheeks.
  for (const part of ['bean', 'stickers']) {
    SEATS.forEach((seat, i) => {
      const { blasting, gas } = world.seats[i]
      ctx.save()
      ctx.translate(seat.lx * 0.8, -seat.ly * 0.92)
      wobbleBean(ctx, i, blasting, fx.squash[i], world.clock)
      if (part === 'bean') drawBean(ctx, i, blasting, gas < 0.1)
      else drawStickers(ctx, stickers[i])
      ctx.restore()
    })
  }
  ctx.restore()
}

export type SceneOptions = {
  font: string
  reducedMotion: boolean
  dir: Messages['dir']
  stickers: BeanStickers
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  world: World,
  cam: Camera,
  fx: Effects,
  w: number,
  h: number,
  options: SceneOptions,
) {
  const palette = PALETTES[world.level.theme]
  const shake = options.reducedMotion ? 0 : fx.shake
  const sx = (Math.random() - 0.5) * shake
  const sy = (Math.random() - 0.5) * shake

  ctx.save()
  ctx.translate(w / 2 + sx, h / 2 + sy)
  ctx.scale(cam.scale, cam.scale)
  ctx.translate(-cam.x, -cam.y)

  const pad = 40
  const bounds = {
    x0: cam.x - w / 2 / cam.scale - pad,
    y0: cam.y - h / 2 / cam.scale - pad,
    x1: cam.x + w / 2 / cam.scale + pad,
    y1: cam.y + h / 2 / cam.scale + pad,
  }
  const visible = (x: number, y: number, margin = 200) =>
    x > bounds.x0 - margin &&
    x < bounds.x1 + margin &&
    y > bounds.y0 - margin &&
    y < bounds.y1 + margin

  drawBank(ctx, world.level.theme, palette, bounds)
  drawWater(ctx, world, palette, bounds)

  const { left, right } = world.course
  for (const index of world.checkpoints) drawBanding(ctx, world, index, false)
  drawBanding(ctx, world, finishIndex(world.course), true)

  ctx.lineJoin = 'round'
  for (const wall of [left, right]) {
    tracePolyline(ctx, wall)
    ctx.strokeStyle = INK
    ctx.lineWidth = 16
    ctx.stroke()
    ctx.strokeStyle = palette.lip
    ctx.lineWidth = 8
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(left[0].x, left[0].y)
  ctx.lineTo(right[0].x, right[0].y)
  ctx.moveTo(left[left.length - 1].x, left[left.length - 1].y)
  ctx.lineTo(right[right.length - 1].x, right[right.length - 1].y)
  ctx.strokeStyle = INK
  ctx.lineWidth = 16
  ctx.stroke()

  // Under the hazards, so that scenery can never hide one.
  for (const scenery of world.level.scenery ?? []) {
    const { x, y } = bankAt(world.course, scenery.at, scenery.side, SCENERY_GAP)
    if (visible(x, y)) drawScenery(ctx, world.course, scenery, world.clock)
  }

  for (const whirl of world.whirls) {
    if (visible(whirl.x, whirl.y))
      drawWhirl(ctx, whirl.x, whirl.y, whirl.radius, world.clock)
  }
  for (const flame of world.flames) {
    if (visible(flame.x, flame.y)) drawFlame(ctx, flame.x, flame.y, world.clock)
  }
  for (const can of world.cans) {
    if (!can.taken && visible(can.x, can.y)) drawCan(ctx, can.x, can.y, world.clock)
  }
  for (const urchin of world.urchins) {
    const p = urchinPosition(urchin, world.clock)
    if (visible(p.x, p.y)) drawUrchin(ctx, p.x, p.y, world.clock)
  }
  for (const gate of world.gates) {
    if (!visible(gate.x, gate.y, 400)) continue
    const bar = gateBar(gate, world.clock)
    drawBar(ctx, bar.ax, bar.ay, bar.bx, bar.by)
  }
  for (const paddle of world.paddles) {
    if (!visible(paddle.x, paddle.y, 300)) continue
    const bar = paddleBar(paddle, world.clock)
    drawBar(ctx, bar.ax, bar.ay, bar.bx, bar.by)
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.arc(paddle.x, paddle.y, 16, 0, Math.PI * 2)
    ctx.fill()
  }

  drawTub(ctx, world, fx, options.stickers)

  // Icicles fall from above, so they come down over the tub.
  for (const icicle of world.icicles) {
    if (visible(icicle.x, icicle.y, 300)) {
      drawIcicle(ctx, icicle.x, icicle.y, icicleLanding(icicle, world.clock))
    }
  }

  for (const puff of fx.puffs) {
    const life = puff.age / puff.life
    ctx.globalAlpha = (1 - life) * 0.75
    ctx.fillStyle = puff.color
    ctx.beginPath()
    ctx.arc(puff.x, puff.y, puff.size * (1 + life * 1.6), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  ctx.direction = options.dir
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const word of fx.words) {
    const life = word.age / word.life
    const pop = Math.min(1, word.age * 14)
    ctx.globalAlpha = life > 0.7 ? (1 - life) / 0.3 : 1
    ctx.font = `${word.size * pop}px ${options.font}`
    ctx.lineWidth = 7
    ctx.strokeStyle = INK
    ctx.strokeText(word.text, word.x, word.y)
    ctx.fillStyle = word.color
    ctx.fillText(word.text, word.x, word.y)
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

/** Screen-space countdown drawn over the course. */
export function drawCountdown(
  ctx: CanvasRenderingContext2D,
  world: World,
  w: number,
  h: number,
  font: string,
  t: Messages,
) {
  const showGo = world.status === 'racing' && world.raceTime < 0.8
  if (world.status !== 'countdown' && !showGo) return
  const text = showGo ? t.fx.go : formatNumber(Math.ceil(world.countdown), t.locale)
  const size = Math.min(w, h) * 0.24
  ctx.font = `${size}px ${font}`
  ctx.direction = t.dir
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.14
  ctx.strokeStyle = INK
  ctx.strokeText(text, w / 2, h * 0.36)
  ctx.fillStyle = showGo ? '#f2b632' : '#fff4dc'
  ctx.fillText(text, w / 2, h * 0.36)
}
