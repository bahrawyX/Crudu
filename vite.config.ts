import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    // The engine and the test surface are written against ES2022. Matching the
    // tsconfig target here keeps the shipped bundle free of downlevel helpers
    // that would show up in the keystroke path.
    target: 'es2022',
    sourcemap: true,
  },
})
