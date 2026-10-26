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

// Liefert null, wenn die Datei angenommen werden darf, sonst eine verständliche Begründung
// lenient: nur bei nachgewiesener Schadsoftware ablehnen (z. B. Import beim Start, wenn der Scanner noch hochfährt)
async function checkDataUrl(src, { req = null, userId = null, kind = 'Bild', lenient = false } = {}) {
  const key = crypto.createHash('sha256').update(String(src)).digest('hex');
  if (verified.has(key)) return null;
  const decoded = scanner.decodeImageDataUrl(src);
  if (decoded.error) return decoded.error;
  const sec = (await settings.get()).security;
  if (!scanner.configured()) {
    if (sec.requireVirusScan && !lenient) return 'Uploads sind gesperrt, weil kein Virenscanner eingerichtet ist. Bitte wende dich an einen Administrator.';
    remember(key);
    return null;
  }
  let result;
  try {
    result = await scanner.scanBuffer(decoded.buf);
  } catch (e) {
    log.error('Virenscan fehlgeschlagen', { kind, err: e });
    if (sec.virusScanFailOpen || lenient) {
      return null; // bewusst vom Admin erlaubt; nicht merken, damit später erneut geprüft wird
    }
    return 'Der Virenscanner ist gerade nicht erreichbar. Bitte versuche es in einigen Minuten erneut.';
  }
  if (!result.clean) {
    log.warn('Upload abgelehnt: Schadsoftware gefunden', { kind, virus: result.virus, userId });
    audit.log(req, 'upload_blocked', { userId, details: { virus: result.virus, kind, bytes: decoded.buf.length } });
    return `Die Datei enthält Schadsoftware (${result.virus}) und wurde abgelehnt.`;
  }
  remember(key);
  return null;
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

module.exports = { checkDataUrl, checkElements };
