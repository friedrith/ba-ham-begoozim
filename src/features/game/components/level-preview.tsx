import { memo } from 'react'

import {
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
const MARGIN = 120

const DOT_COLORS: Partial<Record<LevelItem['kind'], string>> = {
  can: 'var(--color-gas)',
  urchin: 'var(--color-ink)',
  flame: 'var(--color-sauce)',
  icicle: 'var(--color-cream)',
  whirl: 'var(--color-mustard)',
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
