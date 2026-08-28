import { formatInTimeZone } from 'date-fns-tz';
import { PRIORITY_SHORT, TZ } from './constants';

export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function p90(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const h = Math.ceil(0.9 * s.length) - 1;
  return s[Math.max(0, h)]!;
}

export function fmtHours(h: number | null | undefined): string {
  if (h == null || Number.isNaN(h)) return '—';
  if (Math.abs(h) >= 100) return h.toFixed(0) + 'h';
  return h.toFixed(1) + 'h';
}

export function fmtPct(p: number | null | undefined, digits = 1): string {
  if (p == null || Number.isNaN(p)) return '—';
  return p.toFixed(digits) + '%';
}

export function fmtN(n: number): string {
  return n.toLocaleString('en-US');
}

export function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return formatInTimeZone(d, TZ, 'yyyy-MM-dd');
}

export function fmtDateTime(d: Date | null): string {
  if (!d) return '—';
  return formatInTimeZone(d, TZ, 'yyyy-MM-dd HH:mm');
}

export function priShort(p: string): string {
  return PRIORITY_SHORT[p] ?? p;
}

export function dominant<T extends string>(items: T[]): T | null {
  if (!items.length) return null;
  const c = new Map<T, number>();
  for (const i of items) c.set(i, (c.get(i) ?? 0) + 1);
  let best: T | null = null;
  let n = -1;
  for (const [k, v] of c) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}
