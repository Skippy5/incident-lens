import type { IncidentRow } from './types';
import { computeKpis } from './kpis';
import { median, p90 } from './format';
import { buildTermIndex, DEFAULT_FIELDS, displayTerm } from './tokenize';
import { bouncePairs } from './derive';

export function buildStory(rows: IncidentRow[], redact: boolean): string[] {
  const N = rows.length;
  if (N < 30) return [`Not enough data to summarize (n=${N}).`];
  const sentences: string[] = [];
  if (N < 200) {
    sentences.push(
      `Sample is small (n=${N}); weekly term trends and word-network communities are unstable and should not be treated as operational findings.`,
    );
  }

  const weekCounts = new Map<string, number>();
  for (const r of rows) {
    if (!r.opened_week) continue;
    weekCounts.set(r.opened_week, (weekCounts.get(r.opened_week) ?? 0) + 1);
  }
  const weeks = [...weekCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (weeks.length) {
    let peak = weeks[0]!;
    for (const w of weeks) {
      if (w[1] > peak[1] || (w[1] === peak[1] && w[0] > peak[0])) peak = w;
    }
    const medWeek = median(weeks.map((w) => w[1]));
    sentences.push(
      `Incident volume peaked in ${peak[0]} (${peak[1]} opened), versus a median of ${medWeek?.toFixed(0) ?? '—'} per week in this range.`,
    );
  }

  const cat = new Map<string, number>();
  for (const r of rows) cat.set(r.category, (cat.get(r.category) ?? 0) + 1);
  const cats = [...cat.entries()].sort((a, b) => b[1] - a[1]);
  if (cats.length) {
    const top = cats[0]!;
    const second = cats[1];
    const topPct = ((100 * top[1]) / N).toFixed(1);
    if (second) {
      sentences.push(
        `${top[0]} accounted for ${topPct}% of tickets, followed by ${second[0]} (${((100 * second[1]) / N).toFixed(1)}%).`,
      );
    } else {
      sentences.push(`${top[0]} accounted for ${topPct}% of tickets.`);
    }
  }

  const k = computeKpis(rows);
  const mttrSet = rows.map((r) => r.mttr_hours).filter((h): h is number => h != null);
  const mttrMed = median(mttrSet);
  const mttrP90 = p90(mttrSet);

  let mttrDelta = '';
  const weekKeys = weeks.map((w) => w[0]);
  if (weekKeys.length >= 8) {
    const recentW = new Set(weekKeys.slice(-4));
    const priorW = new Set(weekKeys.slice(-8, -4));
    const recentM = median(
      rows.filter((r) => recentW.has(r.opened_week) && r.mttr_hours != null).map((r) => r.mttr_hours!),
    );
    const priorM = median(
      rows.filter((r) => priorW.has(r.opened_week) && r.mttr_hours != null).map((r) => r.mttr_hours!),
    );
    if (recentM != null && priorM != null) {
      const d = recentM - priorM;
      const dir = d >= 0 ? 'up' : 'down';
      mttrDelta = `, ${dir} ${Math.abs(d).toFixed(1)} h from the prior four weeks (${priorM.toFixed(1)} h)`;
    }
  }
  if (mttrMed != null) {
    sentences.push(
      `Median time to resolve was ${mttrMed.toFixed(1)} h (p90 ${mttrP90?.toFixed(1) ?? '—'} h)${mttrDelta || '.'}`,
    );
  }

  const sla = rows.filter((r) => r.sla_evaluable);
  const slaPct = sla.length ? (100 * sla.filter((r) => r.made_sla).length) / sla.length : null;
  const byPri = (p: string) => sla.filter((r) => r.priority === p);
  const frag = (p: string, label: string) => {
    const sub = byPri(p);
    if (p === '1-Critical' && sub.length < 5) return 'P1 n<5 (suppressed)';
    const pct = sub.length ? ((100 * sub.filter((r) => r.made_sla).length) / sub.length).toFixed(1) : '—';
    return `${label} ${pct}% (n=${sub.length})`;
  };
  if (slaPct != null) {
    sentences.push(
      `SLA was met on ${slaPct.toFixed(1)}% of resolved/closed tickets (n_evaluable=${sla.length}). By priority: ${frag('1-Critical', 'P1')}, ${frag('2-High', 'P2')}, ${frag('3-Moderate', 'P3')}, ${frag('4-Low', 'P4')}.`,
    );
  }

  sentences.push(
    `${k.bounceRate.toFixed(1)}% of tickets bounced (a group was revisited after leaving it). Service Desk bounce-back rate was ${k.sdBouncePct.toFixed(1)}%.`,
  );

  const bounced = rows.filter((r) => r.bounced);
  if (bounced.length) {
    const paths = new Map<string, number>();
    for (const r of bounced) {
      const p = r.path_parts.join('|');
      paths.set(p, (paths.get(p) ?? 0) + 1);
    }
    const topPath = [...paths.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (topPath) {
      sentences.push(`The most common bounced path was ${topPath[0]} (${topPath[1]} tickets).`);
    }
  }

  const { index } = buildTermIndex(rows, DEFAULT_FIELDS, redact);
  const topTerms = [...index.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 3)
    .map(([t]) => displayTerm(t));
  if (topTerms.length) {
    sentences.push(
      `The most frequent terms (after stopword removal) were ${topTerms.join(', ').replace(/, ([^,]*)$/, ', and $1')}.`,
    );
  }

  return sentences.slice(0, 8);
}

export function storySpan(rows: IncidentRow[]): string {
  const dates = rows.map((r) => r.opened_at).filter((d): d is Date => !!d);
  if (!dates.length) return 'n=0';
  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  return `Story for ${rows.length} tickets, ${min.toISOString().slice(0, 10)} – ${max.toISOString().slice(0, 10)}.`;
}

void bouncePairs;
