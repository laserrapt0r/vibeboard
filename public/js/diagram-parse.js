// Diagramme aus Text: Flussdiagramme und Sequenzdiagramme in der verbreiteten Mermaid-Schreibweise
// werden in normale, bearbeitbare Board-Elemente (Formen, Verbindungen, Texte) umgewandelt.
// Eigene Umsetzung ohne Fremdbibliothek; reine Funktionen (auch für Vorlagen nutzbar).
import { uid, measure, wrap } from './util.js';

export const EXAMPLES = {
  flow: `flowchart TD
  start([Ticket eingegangen]) --> triage{Störung oder Anfrage?}
  triage -->|Störung| prio[Priorität bestimmen]
  triage -->|Anfrage| katalog[Service-Katalog prüfen]
  prio --> major{Major Incident?}
  major -->|ja| mim[[Major-Incident-Prozess]]
  major -->|nein| loesung[Lösen & dokumentieren]
  katalog --> loesung
  loesung --> db[(Wissensdatenbank)]
  loesung --> ende([Ticket schließen])`,
  seq: `sequenceDiagram
  autonumber
  actor U as Nutzer
  participant W as Web-App
  participant A as API
  participant D as Datenbank
  U->>W: Login absenden
  W->>A: POST /login
  A->>D: Benutzer laden
  D-->>A: Datensatz
  alt Kennwort korrekt
    A-->>W: 200 + Session
    W-->>U: Dashboard
  else falsch
    A-->>W: 401
    Note over U,W: Fehlermeldung anzeigen
  end`,
};

/* ================================================================== */
/* Flussdiagramm                                                       */
/* ================================================================== */

// Öffnende Klammer → [schließende Klammer, Form]
// Bei [/ und [\ entscheidet die schließende Klammer über die Form: [/…/] und [\…\] Parallelogramm, [/…\] und [\…/] Trapez
const BRACKETS = [
  ['(((', ')))', 'ellipse'], ['[[', ']]', 'subprocess'], ['[(', ')]', 'cylinder'], ['((', '))', 'ellipse'], ['([', '])', 'pill'], ['{{', '}}', 'hexagon'],
  ['[/', { '/]': 'parallelogram', '\\]': 'trapezoid' }], ['[\\', { '\\]': 'parallelogram', '/]': 'trapezoid' }],
  ['[', ']', 'rect'], ['(', ')', 'roundrect'], ['{', '}', 'diamond'], ['>', ']', 'callout'],
];

const MAX_NODES = 400;

const SHAPE_STYLE = {
  rect: ['#eef1ff', '#4262ff'], roundrect: ['#eef1ff', '#4262ff'], subprocess: ['#eef1ff', '#4262ff'], diamond: ['#fff4e6', '#f08c00'],
  cylinder: ['#e6fcf5', '#12b886'], ellipse: ['#f3f0ff', '#7048e8'], pill: ['#f3f0ff', '#7048e8'], hexagon: ['#fff0f6', '#d6336c'],
  parallelogram: ['#e7f5ff', '#1971c2'], trapezoid: ['#e7f5ff', '#1971c2'], callout: ['#fff9db', '#e67700'],
};

const cleanLabel = (t) => String(t || '').trim().replace(/^"(.*)"$/s, '$1').replace(/<br\s*\/?>/gi, '\n').replace(/&quot;/g, '"');

// Ende einer Beschriftung: Text in Anführungszeichen darf Klammern enthalten
function findClose(s, from, close) {
  let j = from;
  while (s[j] === ' ') j++;
  if (s[j] === '"') {
    const q = s.indexOf('"', j + 1);
    if (q > 0 && s.startsWith(close, q + 1 + (s.slice(q + 1).match(/^ */)[0].length))) return s.indexOf(close, q + 1);
  }
  return s.indexOf(close, from);
}

function parseNode(s, i, nodes, order) {
  // IDs dürfen Bindestriche enthalten (user-service), aber nicht direkt vor einer Kante
  const m = /^[A-Za-z0-9_\u00C0-\u024F]+(?:-(?![-.>=])[A-Za-z0-9_\u00C0-\u024F]+)*/.exec(s.slice(i));
  if (!m) throw new Error(`Knoten erwartet bei „${s.slice(i, i + 20)}“`);
  const id = m[0];
  i += id.length;
  let label = null, shape = null;
  for (const [open, close, sh] of BRACKETS) {
    if (!s.startsWith(open, i)) continue;
    // mehrere mögliche Abschlüsse: der nächstgelegene gilt
    const closes = typeof close === 'string' ? { [close]: sh } : close;
    let best = null;
    for (const [c, form] of Object.entries(closes)) {
      const end = findClose(s, i + open.length, c);
      if (end >= 0 && (!best || end < best[0])) best = [end, c, form];
    }
    if (!best) continue;
    label = cleanLabel(s.slice(i + open.length, best[0]));
    shape = best[2];
    i = best[0] + best[1].length;
    break;
  }
  // Klassenzuweisung A:::klasse ignorieren
  const cls = /^:::[\w-]+/.exec(s.slice(i));
  if (cls) i += cls[0].length;
  if (!nodes.has(id) && nodes.size >= MAX_NODES) throw new Error(`Höchstens ${MAX_NODES} Knoten je Diagramm`);
  if (!nodes.has(id)) {
    nodes.set(id, { id, label: label ?? id, shape: shape || 'rect' });
    order.push(id);
  } else if (label !== null) Object.assign(nodes.get(id), { label, shape });
  return [id, i];
}

function parseGroup(s, i, nodes, order) {
  const ids = [];
  for (;;) {
    while (s[i] === ' ' || s[i] === '\t') i++;
    let id;
    [id, i] = parseNode(s, i, nodes, order);
    ids.push(id);
    while (s[i] === ' ' || s[i] === '\t') i++;
    if (s[i] !== '&') return [ids, i];
    i++;
  }
}

// Kanten: -->, ---, -.->, -.-, ==>, ===, <-->, --o, --x, mit Beschriftung |text| oder "-- text -->"
function parseEdge(s, i) {
  while (s[i] === ' ' || s[i] === '\t') i++;
  const rest = s.slice(i);
  let m = /^(<?)(--|==|-\.)\s*([^-.=>|\s][^>|]*?)\s*(-{2,}>|-{3,}|\.-+>|\.-+|={2,}>|={3,}|--[ox])/.exec(rest);
  if (m) return [{ arrowStart: !!m[1], dashed: m[2] === '-.' || m[4].startsWith('.'), thick: m[2] === '==', arrow: /[>ox]$/.test(m[4]), label: cleanLabel(m[3]) }, i + m[0].length];
  m = /^(<?)(-{2,}>|-{3,}|-\.+->|-\.+-|={2,}>|={3,}|--[ox])(?:\s*\|([^|]*)\|)?/.exec(rest);
  if (!m) return [null, i];
  return [{ arrowStart: !!m[1], dashed: m[2].includes('.'), thick: m[2].startsWith('='), arrow: /[>ox]$/.test(m[2]), label: cleanLabel(m[3] || '') }, i + m[0].length];
}

// Zeilen an „;“ trennen – außer innerhalb von Klammern oder Anführungszeichen
function splitStatements(line) {
  const out = [];
  let cur = '', depth = 0, q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (!q && '[({'.includes(ch)) depth++;
    else if (!q && '])}'.includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === ';' && !q && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseFlowchart(text) {
  const lines = text.split('\n').map((l) => l.replace(/%%.*$/, ''));
  // Kopfzeile darf mit „;“ weitergehen: „graph TD; A-->B“
  const [first, ...tail] = lines.shift().split(';');
  if (tail.length) lines.unshift(tail.join(';'));
  const dir = (/^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)/i.exec(first.trim()) || [])[1]?.toUpperCase() || 'TD';
  const nodes = new Map(), order = [], edges = [], groups = [];
  const stack = [];
  for (const raw of lines.flatMap(splitStatements)) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = /^subgraph\s+(.+)$/i.exec(line))) {
      const t = /^([\w-]+)\s*\[(.+)\]$/.exec(m[1].trim());
      const g = { title: cleanLabel(t ? t[2] : m[1]), ids: new Set() };
      groups.push(g);
      stack.push(g);
      continue;
    }
    if (/^end$/i.test(line)) {
      stack.pop();
      continue;
    }
    if (/^(classDef|class|style|linkStyle|click|direction)\b/.test(line)) continue;
    let i = 0, prev;
    [prev, i] = parseGroup(line, i, nodes, order);
    for (const g of stack) prev.forEach((id) => g.ids.add(id));
    for (;;) {
      let e;
      [e, i] = parseEdge(line, i);
      if (!e) break;
      let next;
      [next, i] = parseGroup(line, i, nodes, order);
      for (const g of stack) next.forEach((id) => g.ids.add(id));
      for (const a of prev) for (const b of next) edges.push({ from: a, to: b, ...e });
      prev = next;
    }
    if (line.slice(i).trim()) throw new Error(`Unverständlich: „${line.slice(i).trim().slice(0, 40)}“`);
  }
  if (!nodes.size) throw new Error('Keine Knoten gefunden');
  return { dir, nodes, order, edges, groups };
}

function nodeSize(n) {
  const fs = 16;
  const longest = Math.max(...n.label.split('\n').map((l) => measure(l, fs)));
  let w = Math.max(140, Math.min(280, longest + 48));
  const lines = n.label.split('\n').reduce((s, l) => s + wrap(l, w - 40, fs).length, 0);
  let hh = Math.max(64, lines * fs * 1.3 + 32);
  if (n.shape === 'diamond') {
    w = Math.max(170, w * 1.35);
    hh = Math.max(110, hh * 1.5);
  } else if (n.shape === 'ellipse' || n.shape === 'hexagon') {
    w *= 1.2;
    hh = Math.max(80, hh * 1.2);
  } else if (n.shape === 'cylinder') hh += 24;
  else if (n.shape === 'subprocess' || n.shape === 'parallelogram' || n.shape === 'trapezoid') w = Math.min(340, w * 1.25);
  return { w: Math.round(w), h: Math.round(hh) };
}

export function layoutFlowchart(g) {
  const { dir, nodes, order, edges, groups } = g;
  // Rückkanten (Zyklen) erkennen, damit die Ebenenbildung terminiert
  const out = new Map(order.map((id) => [id, []]));
  edges.forEach((e, k) => out.get(e.from).push([e.to, k]));
  // Tiefensuche ohne Rekursion (lange Ketten würden sonst den Stack sprengen)
  const state = new Map(), back = new Set();
  for (const start of order) {
    if (state.get(start)) continue;
    const stack = [[start, 0]];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const list = out.get(top[0]);
      if (top[1] >= list.length) {
        state.set(top[0], 2);
        stack.pop();
        continue;
      }
      const [to, k] = list[top[1]++];
      if (state.get(to) === 1) back.add(k);
      else if (!state.get(to)) {
        state.set(to, 1);
        stack.push([to, 0]);
      }
    }
  }
  const rank = new Map(order.map((id) => [id, 0]));
  for (let it = 0; it < order.length; it++) {
    let changed = false;
    edges.forEach((e, k) => {
      if (back.has(k) || e.from === e.to) return;
      if (rank.get(e.to) < rank.get(e.from) + 1) {
        rank.set(e.to, rank.get(e.from) + 1);
        changed = true;
      }
    });
    if (!changed) break;
  }
  const layers = [];
  for (const id of order) (layers[rank.get(id)] = layers[rank.get(id)] || []).push(id);
  // Reihenfolge in den Ebenen nach dem Mittel der Vorgänger (weniger Kreuzungen)
  const pos = new Map();
  layers.forEach((l) => l.forEach((id, i) => pos.set(id, i)));
  const preds = new Map(order.map((id) => [id, []]));
  edges.forEach((e) => preds.get(e.to).push(e.from));
  for (let r = 1; r < layers.length; r++) {
    const bary = new Map(layers[r].map((id) => {
      const ps = preds.get(id).filter((f) => rank.get(f) < r).map((f) => pos.get(f));
      return [id, ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : pos.get(id)];
    }));
    layers[r].sort((a, b) => bary.get(a) - bary.get(b));
    layers[r].forEach((id, i) => pos.set(id, i));
  }
  const horizontal = dir === 'LR' || dir === 'RL';
  const sizes = new Map(order.map((id) => [id, nodeSize(nodes.get(id))]));
  // Gruppenrahmen brauchen zusätzlichen Abstand, damit sie sich nicht überlappen
  const gapMain = (horizontal ? 110 : 90) + (groups.length ? 40 : 0), gapCross = (horizontal ? 50 : 70) + (groups.length ? 60 : 0);
  const box = new Map();
  let main = 0;
  layers.forEach((layer) => {
    const depth = Math.max(...layer.map((id) => (horizontal ? sizes.get(id).w : sizes.get(id).h)));
    const total = layer.reduce((s, id) => s + (horizontal ? sizes.get(id).h : sizes.get(id).w), 0) + gapCross * (layer.length - 1);
    let cross = -total / 2;
    for (const id of layer) {
      const sz = sizes.get(id);
      const len = horizontal ? sz.h : sz.w, dep = horizontal ? sz.w : sz.h;
      const m = main + (depth - dep) / 2;
      box.set(id, horizontal ? { x: m, y: cross, ...sz } : { x: cross, y: m, ...sz });
      cross += len + gapCross;
    }
    main += depth + gapMain;
  });
  if (dir === 'BT' || dir === 'RL') {
    for (const b of box.values()) {
      if (dir === 'BT') b.y = main - b.y - b.h;
      else b.x = main - b.x - b.w;
    }
  }
  const els = [];
  const idMap = new Map();
  for (const grp of groups) {
    const bs = [...grp.ids].map((id) => box.get(id)).filter(Boolean);
    if (!bs.length) continue;
    const x1 = Math.min(...bs.map((b) => b.x)) - 40, y1 = Math.min(...bs.map((b) => b.y)) - 50;
    const x2 = Math.max(...bs.map((b) => b.x + b.w)) + 40, y2 = Math.max(...bs.map((b) => b.y + b.h)) + 40;
    els.push({ id: uid(), type: 'shape', shape: 'roundrect', x: x1, y: y1, w: x2 - x1, h: y2 - y1, fill: '#f8f9fa', stroke: '#adb5bd', strokeWidth: 1.5, dash: true, text: grp.title, fontSize: 16, bold: true, align: 'left', valign: 'top', textColor: '#495057' });
  }
  for (const id of order) {
    const n = nodes.get(id), b = box.get(id);
    const [fill, stroke] = SHAPE_STYLE[n.shape] || SHAPE_STYLE.rect;
    const el = { id: uid(), type: 'shape', shape: n.shape, x: Math.round(b.x), y: Math.round(b.y), w: b.w, h: b.h, fill, stroke, strokeWidth: 2, text: n.label, fontSize: 16 };
    idMap.set(id, el.id);
    els.push(el);
  }
  // Vorwärtskanten laufen in Flussrichtung; Rückkanten (Schleifen) als Bogen außen herum
  const SIDES = { TD: ['bottom', 'top', 'right'], BT: ['top', 'bottom', 'right'], LR: ['right', 'left', 'bottom'], RL: ['left', 'right', 'bottom'] };
  const [fwdFrom, fwdTo, around] = SIDES[dir] || SIDES.TD;
  for (const e of edges) {
    const backwards = rank.get(e.to) <= rank.get(e.from);
    els.push({
      id: uid(), type: 'connector',
      from: { id: idMap.get(e.from), side: backwards ? around : fwdFrom },
      to: { id: idMap.get(e.to), side: backwards ? around : fwdTo },
      routing: backwards ? 'curve' : 'elbow',
      stroke: '#495057', strokeWidth: e.thick ? 4 : 2, dash: e.dashed || undefined, arrowEnd: e.arrow, arrowStart: e.arrowStart, label: e.label,
    });
  }
  return els;
}

/* ================================================================== */
/* Sequenzdiagramm                                                     */
/* ================================================================== */

export function parseSequence(text) {
  const parts = new Map();
  const steps = [];
  let auto = false;
  const part = (id, label, actor) => {
    id = id.trim();
    if (!parts.has(id)) parts.set(id, { id, label: label ? cleanLabel(label) : id, actor: !!actor });
    else if (label) parts.get(id).label = cleanLabel(label);
    return id;
  };
  for (const raw of text.split('\n').slice(1)) {
    const line = raw.replace(/%%.*$/, '').trim();
    if (!line) continue;
    let m;
    if (/^autonumber\b/i.test(line)) auto = true;
    else if ((m = /^(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/i.exec(line))) part(m[2], m[3], m[1].toLowerCase() === 'actor');
    else if ((m = /^(loop|alt|opt|par|critical|break|rect|box)\b\s*(.*)$/i.exec(line))) steps.push({ kind: 'open', label: `${m[1].toLowerCase()}${m[2] && !/^rgba?\(/.test(m[2]) ? ' ' + cleanLabel(m[2]) : ''}` });
    else if ((m = /^(else|and|option)\b\s*(.*)$/i.exec(line))) steps.push({ kind: 'else', label: cleanLabel(m[2] || '') });
    else if (/^end$/i.test(line)) steps.push({ kind: 'close' });
    else if ((m = /^note\s+(left of|right of|over)\s+([^:]+):\s*(.*)$/i.exec(line))) {
      steps.push({ kind: 'note', where: m[1].toLowerCase(), who: m[2].split(',').map((x) => part(x)), text: cleanLabel(m[3]) });
    } else if (/^(activate|deactivate|title|accTitle|accDescr)\b/i.test(line)) continue;
    else if ((m = /^([^-<>+:]+?)\s*(<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\))\s*[+-]?\s*([^:]+?)\s*(?::\s*(.*))?$/.exec(line))) {
      // ->> und -x mit Pfeilspitze, -> und --> als einfache Linie (wie in Mermaid)
      steps.push({ kind: 'msg', from: part(m[1]), to: part(m[3]), dashed: m[2].includes('--'), cross: /x$/.test(m[2]), both: m[2].startsWith('<<'), arrow: !/^-{1,2}>$/.test(m[2]), text: cleanLabel(m[4] || '') });
    } else throw new Error(`Unverständlich: „${line.slice(0, 40)}“`);
  }
  if (!parts.size) throw new Error('Keine Teilnehmer gefunden');
  return { parts: [...parts.values()], steps, auto };
}

export function layoutSequence({ parts, steps, auto }) {
  const els = [];
  const colW = 260, boxW = 190, boxH = 60;
  const cx = new Map(parts.map((p, i) => [p.id, i * colW + boxW / 2]));
  const head = (p, y) => els.push(p.actor
    ? { id: uid(), type: 'shape', shape: 'actor', x: cx.get(p.id) - 40, y: y - 30, w: 80, h: boxH + 40, fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 2, text: p.label, fontSize: 15, bold: true }
    : { id: uid(), type: 'shape', shape: 'rect', x: cx.get(p.id) - boxW / 2, y, w: boxW, h: boxH, fill: '#eef1ff', stroke: '#4262ff', strokeWidth: 2, text: p.label, fontSize: 16, bold: true });
  parts.forEach((p) => head(p, 0));
  let y = boxH + 70, n = 0;
  const blocks = [];
  const minX = -boxW / 2 + boxW / 2 - 20, maxX = (parts.length - 1) * colW + boxW + 20;
  const line = (x1, y1, x2, y2, o = {}) => els.push({ id: uid(), type: 'connector', from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, routing: 'straight', stroke: '#1a1a1a', strokeWidth: 2, arrowEnd: false, ...o });
  for (const s of steps) {
    if (s.kind === 'msg') {
      const x1 = cx.get(s.from), x2 = cx.get(s.to);
      const label = (auto ? `${++n}. ` : '') + s.text + (s.cross ? ' ✕' : '');
      const o = { dash: s.dashed || undefined, arrowStart: s.both };
      const fs = 15, lineH = fs * 1.25;
      if (x1 === x2) {
        line(x1, y, x1 + 60, y, o);
        line(x1 + 60, y, x1 + 60, y + 34, o);
        line(x1 + 60, y + 34, x1, y + 34, { ...o, arrowStart: false, arrowEnd: s.arrow });
        const lines = label ? wrap(label, 212, fs).length : 0;
        if (label) els.push({ id: uid(), type: 'text', x: x1 + 70, y: y - 4, w: 220, h: lines * lineH + 8, text: label, fontSize: fs, color: '#1a1a1a', align: 'left' });
        y += Math.max(80, lines * lineH + 40);
      } else {
        // Beschriftung oberhalb des Pfeils; mehrzeilige Texte schieben den Pfeil nach unten
        const w = Math.max(160, Math.abs(x2 - x1) - 20);
        const lines = label ? wrap(label, w - 8, fs).length : 0;
        const th = lines * lineH + 8;
        if (lines > 1) y += th - 26;
        line(x1, y, x2, y, { ...o, arrowEnd: s.arrow });
        if (label) els.push({ id: uid(), type: 'text', x: Math.min(x1, x2) + (Math.abs(x2 - x1) - w) / 2, y: y - th - 4, w, h: th, text: label, fontSize: fs, color: '#1a1a1a', align: 'center' });
        y += 64;
      }
    } else if (s.kind === 'note') {
      const xs = s.who.map((id) => cx.get(id));
      let x1, w;
      if (s.where === 'over') {
        x1 = Math.min(...xs) - 90;
        w = Math.max(...xs) - Math.min(...xs) + 180;
      } else if (s.where === 'right of') {
        x1 = xs[0] + 20;
        w = 200;
      } else {
        x1 = xs[0] - 220;
        w = 200;
      }
      const lines = wrap(s.text, w - 30, 15).length;
      const hh = Math.max(48, lines * 19 + 24);
      els.push({ id: uid(), type: 'shape', shape: 'note', x: x1, y: y - 20, w, h: hh, fill: '#fff9b1', stroke: '#c9a800', strokeWidth: 1.5, text: s.text, fontSize: 15 });
      y += hh + 30;
    } else if (s.kind === 'open') {
      blocks.push({ y: y - 50, label: s.label, depth: blocks.length });
      y += 20;
    } else if (s.kind === 'else' && blocks.length) {
      const d = blocks.length - 1;
      line(minX + d * 12, y - 30, maxX - d * 12, y - 30, { dash: true, stroke: '#868e96', strokeWidth: 1.5 });
      if (s.label) els.push({ id: uid(), type: 'text', x: minX + d * 12 + 8, y: y - 26, w: 260, h: 24, text: `[${s.label}]`, fontSize: 13, color: '#868e96', align: 'left', italic: true });
      y += 20;
    } else if (s.kind === 'close' && blocks.length) {
      const b = blocks.pop();
      const d = b.depth;
      els.unshift({ id: uid(), type: 'shape', shape: 'rect', x: minX + d * 12, y: b.y, w: maxX - minX - d * 24, h: y - b.y - 20, fill: 'transparent', stroke: '#868e96', strokeWidth: 1.5, text: b.label, fontSize: 13, bold: true, align: 'left', valign: 'top', textColor: '#495057' });
      y += 10;
    }
  }
  const end = y + 10;
  // Lebenslinien hinter allem anderen
  const lifelines = parts.map((p) => ({ id: uid(), type: 'connector', from: { x: cx.get(p.id), y: boxH + (p.actor ? 10 : 0) }, to: { x: cx.get(p.id), y: end }, routing: 'straight', stroke: '#adb5bd', strokeWidth: 1.5, dash: true, arrowEnd: false }));
  parts.forEach((p) => head(p, end));
  return [...lifelines, ...els];
}

export function textToElements(text) {
  const t = String(text || '').replace(/\r/g, '')
    .replace(/^\s*---\n[\s\S]*?\n---\s*\n/, '') // Front-Matter (Titel, Konfiguration)
    .replace(/^\s*%%\{[\s\S]*?\}%%\s*\n/, '') // %%{init: …}%%
    .replace(/^(\s*%%.*\n)+/, '')
    .trim();
  if (!t) throw new Error('Bitte einen Diagrammtext eingeben');
  const first = t.split('\n', 1)[0].trim();
  if (/^sequenceDiagram\b/i.test(first)) return layoutSequence(parseSequence(t));
  if (/^(flowchart|graph)\b/i.test(first)) return layoutFlowchart(parseFlowchart(t));
  throw new Error('Die erste Zeile muss „flowchart TD“, „flowchart LR“ oder „sequenceDiagram“ lauten');
}
