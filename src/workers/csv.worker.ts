import Papa from 'papaparse';

const ROW_CAP = 8000;

self.onmessage = (e: MessageEvent<{ file: File }>) => {
  const file = e.data.file;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    preview: ROW_CAP + 1,
    complete: (results) => {
      const data = (results.data as Record<string, unknown>[]).filter((r) => {
        if (!r || typeof r !== 'object') return false;
        return Object.keys(r).some((k) => String((r as Record<string, unknown>)[k] ?? '').length);
      });
      const fields = (results.meta.fields ?? []).filter((h) => {
        const l = String(h).trim();
        return l && l !== '__proto__' && l !== 'constructor' && l !== 'prototype';
      });
      self.postMessage({ ok: true, data, fields });
    },
    error: (err: { message?: string }) => {
      self.postMessage({ ok: false, message: err?.message || 'Parse failed' });
    },
  });
};
