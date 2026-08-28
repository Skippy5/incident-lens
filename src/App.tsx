import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useDatasetStore } from './store';

const Overview = lazy(() => import('./views/Overview'));
const Flow = lazy(() => import('./views/Flow'));
const Words = lazy(() => import('./views/Words'));
const Trends = lazy(() => import('./views/Trends'));
const Ops = lazy(() => import('./views/Ops'));

export default function App() {
  const boot = useDatasetStore((s) => s.boot);
  useEffect(() => {
    void boot();
  }, [boot]);

  return (
    <Suspense fallback={<div className="view">Loading…</div>}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="flow" element={<Flow />} />
          <Route path="words" element={<Words />} />
          <Route path="trends" element={<Trends />} />
          <Route path="ops" element={<Ops />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
