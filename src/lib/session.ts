import { EMPTY_FILTERS, type Filters, type SampleId } from './types';

const KEY = 'incident-lens-v1';

export interface SessionBits {
  sampleId: SampleId;
  filters: Filters;
}

export function loadSession(): SessionBits {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { sampleId: 'small', filters: { ...EMPTY_FILTERS } };
    const parsed = JSON.parse(raw) as Partial<SessionBits>;
    const sampleId: SampleId =
      parsed.sampleId === 'medium' || parsed.sampleId === 'large' ? parsed.sampleId : 'small';
    const f = parsed.filters ?? EMPTY_FILTERS;
    return {
      sampleId,
      filters: {
        priorities: Array.isArray(f.priorities) ? f.priorities : [],
        categories: Array.isArray(f.categories) ? f.categories : [],
        groups: Array.isArray(f.groups) ? f.groups : [],
        groupMode: f.groupMode === 'origin' ? 'origin' : 'involved',
        dateFrom: f.dateFrom ?? null,
        dateTo: f.dateTo ?? null,
      },
    };
  } catch {
    return { sampleId: 'small', filters: { ...EMPTY_FILTERS } };
  }
}

export function saveSession(bits: SessionBits): void {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ sampleId: bits.sampleId, filters: bits.filters }),
    );
  } catch {
    /* quota / private mode */
  }
}
