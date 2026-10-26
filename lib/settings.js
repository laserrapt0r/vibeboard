'use strict';
// Systemeinstellungen (Tabelle settings, ein Schlüssel pro Bereich)
const db = require('./db');

const DEFAULTS = {
  general: {
    siteName: 'dlzboard',
    baseUrl: '',             // öffentliche Adresse für Links in E-Mails, leer = aus der Anfrage
    registration: 'open',    // open | approval | closed
    requireEmail: false,
    notifyAdmins: true,      // Admins bei neuen Registrierungen benachrichtigen
  },
  smtp: {
    host: '',
    port: 587,
    security: 'starttls',    // starttls | tls | none
    user: '',
    pass: '',
    from: '',
    rejectUnauthorized: true,
  },
};

let cache = null;

async function load() {
  const rows = (await db.query('SELECT key, value FROM settings')).rows;
  const out = JSON.parse(JSON.stringify(DEFAULTS));
  for (const r of rows) if (out[r.key]) Object.assign(out[r.key], r.value);
  cache = out;
  return out;
}

async function get() {
  return cache || load();
}

async function update(section, patch) {
  if (!DEFAULTS[section]) throw new Error('Unbekannter Bereich: ' + section);
  const cur = (await get())[section];
  const next = { ...cur };
  for (const k of Object.keys(DEFAULTS[section])) {
    if (patch[k] === undefined) continue;
    const def = DEFAULTS[section][k];
    if (typeof def === 'number') next[k] = Number(patch[k]) || def;
    else if (typeof def === 'boolean') next[k] = !!patch[k];
    else next[k] = k === 'pass' ? String(patch[k]) : String(patch[k]).trim();
  }
  if (section === 'general') {
    if (!['open', 'approval', 'closed'].includes(next.registration)) next.registration = 'open';
    next.baseUrl = next.baseUrl.replace(/\/+$/, '');
    if (next.baseUrl && !/^https?:\/\//i.test(next.baseUrl)) throw new Error('Die öffentliche Adresse muss mit http:// oder https:// beginnen');
    next.siteName = next.siteName.slice(0, 60) || DEFAULTS.general.siteName;
  }
  if (section === 'smtp') {
    if (!['starttls', 'tls', 'none'].includes(next.security)) next.security = 'starttls';
    next.port = Math.max(1, Math.min(65535, Math.round(next.port)));
  }
  await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [section, next]);
  cache = null;
  return next;
}

// Für die Admin-Oberfläche: Passwort nie im Klartext ausliefern
async function forAdmin() {
  const s = await get();
  return { general: s.general, smtp: { ...s.smtp, pass: '', hasPassword: !!s.smtp.pass } };
}

async function mailConfigured() {
  const s = await get();
  return !!(s.smtp.host && s.smtp.from);
}

module.exports = { DEFAULTS, get, update, forAdmin, mailConfigured };
