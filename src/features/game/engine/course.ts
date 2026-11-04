/** A control point on a course centreline: x, y and the channel's half-width. */
export type ControlPoint = readonly [x: number, y: number, halfWidth: number]

export type Sample = {
  x: number
  y: number
  hw: number
  /** Unit tangent, pointing downstream. */
  tx: number
  ty: number
  /** Unit normal, pointing to the right bank. */
  nx: number
  ny: number
}

export type Vec = { x: number; y: number }

export type Course = {
  samples: Sample[]
  left: Vec[]
  right: Vec[]
}

export const SAMPLE_SPACING = 24

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (p2 - p0) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (3 * p1 - p0 - 3 * p2 + p3) * t3)
  )
}

/** Densely evaluates the spline so it can be resampled at an even spacing. */
function evaluateSpline(path: readonly ControlPoint[]) {
  const points: { x: number; y: number; hw: number }[] = []
  const at = (i: number) => path[Math.max(0, Math.min(path.length - 1, i))]

  for (let i = 0; i < path.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    for (let step = 0; step < 40; step++) {
      const t = step / 40
      points.push({
        x: catmullRom(p0[0], p1[0], p2[0], p3[0], t),
        y: catmullRom(p0[1], p1[1], p2[1], p3[1], t),
        hw: p1[2] + (p2[2] - p1[2]) * t,
      })
    }
  }
  const last = path[path.length - 1]
  points.push({ x: last[0], y: last[1], hw: last[2] })
  return points
}

export function buildCourse(path: readonly ControlPoint[]): Course {
  const dense = evaluateSpline(path)
  const even = [dense[0]]
  let travelled = 0

  for (let i = 1; i < dense.length; i++) {
    travelled += Math.hypot(
      dense[i].x - dense[i - 1].x,
      dense[i].y - dense[i - 1].y,
    )
    if (travelled >= SAMPLE_SPACING) {
      even.push(dense[i])
      travelled = 0
    }
  }

  const samples: Sample[] = even.map((point, i) => {
    const a = even[Math.max(0, i - 1)]
    const b = even[Math.min(even.length - 1, i + 1)]
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const tx = (b.x - a.x) / length
    const ty = (b.y - a.y) / length
    return { x: point.x, y: point.y, hw: point.hw, tx, ty, nx: -ty, ny: tx }
  })

  return {
    samples,
    left: samples.map((s) => ({ x: s.x - s.nx * s.hw, y: s.y - s.ny * s.hw })),
    right: samples.map((s) => ({ x: s.x + s.nx * s.hw, y: s.y + s.ny * s.hw })),
  }
}

/** Resolves a fraction along the course to its sample index. */
export function indexAt(course: Course, at: number) {
  return Math.round(at * (course.samples.length - 1))
}

/** Where direction arrows sit, every `spacing` samples and clear of both ends. */
export function arrowIndices(course: Course, spacing: number) {
  const indices: number[] = []
  const end = course.samples.length - 1 - spacing / 2
  for (let i = spacing / 2; i < end; i += spacing) indices.push(Math.round(i))
  return indices
}

/** A point `at` (0–1) along the course, `offset` (-1 left bank, 1 right bank) across. */
export function pointAt(course: Course, at: number, offset = 0): Vec {
  const s = course.samples[indexAt(course, at)]
  return { x: s.x + s.nx * s.hw * offset, y: s.y + s.ny * s.hw * offset }
}
