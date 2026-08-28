import { uniqueCategories, uniqueGroups, useDatasetStore } from '../store';
import { fmtN } from '../lib/format';
import type { GroupMode } from '../lib/types';

const PRI = [
  { id: '1-Critical', short: 'P1', cls: 'p1' },
  { id: '2-High', short: 'P2', cls: 'p2' },
  { id: '3-Moderate', short: 'P3', cls: 'p3' },
  { id: '4-Low', short: 'P4', cls: 'p4' },
];

export function FilterBar() {
  const rows = useDatasetStore((s) => s.rows);
  const filtered = useDatasetStore((s) => s.filtered);
  const filters = useDatasetStore((s) => s.filters);
  const setFilters = useDatasetStore((s) => s.setFilters);
  const clearFilters = useDatasetStore((s) => s.clearFilters);
  const meta = useDatasetStore((s) => s.meta);
  const cats = uniqueCategories(rows);
  const groups = uniqueGroups(rows);

  const togglePri = (id: string) => {
    const has = filters.priorities.includes(id);
    setFilters({ priorities: has ? filters.priorities.filter((x) => x !== id) : [...filters.priorities, id] });
  };

  const preset = (days: number) => {
    if (!meta?.dateMax) return;
    const to = meta.dateMax;
    const from = new Date(to.getTime() - days * 86400000);
    setFilters({
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: to.toISOString().slice(0, 10),
    });
  };

  return (
    <div className="filterbar">
      {PRI.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`chip ${p.cls} ${filters.priorities.includes(p.id) ? 'on' : ''}`}
          onClick={() => togglePri(p.id)}
        >
          {p.short} {p.id.slice(2)}
        </button>
      ))}
      <select
        value={filters.categories[0] ?? ''}
        onChange={(e) => setFilters({ categories: e.target.value ? [e.target.value] : [] })}
      >
        <option value="">All categories</option>
        {cats.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        value={filters.groups[0] ?? ''}
        onChange={(e) => setFilters({ groups: e.target.value ? [e.target.value] : [] })}
      >
        <option value="">All groups</option>
        {groups.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <select
        value={filters.groupMode}
        onChange={(e) => setFilters({ groupMode: e.target.value as GroupMode })}
        title="Group match"
      >
        <option value="involved">Involved</option>
        <option value="origin">Origin</option>
      </select>
      <input
        type="date"
        value={filters.dateFrom ?? ''}
        onChange={(e) => setFilters({ dateFrom: e.target.value || null })}
      />
      <input
        type="date"
        value={filters.dateTo ?? ''}
        onChange={(e) => setFilters({ dateTo: e.target.value || null })}
      />
      <button type="button" className="chip" onClick={() => preset(7)}>
        7d
      </button>
      <button type="button" className="chip" onClick={() => preset(30)}>
        30d
      </button>
      <button type="button" className="chip" onClick={() => preset(90)}>
        90d
      </button>
      <button type="button" className="chip" onClick={clearFilters}>
        Clear filters
      </button>
      <span className="grow">
        {fmtN(filtered.length)} of {fmtN(rows.length)} tickets
      </span>
    </div>
  );
}
