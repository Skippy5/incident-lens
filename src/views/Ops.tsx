import { useMemo } from 'react';
import { EChart } from '../components/EChart';
import { bounceByGroup, categoryMix, heatmap, mttrByGroup, pingPongTable, slaByGroup } from '../lib/ops';
import { CATEGORY_COLORS, DOW_ORDER, HOURS_CAPTION } from '../lib/constants';
import { fmtHours, fmtPct } from '../lib/format';
import { useDatasetStore } from '../store';

export default function Ops() {
  const rows = useDatasetStore((s) => s.filtered);
  const setSelection = useDatasetStore((s) => s.setSelection);

  const mttr = useMemo(() => mttrByGroup(rows), [rows]);
  const bounce = useMemo(() => bounceByGroup(rows), [rows]);
  const sla = useMemo(() => slaByGroup(rows), [rows]);
  const mix = useMemo(() => categoryMix(rows), [rows]);
  const heat = useMemo(() => heatmap(rows), [rows]);
  const loops = useMemo(() => pingPongTable(rows), [rows]);

  const heatData: [number, number, number][] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) heatData.push([h, d, heat.grid[d]![h]!]);
  }

  return (
    <div className="ops-grid">
      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>1. MTTR by group</h3>
        <p className="caption">Median hours, P90 tick. Worst first. Open tickets excluded.</p>
        <EChart
          height={260}
          onClick={(p) => {
            const g = mttr[p.dataIndex ?? -1];
            if (g) setSelection({ kind: 'ops', title: `MTTR · ${g.group}`, ticketNumbers: g.tickets, filterHint: { groups: [g.group] } });
          }}
          option={{
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: 120, right: 16, top: 8, bottom: 24 },
            xAxis: { type: 'value', name: 'h' },
            yAxis: { type: 'category', data: mttr.map((m) => m.group).reverse(), axisLabel: { fontSize: 11 } },
            series: [
              {
                type: 'bar',
                data: mttr.map((m) => m.median).reverse(),
                itemStyle: { color: '#0B5CAB' },
                markPoint: {
                  symbol: 'rect',
                  symbolSize: [2, 10],
                  data: mttr.map((m, i) => ({ coord: [m.p90, mttr.length - 1 - i], name: 'p90' })),
                },
              },
            ],
          }}
        />
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>2. Bounce / reassign</h3>
        <p className="caption">% not resolved by origin. Hop-count is a table, not the Flow diagram.</p>
        <EChart
          height={260}
          onClick={(p) => {
            const g = bounce[p.dataIndex ?? -1];
            if (g) setSelection({ kind: 'ops', title: `Bounce · ${g.group}`, ticketNumbers: g.tickets, filterHint: { groups: [g.group] } });
          }}
          option={{
            tooltip: { trigger: 'axis' },
            grid: { left: 120, right: 16, top: 8, bottom: 24 },
            xAxis: { type: 'value', name: '%' },
            yAxis: { type: 'category', data: bounce.map((b) => b.group).reverse() },
            series: [{ type: 'bar', data: bounce.map((b) => Number(b.bouncePct.toFixed(1))).reverse(), itemStyle: { color: '#C27A4A' } }],
          }}
        />
        <p className="caption">
          Mean hops:{' '}
          {bounce.length
            ? (bounce.reduce((s, b) => s + b.meanHops * b.n, 0) / Math.max(1, bounce.reduce((s, b) => s + b.n, 0))).toFixed(2)
            : '—'}
        </p>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>3. SLA</h3>
        <p className="caption">On time / missed. Canceled and open are out of the denominator. Calendar hours, not business hours.</p>
        <EChart
          height={260}
          onClick={(p) => {
            const g = sla.find((x) => x.group === p.name);
            if (!g) return;
            const tickets = p.seriesName === 'Missed' ? g.ticketsMiss : g.ticketsOn;
            setSelection({ kind: 'ops', title: `SLA · ${g.group}`, ticketNumbers: tickets, filterHint: { groups: [g.group] } });
          }}
          option={{
            tooltip: { trigger: 'axis' },
            legend: { top: 0 },
            grid: { left: 120, right: 16, top: 28, bottom: 24 },
            xAxis: { type: 'value' },
            yAxis: { type: 'category', data: sla.map((s) => s.group).reverse() },
            series: [
              { name: 'On time', type: 'bar', stack: 's', data: sla.map((s) => s.on).reverse(), itemStyle: { color: '#5B8A72' } },
              { name: 'Missed', type: 'bar', stack: 's', data: sla.map((s) => s.miss).reverse(), itemStyle: { color: '#C62828' } },
            ],
          }}
        />
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>4. Category mix</h3>
        <EChart
          height={260}
          onClick={(p) => {
            const cat = p.seriesName;
            if (!cat) return;
            const nums = rows.filter((r) => r.category === cat).map((r) => r.number);
            setSelection({ kind: 'ops', title: `Category · ${cat}`, ticketNumbers: nums });
          }}
          option={{
            tooltip: { trigger: 'axis' },
            legend: { top: 0 },
            grid: { left: 40, right: 16, top: 28, bottom: 32 },
            xAxis: { type: 'category', data: mix.weeks, axisLabel: { fontSize: 10 } },
            yAxis: { type: 'value', max: 100, name: '%' },
            series: mix.series.map((s) => ({
              name: s.category,
              type: 'line',
              stack: 'm',
              areaStyle: {},
              showSymbol: false,
              data: s.data,
              itemStyle: { color: CATEGORY_COLORS[s.category] || '#8A9199' },
            })),
          }}
        />
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>5. Hour × weekday</h3>
        <p className="caption">
          {HOURS_CAPTION} Hot cell: {heat.hot.dow} {heat.hot.hour}–{heat.hot.hour + 1} · {heat.hot.n} opens.
        </p>
        <EChart
          height={260}
          onClick={(p) => {
            const v = p.value as [number, number, number] | undefined;
            if (!v) return;
            const [h, d] = v;
            const nums = heat.tickets[d]?.[h] ?? [];
            setSelection({
              kind: 'ops',
              title: `${DOW_ORDER[d]} ${h}–${h + 1}`,
              ticketNumbers: nums,
            });
          }}
          option={{
            tooltip: {
              formatter: (p: { value?: [number, number, number] }) => {
                const v = p.value;
                if (!v) return '';
                return `${DOW_ORDER[v[1]]} ${v[0]}:00 · ${v[2]}`;
              },
            },
            grid: { left: 40, right: 24, top: 8, bottom: 24 },
            xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => String(i)), axisLabel: { fontSize: 9 } },
            yAxis: { type: 'category', data: [...DOW_ORDER] },
            visualMap: { min: 0, max: Math.max(1, heat.hot.n), orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#F6F7F9', '#0B5CAB'] } },
            series: [{ type: 'heatmap', data: heatData, emphasis: { itemStyle: { borderColor: '#1B1F24', borderWidth: 1 } } }],
          }}
        />
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>6. Ping-pong</h3>
        <p className="caption">Pair · tickets · extra hops · extra hours. Click a row for tickets.</p>
        <div style={{ maxHeight: 260, overflow: 'auto' }}>
          {loops.map((l) => (
            <button
              key={l.a + l.b}
              type="button"
              className="loop-row"
              onClick={() =>
                setSelection({
                  kind: 'ops',
                  title: `${l.a} ↔ ${l.b}`,
                  ticketNumbers: l.tickets,
                  filterHint: { groups: [l.a, l.b] },
                })
              }
            >
              {l.a} ↔ {l.b}
              <div>
                {l.n} tickets · extra hops {l.extraHops.toFixed(1)} · extra {fmtHours(l.extraHours)} · bounce share{' '}
                {fmtPct((100 * l.n) / Math.max(rows.length, 1))}
              </div>
            </button>
          ))}
          {!loops.length ? <p className="caption">No ping-pong in this filter.</p> : null}
        </div>
      </div>
    </div>
  );
}
