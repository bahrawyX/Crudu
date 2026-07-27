import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Crudu: #root is missing from index.html')
}

// Nothing renders yet. Phase 2 mounts the router here. The root exists now so
// that the build, the token stylesheet and the font preload are exercised from
// the first commit rather than from the first screen.
createRoot(container).render(<StrictMode />)
