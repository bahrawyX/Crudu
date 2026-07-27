import { TestScreen } from './components/test'

/**
 * Phase 2 ships the test screen and nothing else. The header, the results
 * screen and the router arrive in later phases; there is deliberately no
 * navigation to anywhere that does not exist yet.
 */
export function App() {
  return <TestScreen />
}
