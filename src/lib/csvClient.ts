import { FILE_HARD, FILE_WARN, ROW_CAP } from './constants';
import {
  AGGREGATED_TOAST,
  autoMap,
  isAggregated,
  recordsToRows,
  sanitizeHeader,
  type MapResult,
} from './parse';

export interface ParseOk {
  ok: true;
  result: MapResult;
  headers: string[];
  mapping: Record<string, string>;
  fileWarn: boolean;
}

export interface ParseFail {
  ok: false;
  code: 'TYPE' | 'SIZE' | 'ROWS' | 'AGGREGATED' | 'MAP' | 'PARSE';
  message: string;
  headers?: string[];
  preview?: Record<string, string>[];
  mapping?: Record<string, string>;
  records?: Record<string, unknown>[];
}

export type ParseOutcome = ParseOk | ParseFail;

function workerParse(file: File): Promise<{ data: Record<string, unknown>[]; fields: string[] }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/csv.worker.ts', import.meta.url), {
      type: 'module',
    });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Parse timed out'));
    }, 60_000);
    worker.onmessage = (ev: MessageEvent<{ ok: boolean; data?: Record<string, unknown>[]; fields?: string[]; message?: string }>) => {
      clearTimeout(timer);
      worker.terminate();
      if (!ev.data.ok) reject(new Error(ev.data.message || 'Parse failed'));
      else resolve({ data: ev.data.data ?? [], fields: ev.data.fields ?? [] });
    };
    worker.onerror = (err) => {
      clearTimeout(timer);
      worker.terminate();
      reject(err);
    };
    worker.postMessage({ file });
  });
}

export async function parseCsvFile(file: File): Promise<ParseOutcome> {
  const name = file.name || 'upload.csv';
  if (!name.toLowerCase().endsWith('.csv')) {
    return { ok: false, code: 'TYPE', message: 'Accept .csv only.' };
  }
  if (file.size > FILE_HARD) {
    return { ok: false, code: 'SIZE', message: 'File is larger than ~25MB and was rejected.' };
  }
  const fileWarn = file.size >= FILE_WARN;
  try {
    const { data, fields } = await workerParse(file);
    const headers = fields.map((h) => sanitizeHeader(h)).filter((h): h is string => !!h);
    if (isAggregated(headers)) {
      return { ok: false, code: 'AGGREGATED', message: AGGREGATED_TOAST, headers };
    }
    if (data.length > ROW_CAP) {
      return {
        ok: false,
        code: 'ROWS',
        message: `Hard max is ${ROW_CAP} rows. This file has more than ${ROW_CAP} and was rejected.`,
      };
    }
    const mapping = autoMap(headers);
    const mappedDest = new Set(Object.values(mapping));
    const hasNumber = mappedDest.has('number');
    const hasOpened = mappedDest.has('opened_at');
    if (!hasNumber || !hasOpened) {
      const preview = data.slice(0, 8).map((r) => {
        const o: Record<string, string> = {};
        for (const h of headers) o[h] = String((r as Record<string, unknown>)[h] ?? '');
        return o;
      });
      return {
        ok: false,
        code: 'MAP',
        message: 'Could not auto-map required columns (number, opened_at). Map them below.',
        headers,
        preview,
        mapping,
        records: data,
      };
    }
    const result = recordsToRows(data, mapping);
    if (!result.rows.length) {
      return {
        ok: false,
        code: 'MAP',
        message: 'No usable ticket rows after mapping.',
        headers,
        mapping,
        records: data,
        preview: data.slice(0, 8).map((r) => {
          const o: Record<string, string> = {};
          for (const h of headers) o[h] = String((r as Record<string, unknown>)[h] ?? '');
          return o;
        }),
      };
    }
    return { ok: true, result, headers, mapping, fileWarn };
  } catch (err) {
    return { ok: false, code: 'PARSE', message: err instanceof Error ? err.message : 'Parse failed' };
  }
}

export async function fetchSampleFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load sample');
  if (url.endsWith('.gz')) {
    const buf = await res.arrayBuffer();
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([buf]).stream().pipeThrough(ds);
    const out = await new Response(stream).blob();
    return new File([out], filename.replace(/\.gz$/, ''), { type: 'text/csv' });
  }
  const blob = await res.blob();
  return new File([blob], filename, { type: 'text/csv' });
}
