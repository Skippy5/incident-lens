#!/usr/bin/env node
/**
 * fake-itsm-csv@1.2 — seeded synthetic ServiceNow-like incidents.
 * Outputs public/data/{small,medium,large}.csv + manifest.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../public/data');

const GROUPS = [
  'Service Desk',
  'Desktop Support',
  'Endpoint Engineering',
  'Network Ops',
  'App Support',
  'SAP Support',
  'Identity/IAM',
  'Facilities',
  'Collaboration Services',
  'Major Incident',
  'Vendor Mgmt',
  'Security Ops',
];

const NAMES = {
  'Service Desk': [
    'Jordan Hale', 'Riley Cho', 'Morgan Voss', 'Avery Lang', 'Casey Quintana',
    'Quinn Patel', 'Sage Okonkwo', 'Rowan Ellis', 'Blake Ibarra', 'Drew Kimura',
  ],
  'Desktop Support': ['Harper Nunez', 'Finley Shah', 'Cameron Ortiz', 'Reese Dalton', 'Parker Singh'],
  'Endpoint Engineering': ['Taylor Brooks', 'Dakota Chen', 'Emerson Vale', 'Jamie Solis'],
  'Network Ops': ['Hayden Cruz', 'Skyler Bond', 'Logan West', 'Peyton Ames'],
  'App Support': ['Jules Navarro', 'Kendall Frost', 'Remy Cole', 'Shay Ortega'],
  'SAP Support': ['Nico Alvarez', 'Blair Mendes', 'Shiloh Grant', 'Eden Brooks'],
  'Identity/IAM': ['Phoenix Lee', 'Marlowe Singh', 'Eden Park', 'Sloane Adler'],
  'Facilities': ['River Santos', 'Indigo Walsh', 'Sol Vega', 'Lane Ortiz'],
  'Collaboration Services': ['Arden Miles', 'Wynn Foster', 'Taryn Bell'],
  'Major Incident': ['Cassidy Rowe', 'Lennox Hart', 'Marlowe Quinn'],
  'Vendor Mgmt': ['Sutton Grey', 'Tatum Rhodes', 'Ellis Prado'],
  'Security Ops': ['Monroe Hale', 'Ellis Prado', 'Robin Vale'],
};
// Ellis Prado duplicated — fix Security Ops
NAMES['Security Ops'] = ['Monroe Hale', 'Robin Vale', 'Chris Adelman', 'Samir Holt'];

const SUBCATS = {
  desktop: [
    ['laptop-hardware', 28],
    ['printer', 22],
    ['os-software', 20],
    ['peripheral', 15],
    ['other-desktop', 15],
  ],
  network: [
    ['vpn', 40],
    ['wifi', 25],
    ['wan-lan', 15],
    ['dns', 10],
    ['other-network', 10],
  ],
  app: [
    ['sap', 35],
    ['outlook', 20],
    ['zoom-teams', 15],
    ['web-app', 15],
    ['other-app', 15],
  ],
  identity: [
    ['password-reset', 35],
    ['mfa', 30],
    ['account-lockout', 15],
    ['access-request', 15],
    ['other-identity', 5],
  ],
  facilities: [
    ['badge-access', 40],
    ['hvac', 25],
    ['workspace', 20],
    ['other-facilities', 15],
  ],
};

const CAT_WEIGHTS = [
  ['desktop', 32],
  ['app', 24],
  ['network', 18],
  ['identity', 16],
  ['facilities', 10],
];

const PRI_WEIGHTS = [
  ['1-Critical', 2],
  ['2-High', 10],
  ['3-Moderate', 55],
  ['4-Low', 33],
];

const SLA_HOURS = { '1-Critical': 4, '2-High': 8, '3-Moderate': 48, '4-Low': 120 };
const MTTR_MED = { '1-Critical': 2.5, '2-High': 6, '3-Moderate': 18, '4-Low': 40 };
const MTTR_P90 = { '1-Critical': 14, '2-High': 22, '3-Moderate': 72, '4-Low': 160 };

const TEMPLATES = {
  'laptop-hardware': [
    'Laptop {symptom} — {device} will not {action}',
    '{device} battery drains in under two hours',
    'Docking station not detecting {device}',
    'Laptop charger not seating; battery icon missing',
    '{device} overheats under light load',
    'Keyboard keys sticking on {device}',
    'Laptop lid sensor false sleep on {device}',
    'Cannot boot {device} after weekend patch',
  ],
  printer: [
    'Printer {symptom} on Floor {floor}',
    'Toner low / print queue stuck for {device}',
    'Print jobs stall; jam on {device}',
    'Cannot add printer {device} after profile rebuild',
    'Color prints banding on {device}',
    'Print queue will not clear for shared {device}',
    'Label printer offline in Building {bldg}',
    'Cannot print PDF to {device}',
  ],
  'os-software': [
    'Windows patch failed on {device}; bitlocker prompt loop',
    'Chrome will not start after update on {device}',
    'BitLocker recovery key requested for {device}',
    'OS freeze / blue screen on {device}',
    'Software center missing required app on {device}',
    'Windows update stuck at 87% on {device}',
  ],
  peripheral: [
    'Monitor flicker on {device} dock',
    'Headset mute button not working',
    'Keyboard not detected after sleep',
    'Second monitor no signal after dock swap',
    'Webcam disabled after patch',
  ],
  'other-desktop': [
    'Desktop profile corrupt after login',
    'Mapped network drive missing at logon',
    'Local admin rights needed for vendor tool',
    'Slow logon on {device}',
  ],
  vpn: [
    'VPN client drops every few minutes',
    'Cannot connect VPN from home — anyconnect timeout',
    'VPN tunnel up but no internal DNS',
    'AnyConnect error after password change',
    'VPN client will not launch on {device}',
    'Split tunnel missing file share over VPN',
    'VPN disconnects during large file copy',
    'Cannot reach SAP over VPN client',
  ],
  wifi: [
    'WiFi drops in Building {bldg} Floor {floor}',
    'Cannot join corporate SSID after laptop rebuild',
    'Wireless adapter missing after sleep',
    'DHCP not assigning on wifi',
    'Poor wifi near conference room {floor}',
  ],
  'wan-lan': [
    'Switch in Building {bldg} showing high latency',
    'Intermittent WAN outage reported by floor {floor}',
    'Wired port dead at desk',
    'Latency spike to app gateway',
  ],
  dns: [
    'DNS will not resolve internal host',
    'Name resolution timeout after VPN connect',
    'Cannot resolve printer hostname',
  ],
  'other-network': [
    'Network share unreachable from {device}',
    'Firewall prompt blocking vendor agent',
    'Packet loss on wired dock',
  ],
  sap: [
    'SAP GUI timeout on tcode {tcode}',
    'Cannot launch S/4 after role change',
    'SAP dump while saving {tcode}',
    'Missing SAP authorization for {tcode}',
    'SAP password expired; GUI will not open',
    'Slow SAP transaction {tcode} this morning',
    'S4HANA fiori tile missing after transport',
  ],
  outlook: [
    'Outlook not sending; mailbox full',
    'Shared mailbox missing after migration',
    'Calendar invites not showing in Outlook',
    'Exchange disconnected banner in Outlook',
    'Cannot search mailbox after weekend',
    'Distribution list bounce on send',
  ],
  'zoom-teams': [
    'Zoom meeting audio missing on {device}',
    'Teams will not join from laptop',
    'Zoom client crash on screen share',
    'Teams presence stuck offline',
    'Meeting headset not selected in Zoom',
  ],
  'web-app': [
    'Chrome SSO timeout on web app',
    'Browser tab freeze on internal portal',
    'Cannot sign in to web app after MFA prompt',
    'Page timeout in Chrome after lunch',
  ],
  'other-app': [
    'Business app will not start after patch',
    'License error on desktop client',
    'App crash on save',
  ],
  'password-reset': [
    'Password reset needed — account lockout',
    'Password expired; cannot log on',
    'User forgot password after leave',
    'Password reset via self-service failed',
    'Need password reset for shared kiosk',
  ],
  mfa: [
    'MFA prompt loop — Duo push never arrives',
    'Cannot enroll MFA token on new phone',
    'Duo 2FA denied after travel',
    'MFA device lost; need reset',
    'TOTP out of sync after clock change',
    'MFA enrollment week — new hire cannot complete Duo',
  ],
  'account-lockout': [
    'AD account disabled after password spray lockout',
    'Account lockout repeating every hour',
    'Cannot unlock AD account from Service Desk tool',
  ],
  'access-request': [
    'Access request for distribution list',
    'Need Okta group for new role',
    'Active directory group membership request',
    'Access to shared mailbox for project',
  ],
  'other-identity': [
    'Stale account needs review',
    'Contractor account expiration',
  ],
  'badge-access': [
    'Badge reader at Building {bldg} door will not beep',
    'Badge access denied on Floor {floor}',
    'New badge not provisioned',
    'Door lock stuck after badge tap',
  ],
  hvac: [
    'HVAC too cold on Floor {floor}',
    'Thermostat unresponsive in Building {bldg}',
    'Temperature swing in conference room',
    'HVAC alarm on Floor {floor}',
  ],
  workspace: [
    'Desk move request Floor {floor}',
    'Chair hydraulic failed',
    'Need workspace setup in Building {bldg}',
  ],
  'other-facilities': [
    'Light out near desk',
    'Water leak reported Building {bldg}',
  ],
};

const SYMPTOMS = ['will not boot', 'intermittent freeze', 'no display', 'loud fan', 'random restart'];
const DEVICES = ['Latitude 5540', 'ThinkPad T14', 'EliteBook 840', 'MacBook', 'Surface Laptop'];
const TCODES = ['ME21N', 'VA01', 'FB01', 'MM03', 'SU01', 'IW32'];
const BLDGS = ['A', 'B', 'C', 'North', 'East'];
const FLOORS = ['2', '3', '4', '5', '8', '12'];

const CLOSE = {
  'laptop-hardware': ['Replaced charger and retested battery.', 'Reseated dock; display path restored.', 'Imaged laptop; hardware test passed.'],
  printer: ['Replaced toner and cleared jam.', 'Reset print queue and republished printer.', 'Power-cycled printer; queue drained.'],
  'os-software': ['Completed patch and verified BitLocker.', 'Repaired Chrome install.', 'Cleared update cache; reboot succeeded.'],
  peripheral: ['Swapped headset; mute works.', 'Updated dock firmware.', 'Re-enabled webcam in device manager.'],
  'other-desktop': ['Rebuilt profile; network drive mapped.', 'Granted temporary local admin.'],
  vpn: ['VPN profile rebuilt; tunnel stable.', 'Reset AnyConnect and refreshed cert.', 'Fixed DNS suffix on VPN adapter.'],
  wifi: ['Reprovisioned SSID profile.', 'Replaced wireless driver.', 'AP reset on Floor — signal restored.'],
  'wan-lan': ['Port bounce on switch; link up.', 'Vendor cleared WAN incident.'],
  dns: ['Flushed DNS; internal zones resolve.', 'Corrected VPN DNS servers.'],
  'other-network': ['Share path restored after ACL fix.'],
  sap: ['SAP role provisioned; tcode authorized.', 'GUI cache cleared; S/4 opens.', 'Transport reapplied; tile restored.'],
  outlook: ['Mailbox quota increased; Outlook sending.', 'Remapped shared mailbox.', 'Repaired Outlook profile.'],
  'zoom-teams': ['Reinstalled Zoom client; audio device set.', 'Teams cache cleared.'],
  'web-app': ['Cleared SSO cookies; Chrome sign-in works.'],
  'other-app': ['Repaired client install; license refreshed.'],
  'password-reset': ['Password reset completed; user logged on.', 'Unlocked account and forced password change.'],
  mfa: ['Reset Duo device; enrollment complete.', 'Resynced TOTP; MFA prompt succeeds.'],
  'account-lockout': ['Unlocked AD account; advised password hygiene.'],
  'access-request': ['Added to Okta group / distribution list.', 'Provisioned shared mailbox access.'],
  'other-identity': ['Account reviewed and extended.'],
  'badge-access': ['Badge recoded; reader tested.', 'Door controller reset.'],
  hvac: ['Thermostat reset; temperature stable.', 'Vendor adjusted HVAC setpoint.'],
  workspace: ['Desk move completed.', 'Chair replaced.'],
  'other-facilities': ['Work order closed with vendor.'],
};

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function weighted(rng, pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rng() * total;
  for (const [v, w] of pairs) {
    r -= w;
    if (r <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}
function jitterWeights(rng, pairs, pp) {
  return pairs.map(([k, w]) => [k, Math.max(0.5, w + (rng() * 2 - 1) * pp)]);
}
function lognormal(rng, median, p90) {
  const mu = Math.log(median);
  const sigma = (Math.log(p90) - mu) / 1.28155156554;
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0.05, Math.exp(mu + sigma * z));
}
function collapse(parts) {
  const out = [];
  for (const p of parts) {
    if (!out.length || out[out.length - 1] !== p) out.push(p);
  }
  return out;
}
function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}
/** DST: 2026-03-08 02:00 through 2026-11-01 02:00 America/New_York */
function offsetForYmd(y, m, d) {
  // m is 1-12
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const start = new Date(Date.UTC(2026, 2, 8, 7)); // ~02:00 EST
  const end = new Date(Date.UTC(2026, 10, 1, 6));
  return dt >= start && dt < end ? -4 : -5;
}
function formatIso(y, mo, d, h, mi, s, off) {
  const sign = off < 0 ? '-' : '+';
  const oh = pad(Math.abs(off));
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}${sign}${oh}:00`;
}
function addHours(y, mo, d, h, mi, s, hours) {
  // work in UTC-ish by converting to minutes with offset then add
  const off = offsetForYmd(y, mo, d);
  const utcMs = Date.UTC(y, mo - 1, d, h - off, mi, s) + hours * 3600000;
  const tmp = new Date(utcMs);
  // convert back to ET
  let ey = tmp.getUTCFullYear();
  let emo = tmp.getUTCMonth() + 1;
  let ed = tmp.getUTCDate();
  let eh = tmp.getUTCHours();
  let emi = tmp.getUTCMinutes();
  let es = tmp.getUTCSeconds();
  const off2 = offsetForYmd(ey, emo, ed);
  // utc hours + off2 = ET hours
  let localH = eh + off2;
  let localD = ed;
  let localMo = emo;
  let localY = ey;
  if (localH < 0) {
    localH += 24;
    const prev = new Date(Date.UTC(ey, emo - 1, ed - 1));
    localY = prev.getUTCFullYear();
    localMo = prev.getUTCMonth() + 1;
    localD = prev.getUTCDate();
  } else if (localH >= 24) {
    localH -= 24;
    const next = new Date(Date.UTC(ey, emo - 1, ed + 1));
    localY = next.getUTCFullYear();
    localMo = next.getUTCMonth() + 1;
    localD = next.getUTCDate();
  }
  return { y: localY, mo: localMo, d: localD, h: localH, mi: emi, s: es, off: offsetForYmd(localY, localMo, localD) };
}

function isoWeek(y, mo, d) {
  const date = new Date(Date.UTC(y, mo - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function specialistForCategory(rng, category, subcategory) {
  if (category === 'desktop') {
    const r = rng();
    if (r < 0.7) return 'Desktop Support';
    if (r < 0.85) return 'Endpoint Engineering';
    if (r < 0.9) return 'Vendor Mgmt';
    return 'Service Desk';
  }
  if (category === 'network') {
    const r = rng();
    if (r < 0.75) return 'Network Ops';
    if (r < 0.83) return 'Vendor Mgmt';
    if (r < 0.95) return 'Service Desk';
    return 'Major Incident';
  }
  if (category === 'app') {
    if (subcategory === 'sap') return rng() < 0.8 ? 'SAP Support' : 'App Support';
    if (subcategory === 'outlook' || subcategory === 'zoom-teams') {
      return rng() < 0.6 ? 'Collaboration Services' : 'App Support';
    }
    return rng() < 0.1 ? 'Service Desk' : 'App Support';
  }
  if (category === 'identity') {
    const r = rng();
    if (subcategory === 'password-reset' && rng() < 0.55) return 'Service Desk';
    if (r < 0.6) return 'Identity/IAM';
    if (r < 0.9) return 'Service Desk';
    return 'Security Ops';
  }
  // facilities
  const r = rng();
  if (r < 0.85) return 'Facilities';
  if (r < 0.95) return 'Service Desk';
  return 'Vendor Mgmt';
}

function buildPath(rng, category, subcategory, priority, pingPongKind) {
  const spec = specialistForCategory(rng, category, subcategory);
  let origin;
  const o = rng();
  if (o < 0.86) origin = 'Service Desk';
  else if (o < 0.92) origin = spec === 'Service Desk' ? pick(rng, ['Desktop Support', 'Network Ops', 'App Support']) : spec;
  else if (o < 0.97) origin = 'Major Incident';
  else origin = rng() < 0.5 ? 'Facilities' : 'Vendor Mgmt';

  if (priority === '1-Critical' && rng() < 0.7 && origin !== 'Major Incident') {
    // insert Major Incident as first or middle later
  }

  let hops;
  if (pingPongKind === 'double') {
    const spec2 = rng() < 0.3 ? specialistForCategory(rng, category, subcategory) : spec;
    hops = ['Service Desk', spec, 'Service Desk', spec2];
  } else if (pingPongKind === 'single') {
    hops = ['Service Desk', spec, 'Service Desk'];
  } else if (origin === spec || (origin !== 'Service Desk' && rng() < 0.45)) {
    hops = [origin];
    if (origin === 'Service Desk' && spec !== 'Service Desk' && rng() < 0.7) {
      hops = [origin, spec];
    }
  } else if (origin === 'Service Desk') {
    hops = [origin, spec];
  } else {
    hops = [origin, spec];
  }

  if ((priority === '1-Critical' && rng() < 0.7) || (priority === '2-High' && rng() < 0.15)) {
    if (!hops.includes('Major Incident')) {
      hops.splice(Math.min(1, hops.length), 0, 'Major Incident');
    }
  }

  // consecutive-dupe noise ~4% of tickets: duplicate one hop
  if (rng() < 0.04 && hops.length >= 1) {
    const i = Math.floor(rng() * hops.length);
    hops.splice(i + 1, 0, hops[i]);
  }

  // cap 10
  if (hops.length > 10) hops = hops.slice(0, 10);
  return hops;
}

function fillTemplate(rng, tmpl) {
  return tmpl
    .replaceAll('{symptom}', pick(rng, SYMPTOMS))
    .replaceAll('{device}', pick(rng, DEVICES))
    .replaceAll('{action}', pick(rng, ['boot', 'charge', 'wake', 'dock']))
    .replaceAll('{tcode}', pick(rng, TCODES))
    .replaceAll('{bldg}', pick(rng, BLDGS))
    .replaceAll('{floor}', pick(rng, FLOORS));
}

function maybeTypo(rng, s) {
  if (rng() > 0.02) return s;
  return s.replace('printer', 'printter').replace('VPN', 'VPNN').replace('vpn', 'vpnn');
}

function sampleOpened(rng, startMs, endMs, dayWeights, spikeWeeks, drift) {
  // rejection sample until in window
  for (let attempt = 0; attempt < 40; attempt++) {
    const t = startMs + rng() * (endMs - startMs);
    const d = new Date(t);
    // interpret as UTC then treat Y-M-D as ET calendar
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dow = d.getUTCDay(); // 0 sun
    const week = isoWeek(y, mo, day);
    let w = 1;
    // weekday seasonality
    const dowW = [0.25, 1.35, 1.15, 1.1, 0.95, 0.7, 0.25][dow];
    w *= dowW;
    const frac = (t - startMs) / (endMs - startMs);
    w *= 1 + drift * frac;
    if (spikeWeeks.vpn === week) w *= 2.25;
    if (spikeWeeks.mfa === week) w *= 1.8;
    if (rng() < Math.min(1, w / 3.2)) {
      // hour
      let hour;
      const weekend = dow === 0 || dow === 6;
      const u = rng();
      if (weekend) {
        hour = Math.floor(rng() * 24);
      } else if (u < 0.75 / 0.93) {
        // business 8-16, bimodal 9-11 and 13-15
        const b = rng();
        if (b < 0.38) hour = 9 + Math.floor(rng() * 3); // 9-11
        else if (b < 0.7) hour = 13 + Math.floor(rng() * 3); // 13-15
        else hour = 8 + Math.floor(rng() * 9); // 8-16
      } else {
        hour = rng() < 0.5 ? Math.floor(rng() * 8) : 17 + Math.floor(rng() * 7);
      }
      const mi = Math.floor(rng() * 60);
      const s = Math.floor(rng() * 60);
      return { y, mo, d: day, h: hour, mi, s, off: offsetForYmd(y, mo, day), week, dow };
    }
  }
  const d = new Date(startMs + rng() * (endMs - startMs));
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return {
    y, mo, d: day, h: 10, mi: Math.floor(rng() * 60), s: Math.floor(rng() * 60),
    off: offsetForYmd(y, mo, day), week: isoWeek(y, mo, day), dow: d.getUTCDay(),
  };
}

function generate({ n, seed, windowDays, label, startNumber }) {
  const rng = mulberry32(seed);
  const end = { y: 2026, mo: 8, d: 27 };
  const endDate = new Date(Date.UTC(2026, 7, 27));
  const startDate = new Date(endDate.getTime() - windowDays * 86400000);
  const startMs = startDate.getTime();
  const endMs = endDate.getTime() + 20 * 3600000;

  // pick spike weeks: ~40% and ~70% into window
  const mid1 = new Date(startMs + (endMs - startMs) * 0.4);
  const mid2 = new Date(startMs + (endMs - startMs) * 0.68);
  const spikeWeeks = {
    vpn: isoWeek(mid1.getUTCFullYear(), mid1.getUTCMonth() + 1, mid1.getUTCDate()),
    mfa: isoWeek(mid2.getUTCFullYear(), mid2.getUTCMonth() + 1, mid2.getUTCDate()),
  };

  const catW = jitterWeights(rng, CAT_WEIGHTS, 3);
  const priW = jitterWeights(rng, PRI_WEIGHTS, 1.2);

  const rows = [];
  let num = startNumber;
  let pingPongDouble = 0;
  let pingPongSingle = 0;
  const targetDouble = Math.round(n * 0.12);
  const targetSingle = Math.round(n * 0.06);

  for (let i = 0; i < n; i++) {
    num += 1 + Math.floor(rng() * 7);
    const number = `INC${String(num).padStart(7, '0')}`;

    let category = weighted(rng, catW);
    // plant spikes: extra vpn/mfa
    const forceRecent = i < Math.round(n * 0.11);
    const opened = forceRecent
      ? sampleOpened(rng, endMs - 14 * 86400000, endMs, null, spikeWeeks, 0)
      : sampleOpened(rng, startMs, endMs, null, spikeWeeks, 0.15);
    if (opened.week === spikeWeeks.vpn && rng() < 0.55) category = rng() < 0.75 ? 'network' : 'desktop';
    if (opened.week === spikeWeeks.mfa && rng() < 0.5) category = 'identity';

    const subW = jitterWeights(rng, SUBCATS[category], 5);
    let subcategory = weighted(rng, subW);
    if (opened.week === spikeWeeks.vpn && category === 'network') subcategory = 'vpn';
    if (opened.week === spikeWeeks.mfa && category === 'identity') subcategory = rng() < 0.7 ? 'mfa' : 'password-reset';

    const priority = weighted(rng, priW);

    let pingKind = null;
    if (pingPongDouble < targetDouble && rng() < 0.14) {
      pingKind = 'double';
      pingPongDouble++;
    } else if (pingPongSingle < targetSingle && rng() < 0.08) {
      pingKind = 'single';
      pingPongSingle++;
    }
    // catch-up near end
    if (i > n * 0.85) {
      if (pingPongDouble < targetDouble) {
        pingKind = 'double';
        pingPongDouble++;
      } else if (pingPongSingle < targetSingle) {
        pingKind = 'single';
        pingPongSingle++;
      }
    }

    const hopsRaw = buildPath(rng, category, subcategory, priority, pingKind);
    const hops = collapse(hopsRaw);
    const assignment_group = hops[hops.length - 1];
    const assignment_path = hopsRaw.join('|');

    const bounced = hops.some((g, idx) => hops.indexOf(g) !== idx);

    // state: open 11% last 14 days
    const openedDate = Date.UTC(opened.y, opened.mo - 1, opened.d);
    const daysFromEnd = (endDate.getTime() - openedDate) / 86400000;
    let state;
    const rState = rng();
    const isRecent = daysFromEnd <= 14;
    if (forceRecent || isRecent) {
      if (forceRecent || rState < 0.85) {
        state = rState < 0.35 ? 'New' : rState < 0.75 ? 'In Progress' : 'On Hold';
      } else if (rState < 0.9) state = 'Resolved';
      else state = 'Closed';
    } else if (!isRecent && rState < 0.02 && daysFromEnd <= 45) {
      state = 'On Hold';
    } else if (rState < 0.03) {
      state = 'Canceled';
    } else if (rState < 0.12) {
      state = 'Resolved';
    } else {
      state = 'Closed';
    }
    // force old tickets closed/resolved/canceled
    if (daysFromEnd > 45 && (state === 'New' || state === 'In Progress')) {
      state = rng() < 0.1 ? 'Canceled' : 'Closed';
    }

    const openedIso = formatIso(opened.y, opened.mo, opened.d, opened.h, opened.mi, opened.s, opened.off);

    let resolved_at = '';
    let closed_at = '';
    let made_sla = '';
    let close_notes = '';
    let mttr = null;

    if (state === 'Resolved' || state === 'Closed') {
      let hours = lognormal(rng, MTTR_MED[priority], MTTR_P90[priority]);
      if (bounced) hours *= 1.15 + rng() * 0.35;
      if (hops.length - 1 >= 3) hours *= 1.15;
      mttr = hours;
      const res = addHours(opened.y, opened.mo, opened.d, opened.h, opened.mi, opened.s, hours);
      resolved_at = formatIso(res.y, res.mo, res.d, res.h, res.mi, res.s, res.off);
      let sla = hours <= SLA_HOURS[priority];
      if (rng() < 0.04) sla = !sla;
      if (bounced && priority === '1-Critical' && rng() < 0.5) sla = false;
      made_sla = sla ? 'true' : 'false';
      close_notes = pick(rng, CLOSE[subcategory] || ['Resolved.']);
      if (state === 'Closed') {
        const lag = lognormal(rng, 8, 36);
        const cl = addHours(res.y, res.mo, res.d, res.h, res.mi, res.s, lag);
        closed_at = formatIso(cl.y, cl.mo, cl.d, cl.h, cl.mi, cl.s, cl.off);
      }
    } else if (state === 'Canceled') {
      const lag = 2 + rng() * 48;
      const cl = addHours(opened.y, opened.mo, opened.d, opened.h, opened.mi, opened.s, lag);
      closed_at = formatIso(cl.y, cl.mo, cl.d, cl.h, cl.mi, cl.s, cl.off);
      close_notes = rng() < 0.5 ? `Canceled — duplicate of INC${String(num - 12).padStart(7, '0')}` : 'Canceled — user no-response';
    }

    let reopen_count = 0;
    const rr = rng();
    if (rr > 0.88) reopen_count = 1;
    if (rr > 0.96) reopen_count = 2;
    if (rr > 0.99) reopen_count = 3;
    if (n >= 4000 && rng() < 0.004) reopen_count = 4 + Math.floor(rng() * 2);
    if (bounced && rng() < 0.15) reopen_count = Math.max(reopen_count, 1);

    const assigned_to = rng() < 0.04 ? '' : pick(rng, NAMES[assignment_group] || NAMES['Service Desk']);

    let short = maybeTypo(rng, fillTemplate(rng, pick(rng, TEMPLATES[subcategory])));
    // light misfile 3%
    if (rng() < 0.03) {
      short = maybeTypo(rng, fillTemplate(rng, pick(rng, TEMPLATES.vpn.concat(TEMPLATES.mfa))));
    }

    const workLines = [];
    const nNotes = state === 'New' ? (rng() < 0.4 ? 0 : 1) : 1 + Math.floor(rng() * (priority === '1-Critical' ? 4 : 3));
    for (let k = 0; k < nNotes; k++) {
      const who = assigned_to || pick(rng, NAMES['Service Desk']);
      const ts = `${opened.y}-${pad(opened.mo)}-${pad(opened.d)} ${pad((opened.h + k) % 24)}:${pad(opened.mi)}:${pad((opened.s + k * 7) % 60)}`;
      workLines.push(`${ts} - ${who} (Work notes)`);
      workLines.push(
        k === 0
          ? `User reports: ${short}. Routing toward ${assignment_group}.`
          : pick(rng, [
              `Checked ${subcategory} path; still failing.`,
              `Escalating to ${hops[Math.min(k, hops.length - 1)]}.`,
              `Waiting on user callback.`,
              `Applied standard workaround.`,
            ]),
      );
    }
    let work_notes = rng() < 0.12 ? '' : workLines.join('\n');

    // description: skip on large (keep column empty-ish); short on small/medium
    let description = '';
    if (label !== 'large' && rng() > 0.08) {
      description = `${short}\nPlease assist.\nThanks,\n${assigned_to || 'End User'}\n@example.invalid`;
    }

    // synthetic PII residue ~3%
    if (rng() < 0.03) {
      const kind = Math.floor(rng() * 3);
      const residue =
        kind === 0
          ? ' jhale419@example.invalid'
          : kind === 1
            ? ' +1-212-555-0142'
            : ' ad\\jhale419';
      if (work_notes) work_notes += residue;
      else short += residue;
    }

    rows.push({
      number,
      opened_at: openedIso,
      resolved_at,
      closed_at,
      state,
      priority,
      category,
      subcategory,
      assignment_group,
      assigned_to,
      short_description: short,
      description,
      work_notes,
      close_notes,
      made_sla,
      reopen_count,
      assignment_path,
    });
  }

  return { rows, spikeWeeks, pingPongDouble, pingPongSingle };
}

function validate(rows, label) {
  const nums = new Set();
  let err = 0;
  const issues = [];
  for (const r of rows) {
    if (nums.has(r.number)) {
      issues.push('dup number');
      err++;
    }
    nums.add(r.number);
    const raw = r.assignment_path.split('|').map((s) => s.trim()).filter(Boolean);
    const col = collapse(raw);
    if (r.assignment_group !== col[col.length - 1]) {
      issues.push('group mismatch');
      err++;
    }
    const hasRes = r.resolved_at !== '';
    const hasClo = r.closed_at !== '';
    if (r.state === 'New' || r.state === 'In Progress' || r.state === 'On Hold') {
      if (hasRes || hasClo || r.made_sla !== '') {
        issues.push('open has ts');
        err++;
      }
    }
    if (r.state === 'Closed' && (!hasRes || !hasClo || r.made_sla === '')) {
      issues.push('closed incomplete');
      err++;
    }
    if (r.state === 'Canceled' && (hasRes || !hasClo || r.made_sla !== '')) {
      issues.push('canceled bad');
      err++;
    }
    if (r.state === 'Resolved' && (!hasRes || r.made_sla === '')) {
      issues.push('resolved incomplete');
      err++;
    }
    if (!SUBCATS[r.category].some(([s]) => s === r.subcategory)) {
      issues.push('subcat');
      err++;
    }
  }
  if (err) {
    const tally = {};
    for (const i of issues) tally[i] = (tally[i] || 0) + 1;
    console.error(label, 'validation failures', tally);
    throw new Error('validation failed');
  }
}

const COLS = [
  'number', 'opened_at', 'resolved_at', 'closed_at', 'state', 'priority', 'category',
  'subcategory', 'assignment_group', 'assigned_to', 'short_description', 'description',
  'work_notes', 'close_notes', 'made_sla', 'reopen_count', 'assignment_path',
];

function writeCsv(file, rows) {
  const lines = [COLS.join(',')];
  for (const r of rows) {
    lines.push(COLS.map((c) => csvEscape(r[c])).join(','));
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

fs.mkdirSync(OUT, { recursive: true });

const specs = [
  { label: 'small', n: 80, seed: 801, windowDays: 90, startNumber: 1010000 },
  { label: 'medium', n: 800, seed: 802, windowDays: 183, startNumber: 1200000 },
  { label: 'large', n: 4000, seed: 4001, windowDays: 365, startNumber: 2000000 },
];

const manifest = {
  generator: 'fake-itsm-csv@1.2',
  end: '2026-08-27',
  timezone: 'America/New_York',
  samples: {},
};

for (const spec of specs) {
  const { rows, spikeWeeks, pingPongDouble, pingPongSingle } = generate(spec);
  validate(rows, spec.label);
  const file = path.join(OUT, `${spec.label}.csv`);
  writeCsv(file, rows);
  const bytes = fs.statSync(file).size;
  manifest.samples[spec.label] = {
    n: spec.n,
    seed: spec.seed,
    windowDays: spec.windowDays,
    end: '2026-08-27',
    file: `${spec.label}.csv`,
    bytes,
    spikeWeeks,
    pingPongDouble,
    pingPongSingle,
  };
  console.log(spec.label, rows.length, 'rows', (bytes / 1024).toFixed(1), 'KB', 'spikes', spikeWeeks);
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote', OUT);
