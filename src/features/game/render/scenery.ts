import { bankAt, bankLine, pointAt, type Course, type Vec } from '../engine/course'
import {
  SCENERY_GAP,
  sceneryRuns,
  type LevelDef,
  type Scenery,
  type Theme,
} from '../engine/levels'

const INK = '#2b1a12'
const BRASS = '#d8a13a'
const BRASS_DARK = '#8f6516'
const COPPER = '#c9743a'
const TURQUOISE = '#1f8a9e'
const LAPIS = '#1f3a68'
const CREAM = '#fff4dc'
const SNOW = '#ffffff'
const ICE = '#cfeafa'

function outline(ctx: CanvasRenderingContext2D, width = 3) {
  ctx.strokeStyle = INK
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
}

function shadow(ctx: CanvasRenderingContext2D, y: number, rx: number, ry: number) {
  ctx.fillStyle = 'rgba(43,26,18,0.22)'
  ctx.beginPath()
  ctx.ellipse(4, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

function shape(ctx: CanvasRenderingContext2D, fill: string) {
  ctx.fillStyle = fill
  ctx.fill()
  ctx.stroke()
}

/** The eight-pointed star of Persian tilework: two squares, one turned by 45°. */
function traceStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const d = i % 2 === 0 ? r : r * 0.72
    if (i === 0) ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
    else ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
  }
  ctx.closePath()
}

/** What each piece stands on, so that it belongs to the floor of its level. */
function drawFooting(ctx: CanvasRenderingContext2D, theme: Theme) {
  if (theme === 'tile') {
    traceStar(ctx, 0, 0, 84)
    ctx.fillStyle = '#d5e8e4'
    ctx.fill()
    ctx.strokeStyle = TURQUOISE
    ctx.lineWidth = 5
    ctx.stroke()
    traceStar(ctx, 0, 0, 70)
    ctx.strokeStyle = BRASS
    ctx.lineWidth = 2
    ctx.stroke()
  } else if (theme === 'brick') {
    // A round of bricks laid on edge, the way old cisterns are floored.
    ctx.fillStyle = '#a8644b'
    ctx.beginPath()
    ctx.arc(0, 0, 82, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#6a3626'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (const r of [82, 58, 34]) {
      ctx.moveTo(r, 0)
      ctx.arc(0, 0, r, 0, Math.PI * 2)
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      const [from, to] = i % 2 === 0 ? [34, 58] : [58, 82]
      ctx.moveTo(Math.cos(a) * from, Math.sin(a) * from)
      ctx.lineTo(Math.cos(a) * to, Math.sin(a) * to)
    }
    ctx.stroke()
  } else if (theme === 'iron') {
    ctx.fillStyle = '#56525b'
    ctx.strokeStyle = '#1d1b20'
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2
      if (i === 0) ctx.moveTo(Math.cos(a) * 84, Math.sin(a) * 84)
      else ctx.lineTo(Math.cos(a) * 84, Math.sin(a) * 84)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#8b8791'
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(Math.cos(a) * 72, Math.sin(a) * 72, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.fillStyle = SNOW
    for (const [x, y, r] of [
      [0, 18, 62],
      [-40, 30, 40],
      [42, 28, 42],
      [-16, -22, 44],
      [24, -18, 40],
    ]) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/**
 * The hose, clay pipe or copper pipe that carries the water along one bank, from
 * the first piece of scenery through the others to the shelang at the end.
 */
function drawLine(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  points: Vec[],
  path: Path2D,
) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (theme === 'tile' || theme === 'frost') {
    const frozen = theme === 'frost'
    ctx.strokeStyle = INK
    ctx.lineWidth = 12
    ctx.stroke(path)
    ctx.strokeStyle = frozen ? '#a9cfa0' : '#7cc142'
    ctx.lineWidth = 7
    ctx.stroke(path)
    ctx.strokeStyle = frozen ? SNOW : '#f2e23c'
    ctx.lineWidth = 2
    ctx.setLineDash([7, 9])
    ctx.stroke(path)
    ctx.setLineDash([])
    if (frozen) {
      ctx.fillStyle = ICE
      outline(ctx, 2)
      for (let i = 2; i < points.length; i += 4) {
        const { x, y } = points[i]
        ctx.beginPath()
        ctx.moveTo(x - 6, y + 4)
        ctx.lineTo(x, y + 20 + (i % 3) * 5)
        ctx.lineTo(x + 6, y + 4)
        ctx.closePath()
        shape(ctx, ICE)
      }
    }
    return
  }

  const clay = theme === 'brick'
  ctx.strokeStyle = INK
  ctx.lineWidth = clay ? 20 : 15
  ctx.stroke(path)
  ctx.strokeStyle = clay ? '#c4764a' : COPPER
  ctx.lineWidth = clay ? 14 : 9
  ctx.stroke(path)
  ctx.strokeStyle = clay ? '#dd9a6c' : '#f0a976'
  ctx.lineWidth = 3
  ctx.stroke(path)

  // Clay pipes are socketed end to end, and copper is held by a flange.
  for (let i = 1; i < points.length - 1; i += clay ? 2 : 3) {
    const a = points[i - 1]
    const b = points[i + 1]
    const { x, y } = points[i]
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x))
    outline(ctx, 2.5)
    ctx.beginPath()
    ctx.roundRect(-4, clay ? -13 : -11, 8, clay ? 26 : 22, 2)
    shape(ctx, clay ? '#a85c34' : '#8b8791')
    ctx.restore()
  }
}

/** A tiled niche from a hammam wall, with the tap that feeds the rest of the bank. */
function drawKashi(ctx: CanvasRenderingContext2D, clock: number) {
  shadow(ctx, 62, 56, 12)
  outline(ctx)
  const arch = (inset: number) => {
    ctx.beginPath()
    ctx.moveTo(-48 + inset, 56)
    ctx.lineTo(-48 + inset, -18)
    ctx.quadraticCurveTo(-46 + inset, -44 + inset * 0.3, 0, -78 + inset * 1.5)
    ctx.quadraticCurveTo(46 - inset, -44 + inset * 0.3, 48 - inset, -18)
    ctx.lineTo(48 - inset, 56)
    ctx.closePath()
  }
  arch(0)
  shape(ctx, '#e9dcc0')
  arch(7)
  shape(ctx, LAPIS)

  ctx.save()
  arch(7)
  ctx.clip()
  for (let row = 0; row < 5; row++) {
    for (let column = -2; column <= 2; column++) {
      const x = column * 26 + (row % 2) * 13
      const y = -56 + row * 24
      traceStar(ctx, x, y, 11)
      ctx.fillStyle = TURQUOISE
      ctx.fill()
      ctx.strokeStyle = BRASS
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = CREAM
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()

  // The stone basin, with the tap dripping into it.
  outline(ctx)
  ctx.beginPath()
  ctx.ellipse(0, 54, 36, 14, 0, 0, Math.PI * 2)
  shape(ctx, '#d9d3c5')
  ctx.beginPath()
  ctx.ellipse(0, 52, 26, 8, 0, 0, Math.PI * 2)
  shape(ctx, '#37c1c7')
  ctx.beginPath()
  ctx.roundRect(-5, 12, 10, 18, 3)
  shape(ctx, BRASS)
  ctx.beginPath()
  ctx.roundRect(-13, 6, 26, 8, 3)
  shape(ctx, BRASS)
  const drop = (clock * 1.1) % 1
  ctx.fillStyle = SNOW
  ctx.beginPath()
  ctx.arc(0, 32 + drop * 18, 3, 0, Math.PI * 2)
  ctx.fill()
}

/** The copper bowl of the hammam, with a kiseh and a bar of soap beside it. */
function drawTas(ctx: CanvasRenderingContext2D, clock: number) {
  shadow(ctx, 30, 58, 14)

  // A striped lung, the bath wrap, folded under the kiseh.
  outline(ctx)
  ctx.beginPath()
  ctx.roundRect(14, -60, 54, 46, 4)
  shape(ctx, '#e8d9c0')
  ctx.strokeStyle = '#9e2a2b'
  ctx.lineWidth = 4
  ctx.beginPath()
  for (const x of [24, 36, 48, 58]) {
    ctx.moveTo(x, -58)
    ctx.lineTo(x, -16)
  }
  ctx.stroke()

  // The kiseh: a coarse black scrubbing mitt.
  outline(ctx)
  ctx.beginPath()
  ctx.roundRect(24, -50, 32, 26, 9)
  shape(ctx, '#4a4038')
  ctx.strokeStyle = '#8c7e70'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(29, -44 + i * 6)
    ctx.lineTo(51, -44 + i * 6)
  }
  ctx.stroke()

  // The soap, wet and a little worn down.
  outline(ctx)
  ctx.beginPath()
  ctx.roundRect(30, 28, 34, 20, 7)
  shape(ctx, '#e7c9d8')
  ctx.fillStyle = SNOW
  ctx.beginPath()
  ctx.arc(62, 28, 5, 0, Math.PI * 2)
  ctx.arc(55, 25, 3, 0, Math.PI * 2)
  ctx.fill()

  // The bowl.
  outline(ctx)
  ctx.beginPath()
  ctx.moveTo(-58, 4)
  ctx.bezierCurveTo(-54, 44, 18, 44, 22, 4)
  ctx.closePath()
  shape(ctx, COPPER)
  ctx.strokeStyle = BRASS_DARK
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < 7; i++) {
    const x = -46 + i * 13
    ctx.moveTo(x, 14)
    ctx.lineTo(x + 6.5, 24)
    ctx.lineTo(x + 13, 14)
  }
  ctx.stroke()
  outline(ctx)
  ctx.beginPath()
  ctx.ellipse(-18, 4, 40, 15, 0, 0, Math.PI * 2)
  shape(ctx, '#e39a5f')
  ctx.beginPath()
  ctx.ellipse(-18, 5, 32, 10, 0, 0, Math.PI * 2)
  shape(ctx, '#37c1c7')
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(
    -18,
    5,
    10 + ((clock * 8) % 16),
    3 + ((clock * 8) % 16) * 0.3,
    0,
    0,
    Math.PI * 2,
  )
  ctx.stroke()
}

/** The plastic ewer found beside every Persian toilet. Its spout faces the water. */
function drawAftabeh(ctx: CanvasRenderingContext2D, flip: number, theme: Theme) {
  shadow(ctx, 38, 40, 10)
  ctx.save()
  ctx.scale(flip, 1)
  outline(ctx)

  const frozen = theme === 'frost'
  const body = frozen ? '#c9604a' : '#e4572e'

  // The handle goes first, so that the body covers where it joins.
  ctx.beginPath()
  ctx.moveTo(-14, -22)
  ctx.bezierCurveTo(-46, -30, -46, 12, -20, 8)
  ctx.lineWidth = 9
  ctx.stroke()
  ctx.strokeStyle = body
  ctx.lineWidth = 4
  ctx.stroke()

  outline(ctx)
  ctx.beginPath()
  ctx.moveTo(14, -6)
  ctx.lineTo(42, -36)
  ctx.lineTo(50, -30)
  ctx.lineTo(20, 12)
  ctx.closePath()
  shape(ctx, body)

  ctx.beginPath()
  ctx.moveTo(-12, -30)
  ctx.bezierCurveTo(-34, -10, -32, 30, -18, 34)
  ctx.lineTo(18, 34)
  ctx.bezierCurveTo(32, 30, 34, -10, 12, -30)
  ctx.closePath()
  shape(ctx, body)

  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-17, -12)
  ctx.quadraticCurveTo(-23, 6, -17, 22)
  ctx.stroke()

  outline(ctx)
  ctx.beginPath()
  ctx.ellipse(0, -30, 13, 5, 0, 0, Math.PI * 2)
  shape(ctx, frozen ? SNOW : CREAM)

  if (frozen) {
    // Snow on the lid and an icicle hanging off the spout.
    ctx.beginPath()
    ctx.ellipse(0, -35, 17, 8, 0, 0, Math.PI * 2)
    shape(ctx, SNOW)
    ctx.beginPath()
    ctx.moveTo(40, -32)
    ctx.lineTo(47, -8)
    ctx.lineTo(50, -30)
    ctx.closePath()
    shape(ctx, ICE)
  }
  ctx.restore()
}

/** Plastic bathroom slippers, and the wet footprints of whoever kicked them off. */
function drawDampayi(ctx: CanvasRenderingContext2D, flip: number) {
  ctx.fillStyle = 'rgba(31,58,104,0.28)'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.ellipse(
      flip * (32 + i * 16),
      26 - i * 24,
      6,
      10,
      flip * 0.3,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  for (const dir of [-1, 1]) {
    ctx.save()
    ctx.translate(dir * 17 - flip * 14, dir * -6)
    ctx.rotate(dir * 0.16)
    ctx.fillStyle = 'rgba(43,26,18,0.22)'
    ctx.beginPath()
    ctx.roundRect(-10, -25, 26, 58, 13)
    ctx.fill()
    outline(ctx)
    ctx.beginPath()
    ctx.roundRect(-13, -29, 26, 58, 13)
    shape(ctx, '#2f6fb5')
    ctx.strokeStyle = '#7db0e0'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(-7, 6 + i * 5)
      ctx.lineTo(7, 6 + i * 5)
    }
    ctx.stroke()
    outline(ctx)
    ctx.beginPath()
    ctx.roundRect(-13, -18, 26, 16, 3)
    shape(ctx, '#f6efe2')
    ctx.restore()
  }
}

/** The mouth of a qanat shaft: spoil heaped around it and a windlass over the well. */
function drawQanat(ctx: CanvasRenderingContext2D, clock: number) {
  outline(ctx)
  ctx.beginPath()
  ctx.ellipse(0, 16, 76, 50, 0, 0, Math.PI * 2)
  shape(ctx, '#c79a68')
  ctx.fillStyle = '#a97c4c'
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4
    const r = 46 + (i % 4) * 7
    ctx.beginPath()
    ctx.arc(Math.cos(a) * r, 16 + Math.sin(a) * r * 0.62, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  outline(ctx)
  ctx.beginPath()
  ctx.ellipse(0, 14, 44, 28, 0, 0, Math.PI * 2)
  shape(ctx, '#a8533a')
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    ctx.moveTo(Math.cos(a) * 44, 14 + Math.sin(a) * 28)
    ctx.lineTo(Math.cos(a) * 32, 14 + Math.sin(a) * 19)
  }
  ctx.stroke()
  outline(ctx)
  ctx.beginPath()
  ctx.ellipse(0, 14, 32, 19, 0, 0, Math.PI * 2)
  shape(ctx, '#17100b')
  // The water far below catches the light.
  ctx.strokeStyle = '#5f8f5a'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(0, 18, 10 + Math.sin(clock * 2) * 3, 4, 0, 0, Math.PI * 2)
  ctx.stroke()

  outline(ctx)
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(dir * 48, 16)
    ctx.lineTo(dir * 44, -44)
    ctx.lineWidth = 9
    ctx.stroke()
    ctx.strokeStyle = '#8a5a30'
    ctx.lineWidth = 4
    ctx.stroke()
    outline(ctx)
  }
  ctx.beginPath()
  ctx.roundRect(-50, -52, 100, 13, 6)
  shape(ctx, '#a97343')
  ctx.strokeStyle = '#e8d9c0'
  ctx.lineWidth = 3
  ctx.beginPath()
  for (const x of [-10, -5, 0, 5, 10]) {
    ctx.moveTo(x, -52)
    ctx.lineTo(x, -39)
  }
  ctx.moveTo(0, -39)
  const bob = Math.sin(clock * 1.2) * 4
  ctx.lineTo(0, -6 + bob)
  ctx.stroke()
  outline(ctx)
  ctx.beginPath()
  ctx.moveTo(-11, -6 + bob)
  ctx.lineTo(11, -6 + bob)
  ctx.lineTo(8, 12 + bob)
  ctx.lineTo(-8, 12 + bob)
  ctx.closePath()
  shape(ctx, '#8b8791')
}

/** A brick badgir, the windcatcher, cooling the domed cistern at its foot. */
function drawBadgir(ctx: CanvasRenderingContext2D) {
  shadow(ctx, 58, 72, 12)
  outline(ctx)

  // The cistern's dome, with its arched doorway.
  ctx.beginPath()
  ctx.moveTo(-18, 56)
  ctx.bezierCurveTo(-18, 6, 22, -12, 26, -14)
  ctx.bezierCurveTo(30, -12, 72, 6, 72, 56)
  ctx.closePath()
  shape(ctx, '#d6b27c')
  ctx.strokeStyle = '#a97c4c'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (const y of [8, 22, 36]) {
    const half = 12 + (y + 14) * 0.5
    ctx.moveTo(26 - half, y)
    ctx.quadraticCurveTo(26, y + 6, 26 + half, y)
  }
  ctx.stroke()
  outline(ctx)
  ctx.beginPath()
  ctx.moveTo(14, 56)
  ctx.lineTo(14, 40)
  ctx.quadraticCurveTo(26, 22, 38, 40)
  ctx.lineTo(38, 56)
  ctx.closePath()
  shape(ctx, INK)

  // The tower, with its vents up top and a band of turquoise.
  ctx.beginPath()
  ctx.rect(-54, -72, 42, 128)
  shape(ctx, '#b5683f')
  ctx.strokeStyle = '#6a3626'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let row = 0; row < 6; row++) {
    const y = -8 + row * 10
    ctx.moveTo(-54, y)
    ctx.lineTo(-12, y)
    for (let x = row % 2 === 0 ? -46 : -40; x < -12; x += 12) {
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + 10)
    }
  }
  ctx.stroke()
  ctx.fillStyle = INK
  for (const x of [-49, -39, -29, -19]) {
    ctx.beginPath()
    ctx.moveTo(x, -22)
    ctx.lineTo(x, -54)
    ctx.quadraticCurveTo(x + 3, -60, x + 6, -54)
    ctx.lineTo(x + 6, -22)
    ctx.closePath()
    ctx.fill()
  }
  outline(ctx)
  ctx.beginPath()
  ctx.rect(-58, -18, 50, 9)
  shape(ctx, TURQUOISE)
  ctx.beginPath()
  ctx.rect(-58, -80, 50, 9)
  shape(ctx, '#8a4b38')
}

/** The rooftop water tank of every Iranian house, here feeding the boiler room. */
function drawManba(ctx: CanvasRenderingContext2D, clock: number) {
  shadow(ctx, 66, 54, 10)
  outline(ctx, 5)
  for (const x of [-34, 34]) {
    ctx.beginPath()
    ctx.moveTo(x, 20)
    ctx.lineTo(x * 1.2, 64)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(-40, 46)
  ctx.lineTo(40, 46)
  ctx.stroke()

  outline(ctx)
  ctx.beginPath()
  ctx.moveTo(-46, -46)
  ctx.lineTo(-46, 22)
  ctx.bezierCurveTo(-46, 42, 46, 42, 46, 22)
  ctx.lineTo(46, -46)
  ctx.closePath()
  shape(ctx, '#2f6fb5')
  ctx.strokeStyle = '#1f4f8c'
  ctx.lineWidth = 3
  ctx.beginPath()
  for (const y of [-22, 2]) {
    ctx.moveTo(-46, y)
    ctx.bezierCurveTo(-46, y + 16, 46, y + 16, 46, y)
  }
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(-33, -32)
  ctx.lineTo(-33, 18)
  ctx.stroke()

  // The sight tube shows the water level, and it never quite settles.
  outline(ctx)
  ctx.beginPath()
  ctx.roundRect(22, -30, 11, 48, 4)
  shape(ctx, CREAM)
  ctx.fillStyle = '#37c1c7'
  const level = -10 + Math.sin(clock * 0.8) * 4
  ctx.fillRect(24, level, 7, 16 - level)

  outline(ctx)
  ctx.beginPath()
  ctx.ellipse(0, -46, 46, 14, 0, 0, Math.PI * 2)
  shape(ctx, '#3f83cc')
  ctx.beginPath()
  ctx.ellipse(0, -50, 20, 7, 0, 0, Math.PI * 2)
  shape(ctx, '#f6efe2')
}

/** The blue pump that keeps the pressure up, shaking on its mounts. */
function drawTolombeh(ctx: CanvasRenderingContext2D, clock: number) {
  shadow(ctx, 44, 70, 10)
  ctx.save()
  ctx.translate(Math.sin(clock * 37) * 0.8, Math.cos(clock * 41) * 0.8)
  outline(ctx)
  ctx.beginPath()
  ctx.roundRect(-64, 32, 128, 12, 3)
  shape(ctx, '#8b8791')

  // The motor, ribbed for cooling.
  ctx.beginPath()
  ctx.roundRect(-58, -26, 72, 58, 12)
  shape(ctx, '#2f6fb5')
  ctx.strokeStyle = '#1f4f8c'
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let x = -48; x <= 4; x += 10) {
    ctx.moveTo(x, -22)
    ctx.lineTo(x, 28)
  }
  ctx.stroke()

  // The volute and the gauge on its outlet.
  outline(ctx)
  ctx.beginPath()
  ctx.arc(32, 6, 28, 0, Math.PI * 2)
  shape(ctx, '#3f83cc')
  ctx.beginPath()
  ctx.arc(32, 6, 11, 0, Math.PI * 2)
  shape(ctx, '#f6efe2')
  ctx.beginPath()
  ctx.roundRect(24, -42, 16, 22, 2)
  shape(ctx, COPPER)
  ctx.beginPath()
  ctx.arc(32, -54, 16, 0, Math.PI * 2)
  shape(ctx, CREAM)
  const needle = -0.4 + Math.sin(clock * 3) * 0.25
  ctx.beginPath()
  ctx.moveTo(32, -54)
  ctx.lineTo(32 + Math.cos(needle) * 11, -54 + Math.sin(needle) * 11)
  ctx.stroke()
  ctx.restore()
}

/** A tall enamel abgarmkon, the water heater, with its pilot light showing. */
function drawAbgarmkon(ctx: CanvasRenderingContext2D, clock: number) {
  shadow(ctx, 66, 42, 10)
  outline(ctx)

  // The flue, venting up and away.
  ctx.beginPath()
  ctx.roundRect(-8, -82, 16, 24, 2)
  shape(ctx, '#8b8791')

  for (const x of [-22, 22]) {
    ctx.beginPath()
    ctx.moveTo(x, 50)
    ctx.lineTo(x * 1.3, 68)
    ctx.lineWidth = 6
    ctx.stroke()
  }

  outline(ctx)
  ctx.beginPath()
  ctx.roundRect(-34, -66, 68, 120, 26)
  shape(ctx, '#ece6d6')
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(-23, -40)
  ctx.lineTo(-23, 28)
  ctx.stroke()
  ctx.strokeStyle = '#c9bfa5'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-34, -28)
  ctx.lineTo(34, -28)
  ctx.moveTo(-34, 22)
  ctx.lineTo(34, 22)
  ctx.stroke()

  // Thermostat dial.
  outline(ctx)
  ctx.beginPath()
  ctx.arc(4, -8, 14, 0, Math.PI * 2)
  shape(ctx, CREAM)
  ctx.fillStyle = '#c0392b'
  ctx.beginPath()
  ctx.arc(4, -8, 14, -0.2, 0.7)
  ctx.lineTo(4, -8)
  ctx.closePath()
  ctx.fill()
  outline(ctx)
  ctx.beginPath()
  ctx.arc(4, -8, 14, 0, Math.PI * 2)
  ctx.moveTo(4, -8)
  ctx.lineTo(14, -2)
  ctx.stroke()

  // The little window with the flame in it.
  ctx.beginPath()
  ctx.roundRect(-13, 28, 26, 22, 6)
  shape(ctx, INK)
  const flicker = Math.sin(clock * 11) * 2
  ctx.fillStyle = '#ff9d2e'
  ctx.beginPath()
  ctx.moveTo(-6, 46)
  ctx.quadraticCurveTo(-5, 38 + flicker, 0, 32 + flicker)
  ctx.quadraticCurveTo(5, 38 + flicker, 6, 46)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#3f83cc'
  ctx.beginPath()
  ctx.arc(0, 45, 3, 0, Math.PI * 2)
  ctx.fill()

  // Hot-water valve with its red wheel.
  outline(ctx)
  ctx.beginPath()
  ctx.roundRect(34, 4, 18, 11, 2)
  shape(ctx, COPPER)
  ctx.beginPath()
  ctx.arc(50, -4, 11, 0, Math.PI * 2)
  ctx.moveTo(39, -4)
  ctx.lineTo(61, -4)
  ctx.moveTo(50, -15)
  ctx.lineTo(50, 7)
  ctx.strokeStyle = '#c0392b'
  ctx.lineWidth = 4
  ctx.stroke()
}

/** A yakhchal, the old Persian ice house: a stepped cone keeping winter inside. */
function drawYakhchal(ctx: CanvasRenderingContext2D) {
  shadow(ctx, 58, 62, 12)
  outline(ctx)
  ctx.beginPath()
  ctx.moveTo(-62, 58)
  ctx.bezierCurveTo(-52, 6, -22, -56, 0, -78)
  ctx.bezierCurveTo(22, -56, 52, 6, 62, 58)
  ctx.closePath()
  shape(ctx, '#d6b27c')
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = '#a97c4c'
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let y = -50; y < 58; y += 15) {
    ctx.moveTo(-70, y + 4)
    ctx.quadraticCurveTo(0, y + 14, 70, y + 4)
  }
  ctx.stroke()
  // The snow settles thickest on the crown.
  ctx.fillStyle = SNOW
  ctx.beginPath()
  ctx.moveTo(-34, -22)
  ctx.quadraticCurveTo(-20, -8, -10, -24)
  ctx.quadraticCurveTo(2, -10, 12, -26)
  ctx.quadraticCurveTo(24, -8, 36, -22)
  ctx.lineTo(0, -90)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  outline(ctx)
  ctx.beginPath()
  ctx.moveTo(-62, 58)
  ctx.bezierCurveTo(-52, 6, -22, -56, 0, -78)
  ctx.bezierCurveTo(22, -56, 52, 6, 62, 58)
  ctx.closePath()
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-18, 58)
  ctx.lineTo(-18, 34)
  ctx.quadraticCurveTo(0, 8, 18, 34)
  ctx.lineTo(18, 58)
  ctx.closePath()
  shape(ctx, '#1f3a4f')
  for (const x of [-11, 0, 11]) {
    ctx.beginPath()
    ctx.moveTo(x - 4, 30 - Math.abs(x) * 0.4 - 2)
    ctx.lineTo(x, 46)
    ctx.lineTo(x + 4, 30 - Math.abs(x) * 0.4 - 2)
    ctx.closePath()
    shape(ctx, ICE)
  }
}

/** A hawz, the courtyard pool, frozen over with its goldfish still circling beneath. */
function drawHawz(ctx: CanvasRenderingContext2D, clock: number) {
  const octagon = (rx: number, ry: number) => {
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2
      if (i === 0) ctx.moveTo(Math.cos(a) * rx, Math.sin(a) * ry)
      else ctx.lineTo(Math.cos(a) * rx, Math.sin(a) * ry)
    }
    ctx.closePath()
  }
  outline(ctx)
  octagon(84, 62)
  shape(ctx, TURQUOISE)
  ctx.strokeStyle = BRASS
  ctx.lineWidth = 2
  octagon(76, 55)
  ctx.stroke()
  outline(ctx)
  octagon(68, 49)
  shape(ctx, '#6fb7dd')

  ctx.save()
  octagon(68, 49)
  ctx.clip()
  // The goldfish go round under the ice.
  for (let i = 0; i < 2; i++) {
    const a = clock * 0.5 + i * Math.PI
    const x = Math.cos(a) * 36
    const y = Math.sin(a) * 22
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(a + Math.PI / 2)
    ctx.fillStyle = '#f2732e'
    ctx.beginPath()
    ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2)
    ctx.moveTo(-9, 0)
    ctx.lineTo(-19, -6 + Math.sin(clock * 6) * 2)
    ctx.lineTo(-19, 6 + Math.sin(clock * 6) * 2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = 'rgba(214,240,252,0.55)'
  ctx.fillRect(-90, -60, 180, 120)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-50, -20)
  ctx.lineTo(-14, -6)
  ctx.lineTo(-22, 22)
  ctx.moveTo(-14, -6)
  ctx.lineTo(26, -14)
  ctx.lineTo(48, 6)
  ctx.moveTo(26, -14)
  ctx.lineTo(34, -40)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = SNOW
  for (const [x, y, r] of [
    [-62, -32, 12],
    [-44, -46, 9],
    [60, 34, 13],
    [40, 48, 9],
  ]) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** A snowy sarv. The cypress with the bent tip is where the paisley comes from. */
function drawSarv(ctx: CanvasRenderingContext2D, clock: number) {
  shadow(ctx, 66, 30, 8)
  outline(ctx)
  ctx.beginPath()
  ctx.roundRect(-6, 46, 12, 22, 2)
  shape(ctx, '#6a4a2e')

  const sway = Math.sin(clock * 0.9) * 2
  const tree = () => {
    ctx.beginPath()
    ctx.moveTo(0, 52)
    ctx.bezierCurveTo(-46, 44, -40, -28, -8, -58)
    ctx.bezierCurveTo(0, -68, 12 + sway, -84, 26 + sway, -76)
    ctx.bezierCurveTo(20 + sway, -68, 22, -58, 24, -46)
    ctx.bezierCurveTo(42, -10, 42, 44, 0, 52)
    ctx.closePath()
  }
  tree()
  shape(ctx, '#2c5d46')
  ctx.save()
  tree()
  ctx.clip()
  ctx.strokeStyle = '#3f7a5e'
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let y = -40; y < 50; y += 14) {
    ctx.moveTo(-40, y + 16)
    ctx.quadraticCurveTo(0, y - 10, 44, y + 16)
  }
  ctx.stroke()
  ctx.fillStyle = SNOW
  for (const [x, y, rx, ry] of [
    [10, -62, 20, 9],
    [-6, -34, 22, 7],
    [18, -14, 18, 6],
    [-18, 8, 20, 6],
    [14, 26, 20, 6],
  ]) {
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, -0.3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  outline(ctx)
  tree()
  ctx.stroke()
}

/**
 * A shelang, the bathroom hose: where the bank's line ends. Coiled up, with its
 * nozzle over the wall, dripping into the channel, or frozen stiff on the frost levels.
 */
function drawShelang(
  ctx: CanvasRenderingContext2D,
  angle: number,
  theme: Theme,
  clock: number,
) {
  const frozen = theme === 'frost'
  ctx.save()
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
  ctx.quadraticCurveTo(62, 30, SCENERY_GAP - 10, 0)
  ctx.strokeStyle = INK
  ctx.lineWidth = 12
  ctx.stroke()
  ctx.strokeStyle = frozen ? '#a9cfa0' : '#7cc142'
  ctx.lineWidth = 7
  ctx.stroke()
  ctx.strokeStyle = frozen ? SNOW : '#f2e23c'
  ctx.lineWidth = 2
  ctx.setLineDash([7, 9])
  ctx.stroke()
  ctx.setLineDash([])

  outline(ctx)
  ctx.beginPath()
  ctx.roundRect(SCENERY_GAP - 12, -8, 26, 16, 3)
  shape(ctx, '#c9c9c9')
  ctx.beginPath()
  ctx.roundRect(SCENERY_GAP + 11, -11, 6, 22, 2)
  shape(ctx, BRASS)

  const tip = SCENERY_GAP + 19
  if (frozen) {
    ctx.beginPath()
    ctx.moveTo(tip, -8)
    ctx.lineTo(tip + 30, 0)
    ctx.lineTo(tip, 8)
    ctx.closePath()
    shape(ctx, ICE)
  } else {
    ctx.fillStyle = SNOW
    for (let i = 0; i < 3; i++) {
      const drip = (clock * 0.9 + i / 3) % 1
      ctx.globalAlpha = 1 - drip
      ctx.beginPath()
      ctx.arc(tip + drip * 30, Math.sin(i * 2) * 4, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  course: Course,
  scenery: Scenery,
  theme: Theme,
  clock: number,
) {
  const { x, y } = bankAt(course, scenery.at, scenery.side, SCENERY_GAP)
  const wall = pointAt(course, scenery.at, scenery.side)
  const towardsWater = wall.x < x ? -1 : 1
  ctx.save()
  ctx.translate(x, y)
  drawFooting(ctx, theme)
  switch (scenery.kind) {
    case 'kashi':
      drawKashi(ctx, clock)
      break
    case 'tas':
      drawTas(ctx, clock)
      break
    case 'aftabeh':
      drawAftabeh(ctx, towardsWater, theme)
      break
    case 'dampayi':
      drawDampayi(ctx, towardsWater)
      break
    case 'qanat':
      drawQanat(ctx, clock)
      break
    case 'badgir':
      drawBadgir(ctx)
      break
    case 'manba':
      drawManba(ctx, clock)
      break
    case 'tolombeh':
      drawTolombeh(ctx, clock)
      break
    case 'abgarmkon':
      drawAbgarmkon(ctx, clock)
      break
    case 'yakhchal':
      drawYakhchal(ctx)
      break
    case 'hawz':
      drawHawz(ctx, clock)
      break
    case 'sarv':
      drawSarv(ctx, clock)
      break
    case 'shelang':
      drawShelang(ctx, Math.atan2(wall.y - y, wall.x - x), theme, clock)
      break
  }
  ctx.restore()
}

type Line = { points: Vec[]; path: Path2D }

/** The bank lines never change during a race, so each course traces them once. */
const LINES = new WeakMap<Course, Line[]>()

function linesFor(course: Course, scenery: readonly Scenery[]) {
  const cached = LINES.get(course)
  if (cached) return cached
  const lines = sceneryRuns(scenery).map(({ from, to, side }) => {
    const points = bankLine(course, from, to, side, SCENERY_GAP)
    const path = new Path2D()
    points.forEach((p, i) =>
      i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y),
    )
    return { points, path }
  })
  LINES.set(course, lines)
  return lines
}

export function drawScenery(
  ctx: CanvasRenderingContext2D,
  course: Course,
  level: Pick<LevelDef, 'scenery' | 'theme'>,
  clock: number,
  visible: (x: number, y: number) => boolean,
) {
  const scenery = level.scenery
  if (!scenery) return
  for (const { points, path } of linesFor(course, scenery)) {
    if (points.some((p) => visible(p.x, p.y))) {
      drawLine(ctx, level.theme, points, path)
    }
  }
  for (const piece of scenery) {
    const { x, y } = bankAt(course, piece.at, piece.side, SCENERY_GAP)
    if (visible(x, y)) drawPiece(ctx, course, piece, level.theme, clock)
  }
}
