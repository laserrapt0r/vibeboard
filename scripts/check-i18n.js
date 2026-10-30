'use strict';
/*
 * Prüft die Wörterbücher (public/i18n/*.json) gegen den Code:
 *   – jeder mit T markierte Text der Oberfläche hat in jeder Sprache eine Übersetzung
 *   – Platzhalter {0}, {1} … stimmen überein
 * Fehlende Server-Meldungen lassen sich so nicht erkennen: Sie stehen unmarkiert im Code und werden beim Ausgeben
 * übersetzt (lib/i18n.js) – neue Meldungen also bitte von Hand in die Wörterbücher aufnehmen.
 *
 * Aufruf: npm run check:i18n
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'public', 'js');
const keys = new Set();
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
  const ast = acorn.parse(fs.readFileSync(path.join(DIR, f), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true });
  walk.simple(ast, {
    CallExpression(n) {
      if (n.callee.name === 'T' && n.arguments[0] && n.arguments[0].type === 'Literal') keys.add(n.arguments[0].value);
    },
    TaggedTemplateExpression(n) {
      if (n.tag.name === 'T') keys.add(n.quasi.quasis.reduce((a, q, i) => a + q.value.cooked + (i < n.quasi.quasis.length - 1 ? `{${i}}` : ''), ''));
    },
  });
}

const slots = (s) => [...new Set(String(s).match(/\{\d+\}/g) || [])].sort().join();
let bad = 0;
for (const lang of ['en', 'es', 'fr']) {
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'i18n', lang + '.json'), 'utf8'));
  const missing = [...keys].filter((k) => dict[k] === undefined);
  const wrong = Object.entries(dict).filter(([k, v]) => slots(k) !== slots(v));
  for (const k of missing.slice(0, 20)) console.error(`${lang}: fehlt: ${k}`);
  for (const [k] of wrong.slice(0, 20)) console.error(`${lang}: Platzhalter passen nicht: ${k}`);
  console.log(`${lang}: ${Object.keys(dict).length} Einträge, ${missing.length} fehlen, ${wrong.length} mit falschen Platzhaltern`);
  bad += missing.length + wrong.length;
}
process.exit(bad ? 1 : 0);
