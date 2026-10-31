'use strict';
// Einmalanmeldung per Kerberos (SPNEGO, HTTP „Negotiate“). Der Schlüssel des Dienstes liegt in der Keytab-Datei (KRB5_KTNAME).
const fs = require('fs');
const log = require('./log').child('kerberos');

function library() {
  try {
    return require('kerberos');
  } catch (e) {
    log.warn('Kerberos-Bibliothek nicht verfügbar', { err: e });
    return null;
  }
}

const keytabPath = () => String(process.env.KRB5_KTNAME || '/etc/krb5.keytab').replace(/^FILE:/, '');

// Dienstname in der Form HTTP@board.example.org
function serviceName(cfg, baseUrl) {
  const spn = cfg.servicePrincipal.replace(/^HTTP\//i, 'HTTP@').split('@').slice(0, 2).join('@');
  return spn.includes('@') ? spn : `HTTP@${new URL(baseUrl).hostname}`;
}

// Liefert den geprüften Prinzipal (person@REALM) und die Antwort für den Browser
async function accept(cfg, baseUrl, token) {
  const lib = library();
  if (!lib) throw new Error('Kerberos-Bibliothek nicht verfügbar');
  const ctx = await lib.initializeServer(serviceName(cfg, baseUrl));
  await ctx.step(token);
  if (!ctx.contextComplete || !ctx.username) throw new Error('Kerberos-Anmeldung unvollständig');
  return { principal: ctx.username, response: ctx.response || '' };
}

// Nur Personen des eingetragenen Bereichs; liefert den Kurznamen oder null
function shortName(cfg, principal) {
  const at = principal.lastIndexOf('@');
  if (at < 1 || principal.slice(at + 1) !== cfg.realm || principal.includes('/')) return null;
  return principal.slice(0, at);
}

async function test(cfg, baseUrl) {
  const steps = [];
  steps.push({ ok: !!library(), text: 'Kerberos-Bibliothek' });
  let keytab = false;
  try {
    fs.accessSync(keytabPath(), fs.constants.R_OK);
    keytab = true;
  } catch {
    /* unten gemeldet */
  }
  steps.push({ ok: keytab, text: 'Keytab-Datei lesbar', details: { path: keytabPath() } });
  steps.push({ ok: true, text: 'Dienstname', details: { service: serviceName(cfg, baseUrl) } });
  return steps;
}

module.exports = { accept, shortName, test };
