import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { NavTabs } from './NavTabs';
import { FilterBar } from './FilterBar';
import { Inspector } from './Inspector';
import { PrivacyBanner } from './PrivacyBanner';
import { Toast } from './Toast';
import { Mapper } from './Mapper';
import { useDatasetStore } from '../store';
import { DEMO_BANNER, HOURS_CAPTION } from '../lib/constants';

export function AppShell() {
  const loc = useLocation();
  const inspectorOpen = useDatasetStore((s) => s.inspectorOpen);
  const demoBanner = useDatasetStore((s) => s.demoBanner);
  const pathChip = useDatasetStore((s) => s.pathChip);
  const notesChip = useDatasetStore((s) => s.notesChip);
  const loading = useDatasetStore((s) => s.loading);
  const loadingHint = useDatasetStore((s) => s.loadingHint);
  const mapper = useDatasetStore((s) => s.mapper);
  const filtered = useDatasetStore((s) => s.filtered);
  const rows = useDatasetStore((s) => s.rows);
  const showInspector = inspectorOpen && loc.pathname !== '/';

  return (
    <div className="shell">
      <Header />
      <NavTabs />
      <FilterBar />
      <div className="banners">
        {demoBanner && rows.length > 0 && <div className="banner">{DEMO_BANNER}</div>}
        {pathChip && <div className="banner chip-warn">{pathChip}</div>}
        {notesChip && loc.pathname === '/words' && <div className="banner chip-warn">{notesChip}</div>}
        <div className="banner" style={{ background: 'transparent', border: 0, padding: '0 0 4px', color: 'var(--secondary)' }}>
          {HOURS_CAPTION}
        </div>
      </div>
      {mapper ? <Mapper /> : null}
      {loading ? <div className="view">{loadingHint || 'Loading…'}<div className="skeleton" style={{ marginTop: 12 }} /></div> : null}
      {!loading && rows.length > 0 && filtered.length === 0 ? (
        <div className="view">
          No tickets in this filter.{' '}
          <button type="button" className="chip" onClick={() => useDatasetStore.getState().clearFilters()}>
            Clear filters
          </button>
        </div>
      ) : null}
      <div className={`main-row ${showInspector ? 'with-inspector' : ''}`}>
        <div className="view" style={{ display: loading ? 'none' : undefined }}>
          <Outlet />
        </div>
        {showInspector ? <Inspector /> : null}
      </div>
      <PrivacyBanner />
      <Toast />
    </div>
  );
}
