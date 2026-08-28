import { useEffect, useMemo, useRef, useState } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, select } from 'd3';
import { buildWordGraph } from '../lib/words';
import { DEFAULT_FIELDS, type TokenFields } from '../lib/tokenize';
import { useDatasetStore } from '../store';

const PALETTE = ['#0B5CAB', '#C27A4A', '#5B8A72', '#7A6BA6', '#C62828', '#1565C0', '#6B8E23', '#EF6C00'];

export default function Words() {
  const rows = useDatasetStore((s) => s.filtered);
  const meta = useDatasetStore((s) => s.meta);
  const notesChip = useDatasetStore((s) => s.notesChip);
  const setSelection = useDatasetStore((s) => s.setSelection);
  const [q, setQ] = useState('');
  const [fields, setFields] = useState<TokenFields>(DEFAULT_FIELDS);
  const [minDf, setMinDf] = useState<number | ''>('');
  const [phrasesOnly, setPhrasesOnly] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const simRef = useRef<{ stop: () => void } | null>(null);

  const graph = useMemo(
    () =>
      buildWordGraph(rows, {
        fields,
        minDf: minDf === '' ? undefined : Number(minDf),
        phrasesOnly,
        redact: meta?.kind === 'upload',
        datasetId: meta?.id ?? 'x',
      }),
    [rows, fields, minDf, phrasesOnly, meta?.id, meta?.kind],
  );

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.replaceChildren();
    const width = el.clientWidth || 800;
    const height = el.clientHeight || 560;
    const svg = select(el)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    if (graph.tooFew || !graph.nodes.length) {
      svg
        .append('text')
        .attr('x', 24)
        .attr('y', 40)
        .attr('fill', '#5C6570')
        .text('Not enough repeated language in this filter. Widen the date range or pick a larger sample.');
      return;
    }

    type N = (typeof graph.nodes)[number] & { x: number; y: number; vx?: number; vy?: number };
    const nodes: N[] = graph.nodes.map((n, i) => ({
      ...n,
      x: width / 2 + (i % 7) * 12,
      y: height / 2 + Math.floor(i / 7) * 12,
    }));
    const links = graph.edges.map((e) => ({ ...e }));

    const linkSel = svg
      .append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#E2E5EA')
      .attr('stroke-width', (d) => Math.max(0.5, Math.sqrt(d.weight)));

    const nodeSel = svg
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer')
      .on('click', (ev, d) => {
        ev.stopPropagation();
        setSelection({
          kind: 'word',
          title: d.label,
          ticketNumbers: d.tickets,
        });
      });

    const r = (df: number) => 4 + Math.sqrt(df) * 1.6;
    nodeSel
      .append('circle')
      .attr('r', (d) => r(d.df))
      .attr('fill', (d) => PALETTE[d.community % PALETTE.length]!)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);
    nodeSel
      .append('text')
      .attr('dy', (d) => r(d.df) + 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#1B1F24')
      .text((d) => d.label);

    const sim = forceSimulation(nodes)
      .force(
        'link',
        forceLink(links)
          .id((d) => (d as N).id)
          .distance(54)
          .strength(0.4),
      )
      .force('charge', forceManyBody().strength(-80))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'collide',
        forceCollide<N>().radius((d) => r(d.df) + 14),
      )
      .stop();

    const ticks = 280;
    for (let i = 0; i < ticks; i++) sim.tick();
    sim.stop();
    simRef.current = sim;

    linkSel
      .attr('x1', (d) => (d.source as unknown as N).x)
      .attr('y1', (d) => (d.source as unknown as N).y)
      .attr('x2', (d) => (d.target as unknown as N).x)
      .attr('y2', (d) => (d.target as unknown as N).y);
    nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);

    // fit
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 40;
    const maxX = Math.max(...xs) + 40;
    const minY = Math.min(...ys) - 40;
    const maxY = Math.max(...ys) + 40;
    svg.attr('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);

    return () => {
      sim.stop();
    };
  }, [graph, rows, setSelection]);

  useEffect(() => {
    const el = host.current;
    if (!el || !q) {
      select(el).selectAll('g').attr('opacity', 1);
      return;
    }
    const qq = q.toLowerCase();
    select(el)
      .selectAll('g')
      .attr('opacity', function () {
        const t = select(this).select('text').text().toLowerCase();
        if (!t) return 1;
        return t.includes(qq) ? 1 : 0.15;
      });
  }, [q, graph]);

  return (
    <div>
      {notesChip ? <div className="banner chip-warn">{notesChip}</div> : null}
      <div className="flow-controls">
        <input
          placeholder="Find a word…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ height: 28, border: '1px solid var(--hairline)', borderRadius: 6, padding: '0 8px' }}
        />
        <span className="caption">size = tickets · color = topic</span>
      </div>
      <div className="cluster-chips">
        {graph.clusters.map((c) => (
          <button
            key={c.id}
            type="button"
            className="chip"
            style={{ borderColor: PALETTE[c.id % PALETTE.length] }}
            onClick={() =>
              setSelection({ kind: 'cluster', title: c.label, ticketNumbers: c.tickets })
            }
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="words-host" ref={host} />
      <details className="advanced">
        <summary>Advanced</summary>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <label>
            Min frequency{' '}
            <input
              type="number"
              min={1}
              value={minDf}
              onChange={(e) => setMinDf(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ width: 64 }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={fields.short_description}
              onChange={(e) => setFields({ ...fields, short_description: e.target.checked })}
            />{' '}
            short_description
          </label>
          <label>
            <input
              type="checkbox"
              checked={fields.work_notes}
              onChange={(e) => setFields({ ...fields, work_notes: e.target.checked })}
            />{' '}
            work_notes
          </label>
          <label>
            <input
              type="checkbox"
              checked={fields.close_notes}
              onChange={(e) => setFields({ ...fields, close_notes: e.target.checked })}
            />{' '}
            close_notes
          </label>
          <label>
            <input type="checkbox" checked={phrasesOnly} onChange={(e) => setPhrasesOnly(e.target.checked)} /> phrases
            only
          </label>
        </div>
      </details>
    </div>
  );
}
