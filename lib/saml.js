'use strict';
// Anmeldung über SAML 2.0. Prüfung von Signatur, Gültigkeit und Empfänger übernimmt node-saml.
const crypto = require('crypto');
const { SAML, generateServiceProviderMetadata } = require('@node-saml/node-saml');

const first = (v) => (Array.isArray(v) ? v[0] : v);

function options(cfg, baseUrl) {
  return {
    entryPoint: cfg.entryPoint,
    issuer: cfg.issuer || baseUrl,
    callbackUrl: `${baseUrl}/api/auth/saml/acs`,
    idpCert: cfg.idpCert,
    audience: cfg.issuer || baseUrl,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    validateInResponseTo: 'always',
    requestIdExpirationPeriodMs: 10 * 60000,
    acceptedClockSkewMs: 60000,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    identifierFormat: null,
    disableRequestedAuthnContext: true,
  };
}

// Eine Instanz je Einstellung: Sie merkt sich die offenen Anfragen (InResponseTo)
let current = null;
function client(cfg, baseUrl) {
  const key = JSON.stringify([cfg.entryPoint, cfg.issuer, cfg.idpCert, baseUrl]);
  if (!current || current.key !== key) current = { key, saml: new SAML(options(cfg, baseUrl)) };
  return current.saml;
}

function start(cfg, baseUrl, relayState) {
  return client(cfg, baseUrl).getAuthorizeUrlAsync(relayState, undefined, {});
}

async function finish(cfg, baseUrl, body) {
  const { profile } = await client(cfg, baseUrl).validatePostResponseAsync({ SAMLResponse: body.SAMLResponse, RelayState: body.RelayState });
  if (!profile || !profile.nameID) throw new Error('Antwort ohne Kennung');
  const email = String(first(profile[cfg.attrEmail]) || profile.email || profile.mail || (String(profile.nameID).includes('@') ? profile.nameID : '')).trim();
  const groups = [].concat(profile[cfg.attrGroups] || []).map((g) => String(g).replace(/^\//, ''));
  const has = (g) => groups.includes(g.replace(/^\//, ''));
  return {
    provider: 'saml', externalId: String(profile.nameID), email, emailVerified: true,
    name: String(first(profile[cfg.attrName]) || '').trim(),
    allowed: !cfg.requiredGroup || has(cfg.requiredGroup),
    isAdmin: cfg.adminGroup ? has(cfg.adminGroup) : undefined,
  };
}

function metadata(cfg, baseUrl) {
  const o = options(cfg, baseUrl);
  return generateServiceProviderMetadata({ issuer: o.issuer, callbackUrl: o.callbackUrl, wantAssertionsSigned: true, identifierFormat: null });
}

async function test(cfg, baseUrl) {
  new crypto.X509Certificate(cfg.idpCert); // wirft bei unlesbarem Zertifikat
  const url = await start(cfg, baseUrl, 'test');
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
  return [
    { ok: true, text: 'Zertifikat lesbar' },
    { ok: res.status < 500, text: 'Dienst erreichbar', details: { status: res.status } },
    { ok: true, text: 'Dienstkennung', details: { entityId: cfg.issuer || baseUrl, acs: `${baseUrl}/api/auth/saml/acs`, metadata: `${baseUrl}/api/auth/saml/metadata` } },
  ];
}

module.exports = { start, finish, metadata, test };
