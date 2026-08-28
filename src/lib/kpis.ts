import type { IncidentRow } from './types';
import { median } from './format';

export interface Kpis {
  n: number;
  medianMttr: number | null;
  slaMissPct: number | null;
  bounceRate: number;
  pingPongPct: number;
  openCount: number;
  slaEvaluable: number;
  sdBouncePct: number;
}

export function computeKpis(rows: IncidentRow[]): Kpis {
  const n = rows.length;
  const mttr = rows.map((r) => r.mttr_hours).filter((h): h is number => h != null);
  const sla = rows.filter((r) => r.sla_evaluable);
  const miss = sla.filter((r) => r.made_sla === false).length;
  const bounced = rows.filter((r) => r.bounced).length;
  const openCount = rows.filter((r) => r.is_open).length;
  const sd = rows.filter((r) => r.sd_bounce_back).length;
  return {
    n,
    medianMttr: median(mttr),
    slaMissPct: sla.length ? (100 * miss) / sla.length : null,
    bounceRate: n ? (100 * bounced) / n : 0,
    pingPongPct: n ? (100 * sd) / n : 0,
    openCount,
    slaEvaluable: sla.length,
    sdBouncePct: n ? (100 * sd) / n : 0,
  };
}

export function halfDelta(rows: IncidentRow[]): { prior: IncidentRow[]; recent: IncidentRow[] } {
  const dated = rows.filter((r) => r.opened_at).sort((a, b) => a.opened_at!.getTime() - b.opened_at!.getTime());
  if (dated.length < 4) return { prior: [], recent: dated };
  const mid = dated[0]!.opened_at!.getTime() + (dated[dated.length - 1]!.opened_at!.getTime() - dated[0]!.opened_at!.getTime()) / 2;
  return {
    prior: dated.filter((r) => r.opened_at!.getTime() < mid),
    recent: dated.filter((r) => r.opened_at!.getTime() >= mid),
  };
}

export function deltaPct(cur: number, prev: number): number | null {
  if (!prev && !cur) return 0;
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}
