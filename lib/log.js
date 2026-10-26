'use strict';
/*
 * Protokollierung mit Stufen (fatal, error, warn, info, debug, trace).
 *
 * - Stufe über LOG_LEVEL (Standard: info) oder zur Laufzeit in der Administration.
 * - Ausgabe als lesbarer Text (LOG_FORMAT=text, Standard) oder als JSON-Zeile je Eintrag (LOG_FORMAT=json) für
 *   Log-Sammelsysteme. Fehler und Warnungen gehen nach stderr, alles andere nach stdout.
 * - Jeder Eintrag trägt Zeitpunkt (ISO 8601, UTC), Stufe, Komponente und – innerhalb einer HTTP-Anfrage – deren
 *   Request-ID. Zusatzangaben werden als Felder übergeben, nicht in den Text eingebaut.
 * - Geheimnisse (Kennwörter, Tokens, Cookies, Schlüssel) werden geschwärzt. Personenbezogene Daten wie
 *   IP-Adressen oder E-Mail-Adressen gehören nicht ins Protokoll; das Sicherheitsprotokoll (audit_log) ist dafür da.
 */
const { AsyncLocalStorage } = require('async_hooks');

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60, silent: 100 };
const SECRET_KEY = /pass(word)?|secret|token|authorization|cookie|session|totp|recovery|apikey|api_key|private/i;
const MAX_STRING = 2000;

const context = new AsyncLocalStorage();
const envLevel = normalizeLevel(process.env.LOG_LEVEL) || 'info';
let level = envLevel;
let threshold = LEVELS[level];
const format = String(process.env.LOG_FORMAT || 'text').toLowerCase() === 'json' ? 'json' : 'text';

function normalizeLevel(v) {
  const l = String(v || '').trim().toLowerCase();
  return Object.hasOwn(LEVELS, l) ? l : null;
}

// Zur Laufzeit ändern (Administration); leer = Vorgabe aus LOG_LEVEL
function setLevel(v) {
  level = normalizeLevel(v) || envLevel;
  threshold = LEVELS[level];
  return level;
}

const getLevel = () => level;
const isEnabled = (l) => LEVELS[l] >= threshold;

function serializeError(e, withStack) {
  const out = { name: e.name || 'Error', message: e.message };
  if (e.code) out.code = e.code;
  if (e.status) out.status = e.status;
  if (withStack && e.stack) out.stack = e.stack;
  if (e.cause instanceof Error) out.cause = serializeError(e.cause, withStack);
  return out;
}

// Felder bereinigen: Geheimnisse schwärzen, Fehler aufbereiten, lange Texte kürzen, Zyklen vermeiden
function clean(value, withStack, depth = 0, seen = new WeakSet()) {
  if (value instanceof Error) return serializeError(value, withStack);
  if (typeof value === 'string') return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + '…' : value;
  if (typeof value === 'bigint') return String(value);
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value) || depth > 5) return '[…]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => clean(v, withStack, depth + 1, seen));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEY.test(k) ? '[geschwärzt]' : clean(v, withStack, depth + 1, seen);
  return out;
}

function textValue(v) {
  if (v && typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return /[\s="]/.test(s) ? JSON.stringify(s) : s;
}

function write(lvl, component, msg, fields) {
  if (LEVELS[lvl] < threshold) return;
  const withStack = LEVELS[lvl] >= LEVELS.error || threshold <= LEVELS.debug;
  // Ein Fehler kann direkt als „fields“ übergeben werden
  if (fields instanceof Error) fields = { err: fields };
  const ctx = context.getStore();
  const data = clean({ ...(ctx || {}), ...(fields || {}) }, withStack);
  const time = new Date().toISOString();
  let line;
  if (format === 'json') {
    line = JSON.stringify({ time, level: lvl, component, msg, ...data });
  } else {
    const { err, ...rest } = data;
    const kv = Object.entries(rest).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${textValue(v)}`).join(' ');
    line = `${time} ${lvl.toUpperCase().padEnd(5)} [${component}] ${msg}${kv ? ' ' + kv : ''}`;
    if (err) line += ` – ${err.name}: ${err.message}${err.code ? ` (${err.code})` : ''}${err.stack ? '\n' + err.stack.split('\n').slice(1).join('\n') : ''}`;
  }
  (LEVELS[lvl] >= LEVELS.warn ? process.stderr : process.stdout).write(line + '\n');
}

// Logger für eine Komponente: log.child('boards').info('Text', { feld: wert })
function logger(component) {
  const l = {};
  for (const name of ['trace', 'debug', 'info', 'warn', 'error', 'fatal']) l[name] = (msg, fields) => write(name, component, msg, fields);
  l.child = (sub) => logger(`${component}:${sub}`);
  l.isEnabled = isEnabled;
  return l;
}

// Kontext (z. B. Request-ID) für alle Einträge innerhalb eines Ablaufs
const withContext = (ctx, fn) => context.run({ ...(context.getStore() || {}), ...ctx }, fn);
const addContext = (ctx) => {
  const s = context.getStore();
  if (s) Object.assign(s, ctx);
};

module.exports = { ...logger('app'), child: logger, setLevel, getLevel, isEnabled, withContext, addContext, LEVELS: Object.keys(LEVELS), format, envLevel };
