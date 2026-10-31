'use strict';
// E-Mail-Adressen prüfen: Format, Wegwerf-Domains, eigene Sperr-/Erlaubnislisten
const fs = require('fs');
const path = require('path');
const { HttpError } = require('./http');

const DISPOSABLE = new Set(
  fs.readFileSync(path.join(__dirname, 'data', 'disposable-domains.txt'), 'utf8')
    .split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#')),
);

const parseList = (txt) => String(txt || '').split(/[\s,;]+/).map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);

// Trifft die Domain oder eine übergeordnete Domain zu? (sub.mailinator.com → mailinator.com)
function matches(domain, set) {
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) if (set.has(parts.slice(i).join('.'))) return true;
  return false;
}

function normalizeEmail(e) {
  return String(e || '').normalize('NFKC').trim().toLowerCase();
}

// Liefert die normalisierte Adresse oder wirft einen Fehler
function checkEmail(raw, general) {
  const e = normalizeEmail(raw);
  if (!e) throw new HttpError(400, 'Bitte eine E-Mail-Adresse angeben.');
  if (e.length > 254 || !/^[^\s@<>()[\]\\,;:"]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(e)) throw new HttpError(400, 'Die E-Mail-Adresse ist ungültig.');
  const domain = e.split('@')[1];
  const allowed = new Set(parseList(general.allowedDomains));
  if (allowed.size) {
    if (!matches(domain, allowed)) throw new HttpError(400, 'E-Mail-Adressen dieser Domain sind nicht zugelassen.');
    return e;
  }
  if (matches(domain, new Set(parseList(general.blockedDomains)))) throw new HttpError(400, 'E-Mail-Adressen dieser Domain sind nicht zugelassen.');
  if (general.blockDisposable !== false && matches(domain, DISPOSABLE)) {
    throw new HttpError(400, 'Wegwerf-E-Mail-Adressen sind nicht erlaubt. Bitte verwende eine dauerhafte Adresse.');
  }
  return e;
}

// Grobe Form einer Adresse, ohne regulären Ausdruck: Lange Eingaben dürfen den Server nicht aufhalten
function looksLikeEmail(s) {
  if (typeof s !== 'string' || s.length > 254 || /\s/.test(s)) return false;
  const at = s.indexOf('@');
  return at > 0 && at === s.lastIndexOf('@') && s.slice(at + 2, -1).includes('.');
}

module.exports = { looksLikeEmail, checkEmail, normalizeEmail, isDisposable: (d) => matches(String(d).toLowerCase(), DISPOSABLE), DISPOSABLE_COUNT: DISPOSABLE.size };
