import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { exposeLatencyMonitor, startLatencyMonitor } from './perf/latency'
import { applyTheme, readStoredPrefs, writePrefs } from './storage/prefs'
import { selectPrefs, usePrefsStore } from './stores/prefsStore'
import './styles/index.css'
import 'uplot/dist/uPlot.min.css'

// Synchronous, before the first paint, which is the whole reason preferences
// live in localStorage rather than in IndexedDB. An asynchronous read here would
// show the default theme first and correct it a frame later.
const { prefs } = readStoredPrefs()

usePrefsStore.setState(prefs)

// A null theme means follow prefers-color-scheme, and applyTheme removes the
// attribute for it. Gating on "has anything been stored" was not enough:
// preferences are written on every config change, so the record exists long
// before anyone opens a theme control, and the stored default pinned every
// visitor to light the first time they touched a chip. DECISIONS 0.5, 4.4.
applyTheme(prefs.theme)

// Only on an actual theme change. Subscribing to the whole store would apply
// the theme every time a config chip moved.
usePrefsStore.subscribe((state, previous) => {
  if (state.theme !== previous.theme) {
    applyTheme(state.theme)
  }

  writePrefs(selectPrefs(state))
})

const container = document.getElementById('root')

if (!container) {
  throw new Error('Crudu: #root is missing from index.html')
}

// Keydown to paint, reported on window as cruduLatency.report().
//
// On in development, and in a production build only when the URL carries ?perf,
// which is how e2e/surface.spec.ts measures the shipped bundle rather than an
// unminified module graph. PerformanceObserver delivers entries in its own task,
// after the frame it measured has already shipped, so nothing here is ever on
// the keystroke path.
if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('perf')) {
  exposeLatencyMonitor(startLatencyMonitor())
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
