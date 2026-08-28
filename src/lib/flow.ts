import type { IncidentRow } from './types';
import { bouncePairs } from './derive';
import { dominant, median } from './format';
import { PRIORITY_COLORS } from './constants';

export interface FlowNode {
  id: string;
  name: string;
  column: 'origin' | 'via' | 'resolver';
  tickets: string[];
  dominantPriority: string | null;
  color: string;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number;
  tickets: string[];
  dominantPriority: string | null;
  color: string;
  medianHours: number | null;
}

export interface LoopRow {
  a: string;
  b: string;
  tickets: string[];
  extraHops: number;
  extraHours: number | null;
}

export interface FlowGraph {
  nodes: FlowNode[];
  links: FlowLink[];
  loops: LoopRow[];
  allDirect: boolean;
  otherHiddenPct: number;
}

export interface FlowOpts {
  topN: number;
  minPct: number;
  minTickets: number;
  showOther: boolean;
}

const NEUTRAL = '#8A9199';

function topNRelabel(
  counts: Map<string, number>,
  n: number,
  reserved: Set<string>,
): Map<string, string> {
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const keep = new Set<string>();
  for (const r of reserved) keep.add(r);
  for (const [name] of ranked) {
    if (keep.size >= n + reserved.size) break;
    if (reserved.has(name)) continue;
    if (name === 'Other') continue;
    keep.add(name);
  }
  const map = new Map<string, string>();
  for (const [name] of counts) {
    map.set(name, keep.has(name) || reserved.has(name) ? name : 'Other');
  }
  return map;
}

export function buildFlow(rows: IncidentRow[], opts: FlowOpts): FlowGraph {
  const N = rows.length;
  const originC = new Map<string, number>();
  const viaC = new Map<string, number>();
  const resC = new Map<string, number>();

  type Triple = { o: string; v: string; r: string; tickets: IncidentRow[] };
  const triples = new Map<string, Triple>();

  for (const row of rows) {
    const o = row.origin_group || 'Unknown';
    const v = row.via_label || 'Direct';
    const r = row.resolver_group || o;
    originC.set(o, (originC.get(o) ?? 0) + 1);
    viaC.set(v, (viaC.get(v) ?? 0) + 1);
    resC.set(r, (resC.get(r) ?? 0) + 1);
    const key = `${o}\t${v}\t${r}`;
    let t = triples.get(key);
    if (!t) {
      t = { o, v, r, tickets: [] };
      triples.set(key, t);
    }
    t.tickets.push(row);
  }

  const oMap = topNRelabel(originC, opts.topN, new Set());
  const vMap = topNRelabel(viaC, opts.topN, new Set(['Direct']));
  const rMap = topNRelabel(resC, opts.topN, new Set());

  const minCount = Math.max(opts.minTickets, (opts.minPct / 100) * Math.max(N, 1));

  const agg = new Map<string, Triple>();
  let otherTickets = 0;
  for (const t of triples.values()) {
    const o = oMap.get(t.o) ?? 'Other';
    const v = vMap.get(t.v) ?? 'Other';
    const r = rMap.get(t.r) ?? 'Other';
    if (!opts.showOther && (o === 'Other' || v === 'Other' || r === 'Other')) {
      otherTickets += t.tickets.length;
      continue;
    }
    const key = `${o}\t${v}\t${r}`;
    let a = agg.get(key);
    if (!a) {
      a = { o, v, r, tickets: [] };
      agg.set(key, a);
    }
    a.tickets.push(...t.tickets);
  }

  const nodeTickets = new Map<string, IncidentRow[]>();
  const linkTickets = new Map<string, IncidentRow[]>();
  const addN = (id: string, rs: IncidentRow[]) => {
    const cur = nodeTickets.get(id) ?? [];
    cur.push(...rs);
    nodeTickets.set(id, cur);
  };

  for (const t of agg.values()) {
    if (t.tickets.length < minCount) continue;
    const oid = `origin::${t.o}`;
    const vid = `via::${t.v}`;
    const rid = `resolver::${t.r}`;
    addN(oid, t.tickets);
    addN(vid, t.tickets);
    addN(rid, t.tickets);
    const l1 = `${oid}\t${vid}`;
    const l2 = `${vid}\t${rid}`;
    linkTickets.set(l1, [...(linkTickets.get(l1) ?? []), ...t.tickets]);
    linkTickets.set(l2, [...(linkTickets.get(l2) ?? []), ...t.tickets]);
  }

  const colorOf = (rs: IncidentRow[], name: string): { pri: string | null; color: string } => {
    if (name === 'Direct' || name === 'Other') return { pri: null, color: NEUTRAL };
    const pri = dominant(rs.map((x) => x.priority));
    return { pri, color: (pri && PRIORITY_COLORS[pri]) || NEUTRAL };
  };

  const nodes: FlowNode[] = [];
  for (const [id, rs] of nodeTickets) {
    const [col, ...rest] = id.split('::');
    const name = rest.join('::');
    const { pri, color } = colorOf(rs, name);
    nodes.push({
      id,
      name,
      column: col as FlowNode['column'],
      tickets: rs.map((x) => x.number),
      dominantPriority: pri,
      color,
    });
  }

  const links: FlowLink[] = [];
  for (const [key, rs] of linkTickets) {
    if (rs.length < minCount) continue;
    const [source, target] = key.split('\t') as [string, string];
    const { pri, color } = colorOf(rs, '');
    const hours = rs.map((x) => x.mttr_hours).filter((h): h is number => h != null);
    links.push({
      source,
      target,
      value: rs.length,
      tickets: rs.map((x) => x.number),
      dominantPriority: pri,
      color,
      medianHours: median(hours),
    });
  }

  // Loops
  const loopMap = new Map<string, IncidentRow[]>();
  for (const row of rows) {
    if (!row.bounced) continue;
    for (const [a, b] of bouncePairs(row.path_parts)) {
      const key = `${a}\t${b}`;
      const cur = loopMap.get(key) ?? [];
      cur.push(row);
      loopMap.set(key, cur);
    }
  }
  const directMttr = median(
    rows.filter((r) => r.is_direct && r.mttr_hours != null).map((r) => r.mttr_hours!),
  );
  const loops: LoopRow[] = [...loopMap.entries()]
    .map(([key, rs]) => {
      const [a, b] = key.split('\t') as [string, string];
      const hops = rs.map((x) => x.reassignment_count);
      const extraHops = hops.reduce((s, x) => s + Math.max(0, x - 1), 0) / hops.length;
      const m = median(rs.map((x) => x.mttr_hours).filter((h): h is number => h != null));
      const extraHours = m != null && directMttr != null ? Math.max(0, m - directMttr) : m;
      return { a, b, tickets: rs.map((x) => x.number), extraHops, extraHours };
    })
    .sort((x, y) => y.tickets.length - x.tickets.length);

  const allDirect = rows.length > 0 && rows.every((r) => r.is_direct);
  const otherHiddenPct = N ? (100 * otherTickets) / N : 0;

  return { nodes, links, loops, allDirect, otherHiddenPct };
}

export function ticketsForNode(graph: FlowGraph, id: string): string[] {
  return graph.nodes.find((n) => n.id === id)?.tickets ?? [];
}

export function ticketsForLink(graph: FlowGraph, source: string, target: string): string[] {
  return graph.links.find((l) => l.source === source && l.target === target)?.tickets ?? [];
}
