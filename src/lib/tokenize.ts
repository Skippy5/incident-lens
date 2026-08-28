import { KEEP_LIST, STOPWORDS } from './stopwords';
import { redactText } from './redact';
import type { IncidentRow } from './types';

const PHRASES: [string, string][] = [
  ['password reset', 'password_reset'],
  ['vpn client', 'vpn_client'],
  ['active directory', 'active_directory'],
  ['distribution list', 'distribution_list'],
  ['shared mailbox', 'shared_mailbox'],
  ['blue screen', 'blue_screen'],
  ['network drive', 'network_drive'],
  ['print queue', 'print_queue'],
  ['microsoft 365', 'microsoft_365'],
  ['any connect', 'anyconnect'],
];

const PHRASE_LABEL: Record<string, string> = {
  password_reset: 'password reset',
  vpn_client: 'vpn client',
  active_directory: 'active directory',
  distribution_list: 'distribution list',
  shared_mailbox: 'shared mailbox',
  blue_screen: 'blue screen',
  network_drive: 'network drive',
  print_queue: 'print queue',
  microsoft_365: 'microsoft 365',
};

const SYNONYM: Record<string, string> = {
  pwd: 'password',
  passwd: 'password',
  passwords: 'password',
  o365: 'microsoft_365',
  m365: 'microsoft_365',
  wireless: 'wifi',
  ad: 'active_directory',
  aad: 'active_directory',
  map: 'map',
  maps: 'map',
  vpns: 'vpn',
  anyconnect: 'vpn',
  '2fa': 'mfa',
  duo: 'mfa',
  totp: 'mfa',
  printers: 'printer',
  print: 'printer',
  printing: 'printer',
  toner: 'printer',
  laptops: 'laptop',
  macbook: 'laptop',
  notebook: 'laptop',
  s4hana: 'sap',
  tcode: 'sap',
  exchange: 'outlook',
  mailbox: 'outlook',
};

const PLURAL: Record<string, string> = {
  vpns: 'vpn',
  printers: 'printer',
  laptops: 'laptop',
};

export function displayTerm(t: string): string {
  return PHRASE_LABEL[t] ?? t.replaceAll('_', ' ');
}

export interface TokenFields {
  short_description: boolean;
  work_notes: boolean;
  close_notes: boolean;
}

export const DEFAULT_FIELDS: TokenFields = {
  short_description: true,
  work_notes: true,
  close_notes: true,
};

export function documentOf(row: IncidentRow, fields: TokenFields, redact: boolean): string {
  const parts: string[] = [];
  if (fields.short_description) parts.push(row.short_description || '');
  if (fields.work_notes) parts.push(row.work_notes || '');
  if (fields.close_notes) parts.push(row.close_notes || '');
  const raw = parts.join(' ');
  return redact ? redactText(raw) : raw;
}

export function tokenizeDoc(doc: string): string[] {
  let s = doc.toLowerCase();
  s = s.replace(/https?:\/\/\S+/g, ' ');
  for (const [phrase, token] of PHRASES) {
    s = s.replaceAll(phrase, ` ${token} `);
  }
  s = s.replace(/wi-fi/g, ' wifi ');
  const raw = s.split(/[^a-z0-9_]+/).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (let tok of raw) {
    if (tok.includes('_')) {
      // phrase placeholder
    } else {
      if (!/[a-z]/.test(tok)) continue;
      if (tok.length < 3) continue;
    }
    tok = PLURAL[tok] ?? tok;
    tok = SYNONYM[tok] ?? tok;
    if (STOPWORDS.has(tok) && !KEEP_LIST.has(tok)) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

export type TermIndex = Map<string, Set<number>>;

export function buildTermIndex(
  rows: IncidentRow[],
  fields: TokenFields,
  redact: boolean,
): { index: TermIndex; tokensByRow: string[][] } {
  const index: TermIndex = new Map();
  const tokensByRow: string[][] = [];
  for (let i = 0; i < rows.length; i++) {
    const toks = tokenizeDoc(documentOf(rows[i]!, fields, redact));
    tokensByRow.push(toks);
    for (const t of toks) {
      let set = index.get(t);
      if (!set) {
        set = new Set();
        index.set(t, set);
      }
      set.add(i);
    }
  }
  return { index, tokensByRow };
}
