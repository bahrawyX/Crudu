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
const { prefs, stored } = readStoredPrefs()

usePrefsStore.setState(prefs)

// Only write data-theme when the user has actually chosen. Writing the default
// would pin every first-time visitor to light and silently defeat
// prefers-color-scheme, which DECISIONS 0.5 exists to preserve.
if (stored) {
  applyTheme(prefs.theme)
}

// Only on an actual theme change. Subscribing to the whole store would apply
// the theme every time a config chip moved, which would pin a first-time
// visitor to light the moment they touched anything.
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
