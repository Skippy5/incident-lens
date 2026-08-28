import { deriveRow } from './derive';
import { ROW_CAP } from './constants';
import type { IncidentRow } from './types';

const DANGER = new Set(['__proto__', 'constructor', 'prototype']);

export const CANON = [
  'number',
  'opened_at',
  'resolved_at',
  'closed_at',
  'state',
  'priority',
  'category',
  'subcategory',
  'assignment_group',
  'assigned_to',
  'short_description',
  'description',
  'work_notes',
  'close_notes',
  'made_sla',
  'reopen_count',
  'assignment_path',
] as const;

const ALIAS: Record<string, string> = {
  ticket_id: 'number',
  status: 'state',
  business_unit: 'u_business_unit',
  'assignment group': 'assignment_group',
  'assignment_group': 'assignment_group',
  'short description': 'short_description',
  'work notes': 'work_notes',
  'close notes': 'close_notes',
  closed_notes: 'close_notes',
  closed_group: 'assignment_group',
  resolution_hours: 'calendar_duration',
};

export function normalizeHeader(h: string): string {
  return h.trim().replace(/\uFEFF/g, '');
}

export function sanitizeHeader(h: string): string | null {
  const n = normalizeHeader(h);
  if (!n) return null;
  if (DANGER.has(n) || DANGER.has(n.toLowerCase())) return null;
  return n;
}

export function isAggregated(headers: string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase());
  const has = (x: string) => lower.includes(x);
  const rolled = has('source') && has('target') && has('count');
  const ticketish = has('number') || has('ticket_id') || has('assignment_path');
  return rolled && !ticketish;
}

export function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const lowerToOrig = new Map<string, string>();
  for (const h of headers) lowerToOrig.set(h.toLowerCase(), h);
  for (const h of headers) {
    const l = h.toLowerCase();
    if ((CANON as readonly string[]).includes(l)) {
      map[h] = l;
      continue;
    }
    if (ALIAS[l]) map[h] = ALIAS[l];
  }
  return map;
}

function cell(row: Record<string, unknown>, key: string | undefined): string {
  if (!key) return '';
  const v = row[key];
  if (v == null) return '';
  return String(v).trim();
}

function parseBool(v: string): boolean | null {
  if (v === '' || v.toLowerCase() === 'null') return null;
  if (v.toLowerCase() === 'true' || v === '1' || v.toLowerCase() === 'yes') return true;
  if (v.toLowerCase() === 'false' || v === '0' || v.toLowerCase() === 'no') return false;
  return null;
}

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface MapResult {
  rows: IncidentRow[];
  dropped: number;
  pathInferred: boolean;
  missingNotes: boolean;
  groupMismatch: number;
  warnings: string[];
}

export function invertMap(mapping: Record<string, string>): Record<string, string> {
  const inv: Record<string, string> = {};
  for (const [src, dest] of Object.entries(mapping)) inv[dest] = src;
  return inv;
}

export function recordsToRows(
  records: Record<string, unknown>[],
  mapping: Record<string, string>,
): MapResult {
  const inv = invertMap(mapping);
  const warnings: string[] = [];
  const rows: IncidentRow[] = [];
  let dropped = 0;
  let pathInferred = false;
  let notesPresent = 0;
  let groupMismatch = 0;

  const hasOpen = !!inv.open_group || records.some((r) => 'open_group' in r);
  const hasRouting = records.some((r) => 'routing_groups' in r || 'routing_groups' in mapping);
  const openKey = Object.keys(mapping).find((k) => k.toLowerCase() === 'open_group');
  const routingKey = Object.keys(mapping).find((k) => k.toLowerCase() === 'routing_groups');
  const closedKey = Object.keys(mapping).find(
    (k) => k.toLowerCase() === 'closed_group' && mapping[k] !== 'assignment_path',
  );

  for (const rec of records) {
    if (rows.length >= ROW_CAP) break;
    const number = cell(rec, inv.number);
    const opened_at = parseDate(cell(rec, inv.opened_at));
    if (!number || !opened_at) {
      dropped++;
      continue;
    }

    let assignment_path = cell(rec, inv.assignment_path);
    let inferred = false;
    if (!assignment_path && (openKey || routingKey || closedKey || hasOpen || hasRouting)) {
      const og = openKey ? cell(rec, openKey) : '';
      const rg = routingKey ? cell(rec, routingKey) : '';
      const cg = closedKey ? cell(rec, closedKey) : '';
      const hops = [og, ...rg.split('|').map((s) => s.trim()).filter(Boolean), cg].filter(Boolean);
      assignment_path = hops.join('|');
    }
    let assignment_group = cell(rec, inv.assignment_group);
    if (!assignment_path) {
      if (assignment_group) {
        assignment_path = assignment_group;
        inferred = true;
        pathInferred = true;
      } else {
        dropped++;
        continue;
      }
    }
    if (!assignment_group) {
      const parts = assignment_path.split('|').map((s) => s.trim()).filter(Boolean);
      assignment_group = parts[parts.length - 1] || '';
    }

    const resolutionHours = cell(rec, inv.calendar_duration);
    let resolved_at = parseDate(cell(rec, inv.resolved_at));
    if (!resolved_at && resolutionHours) {
      const h = Number(resolutionHours);
      if (!Number.isNaN(h) && h > 0) resolved_at = new Date(opened_at.getTime() + h * 3600000);
    }

    const work_notes = cell(rec, inv.work_notes) || null;
    const close_notes = cell(rec, inv.close_notes) || null;
    if (work_notes || close_notes) notesPresent++;

    const row = deriveRow({
      number,
      opened_at,
      resolved_at,
      closed_at: parseDate(cell(rec, inv.closed_at)),
      state: cell(rec, inv.state) || 'Unknown',
      priority: normalizePriority(cell(rec, inv.priority)),
      category: cell(rec, inv.category).toLowerCase() || 'unknown',
      subcategory: cell(rec, inv.subcategory),
      assignment_group,
      assigned_to: cell(rec, inv.assigned_to) || null,
      short_description: cell(rec, inv.short_description),
      description: cell(rec, inv.description) || null,
      work_notes,
      close_notes,
      made_sla: parseBool(cell(rec, inv.made_sla)),
      reopen_count: Number(cell(rec, inv.reopen_count) || 0) || 0,
      assignment_path,
      path_inferred: inferred,
    });
    if (row.assignment_group !== row.resolver_group) groupMismatch++;
    rows.push(row);
  }

  if (pathInferred) warnings.push('Path inferred — sankey will be shallow.');
  if (groupMismatch) {
    warnings.push(
      `${groupMismatch} rows have path/group inconsistency; Sankey uses path, current-group filters use assignment_group.`,
    );
  }

  return {
    rows,
    dropped,
    pathInferred,
    missingNotes: notesPresent === 0,
    groupMismatch,
    warnings,
  };
}

function normalizePriority(p: string): string {
  const t = p.trim();
  if (!t) return t;
  if (t.startsWith('1')) return '1-Critical';
  if (t.startsWith('2')) return '2-High';
  if (t.startsWith('3')) return '3-Moderate';
  if (t.startsWith('4')) return '4-Low';
  if (t.startsWith('5')) return '5-Planning';
  return t;
}

export const AGGREGATED_TOAST =
  'This file is already rolled up. Flow needs ticket-level rows (id + path).';
