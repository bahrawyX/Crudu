import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { exposeLatencyMonitor, startLatencyMonitor } from './perf/latency'
import './styles/index.css'

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
