'use strict';
// Mehrsprachigkeit auf dem Server: Fehlermeldungen und E-Mails. Quellsprache ist Deutsch; die Wörterbücher teilt sich
// der Server mit dem Browser (public/i18n/*.json). Übersetzt wird beim Ausgeben (Antwort, E-Mail), deshalb bleiben die
// Meldungen im Code deutsch. Texte mit Werten werden über Muster gefunden: „Hallo {0},“ passt auf „Hallo Clara,“.
const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const LANGS = ['en', 'de', 'es', 'fr'];
// Satzbausteine, die der Code in Meldungen einsetzt
const FRAGMENTS = new Set(['das Team', 'den Ordner', 'darf bearbeiten', 'darf kommentieren', 'darf ansehen']);
const dicts = {};
const patterns = {};
const context = new AsyncLocalStorage();

function load(lang) {
  if (dicts[lang]) return dicts[lang];
  try {
    dicts[lang] = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'i18n', lang + '.json'), 'utf8'));
  } catch {
    dicts[lang] = {};
  }
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  patterns[lang] = Object.keys(dicts[lang]).filter((k) => /\{\d+\}/.test(k) && k.replace(/\{\d+\}/g, '').trim().length > 3)
    .sort((a, b) => b.length - a.length)
    .map((k) => {
      const order = [...k.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
      return { key: k, order, re: new RegExp('^' + k.split(/\{\d+\}/).map(esc).join('([\\s\\S]*?)') + '$') };
    });
  return dicts[lang];
}

// Accept-Language auswerten; ohne unterstützte Sprache gilt Englisch
function negotiate(header) {
  const list = String(header || '').split(',').map((p) => {
    const [tag, q] = p.trim().split(';q=');
    return { tag: tag.toLowerCase().split('-')[0], q: q === undefined ? 1 : Number(q) || 0 };
  }).sort((a, b) => b.q - a.q);
  const hit = list.find((l) => LANGS.includes(l.tag));
  return hit ? hit.tag : 'en';
}

const current = () => context.getStore() || 'en';
const run = (lang, fn) => context.run(LANGS.includes(lang) ? lang : current(), fn);

function tr(text, lang = current()) {
  const s = String(text ?? '');
  if (lang === 'de' || !s) return s;
  const d = load(lang);
  if (d[s] !== undefined) return d[s];
  for (const p of patterns[lang]) {
    const m = p.re.exec(s);
    if (!m) continue;
    const values = {};
    // Werte sind fast immer Benutzertexte (Board-, Team-Namen) und bleiben unverändert – außer Bausteinen aus dem Code
    p.order.forEach((n, i) => (values[n] = FRAGMENTS.has(m[i + 1]) ? d[m[i + 1]] ?? m[i + 1] : m[i + 1]));
    return d[p.key].replace(/\{(\d+)\}/g, (a, n) => values[n] ?? '');
  }
  return s;
}

module.exports = { LANGS, negotiate, current, run, tr };
