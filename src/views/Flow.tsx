import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3';
import { sankey, sankeyLeft, sankeyLinkHorizontal } from 'd3-sankey';
import { buildFlow } from '../lib/flow';
import { fmtHours, fmtN, priShort } from '../lib/format';
import { PRIORITY_COLORS } from '../lib/constants';
import { useDatasetStore } from '../store';

type SNode = {
  id: string;
  name: string;
  color: string;
  tickets: string[];
  column: string;
  dominantPriority: string | null;
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
};
type SLink = {
  source: string | SNode;
  target: string | SNode;
  value: number;
  color: string;
  tickets: string[];
  medianHours: number | null;
  width?: number;
  y0?: number;
  y1?: number;
};

export default function Flow() {
  const rows = useDatasetStore((s) => s.filtered);
  const filterKey = useDatasetStore((s) => s.filterKey);
  const meta = useDatasetStore((s) => s.meta);
  const setSelection = useDatasetStore((s) => s.setSelection);
  const [minPct, setMinPct] = useState(2);
  const [showOther, setShowOther] = useState(true);
  const [iso, setIso] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  const graph = useMemo(
    () => buildFlow(rows, { topN: 10, minPct, minTickets: 2, showOther }),
    [rows, filterKey, minPct, showOther, meta?.id],
  );

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const width = el.clientWidth || 800;
    const height = 520;
    el.replaceChildren();
    const svg = select(el)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const nodes: SNode[] = graph.nodes.map((n) => ({ ...n }));
    const links: SLink[] = graph.links.map((l) => ({ ...l }));
    if (!nodes.length) {
      svg.append('text').attr('x', 24).attr('y', 40).text('No flows in this slice.');
      return;
    }

    const layout = sankey<SNode, SLink>()
      .nodeId((d) => d.id)
      .nodeWidth(16)
      .nodePadding(10)
      .nodeAlign(sankeyLeft)
      .extent([
        [12, 28],
        [width - 12, height - 12],
      ])
      .nodeSort((a, b) => {
        if (a.column === 'via' || b.column === 'via') {
          if (a.name === 'Direct') return -1;
          if (b.name === 'Direct') return 1;
          if (a.name === 'Other') return 1;
          if (b.name === 'Other') return -1;
        }
        return (b.tickets?.length ?? 0) - (a.tickets?.length ?? 0);
      });

    try {
      layout({ nodes, links });
    } catch {
      svg.append('text').attr('x', 24).attr('y', 40).text('Could not layout flow.');
      return;
    }

    const cols = [
      { key: 'origin', label: 'Origin', x: 12 },
      { key: 'via', label: 'Via', x: width / 2 - 10 },
      { key: 'resolver', label: 'Resolver', x: width - 90 },
    ];
    svg
      .selectAll('text.col')
      .data(cols)
      .enter()
      .append('text')
      .attr('class', 'col')
      .attr('x', (d) => d.x)
      .attr('y', 16)
      .attr('fill', '#5C6570')
      .attr('font-size', 12)
      .text((d) => d.label);

    const linkG = svg.append('g').attr('fill', 'none');
    const nodeG = svg.append('g');

    const path = sankeyLinkHorizontal();
    const linkSel = linkG
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', path)
      .attr('stroke', (d) => d.color)
      .attr('stroke-opacity', 0.45)
      .attr('stroke-width', (d) => Math.max(1, d.width ?? 1))
      .style('cursor', 'pointer');

    const nodeSel = nodeG
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');

    nodeSel
      .append('rect')
      .attr('x', (d) => d.x0 ?? 0)
      .attr('y', (d) => d.y0 ?? 0)
      .attr('width', (d) => Math.max(1, (d.x1 ?? 0) - (d.x0 ?? 0)))
      .attr('height', (d) => Math.max(1, (d.y1 ?? 0) - (d.y0 ?? 0)))
      .attr('fill', (d) => d.color)
      .attr('stroke', '#1B1F24')
      .attr('stroke-width', 0.5);

    nodeSel
      .append('text')
      .attr('x', (d) => ((d.x0 ?? 0) < width / 2 ? (d.x1 ?? 0) + 6 : (d.x0 ?? 0) - 6))
      .attr('y', (d) => ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => ((d.x0 ?? 0) < width / 2 ? 'start' : 'end'))
      .attr('font-size', 11)
      .attr('fill', '#1B1F24')
      .text((d) => `${d.name} (${fmtN(d.tickets.length)})`);

    const showTip = (html: string, ev: MouseEvent) => {
      const t = tip.current;
      if (!t) return;
      t.style.display = 'block';
      t.style.left = ev.clientX + 12 + 'px';
      t.style.top = ev.clientY + 12 + 'px';
      t.textContent = html;
    };
    const hideTip = () => {
      if (tip.current) tip.current.style.display = 'none';
    };

    linkSel
      .on('mousemove', (ev, d) => {
        const s = typeof d.source === 'object' ? d.source.name : d.source;
        const t = typeof d.target === 'object' ? d.target.name : d.target;
        showTip(
          `${s} → ${t}\n${d.value} tickets · ${((100 * d.value) / Math.max(rows.length, 1)).toFixed(0)}%\nmedian ${fmtHours(d.medianHours)}`,
          ev as MouseEvent,
        );
      })
      .on('mouseleave', hideTip)
      .on('click', (ev, d) => {
        ev.stopPropagation();
        const s = typeof d.source === 'object' ? d.source.id : String(d.source);
        const t = typeof d.target === 'object' ? d.target.id : String(d.target);
        setIso(`link:${s}>${t}`);
        setSelection({
          kind: 'flow-link',
          title: `${typeof d.source === 'object' ? d.source.name : s} → ${typeof d.target === 'object' ? d.target.name : t}`,
          ticketNumbers: d.tickets,
          filterHint: { groups: [typeof d.source === 'object' ? d.source.name : '', typeof d.target === 'object' ? d.target.name : ''].filter((x) => x && x !== 'Direct' && x !== 'Other') },
        });
      });

    nodeSel
      .on('mousemove', (ev, d) => {
        showTip(
          `${d.name}\n${d.tickets.length} tickets\ndominant ${d.dominantPriority ? priShort(d.dominantPriority) : '—'}`,
          ev as MouseEvent,
        );
      })
      .on('mouseleave', hideTip)
      .on('click', (ev, d) => {
        ev.stopPropagation();
        setIso(`node:${d.id}`);
        setSelection({
          kind: 'flow-node',
          title: d.name,
          ticketNumbers: d.tickets,
          filterHint: d.name !== 'Direct' && d.name !== 'Other' ? { groups: [d.name] } : undefined,
        });
      });

    svg.on('click', () => {
      setIso(null);
      setSelection(null, false);
      hideTip();
    });

    return () => {
      hideTip();
    };
  }, [graph, rows.length, setSelection]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const svg = select(el).select('svg');
    svg.selectAll('.node').classed('dim', function () {
      if (!iso) return false;
      const d = select(this).datum() as SNode;
      if (iso.startsWith('node:')) return `node:${d.id}` !== iso;
      const [, rest] = iso.split(':');
      const [s, t] = (rest ?? '').split('>');
      return d.id !== s && d.id !== t;
    });
    svg.selectAll('.link').classed('dim', function () {
      if (!iso) return false;
      const d = select(this).datum() as SLink;
      const sid = typeof d.source === 'object' ? d.source.id : String(d.source);
      const tid = typeof d.target === 'object' ? d.target.id : String(d.target);
      if (iso.startsWith('link:')) return `link:${sid}>${tid}` !== iso;
      const nid = iso.slice(5);
      return sid !== nid && tid !== nid;
    });
  }, [iso, graph]);

  return (
    <div>
      <div className="flow-controls">
        <label>
          Hide under{' '}
          <select value={minPct} onChange={(e) => setMinPct(Number(e.target.value))}>
            <option value={2}>2%</option>
            <option value={5}>5%</option>
            <option value={10}>10%</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={showOther} onChange={(e) => setShowOther(e.target.checked)} /> Show Other
        </label>
        {graph.allDirect ? <span>No reassignments in this slice.</span> : null}
        {graph.otherHiddenPct > 1 ? (
          <span>Showing top flows (Other hides {graph.otherHiddenPct.toFixed(0)}%)</span>
        ) : null}
      </div>
      <div className="flow-wrap">
        <div>
          <div className="sankey-host" ref={host} />
          <div className="legend">
            {Object.entries(PRIORITY_COLORS)
              .filter(([k]) => k.startsWith('1') || k.startsWith('2') || k.startsWith('3') || k.startsWith('4'))
              .map(([k, c]) => (
                <span key={k}>
                  <i style={{ background: c }} />
                  {priShort(k)} dominant
                </span>
              ))}
            <span>
              <i style={{ background: '#8A9199' }} /> Direct / Other
            </span>
          </div>
        </div>
        <div className="loops">
          <h3>Loops</h3>
          <p className="caption">Ping-pong pairs. Counted here, not drawn as return edges.</p>
          {graph.loops.length === 0 ? <p className="caption">No bounce pairs in this slice.</p> : null}
          {graph.loops.slice(0, 12).map((l) => (
            <button
              key={l.a + l.b}
              type="button"
              className="loop-row"
              onClick={() =>
                setSelection({
                  kind: 'flow-loop',
                  title: `${l.a} ↔ ${l.b}`,
                  ticketNumbers: l.tickets,
                  filterHint: { groups: [l.a, l.b] },
                })
              }
            >
              {l.a} ↔ {l.b}
              <div>
                {l.tickets.length} tickets · +{l.extraHours != null ? l.extraHours.toFixed(1) : '—'}h median extra
              </div>
            </button>
          ))}
        </div>
      </div>
      <div
        ref={tip}
        style={{
          display: 'none',
          position: 'fixed',
          background: '#1B1F24',
          color: '#fff',
          padding: '8px 10px',
          borderRadius: 6,
          fontSize: 12,
          whiteSpace: 'pre',
          pointerEvents: 'none',
          zIndex: 30,
        }}
      />
    </div>
  );
}
