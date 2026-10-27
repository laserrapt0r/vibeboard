'use strict';
const log = require('./log').child('uploads');
// Prüfung hochgeladener Dateien (Bilder in Boards, Importe, Vorschaubilder): Dateityp + Virenscan
const crypto = require('crypto');
const settings = require('./settings');
const scanner = require('./virusscan');
const audit = require('./audit');

const verified = new Map(); // Hash der Data-URL -> geprüft und sauber
const MAX = 5000;

function remember(key) {
  verified.set(key, true);
  if (verified.size > MAX) verified.delete(verified.keys().next().value);
}

// Jedes Prüfergebnis wird protokolliert (ohne Dateiinhalt): Ergebnis, Art, Größe, Kurz-Hash, Dauer, Benutzer.
// Stufen: sauber = info, aus Zwischenspeicher = debug, ungeprüft angenommen bzw. abgelehnt = warn, Ausfall = error.
// Funde, abgelehnte Dateitypen und ungeprüft angenommene Dateien stehen zusätzlich im Sicherheitsprotokoll.
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// Liefert null, wenn die Datei angenommen werden darf, sonst eine verständliche Begründung
// lenient: nur bei nachgewiesener Schadsoftware ablehnen (z. B. Import beim Start, wenn der Scanner noch hochfährt)
async function checkDataUrl(src, { req = null, userId = null, kind = 'Bild', lenient = false } = {}) {
  const key = crypto.createHash('sha256').update(String(src)).digest('hex');
  if (verified.has(key)) {
    log.debug('Virenscan: bereits geprüft', { result: 'cached', kind, userId, hash: key.slice(0, 16) });
    return null;
  }
  const decoded = scanner.decodeImageDataUrl(src);
  if (decoded.error) {
    log.warn('Upload abgelehnt: Dateityp', { result: 'type_rejected', kind, userId, reason: decoded.error });
    audit.log(req, 'upload_blocked', { userId, details: { kind, reason: decoded.error } });
    return decoded.error;
  }
  const r = await scan(decoded.buf, { req, userId, kind, lenient });
  if (r.verified) remember(key);
  return r.reason;
}

// Virenscan für beliebige Dateiinhalte (z. B. Tonspuren von Aufzeichnungen); null = darf angenommen werden
async function checkBuffer(buf, ctx = {}) {
  return (await scan(buf, { kind: 'Datei', ...ctx })).reason;
}

// verified: geprüft und sauber (bzw. Prüfung bewusst abgeschaltet) – darf gemerkt werden
async function scan(buf, { req = null, userId = null, kind = 'Datei', lenient = false } = {}) {
  const sec = (await settings.get()).security;
  const base = { kind, bytes: buf.length, hash: sha(buf).slice(0, 16), userId };
  if (!scanner.configured()) {
    if (sec.requireVirusScan && !lenient) {
      log.warn('Upload abgelehnt: kein Virenscanner eingerichtet', { ...base, result: 'no_scanner' });
      return { reason: 'Uploads sind gesperrt, weil kein Virenscanner eingerichtet ist. Bitte wende dich an einen Administrator.' };
    }
    log.warn('Upload ungeprüft angenommen: kein Virenscanner eingerichtet', { ...base, result: 'unscanned' });
    return { reason: null, verified: true };
  }
  let result;
  const started = Date.now();
  try {
    result = await scanner.scanBuffer(buf);
  } catch (e) {
    const ms = Date.now() - started;
    if (sec.virusScanFailOpen || lenient) {
      log.error('Virenscan fehlgeschlagen – Upload ungeprüft angenommen', { ...base, ms, result: 'error_accepted', err: e });
      audit.log(req, 'upload_unscanned', { userId, details: { kind, bytes: buf.length, hash: base.hash, error: e.message } });
      return { reason: null, verified: false }; // bewusst vom Admin erlaubt; nicht merken, damit später erneut geprüft wird
    }
    log.error('Virenscan fehlgeschlagen – Upload abgelehnt', { ...base, ms, result: 'error', err: e });
    return { reason: 'Der Virenscanner ist gerade nicht erreichbar. Bitte versuche es in einigen Minuten erneut.' };
  }
  const ms = Date.now() - started;
  if (!result.clean) {
    log.warn('Upload abgelehnt: Schadsoftware gefunden', { ...base, ms, result: 'infected', virus: result.virus });
    audit.log(req, 'upload_blocked', { userId, details: { virus: result.virus, kind, bytes: buf.length, hash: base.hash } });
    return { reason: `Die Datei enthält Schadsoftware (${result.virus}) und wurde abgelehnt.` };
  }
  log[result.cached ? 'debug' : 'info']('Virenscan: sauber', { ...base, ms, result: result.cached ? 'cached' : 'clean' });
  return { reason: null, verified: true };
}

// Prüft alle Bilder in einer Liste von Elementen; liefert die abgelehnten mit Begründung
async function checkElements(elements, ctx) {
  const rejected = [];
  for (const el of elements) {
    if (!el || el.type !== 'image' || typeof el.src !== 'string' || !el.src) continue;
    const reason = await checkDataUrl(el.src, ctx);
    if (reason) rejected.push({ id: el.id, reason });
  }
  return rejected;
}

module.exports = { checkDataUrl, checkBuffer, checkElements };
