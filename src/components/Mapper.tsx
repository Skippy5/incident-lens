import { useState } from 'react';
import { CANON } from '../lib/parse';
import { useDatasetStore } from '../store';

export function Mapper() {
  const mapper = useDatasetStore((s) => s.mapper);
  const apply = useDatasetStore((s) => s.applyMapper);
  const dismiss = useDatasetStore((s) => s.dismissMapper);
  const [map, setMap] = useState<Record<string, string>>(mapper?.mapping ?? {});
  if (!mapper) return null;

  const destOf = (dest: string) => Object.entries(map).find(([, d]) => d === dest)?.[0] ?? '';

  return (
    <div className="mapper">
      <h3 style={{ margin: '0 0 8px' }}>Column mapping</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--secondary)', fontSize: 13 }}>
        Auto-map failed. Choose which CSV column is number and opened_at, then apply. This sheet
        only appears after a failed upload.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, maxWidth: 520 }}>
        {(['number', 'opened_at', 'short_description', 'priority', 'category', 'assignment_group', 'assignment_path'] as const).map(
          (dest) => (
            <label key={dest} style={{ display: 'contents' }}>
              <span>{dest}</span>
              <select
                value={destOf(dest)}
                onChange={(e) => {
                  const next = { ...map };
                  for (const [k, v] of Object.entries(next)) if (v === dest) delete next[k];
                  if (e.target.value) next[e.target.value] = dest;
                  setMap(next);
                }}
              >
                <option value="">—</option>
                {mapper.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          ),
        )}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-accent" onClick={() => apply(map)}>
          Apply mapping
        </button>
        <button type="button" className="chip" onClick={dismiss}>
          Cancel
        </button>
      </div>
      {mapper.preview.length ? (
        <div style={{ overflow: 'auto', marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                {mapper.headers.slice(0, 8).map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mapper.preview.slice(0, 5).map((row, i) => (
                <tr key={i}>
                  {mapper.headers.slice(0, 8).map((h) => (
                    <td key={h}>{row[h]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
void CANON;
