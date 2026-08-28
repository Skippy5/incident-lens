export const TZ = 'America/New_York';
export const APP_NAME = 'Incident Lens';
export const ROW_CAP = 8000;
export const FILE_WARN = 10 * 1024 * 1024;
export const FILE_HARD = 25 * 1024 * 1024;

export const PRIORITY_COLORS: Record<string, string> = {
  '1-Critical': '#C62828',
  '2-High': '#EF6C00',
  '3-Moderate': '#F9A825',
  '4-Low': '#1565C0',
  '5-Planning': '#607D8B',
};

export const PRIORITY_SHORT: Record<string, string> = {
  '1-Critical': 'P1',
  '2-High': 'P2',
  '3-Moderate': 'P3',
  '4-Low': 'P4',
  '5-Planning': 'P5',
};

export const CATEGORY_COLORS: Record<string, string> = {
  desktop: '#5B8A72',
  network: '#4A7BA7',
  app: '#7A6BA6',
  identity: '#C27A4A',
  facilities: '#6B8E23',
};

export const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const SAMPLE_META: Record<
  'small' | 'medium' | 'large',
  { n: number; label: string; file: string; hint?: string }
> = {
  small: { n: 80, label: 'Small', file: '/data/small.csv' },
  medium: { n: 800, label: 'Medium', file: '/data/medium.csv' },
  large: {
    n: 4000,
    label: 'Large',
    file: '/data/large.csv',
    hint: 'May take a few seconds in the browser.',
  },
};

export const PRIVACY_BANNER =
  'This host is not an approved GE processing environment. Hobby is fine for fake data; it is the wrong control plane for real ServiceNow exports. Data never leaves this browser tab. Do not upload GE, customer, or production incident CSVs here.';

export const DEMO_BANNER =
  'Demo data (80 fake incidents). Switch sample or upload a CSV.';

export const HOURS_CAPTION = 'Hours are America/New_York.';
