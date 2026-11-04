// Folds the entries in changelog.d/ into CHANGELOG.md. See changelog.d/README.md.
//
//   bun run changelog         preview what the next release would contain
//   bun run changelog 0.2.0   write the release and delete the folded entries

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_URL = 'https://github.com/friedrith/ba-ham-begoozim'
const ROOT = join(import.meta.dir, '..')
export const FRAGMENTS_DIR = join(ROOT, 'changelog.d')
const CHANGELOG = join(ROOT, 'CHANGELOG.md')
const PACKAGE = join(ROOT, 'package.json')

const SECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']

export type Entry = { section: string; text: string }

/** `stickers.added.md` -> Added. Throws on anything else so a typo fails CI. */
export function sectionOf(fileName: string): string {
  const type = /^[a-z0-9-]+\.([a-z]+)\.md$/.exec(fileName)?.[1] ?? ''
  const section = SECTIONS.find((name) => name.toLowerCase() === type)
  if (!section) {
    const types = SECTIONS.join(', ').toLowerCase()
    throw new Error(
      `${fileName}: expected <slug>.<type>.md, with type one of ${types}`,
    )
  }
  return section
}

/** One line of Markdown, linked to the PR when the entry doesn't name one already. */
export function fragmentToText(body: string, pr: number | null): string {
  const text = body
    .trim()
    .replace(/^- /, '')
    .replace(/\s*\n\s*/g, ' ')
  if (!text) throw new Error('empty changelog entry')
  if (pr === null || text.includes('/pull/')) return text
  return `${text.replace(/\.$/, '')} ([#${pr}](${REPO_URL}/pull/${pr})).`
}

/** Squash merges title the commit that added the fragment `... (#123)`. */
export function prFromSubject(subject: string): number | null {
  const match = /\(#(\d+)\)$/.exec(subject.trim())
  return match ? Number(match[1]) : null
}

function renderSections(entries: Entry[]): string {
  return SECTIONS.flatMap((section) => {
    const lines = entries.filter((entry) => entry.section === section)
    if (lines.length === 0) return []
    return [
      `### ${section}\n\n${lines.map(({ text }) => `- ${text}`).join('\n')}\n`,
    ]
  }).join('\n')
}

/** The entries still written by hand under [Unreleased]. Refuses to drop anything. */
export function parseUnreleased(body: string): Entry[] {
  const entries: Entry[] = []
  let section = ''
  for (const line of body.split('\n')) {
    if (!line.trim()) continue
    const heading = /^### (.+)$/.exec(line)?.[1]
    if (heading && SECTIONS.includes(heading)) section = heading
    else if (line.startsWith('- ') && section) {
      entries.push({ section, text: line.slice(2) })
    } else throw new Error(`Can't read this line under [Unreleased]: ${line}`)
  }
  return entries
}

export function buildRelease(
  changelog: string,
  fragments: Entry[],
  version: string,
  date: string,
  sha: string,
): string {
  const start = changelog.indexOf('## [Unreleased]\n')
  const end = changelog.indexOf('\n## [', start + 1)
  const unreleasedLink = /^\[Unreleased\]: .*\/compare\/(.+)\.\.\.master$/m.exec(
    changelog,
  )
  if (start === -1 || end === -1 || !unreleasedLink) {
    throw new Error("CHANGELOG.md doesn't have the expected [Unreleased] layout")
  }
  const heading = '## [Unreleased]\n'
  const entries = [
    ...parseUnreleased(changelog.slice(start + heading.length, end)),
    ...fragments,
  ]
  if (entries.length === 0) throw new Error('Nothing to release')

  const released = `${heading}\n## [${version}] - ${date}\n\n${renderSections(entries)}`
  const links = [
    `[Unreleased]: ${REPO_URL}/compare/${sha}...master`,
    `[${version}]: ${REPO_URL}/compare/${unreleasedLink[1]}...${sha}`,
  ].join('\n')
  return (changelog.slice(0, start) + released + changelog.slice(end)).replace(
    unreleasedLink[0],
    links,
  )
}

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

export function fragmentFiles(): string[] {
  return readdirSync(FRAGMENTS_DIR)
    .filter((name) => name !== 'README.md')
    .sort()
}

function readFragments(): Entry[] {
  return fragmentFiles().map((name) => {
    const path = join(FRAGMENTS_DIR, name)
    const subject = git('log', '--diff-filter=A', '-1', '--format=%s', '--', path)
    return {
      section: sectionOf(name),
      text: fragmentToText(readFileSync(path, 'utf8'), prFromSubject(subject)),
    }
  })
}

if (import.meta.main) {
  const version = process.argv[2]
  const fragments = readFragments()
  if (!version) {
    console.log(renderSections(fragments) || 'No entries in changelog.d/')
  } else {
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Bad version: ${version}`)
    const date = new Date().toISOString().slice(0, 10)
    const sha = git('rev-parse', '--short', 'HEAD')
    const changelog = readFileSync(CHANGELOG, 'utf8')
    writeFileSync(CHANGELOG, buildRelease(changelog, fragments, version, date, sha))
    const pkg = readFileSync(PACKAGE, 'utf8')
    writeFileSync(
      PACKAGE,
      pkg.replace(/"version": ".*?"/, `"version": "${version}"`),
    )
    for (const name of fragmentFiles()) rmSync(join(FRAGMENTS_DIR, name))
    console.log(`Wrote ${version} to CHANGELOG.md. Review and commit it.`)
  }
}
