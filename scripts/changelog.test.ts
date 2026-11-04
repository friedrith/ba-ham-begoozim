import { describe, expect, test } from 'bun:test'

import {
  buildRelease,
  fragmentFiles,
  fragmentToText,
  parseUnreleased,
  prFromSubject,
  sectionOf,
} from './changelog'

const CHANGELOG = `# Changelog

## [Unreleased]

### Fixed

- First fix.

### Added

- Old feature.

### Fixed

- Second fix.

## [0.1.0] - 2026-11-04

First version.

[Unreleased]: https://github.com/friedrith/ba-ham-begoozim/compare/abc123...master
[0.1.0]: https://github.com/friedrith/ba-ham-begoozim/commits/abc123
`

describe('changelog.d', () => {
  test('every entry in the repo has a valid name', () => {
    for (const name of fragmentFiles()) expect(() => sectionOf(name)).not.toThrow()
  })
})

describe('sectionOf', () => {
  test('reads the type from the file name', () => {
    expect(sectionOf('bean-stickers.added.md')).toBe('Added')
    expect(sectionOf('a.fixed.md')).toBe('Fixed')
  })

  test('rejects unknown types and missing types', () => {
    expect(() => sectionOf('stickers.feature.md')).toThrow(
      'expected <slug>.<type>.md',
    )
    expect(() => sectionOf('stickers.md')).toThrow('expected <slug>.<type>.md')
  })
})

describe('fragmentToText', () => {
  test('links the PR in the style of the existing entries', () => {
    expect(fragmentToText('Beans wear stickers.\n', 29)).toBe(
      'Beans wear stickers ([#29](https://github.com/friedrith/ba-ham-begoozim/pull/29)).',
    )
  })

  test('joins wrapped lines and drops a leading bullet', () => {
    expect(fragmentToText('- Beans wear\nstickers.\n', null)).toBe(
      'Beans wear stickers.',
    )
  })

  test('keeps a link written by hand', () => {
    const text =
      'Beans ([#9](https://github.com/friedrith/ba-ham-begoozim/pull/9)).'
    expect(fragmentToText(text, 29)).toBe(text)
  })

  test('rejects an empty entry', () => {
    expect(() => fragmentToText(' \n', 29)).toThrow('empty changelog entry')
  })
})

describe('prFromSubject', () => {
  test('finds the number at the end of a squash title', () => {
    expect(prFromSubject('feat: add stickers (#29)')).toBe(29)
    expect(prFromSubject('feat: fixes #29 properly')).toBeNull()
  })
})

describe('parseUnreleased', () => {
  test('refuses text it would otherwise lose', () => {
    expect(() => parseUnreleased('Some prose.\n')).toThrow("Can't read this line")
    expect(() => parseUnreleased('### Other\n\n- Entry.\n')).toThrow(
      "Can't read this line",
    )
  })
})

describe('buildRelease', () => {
  const release = buildRelease(
    CHANGELOG,
    [{ section: 'Added', text: 'New feature.' }],
    '0.2.0',
    '2026-12-01',
    'def456',
  )

  test('merges hand-written and fragment entries under one heading per section', () => {
    expect(release).toContain(`## [Unreleased]

## [0.2.0] - 2026-12-01

### Added

- Old feature.
- New feature.

### Fixed

- First fix.
- Second fix.

## [0.1.0] - 2026-11-04`)
  })

  test('points the links at the new release', () => {
    expect(release).toContain(`/compare/def456...master
[0.2.0]: https://github.com/friedrith/ba-ham-begoozim/compare/abc123...def456
[0.1.0]: https://github.com/friedrith/ba-ham-begoozim/commits/abc123`)
  })

  test('refuses an empty release', () => {
    const empty = CHANGELOG.replace(
      /## \[Unreleased\][\s\S]*?(?=## \[0\.1\.0\])/,
      '## [Unreleased]\n\n',
    )
    expect(() => buildRelease(empty, [], '0.2.0', '2026-12-01', 'def456')).toThrow(
      'Nothing to release',
    )
  })
})
