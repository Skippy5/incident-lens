import { useRef } from 'react';
import { APP_NAME, SAMPLE_META } from '../lib/constants';
import { fmtDate, fmtN } from '../lib/format';
import { useDatasetStore } from '../store';
import type { SampleId } from '../lib/types';

export function Header() {
  const meta = useDatasetStore((s) => s.meta);
  const loadSample = useDatasetStore((s) => s.loadSample);
  const uploadFile = useDatasetStore((s) => s.uploadFile);
  const loading = useDatasetStore((s) => s.loading);
  const ref = useRef<HTMLInputElement>(null);
  const sample = meta?.sampleId ?? 'small';

  return (
    <header className="header">
      <div className="brand">{APP_NAME}</div>
      <div className="dataset-chip">
        <strong>{meta?.name ?? '—'}</strong>
        <span>{meta ? fmtN(meta.n) : '—'} tickets</span>
        <span>
          {fmtDate(meta?.dateMin ?? null)} – {fmtDate(meta?.dateMax ?? null)}
        </span>
      </div>
      <div className="header-spacer" />
      <label>
        <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>
          Sample
        </span>
        <select
          value={meta?.kind === 'upload' ? 'upload' : sample}
          disabled={loading}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'upload') return;
            void loadSample(v as SampleId);
          }}
        >
          <option value="small">Small (~80)</option>
          <option value="medium">Medium (~800)</option>
          <option value="large">Large (~4,000)</option>
          {meta?.kind === 'upload' && <option value="upload">Upload</option>}
        </select>
      </label>
      <button type="button" className="btn btn-accent" onClick={() => ref.current?.click()}>
        Upload CSV
      </button>
      <input
        ref={ref}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void uploadFile(f);
        }}
      />
    </header>
  );
}
void SAMPLE_META;
