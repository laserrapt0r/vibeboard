/*
 * Formeln in Tabellen. Die Zelle speichert den Text („=SUMME(B2:B5)“), gerechnet wird nur beim Anzeigen: So brauchen Server,
 * Export und Abgleich kein eigenes Ergebnis zu kennen. Eigener kleiner Parser, kein eval: Inhalte stammen von anderen Personen.
 * Text, der mit „=“ beginnt, aber keine gültige Formel ist, bleibt Text. Bestehende Tabellen ändern sich dadurch nicht.
 * Im Browser als klassisches Skript geladen (globalThis.TableFormula), auf dem Server per require() (Bezüge bei Strukturänderungen).
 */
(function (root) {
  'use strict';

  const ERR = { div: '#DIV/0!', value: '#VALUE!', name: '#NAME?', ref: '#REF!', cycle: '#CYCLE!', num: '#NUM!' };
  class Failure {
    constructor(code) {
      this.code = code;
    }
  }
  const MAX_NESTING = 40;
  const MAX_CHAIN = 1500;
  const MAX_STEPS = 2000000; // Zellen je Berechnung: Eine Tabelle voller gegenseitiger Bezüge darf das Board nicht einfrieren
  const CACHE_MAX = 20000;

  const FUNCTIONS = {
    sum: ['SUMME', 'SUM', 'SUMA', 'SOMME'],
    average: ['MITTELWERT', 'AVERAGE', 'AVG', 'PROMEDIO', 'MOYENNE'],
    min: ['MIN'],
    max: ['MAX'],
    count: ['ANZAHL', 'COUNT', 'CONTAR', 'NB'],
    counta: ['ANZAHL2', 'COUNTA', 'CONTARA', 'NBVAL'],
    round: ['RUNDEN', 'ROUND', 'REDONDEAR', 'ARRONDI'],
    abs: ['ABS'],
    if: ['WENN', 'IF', 'SI'],
  };
  const LOCAL_FUNCTION = /(?<![A-Za-z0-9_.])(SUMME|MITTELWERT|ANZAHL2?|RUNDEN|WENN|SUMA|PROMEDIO|CONTARA?|REDONDEAR|SI|SOMME|MOYENNE|NB|NBVAL|ARRONDI)\s*\(/i;
  const ALIASES = new Map(Object.entries(FUNCTIONS).flatMap(([fn, names]) => names.map((n) => [n, fn])));

  const isFormula = (s) => typeof s === 'string' && s.length > 1 && s[0] === '=';

  function colName(c) {
    let out = '';
    for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
    return out;
  }
  const refName = (r, c) => colName(c) + (r + 1);

  function parseRef(text) {
    const m = /^(\$?)([A-Za-z]{1,2})(\$?)(\d{1,3})$/.exec(text);
    if (!m) return null;
    let c = 0;
    for (const ch of m[2].toUpperCase()) c = c * 26 + ch.charCodeAt(0) - 64;
    return { r: Number(m[4]) - 1, c: c - 1, absCol: m[1], absRow: m[3] };
  }

  /* ---------------- Zerlegen ---------------- */

  const TOKEN = new RegExp([
    '(\\s+)',
    '("(?:[^"]|"")*")',
    '(\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?|\\.\\d+)',
    '(#REF!)',
    '(\\$?[A-Za-z]{1,2}\\$?\\d{1,3})(?![A-Za-z0-9_.(])',
    '([A-Za-zÄÖÜäöüß_][A-Za-z0-9ÄÖÜäöüß_.]*)',
    '(<=|>=|<>|[-+*/^%()<>=:;,])',
  ].join('|'), 'y');

  function tokenize(src) {
    // Dezimalkomma: Mit „;“ als Trennzeichen oder Funktionen in Deutsch, Spanisch oder Französisch ist jedes Komma zwischen
    // Ziffern eines; sonst nur außerhalb von Klammern. Die Regel hängt bewusst an der Formel, nicht an der Sprache der
    // Oberfläche: Alle müssen dasselbe Ergebnis sehen.
    const code = src.replace(/"(?:[^"]|"")*"/g, '');
    const semi = code.includes(';') || LOCAL_FUNCTION.test(code);
    const out = [];
    let depth = 0;
    TOKEN.lastIndex = 0;
    while (TOKEN.lastIndex < src.length) {
      const m = TOKEN.exec(src);
      if (!m) return null;
      if (m[1]) continue;
      if (m[2]) out.push({ t: 'str', v: m[2].slice(1, -1).replace(/""/g, '"') });
      else if (m[3]) {
        let text = m[3];
        const more = (semi || depth === 0) && /^,(\d+)/.exec(src.slice(TOKEN.lastIndex));
        if (more && !/[.eE]/.test(text)) {
          text += '.' + more[1];
          TOKEN.lastIndex += more[0].length;
        }
        out.push({ t: 'num', v: Number(text) });
      } else if (m[4]) out.push({ t: 'err' });
      else if (m[5]) out.push({ t: 'ref', v: parseRef(m[5]) });
      else if (m[6]) out.push({ t: 'name', v: m[6].toUpperCase() });
      else {
        if (m[7] === '(') depth++;
        if (m[7] === ')') depth--;
        out.push({ t: 'op', v: m[7] });
      }
    }
    return out;
  }

  /* ---------------- Syntaxbaum ---------------- */

  function parseTokens(tokens) {
    let i = 0, depth = 0;
    const peek = (v) => tokens[i] && tokens[i].t === 'op' && tokens[i].v === v;
    const eat = (v) => (peek(v) ? (i++, true) : false);
    const nested = (fn) => {
      if (++depth > MAX_NESTING) throw new SyntaxError('tief');
      const r = fn();
      depth--;
      return r;
    };
    const binary = (next, ops) => () => {
      let left = next();
      for (;;) {
        const op = ops.find(peek);
        if (!op) return left;
        i++;
        left = { k: 'bin', op, a: left, b: next() };
      }
    };
    const primary = () => {
      const tk = tokens[i];
      if (!tk) throw new SyntaxError('Ende');
      i++;
      if (tk.t === 'num' || tk.t === 'str') return { k: 'val', v: tk.v };
      if (tk.t === 'err') return { k: 'fail', code: ERR.ref };
      if (tk.t === 'ref') {
        if (eat(':')) {
          const to = tokens[i++];
          if (!to || to.t !== 'ref') throw new SyntaxError('Bereich');
          return { k: 'range', a: tk.v, b: to.v };
        }
        return { k: 'ref', v: tk.v };
      }
      if (tk.t === 'name') {
        if (!eat('(')) throw new SyntaxError('Name');
        const args = [];
        if (!eat(')')) {
          do args.push(nested(compare));
          while (eat(';') || eat(','));
          if (!eat(')')) throw new SyntaxError('Klammer');
        }
        return { k: 'call', name: tk.v, args };
      }
      if (tk.t === 'op' && tk.v === '(') {
        const inner = nested(compare);
        if (!eat(')')) throw new SyntaxError('Klammer');
        return inner;
      }
      throw new SyntaxError('Zeichen');
    };
    const postfix = () => {
      let v = primary();
      while (eat('%')) v = { k: 'pct', a: v };
      return v;
    };
    const unary = () => {
      if (eat('-')) return nested(() => ({ k: 'neg', a: unary() }));
      if (eat('+')) return nested(unary);
      return postfix();
    };
    const power = () => {
      const left = unary();
      return eat('^') ? { k: 'bin', op: '^', a: left, b: nested(power) } : left;
    };
    const product = binary(power, ['*', '/']);
    const sum = binary(product, ['+', '-']);
    const compare = binary(sum, ['<=', '>=', '<>', '=', '<', '>']);
    const tree = compare();
    if (i !== tokens.length) throw new SyntaxError('Rest');
    return tree;
  }

  const cache = new Map();
  function parse(text) {
    if (cache.has(text)) return cache.get(text);
    let tree = null;
    try {
      const tokens = tokenize(text.slice(1));
      if (tokens && tokens.length) tree = parseTokens(tokens);
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(text, tree);
    return tree;
  }

  /* ---------------- Zahlen aus Zellen ---------------- */

  // Gleiche Regeln wie für Diagramme aus Tabellen (cellNumber in render.js)
  function cellNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    // Nur Zahlen mit Währung oder Prozent: „1e3“ oder „1,5k“ sind Text, Klammern stehen für negativ
    let raw = String(v ?? '').trim().replace(/[%€$£¥\s\u00a0]|\b(EUR|USD|CHF|GBP)\b/gi, '');
    const negative = /^\(.*\)$/.test(raw);
    if (negative) raw = raw.slice(1, -1);
    if (!/^-?[\d.,]*\d[\d.,]*$/.test(raw)) return null;
    let s = raw;
    const dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
    if (dots && commas) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (dots + commas > 1) s = s.replace(/[.,]/g, ''); // nur Tausendertrenner: 1.234.567
    else if (dots + commas === 1) {
      // Genau drei Stellen dahinter sind in Tabellen ein Tausendertrenner: 2.000, 1,234 – aber 0.125 nicht
      s = /^-?[1-9]\d{0,2}[.,]\d{3}$/.test(s) ? s.replace(/[.,]/, '') : s.replace(',', '.');
    }
    const n = Number(s);
    return Number.isFinite(n) ? (negative ? -n : n) : null;
  }

  /* ---------------- Rechnen ---------------- */

  const failed = (v) => v instanceof Failure;

  // Zahl zum Rechnen. Strenger als bei Diagrammen: Ein Datum oder „1.2.3“ ist hier keine Tausenderzahl, und „19 %“ sind 0,19.
  function numberOf(v) {
    if (typeof v === 'number') return v;
    const text = String(v ?? '').trim();
    if (/[.,]$/.test(text)) return null;
    if (/\d[.,]\d+[.,]/.test(text) && !/^\D*\d{1,3}([.,]\d{3})+([.,]\d+)?\D*$/.test(text)) return null;
    const n = cellNumber(text);
    return n !== null && text.includes('%') ? n / 100 : n;
  }

  function toNum(v) {
    if (failed(v)) return v;
    if (v === null || v === '') return 0;
    if (typeof v === 'number') return v;
    const n = numberOf(v);
    return n === null ? new Failure(ERR.value) : n;
  }

  function compute(table) {
    const cells = Array.isArray(table && table.cells) ? table.cells : [];
    const rows = Math.max(1, table && table.rows | 0), cols = Math.max(1, table && table.cols | 0);
    const memo = new Map();
    let chain = 0, steps = 0;

    const raw = (r, c) => {
      const v = cells[r] && cells[r][c];
      return v === undefined || v === null ? '' : String(v);
    };

    function value(r, c) {
      const key = r * 1000 + c;
      if (++steps > MAX_STEPS) return new Failure(ERR.num);
      if (memo.has(key)) {
        const m = memo.get(key);
        return m === VISITING ? new Failure(ERR.cycle) : m;
      }
      const text = raw(r, c);
      const tree = isFormula(text) ? parse(text) : null;
      if (!tree) {
        const plain = text === '' ? null : text;
        memo.set(key, plain);
        return plain;
      }
      if (chain >= MAX_CHAIN) {
        const stop = new Failure(ERR.num);
        memo.set(key, stop);
        return stop;
      }
      chain++;
      memo.set(key, VISITING);
      const v = evaluate(tree);
      chain--;
      memo.set(key, v);
      return v;
    }

    const inside = (a) => a.r >= 0 && a.c >= 0 && a.r < rows && a.c < cols;

    function single(v) {
      if (v === undefined) return new Failure(ERR.value);
      return v;
    }

    // Einzelwerte für Funktionen: Bereiche liefern alles außer Leerem und Text wird dort übergangen, wie in Tabellenkalkulationen
    function* collect(args) {
      for (const a of args) {
        if (a.k === 'range') {
          const r0 = Math.min(a.a.r, a.b.r), r1 = Math.min(rows - 1, Math.max(a.a.r, a.b.r));
          const c0 = Math.min(a.a.c, a.b.c), c1 = Math.min(cols - 1, Math.max(a.a.c, a.b.c));
          if (r0 >= rows || c0 >= cols) yield { v: new Failure(ERR.ref), direct: true };
          else for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) yield { v: value(r, c), direct: false };
        } else if (a.k === 'ref') {
          yield { v: inside(a.v) ? value(a.v.r, a.v.c) : new Failure(ERR.ref), direct: false };
        } else yield { v: evaluate(a), direct: true };
      }
    }

    function numbers(args) {
      const out = [];
      for (const { v, direct } of collect(args)) {
        if (failed(v)) return v;
        if (v === null) continue;
        const n = numberOf(v);
        if (n !== null) out.push(n);
        else if (direct) return new Failure(ERR.value);
      }
      return out;
    }

    function call(name, args) {
      const fn = ALIASES.get(name);
      if (!fn) return new Failure(ERR.name);
      if (fn === 'if') {
        if (args.length < 2 || args.length > 3) return new Failure(ERR.value);
        const test = toNum(evaluate(args[0]));
        if (failed(test)) return test;
        if (test !== 0) return single(evaluate(args[1]));
        return args[2] ? single(evaluate(args[2])) : 0;
      }
      if (fn === 'counta' || fn === 'count') {
        let n = 0;
        // Wie in Tabellenkalkulationen: Eine Zelle mit Fehler stört das Zählen nicht
        for (const { v } of collect(args)) if (v !== null && (fn === 'counta' || (!failed(v) && numberOf(v) !== null))) n++;
        return n;
      }
      if (fn === 'round') {
        if (!args.length || args.length > 2) return new Failure(ERR.value);
        const x = toNum(evaluate(args[0])), d = args[1] ? toNum(evaluate(args[1])) : 0;
        if (failed(x)) return x;
        if (failed(d)) return d;
        const f = 10 ** Math.trunc(d);
        return Math.sign(x) * (Math.round(Number((Math.abs(x) * f).toPrecision(15))) / f);
      }
      if (fn === 'abs') {
        if (args.length !== 1) return new Failure(ERR.value);
        const x = toNum(evaluate(args[0]));
        return failed(x) ? x : Math.abs(x);
      }
      const list = numbers(args);
      if (failed(list)) return list;
      if (fn === 'sum') return list.reduce((a, b) => a + b, 0);
      if (fn === 'average') return list.length ? list.reduce((a, b) => a + b, 0) / list.length : new Failure(ERR.div);
      if (fn === 'min') return list.length ? list.reduce((a, b) => Math.min(a, b)) : 0;
      return list.length ? list.reduce((a, b) => Math.max(a, b)) : 0;
    }

    function comparable(v) {
      if (v === null) return 0;
      const n = numberOf(v);
      return n === null ? String(v).toLowerCase() : n;
    }

    function binaryOp(op, a, b) {
      if (failed(a)) return a;
      if (failed(b)) return b;
      if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
        // Leere Zellen gleichen je nach Gegenseite der Null oder dem leeren Text: =WENN(B1="";…)
        const x = comparable(a === null && typeof b === 'string' ? '' : a), y = comparable(b === null && typeof a === 'string' ? '' : b);
        const same = typeof x === typeof y;
        const lt = same ? x < y : typeof x === 'number';
        const eq = same && x === y;
        return ({ '=': eq, '<>': !eq, '<': lt, '>': !lt && !eq, '<=': lt || eq, '>=': !lt })[op] ? 1 : 0;
      }
      const x = toNum(a), y = toNum(b);
      if (failed(x)) return x;
      if (failed(y)) return y;
      switch (op) {
        case '+': return x + y;
        case '-': return x - y;
        case '*': return x * y;
        case '/': return y === 0 ? new Failure(ERR.div) : x / y;
        default: return x ** y;
      }
    }

    function evaluate(n) {
      switch (n.k) {
        case 'val': return n.v;
        case 'fail': return new Failure(n.code);
        case 'ref': return inside(n.v) ? value(n.v.r, n.v.c) : new Failure(ERR.ref);
        case 'range': return new Failure(ERR.value);
        case 'neg': {
          const x = toNum(evaluate(n.a));
          return failed(x) ? x : -x;
        }
        case 'pct': {
          const x = toNum(evaluate(n.a));
          return failed(x) ? x : x / 100;
        }
        case 'bin': return binaryOp(n.op, evaluate(n.a), evaluate(n.b));
        case 'call': return call(n.name, n.args);
        default: return new Failure(ERR.value);
      }
    }

    const finished = (v) => {
      if (typeof v !== 'number') return v;
      return Number.isFinite(v) ? Number(v.toPrecision(15)) : new Failure(ERR.num);
    };

    // Sehr tiefe Formeln können den Aufrufstapel sprengen: Dann zeigt die Tabelle einen Fehler, statt nicht gezeichnet zu werden
    let blown = false;
    const safe = (r, c) => {
      if (blown) return new Failure(ERR.num);
      try {
        return finished(value(r, c));
      } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        blown = true;
        return new Failure(ERR.num);
      }
    };

    return {
      // Wert zum Weiterrechnen: Zahl, Text, null (leer) oder { error }
      value(r, c) {
        const v = safe(r, c);
        return failed(v) ? { error: v.code } : v;
      },
      // Text zum Anzeigen
      text(r, c, locale) {
        const text = raw(r, c);
        if (!isFormula(text) || !parse(text)) return text;
        const v = safe(r, c);
        if (failed(v)) return v.code;
        if (v === null) return '';
        return typeof v === 'number' ? v.toLocaleString(locale, { maximumFractionDigits: 10, useGrouping: false }) : String(v);
      },
    };
  }
  const VISITING = Symbol('visiting');

  /* ---------------- Bezüge bei Strukturänderungen ---------------- */

  // Zeile oder Spalte wandert mit; null = gelöscht
  function shift(i, at, count, insert) {
    if (insert) return i >= at ? i + count : i;
    if (i < at) return i;
    return i >= at + count ? i - count : null;
  }

  function shiftRange(a, b, at, count, insert) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    if (insert) return [shift(a, at, count, true), shift(b, at, count, true)];
    if (lo >= at && hi < at + count) return null;
    const nl = lo >= at && lo < at + count ? at : shift(lo, at, count, false);
    const nh = hi >= at && hi < at + count ? at - 1 : shift(hi, at, count, false);
    return a <= b ? [nl, nh] : [nh, nl];
  }

  // Über den darstellbaren Bereich hinaus gibt es keinen gültigen Bezug mehr
  const refText = (ref, r, c) => (r > 998 || c > 701 ? '#REF!' : `${ref.absCol}${colName(c)}${ref.absRow}${r + 1}`);

  /** Bezüge einer Formel nach „Zeilen/Spalten einfügen oder löschen“ anpassen. Texte in Anführungszeichen bleiben unberührt. */
  function adjust(formula, action, at, count) {
    // Nur echte Formeln: „== Kapitel B2 ==“ bleibt, wie es ist
    if (!isFormula(formula) || !parse(formula)) return formula;
    const rowsMove = action === 'insertRows' || action === 'deleteRows';
    const insert = action === 'insertRows' || action === 'insertCols';
    return formula.replace(/"(?:[^"]|"")*"|(\$?[A-Za-z]{1,2}\$?\d{1,3})(?:\s*:\s*(\$?[A-Za-z]{1,2}\$?\d{1,3}))?(?![A-Za-z0-9_.(])/g, (whole, first, second, pos, str) => {
      if (!first || /[A-Za-z0-9_.$ÄÖÜäöüß]/.test(str[pos - 1] || '')) return whole;
      const a = parseRef(first), b = second ? parseRef(second) : null;
      if (!a || (second && !b)) return whole;
      if (!b) {
        const moved = shift(rowsMove ? a.r : a.c, at, count, insert);
        if (moved === null) return '#REF!';
        return rowsMove ? refText(a, moved, a.c) : refText(a, a.r, moved);
      }
      const pair = rowsMove ? shiftRange(a.r, b.r, at, count, insert) : shiftRange(a.c, b.c, at, count, insert);
      if (!pair) return '#REF!';
      return rowsMove
        ? `${refText(a, pair[0], a.c)}:${refText(b, pair[1], b.c)}`
        : `${refText(a, a.r, pair[0])}:${refText(b, b.r, pair[1])}`;
    });
  }

  const api = { isFormula, compute, adjust, refName, parseRef, cellNumber, valid: (s) => isFormula(s) && !!parse(s), ERR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TableFormula = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
