'use strict';
/*
 * Findet Aufrufe wie box.append(a, cond ? b : null): Die DOM-Befehle schreiben null und undefined wörtlich als Text hinein.
 * h() und append() aus util.js filtern das, die eingebauten Befehle nicht.
 * Aufruf: npm run check:dom
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const DIR = path.join(__dirname, '..', 'public', 'js');
const INSERT = new Set(['append', 'prepend', 'replaceChildren', 'before', 'after', 'replaceWith']);

const maybeEmpty = (n) => {
  if (!n) return false;
  if (n.type === 'Literal') return n.value === null;
  if (n.type === 'Identifier') return n.name === 'undefined';
  if (n.type === 'ConditionalExpression') return maybeEmpty(n.consequent) || maybeEmpty(n.alternate);
  if (n.type === 'LogicalExpression') return n.operator === '&&' || maybeEmpty(n.right); // a && b liefert auch false/null
  return false;
};

let bad = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  walk.simple(ast, {
    CallExpression(n) {
      if (n.callee.type !== 'MemberExpression' || n.callee.computed || !INSERT.has(n.callee.property.name)) return;
      // new URLSearchParams().append und ähnliches haben zwei feste Argumente aus Text, das trifft hier nicht zu
      if (n.arguments.some(maybeEmpty)) {
        console.error(`${f}:${n.loc.start.line}: ${n.callee.property.name}() mit möglichem null`);
        bad++;
      }
    },
  });
}
if (bad) process.exit(1);
console.log('DOM-Prüfung: kein null in Einfügebefehlen');
