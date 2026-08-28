export type SampleId = 'small' | 'medium' | 'large';
export type DatasetKind = 'sample' | 'upload';
export type GroupMode = 'origin' | 'involved';

export interface IncidentRow {
  number: string;
  opened_at: Date | null;
  resolved_at: Date | null;
  closed_at: Date | null;
  state: string;
  priority: string;
  category: string;
  subcategory: string;
  assignment_group: string;
  assigned_to: string | null;
  short_description: string;
  description: string | null;
  work_notes: string | null;
  close_notes: string | null;
  made_sla: boolean | null;
  reopen_count: number;
  assignment_path: string;
  mttr_hours: number | null;
  time_to_close_hours: number | null;
  path_parts_raw: string[];
  path_parts: string[];
  origin_group: string;
  resolver_group: string;
  via_label: string;
  is_direct: boolean;
  reassignment_count: number;
  bounced: boolean;
  sd_bounce_back: boolean;
  opened_hour: number;
  opened_dow: string;
  opened_week: string;
  opened_month: string;
  is_open: boolean;
  sla_evaluable: boolean;
  path_inferred: boolean;
}

export interface Filters {
  priorities: string[];
  categories: string[];
  groups: string[];
  groupMode: GroupMode;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface DatasetMeta {
  id: string;
  name: string;
  kind: DatasetKind;
  sampleId: SampleId | null;
  n: number;
  dateMin: Date | null;
  dateMax: Date | null;
  pathInferred: boolean;
  missingNotes: boolean;
}

export type SelectionKind = 'flow-node' | 'flow-link' | 'flow-loop' | 'word' | 'cluster' | 'ops';

export interface Selection {
  kind: SelectionKind;
  title: string;
  ticketNumbers: string[];
  filterHint?: { groups?: string[]; term?: string };
}

export interface Toast {
  kind: 'info' | 'warn' | 'error';
  message: string;
}

export interface MapperState {
  headers: string[];
  preview: Record<string, string>[];
  mapping: Record<string, string>;
}

export const EMPTY_FILTERS: Filters = {
  priorities: [],
  categories: [],
  groups: [],
  groupMode: 'involved',
  dateFrom: null,
  dateTo: null,
};
