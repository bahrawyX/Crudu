import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

/**
 * The bundle budget gate.
 *
 * ARCHITECTURE.md section 10 puts the initial JavaScript at 150kB gzipped, and
 * src/perf/budget.ts holds the number. This reads it from there rather than
 * repeating it, so there is one place to argue with.
 *
 * What counts as "initial" is read out of the emitted index.html: the module
 * script plus everything modulepreloaded. A route split later would add lazy
 * chunks that a user does not wait for, and globbing dist/assets would quietly
 * start counting them.
 *
 * The size is the gzip of the real emitted bytes. rollup-plugin-visualizer's
 * per-module gzipLength is what explains a failure, but the sum of it is not the
 * bundle's size — gzip does not compose, and a shared dictionary across one
 * chunk compresses better than the pieces do apart.
 *
 * kB is 1000 bytes, not 1024, because that is what `vite build` prints. The two
 * conventions differ by 2.4% and reporting the other one here would mean the
 * gate and the build output disagreed about the same file.
 */

const DIST = 'dist'
const KB = 1000
const BUDGET_SOURCE = 'src/perf/budget.ts'

function readBudgetKb() {
  const source = readFileSync(BUDGET_SOURCE, 'utf8')
  const match = /initialBundleGzipKb:\s*(\d+(?:\.\d+)?)/.exec(source)

  if (match?.[1] === undefined) {
    throw new Error(`cannot find initialBundleGzipKb in ${BUDGET_SOURCE}`)
  }

  return Number(match[1])
}

function initialScripts() {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8')
  const found = new Set()

  for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) {
    found.add(src)
  }

  for (const [, href] of html.matchAll(
    /<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g,
  )) {
    found.add(href)
  }

  return [...found].map((path) => path.replace(/^\//, ''))
}

/** The biggest contributors, so a failure says what to go and look at. */
function topModules(limit) {
  const statsPath = join(DIST, 'stats.json')

  if (!existsSync(statsPath)) {
    return []
  }

  const stats = JSON.parse(readFileSync(statsPath, 'utf8'))
  const byModule = new Map()

  for (const part of Object.values(stats.nodeParts ?? {})) {
    const meta = stats.nodeMetas?.[part.metaUid]
    const id = meta?.id ?? 'unknown'
    const name = id.includes('node_modules')
      ? `node_modules/${id.split('node_modules/').at(-1).split('/').slice(0, 2).join('/')}`
      : id

    byModule.set(name, (byModule.get(name) ?? 0) + (part.gzipLength ?? 0))
  }

  return [...byModule.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

const budgetKb = readBudgetKb()
const scripts = initialScripts()

if (scripts.length === 0) {
  console.error('no initial scripts found in dist/index.html — did the build run?')
  process.exit(1)
}

let totalGzip = 0

console.log('Initial JavaScript:')

for (const script of scripts) {
  const bytes = readFileSync(join(DIST, script))
  const gzip = gzipSync(bytes).length

  totalGzip += gzip
  console.log(
    `  ${script}  ${(bytes.length / KB).toFixed(1)} kB raw  ${(gzip / KB).toFixed(1)} kB gzip`,
  )
}

const totalKb = totalGzip / KB
const headroom = budgetKb - totalKb

console.log(
  `\n  total ${totalKb.toFixed(1)} kB gzip against a ${String(budgetKb)} kB budget ` +
    `(${headroom >= 0 ? '' : '-'}${Math.abs(headroom).toFixed(1)} kB ${headroom >= 0 ? 'to spare' : 'over'})`,
)

if (headroom < 0) {
  console.error('\nOver budget. Biggest contributors by gzipped module size:')

  for (const [name, size] of topModules(12)) {
    console.error(`  ${(size / KB).toFixed(1).padStart(7)} kB  ${name}`)
  }

  console.error('\ndist/stats.html has the full treemap.')
  process.exit(1)
}
