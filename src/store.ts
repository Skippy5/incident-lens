import { create } from 'zustand';
import { SAMPLE_META } from './lib/constants';
import { applyFilters, filterKey, uniqueCategories, uniqueGroups } from './lib/filters';
import { loadSession, saveSession } from './lib/session';
import { fetchSampleFile, parseCsvFile } from './lib/csvClient';
import { recordsToRows } from './lib/parse';
import { EMPTY_FILTERS, type DatasetMeta, type Filters, type IncidentRow, type MapperState, type SampleId, type Selection, type Toast } from './lib/types';

interface Store {
  rows: IncidentRow[];
  meta: DatasetMeta | null;
  filters: Filters;
  filtered: IncidentRow[];
  filterKey: string;
  loading: boolean;
  loadingHint: string;
  toast: Toast | null;
  demoBanner: boolean;
  pathChip: string | null;
  notesChip: string | null;
  selection: Selection | null;
  inspectorOpen: boolean;
  mapper: MapperState | null;
  pendingRecords: Record<string, unknown>[] | null;
  booted: boolean;
  boot: () => Promise<void>;
  loadSample: (id: SampleId) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  applyMapper: (mapping: Record<string, string>) => void;
  dismissMapper: () => void;
  setFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  setSelection: (sel: Selection | null, open?: boolean) => void;
  closeInspector: () => void;
  filterHubToSelection: () => void;
  clearToast: () => void;
  setToast: (t: Toast | null) => void;
}

function metaFrom(rows: IncidentRow[], kind: DatasetMeta['kind'], sampleId: SampleId | null, name: string): DatasetMeta {
  const dates = rows.map((r) => r.opened_at).filter((d): d is Date => !!d);
  const dateMin = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const dateMax = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  return {
    id: kind === 'sample' ? sampleId ?? 'small' : 'upload-' + Date.now(),
    name,
    kind,
    sampleId,
    n: rows.length,
    dateMin,
    dateMax,
    pathInferred: rows.some((r) => r.path_inferred),
    missingNotes: rows.every((r) => !r.work_notes && !r.close_notes),
  };
}

function persist(sampleId: SampleId, filters: Filters) {
  saveSession({ sampleId, filters });
}

export const useDatasetStore = create<Store>((set, get) => ({
  rows: [],
  meta: null,
  filters: { ...EMPTY_FILTERS },
  filtered: [],
  filterKey: '',
  loading: false,
  loadingHint: '',
  toast: null,
  demoBanner: true,
  pathChip: null,
  notesChip: null,
  selection: null,
  inspectorOpen: false,
  mapper: null,
  pendingRecords: null,
  booted: false,

  boot: async () => {
    if (get().booted) return;
    const ses = loadSession();
    set({ filters: ses.filters, booted: true });
    await get().loadSample(ses.sampleId);
  },

  loadSample: async (id) => {
    set({
      loading: true,
      loadingHint: id === 'large' ? 'Reading 4,000 rows…' : 'Loading sample…',
      mapper: null,
      pendingRecords: null,
    });
    try {
      const spec = SAMPLE_META[id];
      const file = await fetchSampleFile(spec.file, `${id}.csv`);
      const outcome = await parseCsvFile(file);
      if (!outcome.ok) {
        set({ loading: false, toast: { kind: 'error', message: outcome.message } });
        return;
      }
      const rows = outcome.result.rows;
      const meta = metaFrom(rows, 'sample', id, spec.label);
      const filters = get().filters;
      const filtered = applyFilters(rows, filters);
      persist(id, filters);
      set({
        rows,
        meta,
        filtered,
        filterKey: filterKey(filters),
        loading: false,
        loadingHint: '',
        demoBanner: id === 'small',
        pathChip: outcome.result.pathInferred ? 'Path inferred — sankey will be shallow.' : null,
        notesChip: outcome.result.missingNotes ? 'No work/close notes in file.' : null,
        selection: null,
        inspectorOpen: false,
        toast: outcome.fileWarn ? { kind: 'warn', message: 'Large file (~10MB). Charts may hitch.' } : null,
      });
    } catch (err) {
      set({
        loading: false,
        toast: { kind: 'error', message: err instanceof Error ? err.message : 'Failed to load sample' },
      });
    }
  },

  uploadFile: async (file) => {
    const prev = { rows: get().rows, meta: get().meta, filtered: get().filtered };
    set({ loading: true, loadingHint: 'Reading CSV…', mapper: null });
    const outcome = await parseCsvFile(file);
    if (!outcome.ok) {
      if (outcome.code === 'MAP') {
        set({
          loading: false,
          rows: prev.rows,
          meta: prev.meta,
          filtered: prev.filtered,
          mapper: {
            headers: outcome.headers ?? [],
            preview: outcome.preview ?? [],
            mapping: outcome.mapping ?? {},
          },
          pendingRecords: outcome.records ?? null,
          toast: { kind: 'error', message: outcome.message },
        });
        return;
      }
      set({
        loading: false,
        rows: prev.rows,
        meta: prev.meta,
        filtered: prev.filtered,
        toast: { kind: 'error', message: outcome.message },
      });
      return;
    }
    const rows = outcome.result.rows;
    const meta = metaFrom(rows, 'upload', null, file.name);
    const filters = get().filters;
    persist('small', filters);
    set({
      rows,
      meta,
      filtered: applyFilters(rows, filters),
      filterKey: filterKey(filters),
      loading: false,
      loadingHint: '',
      demoBanner: false,
      pathChip: outcome.result.pathInferred ? 'Path inferred — sankey will be shallow.' : null,
      notesChip: outcome.result.missingNotes ? 'No work/close notes in file.' : null,
      selection: null,
      inspectorOpen: false,
      mapper: null,
      toast: outcome.fileWarn ? { kind: 'warn', message: 'Large file (~10MB). Charts may hitch.' } : null,
    });
  },

  applyMapper: (mapping) => {
    const mapper = get().mapper;
    if (!mapper) return;
    const records = mapper.preview.length
      ? /* preview only — not enough. keep pending? */ null
      : null;
    void records;
    // Re-parse is not stored; mapper after failed auto-map needs full records.
    // Store headers+preview only is insufficient. Keep last file? We stored preview of 8.
    // The worker result wasn't kept. Re-require upload is harsh.
    // Stash records on MAP fail via pendingRecords.
    const pending = get().pendingRecords;
    if (!pending) {
      set({ toast: { kind: 'error', message: 'Re-upload the CSV after mapping columns.' }, mapper: null });
      return;
    }
    const result = recordsToRows(pending, mapping);
    if (!result.rows.length) {
      set({ toast: { kind: 'error', message: 'No usable ticket rows after mapping.' } });
      return;
    }
    const rows = result.rows;
    const meta = metaFrom(rows, 'upload', null, 'Upload');
    const filters = get().filters;
    persist('small', filters);
    set({
      rows,
      meta,
      filtered: applyFilters(rows, filters),
      filterKey: filterKey(filters),
      mapper: null,
      pendingRecords: null,
      demoBanner: false,
      pathChip: result.pathInferred ? 'Path inferred — sankey will be shallow.' : null,
      notesChip: result.missingNotes ? 'No work/close notes in file.' : null,
    });
  },

  dismissMapper: () => set({ mapper: null, pendingRecords: null }),

  setFilters: (patch) => {
    const filters = { ...get().filters, ...patch };
    const rows = get().rows;
    persist(get().meta?.sampleId ?? 'small', filters);
    set({
      filters,
      filtered: applyFilters(rows, filters),
      filterKey: filterKey(filters),
    });
  },

  clearFilters: () => {
    const filters = { ...EMPTY_FILTERS };
    persist(get().meta?.sampleId ?? 'small', filters);
    set({
      filters,
      filtered: applyFilters(get().rows, filters),
      filterKey: filterKey(filters),
    });
  },

  setSelection: (sel, open = true) => {
    set({ selection: sel, inspectorOpen: open && !!sel });
  },

  closeInspector: () => set({ inspectorOpen: false, selection: null }),

  filterHubToSelection: () => {
    const sel = get().selection;
    if (!sel?.filterHint?.groups?.length) return;
    get().setFilters({ groups: sel.filterHint.groups, groupMode: 'involved' });
  },

  clearToast: () => set({ toast: null }),
  setToast: (t) => set({ toast: t }),
}));

export { uniqueCategories, uniqueGroups };
