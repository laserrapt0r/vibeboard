// Darstellung der Board-Elemente als SVG-Markup (für Board, Vorschau & Export)
import { T, LOCALE, DEC } from './i18n.js';
import { esc, FONT, wrap, fitText, measure, contrastText, initials, unionRect } from './util.js';
import { tokenize, THEMES, MAX_LINES } from './highlight.js';

const own = (map, key) => (Object.hasOwn(map, key) ? map[key] : undefined);

export const LH = 1.25;

export const SHAPES = [
  ['rect', T('Rechteck')], ['roundrect', T('Abgerundet')], ['ellipse', T('Ellipse')], ['diamond', T('Raute')],
  ['triangle', T('Dreieck')], ['hexagon', T('Sechseck')], ['parallelogram', T('Parallelogramm')], ['trapezoid', T('Trapez')],
  ['star', T('Stern')], ['pill', T('Pille')], ['cylinder', T('Zylinder / Datenbank')], ['arrow', T('Blockpfeil')],
  ['callout', T('Sprechblase')], ['cross', T('Kreuz')], ['document', T('Dokument')], ['cloud', T('Wolke')],
  ['subprocess', T('Unterprozess')], ['delay', T('Verzögerung')], ['note', T('Notiz')], ['package', T('Paket')],
  ['actor', T('Akteur')], ['server', T('Server')], ['queue', T('Warteschlange')], ['container', T('Container')],
  ['component', T('Komponente')], ['browser', T('Browser / UI')], ['laptop', T('Laptop')], ['firewall', T('Firewall')],
  // seit 3.6.0
  ['multidoc', T('Mehrere Dokumente')], ['manualinput', T('Manuelle Eingabe')], ['manualop', T('Manuelle Tätigkeit')],
  ['display', T('Anzeige')], ['offpage', T('Verweis auf andere Seite')], ['internalstorage', T('Interner Speicher')],
  ['umlclass', T('Klasse')], ['umlnode', T('Knoten (Verteilung)')], ['initial', T('Startzustand')], ['final', T('Endzustand')],
  ['forkbar', T('Gabelung / Vereinigung')], ['send', T('Signal senden')], ['receive', T('Signal empfangen')],
  ['event', T('Startereignis')], ['eventinter', T('Zwischenereignis')], ['eventend', T('Endereignis')],
  ['gatewayx', T('Exklusives Gateway (XOR)')], ['gatewayplus', T('Paralleles Gateway (AND)')], ['gatewayo', T('Inklusives Gateway (OR)')],
  ['router', T('Router')], ['switch', T('Switch')], ['loadbalancer', T('Load Balancer')], ['accesspoint', T('WLAN-Access-Point')],
  ['internet', T('Internet')], ['rack', T('Serverschrank (Rack)')], ['storage', T('Speichersystem (NAS/SAN)')],
  ['desktop', T('Arbeitsplatz-PC')], ['mobile', T('Smartphone / Tablet')], ['users', T('Benutzergruppe')],
  ['gear', T('Dienst / Konfiguration')], ['lock', T('Sicherheit / Zugriffsschutz')],
  ['pod', T('Pod')], ['deployment', T('Deployment / ReplicaSet')], ['k8sservice', T('Service')], ['ingress', T('Ingress')],
  ['k8snode', T('Knoten (Node)')], ['configmap', T('ConfigMap')], ['secret', T('Secret')], ['volume', T('Volume')],
];

// Gruppierung für die Formenauswahl
export const SHAPE_GROUPS = [
  [T('Grundformen'), ['rect', 'roundrect', 'ellipse', 'diamond', 'triangle', 'hexagon', 'parallelogram', 'trapezoid', 'star', 'pill', 'arrow', 'callout', 'cross', 'cloud']],
  [T('Flussdiagramm'), ['pill', 'rect', 'diamond', 'parallelogram', 'document', 'multidoc', 'subprocess', 'manualinput', 'manualop', 'display', 'delay', 'cylinder', 'internalstorage', 'offpage', 'note']],
  [T('UML'), ['umlclass', 'actor', 'ellipse', 'package', 'component', 'umlnode', 'note', 'roundrect', 'initial', 'final', 'diamond', 'forkbar', 'send', 'receive']],
  [T('BPMN (Prozesse)'), ['roundrect', 'event', 'eventinter', 'eventend', 'gatewayx', 'gatewayplus', 'gatewayo', 'note', 'cylinder']],
  [T('Netzwerk & Rechenzentrum'), ['router', 'switch', 'firewall', 'loadbalancer', 'accesspoint', 'internet', 'cloud', 'server', 'rack', 'storage', 'desktop', 'laptop', 'mobile', 'users']],
  [T('Software & IT'), ['server', 'cylinder', 'queue', 'container', 'browser', 'laptop', 'firewall', 'cloud', 'actor', 'component', 'gear', 'lock']],
  [T('Container-Plattform'), ['pod', 'deployment', 'k8sservice', 'ingress', 'k8snode', 'configmap', 'secret', 'volume']],
];

// Standardgröße und -werte neuer Formen (sonst 200 × 140)
const ICON_DEFAULT = { w: 120, h: 150, fontSize: 14, valign: 'top' };
export const SHAPE_DEFAULTS = {
  router: ICON_DEFAULT, loadbalancer: ICON_DEFAULT, accesspoint: ICON_DEFAULT, internet: ICON_DEFAULT, gear: ICON_DEFAULT,
  lock: ICON_DEFAULT, users: ICON_DEFAULT, pod: ICON_DEFAULT, deployment: ICON_DEFAULT, k8sservice: ICON_DEFAULT,
  ingress: ICON_DEFAULT, k8snode: ICON_DEFAULT, configmap: ICON_DEFAULT, secret: ICON_DEFAULT, volume: ICON_DEFAULT,
  switch: { w: 260, h: 80, fontSize: 15 }, storage: { w: 240, h: 110, fontSize: 15 }, rack: { w: 200, h: 360, fontSize: 15, bold: true },
  desktop: { w: 180, h: 150, fontSize: 15 }, mobile: { w: 100, h: 180, fontSize: 14 },
  umlclass: { w: 240, h: 170, fontSize: 14, align: 'left', valign: 'top', text: T('Klasse\n--\n- attribut: Typ\n--\n+ methode(): Typ') },
  initial: { w: 36, h: 36, fill: '#1a1a1a' }, final: { w: 40, h: 40 }, forkbar: { w: 220, h: 10, fill: '#1a1a1a' },
  send: { w: 200, h: 90 }, receive: { w: 200, h: 90 },
  event: { w: 56, h: 56, fontSize: 12 }, eventinter: { w: 56, h: 56, fontSize: 12 }, eventend: { w: 56, h: 56, fontSize: 12 },
  gatewayx: { w: 72, h: 72, fontSize: 12 }, gatewayplus: { w: 72, h: 72, fontSize: 12 }, gatewayo: { w: 72, h: 72, fontSize: 12 },
};

export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

export function defsMarkup() {
  return `<filter id="shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.16"/></filter>
<filter id="shadow-sm" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.18"/></filter>
<pattern id="conceal-pattern" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="24" height="24" fill="#e9ecef"/><rect width="12" height="24" fill="#dee2e6"/></pattern>`;
}

/* ---------------- Text ---------------- */

export function textLayout(el, box) {
  const bold = !!el.bold;
  const italic = !!el.italic;
  if (el.fontSize === 'auto' || el.fontSize == null) {
    const r = fitText(el.text || '', box.w, box.h, bold, LH);
    return { size: r.size, lines: r.lines, bold, italic };
  }
  const size = Number(el.fontSize) || 16;
  return { size, lines: wrap(el.text || '', box.w, size, bold, italic), bold, italic };
}

export function textSvg(box, layout, { color = '#1a1a1a', align = 'center', valign = 'middle', cls = 't', underline = false, strike = false } = {}) {
  const { size, lines, bold, italic } = layout;
  if (!lines.length || (lines.length === 1 && !lines[0])) return '';
  const total = lines.length * size * LH;
  let ty = valign === 'top' ? box.y : valign === 'bottom' ? box.y + box.h - total : box.y + (box.h - total) / 2;
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const tx = align === 'left' ? box.x : align === 'right' ? box.x + box.w : box.x + box.w / 2;
  const base = size * ((LH - 1) / 2 + 0.8);
  let spans = '';
  lines.forEach((l, i) => {
    if (l) spans += `<tspan x="${r1(tx)}" y="${r1(ty + i * size * LH + base)}">${esc(l)}</tspan>`;
  });
  const deco = [underline && 'underline', strike && 'line-through'].filter(Boolean).join(' ');
  return `<text class="${cls}" font-family="${esc(FONT)}" font-size="${size}" fill="${color}" text-anchor="${anchor}"${bold ? T(' font-weight="bold"') : ''}${italic ? T(' font-style="italic"') : ''}${deco ? T` text-decoration="${deco}"` : ''} xml:space="preserve">${spans}</text>`;
}

/* ---------------- Tabellen ---------------- */

// Spaltenbreiten bzw. Zeilenhöhen als Anteile (Summe 1); fehlend oder ungültig = gleichmäßig
export function fractions(list, n) {
  const ok = Array.isArray(list) && list.length === n && list.every((v) => Number.isFinite(v) && v > 0);
  if (!ok) return Array(n).fill(1 / n);
  const sum = list.reduce((a, b) => a + b, 0);
  return list.map((v) => v / sum);
}

// Linienpositionen einer Tabelle: xs (cols + 1 Werte) und ys (rows + 1 Werte)
export function tableLayout(el) {
  const rows = Math.max(1, el.rows || 1), cols = Math.max(1, el.cols || 1);
  const fw = fractions(el.colW, cols), fh = fractions(el.rowH, rows);
  const xs = [el.x], ys = [el.y];
  fw.forEach((f) => xs.push(xs[xs.length - 1] + f * el.w));
  fh.forEach((f) => ys.push(ys[ys.length - 1] + f * el.h));
  return { xs, ys, rows, cols };
}

export function cellAt(el, wx, wy) {
  const { xs, ys, rows, cols } = tableLayout(el);
  let c = 0, r = 0;
  while (c < cols - 1 && wx > xs[c + 1]) c++;
  while (r < rows - 1 && wy > ys[r + 1]) r++;
  return [r, c];
}

// Formatierung einer Zelle (Kopfzeile ist standardmäßig fett)
export function cellStyle(el, r, c) {
  const st = (el.styles && el.styles[r] && el.styles[r][c]) || {};
  const header = el.header !== false && r === 0;
  return {
    bold: st.b ?? header, italic: !!st.i, underline: !!st.u, strike: !!st.s,
    align: ['left', 'center', 'right'].includes(st.al) ? st.al : 'left',
    valign: ['top', 'middle', 'bottom'].includes(st.va) ? st.va : 'middle',
    size: Number(st.fs) || Number(el.fontSize) || 14,
    color: st.c || el.textColor || '#1a1a1a',
    bg: st.bg || (header ? el.headerFill || '#eef1ff' : null),
  };
}

const r1 = (v) => Math.round(v * 10) / 10;

/* ---------------- Formen ---------------- */

/* ---------------- Symbole (Netzwerk, Container-Plattform, UML, BPMN) ---------------- */

// Symbole mit Beschriftung darunter: oben ein quadratisches Symbol, darunter der Text
const ICON_SHAPES = new Set(['router', 'loadbalancer', 'accesspoint', 'internet', 'gear', 'lock', 'users',
  'pod', 'deployment', 'k8sservice', 'ingress', 'k8snode', 'configmap', 'secret', 'volume']);
const ICON_F = 0.7;
const LABEL_BELOW = new Set(['event', 'eventinter', 'eventend', 'gatewayx', 'gatewayplus', 'gatewayo', 'initial', 'final', 'forkbar']);
export const labelBelow = (k) => LABEL_BELOW.has(k);
// Beschriftung liegt auf dem Board-Hintergrund statt auf der Füllung der Form
export const labelOutside = (k) => LABEL_BELOW.has(k) || ICON_SHAPES.has(k) || k === 'actor';
const iconSize = (w, h) => Math.min(w, h * ICON_F);

// full = Symbol füllt die ganze Fläche (Vorschau in der Formenauswahl)
function iconBox(x, y, w, h, full) {
  const s = full ? Math.min(w, h) : iconSize(w, h);
  const ix = x + (w - s) / 2, iy = full ? y + (h - s) / 2 : y;
  const X = (u) => ix + u * s, Y = (v) => iy + v * s;
  return { s, X, Y, P: (u, v) => `${r1(X(u))},${r1(Y(v))}` };
}
const circleD = (cx, cy, r) => ellipseD(cx, cy, r, r);
const ellipseD = (cx, cy, rx, ry) => `M${r1(cx - rx)},${r1(cy)} A${r1(rx)},${r1(ry)} 0 1 0 ${r1(cx + rx)},${r1(cy)} A${r1(rx)},${r1(ry)} 0 1 0 ${r1(cx - rx)},${r1(cy)} Z`;
const rectD = (x, y, w, h) => `M${r1(x)},${r1(y)} H${r1(x + w)} V${r1(y + h)} H${r1(x)} Z`;
function rrectD(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${r1(x + r)},${r1(y)} H${r1(x + w - r)} A${r1(r)},${r1(r)} 0 0 1 ${r1(x + w)},${r1(y + r)} V${r1(y + h - r)} A${r1(r)},${r1(r)} 0 0 1 ${r1(x + w - r)},${r1(y + h)} H${r1(x + r)} A${r1(r)},${r1(r)} 0 0 1 ${r1(x)},${r1(y + h - r)} V${r1(y + r)} A${r1(r)},${r1(r)} 0 0 1 ${r1(x + r)},${r1(y)} Z`;
}
const lineD = (x1, y1, x2, y2) => `M${r1(x1)},${r1(y1)} L${r1(x2)},${r1(y2)}`;
// Pfeil: Linie bis kurz vor die Spitze und gefüllte Spitze
function arrowD(x1, y1, x2, y2, size) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => `${r1(x2 - size * Math.cos(a - d))},${r1(y2 - size * Math.sin(a - d))}`;
  return { line: lineD(x1, y1, x2 - Math.cos(a) * size * 0.7, y2 - Math.sin(a) * size * 0.7), head: `M${r1(x2)},${r1(y2)} L${p(0.45)} L${p(-0.45)} Z` };
}
function arrowsU(u, list, size) {
  const out = { line: '', head: '' };
  for (const [a, b, c, d] of list) {
    const r = arrowD(u.X(a), u.Y(b), u.X(c), u.Y(d), size * u.s);
    out.line += r.line + ' ';
    out.head += r.head + ' ';
  }
  return out;
}
// Würfel in Schrägansicht (Umriss und Kanten in einem Pfad; zweipunktige Linien füllen nichts)
function cubeD(u, cx, cy, k) {
  const q = k * 0.87;
  return `M${u.P(cx, cy - k)} L${u.P(cx + q, cy - k / 2)} L${u.P(cx + q, cy + k / 2)} L${u.P(cx, cy + k)} L${u.P(cx - q, cy + k / 2)} L${u.P(cx - q, cy - k / 2)} Z ` +
    `M${u.P(cx, cy)} L${u.P(cx - q, cy - k / 2)} M${u.P(cx, cy)} L${u.P(cx + q, cy - k / 2)} M${u.P(cx, cy)} L${u.P(cx, cy + k)}`;
}
const docD = (x, y, w, h) => {
  const wv = h * 0.1;
  return `M${r1(x)},${r1(y)} H${r1(x + w)} V${r1(y + h - wv)} C${r1(x + w * 0.75)},${r1(y + h - wv * 2.5)} ${r1(x + w * 0.5)},${r1(y + h + wv * 0.5)} ${r1(x)},${r1(y + h - wv)} Z`;
};
const multidocOffset = (w, h) => Math.min(w, h) * 0.06;
// Rack: Höhe des Kopfbereichs (Beschriftung) und des Sockels
const rackHead = (h) => Math.max(18, Math.min(h * 0.1, 40));
const rackBase = (h) => Math.max(5, Math.min(h * 0.035, 12));
const monitorH = (h) => h * 0.78;

// Jede Funktion liefert { main: Umriss (gefüllt), under: [Pfade dahinter], lines: nur Linien, solid: in Linienfarbe gefüllt }
const DRAW = {
  router(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    const a = arrowsU(u, [[0.5, 0.13, 0.5, 0.42], [0.5, 0.87, 0.5, 0.58], [0.4, 0.5, 0.13, 0.5], [0.6, 0.5, 0.87, 0.5]], 0.11);
    return { main: circleD(u.X(0.5), u.Y(0.5), u.s * 0.46), lines: a.line, solid: a.head };
  },
  loadbalancer(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    const a = arrowsU(u, [[0.38, 0.5, 0.86, 0.33], [0.38, 0.5, 0.86, 0.5], [0.38, 0.5, 0.86, 0.67]], 0.1);
    return { main: rrectD(u.X(0.04), u.Y(0.2), u.s * 0.92, u.s * 0.6, u.s * 0.08), lines: lineD(u.X(0.13), u.Y(0.5), u.X(0.38), u.Y(0.5)) + ' ' + a.line, solid: a.head + circleD(u.X(0.38), u.Y(0.5), u.s * 0.035) };
  },
  accesspoint(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    const cx = 0.5, cy = 0.56;
    const arc = (r) => {
      const a0 = (-140 * Math.PI) / 180, a1 = (-40 * Math.PI) / 180;
      return `M${u.P(cx + r * Math.cos(a0), cy + r * Math.sin(a0))} A${r1(r * u.s)},${r1(r * u.s)} 0 0 1 ${u.P(cx + r * Math.cos(a1), cy + r * Math.sin(a1))}`;
    };
    return {
      main: rrectD(u.X(0.14), u.Y(0.66), u.s * 0.72, u.s * 0.2, u.s * 0.06),
      lines: [0.14, 0.27, 0.4].map(arc).join(' '),
      solid: circleD(u.X(cx), u.Y(cy), u.s * 0.045) + ' ' + circleD(u.X(0.26), u.Y(0.76), u.s * 0.025) + ' ' + circleD(u.X(0.34), u.Y(0.76), u.s * 0.025),
    };
  },
  internet(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    const r = 0.46, dy = 0.23, hw = Math.sqrt(r * r - dy * dy);
    return {
      main: circleD(u.X(0.5), u.Y(0.5), u.s * r),
      lines: [lineD(u.X(0.04), u.Y(0.5), u.X(0.96), u.Y(0.5)), lineD(u.X(0.5), u.Y(0.04), u.X(0.5), u.Y(0.96)),
        ellipseD(u.X(0.5), u.Y(0.5), u.s * 0.2, u.s * r), lineD(u.X(0.5 - hw), u.Y(0.5 - dy), u.X(0.5 + hw), u.Y(0.5 - dy)),
        lineD(u.X(0.5 - hw), u.Y(0.5 + dy), u.X(0.5 + hw), u.Y(0.5 + dy))].join(' '),
    };
  },
  gear(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    const pts = [];
    const at = (deg, r) => u.P(0.5 + r * Math.cos((deg * Math.PI) / 180), 0.5 + r * Math.sin((deg * Math.PI) / 180));
    for (let i = 0; i < 8; i++) {
      const a = i * 45;
      pts.push(at(a - 12, 0.35), at(a - 8, 0.46), at(a + 8, 0.46), at(a + 12, 0.35), at(a + 22.5, 0.35));
    }
    return { main: `M${pts.join(' L')} Z`, lines: circleD(u.X(0.5), u.Y(0.5), u.s * 0.14) };
  },
  lock(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    return {
      main: rrectD(u.X(0.18), u.Y(0.44), u.s * 0.64, u.s * 0.48, u.s * 0.07),
      lines: `M${u.P(0.31, 0.44)} V${r1(u.Y(0.29))} A${r1(u.s * 0.19)},${r1(u.s * 0.19)} 0 0 1 ${u.P(0.69, 0.29)} V${r1(u.Y(0.44))}`,
      solid: circleD(u.X(0.5), u.Y(0.62), u.s * 0.06) + ' ' + rectD(u.X(0.475), u.Y(0.63), u.s * 0.05, u.s * 0.14),
    };
  },
  users(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    const body = (x0, x1, yb, ry) => `M${u.P(x0, yb)} A${r1(((x1 - x0) / 2) * u.s)},${r1(ry * u.s)} 0 0 1 ${u.P(x1, yb)} Z`;
    return {
      under: [circleD(u.X(0.66), u.Y(0.3), u.s * 0.12) + ' ' + body(0.44, 0.9, 0.78, 0.3)],
      main: circleD(u.X(0.38), u.Y(0.4), u.s * 0.14) + ' ' + body(0.08, 0.68, 0.94, 0.36),
    };
  },
  pod(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    return { main: cubeD(u, 0.5, 0.5, 0.42) };
  },
  deployment(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    return { under: [cubeD(u, 0.64, 0.36, 0.3)], main: cubeD(u, 0.38, 0.62, 0.3) };
  },
  k8sservice(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    const xs = [0.18, 0.5, 0.82];
    return {
      under: [xs.map((cx) => lineD(u.X(0.5), u.Y(0.3), u.X(cx), u.Y(0.72))).join(' ')],
      main: circleD(u.X(0.5), u.Y(0.22), u.s * 0.15) + ' ' + xs.map((cx) => cubeD(u, cx, 0.78, 0.13)).join(' '),
    };
  },
  ingress(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    const a = arrowsU(u, [[0.04, 0.5, 0.6, 0.5]], 0.12);
    return { main: rrectD(u.X(0.32), u.Y(0.14), u.s * 0.62, u.s * 0.72, u.s * 0.07) + ' ' + cubeD(u, 0.76, 0.5, 0.11), lines: a.line, solid: a.head };
  },
  k8snode(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    return {
      main: rrectD(u.X(0.06), u.Y(0.1), u.s * 0.88, u.s * 0.8, u.s * 0.07) + ' ' + cubeD(u, 0.32, 0.6, 0.15) + ' ' + cubeD(u, 0.68, 0.6, 0.15),
      lines: lineD(u.X(0.06), u.Y(0.28), u.X(0.94), u.Y(0.28)),
      solid: [0.15, 0.22, 0.29].map((cx) => circleD(u.X(cx), u.Y(0.19), u.s * 0.025)).join(' '),
    };
  },
  configmap(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    const rows = [0.42, 0.58, 0.74];
    return {
      main: `M${u.P(0.18, 0.06)} H${r1(u.X(0.64))} L${u.P(0.82, 0.24)} V${r1(u.Y(0.94))} H${r1(u.X(0.18))} Z`,
      lines: `M${u.P(0.64, 0.06)} V${r1(u.Y(0.24))} H${r1(u.X(0.82))} ` + rows.map((v) => lineD(u.X(0.4), u.Y(v), u.X(0.7), u.Y(v))).join(' '),
      solid: rows.map((v) => rectD(u.X(0.27), u.Y(v) - u.s * 0.03, u.s * 0.06, u.s * 0.06)).join(' '),
    };
  },
  secret(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    return {
      main: circleD(u.X(0.3), u.Y(0.5), u.s * 0.2) + ` M${u.P(0.49, 0.45)} H${r1(u.X(0.92))} V${r1(u.Y(0.55))} H${r1(u.X(0.86))} V${r1(u.Y(0.68))} H${r1(u.X(0.78))} V${r1(u.Y(0.55))} H${r1(u.X(0.72))} V${r1(u.Y(0.64))} H${r1(u.X(0.64))} V${r1(u.Y(0.55))} H${r1(u.X(0.49))} Z`,
      lines: circleD(u.X(0.25), u.Y(0.5), u.s * 0.06),
    };
  },
  volume(x, y, w, h, full) {
    const u = iconBox(x, y, w, h, full);
    const x0 = u.X(0.18), x1 = u.X(0.82), y0 = u.Y(0.1), y1 = u.Y(0.9), rx = (x1 - x0) / 2, ry = u.s * 0.1;
    return {
      main: `M${r1(x0)},${r1(y0 + ry)} A${r1(rx)},${r1(ry)} 0 0 1 ${r1(x1)},${r1(y0 + ry)} V${r1(y1 - ry)} A${r1(rx)},${r1(ry)} 0 0 1 ${r1(x0)},${r1(y1 - ry)} Z`,
      lines: `M${r1(x0)},${r1(y0 + ry)} A${r1(rx)},${r1(ry)} 0 0 0 ${r1(x1)},${r1(y0 + ry)} M${r1(x0)},${r1(u.Y(0.5))} A${r1(rx)},${r1(ry)} 0 0 0 ${r1(x1)},${r1(u.Y(0.5))}`,
    };
  },
  // Geräte mit Beschriftung im Gehäuse
  switch(x, y, w, h) {
    const p = Math.max(3, Math.min(h * 0.18, w * 0.06));
    const n = Math.max(3, Math.min(24, Math.floor((w * 0.86 + p * 0.5) / (p * 1.5))));
    const total = n * p + (n - 1) * p * 0.5, x0 = x + (w - total) / 2, y0 = y + h * 0.72 - p / 2;
    let ports = '';
    for (let i = 0; i < n; i++) ports += rectD(x0 + i * p * 1.5, y0, p, p) + ' ';
    return { main: rrectD(x, y, w, h, Math.min(w, h) * 0.08), lines: ports };
  },
  storage(x, y, w, h) {
    const y0 = y + h * 0.52, bh = h * 0.34;
    const n = Math.max(2, Math.min(10, Math.round((w * 0.88) / Math.max(bh * 0.9, 1))));
    const g = w * 0.02, bw = (w * 0.88 - g * (n - 1)) / n, x0 = x + w * 0.06;
    let bays = '', leds = '';
    for (let i = 0; i < n; i++) {
      const bx = x0 + i * (bw + g);
      bays += rectD(bx, y0, bw, bh) + ' ';
      leds += circleD(bx + bw * 0.78, y0 + bh * 0.78, Math.max(1.2, Math.min(bw, bh) * 0.08)) + ' ';
    }
    return { main: rrectD(x, y, w, h, Math.min(w, h) * 0.06), lines: bays, solid: leds };
  },
  rack(x, y, w, h) {
    const hb = rackHead(h), bb = rackBase(h), rw = Math.max(6, Math.min(w * 0.07, 16));
    const top = y + hb, bot = y + h - bb;
    let holes = '';
    const step = 12, n = Math.floor((bot - top - 6) / step), hs = Math.max(1.5, Math.min(rw * 0.25, 3));
    for (let i = 0; i < n; i++) {
      const cy = top + 6 + i * step + step / 2;
      holes += rectD(x + rw / 2 - hs / 2, cy - hs / 2, hs, hs) + ' ' + rectD(x + w - rw / 2 - hs / 2, cy - hs / 2, hs, hs) + ' ';
    }
    return {
      main: rrectD(x, y, w, h, Math.min(w, h) * 0.03),
      lines: `${lineD(x, top, x + w, top)} ${lineD(x, bot, x + w, bot)} ${lineD(x + rw, top, x + rw, bot)} ${lineD(x + w - rw, top, x + w - rw, bot)}`,
      solid: holes,
    };
  },
  desktop(x, y, w, h) {
    const mh = monitorH(h), m = Math.min(w, mh) * 0.05;
    return {
      main: rrectD(x, y, w, mh, Math.min(w, mh) * 0.04) + ' ' + rectD(x + w * 0.44, y + mh, w * 0.12, h * 0.13) + ' ' + rrectD(x + w * 0.28, y + h * 0.91, w * 0.44, h * 0.09, h * 0.03),
      lines: rectD(x + m, y + m, w - m * 2, mh - m * 2),
    };
  },
  mobile(x, y, w, h) {
    return {
      main: rrectD(x, y, w, h, Math.min(w, h) * 0.14),
      lines: rectD(x + w * 0.07, y + h * 0.1, w * 0.86, h * 0.8) + ' ' + lineD(x + w * 0.4, y + h * 0.05, x + w * 0.6, y + h * 0.05),
      solid: circleD(x + w / 2, y + h * 0.95, Math.max(1.5, Math.min(w, h) * 0.035)),
    };
  },
  // Flussdiagramm
  multidoc(x, y, w, h) {
    const d = multidocOffset(w, h);
    return { under: [docD(x + 2 * d, y, w - 2 * d, h - 2 * d), docD(x + d, y + d, w - 2 * d, h - 2 * d)], main: docD(x, y + 2 * d, w - 2 * d, h - 2 * d) };
  },
  display(x, y, w, h) {
    return { main: `M${r1(x)},${r1(y + h / 2)} L${r1(x + w * 0.15)},${r1(y)} H${r1(x + w * 0.85)} A${r1(w * 0.15)},${r1(h / 2)} 0 0 1 ${r1(x + w * 0.85)},${r1(y + h)} H${r1(x + w * 0.15)} Z` };
  },
  internalstorage(x, y, w, h) {
    return { main: rectD(x, y, w, h), lines: lineD(x + w * 0.12, y, x + w * 0.12, y + h) + ' ' + lineD(x, y + h * 0.16, x + w, y + h * 0.16) };
  },
  // UML
  initial(x, y, w, h) {
    const d = ellipseD(x + w / 2, y + h / 2, w / 2, h / 2);
    return { main: d, solid: d };
  },
  final(x, y, w, h) {
    return { main: ellipseD(x + w / 2, y + h / 2, w / 2, h / 2), solid: ellipseD(x + w / 2, y + h / 2, w * 0.3, h * 0.3) };
  },
  forkbar(x, y, w, h) {
    const d = rectD(x, y, w, h);
    return { main: d, solid: d };
  },
  umlclass(x, y, w, h) {
    return { main: rectD(x, y, w, h), lines: lineD(x, y + h * 0.3, x + w, y + h * 0.3) + ' ' + lineD(x, y + h * 0.65, x + w, y + h * 0.65) };
  },
  // BPMN
  event(x, y, w, h) {
    return { main: ellipseD(x + w / 2, y + h / 2, w / 2, h / 2) };
  },
  eventend(x, y, w, h) {
    const t = Math.max(2.5, Math.min(w, h) * 0.08);
    return { main: ellipseD(x + w / 2, y + h / 2, w / 2, h / 2), ring: ellipseD(x + w / 2, y + h / 2, w / 2, h / 2) + ' ' + ellipseD(x + w / 2, y + h / 2, w / 2 - t, h / 2 - t) };
  },
  eventinter(x, y, w, h) {
    const t = Math.max(3, Math.min(w, h) * 0.08);
    return { main: ellipseD(x + w / 2, y + h / 2, w / 2, h / 2), lines: ellipseD(x + w / 2, y + h / 2, w / 2 - t, h / 2 - t) };
  },
  gatewayx(x, y, w, h) {
    const a = 0.34, b = 0.66;
    return { main: diamondD(x, y, w, h), lines: lineD(x + w * a, y + h * a, x + w * b, y + h * b) + ' ' + lineD(x + w * b, y + h * a, x + w * a, y + h * b) };
  },
  gatewayplus(x, y, w, h) {
    return { main: diamondD(x, y, w, h), lines: lineD(x + w / 2, y + h * 0.27, x + w / 2, y + h * 0.73) + ' ' + lineD(x + w * 0.27, y + h / 2, x + w * 0.73, y + h / 2) };
  },
  gatewayo(x, y, w, h) {
    return { main: diamondD(x, y, w, h), lines: ellipseD(x + w / 2, y + h / 2, w * 0.2, h * 0.2) };
  },
};
// Tiefe des Quaders bei UML-Knoten begrenzt, damit große Knoten nicht klobig wirken
const nodeDepth = (w, h) => Math.min(Math.min(w, h) * 0.15, 22);
DRAW.umlnode = (x, y, w, h) => {
  const d = nodeDepth(w, h);
  return { main: `M${r1(x)},${r1(y + d)} H${r1(x + w - d)} V${r1(y + h)} H${r1(x)} Z M${r1(x)},${r1(y + d)} L${r1(x + d)},${r1(y)} H${r1(x + w)} V${r1(y + h - d)} L${r1(x + w - d)},${r1(y + h)} M${r1(x + w - d)},${r1(y + d)} L${r1(x + w)},${r1(y)}` };
};
function diamondD(x, y, w, h) {
  return `M${r1(x + w / 2)},${r1(y)} L${r1(x + w)},${r1(y + h / 2)} L${r1(x + w / 2)},${r1(y + h)} L${r1(x)},${r1(y + h / 2)} Z`;
}

// Zusätzliche Teile einer Form: davor (under) und danach (Linien, gefüllte Details).
// cls: Klasse für gefüllte Flächen (Vorschau in der Formenauswahl)
export function shapeDecor(kind, x, y, w, h, { fill, stroke, sw, dash, full = false, cls = '' }) {
  const f = Object.hasOwn(DRAW, kind) ? DRAW[kind](x, y, w, h, full) : null;
  if (!f) return { before: '', after: '' };
  const c = cls ? T` class="${cls}"` : '';
  const da = dash ? T` stroke-dasharray="${dash}"` : '';
  let before = '', after = '';
  for (const d of f.under || []) before += `<path${c} d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${da} stroke-linejoin="round"/>`;
  if (f.lines) after += `<path d="${f.lines}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (f.solid && stroke !== 'none') after += `<path d="${f.solid}" fill="${stroke}"/>`;
  if (f.ring && stroke !== 'none') after += `<path d="${f.ring}" fill="${stroke}" fill-rule="evenodd"/>`;
  return { before, after };
}

export function shapeGeom(kind, x, y, w, h, full = false) {
  const p = (pts) => `<polygon points="${pts.map(([a, b]) => `${r1(a)},${r1(b)}`).join(' ')}"`;
  switch (kind) {
    case 'roundrect': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) * 0.15}"`;
    case 'pill': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}"`;
    case 'ellipse': return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"`;
    case 'diamond': return p([[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]]);
    case 'triangle': return p([[x + w / 2, y], [x + w, y + h], [x, y + h]]);
    case 'hexagon': return p([[x + w * 0.25, y], [x + w * 0.75, y], [x + w, y + h / 2], [x + w * 0.75, y + h], [x + w * 0.25, y + h], [x, y + h / 2]]);
    case 'parallelogram': return p([[x + w * 0.2, y], [x + w, y], [x + w * 0.8, y + h], [x, y + h]]);
    case 'trapezoid': return p([[x + w * 0.2, y], [x + w * 0.8, y], [x + w, y + h], [x, y + h]]);
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 0.4 : 1;
        pts.push([x + w / 2 + (Math.cos(a) * w * r) / 2, y + h / 2 + (Math.sin(a) * h * r) / 2 + h * 0.05]);
      }
      return p(pts);
    }
    case 'arrow': return p([[x, y + h * 0.25], [x + w * 0.6, y + h * 0.25], [x + w * 0.6, y], [x + w, y + h / 2], [x + w * 0.6, y + h], [x + w * 0.6, y + h * 0.75], [x, y + h * 0.75]]);
    case 'cross': {
      const a = 0.3, b = 0.7;
      return p([[x + w * a, y], [x + w * b, y], [x + w * b, y + h * a], [x + w, y + h * a], [x + w, y + h * b], [x + w * b, y + h * b], [x + w * b, y + h], [x + w * a, y + h], [x + w * a, y + h * b], [x, y + h * b], [x, y + h * a], [x + w * a, y + h * a]]);
    }
    case 'callout': {
      const bh = h * 0.8, r = Math.min(w, bh) * 0.12;
      return `<path d="M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + bh - r} Q${x + w},${y + bh} ${x + w - r},${y + bh} H${x + w * 0.4} L${x + w * 0.2},${y + h} L${x + w * 0.25},${y + bh} H${x + r} Q${x},${y + bh} ${x},${y + bh - r} V${y + r} Q${x},${y} ${x + r},${y} Z"`;
    }
    case 'cylinder': {
      const ry = Math.min(h * 0.12, 30);
      return `<path d="M${x},${y + ry} A${w / 2},${ry} 0 0 1 ${x + w},${y + ry} V${y + h - ry} A${w / 2},${ry} 0 0 1 ${x},${y + h - ry} Z M${x},${y + ry} A${w / 2},${ry} 0 0 0 ${x + w},${y + ry}"`;
    }
    case 'document': {
      const wv = h * 0.1;
      return `<path d="M${x},${y} H${x + w} V${y + h - wv} C${x + w * 0.75},${y + h - wv * 2.5} ${x + w * 0.5},${y + h + wv * 0.5} ${x},${y + h - wv} Z"`;
    }
    case 'cloud': {
      const cx = (f) => x + w * f, cy = (f) => y + h * f;
      return `<path d="M${cx(0.25)},${cy(0.85)} C${cx(0.02)},${cy(0.85)} ${cx(0.0)},${cy(0.5)} ${cx(0.18)},${cy(0.45)} C${cx(0.15)},${cy(0.15)} ${cx(0.45)},${cy(0.05)} ${cx(0.55)},${cy(0.25)} C${cx(0.65)},${cy(0.05)} ${cx(0.92)},${cy(0.15)} ${cx(0.85)},${cy(0.42)} C${cx(1.02)},${cy(0.48)} ${cx(1.0)},${cy(0.85)} ${cx(0.78)},${cy(0.85)} Z"`;
    }
    case 'subprocess': return `<path d="M${x},${y} H${x + w} V${y + h} H${x} Z M${x + w * 0.08},${y} V${y + h} M${x + w * 0.92},${y} V${y + h}"`;
    case 'delay': return `<path d="M${x},${y} H${x + w * 0.6} A${w * 0.4},${h / 2} 0 0 1 ${x + w * 0.6},${y + h} H${x} Z"`;
    case 'note': {
      const f = Math.min(w, h) * 0.18;
      return `<path d="M${x},${y} H${x + w - f} L${x + w},${y + f} V${y + h} H${x} Z M${x + w - f},${y} V${y + f} H${x + w}"`;
    }
    case 'package': return `<path d="M${x},${y} H${x + w * 0.4} V${y + h * 0.18} H${x + w} V${y + h} H${x} Z M${x},${y + h * 0.18} H${x + w * 0.4}"`;
    case 'actor': {
      const cx = x + w / 2, r = Math.min(w * 0.16, h * 0.1), hy = y + r + 1;
      return `<path d="M${cx - r},${hy} A${r},${r} 0 1 0 ${cx + r},${hy} A${r},${r} 0 1 0 ${cx - r},${hy} Z M${cx},${hy + r} V${y + h * 0.5} M${x + w * 0.22},${y + h * 0.3} H${x + w * 0.78} M${cx},${y + h * 0.5} L${x + w * 0.26},${y + h * 0.72} M${cx},${y + h * 0.5} L${x + w * 0.74},${y + h * 0.72}"`;
    }
    case 'server': {
      const r = Math.max(1.5, Math.min(w, h) * 0.035);
      const led = (cy) => `M${x + w * 0.88 - r},${cy} A${r},${r} 0 1 0 ${x + w * 0.88 + r},${cy} A${r},${r} 0 1 0 ${x + w * 0.88 - r},${cy} Z`;
      return `<path d="M${x},${y} H${x + w} V${y + h} H${x} Z M${x},${y + h / 3} H${x + w} M${x},${y + (h * 2) / 3} H${x + w} ${led(y + h / 6)} ${led(y + h / 2)} ${led(y + (h * 5) / 6)}"`;
    }
    case 'queue': {
      const rx = Math.min(w * 0.12, 30);
      return `<path d="M${x + rx},${y} H${x + w - rx} A${rx},${h / 2} 0 0 1 ${x + w - rx},${y + h} H${x + rx} A${rx},${h / 2} 0 0 1 ${x + rx},${y} Z M${x + w - rx},${y} A${rx},${h / 2} 0 0 0 ${x + w - rx},${y + h}"`;
    }
    case 'container': {
      const d = Math.min(w, h) * 0.15;
      return `<path d="M${x},${y + d} H${x + w - d} V${y + h} H${x} Z M${x},${y + d} L${x + d},${y} H${x + w} V${y + h - d} L${x + w - d},${y + h} M${x + w - d},${y + d} L${x + w},${y}"`;
    }
    case 'component': return `<path d="M${x + w * 0.1},${y} H${x + w} V${y + h} H${x + w * 0.1} Z M${x},${y + h * 0.22} H${x + w * 0.2} V${y + h * 0.38} H${x} Z M${x},${y + h * 0.62} H${x + w * 0.2} V${y + h * 0.78} H${x} Z"`;
    case 'browser': {
      const r = Math.max(1.5, Math.min(w, h) * 0.03), by = y + h * 0.075;
      const dot = (cx) => `M${cx - r},${by} A${r},${r} 0 1 0 ${cx + r},${by} A${r},${r} 0 1 0 ${cx - r},${by} Z`;
      return `<path d="M${x},${y} H${x + w} V${y + h} H${x} Z M${x},${y + h * 0.15} H${x + w} ${dot(x + w * 0.05)} ${dot(x + w * 0.1)} ${dot(x + w * 0.15)}"`;
    }
    case 'laptop': return `<path d="M${x + w * 0.1},${y} H${x + w * 0.9} V${y + h * 0.82} H${x + w * 0.1} Z M${x},${y + h * 0.86} H${x + w} L${x + w * 0.95},${y + h} H${x + w * 0.05} Z"`;
    case 'firewall': return `<path d="M${x},${y} H${x + w} V${y + h} H${x} Z M${x},${y + h / 3} H${x + w} M${x},${y + (h * 2) / 3} H${x + w} M${x + w / 2},${y} V${y + h / 3} M${x + w / 4},${y + h / 3} V${y + (h * 2) / 3} M${x + (w * 3) / 4},${y + h / 3} V${y + (h * 2) / 3} M${x + w / 2},${y + (h * 2) / 3} V${y + h}"`;
    case 'manualinput': return p([[x, y + h * 0.25], [x + w, y], [x + w, y + h], [x, y + h]]);
    case 'manualop': return p([[x, y], [x + w, y], [x + w * 0.8, y + h], [x + w * 0.2, y + h]]);
    case 'offpage': return p([[x, y], [x + w, y], [x + w, y + h * 0.7], [x + w / 2, y + h], [x, y + h * 0.7]]);
    case 'send': return p([[x, y], [x + w * 0.85, y], [x + w, y + h / 2], [x + w * 0.85, y + h], [x, y + h]]);
    case 'receive': return p([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x + w * 0.15, y + h / 2]]);
    default:
      if (Object.hasOwn(DRAW, kind)) return `<path d="${DRAW[kind](x, y, w, h, full).main}"`;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"`;
  }
}

// UML-Klasse: Abschnitte (Name, Attribute, Operationen) werden durch Zeilen aus „--“ getrennt.
// Der Name steht fett und mittig, Stereotypen wie «interface» normal darüber; der letzte Abschnitt füllt den Rest.
export const splitClassText = (text) => String(text || '').split('\n').reduce((acc, l) => {
  if (/^\s*-{2,}\s*$/.test(l)) acc.push([]);
  else acc[acc.length - 1].push(l);
  return acc;
}, [[]]);

function umlClassSvg(el, x, y, w, h, outline, stroke, sw, color) {
  const size = Number(el.fontSize) || 14, lh = size * LH, pad = 8, padY = 6;
  const secs = splitClassText(el.text);
  while (secs.length < 3) secs.push([]);
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${outline}`;
  let cy = y, seps = '';
  secs.forEach((sec, i) => {
    const name = i === 0;
    const lines = [];
    for (const l of sec) {
      const stereo = name && /^\s*(«|<<)/.test(l);
      for (const t of wrap(l, w - pad * 2, size, name && !stereo, el.italic)) lines.push({ t, bold: name && !stereo });
    }
    const last = i === secs.length - 1;
    const sh = Math.max(1, lines.length) * lh + padY * 2;
    lines.forEach((ln, k) => {
      const ty = cy + padY + k * lh;
      if (ty + lh > y + h + 0.5) return;
      out += textSvg({ x: x + pad, y: ty, w: w - pad * 2, h: lh },
        { size, lines: [ln.t], bold: ln.bold || (!name && !!el.bold), italic: !!el.italic }, { color, align: name ? 'center' : 'left', valign: 'top', underline: el.underline, strike: el.strike });
    });
    cy += sh;
    if (!last && cy < y + h - 1) seps += lineD(x, cy, x + w, cy) + ' ';
  });
  if (seps) out += `<path d="${seps}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
  return out;
}

export function shapeTextBox(kind, x, y, w, h, pad = 10) {
  let ix = 0, iy = 0, iw = 1, ih = 1;
  // Kleine Formen (BPMN-Ereignisse, Gateways, Start/Ende): Beschriftung wie üblich unter der Form
  if (LABEL_BELOW.has(kind)) {
    const bw = Math.max(w, 160);
    return { x: x + w / 2 - bw / 2, y: y + h + 4, w: bw, h: 60 };
  }
  // Symbole: Text im Streifen unter dem Symbol
  if (ICON_SHAPES.has(kind)) {
    const s = iconSize(w, h);
    return { x: x + 2, y: y + s + 2, w: Math.max(4, w - 4), h: Math.max(4, h - s - 4) };
  }
  switch (kind) {
    case 'ellipse': case 'cloud': ix = 0.15; iy = 0.15; iw = 0.7; ih = 0.7; break;
    case 'diamond': ix = 0.22; iy = 0.22; iw = 0.56; ih = 0.56; break;
    case 'triangle': ix = 0.25; iy = 0.45; iw = 0.5; ih = 0.5; break;
    case 'hexagon': ix = 0.15; iw = 0.7; break;
    case 'parallelogram': case 'trapezoid': ix = 0.18; iw = 0.64; break;
    case 'star': ix = 0.3; iy = 0.35; iw = 0.4; ih = 0.4; break;
    case 'arrow': iy = 0.25; ih = 0.5; iw = 0.8; break;
    case 'callout': ih = 0.8; break;
    case 'cross': ix = 0.3; iy = 0.3; iw = 0.4; ih = 0.4; break;
    case 'cylinder': iy = 0.18; ih = 0.78; break;
    case 'document': ih = 0.85; break;
    case 'subprocess': ix = 0.08; iw = 0.84; break;
    case 'delay': iw = 0.85; break;
    case 'note': iw = 0.85; break;
    case 'package': iy = 0.18; ih = 0.82; break;
    case 'actor': iy = 0.74; ih = 0.26; ix = -0.1; iw = 1.2; pad = 2; break;
    case 'server': ix = 0.04; iw = 0.76; iy = 1 / 3; ih = 1 / 3; pad = 4; break;
    case 'queue': ix = 0.1; iw = 0.66; break;
    case 'container': iy = 0.15; ih = 0.85; iw = 0.85; break;
    case 'component': ix = 0.2; iw = 0.8; break;
    case 'browser': iy = 0.15; ih = 0.85; break;
    case 'laptop': ix = 0.1; iw = 0.8; ih = 0.82; break;
    case 'firewall': iy = 1 / 3; ih = 1 / 3; pad = 4; break;
    case 'switch': ih = 0.58; pad = 6; break;
    case 'storage': ih = 0.52; pad = 6; break;
    case 'rack': ih = rackHead(h) / h; pad = 3; break;
    case 'desktop': ih = monitorH(h) / h; pad = Math.min(w, monitorH(h)) * 0.05 + 4; break;
    case 'mobile': ix = 0.07; iw = 0.86; iy = 0.1; ih = 0.8; pad = 4; break;
    case 'multidoc': {
      const d = multidocOffset(w, h);
      return shapeTextBox('document', x, y + 2 * d, w - 2 * d, h - 2 * d, pad);
    }
    case 'manualinput': iy = 0.25; ih = 0.75; break;
    case 'manualop': ix = 0.15; iw = 0.7; break;
    case 'offpage': ih = 0.7; break;
    case 'display': ix = 0.12; iw = 0.76; break;
    case 'internalstorage': ix = 0.12; iw = 0.88; iy = 0.16; ih = 0.84; break;
    case 'send': iw = 0.85; break;
    case 'receive': ix = 0.15; iw = 0.85; break;
    case 'umlnode': iy = nodeDepth(w, h) / h; ih = 1 - iy; iw = 1 - nodeDepth(w, h) / w; break;
  }
  return { x: x + w * ix + pad, y: y + h * iy + pad, w: Math.max(4, w * iw - pad * 2), h: Math.max(4, h * ih - pad * 2) };
}

/* ---------------- Verbindungen ---------------- */

/* ---------------- Absicherung ---------------- */

// Elemente stammen von anderen Teilnehmenden oder aus Importen. Alles, was in SVG-Attribute geschrieben wird,
// muss eine echte Zahl bzw. eine gültige Farbe sein – sonst könnte Markup eingeschleust werden.
const COLOR_RE = /^(#[0-9a-f]{3,8}|transparent|none|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\))$/i;
const fin = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const SHAPE_KEYS = new Set(SHAPES.map(([k]) => k));

export function safeEl(el) {
  const o = { ...el };
  for (const k of ['x', 'y', 'w', 'h', 'strokeWidth', 'rows', 'cols', 'opacity']) if (k in o) o[k] = fin(o[k]);
  if (o.fontSize != null && o.fontSize !== 'auto') o.fontSize = fin(o.fontSize) || 16;
  for (const k of ['fill', 'stroke', 'textColor', 'color', 'headerFill', 'borderColor']) {
    if (!(k in o)) continue;
    if (typeof o[k] === 'string' && COLOR_RE.test(o[k].trim())) o[k] = o[k].trim();
    else delete o[k];
  }
  if (o.type === 'shape' && !SHAPE_KEYS.has(o.shape)) o.shape = 'rect';
  if (o.type === 'pen') o.points = Array.isArray(o.points) ? o.points.map((p) => (p && p.length > 2 ? [fin(p[0]), fin(p[1]), fin(p[2])] : [fin(p && p[0]), fin(p && p[1])])) : [];
  if (o.type === 'image' && o.crop) o.crop = { x: fin(o.crop.x), y: fin(o.crop.y), w: fin(o.crop.w) || 1, h: fin(o.crop.h) || 1 };
  if (o.type === 'connector') {
    const anchor = (e) => (Number.isFinite(Number(e.ax)) && Number.isFinite(Number(e.ay)) ? { ax: Math.max(-1, Math.min(1, Number(e.ax))), ay: Math.max(-1, Math.min(1, Number(e.ay))) } : {});
    const end = (e) => (e && e.id ? { id: String(e.id), side: e.side, ...anchor(e) } : { x: fin(e && e.x), y: fin(e && e.y), side: e && e.side });
    o.from = end(o.from);
    o.to = end(o.to);
    o.waypoints = Array.isArray(o.waypoints) ? o.waypoints.slice(0, 100).map((p) => ({ x: fin(p && p.x), y: fin(p && p.y) })) : [];
  }
  if (o.type === 'table') {
    o.rows = Math.max(1, Math.min(200, Math.round(o.rows) || 1));
    o.cols = Math.max(1, Math.min(50, Math.round(o.cols) || 1));
    // Zellformate: nur bekannte Felder, Farben geprüft (werden in SVG-Attribute geschrieben)
    if (Array.isArray(o.styles)) {
      o.styles = o.styles.map((row) => (Array.isArray(row) ? row.map((st) => {
        if (!st || typeof st !== 'object') return null;
        const c = {};
        for (const k of ['b', 'i', 'u', 's']) if (st[k] !== undefined) c[k] = !!st[k];
        if (['left', 'center', 'right'].includes(st.al)) c.al = st.al;
        if (['top', 'middle', 'bottom'].includes(st.va)) c.va = st.va;
        if (Number(st.fs) > 0) c.fs = Math.min(200, Number(st.fs));
        for (const k of ['c', 'bg']) if (typeof st[k] === 'string' && COLOR_RE.test(st[k].trim())) c[k] = st[k].trim();
        return c;
      }) : []));
    } else delete o.styles;
  }
  return o;
}

export function elBounds(el, get) {
  if (el.type === 'connector') {
    const g = connectorGeom(el, get);
    return g ? g.bbox : { x: 0, y: 0, w: 0, h: 0 };
  }
  if (el.type === 'comment') return { x: fin(el.x), y: fin(el.y) - 30, w: 30, h: 30 };
  return { x: fin(el.x), y: fin(el.y), w: fin(el.w), h: fin(el.h) };
}

// Verbindungen, deren Ziel nicht (mehr) existiert, haben keine Geometrie
export function isOrphan(el, get) {
  return el.type === 'connector' && !connectorGeom(el, get);
}

const SIDE_VEC = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

export function sidePoint(b, side) {
  switch (side) {
    case 'top': return { x: b.x + b.w / 2, y: b.y };
    case 'bottom': return { x: b.x + b.w / 2, y: b.y + b.h };
    case 'left': return { x: b.x, y: b.y + b.h / 2 };
    default: return { x: b.x + b.w, y: b.y + b.h / 2 };
  }
}

function autoSide(b, toward) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const dx = (toward.x - cx) / Math.max(b.w, 1), dy = (toward.y - cy) / Math.max(b.h, 1);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

// Schnittpunkt eines Strahls von der Mitte in Richtung (ax, ay) – normiert auf die halbe Breite/Höhe – mit dem Umriss
const ROUND_SHAPES = new Set(['ellipse', 'cloud', 'initial', 'final', 'event', 'eventend', 'eventinter']);

// Umrisse vieleckiger Formen in normierten Koordinaten (−1 … 1), passend zu shapeGeom()
const STAR = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.4 : 1;
  return [Math.cos(a) * r, Math.sin(a) * r + 0.1];
});
const POLYGONS = {
  diamond: [[0, -1], [1, 0], [0, 1], [-1, 0]],
  triangle: [[0, -1], [1, 1], [-1, 1]],
  hexagon: [[-0.5, -1], [0.5, -1], [1, 0], [0.5, 1], [-0.5, 1], [-1, 0]],
  parallelogram: [[-0.6, -1], [1, -1], [0.6, 1], [-1, 1]],
  trapezoid: [[-0.6, -1], [0.6, -1], [1, 1], [-1, 1]],
  arrow: [[-1, -0.5], [0.2, -0.5], [0.2, -1], [1, 0], [0.2, 1], [0.2, 0.5], [-1, 0.5]],
  cross: [[-0.4, -1], [0.4, -1], [0.4, -0.4], [1, -0.4], [1, 0.4], [0.4, 0.4], [0.4, 1], [-0.4, 1], [-0.4, 0.4], [-1, 0.4], [-1, -0.4], [-0.4, -0.4]],
  star: STAR,
  manualinput: [[-1, -0.5], [1, -1], [1, 1], [-1, 1]],
  manualop: [[-1, -1], [1, -1], [0.6, 1], [-0.6, 1]],
  offpage: [[-1, -1], [1, -1], [1, 0.4], [0, 1], [-1, 0.4]],
  send: [[-1, -1], [0.7, -1], [1, 0], [0.7, 1], [-1, 1]],
  receive: [[-1, -1], [1, -1], [1, 1], [-1, 1], [-0.7, 0]],
};
POLYGONS.gatewayx = POLYGONS.gatewayplus = POLYGONS.gatewayo = POLYGONS.diamond;

// Abstand k entlang des Strahls (0,0) + k·(dx,dy) bis zum ersten Schnitt mit dem Vieleck
function rayPolygon(poly, dx, dy) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    const ex = x2 - x1, ey = y2 - y1;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const k = (x1 * ey - y1 * ex) / den;
    const u = (x1 * dy - y1 * dx) / den;
    if (k > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && k < best) best = k;
  }
  return Number.isFinite(best) ? best : 1;
}

// Punkt auf dem tatsächlichen Umriss in Richtung (ax, ay) von der Mitte aus
export function outlinePoint(t, ax, ay) {
  if (!ax && !ay) return { x: t.x + t.w / 2, y: t.y + t.h / 2 };
  let k;
  if (Object.hasOwn(POLYGONS, t.shape)) k = rayPolygon(POLYGONS[t.shape], ax, ay);
  else if (ROUND_SHAPES.has(t.shape)) k = 1 / (Math.hypot(ax, ay) || 1);
  else k = 1 / (Math.max(Math.abs(ax), Math.abs(ay)) || 1);
  return { x: t.x + t.w / 2 + (ax * k * t.w) / 2, y: t.y + t.h / 2 + (ay * k * t.h) / 2 };
}

// Mitte einer Seite – auf dem tatsächlichen Umriss (bei Dreiecken z. B. auf der Schräge)
export function sideAnchor(t, side) {
  const v = SIDE_VEC[side];
  return outlinePoint(t, v[0], v[1]);
}

// Seite, in deren Richtung ein Andockpunkt zeigt (bestimmt die Austrittsrichtung bei Kurven und Winkeln)
export function anchorSide(ax, ay) {
  if (Math.abs(ax) >= Math.abs(ay)) return ax >= 0 ? 'right' : 'left';
  return ay >= 0 ? 'bottom' : 'top';
}

function endTarget(end, get) {
  if (end && end.id) {
    const t = get(end.id);
    if (t && t.type !== 'connector') return { x: fin(t.x), y: fin(t.y), w: fin(t.w), h: fin(t.h), shape: t.type === 'shape' ? t.shape : t.type === 'sticky' ? 'rect' : t.type };
  }
  return null;
}

const hasAnchor = (end) => end && Number.isFinite(end.ax) && Number.isFinite(end.ay);

// Lage eines angedockten Endes: fester Punkt auf dem Umriss, feste Seitenmitte oder automatisch (zur Gegenseite)
function attach(end, t, toward) {
  if (hasAnchor(end)) return { p: outlinePoint(t, end.ax, end.ay), s: anchorSide(end.ax, end.ay), fixed: true };
  if (SIDE_VEC[end.side]) return { p: sideAnchor(t, end.side), s: end.side, fixed: true };
  const s = autoSide(t, toward);
  return { p: sideAnchor(t, s), s, fixed: false };
}

function centerOf(end, get) {
  const t = endTarget(end, get);
  if (t) return { x: t.x + t.w / 2, y: t.y + t.h / 2 };
  return { x: fin(end?.x), y: fin(end?.y) };
}

function freeSide(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

export function waypointsOf(el) {
  return Array.isArray(el.waypoints) ? el.waypoints.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)) : [];
}

export function connectorGeom(el, get) {
  const t1 = endTarget(el.from, get), t2 = endTarget(el.to, get);
  // Verbindung zu einem gelöschten Element
  if ((el.from && el.from.id && !t1) || (el.to && el.to.id && !t2)) return null;
  const wps = waypointsOf(el);
  const c1 = centerOf(el.from, get), c2 = centerOf(el.to, get);
  // Automatische Seiten richten sich nach dem nächsten Knickpunkt bzw. dem anderen Ende
  const toward1 = wps[0] || c2, toward2 = wps[wps.length - 1] || c1;
  let a1 = t1 ? attach(el.from, t1, toward1) : null;
  let a2 = t2 ? attach(el.to, t2, a1 && !wps.length ? a1.p : toward2) : null;
  if (a1 && !a1.fixed && a2 && !wps.length) a1 = attach(el.from, t1, a2.p);
  const p1 = a1 ? a1.p : c1, p2 = a2 ? a2.p : c2;
  const s1 = a1 ? a1.s : freeSide(p1, wps[0] || p2);
  const s2 = a2 ? a2.s : freeSide(p2, wps[wps.length - 1] || p1);

  let d, pts, poly, startDir, endDir;
  const routing = el.routing || 'curve';
  if (routing === 'straight') {
    pts = [p1, ...wps, p2];
    poly = pts;
    d = 'M' + pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(' L');
  } else if (routing === 'elbow') {
    pts = elbowRoute(p1, s1, wps, p2, s2);
    poly = pts;
    d = 'M' + pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(' L');
  } else {
    // Kurve durch alle Knickpunkte (Catmull-Rom), Enden treten senkrecht aus der Andockseite aus
    const keys = [p1, ...wps, p2];
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const k = Math.max(30, (wps.length ? Math.hypot(keys[1].x - p1.x, keys[1].y - p1.y) : dist) * 0.4);
    const k2 = Math.max(30, (wps.length ? Math.hypot(p2.x - keys[keys.length - 2].x, p2.y - keys[keys.length - 2].y) : dist) * 0.4);
    const v1 = SIDE_VEC[s1], v2 = SIDE_VEC[s2];
    const segs = [];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      let cpa, cpb;
      if (i === 0) cpa = { x: a.x + v1[0] * k, y: a.y + v1[1] * k };
      else {
        const prev = keys[i - 1];
        cpa = { x: a.x + (b.x - prev.x) / 6, y: a.y + (b.y - prev.y) / 6 };
      }
      if (i === keys.length - 2) cpb = { x: b.x + v2[0] * k2, y: b.y + v2[1] * k2 };
      else {
        const next = keys[i + 2];
        cpb = { x: b.x - (next.x - a.x) / 6, y: b.y - (next.y - a.y) / 6 };
      }
      segs.push([a, cpa, cpb, b]);
    }
    d = `M${r1(p1.x)},${r1(p1.y)}` + segs.map(([, ca, cb, b]) => ` C${r1(ca.x)},${r1(ca.y)} ${r1(cb.x)},${r1(cb.y)} ${r1(b.x)},${r1(b.y)}`).join('');
    pts = [p1, ...segs.flatMap(([, ca, cb, b]) => [ca, cb, b])];
    poly = [p1];
    for (const [a, ca, cb, b] of segs) {
      for (let i = 1; i <= 16; i++) {
        const t = i / 16, mt = 1 - t;
        poly.push({
          x: mt ** 3 * a.x + 3 * mt * mt * t * ca.x + 3 * mt * t * t * cb.x + t ** 3 * b.x,
          y: mt ** 3 * a.y + 3 * mt * mt * t * ca.y + 3 * mt * t * t * cb.y + t ** 3 * b.y,
        });
      }
    }
    const first = segs[0], last = segs[segs.length - 1];
    startDir = [p1.x - first[1].x, p1.y - first[1].y];
    endDir = [p2.x - last[2].x, p2.y - last[2].y];
  }
  const n = pts.length;
  if (!startDir) startDir = [pts[0].x - pts[1].x, pts[0].y - pts[1].y];
  if (!endDir) endDir = [pts[n - 1].x - pts[n - 2].x, pts[n - 1].y - pts[n - 2].y];
  const lp = Number.isFinite(Number(el.labelPos)) ? Math.min(0.98, Math.max(0.02, Number(el.labelPos))) : 0.5;
  const mid = pointAlong(poly, lp);
  const bbox = unionRect([...pts, ...poly].map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })));
  return { p1, p2, s1, s2, d, startDir, endDir, mid, bbox, poly, keys: [p1, ...wps, p2] };
}

// Rechtwinklige Führung: verläuft durch alle Knickpunkte und tritt senkrecht aus den Andockseiten aus
function elbowRoute(p1, s1, wps, p2, s2) {
  if (!wps.length) return elbowPoints(p1, s1, p2, s2);
  const off = 24;
  const a = { x: p1.x + SIDE_VEC[s1][0] * off, y: p1.y + SIDE_VEC[s1][1] * off };
  const b = { x: p2.x + SIDE_VEC[s2][0] * off, y: p2.y + SIDE_VEC[s2][1] * off };
  const pts = [p1, a];
  let horiz = s1 === 'left' || s1 === 'right';
  const chain = [...wps, b];
  for (let i = 0; i < chain.length; i++) {
    const prev = pts[pts.length - 1], q = chain[i];
    const last = i === chain.length - 1;
    // letzter Abschnitt: so abbiegen, dass das Ende in Richtung der Zielseite verläuft
    if (last) horiz = !(s2 === 'left' || s2 === 'right');
    pts.push(horiz ? { x: q.x, y: prev.y } : { x: prev.x, y: q.y });
    pts.push(q);
    horiz = !horiz;
  }
  pts.push(p2);
  return pts.filter((p, i) => i === 0 || Math.abs(p.x - pts[i - 1].x) > 0.1 || Math.abs(p.y - pts[i - 1].y) > 0.1);
}

function elbowPoints(p1, s1, p2, s2) {
  const off = 24;
  const a = { x: p1.x + SIDE_VEC[s1][0] * off, y: p1.y + SIDE_VEC[s1][1] * off };
  const b = { x: p2.x + SIDE_VEC[s2][0] * off, y: p2.y + SIDE_VEC[s2][1] * off };
  const h1 = s1 === 'left' || s1 === 'right';
  const h2 = s2 === 'left' || s2 === 'right';
  let middle;
  if (h1 && h2) {
    const mx = (a.x + b.x) / 2;
    middle = [{ x: mx, y: a.y }, { x: mx, y: b.y }];
  } else if (!h1 && !h2) {
    const my = (a.y + b.y) / 2;
    middle = [{ x: a.x, y: my }, { x: b.x, y: my }];
  } else if (h1) middle = [{ x: b.x, y: a.y }];
  else middle = [{ x: a.x, y: b.y }];
  const pts = [p1, a, ...middle, b, p2];
  return pts.filter((p, i) => i === 0 || Math.abs(p.x - pts[i - 1].x) > 0.1 || Math.abs(p.y - pts[i - 1].y) > 0.1);
}

// Punkt bei Anteil t (0…1) der Länge eines Linienzugs
export function pointAlong(pts, t) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let rest = total * t;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (rest <= seg && seg > 0) {
      const k = rest / seg;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
    }
    rest -= seg;
  }
  return pts[pts.length - 1] || { x: 0, y: 0 };
}

// Anteil (0…1) der Länge, an dem ein Punkt am nächsten am Linienzug liegt
export function projectOnPath(pts, p) {
  let total = 0, best = Infinity, bestAt = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy, len = Math.sqrt(len2);
    const k = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    const dd = Math.hypot(a.x + dx * k - p.x, a.y + dy * k - p.y);
    if (dd < best) {
      best = dd;
      bestAt = total + len * k;
    }
    total += len;
  }
  return { t: total ? bestAt / total : 0.5, dist: best };
}

/* ---------------- Linienenden ---------------- */

export const ARROW_HEADS = [
  ['none', T('Ohne')], ['arrow', T('Pfeil')], ['open', T('Pfeil offen')], ['triangle', T('Dreieck hohl')], ['diamond', T('Raute')],
  ['diamondFilled', T('Raute gefüllt')], ['circle', T('Kreis')], ['bar', T('Querstrich')], ['crow', T('Krähenfuß (n)')],
];
const HEAD_KEYS = new Set(ARROW_HEADS.map(([k]) => k));

// Ältere Boards speichern true/false
export function headType(v, def) {
  if (v === true) return 'arrow';
  if (v === false) return 'none';
  if (v == null) return def;
  return HEAD_KEYS.has(v) ? v : def;
}

function arrowHead(kind, tip, dir, size, color, bg, sw) {
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / len, uy = dir[1] / len;
  const px = -uy, py = ux;
  const P = (along, side) => `${r1(tip.x - ux * along + px * side)},${r1(tip.y - uy * along + py * side)}`;
  const w = size * 0.55;
  switch (kind) {
    case 'arrow': return `<polygon points="${P(0, 0)} ${P(size, w)} ${P(size, -w)}" fill="${color}"/>`;
    case 'open': return `<polyline points="${P(size, w)} ${P(0, 0)} ${P(size, -w)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'triangle': return `<polygon points="${P(0, 0)} ${P(size, w)} ${P(size, -w)}" fill="${bg}" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    case 'diamond': case 'diamondFilled':
      return `<polygon points="${P(0, 0)} ${P(size * 0.8, w * 0.8)} ${P(size * 1.6, 0)} ${P(size * 0.8, -w * 0.8)}" fill="${kind === 'diamond' ? bg : color}" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    case 'circle': {
      const r = size * 0.4;
      return `<circle cx="${r1(tip.x - ux * r)}" cy="${r1(tip.y - uy * r)}" r="${r1(r)}" fill="${bg}" stroke="${color}" stroke-width="${sw}"/>`;
    }
    case 'bar': return `<polyline points="${P(size * 0.6, w)} ${P(size * 0.6, -w)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
    case 'crow': return `<polyline points="${P(0, w)} ${P(size, 0)} ${P(0, -w)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${P(size * 1.25, w)} ${P(size * 1.25, -w)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  return '';
}

/* ---------------- Elemente ---------------- */

export function penPath(points) {
  if (!points || !points.length) return '';
  if (points.length === 1) return `M${points[0][0]},${points[0][1]} l0.01,0`;
  let d = `M${r1(points[0][0])},${r1(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i][0] + points[i + 1][0]) / 2, my = (points[i][1] + points[i + 1][1]) / 2;
    d += ` Q${r1(points[i][0])},${r1(points[i][1])} ${r1(mx)},${r1(my)}`;
  }
  const l = points[points.length - 1];
  return d + ` L${r1(l[0])},${r1(l[1])}`;
}

// Linie mit Stiftdruck: gefüllter Umriss, dessen Breite dem Druck folgt
export function pressurePath(points, sw) {
  if (points.length < 2) return penPath(points);
  const left = [], right = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const r = sw * (0.2 + (p[2] ?? 0.5) * 1.1) / 2;
    left.push([p[0] - (dy / len) * r, p[1] + (dx / len) * r]);
    right.unshift([p[0] + (dy / len) * r, p[1] - (dx / len) * r]);
  });
  return `${penPath(left)} ${penPath(right).replace(/^M/, 'L')} Z`;
}

/* ---------------- Diagramme aus Tabellen ---------------- */

// „1.234,5“, „1,234.5“, „12 %“, „3 €“ – Zahlen, wie sie in Tabellen stehen
export function cellNumber(v) {
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

export function chartData(table) {
  const rows = (table.cells || []).filter((r) => r.some((c) => String(c).trim()));
  if (rows.length < 2) return null;
  const head = rows[0], body = rows.slice(1);
  const series = [];
  for (let c = 1; c < head.length; c++) {
    const values = body.map((r) => cellNumber(r[c]));
    if (values.some((v) => v !== null)) series.push({ name: String(head[c] || ''), values: values.map((v) => v ?? 0) });
  }
  return series.length ? { labels: body.map((r) => String(r[0] ?? '')), series } : null;
}

// Teilexporte (Auswahl, Folien) enthalten die Tabelle eines Diagramms nicht unbedingt: Das Board kennt sie trotzdem
let lookup = () => null;
export function setElementLookup(fn) {
  lookup = fn;
}

const CHART_COLORS = ['#4262ff', '#12b886', '#f59f00', '#e64980', '#7048e8', '#1098ad', '#f03e3e', '#5c940d'];
const chartColor = (i) => CHART_COLORS[i % CHART_COLORS.length];
const chartText = (x, y, text, { size = 12, anchor = 'start', color = '#495057', bold = false } = {}) => `<text x="${r1(x)}" y="${r1(y)}" font-family="${esc(FONT)}" font-size="${size}"${bold ? ' font-weight="bold"' : ''} text-anchor="${anchor}" fill="${color}">${esc(String(text))}</text>`;
const fmtNum = (n) => (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString() : String(Math.round(n * 100) / 100));

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

function chartLegend(names, x, y, w) {
  let out = '', cx = x, cy = y;
  names.forEach((n, i) => {
    const tw = measure(n, 12) + 26;
    if (cx + tw > x + w && cx > x) {
      cx = x;
      cy += 18;
    }
    out += `<rect x="${r1(cx)}" y="${r1(cy - 9)}" width="11" height="11" rx="2" fill="${chartColor(i)}"/>` + chartText(cx + 15, cy, n);
    cx += tw;
  });
  return out;
}

function pieSvg(data, x, y, w, h) {
  const s = data.series[0];
  const values = s.values.map((v) => Math.max(0, v));
  const sum = values.reduce((a, v) => a + v, 0);
  if (!sum) return chartText(x + w / 2, y + h / 2, T('Torten brauchen positive Werte'), { size: 14, anchor: 'middle', color: '#868e96' });
  const r = Math.max(10, Math.min(w * 0.55, h) / 2 - 6);
  const cx = x + r + 6, cy = y + h / 2;
  let out = '', a = -Math.PI / 2;
  values.forEach((v, i) => {
    const b = a + (v / sum) * Math.PI * 2;
    if (v >= sum) out += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${chartColor(i)}"/>`;
    else if (v > 0) out += `<path d="M${r1(cx)},${r1(cy)} L${r1(cx + r * Math.cos(a))},${r1(cy + r * Math.sin(a))} A${r1(r)},${r1(r)} 0 ${b - a > Math.PI ? 1 : 0} 1 ${r1(cx + r * Math.cos(b))},${r1(cy + r * Math.sin(b))} Z" fill="${chartColor(i)}" stroke="#ffffff" stroke-width="1.5"/>`;
    a = b;
  });
  const lx = cx + r + 16;
  data.labels.slice(0, 14).forEach((l, i) => {
    const ly = y + 14 + i * 20;
    out += `<rect x="${r1(lx)}" y="${r1(ly - 10)}" width="11" height="11" rx="2" fill="${chartColor(i)}"/>` + chartText(lx + 16, ly, `${l} (${Math.round((values[i] / sum) * 100)} %)`);
  });
  return out;
}

function axisChart(el, data, x, y, w, h) {
  const legend = data.series.length > 1 ? 24 : 0;
  const left = 46, bottom = 24, top = 8;
  const px = x + left, pw = Math.max(10, w - left - 8), py = y + top, ph = Math.max(10, h - top - bottom - legend);
  const all = data.series.flatMap((s) => s.values);
  const low = Math.min(0, ...all);
  const max = niceMax(Math.max(...all, 0));
  const range = max - low || 1;
  const yOf = (v) => py + ph - ((v - low) / range) * ph;
  let out = '';
  for (let i = 0; i <= 4; i++) {
    const v = low + (range * i) / 4, ly = yOf(v);
    out += `<line x1="${r1(px)}" y1="${r1(ly)}" x2="${r1(px + pw)}" y2="${r1(ly)}" stroke="#e9ecef"/>` + chartText(px - 6, ly + 4, fmtNum(v), { size: 11, anchor: 'end' });
  }
  const n = data.labels.length, band = pw / n;
  const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(pw / 70))));
  data.labels.forEach((l, i) => {
    if (i % step === 0) out += chartText(px + band * (i + 0.5), py + ph + 16, String(l).slice(0, 14), { size: 11, anchor: 'middle' });
  });
  if (el.chartKind === 'line') {
    data.series.forEach((s, si) => {
      const pts = s.values.map((v, i) => [px + band * (i + 0.5), yOf(v)]);
      out += `<polyline points="${pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(' ')}" fill="none" stroke="${chartColor(si)}" stroke-width="2.5" stroke-linejoin="round"/>`;
      out += pts.map((p) => `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="3.5" fill="${chartColor(si)}"/>`).join('');
    });
  } else {
    const barW = Math.max(1, (band * 0.72) / data.series.length);
    const zero = yOf(0);
    data.series.forEach((s, si) => {
      s.values.forEach((v, i) => {
        const bx = px + band * 0.14 + band * i + barW * si, by = yOf(Math.max(v, 0)), bh = Math.abs(yOf(v) - zero);
        out += `<rect x="${r1(bx)}" y="${r1(by)}" width="${r1(Math.max(1, barW - 1))}" height="${r1(Math.max(0.5, bh))}" rx="2" fill="${chartColor(si)}"/>`;
      });
    });
  }
  if (legend) out += chartLegend(data.series.map((s) => s.name), x + left, y + h - 6, pw);
  return out;
}

function chartSvg(el, get) {
  const { x = 0, y = 0, w = 0, h = 0 } = el;
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="#e3e3e3" filter="url(#shadow-sm)"/>`;
  const table = el.sourceId ? get(el.sourceId) || lookup(el.sourceId) : null;
  const data = table && table.type === 'table' && !table.hidden ? chartData(table) : null;
  if (!data) return out + chartText(x + w / 2, y + h / 2, T('Keine Zahlen in der Tabelle'), { size: 14, anchor: 'middle', color: '#868e96' });
  let top = y + 12;
  if (el.title) {
    out += chartText(x + 14, y + 26, el.title, { size: 16, bold: true, color: '#1a1a1a' });
    top = y + 38;
  }
  const area = [x + 10, top, w - 20, y + h - top - 8];
  return out + (el.chartKind === 'pie' ? pieSvg(data, ...area) : axisChart(el, data, ...area));
}

/* ---------------- Swimlanes und Status der Freigabe ---------------- */

function lanesSvg(el) {
  const { x, y, w, h } = el;
  const n = el.lanes.length;
  const lh = h / n, head = 44;
  let out = `<line x1="${x + head}" y1="${y}" x2="${x + head}" y2="${y + h}" stroke="#adb5bd"/>`;
  el.lanes.forEach((l, i) => {
    const ly = y + lh * i, cx = x + head / 2, cy = ly + lh / 2;
    if (i) out += `<line x1="${x}" y1="${r1(ly)}" x2="${x + w}" y2="${r1(ly)}" stroke="#adb5bd"/>`;
    const fs = Math.min(15, Math.max(11, lh / Math.max(8, String(l.title).length)));
    out += `<text transform="rotate(-90 ${r1(cx)} ${r1(cy)})" x="${r1(cx)}" y="${r1(cy + fs / 3)}" text-anchor="middle" font-family="${esc(FONT)}" font-size="${r1(fs)}" font-weight="bold" fill="#495057">${esc(l.title)}</text>`;
  });
  return out;
}

const REVIEW_LOOK = {
  open: ['#fff4e6', '#a35200', () => T('In Prüfung')], approved: ['#d3f9d8', '#1f6b30', () => T('Freigegeben')], rejected: ['#ffe3e3', '#c92a2a', () => T('Abgelehnt')],
  outdated: ['#fff4e6', '#a35200', () => T('Geändert nach Freigabe')],
};

function reviewBadgeSvg(el, env) {
  const r = env.reviews && env.reviews.get(el.id);
  const look = r && REVIEW_LOOK[r.status];
  if (!look) return '';
  const fs = el.type === 'frame' ? Math.max(14, Math.min(40, Math.min(el.w, el.h) / 50)) : 12;
  const label = look[2]();
  const tw = measure(label, fs, true) + fs * 1.4, bh = fs * 1.7;
  const bx = el.x + el.w - tw, by = el.y - bh - 4;
  return `<rect x="${r1(bx)}" y="${r1(by)}" width="${r1(tw)}" height="${r1(bh)}" rx="${r1(bh / 2)}" fill="${look[0]}"/><text x="${r1(bx + tw / 2)}" y="${r1(by + bh * 0.7)}" text-anchor="middle" font-family="${esc(FONT)}" font-size="${r1(fs)}" font-weight="bold" fill="${look[1]}">${esc(label)}</text>`;
}

const dashFor = (el) => (el.dash === 'dotted' ? `${el.strokeWidth || 2} ${(el.strokeWidth || 2) * 2}` : el.dash ? `${(el.strokeWidth || 2) * 4} ${(el.strokeWidth || 2) * 3}` : '');

const LINKABLE = new Set(['sticky', 'shape', 'text', 'card', 'image', 'emoji', 'frame', 'code']);

export function safeLink(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(u)) return 'https://' + u;
  return '';
}

function linkBadge(el) {
  const href = safeLink(el.link);
  if (!href || !LINKABLE.has(el.type)) return '';
  const s = el.type === 'frame' ? 24 : Math.max(16, Math.min(28, Math.min(el.w, el.h) * 0.14));
  const cx = el.type === 'frame' ? el.x + el.w - s : el.x + el.w - s * 0.75, cy = el.type === 'frame' ? el.y - s : el.y + s * 0.75;
  const k = s / 24;
  return `<g class="link-badge" data-link="${esc(href)}"><title>${esc(href)}</title><circle cx="${cx}" cy="${cy}" r="${s / 2}" fill="#4262ff"/>` +
    `<g transform="translate(${cx - 12 * k * 0.6},${cy - 12 * k * 0.6}) scale(${k * 0.6})" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></g></g>`;
}

export function renderElement(el, env = {}) {
  el = safeEl(el);
  // Privater Modus: fremde private Elemente kommen ohne Inhalt vom Server (hidden); eigene werden in
  // Vorschaubildern und Exporten ebenfalls verdeckt
  if (el.hidden || (el.priv && env.redactPrivate)) return hiddenMarkup(el);
  const own = el.priv ? privateBadge(el) : '';
  return renderBody(el, env) + reviewBadgeSvg(el, env) + (el.link ? linkBadge(el) : '') + own + (el.type === 'sticky' || el.type === 'shape' ? stickyTags(el) : '') + reactionsMarkup(el, env);
}

// Schlagwörter auf Sticky Notes und Formen: kleine Etiketten oben links (zu lange werden gekürzt)
function stickyTags(el) {
  const tags = cardTags(el);
  if (!tags.length) return '';
  const fs = Math.max(9, Math.min(13, el.w * 0.06));
  let tx = el.x + 6, out = '';
  for (let t of tags) {
    const room = el.x + el.w - 4 - tx - fs;
    while (t.length > 2 && measure(t, fs) > room) t = t.slice(0, -2) + '…';
    const tw = measure(t, fs) + fs;
    if (tx + tw > el.x + el.w - 4) break;
    out += `<rect x="${tx}" y="${el.y + 5}" width="${tw}" height="${fs * 1.5}" rx="${fs * 0.4}" fill="#ffffff" fill-opacity="0.75"/><text x="${tx + fs / 2}" y="${el.y + 5 + fs * 1.1}" font-family="${esc(FONT)}" font-size="${fs}" fill="#495057">${esc(t)}</text>`;
    tx += tw + 4;
  }
  return `<g class="tags">${out}</g>`;
}

// Reaktionen: Emoji mit Anzahl unter dem Element (eigene hervorgehoben)
export const REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🤔', '🔥', '😮', '➕', '✅'];
function reactionsMarkup(el, env) {
  const r = el.reactions;
  if (!r || typeof r !== 'object') return '';
  const me = env.me ? String(env.me) : null;
  let tx = el.x, out = '';
  const y = el.y + el.h + 6;
  for (const emoji of REACTIONS) {
    const who = r[emoji];
    if (!who || typeof who !== 'object') continue;
    const names = Object.values(who).map(String);
    if (!names.length) continue;
    const mine = me && Object.hasOwn(who, me);
    const label = `${emoji} ${names.length}`;
    const w = measure(String(names.length), 12, true) + 34;
    out += `<g class="reaction-chip" data-emoji="${esc(emoji)}"><title>${esc(names.slice(0, 20).join(', ') + (names.length > 20 ? ' …' : ''))}</title>` +
      `<rect x="${tx}" y="${y}" width="${w}" height="22" rx="11" fill="${mine ? '#e7ecff' : '#ffffff'}" stroke="${mine ? '#4262ff' : '#dee2e6'}"/>` +
      `<text x="${tx + 8}" y="${y + 15.5}" font-family="${esc(FONT)}" font-size="12" font-weight="bold" fill="#343a40">${esc(label)}</text></g>`;
    tx += w + 4;
  }
  return out ? `<g class="reactions">${out}</g>` : '';
}

// Dateianhänge: Symbol nach Dateityp
const FILE_KINDS = { pdf: [T('PDF'), '#e03131'], doc: [T('DOC'), '#1c7ed6'], docx: [T('DOC'), '#1c7ed6'], odt: [T('ODT'), '#1c7ed6'], xls: [T('XLS'), '#2f9e44'], xlsx: [T('XLS'), '#2f9e44'], ods: [T('ODS'), '#2f9e44'], csv: [T('CSV'), '#2f9e44'], ppt: [T('PPT'), '#e8590c'], pptx: [T('PPT'), '#e8590c'], odp: [T('ODP'), '#e8590c'], txt: [T('TXT'), '#495057'], md: [T('MD'), '#495057'], json: [T('JSON'), '#7048e8'] };
export function fileKind(name) {
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(String(name || '')) || [])[1];
  return own(FILE_KINDS, ext && ext.toLowerCase()) || [T('DATEI'), '#868e96'];
}
export function fileSize(n) {
  n = Number(n) || 0;
  return n < 1024 ? `${n} B` : n < 1048576 ? T`${(n / 1024).toFixed(0)} KB` : T`${(n / 1048576).toFixed(1).replace('.', DEC)} MB`;
}

function hiddenMarkup(el) {
  const { x = 0, y = 0, w = 0, h = 0 } = el;
  const fill = el.fill && el.fill !== 'transparent' ? el.fill : el.color || '#dee2e6';
  const fs = Math.max(10, Math.min(28, Math.min(w, h) * 0.1));
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" fill-opacity="0.55" stroke="#868e96" stroke-width="1.5" stroke-dasharray="6 4"/>` +
    `<text x="${x + w / 2}" y="${y + h / 2}" font-family="${esc(FONT)}" font-size="${fs * 1.4}" text-anchor="middle">🔒</text>` +
    `<text x="${x + w / 2}" y="${y + h / 2 + fs * 1.4}" font-family="${esc(FONT)}" font-size="${fs * 0.75}" text-anchor="middle" fill="#495057">${esc(el.privName ? T('Privat · ') + el.privName : T('Privat'))}</text>`;
}

function privateBadge(el) {
  const s = Math.max(14, Math.min(24, Math.min(el.w, el.h) * 0.12));
  return `<g><title>${esc(T('Privat – nur für dich sichtbar, bis der private Modus beendet wird'))}</title><circle cx="${el.x + s * 0.2}" cy="${el.y + s * 0.2}" r="${s / 2 + 2}" fill="#212529"/><text x="${el.x + s * 0.2}" y="${el.y + s * 0.2 + s * 0.3}" font-size="${s * 0.75}" text-anchor="middle">🔒</text></g>`;
}

// Verborgener Bereich: Teilnehmende sehen eine Abdeckung, Moderierende einen Hinweis am Rand
function concealMarkup(el, env) {
  if (!el.concealed) return '';
  const { x, y, w, h } = el;
  if (env.seesConcealed && !env.redactPrivate) {
    return `<g class="conceal-badge"><title>Verborgen – nur Moderierende sehen den Inhalt</title><rect x="${x + w - 132}" y="${y + 8}" width="124" height="24" rx="12" fill="#212529" fill-opacity="0.8"/>` +
      `<text x="${x + w - 70}" y="${y + 24}" font-family="${esc(FONT)}" font-size="12" text-anchor="middle" fill="#fff">🙈 Verborgen</text></g>`;
  }
  const fs = Math.max(14, Math.min(40, Math.min(w, h) / 12));
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#conceal-pattern)" stroke="#adb5bd" stroke-dasharray="10 6"/>` +
    `<text x="${x + w / 2}" y="${y + h / 2}" font-family="${esc(FONT)}" font-size="${fs * 1.6}" text-anchor="middle">🙈</text>` +
    `<text x="${x + w / 2}" y="${y + h / 2 + fs * 1.4}" font-family="${esc(FONT)}" font-size="${fs * 0.6}" text-anchor="middle" fill="#495057">${esc(T('Verborgen – die Moderation deckt diesen Bereich auf'))}</text>`;
}

// Höhe eines Code-Blocks aus der Zeilenzahl
export function codeMetrics(el) {
  const fs = Number(el.fontSize) || 14;
  const lines = Math.min(MAX_LINES, String(el.text || '').split('\n').length);
  const gutter = el.lineNumbers === false ? 0 : String(lines).length * fs * 0.62 + 18;
  return { fs, lh: fs * LH, head: 30, pad: 12, gutter, lines };
}

function renderBody(el, env) {
  const get = env.get || (() => null);
  const { x = 0, y = 0, w = 0, h = 0 } = el;
  switch (el.type) {
    case 'sticky': {
      const pad = Math.max(8, Math.min(w, h) * 0.08);
      const box = { x: x + pad, y: y + pad, w: w - pad * 2, h: h - pad * 2 };
      const lay = textLayout(el, box);
      const author = env.showAuthor && el.author ? `<text x="${x + w - 8}" y="${y + h - 7}" font-family="${esc(FONT)}" font-size="${Math.max(8, Math.min(w, h) * 0.055)}" fill="${contrastText(el.fill)}" fill-opacity="0.55" text-anchor="end">${esc(el.author)}</text>` : '';
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.fill || '#fff9b1'}" filter="url(#shadow)"/>` +
        textSvg(box, lay, { color: el.textColor || contrastText(el.fill), align: el.align || 'center', valign: el.valign || 'middle', underline: el.underline, strike: el.strike }) + author;
    }
    case 'shape': {
      const fill = el.fill || 'transparent';
      const stroke = el.stroke || 'none';
      const sw = el.strokeWidth ?? 2;
      const dash = dashFor(el);
      const kind = el.shape || 'rect';
      // 'none' = ohne Füllung und innen durchklickbar (z. B. Rahmen von Blöcken im Sequenzdiagramm)
      const fillAttr = fill === 'transparent' ? 'rgba(255,255,255,0.001)' : fill;
      const color = el.textColor || (labelOutside(kind) ? '#1a1a1a' : contrastText(fill === 'transparent' || fill === 'none' ? '#ffffff' : fill));
      const outline = T`fill="${fillAttr}" stroke="${stroke}" stroke-width="${sw}"${dash ? T` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>`;
      if (kind === 'umlclass') return umlClassSvg(el, x, y, w, h, outline, stroke, sw, color);
      const geo = shapeGeom(kind, x, y, w, h);
      const deco = shapeDecor(kind, x, y, w, h, { fill: fillAttr, stroke, sw, dash });
      // Symbole mit Beschriftung darunter: auch neben dem Symbol und auf dem Text anklickbar
      const hit = ICON_SHAPES.has(kind) ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent" class="hit"/>` : '';
      const box = shapeTextBox(kind, x, y, w, h);
      const lay = textLayout(el, box);
      return hit + deco.before + `${geo} ${outline}` + deco.after +
        textSvg(box, lay, { color, align: el.align || 'center', valign: LABEL_BELOW.has(kind) ? 'top' : el.valign || 'middle', underline: el.underline, strike: el.strike });
    }
    case 'text': {
      const pad = 4;
      const box = { x: x + pad, y: y + pad, w: w - pad * 2, h: h - pad * 2 };
      const lay = textLayout(el, box);
      const bg = el.fill && el.fill !== 'transparent' ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.fill}" rx="4"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent" class="hit"/>`;
      const ph = !el.text && env.placeholders ? `<text x="${x + pad}" y="${y + pad + lay.size}" font-family="${esc(FONT)}" font-size="${lay.size}" fill="#999">Text</text>` : '';
      return bg + textSvg(box, lay, { color: el.color || '#1a1a1a', align: el.align || 'left', valign: 'top', underline: el.underline, strike: el.strike }) + ph;
    }
    case 'frame': {
      // Themengruppe (Retro): abgerundete, getönte Fläche mit Titel innen
      if (el.kind === 'topic') {
        const ts = Math.max(14, Math.min(30, w / 18));
        const fill = el.fill && el.fill !== '#ffffff' ? el.fill : '#eef2ff';
        return `<rect class="frame-body" x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" fill-opacity="0.7" stroke="#748ffc" stroke-width="2" stroke-dasharray="8 5"/>` +
          `<rect class="frame-title" x="${x}" y="${y}" width="${w}" height="${ts * 2}" fill="transparent"/>` +
          `<text class="frame-title-text" x="${x + 14}" y="${y + ts * 1.4}" font-family="${esc(FONT)}" font-size="${ts}" font-weight="bold" fill="#364fc7">🗂 ${esc(el.title || T('Thema'))}</text>` + concealMarkup(el, env);
      }
      const ts = Math.max(14, Math.min(48, Math.min(w, h) / 45));
      const title = el.title || T('Frame');
      const tw = measure(title, ts, true) + 8;
      return `<rect class="frame-body" x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.fill || '#ffffff'}" stroke="${el.stroke || '#d6d6d6'}" stroke-width="1"/>` +
        `<rect class="frame-title" x="${x}" y="${y - ts * 1.6}" width="${tw}" height="${ts * 1.5}" fill="transparent"/>` +
        `<text class="frame-title-text" x="${x + 2}" y="${y - ts * 0.5}" font-family="${esc(FONT)}" font-size="${ts}" font-weight="bold" fill="#6b6b6b">${esc(title)}</text>` + (Array.isArray(el.lanes) && el.lanes.length ? lanesSvg(el) : '') + concealMarkup(el, env);
    }
    case 'connector': {
      const g = connectorGeom(el, get);
      if (!g) return '';
      const color = el.stroke || '#1a1a1a';
      const sw = el.strokeWidth || 2;
      const dash = dashFor(el);
      const ah = 7 + sw * 2.2;
      const bg = env.labelBg || '#ffffff';
      let out = `<path class="hit" d="${g.d}" fill="none" stroke="transparent" stroke-width="${Math.max(14, sw + 10)}"/>`;
      out += `<path d="${g.d}" fill="none" stroke="${color}" stroke-width="${sw}"${dash ? T` stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
      out += arrowHead(headType(el.arrowEnd, 'arrow'), g.p2, g.endDir, ah, color, bg, sw);
      out += arrowHead(headType(el.arrowStart, 'none'), g.p1, g.startDir, ah, color, bg, sw);
      if (el.label) {
        const fs = el.fontSize || 14;
        const lines = String(el.label).split('\n');
        const lw = Math.max(...lines.map((l) => measure(l, fs))) + 12;
        const lh = lines.length * fs * LH + 6;
        out += `<g class="conn-label"><rect x="${r1(g.mid.x - lw / 2)}" y="${r1(g.mid.y - lh / 2)}" width="${r1(lw)}" height="${r1(lh)}" rx="4" fill="${bg}"/>`;
        out += textSvg({ x: g.mid.x - lw / 2, y: g.mid.y - lh / 2, w: lw, h: lh }, { size: fs, lines, bold: false, italic: false }, { color }) + '</g>';
      }
      return out;
    }
    case 'chart':
      return chartSvg(el, get);
    case 'pen': {
      const d = penPath(el.points);
      if (el.points.some((p) => p.length > 2)) {
        return `<g transform="translate(${r1(x)},${r1(y)})"><path class="hit" d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(12, (el.strokeWidth || 3) + 8)}" stroke-linecap="round"/><path d="${pressurePath(el.points, el.strokeWidth || 3)}" fill="${el.stroke || '#1a1a1a'}"${el.opacity && el.opacity < 1 ? ` opacity="${el.opacity}"` : ''}/></g>`;
      }
      return `<g transform="translate(${r1(x)},${r1(y)})"><path class="hit" d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(12, (el.strokeWidth || 3) + 8)}" stroke-linecap="round"/>` +
        `<path d="${d}" fill="none" stroke="${el.stroke || '#1a1a1a'}" stroke-width="${el.strokeWidth || 3}" stroke-linecap="round" stroke-linejoin="round"${el.opacity && el.opacity < 1 ? T` stroke-opacity="${el.opacity}"` : ''}/></g>`;
    }
    case 'file': {
      const [label, color] = fileKind(el.name);
      const head = 44;
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="#dee2e6" filter="url(#shadow-sm)"/>`;
      // Vorschau (erste Seite) – nur im Board, nicht in Exporten (dort lädt der Browser keine Adressen nach)
      const pv = el.preview && el.fileId && env.boardId && !env.noExternal;
      if (pv) {
        out += `<image href="/api/boards/${encodeURIComponent(env.boardId)}/files/${encodeURIComponent(el.fileId)}/preview" x="${x + 6}" y="${y + 6}" width="${Math.max(0, w - 12)}" height="${Math.max(0, h - head - 12)}" preserveAspectRatio="xMidYMin meet"/>`;
      } else {
        const s = Math.min(w, h - head) * 0.45;
        const cx = x + w / 2, cy = y + (h - head) / 2;
        out += `<path d="M${cx - s * 0.38},${cy - s / 2} h${s * 0.52} l${s * 0.24},${s * 0.24} v${s * 0.76} h${-s * 0.76} Z" fill="#f8f9fa" stroke="${color}" stroke-width="2"/>`;
        out += `<rect x="${cx - s * 0.46}" y="${cy + s * 0.05}" width="${s * 0.92}" height="${s * 0.3}" rx="3" fill="${color}"/><text x="${cx}" y="${cy + s * 0.27}" font-family="${esc(FONT)}" font-size="${s * 0.2}" font-weight="bold" text-anchor="middle" fill="#fff">${label}</text>`;
      }
      const nl = wrap(el.name || T('Datei'), w - 20, 13, true).slice(0, 1);
      out += `<line x1="${x}" y1="${y + h - head}" x2="${x + w}" y2="${y + h - head}" stroke="#f1f3f5"/>`;
      out += `<text x="${x + 10}" y="${y + h - head + 18}" font-family="${esc(FONT)}" font-size="13" font-weight="bold" fill="#1a1a1a">${esc(nl[0] || '')}</text>`;
      out += `<text x="${x + 10}" y="${y + h - head + 35}" font-family="${esc(FONT)}" font-size="11" fill="#868e96">${esc(label + ' · ' + fileSize(el.size) + (el.fileId ? '' : T(' · nicht verfügbar')))}</text>`;
      return out;
    }
    case 'image': {
      if (!el.src) return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#eee" stroke="#ccc"/>`;
      if (el.crop) {
        const c = el.crop;
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${c.x} ${c.y} ${c.w} ${c.h}" preserveAspectRatio="none"><image href="${esc(el.src)}" x="0" y="0" width="1" height="1" preserveAspectRatio="none"/></svg>`;
      }
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/><image href="${esc(el.src)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;
    }
    case 'emoji': {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent" class="hit"/><text x="${x + w / 2}" y="${y + h * 0.86}" font-size="${h * 0.9}" text-anchor="middle">${esc(el.char || '⭐')}</text>`;
    }
    case 'code': {
      const th = THEMES[el.theme === 'light' ? 'light' : 'dark'];
      const m = codeMetrics(el);
      const cid = 'cc-' + String(el.id).replace(/[^\w-]/g, '');
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${th.bg}" filter="url(#shadow-sm)"/>`;
      out += `<path d="M${x + 8},${y} H${x + w - 8} Q${x + w},${y} ${x + w},${y + 8} V${y + m.head} H${x} V${y + 8} Q${x},${y} ${x + 8},${y} Z" fill="${th.head}"/>`;
      ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => (out += `<circle cx="${x + 16 + i * 16}" cy="${y + m.head / 2}" r="5" fill="${c}"/>`));
      const label = String(el.title || own(LANG_LABEL, el.lang) || '');
      if (label) out += `<text x="${x + w - 12}" y="${y + m.head / 2 + 4}" font-family="${esc(FONT)}" font-size="12" text-anchor="end" fill="${th.gutter}">${esc(label)}</text>`;
      out += `<clipPath id="${cid}"><rect x="${x}" y="${y + m.head}" width="${Math.max(0, w - 10)}" height="${Math.max(0, h - m.head)}"/></clipPath><g clip-path="url(#${cid})">`;
      const by = y + m.head + m.pad;
      const base = m.fs * ((LH - 1) / 2 + 0.8);
      const rows = tokenize(el.text, el.lang || 'plain');
      let txt = '', nums = '';
      rows.forEach((toks, i) => {
        const ly = r1(by + i * m.lh + base);
        if (m.gutter) nums += `<tspan x="${r1(x + m.gutter - 8)}" y="${ly}">${i + 1}</tspan>`;
        if (!toks.length) return;
        txt += `<tspan x="${r1(x + m.gutter + m.pad)}" y="${ly}">` + toks.map((t) => `<tspan fill="${th[t.k] || th.text}">${esc(t.t)}</tspan>`).join('') + '</tspan>';
      });
      if (m.gutter) out += `<text font-family="${esc(MONO)}" font-size="${m.fs}" fill="${th.gutter}" text-anchor="end">${nums}</text>`;
      if (!el.text && env.placeholders) txt = `<tspan x="${x + m.gutter + m.pad}" y="${r1(by + base)}" fill="${th.gutter}">${esc(T('Code hier einfügen …'))}</tspan>`;
      out += `<text class="code-text" font-family="${esc(MONO)}" font-size="${m.fs}" fill="${th.text}" xml:space="preserve">${txt}</text></g>`;
      return out;
    }
    case 'card': {
      const color = el.color || '#4262ff';
      const pad = 14;
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="#e3e3e3" filter="url(#shadow-sm)"/>`;
      out += `<path d="M${x + 8},${y} H${x + w - 8} Q${x + w},${y} ${x + w},${y + 8} V${y + 6} H${x} V${y + 8} Q${x},${y} ${x + 8},${y} Z" fill="${color}"/>`;
      let top = y + 16;
      if (el.key) {
        out += `<text x="${x + pad}" y="${top + 10}" font-family="${esc(FONT)}" font-size="11" font-weight="bold" fill="#868e96">${esc(String(el.key).slice(0, 40))}</text>`;
        top += 16;
      }
      const tags = cardTags(el);
      const footer = 28 + (tags.length ? 24 : 0);
      const tlay = { size: 15, bold: true, italic: false, lines: wrap(el.title || T('Neue Karte'), w - pad * 2, 15, true).slice(0, 3) };
      out += textSvg({ x: x + pad, y: top, w: w - pad * 2, h: 60 }, tlay, { align: 'left', valign: 'top', color: '#1a1a1a' });
      const ty = top + tlay.lines.length * 15 * LH + 6;
      if (el.description) {
        const maxL = Math.max(0, Math.floor((y + h - footer - 12 - ty) / (13 * LH)));
        const dl = wrap(el.description, w - pad * 2, 13).slice(0, maxL);
        out += textSvg({ x: x + pad, y: ty, w: w - pad * 2, h: 200 }, { size: 13, lines: dl }, { align: 'left', valign: 'top', color: '#666666' });
      }
      const fy = y + h - 28;
      if (tags.length) {
        let tx = x + pad;
        for (const t of tags) {
          const tw = measure(t, 10) + 12;
          if (tx + tw > x + w - pad) break;
          out += `<rect x="${tx}" y="${fy - 23}" width="${tw}" height="16" rx="4" fill="#f1f3f5" stroke="#dee2e6"/><text x="${tx + 6}" y="${fy - 11.5}" font-family="${esc(FONT)}" font-size="10" fill="#495057">${esc(t)}</text>`;
          tx += tw + 5;
        }
      }
      // Fußzeile: links Status, Priorität, Punkte – nur so viel, wie neben Datum und Avatar (rechts) passt
      let fx = x + pad;
      const dueW = el.due ? measure('📅 00.00.', 12) + 6 : 0;
      const right = x + w - pad - (el.assignee ? 28 : 0) - dueW;
      const chip = (label, bold, minW = 0) => Math.max(minW, measure(label, 11, bold) + 14);
      const pt = el.points !== undefined && el.points !== null && el.points !== '' ? String(el.points).slice(0, 5) : '';
      const prio = own(PRIORITIES, el.priority);
      const ptW = pt ? chip(pt, true, 20) + 6 : 0;
      const prW = prio ? chip(prio.icon + ' ' + prio.label, true) + 6 : 0;
      if (el.status) {
        const maxW = Math.max(0, right - fx - ptW - prW - 6);
        let label = String(el.status);
        while (label.length > 1 && chip(label, true) > maxW) label = label.slice(0, -2) + '…';
        if (chip(label, true) <= maxW) {
          const sw = chip(label, true);
          out += `<rect x="${fx}" y="${fy}" width="${sw}" height="18" rx="9" fill="${color}" fill-opacity="0.15"/><text x="${fx + 7}" y="${fy + 13}" font-family="${esc(FONT)}" font-size="11" font-weight="bold" fill="${color}">${esc(label)}</text><title>${esc(el.status)}</title>`;
          fx += sw + 6;
        }
      }
      if (prio && fx + prW <= right) {
        const pw = prW - 6;
        out += `<rect x="${fx}" y="${fy}" width="${pw}" height="18" rx="9" fill="${prio.color}" fill-opacity="0.14"/><text x="${fx + 7}" y="${fy + 13}" font-family="${esc(FONT)}" font-size="11" font-weight="bold" fill="${prio.color}">${prio.icon} ${esc(prio.label)}</text>`;
        fx += prW;
      }
      if (pt && fx + ptW <= right + 6) {
        const pw = ptW - 6;
        out += `<rect x="${fx}" y="${fy}" width="${pw}" height="18" rx="9" fill="#495057"/><text x="${fx + pw / 2}" y="${fy + 13}" font-family="${esc(FONT)}" font-size="11" font-weight="bold" text-anchor="middle" fill="#ffffff">${esc(pt)}</text><title>${esc(T('Story Points / Schätzung'))}</title>`;
      }
      if (el.due) {
        const ds = new Date(el.due + 'T00:00').toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' });
        const overdue = new Date(el.due + 'T23:59') < new Date();
        out += `<text x="${x + w - pad - (el.assignee ? 30 : 0)}" y="${fy + 13}" font-family="${esc(FONT)}" font-size="12" text-anchor="end" fill="${overdue ? '#e03131' : '#888888'}">📅 ${ds}</text>`;
      }
      if (el.assignee) {
        out += `<circle cx="${x + w - pad - 10}" cy="${fy + 9}" r="11" fill="${color}"/><text x="${x + w - pad - 10}" y="${fy + 13}" font-family="${esc(FONT)}" font-size="10" font-weight="bold" text-anchor="middle" fill="#fff">${esc(initials(el.assignee))}</text>`;
      }
      return out;
    }
    case 'table': {
      const { xs, ys, rows, cols } = tableLayout(el);
      const line = el.stroke || '#d0d0d0';
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.fill || '#ffffff'}"/>`;
      // Zellhintergründe
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bg = cellStyle(el, r, c).bg;
          if (bg) out += `<rect x="${r1(xs[c])}" y="${r1(ys[r])}" width="${r1(xs[c + 1] - xs[c])}" height="${r1(ys[r + 1] - ys[r])}" fill="${bg}"/>`;
        }
      }
      for (let r = 1; r < rows; r++) out += `<line x1="${x}" y1="${r1(ys[r])}" x2="${x + w}" y2="${r1(ys[r])}" stroke="${line}"/>`;
      for (let c = 1; c < cols; c++) out += `<line x1="${r1(xs[c])}" y1="${y}" x2="${r1(xs[c])}" y2="${y + h}" stroke="${line}"/>`;
      out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${el.stroke || '#b9b9b9'}"/>`;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const t = el.cells?.[r]?.[c];
          if (!t || (env.editingCell && env.editingCell[0] === r && env.editingCell[1] === c)) continue;
          const st = cellStyle(el, r, c);
          const box = { x: xs[c] + 8, y: ys[r] + 6, w: xs[c + 1] - xs[c] - 16, h: ys[r + 1] - ys[r] - 12 };
          out += textSvg(box, { size: st.size, bold: st.bold, italic: st.italic, lines: wrap(t, box.w, st.size, st.bold, st.italic) },
            { align: st.align, valign: st.valign, color: st.color, underline: st.underline, strike: st.strike });
        }
      }
      return out;
    }
    case 'comment': {
      const n = (el.thread || []).length;
      const s = 1 / (env.zoom || 1);
      const color = el.resolved ? '#9e9e9e' : el.color || '#4262ff';
      // Zugewiesene Kommentare (Aufgaben) tragen einen orangefarbenen Punkt
      const task = el.task && !el.resolved ? `<circle cx="36" cy="-36" r="6" fill="#f08c00" stroke="#fff" stroke-width="2"/>` : '';
      return `<g transform="translate(${x},${y}) scale(${s})"${el.resolved ? T(' opacity="0.6"') : ''}>` +
        `<path d="M0,0 L0,-26 Q0,-36 10,-36 L26,-36 Q36,-36 36,-26 L36,-14 Q36,-4 26,-4 L8,-4 Z" fill="${color}" stroke="#fff" stroke-width="2" filter="url(#shadow-sm)"/>` +
        `<text x="18" y="-15" font-family="${esc(FONT)}" font-size="13" font-weight="bold" fill="#fff" text-anchor="middle">${n || '+'}</text>${task}</g>`;
    }
  }
  return '';
}

export const PRIORITIES = {
  critical: { label: T('Kritisch'), color: '#e03131', icon: '⏫' },
  high: { label: T('Hoch'), color: '#f08c00', icon: '▲' },
  medium: { label: T('Mittel'), color: '#1971c2', icon: '■' },
  low: { label: T('Niedrig'), color: '#868e96', icon: '▼' },
};

export const LANG_LABEL = {
  plain: '', js: T('JavaScript'), python: T('Python'), java: T('Java'), csharp: 'C#', go: T('Go'), php: T('PHP'), sql: T('SQL'), bash: T('Shell'),
  json: T('JSON'), yaml: T('YAML'), html: 'HTML', css: T('CSS'), dockerfile: T('Dockerfile'),
};

export function cardTags(el) {
  const t = Array.isArray(el.tags) ? el.tags : String(el.tags || '').split(',');
  return t.map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
}

/* Vollständiges SVG für eine Menge von Elementen (Vorschau, Export) */
export function renderSvgDocument(elements, { padding = 40, background = '#ffffff', width, height, bounds, redactPrivate = false, seesConcealed = true } = {}) {
  const map = new Map(elements.map((e) => [e.id, e]));
  const get = (id) => map.get(id);
  const list = sortForRender(elements.filter((e) => e.type !== 'comment' && !isOrphan(e, get)));
  const b = (bounds && { x: fin(bounds.x), y: fin(bounds.y), w: fin(bounds.w), h: fin(bounds.h) }) ||
    unionRect(list.map((e) => elBounds(e, get))) || { x: 0, y: 0, w: 100, h: 100 };
  padding = fin(padding);
  const vb = { x: b.x - padding, y: b.y - padding, w: b.w + padding * 2, h: b.h + padding * 2 };
  // Rahmentitel ragen über den Frame hinaus
  if (!bounds && list.some((e) => e.type === 'frame')) {
    vb.y -= 40;
    vb.h += 40;
  }
  const body = list.map((e) => `<g>${renderElement(e, { get, redactPrivate, seesConcealed, noExternal: true })}</g>`).join('');
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${width || vb.w}" height="${height || vb.h}"><defs>${defsMarkup()}</defs>` +
      (background ? `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${esc(background)}"/>` : '') + body + '</svg>',
    viewBox: vb,
  };
}

export function sortForRender(list) {
  // Frames ganz unten, dann gesperrte Hintergründe (Vorlagen-Flächen), Themengruppen, Inhalte, Kommentare
  const rank = (e) => (e.type === 'frame' ? (e.kind === 'topic' ? 2 : 0) : e.type === 'comment' ? 4 : e.locked ? 1 : 3);
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.z || 0) - (b.z || 0));
}
