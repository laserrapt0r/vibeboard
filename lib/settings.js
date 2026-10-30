'use strict';
// Systemeinstellungen (Tabelle settings, ein Schlüssel pro Bereich)
const db = require('./db');

const DEFAULTS = {
  general: {
    siteName: 'vibeboard',
    baseUrl: '',             // öffentliche Adresse für Links in E-Mails, leer = aus der Anfrage
    registration: 'open',    // open | approval | closed
    notifyAdmins: true,      // Admins bei neuen Registrierungen benachrichtigen
  },
  security: {
    passwordMinLength: 12,   // NIST SP 800-63B empfiehlt mind. 8, besser 12–15
    hibpCheck: false,        // Kennwörter mit „Have I Been Pwned“ abgleichen (externer Dienst, k-Anonymität)
    blockDisposable: true,   // Wegwerf-E-Mail-Domains sperren
    blockedDomains: '',      // zusätzliche gesperrte Domains
    allowedDomains: '',      // falls gesetzt: nur diese Domains zulassen
    requireMfaAdmins: false, // Administration nur mit Zwei-Faktor-Anmeldung
    requireVirusScan: true,  // Uploads ablehnen, wenn kein Virenscanner eingerichtet ist
    virusScanFailOpen: false, // Uploads annehmen, wenn der Scanner vorübergehend nicht erreichbar ist
  },
  legal: {
    imprint: '',             // Impressum (einfaches Markdown)
    privacy: '',             // Datenschutzerklärung (einfaches Markdown)
    imprintUpdatedAt: '',
    privacyUpdatedAt: '',
  },
  collab: {
    mentionEmails: true,     // E-Mail bei Erwähnungen, Antworten und zugewiesenen Kommentaren (je Person abschaltbar)
    guestLinks: false,       // Gastzugang per Link ohne Konto (muss bewusst eingeschaltet werden)
    guestMaxDays: 30,        // längste Gültigkeit eines Gastlinks
    teamCreation: 'all',     // all | admins – wer Teams anlegen darf
    recordings: true,        // geführte Aufzeichnungen erlauben
    recordingMaxMinutes: 10, // längste Aufzeichnung
    files: true,             // Dateianhänge (PDF, Office, Text) auf Boards erlauben
    fileMaxMb: 20,           // größte Datei
    trashDays: 30,           // so lange bleiben gelöschte Boards im Papierkorb
    webhooks: false,         // Chat-Anbindung per Webhook (Server ruft fremde Adressen auf – bewusst einschalten)
    webhookPrivate: false,   // Webhooks an interne Adressen (Intranet, localhost) zulassen
  },
  logging: {
    level: '',               // leer = Vorgabe aus LOG_LEVEL; sonst trace | debug | info | warn | error | fatal | silent
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
    if (patch[k] === undefined || k.endsWith('UpdatedAt')) continue;
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
  if (section === 'security') {
    next.passwordMinLength = Math.max(8, Math.min(64, Math.round(next.passwordMinLength)));
    for (const k of ['blockedDomains', 'allowedDomains']) {
      next[k] = next[k].split(/[\s,;]+/).map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)).join('\n');
    }
  }
  if (section === 'legal') {
    const now = new Date().toISOString();
    for (const k of ['imprint', 'privacy']) {
      if (next[k].length > 100000) throw new Error('Der Text ist zu lang (höchstens 100.000 Zeichen).');
      if (patch[k] !== undefined && next[k] !== cur[k]) next[k + 'UpdatedAt'] = now;
    }
  }
  if (section === 'collab') {
    if (!['all', 'admins'].includes(next.teamCreation)) next.teamCreation = 'all';
    next.guestMaxDays = Math.max(1, Math.min(365, Math.round(next.guestMaxDays)));
    next.recordingMaxMinutes = Math.max(1, Math.min(30, Math.round(next.recordingMaxMinutes)));
    next.fileMaxMb = Math.max(1, Math.min(100, Math.round(next.fileMaxMb)));
    next.trashDays = Math.max(1, Math.min(365, Math.round(next.trashDays)));
  }
  if (section === 'logging') {
    next.level = next.level.toLowerCase();
    if (next.level && !['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'].includes(next.level)) throw new Error('Unbekannte Protokollstufe.');
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
  return { general: s.general, security: s.security, collab: s.collab, legal: s.legal, logging: s.logging, smtp: { ...s.smtp, pass: '', hasPassword: !!s.smtp.pass } };
}

async function mailConfigured() {
  const s = await get();
  return !!(s.smtp.host && s.smtp.from);
}

module.exports = { DEFAULTS, get, update, forAdmin, mailConfigured };
