import type { IncidentRow } from './types';
import { bouncePairs } from './derive';
import { median, p90 } from './format';
import { DOW_ORDER } from './constants';

export function mttrByGroup(rows: IncidentRow[]) {
  const m = new Map<string, number[]>();
  for (const r of rows) {
    if (r.mttr_hours == null) continue;
    const g = r.resolver_group || r.assignment_group;
    const arr = m.get(g) ?? [];
    arr.push(r.mttr_hours);
    m.set(g, arr);
  }
  return [...m.entries()]
    .map(([group, hours]) => ({
      group,
      n: hours.length,
      median: median(hours) ?? 0,
      p90: p90(hours) ?? 0,
      tickets: rows.filter((r) => (r.resolver_group || r.assignment_group) === group && r.mttr_hours != null).map((r) => r.number),
    }))
    .sort((a, b) => b.median - a.median);
}

export function bounceByGroup(rows: IncidentRow[]) {
  const m = new Map<string, { n: number; bounced: number; hops: number; tickets: string[] }>();
  for (const r of rows) {
    const g = r.origin_group;
    const cur = m.get(g) ?? { n: 0, bounced: 0, hops: 0, tickets: [] };
    cur.n++;
    cur.hops += r.reassignment_count;
    if (r.bounced) {
      cur.bounced++;
      cur.tickets.push(r.number);
    }
    m.set(g, cur);
  }
  return [...m.entries()]
    .map(([group, v]) => ({
      group,
      n: v.n,
      bouncePct: v.n ? (100 * v.bounced) / v.n : 0,
      meanHops: v.n ? v.hops / v.n : 0,
      tickets: v.tickets,
    }))
    .sort((a, b) => b.bouncePct - a.bouncePct);
}

export function slaByGroup(rows: IncidentRow[]) {
  const m = new Map<string, { on: number; miss: number; ticketsOn: string[]; ticketsMiss: string[] }>();
  for (const r of rows) {
    if (!r.sla_evaluable) continue;
    const g = r.resolver_group || r.assignment_group;
    const cur = m.get(g) ?? { on: 0, miss: 0, ticketsOn: [], ticketsMiss: [] };
    if (r.made_sla) {
      cur.on++;
      cur.ticketsOn.push(r.number);
    } else {
      cur.miss++;
      cur.ticketsMiss.push(r.number);
    }
    m.set(g, cur);
  }
  return [...m.entries()]
    .map(([group, v]) => ({
      group,
      on: v.on,
      miss: v.miss,
      n: v.on + v.miss,
      ticketsOn: v.ticketsOn,
      ticketsMiss: v.ticketsMiss,
    }))
    .sort((a, b) => b.n - a.n);
}

export function categoryMix(rows: IncidentRow[]) {
  const byWeek = new Map<string, Map<string, number>>();
  const cats = new Set<string>();
  for (const r of rows) {
    const w = r.opened_week || 'unknown';
    cats.add(r.category);
    let m = byWeek.get(w);
    if (!m) {
      m = new Map();
      byWeek.set(w, m);
    }
    m.set(r.category, (m.get(r.category) ?? 0) + 1);
  }
  const weeks = [...byWeek.keys()].sort();
  const categories = [...cats].sort();
  const series = categories.map((c) => ({
    category: c,
    data: weeks.map((w) => {
      const m = byWeek.get(w)!;
      const tot = [...m.values()].reduce((s, x) => s + x, 0);
      return tot ? (100 * (m.get(c) ?? 0)) / tot : 0;
    }),
  }));
  return { weeks, series, categories };
}

export function heatmap(rows: IncidentRow[]) {
  const grid: number[][] = DOW_ORDER.map(() => Array.from({ length: 24 }, () => 0));
  const tickets: string[][][] = DOW_ORDER.map(() => Array.from({ length: 24 }, () => [] as string[]));
  for (const r of rows) {
    const di = DOW_ORDER.indexOf(r.opened_dow as (typeof DOW_ORDER)[number]);
    const h = r.opened_hour;
    if (di < 0 || h < 0 || h > 23) continue;
    grid[di]![h]! += 1;
    tickets[di]![h]!.push(r.number);
  }
  let hot = { dow: 'Mon', hour: 0, n: 0 };
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (grid[d]![h]! > hot.n) hot = { dow: DOW_ORDER[d]!, hour: h, n: grid[d]![h]! };
    }
  }
  return { grid, tickets, hot };
}

export function pingPongTable(rows: IncidentRow[]) {
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
  const direct = medianSafe(
    rows.filter((r) => r.is_direct && r.mttr_hours != null).map((r) => r.mttr_hours!),
  );
  return [...loopMap.entries()]
    .map(([key, rs]) => {
      const [a, b] = key.split('\t') as [string, string];
      const extraHops =
        rs.reduce((s, x) => s + Math.max(0, x.reassignment_count - 1), 0) / rs.length;
      const m = medianSafe(rs.map((x) => x.mttr_hours).filter((h): h is number => h != null));
      return {
        a,
        b,
        n: rs.length,
        extraHops,
        extraHours: m != null && direct != null ? Math.max(0, m - direct) : m,
        tickets: rs.map((x) => x.number),
      };
    })
    .sort((x, y) => y.n - x.n);
}

function medianSafe(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
