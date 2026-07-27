/**
 * Route paths, one per screen in docs/DESIGN.md.
 *
 * Phase 2 mounts TanStack Router against these. Test configuration belongs in
 * the URL search string rather than in a store, so that a link to a specific
 * config is shareable (ARCHITECTURE.md section 5).
 */
export const ROUTES = {
  test: '/',
  results: '/results',
  progress: '/progress',
  weakness: '/weakness',
  settings: '/settings',
} as const

export type RouteName = keyof typeof ROUTES
export type RoutePath = (typeof ROUTES)[RouteName]

/** Nav order in the header, matching docs/DESIGN.md. Results has no nav entry. */
export const NAV_ITEMS = [
  { name: 'test', label: 'Test' },
  { name: 'progress', label: 'Progress' },
  { name: 'weakness', label: 'Weaknesses' },
  { name: 'settings', label: 'Settings' },
] as const satisfies ReadonlyArray<{ name: RouteName; label: string }>
