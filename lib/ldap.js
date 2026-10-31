'use strict';
// Anmeldung gegen LDAP / Active Directory (Suche mit Dienstkonto, danach Bind als gefundene Person)
const { Client, InvalidCredentialsError } = require('ldapts');
const auth = require('./auth');
const log = require('./log').child('ldap');

const TIMEOUT = 8000;
// LDAP_MATCHING_RULE_IN_CHAIN: Active Directory löst verschachtelte Gruppen selbst auf
const IN_CHAIN = '1.2.840.113556.1.4.1941';

// RFC 4515: Sonderzeichen in Filterwerten maskieren, sonst ließe sich der Filter über den Anmeldenamen verändern
function escapeFilter(v) {
  return String(v).replace(/[\\*()\0]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));
}

const tlsOptions = (cfg) => ({ rejectUnauthorized: cfg.rejectUnauthorized, ...(cfg.caCert ? { ca: [cfg.caCert] } : {}) });

async function connect(cfg) {
  const client = new Client({ url: cfg.url, timeout: TIMEOUT, connectTimeout: TIMEOUT, strictDN: false, tlsOptions: tlsOptions(cfg) });
  if (cfg.startTls) await client.startTLS(tlsOptions(cfg));
  return client;
}

const normDn = (dn) => String(dn).toLowerCase().replace(/\s*([,=])\s*/g, '$1').trim();
const first = (v) => (Array.isArray(v) ? v[0] : v);

function identityOf(cfg, entry, groups) {
  const raw = first(entry[cfg.attrId]);
  const externalId = Buffer.isBuffer(raw) ? raw.toString('hex') : String(raw || '') || normDn(entry.dn);
  const memberOf = new Set(groups.map(normDn));
  return {
    provider: 'ldap', externalId, dn: entry.dn,
    login: String(first(entry[cfg.attrLogin]) || ''),
    email: String(first(entry[cfg.attrEmail]) || '').trim(),
    emailVerified: true, // Das Verzeichnis wird von der Organisation gepflegt
    name: String(first(entry[cfg.attrName]) || first(entry[cfg.attrLogin]) || '').trim(),
    allowed: !cfg.requiredGroup || memberOf.has(normDn(cfg.requiredGroup)),
    isAdmin: cfg.adminGroup ? memberOf.has(normDn(cfg.adminGroup)) : undefined,
  };
}

async function find(cfg, client, login) {
  if (cfg.bindDn) await client.bind(cfg.bindDn, cfg.bindPassword);
  const binary = cfg.attrId.toLowerCase() === 'objectguid' ? [cfg.attrId] : [];
  let found;
  try {
    found = await client.search(cfg.baseDn, {
      scope: 'sub', sizeLimit: 2, filter: cfg.userFilter.replaceAll('{login}', () => escapeFilter(login)),
      attributes: [cfg.attrId, cfg.attrLogin, cfg.attrEmail, cfg.attrName, cfg.attrGroups], explicitBufferAttributes: binary,
    });
  } catch (e) {
    if (e.code === 4) return null; // mehr als ein Treffer: nie raten, wer gemeint ist
    throw e;
  }
  if (found.searchEntries.length !== 1) return null;
  const entry = found.searchEntries[0];
  let groups = [].concat(entry[cfg.attrGroups] || []).map(String);
  if (cfg.nestedGroups) {
    const nested = await client.search(cfg.baseDn, { scope: 'sub', filter: `(member:${IN_CHAIN}:=${escapeFilter(entry.dn)})`, attributes: ['dn'] });
    groups = [...groups, ...nested.searchEntries.map((g) => g.dn)];
  }
  return identityOf(cfg, entry, groups);
}

// Prüft Anmeldename und Kennwort. null = falsche Angaben oder nicht eindeutig.
async function authenticate(cfg, login, password) {
  // Ein Bind ohne Kennwort gilt in LDAP als „erfolgreich anonym“ (RFC 4513) und darf nie als Anmeldung zählen
  if (!login || !password) return null;
  const client = await connect(cfg);
  try {
    const id = await find(cfg, client, login);
    if (!id) return null;
    // Je Verzeichniseintrag begrenzen: Sonst könnten Name, UPN und Adresse zusammen eine Kontosperre im AD auslösen
    auth.rateLimit('ldap-bind:' + normDn(id.dn), 10, 15 * 60000);
    const check = await connect(cfg);
    try {
      await check.bind(id.dn, password);
    } catch (e) {
      if (e instanceof InvalidCredentialsError) return null;
      throw e;
    } finally {
      await check.unbind().catch(() => {});
    }
    return id;
  } finally {
    await client.unbind().catch(() => {});
  }
}

// Für Kerberos: Eintrag zu einem bereits geprüften Anmeldenamen
async function lookup(cfg, login) {
  const client = await connect(cfg);
  try {
    return await find(cfg, client, login);
  } finally {
    await client.unbind().catch(() => {});
  }
}

// Verbindungstest für die Administration: zeigt, wie die Zuordnung für eine Beispielperson ausfällt
async function test(cfg, login) {
  const steps = [];
  const client = await connect(cfg);
  try {
    steps.push({ ok: true, text: 'Verbindung hergestellt' });
    if (cfg.bindDn) {
      await client.bind(cfg.bindDn, cfg.bindPassword);
      steps.push({ ok: true, text: 'Dienstkonto angemeldet' });
    }
    if (login) {
      const id = await find(cfg, client, login);
      if (!id) steps.push({ ok: false, text: 'Kein eindeutiger Eintrag gefunden' });
      else steps.push({ ok: !!id.email, text: 'Eintrag gefunden', details: { dn: id.dn, email: id.email, name: id.name, allowed: id.allowed, admin: id.isAdmin === undefined ? null : id.isAdmin } });
    }
  } finally {
    await client.unbind().catch((e) => log.debug('Trennen fehlgeschlagen', { err: e }));
  }
  return steps;
}

module.exports = { authenticate, lookup, test, escapeFilter };
