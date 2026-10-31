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
  auth: {
    localLogin: 'all',       // all | admins – wer sich mit einem lokalen Kennwort anmelden darf (Notzugang für Admins bleibt immer)
    provision: 'active',     // active | pending | off – was bei der ersten externen Anmeldung geschieht
    sessionHours: 168,       // Gültigkeit extern angemeldeter Sitzungen
    autoSso: '',             // leer | oidc | kerberos – Anmeldeseite leitet direkt weiter
  },
  oidc: {
    enabled: false,
    label: 'Keycloak',
    issuer: '',              // z. B. https://sso.example.org/realms/firma
    clientId: '',
    clientSecret: '',
    scopes: 'openid email profile',
    requiredRole: '',        // nur Personen mit dieser Rolle oder Gruppe dürfen sich anmelden
    adminRole: '',           // Rolle oder Gruppe für Administrationsrechte
    trustUnverifiedEmail: false,
  },
  ldap: {
    enabled: false,
    url: '',                 // ldaps://dc.example.org:636
    startTls: false,
    rejectUnauthorized: true,
    caCert: '',              // eigene Zertifizierungsstelle (PEM)
    bindDn: '',              // Dienstkonto
    bindPassword: '',
    baseDn: '',              // z. B. DC=example,DC=org
    // Vorbelegt für Active Directory: Personen, keine deaktivierten Konten
    userFilter: '(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2))(|(sAMAccountName={login})(userPrincipalName={login})(mail={login})))',
    attrId: 'objectGUID',
    attrLogin: 'sAMAccountName',
    attrEmail: 'mail',
    attrName: 'displayName',
    attrGroups: 'memberOf',
    nestedGroups: false,     // verschachtelte Gruppen auflösen (nur Active Directory)
    requiredGroup: '',       // DN der Gruppe, die Zugang erhält
    adminGroup: '',          // DN der Gruppe für Administrationsrechte
  },
  kerberos: {
    enabled: false,
    label: 'Windows-Anmeldung',
    realm: '',               // z. B. EXAMPLE.ORG
    servicePrincipal: '',    // leer = HTTP/<Host der öffentlichen Adresse>
    emailDomain: '',         // ohne LDAP Pflicht: Adresse = Kurzname@Domain
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

const SECRETS = ['pass', 'bindPassword', 'clientSecret'];
const PLAIN_LDAP_OK = /^ldap:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/i;

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
    else next[k] = SECRETS.includes(k) ? String(patch[k]) : String(patch[k]).trim();
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
  if (section === 'auth') {
    if (!['all', 'admins'].includes(next.localLogin)) next.localLogin = 'all';
    if (!['active', 'pending', 'off'].includes(next.provision)) next.provision = 'active';
    if (!['', 'oidc', 'kerberos'].includes(next.autoSso)) next.autoSso = '';
    next.sessionHours = Math.max(1, Math.min(720, Math.round(next.sessionHours)));
  }
  if (section === 'oidc') {
    next.issuer = next.issuer.replace(/\/+$/, '');
    next.label = next.label.slice(0, 40) || DEFAULTS.oidc.label;
    next.scopes = next.scopes.split(/\s+/).includes('openid') ? next.scopes : `openid ${next.scopes}`.trim();
    if (next.enabled && (!/^https?:\/\/\S+$/i.test(next.issuer) || !next.clientId)) throw new Error('Für Keycloak sind Aussteller-Adresse und Client-ID nötig.');
  }
  if (section === 'ldap') {
    for (const k of ['attrId', 'attrLogin', 'attrEmail', 'attrName', 'attrGroups']) next[k] = next[k] || DEFAULTS.ldap[k];
    next.userFilter = next.userFilter || DEFAULTS.ldap.userFilter;
    if (next.enabled) {
      if (!/^ldaps?:\/\/\S+$/i.test(next.url) || !next.baseDn) throw new Error('Für LDAP sind Server-Adresse und Basis-DN nötig.');
      if (!next.userFilter.includes('{login}')) throw new Error('Der Suchfilter muss den Platzhalter {login} enthalten.');
      // Kennwörter nie unverschlüsselt über das Netz schicken
      if (/^ldap:/i.test(next.url) && !next.startTls && !PLAIN_LDAP_OK.test(next.url)) throw new Error('LDAP braucht eine verschlüsselte Verbindung: ldaps:// oder StartTLS.');
    }
  }
  if (section === 'kerberos') {
    next.realm = next.realm.toUpperCase();
    next.label = next.label.slice(0, 40) || DEFAULTS.kerberos.label;
    next.emailDomain = next.emailDomain.toLowerCase().replace(/^@/, '');
    if (next.enabled && !next.realm) throw new Error('Für Kerberos ist der Realm nötig.');
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
  return {
    general: s.general, security: s.security, collab: s.collab, legal: s.legal, logging: s.logging, auth: s.auth, kerberos: s.kerberos,
    smtp: { ...s.smtp, pass: '', hasPassword: !!s.smtp.pass },
    oidc: { ...s.oidc, clientSecret: '', hasSecret: !!s.oidc.clientSecret },
    ldap: { ...s.ldap, bindPassword: '', hasPassword: !!s.ldap.bindPassword },
  };
}

async function mailConfigured() {
  const s = await get();
  return !!(s.smtp.host && s.smtp.from);
}

async function ssoConfigured() {
  const s = await get();
  return s.oidc.enabled || s.ldap.enabled || s.kerberos.enabled;
}

module.exports = { DEFAULTS, get, update, forAdmin, mailConfigured, ssoConfigured };
