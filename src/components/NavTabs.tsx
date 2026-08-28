import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/flow', label: 'Flow' },
  { to: '/words', label: 'Words' },
  { to: '/trends', label: 'Trends' },
  { to: '/ops', label: 'Ops' },
] as const;

export function NavTabs() {
  return (
    <nav className="nav" aria-label="Views">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={'end' in t ? t.end : false} className={({ isActive }) => (isActive ? 'active' : '')}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
