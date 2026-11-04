import { memo } from 'react'

import {
  arrowIndices,
  buildCourse,
  indexAt,
  pointAt,
  type Course,
  type Vec,
} from '../engine/course'
import type { LevelDef, LevelItem } from '../engine/levels'
import { PALETTES } from '../render/scene'

const DOT_RADIUS = 60
const BAR_WIDTH = 45
const MARGIN = 240
const ARROW_SPACING = 40
const ARROW_SIZE = 70
const ARROW_WIDTH = 32
const ARROW_GAP = 120

const DOT_COLORS: Partial<Record<LevelItem['kind'], string>> = {
  can: 'var(--color-gas)',
  urchin: 'var(--color-ink)',
  flame: 'var(--color-sauce)',
  icicle: 'var(--color-cream)',
  whirl: 'var(--color-mustard)',
  samovar: 'var(--color-mustard)',
  atash: 'var(--color-sauce)',
  anar: 'var(--color-sauce)',
}

/** Courses climb the map, so they lie on their side to fit a wide picture. */
function plot({ x, y }: Vec): [number, number] {
  return [-y, x]
}

function points(vecs: Vec[]) {
  return vecs.map((vec) => plot(vec).join(',')).join(' ')
}

/** The outline of the channel between two fractions of the course. */
function stretch(course: Course, from: number, to: number) {
  const start = indexAt(course, from)
  const end = indexAt(course, to) + 1
  return points([
    ...course.left.slice(start, end),
    ...course.right.slice(start, end).toReversed(),
  ])
}

function Bar({ a, b }: { a: Vec; b: Vec }) {
  const [x1, y1] = plot(a)
  const [x2, y2] = plot(b)
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="var(--color-ink)"
      strokeWidth={BAR_WIDTH}
    />
  )
}

/** A chevron on one bank pointing downstream, so the map shows which way the course runs. */
function Arrow({
  course,
  index,
  bank,
}: {
  course: Course
  index: number
  bank: number
}) {
  const { x, y, tx, ty, nx, ny, hw } = course.samples[index]
  const tip = {
    x: x + nx * bank * (hw + ARROW_GAP),
    y: y + ny * bank * (hw + ARROW_GAP),
  }
  const wing = (side: number): Vec => ({
    x: tip.x - tx * ARROW_SIZE + nx * side * ARROW_SIZE,
    y: tip.y - ty * ARROW_SIZE + ny * side * ARROW_SIZE,
  })
  return (
    <polyline
      points={points([wing(-1), tip, wing(1)])}
      fill="none"
      stroke="var(--color-ink)"
      strokeWidth={ARROW_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function Item({
  item,
  course,
  level,
}: {
  item: LevelItem
  course: Course
  level: LevelDef
}) {
  switch (item.kind) {
    case 'ice':
      return <polygon points={stretch(course, item.from, item.to)} fill="white" />
    case 'current':
      return (
        <polygon
          points={stretch(course, item.from, item.to)}
          fill={PALETTES[level.theme].waterDeep}
        />
      )
    case 'farsh':
      return (
        <polygon
          points={points([
            pointAt(course, item.from, item.offset - item.width),
            pointAt(course, item.to, item.offset - item.width),
            pointAt(course, item.to, item.offset + item.width),
            pointAt(course, item.from, item.offset + item.width),
          ])}
          fill="#9b2226"
        />
      )
    case 'anar':
      return (
        <Bar a={pointAt(course, item.at, -0.7)} b={pointAt(course, item.at, 0.7)} />
      )
    case 'gate':
      return (
        <Bar a={pointAt(course, item.at, -1)} b={pointAt(course, item.at, 1)} />
      )
    case 'paddle': {
      const offset = item.offset ?? 0
      return (
        <Bar
          a={pointAt(course, item.at, offset - 0.5)}
          b={pointAt(course, item.at, offset + 0.5)}
        />
      )
    }
    default: {
      const [cx, cy] = plot(pointAt(course, item.at, item.offset))
      return (
        <circle
          cx={cx}
          cy={cy}
          r={DOT_RADIUS}
          fill={DOT_COLORS[item.kind]}
          stroke="var(--color-ink)"
          strokeWidth={18}
        />
      )
    }
  }
}

/** A map of the whole course, drawn from the same data the game plays. */
export const LevelPreview = memo(function LevelPreview({
  level,
}: {
  level: LevelDef
}) {
  const course = buildCourse(level.path)
  const palette = PALETTES[level.theme]
  const corners = [...course.left, ...course.right].map(plot)
  const xs = corners.map(([x]) => x)
  const ys = corners.map(([, y]) => y)
  const minX = Math.min(...xs) - MARGIN
  const minY = Math.min(...ys) - MARGIN
  const width = Math.max(...xs) + MARGIN - minX
  const height = Math.max(...ys) + MARGIN - minY

  return (
    <svg
      aria-hidden="true"
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className="border-ink aspect-[8/3] w-full rounded-xl border-[3px] rtl:-scale-x-100"
      style={{ backgroundColor: palette.bank }}
    >
      {arrowIndices(course, ARROW_SPACING).flatMap((index) =>
        [-1, 1].map((bank) => (
          <Arrow key={index * bank} course={course} index={index} bank={bank} />
        )),
      )}
      <polygon
        points={stretch(course, 0, 1)}
        fill={palette.water}
        stroke={palette.lip}
        strokeWidth={36}
        strokeLinejoin="round"
      />
      {level.items.map((item, index) => (
        <Item key={index} item={item} course={course} level={level} />
      ))}
      <Bar a={pointAt(course, 1, -1)} b={pointAt(course, 1, 1)} />
    </svg>
  )
})
