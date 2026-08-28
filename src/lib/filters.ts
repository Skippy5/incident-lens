import type { Filters, IncidentRow } from './types';

export function filterKey(f: Filters): string {
  return [
    f.priorities.slice().sort().join(','),
    f.categories.slice().sort().join(','),
    f.groups.slice().sort().join(','),
    f.groupMode,
    f.dateFrom ?? '',
    f.dateTo ?? '',
  ].join('|');
}

export function applyFilters(rows: IncidentRow[], f: Filters): IncidentRow[] {
  const pri = new Set(f.priorities);
  const cat = new Set(f.categories);
  const grp = new Set(f.groups);
  const from = f.dateFrom ? Date.parse(f.dateFrom + 'T00:00:00') : null;
  const to = f.dateTo ? Date.parse(f.dateTo + 'T23:59:59') : null;
  return rows.filter((r) => {
    if (pri.size && !pri.has(r.priority)) return false;
    if (cat.size && !cat.has(r.category)) return false;
    if (grp.size) {
      if (f.groupMode === 'origin') {
        if (!grp.has(r.origin_group)) return false;
      } else if (![r.origin_group, ...r.path_parts, r.assignment_group].some((g) => grp.has(g))) {
        return false;
      }
    }
    if (from != null && r.opened_at && r.opened_at.getTime() < from) return false;
    if (to != null && r.opened_at && r.opened_at.getTime() > to) return false;
    return true;
  });
}

export function uniqueGroups(rows: IncidentRow[]): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    for (const g of r.path_parts) s.add(g);
    if (r.assignment_group) s.add(r.assignment_group);
  }
  return [...s].sort();
}

export function uniqueCategories(rows: IncidentRow[]): string[] {
  return [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
}
