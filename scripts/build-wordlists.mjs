/**
 * Builds src/words/en-1000.json and src/words/en-5000.json.
 *
 * Source: github.com/first20hours/google-10000-english, the usa-no-swears
 * variant. That list is derived from the Google Web Trillion Word Corpus n-gram
 * data and is public domain, which is why it is the source and Monkeytype's
 * lists are not: Monkeytype is GPLv3 and this project is not.
 *
 * Deterministic. The same source file always produces the same two arrays, so
 * re-running it and getting a diff means upstream changed, not that the script
 * is flaky.
 *
 * Usage:
 *   node scripts/build-wordlists.mjs           fetch, filter, write
 *   node scripts/build-wordlists.mjs --check    fetch, filter, compare, do not write
 */

import { readFile, writeFile } from 'node:fs/promises'
import { argv, exit } from 'node:process'

const SOURCE_URL =
  'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa-no-swears.txt'

const SOURCE_REPO = 'https://github.com/first20hours/google-10000-english'

/** a-z only. No apostrophes, no accents, no digits, nothing shifted. */
const ALLOWED = /^[a-z]+$/

const MIN_LENGTH = 2
const MAX_LENGTH = 9

const OUTPUTS = [
  { count: 1000, path: 'src/words/en-1000.json' },
  { count: 5000, path: 'src/words/en-5000.json' },
]

async function fetchSource() {
  const response = await fetch(SOURCE_URL)

  if (!response.ok) {
    throw new Error(`${SOURCE_URL} returned ${String(response.status)} ${response.statusText}`)
  }

  return response.text()
}

/**
 * Keeps frequency order. The source is ranked most common first and both the
 * dilution pool in the adaptive generator and the plain calibration tests want
 * common words, so rank is the whole point of the list.
 */
function filterWords(raw) {
  const seen = new Set()
  const words = []

  for (const line of raw.split('\n')) {
    const word = line.trim().toLowerCase()

    if (!ALLOWED.test(word)) continue
    if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) continue
    if (seen.has(word)) continue

    seen.add(word)
    words.push(word)
  }

  return words
}

function serialise(words) {
  return `${JSON.stringify(words, null, 2)}\n`
}

async function readIfPresent(path) {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

async function main() {
  const check = argv.includes('--check')

  const raw = await fetchSource()
  const words = filterWords(raw)

  const largest = OUTPUTS[OUTPUTS.length - 1].count

  if (words.length < largest) {
    throw new Error(
      `filtered to ${String(words.length)} words, need at least ${String(largest)}. ` +
        'Upstream list shrank or the filter is wrong.',
    )
  }

  let drift = false

  for (const { count, path } of OUTPUTS) {
    const slice = words.slice(0, count)

    if (slice.length !== count) {
      throw new Error(`${path}: expected ${String(count)} words, got ${String(slice.length)}`)
    }

    for (const word of slice) {
      if (!ALLOWED.test(word) || word.length < MIN_LENGTH || word.length > MAX_LENGTH) {
        throw new Error(`${path}: "${word}" survived the filter but should not have`)
      }
    }

    const next = serialise(slice)
    const current = await readIfPresent(path)

    if (check) {
      if (current !== next) {
        drift = true
        console.error(`${path} is out of date`)
      }
      continue
    }

    await writeFile(path, next, 'utf8')

    const shortest = slice.reduce((a, b) => (b.length < a.length ? b : a))
    const longest = slice.reduce((a, b) => (b.length > a.length ? b : a))

    console.log(
      `${path}: ${String(slice.length)} words, ` +
        `shortest "${shortest}", longest "${longest}", ` +
        `first "${slice[0]}", last "${slice[slice.length - 1]}"`,
    )
  }

  if (check && drift) {
    console.error(`Run "pnpm words" to regenerate. Source: ${SOURCE_REPO}`)
    exit(1)
  }

  if (!check) {
    console.log(
      `Filtered ${String(words.length)} usable words from ${SOURCE_URL.split('/').pop()}`,
    )
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  exit(1)
})
