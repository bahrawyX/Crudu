import { NAV_ITEMS } from '../../routes/paths'
import type { RouteName } from '../../routes/paths'

/**
 * The header, per docs/DESIGN.md 3.0.
 *
 * The logo is a wordmark with a caret after it and a rule under it. The nav is
 * the four entries the design drew — until now three screens sat flush against
 * the top of the viewport and the weakness report was reachable only from a
 * button on the results screen, which is not navigation, it is a patch.
 *
 * The whole thing fades to nothing on the first keystroke and takes
 * pointer-events with it, so the only thing on screen while typing is the text.
 */

export type HeaderProps = {
  readonly current: RouteName
  readonly hidden: boolean
  readonly onNavigate: (name: RouteName) => void
}

export function Header({ current, hidden, onNavigate }: HeaderProps) {
  return (
    <header className="chrome" data-hidden={hidden ? 'true' : 'false'}>
      <button
        type="button"
        className="logo"
        onClick={() => {
          onNavigate('test')
        }}
        aria-label="Crudu, go to the test"
      >
        <span className="logo-stack">
          <span className="logo-word">
            <span>crudu</span>
            <span className="logo-tick" aria-hidden="true" />
          </span>
          <span className="logo-rule" aria-hidden="true" />
        </span>
      </button>

      <nav className="nav" aria-label="Screens">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.name}
            type="button"
            className="nav-item"
            data-active={item.name === current ? 'true' : 'false'}
            aria-current={item.name === current ? 'page' : undefined}
            onClick={() => {
              onNavigate(item.name)
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
