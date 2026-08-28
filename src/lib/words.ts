import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import { buildTermIndex, displayTerm, type TokenFields } from './tokenize';
import type { IncidentRow } from './types';

const THEMES = new Set(['vpn', 'mfa', 'printer', 'sap', 'laptop']);

export interface WordNode {
  id: string;
  label: string;
  df: number;
  community: number;
  clusterLabel: string;
  tickets: string[];
}

export interface WordEdge {
  source: string;
  target: string;
  weight: number;
}

export interface WordGraph {
  nodes: WordNode[];
  edges: WordEdge[];
  clusters: { id: number; label: string; terms: string[]; tickets: string[] }[];
  tooFew: boolean;
}

export interface WordOpts {
  fields: TokenFields;
  minDf?: number;
  phrasesOnly?: boolean;
  redact: boolean;
  datasetId: string;
  maxNodes?: number;
  weakLinks?: boolean;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildWordGraph(rows: IncidentRow[], opts: WordOpts): WordGraph {
  const N = rows.length;
  const { index, tokensByRow } = buildTermIndex(rows, opts.fields, opts.redact);
  const minDfDefault = N < 500 ? 3 : Math.max(5, Math.round(0.01 * N));
  const minDf = opts.minDf ?? minDfDefault;
  const minCo = opts.weakLinks ? 1 : N < 500 ? 2 : 3;
  const maxNodes = Math.min(opts.maxNodes ?? 80, 200);

  let candidates = [...index.entries()]
    .filter(([t, set]) => set.size >= minDf)
    .sort((a, b) => b[1].size - a[1].size);

  if (opts.phrasesOnly) {
    candidates = candidates.filter(([t]) => t.includes('_'));
  }

  candidates = candidates.slice(0, maxNodes);
  const terms = candidates.map(([t]) => t);
  const termSet = new Set(terms);

  const co = new Map<string, number>();
  const keyOf = (a: string, b: string) => (a < b ? `${a}\t${b}` : `${b}\t${a}`);
  for (const toks of tokensByRow) {
    const present = toks.filter((t) => termSet.has(t));
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const k = keyOf(present[i]!, present[j]!);
        co.set(k, (co.get(k) ?? 0) + 1);
      }
    }
  }

  const edges: WordEdge[] = [];
  const degree = new Map<string, number>();
  for (const t of terms) degree.set(t, 0);
  for (const [k, w] of co) {
    if (w < minCo) continue;
    const [a, b] = k.split('\t') as [string, string];
    edges.push({ source: a, target: b, weight: w });
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }

  const keep = new Set<string>();
  for (const t of terms) {
    if ((degree.get(t) ?? 0) > 0 || THEMES.has(t)) keep.add(t);
  }

  const g = new Graph({ type: 'undirected' });
  for (const t of keep) {
    if (!g.hasNode(t)) g.addNode(t);
  }
  for (const e of edges) {
    if (keep.has(e.source) && keep.has(e.target) && !g.hasEdge(e.source, e.target)) {
      g.addEdge(e.source, e.target, { weight: e.weight });
    }
  }

  let communities: Record<string, number> = {};
  if (g.size >= 5) {
    try {
      communities = louvain(g, {
        resolution: 1,
        rng: mulberry32(hashSeed('wordnet-' + opts.datasetId)),
        getEdgeWeight: 'weight',
      });
    } catch {
      communities = {};
    }
  } else {
    // connected components
    let cid = 0;
    const seen = new Set<string>();
    for (const n of g.nodes()) {
      if (seen.has(n)) continue;
      const stack = [n];
      while (stack.length) {
        const x = stack.pop()!;
        if (seen.has(x)) continue;
        seen.add(x);
        communities[x] = cid;
        for (const nb of g.neighbors(x)) stack.push(nb);
      }
      cid++;
    }
  }

  const byComm = new Map<number, string[]>();
  for (const t of keep) {
    const c = communities[t] ?? 0;
    const arr = byComm.get(c) ?? [];
    arr.push(t);
    byComm.set(c, arr);
  }

  const clusterLabel = new Map<number, string>();
  const clusters: WordGraph['clusters'] = [];
  for (const [cid, ts] of byComm) {
    ts.sort((a, b) => (index.get(b)?.size ?? 0) - (index.get(a)?.size ?? 0));
    const top = ts.slice(0, 2).map(displayTerm);
    const label = top.join(' · ') || 'topic';
    clusterLabel.set(cid, label);
    const ticketSet = new Set<string>();
    for (const t of ts) {
      for (const i of index.get(t) ?? []) ticketSet.add(rows[i]!.number);
    }
    clusters.push({ id: cid, label, terms: ts.map(displayTerm), tickets: [...ticketSet] });
  }

  const nodes: WordNode[] = [...keep].map((t) => {
    const c = communities[t] ?? 0;
    const tickets = [...(index.get(t) ?? [])].map((i) => rows[i]!.number);
    return {
      id: t,
      label: displayTerm(t),
      df: index.get(t)?.size ?? 0,
      community: c,
      clusterLabel: clusterLabel.get(c) ?? displayTerm(t),
      tickets,
    };
  });

  const keptEdges = edges.filter((e) => keep.has(e.source) && keep.has(e.target));

  return {
    nodes,
    edges: keptEdges,
    clusters,
    tooFew: nodes.length < 3,
  };
}

export function ticketsForTerm(
  rows: IncidentRow[],
  termId: string,
  fields: TokenFields,
  redact: boolean,
): string[] {
  const { index } = buildTermIndex(rows, fields, redact);
  const set = index.get(termId);
  if (!set) return [];
  return [...set].map((i) => rows[i]!.number);
}
