import { formatInTimeZone } from 'date-fns-tz';
import { TZ } from './constants';
import type { IncidentRow } from './types';

const DOW_FMT: Record<string, string> = {
  Mon: 'Mon',
  Tue: 'Tue',
  Wed: 'Wed',
  Thu: 'Thu',
  Fri: 'Fri',
  Sat: 'Sat',
  Sun: 'Sun',
};

export function collapseConsecutive(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (!out.length || out[out.length - 1] !== p) out.push(p);
  }
  return out;
}

export function parsePath(raw: string): string[] {
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 4+ hop Via whose middle sequence revisits a group → dump to Other. */
export function isOscillation(middles: string[]): boolean {
  return new Set(middles).size !== middles.length;
}

/**
 * LOCKED Via identity after consecutive-dupe collapse.
 * 1–2 hops → Direct; 3 hops → middle (A→B→A is Via=B); 4+ unique middles joined with ` · `.
 */
export function viaLabelFor(pathParts: string[]): string {
  const L = pathParts.length;
  if (L <= 2) return 'Direct';
  if (L === 3) return pathParts[1] ?? 'Direct';
  const middles = pathParts.slice(1, -1);
  if (isOscillation(middles)) return 'Other';
  const uniq: string[] = [];
  for (const m of middles) {
    if (!uniq.includes(m)) uniq.push(m);
  }
  return uniq.join(' · ') || 'Direct';
}

export function etHour(d: Date): number {
  return Number(formatInTimeZone(d, TZ, 'H'));
}

export function etDow(d: Date): string {
  const v = formatInTimeZone(d, TZ, 'EEE');
  return DOW_FMT[v] ?? v;
}

export function etWeek(d: Date): string {
  return formatInTimeZone(d, TZ, "RRRR-'W'II");
}

export function etMonth(d: Date): string {
  return formatInTimeZone(d, TZ, 'yyyy-MM');
}

export function deriveRow(
  partial: Omit<
    IncidentRow,
    | 'mttr_hours'
    | 'time_to_close_hours'
    | 'path_parts_raw'
    | 'path_parts'
    | 'origin_group'
    | 'resolver_group'
    | 'via_label'
    | 'is_direct'
    | 'reassignment_count'
    | 'bounced'
    | 'sd_bounce_back'
    | 'opened_hour'
    | 'opened_dow'
    | 'opened_week'
    | 'opened_month'
    | 'is_open'
    | 'sla_evaluable'
    | 'path_inferred'
  > & { path_inferred?: boolean },
): IncidentRow {
  const path_parts_raw = parsePath(partial.assignment_path);
  const path_parts = collapseConsecutive(path_parts_raw);
  const origin_group = path_parts[0] || partial.assignment_group || 'Unknown';
  const resolver_group = path_parts[path_parts.length - 1] || origin_group;
  const via_label = viaLabelFor(path_parts);
  const is_direct = path_parts.length <= 2;
  const reassignment_count = Math.max(0, path_parts.length - 1);
  const bounced = path_parts.some((g, i) => path_parts.indexOf(g) !== i);
  let sd_bounce_back = false;
  for (let i = 0; i < path_parts.length; i++) {
    if (path_parts[i] !== 'Service Desk') continue;
    for (let j = i + 1; j < path_parts.length; j++) {
      if (path_parts[j] === 'Service Desk') continue;
      for (let k = j + 1; k < path_parts.length; k++) {
        if (path_parts[k] === 'Service Desk') {
          sd_bounce_back = true;
          break;
        }
      }
      if (sd_bounce_back) break;
    }
    if (sd_bounce_back) break;
  }

  const opened = partial.opened_at;
  const resolved = partial.resolved_at;
  const closed = partial.closed_at;
  const mttr_hours =
    opened && resolved ? (resolved.getTime() - opened.getTime()) / 3_600_000 : null;
  const time_to_close_hours =
    opened && closed ? (closed.getTime() - opened.getTime()) / 3_600_000 : null;

  const is_open = !['Resolved', 'Closed', 'Canceled'].includes(partial.state);
  const sla_evaluable =
    (partial.state === 'Resolved' || partial.state === 'Closed') && partial.made_sla !== null;

  return {
    ...partial,
    path_inferred: partial.path_inferred ?? false,
    mttr_hours,
    time_to_close_hours,
    path_parts_raw,
    path_parts,
    origin_group,
    resolver_group,
    via_label,
    is_direct,
    reassignment_count,
    bounced,
    sd_bounce_back,
    opened_hour: opened ? etHour(opened) : 0,
    opened_dow: opened ? etDow(opened) : 'Mon',
    opened_week: opened ? etWeek(opened) : '',
    opened_month: opened ? etMonth(opened) : '',
    is_open,
    sla_evaluable,
  };
}

export function bouncePairs(pathParts: string[]): [string, string][] {
  const seen = new Set<string>();
  const pairs: [string, string][] = [];
  const firstIndex = new Map<string, number>();
  for (let i = 0; i < pathParts.length; i++) {
    const g = pathParts[i]!;
    const first = firstIndex.get(g);
    if (first !== undefined && first < i - 1) {
      const partner = pathParts[i - 1]!;
      if (g !== partner) {
        const [a, b] = g < partner ? [g, partner] : [partner, g];
        const key = `${a}\0${b}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push([a, b]);
        }
      }
    }
    if (!firstIndex.has(g)) firstIndex.set(g, i);
  }
  return pairs;
}
