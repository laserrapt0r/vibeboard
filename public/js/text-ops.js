/*
 * Gemeinsames Tippen: Textänderungen als einzelne Schritte, die sich gegeneinander umrechnen lassen.
 * Gemeinsam für Browser und Server, damit beide identisch rechnen. Im Browser als klassisches Skript geladen
 * (globalThis.TextOps), auf dem Server per require().
 *
 * Schritt:  { p, i: 'Text' } fügt an Stelle p ein, { p, d: Anzahl } löscht ab Stelle p.
 * Liste:    Schritte nacheinander; jeder bezieht sich auf das Ergebnis des vorigen.
 * Stellen zählen UTF-16-Einheiten wie JavaScript-Zeichenketten; diff() trennt keine Ersatzpaare.
 * Der Server legt die Reihenfolge fest: An derselben Stelle steht sein Text vor dem noch offenen eigenen.
 */
(function (root) {
  'use strict';

  const MAX_STEPS = 500;
  const high = (c) => c >= 0xd800 && c <= 0xdbff;
  const low = (c) => c >= 0xdc00 && c <= 0xdfff;

  function apply(text, ops) {
    let out = String(text ?? '');
    for (const o of ops) {
      const p = Math.max(0, Math.min(out.length, o.p));
      if (o.i !== undefined) out = out.slice(0, p) + o.i + out.slice(p);
      else out = out.slice(0, p) + out.slice(p + o.d);
    }
    return out;
  }

  /** Schritte von a nach b. caret: Cursor in b; legt bei gleichen Nachbarzeichen fest, wo getippt wurde. */
  function diff(a, b, caret = null) {
    a = String(a ?? '');
    b = String(b ?? '');
    if (a === b) return [];
    const room = Math.min(a.length, b.length);
    let start = 0;
    // Hinter dem Cursor endet die Eingabe: Bis zu ihrem Anfang kann der Text nur unverändert sein
    const lead = caret === null ? room : Math.max(0, Math.min(room, caret - Math.max(0, b.length - a.length)));
    while (start < lead && a.charCodeAt(start) === b.charCodeAt(start)) start++;
    if (start > 0 && high(a.charCodeAt(start - 1))) start--;
    let tail = 0;
    const most = room - start;
    while (tail < most && a.charCodeAt(a.length - 1 - tail) === b.charCodeAt(b.length - 1 - tail)) tail++;
    if (tail > 0 && low(a.charCodeAt(a.length - tail))) tail--;
    const del = a.length - start - tail, ins = b.slice(start, b.length - tail);
    const ops = [];
    if (del) ops.push({ p: start, d: del });
    if (ins) ops.push({ p: start, i: ins });
    return ops;
  }

  // Ein Schritt a, wenn zuvor b ausgeführt wurde. after: a steht bei gleicher Stelle hinter b.
  function step(a, b, after) {
    const ins = a.i !== undefined;
    if (b.i !== undefined) {
      const n = b.i.length;
      if (ins) return a.p < b.p || (a.p === b.p && !after) ? [a] : [{ p: a.p + n, i: a.i }];
      if (b.p <= a.p) return [{ p: a.p + n, d: a.d }];
      if (b.p >= a.p + a.d) return [a];
      // Fremder Text mitten im gelöschten Bereich bleibt stehen: Es wird davor und dahinter gelöscht
      const first = b.p - a.p;
      return [{ p: a.p, d: first }, { p: a.p + n, d: a.d - first }];
    }
    const end = b.p + b.d;
    if (ins) {
      if (a.p <= b.p) return [a];
      return [{ p: a.p >= end ? a.p - b.d : b.p, i: a.i }];
    }
    const aEnd = a.p + a.d;
    if (aEnd <= b.p) return [a];
    if (a.p >= end) return [{ p: a.p - b.d, d: a.d }];
    const left = Math.max(0, b.p - a.p), right = Math.max(0, aEnd - end);
    return left + right ? [{ p: Math.min(a.p, b.p), d: left + right }] : [];
  }

  /** Zwei gleichzeitige Listen: liefert [A nach B, B nach A]. A steht bei gleicher Stelle hinter B. */
  function transform(A, B) {
    if (!A.length || !B.length) return [A, B];
    if (A.length === 1 && B.length === 1) return [step(A[0], B[0], true), step(B[0], A[0], false)];
    if (A.length > 1) {
      const [a1, b1] = transform(A.slice(0, 1), B);
      const [a2, b2] = transform(A.slice(1), b1);
      return [[...a1, ...a2], b2];
    }
    const [a1, b1] = transform(A, B.slice(0, 1));
    const [a2, b2] = transform(a1, B.slice(1));
    return [a2, [...b1, ...b2]];
  }

  /** Cursor über Schritte verschieben. Text direkt am Cursor schiebt ihn nicht: Die eigene Eingabe geht dort weiter. */
  function mapPos(pos, ops) {
    let p = pos;
    for (const o of ops) {
      if (o.i !== undefined) {
        if (o.p < p) p += o.i.length;
      } else if (o.p < p) p -= Math.min(o.d, p - o.p);
    }
    return p;
  }

  /** Dreiwege: Was von base nach mine geändert wurde, auf theirs übertragen. */
  function merge3(base, mine, theirs) {
    if (mine === base) return theirs;
    if (theirs === base || theirs === mine) return mine;
    const [own] = transform(diff(base, mine), diff(base, theirs));
    return apply(theirs, own);
  }

  /** Aufeinanderfolgendes Tippen und Löschen zu einem Schritt zusammenfassen. */
  function compact(ops) {
    const out = [];
    for (const o of ops) {
      const last = out[out.length - 1];
      if (last && last.i !== undefined && o.i !== undefined && o.p === last.p + last.i.length) last.i += o.i;
      else if (last && last.d !== undefined && o.d !== undefined && o.p === last.p) last.d += o.d;
      else if (last && last.d !== undefined && o.d !== undefined && o.p + o.d === last.p) out[out.length - 1] = { p: o.p, d: o.d + last.d };
      else out.push({ ...o });
    }
    return out;
  }

  const valid = (ops) => Array.isArray(ops) && ops.length <= MAX_STEPS && ops.every((o) => o && Number.isInteger(o.p) && o.p >= 0
    && (typeof o.i === 'string' ? o.d === undefined : Number.isInteger(o.d) && o.d > 0));

  const api = { apply, diff, transform, mapPos, merge3, compact, valid, MAX_STEPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TextOps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
