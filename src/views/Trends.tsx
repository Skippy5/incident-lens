import { useMemo, useState } from 'react';
import { EChart } from '../components/EChart';
import { CATEGORY_COLORS, PRIORITY_COLORS } from '../lib/constants';
import { computeKpis } from '../lib/kpis';
import { buildStory, storySpan } from '../lib/story';
import { buildTermIndex, DEFAULT_FIELDS, displayTerm } from '../lib/tokenize';
import { median } from '../lib/format';
import { useDatasetStore } from '../store';

function daysSpan(rows: { opened_at: Date | null }[]): number {
  const ds = rows.map((r) => r.opened_at).filter((d): d is Date => !!d);
  if (ds.length < 2) return 0;
  return (Math.max(...ds.map((d) => d.getTime())) - Math.min(...ds.map((d) => d.getTime()))) / 86400000;
}

export default function Trends() {
  const rows = useDatasetStore((s) => s.filtered);
  const meta = useDatasetStore((s) => s.meta);
  const [stack, setStack] = useState<'priority' | 'category'>('priority');
  const daily = daysSpan(rows) < 21;
  const redact = meta?.kind === 'upload';
  const k = computeKpis(rows);
  const story = buildStory(rows, redact);

  const volume = useMemo(() => {
    const buckets = new Map<string, Record<string, number>>();
    const keys = new Set<string>();
    for (const r of rows) {
      const b = daily
        ? r.opened_at
          ? r.opened_at.toISOString().slice(0, 10)
          : 'unknown'
        : r.opened_week || 'unknown';
      const dim = stack === 'priority' ? r.priority : r.category;
      keys.add(dim);
      let rec = buckets.get(b);
      if (!rec) {
        rec = {};
        buckets.set(b, rec);
      }
      rec[dim] = (rec[dim] ?? 0) + 1;
    }
    const cats = [...keys].sort();
    const xs = [...buckets.keys()].sort();
    const series = cats.map((c) => ({
      name: c,
      type: 'bar',
      stack: 'v',
      data: xs.map((x) => buckets.get(x)?.[c] ?? 0),
      itemStyle: { color: stack === 'priority' ? PRIORITY_COLORS[c] : CATEGORY_COLORS[c] || '#8A9199' },
    }));
    return { xs, series };
  }, [rows, stack, daily]);

  const mttr = useMemo(() => {
    const buckets = new Map<string, number[]>();
    for (const r of rows) {
      if (r.mttr_hours == null) continue;
      const b = daily
        ? r.opened_at
          ? r.opened_at.toISOString().slice(0, 10)
          : 'unknown'
        : r.opened_week || 'unknown';
      const arr = buckets.get(b) ?? [];
      arr.push(r.mttr_hours);
      buckets.set(b, arr);
    }
    const xs = [...buckets.keys()].sort();
    const data = xs.map((x) => {
      const arr = buckets.get(x)!;
      if (arr.length < 8) return null;
      return median(arr);
    });
    return { xs, data };
  }, [rows, daily]);

  const terms = useMemo(() => {
    const { index, tokensByRow } = buildTermIndex(rows, DEFAULT_FIELDS, redact);
    const top = [...index.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 10);
    const mid = Math.floor(rows.length / 2);
    const rising: { term: string; d: number }[] = [];
    for (const [t, set] of top) {
      let a = 0,
        b = 0;
      for (const i of set) {
        if (i < mid) a++;
        else b++;
      }
      rising.push({ term: displayTerm(t), d: b - a });
    }
    rising.sort((x, y) => y.d - x.d);
    void tokensByRow;
    return { up: rising.filter((x) => x.d > 0).slice(0, 8), down: rising.filter((x) => x.d < 0).slice(-8).reverse() };
  }, [rows, redact]);

  return (
    <div>
      <p className="caption">
        {storySpan(rows)} n={k.n}. {daily ? 'Daily' : 'Weekly'} volume.
      </p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flow-controls">
          <span>Stack by</span>
          <button type="button" className="chip" onClick={() => setStack('priority')}>
            priority
          </button>
          <button type="button" className="chip" onClick={() => setStack('category')}>
            category
          </button>
        </div>
        <EChart
          height={280}
          option={{
            tooltip: { trigger: 'axis' },
            legend: { top: 0 },
            grid: { left: 40, right: 16, top: 32, bottom: 32 },
            dataZoom: [{ type: 'inside' }],
            xAxis: { type: 'category', data: volume.xs, axisLabel: { fontSize: 10 } },
            yAxis: { type: 'value', name: 'tickets' },
            series: volume.series,
          }}
        />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Median MTTR</h3>
        <p className="caption">Mean is pulled by long-tail P1 / bounced tickets; median is the headline. Gaps = n&lt;8.</p>
        <EChart
          height={220}
          option={{
            tooltip: { trigger: 'axis' },
            grid: { left: 40, right: 16, top: 16, bottom: 32 },
            xAxis: { type: 'category', data: mttr.xs, axisLabel: { fontSize: 10 } },
            yAxis: { type: 'value', name: 'hours' },
            series: [{ type: 'line', data: mttr.data, connectNulls: false, color: '#0B5CAB' }],
          }}
        />
      </div>
      <div className="ops-grid">
        <div className="card">
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Rising terms</h3>
          <ul>
            {terms.up.map((t) => (
              <li key={t.term}>
                {t.term} (+{t.d})
              </li>
            ))}
            {!terms.up.length ? <li>Not enough contrast in this span.</li> : null}
          </ul>
        </div>
        <div className="card">
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Falling terms</h3>
          <ul>
            {terms.down.map((t) => (
              <li key={t.term}>
                {t.term} ({t.d})
              </li>
            ))}
            {!terms.down.length ? <li>Not enough contrast in this span.</li> : null}
          </ul>
        </div>
      </div>
      <div className="card story" style={{ marginTop: 16 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Story</h2>
        {story.map((s, i) => (
          <p key={i}>{s}</p>
        ))}
      </div>
    </div>
  );
}
