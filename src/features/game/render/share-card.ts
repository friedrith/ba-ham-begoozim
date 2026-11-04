import type { Messages } from '../i18n'
import { formatNumber, formatTime } from '../i18n'
import { MAX_STARS, type RankId } from '../progress'
import type { Award } from '../tally'
import { BEAN_COLORS, BEAN_ICON_PATH } from './scene'

const SIZE = 1080
const MARGIN = 60
const INK = '#2b1a12'
const CREAM = '#fff4dc'
const SAUCE = '#d9441f'
const MUSTARD = '#f2b632'
const GAME_URL = 'gooz.zendegi.io'

export type ShareCardRun = {
  rank: RankId
  stars: number
  levelName: string
  time: number
  harmonies: number
  wipeouts: number
  awards: Award[]
}

type Fonts = { display: string; body: string }

/** Draws text at `size`, or smaller if that would run past `width`. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  font: string,
) {
  ctx.font = `${size}px ${font}`
  const measured = ctx.measureText(text).width
  if (measured > width) ctx.font = `${(size * width) / measured}px ${font}`
  ctx.fillText(text, x, y)
}

function drawBean(
  ctx: CanvasRenderingContext2D,
  seat: number,
  x: number,
  y: number,
  scale: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = BEAN_COLORS[seat]
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  const body = new Path2D(BEAN_ICON_PATH)
  ctx.fill(body)
  ctx.stroke(body)
  for (const eye of [-6, 6]) {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(eye, -6, 4.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.arc(eye, -7.5, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-5, 2)
  ctx.quadraticCurveTo(0, 8, 5, 2)
  ctx.stroke()
  ctx.restore()
}

function drawCrown(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = MUSTARD
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-14, 6)
  ctx.lineTo(-17, -9)
  ctx.lineTo(-7, -1)
  ctx.lineTo(0, -13)
  ctx.lineTo(7, -1)
  ctx.lineTo(17, -9)
  ctx.lineTo(14, 6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/** The square picture players post. Everything on it is from this device, nothing is sent. */
export function drawShareCard(
  canvas: HTMLCanvasElement,
  run: ShareCardRun,
  t: Messages,
  fonts: Fonts,
) {
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const number = (value: number | string) => formatNumber(value, t.locale)
  const king = run.rank === 'king'
  const center = SIZE / 2
  const textWidth = SIZE - MARGIN * 2

  // Gold goes on the frame, since a gold card would hide the crown and the yellow bean.
  ctx.fillStyle = king ? MUSTARD : INK
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = CREAM
  ctx.beginPath()
  ctx.roundRect(24, 24, SIZE - 48, SIZE - 48, 56)
  ctx.fill()

  ctx.direction = t.dir
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = SAUCE
  fitText(ctx, t.menuTitle, center, 104, textWidth, 52, fonts.display)

  drawBean(ctx, 0, center - 300, 270, 3.6)
  drawBean(ctx, 3, center + 300, 270, 3.6)
  drawBean(ctx, 2, center - 165, 300, 4)
  drawBean(ctx, 1, center + 165, 300, 4)
  if (king) drawCrown(ctx, center, 262, 5)

  ctx.fillStyle = INK
  fitText(ctx, t.ranks[run.rank], center, 474, textWidth, 112, fonts.display)
  fitText(
    ctx,
    t.menu.totalStars(`${number(run.stars)}/${number(MAX_STARS)}`),
    center,
    558,
    textWidth,
    42,
    fonts.body,
  )
  fitText(
    ctx,
    `${run.levelName} · ${formatTime(run.time, t.locale)} · ${t.result.harmonies} ${number(run.harmonies)} · ${t.result.wipeouts} ${number(run.wipeouts)}`,
    center,
    612,
    textWidth,
    34,
    fonts.body,
  )

  // Each bean's cell mirrors in Persian, so its text still reads away from its face.
  ctx.textAlign = 'start'
  const rtl = t.dir === 'rtl'
  const beanInset = 64
  const textInset = 128
  const cellWidth = (SIZE - MARGIN * 2) / 2
  run.awards.forEach((award, seat) => {
    const column = seat % 2
    const top = 660 + Math.floor(seat / 2) * 158
    const start = rtl
      ? SIZE - MARGIN - column * cellWidth
      : MARGIN + column * cellWidth
    const inward = rtl ? -1 : 1
    const room = cellWidth - textInset - 12
    const text = t.awards[award.id]
    drawBean(ctx, seat, start + inward * beanInset, top + 70, 2.6)
    ctx.fillStyle = INK
    fitText(
      ctx,
      t.seats[seat].name,
      start + inward * textInset,
      top + 26,
      room,
      26,
      fonts.body,
    )
    fitText(
      ctx,
      text.title,
      start + inward * textInset,
      top + 70,
      room,
      40,
      fonts.display,
    )
    fitText(
      ctx,
      text.detail(number(award.value)),
      start + inward * textInset,
      top + 114,
      room,
      26,
      fonts.body,
    )
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = SAUCE
  ctx.direction = 'ltr'
  fitText(ctx, GAME_URL, center, 1012, textWidth, 40, fonts.display)
}
