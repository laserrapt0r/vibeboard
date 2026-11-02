// Formenkatalog: Pakete, Suchwörter und die seit 4.18.0 hinzugekommenen Formen.
// Die Geometrie folgt den offenen Normen (ISO 5807, BPMN 2.0, UML, ERD, Yourdon, Value Stream Mapping) und ist hier selbst gezeichnet.
import { T } from './i18n.js';

export const r1 = (v) => Math.round(v * 10) / 10;

/* ---------------- Pfad-Bausteine ---------------- */

export const ellipseD = (cx, cy, rx, ry) => `M${r1(cx - rx)},${r1(cy)} A${r1(rx)},${r1(ry)} 0 1 0 ${r1(cx + rx)},${r1(cy)} A${r1(rx)},${r1(ry)} 0 1 0 ${r1(cx - rx)},${r1(cy)} Z`;
export const circleD = (cx, cy, r) => ellipseD(cx, cy, r, r);
export const rectD = (x, y, w, h) => `M${r1(x)},${r1(y)} H${r1(x + w)} V${r1(y + h)} H${r1(x)} Z`;
export function rrectD(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${r1(x + r)},${r1(y)} H${r1(x + w - r)} A${r1(r)},${r1(r)} 0 0 1 ${r1(x + w)},${r1(y + r)} V${r1(y + h - r)} A${r1(r)},${r1(r)} 0 0 1 ${r1(x + w - r)},${r1(y + h)} H${r1(x + r)} A${r1(r)},${r1(r)} 0 0 1 ${r1(x)},${r1(y + h - r)} V${r1(y + r)} A${r1(r)},${r1(r)} 0 0 1 ${r1(x + r)},${r1(y)} Z`;
}
export const lineD = (x1, y1, x2, y2) => `M${r1(x1)},${r1(y1)} L${r1(x2)},${r1(y2)}`;
export const diamondD = (x, y, w, h) => `M${r1(x + w / 2)},${r1(y)} L${r1(x + w)},${r1(y + h / 2)} L${r1(x + w / 2)},${r1(y + h)} L${r1(x)},${r1(y + h / 2)} Z`;
// Vieleck in normierten Koordinaten (−1 … 1)
const polyD = (pts, x, y, w, h) => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${r1(x + ((a + 1) * w) / 2)},${r1(y + ((b + 1) * h) / 2)}`).join(' ') + ' Z';

// Umriss aus Bögen um die Mitte. Der Maßstab sorgt dafür, dass die Ausbuchtungen genau bis an den Rand reichen.
function bumpsD(x, y, w, h, n) {
  if (!(w > 0 && h > 0)) return `M${x} ${y}`; // Ohne Fläche gibt es keine Bögen, sonst stünde NaN im Pfad
  const cx = x + w / 2, cy = y + h / 2;
  const at = (k) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      pts.push([cx + (Math.cos(a) * w * k) / 2, cy + (Math.sin(a) * h * k) / 2]);
    }
    return pts;
  };
  const radius = (c) => c * 0.6;
  const reach = (pts) => {
    let f = 0;
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % n];
      const c = Math.hypot(q[0] - p[0], q[1] - p[1]), r = radius(c);
      const s = r - Math.sqrt(Math.max(0, r * r - (c * c) / 4));
      const nx = (q[1] - p[1]) / c, ny = -(q[0] - p[0]) / c;
      const mx = (p[0] + q[0]) / 2 + nx * s, my = (p[1] + q[1]) / 2 + ny * s;
      f = Math.max(f, Math.abs(mx - cx) / (w / 2), Math.abs(my - cy) / (h / 2));
    });
    return f;
  };
  const pts = at(1 / reach(at(1)));
  return `M${r1(pts[0][0])},${r1(pts[0][1])} ` + pts.map((_, i) => {
    const p = pts[i], q = pts[(i + 1) % n];
    const r = radius(Math.hypot(q[0] - p[0], q[1] - p[1]));
    return `A${r1(r)},${r1(r)} 0 0 1 ${r1(q[0])},${r1(q[1])}`;
  }).join(' ') + ' Z';
}

function gearD(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8, k = i % 2 ? 0.72 : 1;
    pts.push(`${i ? 'L' : 'M'}${r1(cx + Math.cos(a) * r * k)},${r1(cy + Math.sin(a) * r * k)}`);
  }
  return pts.join(' ') + ' Z ' + circleD(cx, cy, r * 0.32);
}

// Einheitlicher Maßstab für Symbole in einer Form: Koordinaten −0,5 … 0,5 um (cx, cy)
function glyph(cx, cy, s) {
  const P = (u, v) => `${r1(cx + u * s)},${r1(cy + v * s)}`;
  return { P, closed: (pts) => 'M' + pts.map(([u, v]) => P(u, v)).join(' L') + ' Z', open: (pts) => 'M' + pts.map(([u, v]) => P(u, v)).join(' L') };
}

/* ---------------- BPMN ---------------- */

// Symbol eines Ereignisses: offen für eintretende, gefüllt für ausgelöste Ereignisse
function eventMark(type, cx, cy, s, filled) {
  const g = glyph(cx, cy, s);
  const shape = (d) => (filled ? { solid: d } : { lines: d });
  switch (type) {
    case 'msg':
      if (filled) return { solid: g.closed([[-0.46, -0.3], [0.46, -0.3], [0, 0.03]]) + ' ' + g.closed([[-0.46, -0.17], [0, 0.15], [0.46, -0.17], [0.46, 0.3], [-0.46, 0.3]]) };
      return { lines: g.closed([[-0.46, -0.3], [0.46, -0.3], [0.46, 0.3], [-0.46, 0.3]]) + ' ' + g.open([[-0.46, -0.3], [0, 0.08], [0.46, -0.3]]) };
    case 'timer':
      return { lines: circleD(cx, cy, s * 0.48) + ' ' + g.open([[0, -0.32], [0, 0], [0.22, 0.12]]) };
    case 'error':
      return shape(g.closed([[-0.44, 0.44], [-0.18, -0.32], [0.08, 0.08], [0.44, -0.44], [0.18, 0.32], [-0.08, -0.08]]));
    case 'signal':
      return shape(g.closed([[0, -0.46], [0.46, 0.36], [-0.46, 0.36]]));
    default:
      return shape(g.closed([[-0.42, -0.28], [-0.28, -0.42], [0, -0.14], [0.28, -0.42], [0.42, -0.28], [0.14, 0], [0.42, 0.28], [0.28, 0.42], [0, 0.14], [-0.28, 0.42], [-0.42, 0.28], [-0.14, 0]]));
  }
}

const merge = (a, b) => ({ ...a, lines: [a.lines, b.lines].filter(Boolean).join(' '), solid: [a.solid, b.solid].filter(Boolean).join(' ') });

function eventShape(cls, type) {
  return (x, y, w, h) => {
    const cx = x + w / 2, cy = y + h / 2, rim = ellipseD(cx, cy, w / 2, h / 2), s = Math.min(w, h) * 0.56;
    if (cls === 'inter') {
      const t = Math.max(3, Math.min(w, h) * 0.08);
      return merge({ main: rim, lines: ellipseD(cx, cy, w / 2 - t, h / 2 - t) }, eventMark(type, cx, cy, s, false));
    }
    if (cls === 'end') {
      const t = Math.max(2.5, Math.min(w, h) * 0.08);
      return merge({ main: rim, ring: rim + ' ' + ellipseD(cx, cy, w / 2 - t, h / 2 - t) }, eventMark(type, cx, cy, s, true));
    }
    return merge({ main: rim }, eventMark(type, cx, cy, s, false));
  };
}

function taskMark(type, cx, cy, s) {
  const g = glyph(cx, cy, s);
  switch (type) {
    case 'user':
      return { lines: circleD(cx, cy - s * 0.22, s * 0.22) + ` M${g.P(-0.44, 0.46)} V${r1(cy + s * 0.22)} Q${g.P(-0.44, 0.02)} ${g.P(0, 0.02)} Q${g.P(0.44, 0.02)} ${g.P(0.44, 0.22)} V${r1(cy + s * 0.46)} Z` };
    case 'service':
      return { lines: gearD(cx, cy, s * 0.5) };
    case 'script':
      return { lines: g.closed([[-0.3, -0.46], [0.42, -0.46], [0.3, 0.46], [-0.42, 0.46]]) + ' ' + g.open([[-0.18, -0.22], [0.2, -0.22]]) + ' ' + g.open([[-0.2, 0], [0.18, 0]]) + ' ' + g.open([[-0.22, 0.22], [0.16, 0.22]]) };
    case 'send':
      return eventMark('msg', cx, cy, s, true);
    case 'receive':
      return eventMark('msg', cx, cy, s, false);
    default:
      return { lines: g.closed([[-0.3, 0.46], [-0.42, 0.06], [-0.32, -0.02], [-0.2, 0.08], [-0.2, -0.38], [-0.08, -0.38], [-0.08, -0.06], [-0.02, -0.46], [0.1, -0.46], [0.1, -0.06], [0.2, -0.4], [0.3, -0.4], [0.28, -0.02], [0.38, -0.24], [0.46, -0.2], [0.34, 0.46]]) };
  }
}

function taskShape(type) {
  return (x, y, w, h) => {
    const s = Math.min(20, Math.min(w, h) * 0.34), m = Math.min(w, h) * 0.08 + s / 2;
    return merge({ main: rrectD(x, y, w, h, Math.min(w, h) * 0.12) }, taskMark(type, x + m, y + m, s));
  };
}

/* ---------------- Definitionen ---------------- */

const CLOUD = [0.2, 0.2, 0.6, 0.6];
const hd = (w, f) => Math.min(38, w * f); // Breite des Kopfstreifens bei Pool und Lane
const lifeHead = (h) => Math.min(h * 0.2, 56);
const tagW = (w) => Math.min(w * 0.3, 96);
const tagH = (h) => Math.min(h * 0.16, 30);
const snip = (w, h) => Math.min(w, h) * 0.22;

// Spiegelung einer offenen Klammer an der Mittelachse
const braceD = (x, y, w, h, dir) => {
  const X = (f) => r1(dir > 0 ? x + w * f : x + w * (1 - f));
  const c = y + h / 2, r = Math.min(h * 0.14, w * 0.8);
  return `M${X(1)},${r1(y)} Q${X(0.5)},${r1(y)} ${X(0.5)},${r1(y + r)} V${r1(c - r)} Q${X(0.5)},${r1(c)} ${X(0)},${r1(c)} Q${X(0.5)},${r1(c)} ${X(0.5)},${r1(c + r)} V${r1(y + h - r)} Q${X(0.5)},${r1(y + h)} ${X(1)},${r1(y + h)}`;
};
const bracketD = (x, y, w, h, dir) => {
  const X = (f) => r1(dir > 0 ? x + w * f : x + w * (1 - f)), tip = Math.min(w * 0.14, 22);
  return `M${r1(dir > 0 ? x + tip : x + w - tip)},${r1(y)} H${X(0)} V${r1(y + h)} H${r1(dir > 0 ? x + tip : x + w - tip)}`;
};
const STAR_BURST = Array.from({ length: 22 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 11, r = i % 2 ? 0.66 : [1, 0.86, 0.96, 0.82, 1, 0.88][(i / 2) % 6];
  return [Math.cos(a) * r, Math.sin(a) * r];
});
const regular = (n, rot = -Math.PI / 2) => {
  const pts = Array.from({ length: n }, (_, i) => [Math.cos(rot + (i * 2 * Math.PI) / n), Math.sin(rot + (i * 2 * Math.PI) / n)]);
  const ys = pts.map((p) => p[1]), top = Math.min(...ys), bottom = Math.max(...ys);
  return pts.map(([a, b]) => [a, ((b - top) / (bottom - top)) * 2 - 1]);
};

// name: Anzeigename. poly: Umriss (normiert); draw: Zeichenfunktion. text: Textbereich [x, y, Breite, Höhe] als Anteil oder Funktion.
// round: Andockpunkte auf der Ellipse. below: Beschriftung unter der Form. size: Standardgröße [Breite, Höhe]. def: weitere Startwerte.
const CUSTOM = {
  // Grundformen
  pentagon: { name: T('Fünfeck'), poly: regular(5), text: [0.2, 0.28, 0.6, 0.62] },
  octagon: { name: T('Achteck'), poly: [[-0.42, -1], [0.42, -1], [1, -0.42], [1, 0.42], [0.42, 1], [-0.42, 1], [-1, 0.42], [-1, -0.42]], text: [0.1, 0.1, 0.8, 0.8] },
  bubble: {
    name: T('Runde Sprechblase'), size: [200, 150], text: [0.16, 0.1, 0.68, 0.6],
    draw(x, y, w, h) {
      const rx = w / 2, ry = h * 0.41, cx = x + rx, cy = y + ry;
      const pt = (deg) => [cx + Math.cos((deg * Math.PI) / 180) * rx, cy + Math.sin((deg * Math.PI) / 180) * ry];
      const [ax, ay] = pt(120), [bx, by] = pt(95);
      return { main: `M${r1(ax)},${r1(ay)} A${r1(rx)},${r1(ry)} 0 1 1 ${r1(bx)},${r1(by)} L${r1(x + w * 0.2)},${r1(y + h)} Z` };
    },
  },
  doublearrow: { name: T('Doppelpfeil'), size: [240, 110], poly: [[-1, 0], [-0.55, -1], [-0.55, -0.5], [0.55, -0.5], [0.55, -1], [1, 0], [0.55, 1], [0.55, 0.5], [-0.55, 0.5], [-0.55, 1]], text: [0.22, 0.25, 0.56, 0.5, 4] },
  leftarrow: { name: T('Linkspfeil'), poly: [[-1, 0], [-0.2, -1], [-0.2, -0.5], [1, -0.5], [1, 0.5], [-0.2, 0.5], [-0.2, 1]], text: [0.2, 0.25, 0.8, 0.5] },
  braceleft: { name: T('Geschweifte Klammer links'), size: [90, 200], def: { fill: 'transparent' }, text: [0.56, 0, 0.44, 1, 2], draw: (x, y, w, h) => ({ main: braceD(x, y, w, h, 1) }) },
  braceright: { name: T('Geschweifte Klammer rechts'), size: [90, 200], def: { fill: 'transparent' }, text: [0, 0, 0.44, 1, 2], draw: (x, y, w, h) => ({ main: braceD(x, y, w, h, -1) }) },
  chevron: { name: T('Stufe / Chevron'), size: [220, 100], poly: [[-1, -1], [0.55, -1], [1, 0], [0.55, 1], [-1, 1], [-0.55, 0]], text: [0.25, 0, 0.5, 1, 4] },
  arrowflag: { name: T('Pfeilfähnchen'), size: [220, 100], poly: [[-1, -1], [0.55, -1], [1, 0], [0.55, 1], [-1, 1]], text: [0, 0, 0.8, 1] },
  barprocess: { name: T('Prozess mit Seitenbalken'), text: [0.12, 0, 0.88, 1], draw: (x, y, w, h) => ({ main: rectD(x, y, w, h), lines: lineD(x + w * 0.12, y, x + w * 0.12, y + h) }) },
  cloudround: { name: T('Bauschige Wolke'), round: true, text: CLOUD, draw: (x, y, w, h) => ({ main: bumpsD(x, y, w, h, 9) }) },
  cloudwide: { name: T('Flache Wolke'), size: [260, 120], round: true, text: CLOUD, draw: (x, y, w, h) => ({ main: bumpsD(x, y, w, h, 14) }) },
  cloudthought: {
    name: T('Gedankenwolke'), size: [220, 170], text: [0.2, 0.15, 0.6, 0.48],
    draw(x, y, w, h) {
      const s = Math.min(w, h);
      return { main: bumpsD(x, y, w, h * 0.78, 10), under: [circleD(x + w * 0.24, y + h * 0.86, s * 0.055), circleD(x + w * 0.14, y + h - s * 0.035, s * 0.03)] };
    },
  },
  snipcorner: {
    name: T('Rechteck mit Eckenschnitt'), text: [0, 0.06, 0.94, 0.94],
    draw(x, y, w, h) {
      const c = snip(w, h);
      return { main: `M${r1(x)},${r1(y)} H${r1(x + w - c)} L${r1(x + w)},${r1(y + c)} V${r1(y + h)} H${r1(x)} Z` };
    },
  },
  // Flussdiagramm
  preparation: { name: T('Vorbereitung'), poly: [[-0.72, -1], [0.72, -1], [1, 0], [0.72, 1], [-0.72, 1], [-1, 0]], text: [0.13, 0, 0.74, 1] },
  directstorage: {
    name: T('Direkter Speicher'), text: [0.04, 0, 0.76, 1],
    draw(x, y, w, h) {
      const rx = Math.min(w * 0.13, 34), r = x + w - rx;
      return { main: `M${r1(x + rx)},${r1(y)} H${r1(r)} A${r1(rx)},${r1(h / 2)} 0 0 1 ${r1(r)},${r1(y + h)} H${r1(x + rx)} A${r1(rx)},${r1(h / 2)} 0 0 1 ${r1(x + rx)},${r1(y)} Z`, lines: `M${r1(r)},${r1(y)} A${r1(rx)},${r1(h / 2)} 0 0 0 ${r1(r)},${r1(y + h)}` };
    },
  },
  punchcard: { name: T('Lochkarte'), poly: [[-1, -0.55], [-0.66, -1], [1, -1], [1, 1], [-1, 1]], text: [0, 0.2, 1, 0.8] },
  punchtape: {
    name: T('Lochstreifen'), size: [220, 120], text: [0, 0.16, 1, 0.68],
    draw(x, y, w, h) {
      const a = h * 0.09, t = y + a * 1.8, b = y + h - a * 1.8;
      return { main: `M${r1(x)},${r1(t)} C${r1(x + w * 0.2)},${r1(t + a * 2)} ${r1(x + w * 0.3)},${r1(t + a * 2)} ${r1(x + w * 0.5)},${r1(t)} S${r1(x + w * 0.8)},${r1(t - a * 2)} ${r1(x + w)},${r1(t)} V${r1(b)} C${r1(x + w * 0.8)},${r1(b - a * 2)} ${r1(x + w * 0.7)},${r1(b - a * 2)} ${r1(x + w * 0.5)},${r1(b)} S${r1(x + w * 0.2)},${r1(b + a * 2)} ${r1(x)},${r1(b)} Z` };
    },
  },
  fcor: { name: T('Oder'), size: [72, 72], round: true, below: true, def: { fontSize: 13 }, draw: (x, y, w, h) => ({ main: ellipseD(x + w / 2, y + h / 2, w / 2, h / 2), lines: lineD(x, y + h / 2, x + w, y + h / 2) + ' ' + lineD(x + w / 2, y, x + w / 2, y + h) }) },
  fcsum: {
    name: T('Summierung'), size: [72, 72], round: true, below: true, def: { fontSize: 13 },
    draw(x, y, w, h) {
      const k = 0.5 - Math.SQRT1_2 / 2;
      return { main: ellipseD(x + w / 2, y + h / 2, w / 2, h / 2), lines: lineD(x + w * k, y + h * k, x + w * (1 - k), y + h * (1 - k)) + ' ' + lineD(x + w * (1 - k), y + h * k, x + w * k, y + h * (1 - k)) };
    },
  },
  fcsort: { name: T('Sortieren'), size: [150, 120], poly: [[0, -1], [1, 0], [0, 1], [-1, 0]], text: [0.26, 0.14, 0.48, 0.34, 2], draw: (x, y, w, h) => ({ main: diamondD(x, y, w, h), lines: lineD(x, y + h / 2, x + w, y + h / 2) }) },
  fcmerge: { name: T('Zusammenführen'), size: [160, 130], poly: [[-1, -1], [1, -1], [0, 1]], text: [0.24, 0.04, 0.52, 0.46, 2] },
  fcextract: { name: T('Extrakt'), size: [160, 130], poly: [[0, -1], [1, 1], [-1, 1]], text: [0.24, 0.5, 0.52, 0.46, 2] },
  collate: { name: T('Zusammentragen'), size: [120, 130], poly: [[-1, -1], [1, -1], [0, 0], [1, 1], [-1, 1], [0, 0]], text: [0.26, 0.02, 0.48, 0.34, 2], outline: [[-1, -1], [1, -1], [1, 1], [-1, 1]] },
  fcloop: { name: T('Schleifengrenze'), poly: [[-1, 1], [-1, -0.5], [-0.72, -1], [0.72, -1], [1, -0.5], [1, 1]], text: [0.06, 0.14, 0.88, 0.86] },
  storeddata: {
    name: T('Gespeicherte Daten'), text: [0.14, 0, 0.72, 1],
    draw(x, y, w, h) {
      const rx = Math.min(w * 0.13, 34);
      return { main: `M${r1(x + rx)},${r1(y)} H${r1(x + w)} A${r1(rx)},${r1(h / 2)} 0 0 0 ${r1(x + w)},${r1(y + h)} H${r1(x + rx)} A${r1(rx)},${r1(h / 2)} 0 0 1 ${r1(x + rx)},${r1(y)} Z` };
    },
  },
  fcconnector: { name: T('Konnektor'), size: [64, 64], round: true, def: { fontSize: 14 }, text: [0.12, 0.12, 0.76, 0.76, 2], draw: (x, y, w, h) => ({ main: ellipseD(x + w / 2, y + h / 2, w / 2, h / 2) }) },
  annotleft: { name: T('Anmerkung links'), size: [200, 90], def: { fill: 'transparent', align: 'left' }, text: [0.05, 0, 0.93, 1, 6], draw: (x, y, w, h) => ({ main: bracketD(x, y, w, h, 1) }) },
  annotright: { name: T('Anmerkung rechts'), size: [200, 90], def: { fill: 'transparent', align: 'right' }, text: [0.02, 0, 0.93, 1, 6], draw: (x, y, w, h) => ({ main: bracketD(x, y, w, h, -1) }) },
  seqaccess: {
    name: T('Sequenzzugriff'), size: [110, 110], round: true, text: [0.15, 0.15, 0.7, 0.7, 2],
    draw(x, y, w, h) {
      const cx = x + w / 2, cy = y + h / 2;
      return { main: ellipseD(cx, cy, w / 2, h / 2), outer: `M${r1(cx)},${r1(y + h)} H${r1(x + w)}` };
    },
  },
  // BPMN: Ereignisse
  eventmsg: { name: T('Startereignis Nachricht'), ev: ['start', 'msg'] },
  eventtimer: { name: T('Startereignis Zeit'), ev: ['start', 'timer'] },
  eventerror: { name: T('Startereignis Fehler'), ev: ['start', 'error'] },
  eventsignal: { name: T('Startereignis Signal'), ev: ['start', 'signal'] },
  eventcancel: { name: T('Startereignis Abbruch'), ev: ['start', 'cancel'] },
  intermsg: { name: T('Zwischenereignis Nachricht'), ev: ['inter', 'msg'] },
  intertimer: { name: T('Zwischenereignis Zeit'), ev: ['inter', 'timer'] },
  intererror: { name: T('Zwischenereignis Fehler'), ev: ['inter', 'error'] },
  intersignal: { name: T('Zwischenereignis Signal'), ev: ['inter', 'signal'] },
  intercancel: { name: T('Zwischenereignis Abbruch'), ev: ['inter', 'cancel'] },
  endmsg: { name: T('Endereignis Nachricht'), ev: ['end', 'msg'] },
  endtimer: { name: T('Endereignis Zeit'), ev: ['end', 'timer'] },
  enderror: { name: T('Endereignis Fehler'), ev: ['end', 'error'] },
  endsignal: { name: T('Endereignis Signal'), ev: ['end', 'signal'] },
  endcancel: { name: T('Endereignis Abbruch'), ev: ['end', 'cancel'] },
  // BPMN: Aufgaben und Bausteine
  taskuser: { name: T('Benutzeraufgabe'), task: 'user' },
  taskservice: { name: T('Dienstaufgabe'), task: 'service' },
  taskscript: { name: T('Skriptaufgabe'), task: 'script' },
  tasksend: { name: T('Sendeaufgabe'), task: 'send' },
  taskreceive: { name: T('Empfangsaufgabe'), task: 'receive' },
  taskmanual: { name: T('Manuelle Aufgabe'), task: 'manual' },
  bpmnsub: {
    name: T('Teilprozess'), size: [200, 120], def: { fontSize: 15 }, text: [0, 0, 1, 0.78, 8],
    draw(x, y, w, h) {
      const s = Math.min(16, Math.min(w, h) * 0.2), bx = x + w / 2 - s / 2, by = y + h - s - Math.min(5, h * 0.06);
      return { main: rrectD(x, y, w, h, Math.min(w, h) * 0.12), lines: rectD(bx, by, s, s) + ' ' + lineD(bx + s / 2, by + s * 0.2, bx + s / 2, by + s * 0.8) + ' ' + lineD(bx + s * 0.2, by + s / 2, bx + s * 0.8, by + s / 2) };
    },
  },
  gatewayevent: {
    name: T('Ereignisbasiertes Gateway'), size: [72, 72], below: true, def: { fontSize: 12 }, outlineOf: 'diamond',
    draw(x, y, w, h) {
      const cx = x + w / 2, cy = y + h / 2, a = w * 0.25, b = h * 0.25, g = glyph(cx, cy, Math.min(w, h) * 0.34);
      return { main: diamondD(x, y, w, h), lines: ellipseD(cx, cy, a, b) + ' ' + ellipseD(cx, cy, a * 0.8, b * 0.8) + ' ' + g.closed(regular(5).map(([u, v]) => [u * 0.42, v * 0.42])) };
    },
  },
  gatewaycomplex: {
    name: T('Komplexes Gateway'), size: [72, 72], below: true, def: { fontSize: 12 }, outlineOf: 'diamond',
    draw(x, y, w, h) {
      const cx = x + w / 2, cy = y + h / 2, a = w * 0.23, b = h * 0.23, k = Math.SQRT1_2;
      return { main: diamondD(x, y, w, h), lines: [[1, 0], [0, 1], [k, k], [k, -k]].map(([u, v]) => lineD(cx - u * a, cy - v * b, cx + u * a, cy + v * b)).join(' ') };
    },
  },
  dataobject: {
    name: T('Datenobjekt'), size: [72, 92], below: true, def: { fontSize: 13 },
    draw(x, y, w, h) {
      const f = Math.min(w, h) * 0.26;
      return { main: `M${r1(x)},${r1(y)} H${r1(x + w - f)} L${r1(x + w)},${r1(y + f)} V${r1(y + h)} H${r1(x)} Z`, lines: `M${r1(x + w - f)},${r1(y)} V${r1(y + f)} H${r1(x + w)}` };
    },
  },
  datastore: {
    name: T('Datenspeicher'), size: [84, 84], below: true, def: { fontSize: 13 },
    draw(x, y, w, h) {
      const ry = Math.min(h * 0.14, 16), arc = (d) => `M${r1(x)},${r1(y + d)} A${r1(w / 2)},${r1(ry)} 0 0 0 ${r1(x + w)},${r1(y + d)}`;
      return { main: `M${r1(x)},${r1(y + ry)} A${r1(w / 2)},${r1(ry)} 0 0 1 ${r1(x + w)},${r1(y + ry)} V${r1(y + h - ry)} A${r1(w / 2)},${r1(ry)} 0 0 1 ${r1(x)},${r1(y + h - ry)} Z`, lines: [ry, ry * 1.8, ry * 2.6].map(arc).join(' ') };
    },
  },
  pool: {
    name: T('Pool'), size: [760, 260], def: { fontSize: 16, bold: true }, vertical: (w) => hd(w, 0.08),
    draw: (x, y, w, h) => ({ main: rectD(x, y, w, h), lines: lineD(x + hd(w, 0.08), y, x + hd(w, 0.08), y + h) }),
  },
  lane: {
    name: T('Lane'), size: [720, 130], def: { fontSize: 14 }, vertical: (w) => hd(w, 0.06),
    draw: (x, y, w, h) => ({ main: rectD(x, y, w, h), lines: lineD(x + hd(w, 0.06), y, x + hd(w, 0.06), y + h) }),
  },
  // UML
  umlinterface: { name: T('Schnittstelle'), size: [220, 130], columns: true, def: { fontSize: 14, align: 'left', valign: 'top', text: T('«interface»\nName\n--\n+ methode(): Typ') } },
  umlobject: { name: T('Objekt'), size: [220, 110], columns: true, def: { fontSize: 14, align: 'left', valign: 'top', text: T('objekt : Klasse\n--\nattribut = Wert') } },
  lifeline: {
    name: T('Lebenslinie'), size: [150, 340], hit: true, def: { fontSize: 15 }, outline: [[-1, -1], [1, -1], [1, -0.67], [0.05, -0.67], [0.05, 1], [-0.05, 1], [-0.05, -0.67], [-1, -0.67]],
    text: (x, y, w, h) => ({ x: x + 6, y: y + 4, w: Math.max(4, w - 12), h: Math.max(4, lifeHead(h) - 8) }),
    draw: (x, y, w, h) => ({ main: rectD(x, y, w, lifeHead(h)), outer: lineD(x + w / 2, y + lifeHead(h), x + w / 2, y + h), outerDash: true }),
  },
  activation: { name: T('Aktivierung'), size: [18, 120], text: [0, 0, 1, 1, 1], def: { fontSize: 10 }, draw: (x, y, w, h) => ({ main: rectD(x, y, w, h) }) },
  fragment: {
    name: T('Fragment'), size: [420, 240], def: { fill: 'transparent', fontSize: 13, text: 'alt', align: 'left' },
    text: (x, y, w, h) => ({ x: x + 6, y: y + 2, w: Math.max(4, tagW(w) - 18), h: Math.max(4, tagH(h) - 4) }),
    draw(x, y, w, h) {
      const a = tagW(w), b = tagH(h), c = Math.min(10, b * 0.45);
      return { main: rectD(x, y, w, h), lines: `M${r1(x)},${r1(y + b)} H${r1(x + a - c)} L${r1(x + a)},${r1(y + b - c)} V${r1(y)}` };
    },
  },
  // ERD
  erweak: { name: T('Schwache Entität'), size: [200, 100], text: [0.06, 0.1, 0.88, 0.8, 4], draw(x, y, w, h) { const d = Math.min(6, Math.min(w, h) * 0.08); return { main: rectD(x, y, w, h), lines: rectD(x + d, y + d, w - d * 2, h - d * 2) }; } },
  erkey: { name: T('Schlüsselattribut'), size: [180, 90], round: true, def: { underline: true, fontSize: 16 }, text: [0.14, 0.14, 0.72, 0.72, 2], draw: (x, y, w, h) => ({ main: ellipseD(x + w / 2, y + h / 2, w / 2, h / 2) }) },
  ertable: { name: T('Tabelle mit Spalten'), size: [240, 170], columns: true, def: { fontSize: 14, align: 'left', valign: 'top', text: T('Tabelle\n--\nid PK\nname\nfremd_id FK') } },
  // Data Flow
  dfdprocess: { name: T('Prozess (Kreis)'), size: [140, 140], round: true, text: [0.15, 0.15, 0.7, 0.7, 4], def: { fontSize: 16 }, draw: (x, y, w, h) => ({ main: ellipseD(x + w / 2, y + h / 2, w / 2, h / 2) }) },
  dfdstore: {
    name: T('Offener Datenspeicher'), size: [240, 64], text: [0.16, 0, 0.82, 1, 6], def: { fontSize: 16 },
    draw: (x, y, w, h) => ({ main: `M${r1(x + w)},${r1(y)} H${r1(x)} V${r1(y + h)} H${r1(x + w)}`, lines: lineD(x + w * 0.14, y, x + w * 0.14, y + h) }),
  },
  // Value Stream
  vsmprocess: { name: T('Prozesskasten'), size: [170, 150], columns: true, def: { fontSize: 14, align: 'left', valign: 'top', text: T('Prozess\n--\nZ/Z =\nR/Z =\nSchichten =') } },
  vsmsupplier: { name: T('Lieferant / Kunde'), size: [170, 120], poly: [[-1, 1], [-1, -1], [-0.33, -0.4], [-0.33, -1], [0.33, -0.4], [0.33, -1], [1, -0.4], [1, 1]], text: [0.04, 0.42, 0.92, 0.56, 4], def: { fontSize: 15 } },
  vsminventory: { name: T('Bestandsdreieck'), size: [84, 74], below: true, poly: [[0, -1], [1, 1], [-1, 1]], def: { fontSize: 13 }, draw: (x, y, w, h) => ({ main: polyD([[0, -1], [1, 1], [-1, 1]], x, y, w, h), lines: lineD(x + w / 2, y + h * 0.38, x + w / 2, y + h * 0.84) + ' ' + lineD(x + w * 0.42, y + h * 0.38, x + w * 0.58, y + h * 0.38) + ' ' + lineD(x + w * 0.42, y + h * 0.84, x + w * 0.58, y + h * 0.84) }) },
  vsmwarehouse: { name: T('Lager'), size: [92, 96], below: true, def: { fill: 'transparent', fontSize: 13 }, draw: (x, y, w, h) => ({ main: `M${r1(x)},${r1(y)} H${r1(x + w)} V${r1(y + h)} H${r1(x)}`, lines: lineD(x, y + h / 3, x + w, y + h / 3) + ' ' + lineD(x, y + (h * 2) / 3, x + w, y + (h * 2) / 3) }) },
  vsmkaizen: { name: T('Kaizen-Blitz'), size: [200, 140], poly: STAR_BURST, text: [0.24, 0.26, 0.52, 0.48, 2], def: { fontSize: 14 } },
  vsmpush: {
    name: T('Push-Pfeil'), size: [190, 64], below: true, def: { fontSize: 13 }, poly: [[-1, -0.5], [0.45, -0.5], [0.45, -1], [1, 0], [0.45, 1], [0.45, 0.5], [-1, 0.5]],
    draw(x, y, w, h) {
      const bar = (a, b) => rectD(x + w * a, y + h * 0.25, w * b, h * 0.5);
      return { main: polyD([[-1, -0.5], [0.45, -0.5], [0.45, -1], [1, 0], [0.45, 1], [0.45, 0.5], [-1, 0.5]], x, y, w, h), solid: bar(0.08, 0.1) + ' ' + bar(0.26, 0.1) + ' ' + bar(0.44, 0.1) };
    },
  },
  vsmpull: {
    name: T('Pull'), size: [84, 84], round: true, below: true, def: { fill: 'transparent', fontSize: 13 },
    draw(x, y, w, h) {
      const cx = x + w / 2, cy = y + h / 2, rx = w * 0.42, ry = h * 0.42;
      const pt = (deg, k = 1) => [cx + Math.cos((deg * Math.PI) / 180) * rx * k, cy + Math.sin((deg * Math.PI) / 180) * ry * k];
      const [ax, ay] = pt(-50), [bx, by] = pt(-130), [ix, iy] = pt(-152, 0.72), [ox, oy] = pt(-152, 1.3), [tx, ty] = pt(-118);
      return { main: `M${r1(ax)},${r1(ay)} A${r1(rx)},${r1(ry)} 0 1 1 ${r1(bx)},${r1(by)}`, solid: `M${r1(tx)},${r1(ty)} L${r1(ix)},${r1(iy)} L${r1(ox)},${r1(oy)} Z` };
    },
  },
  vsmdata: { name: T('Datenkasten'), size: [170, 120], columns: true, def: { fontSize: 14, align: 'left', valign: 'top', text: T('Daten\n--\nZ/Z =\nLos =') } },
  // Architektur
  archlayer: {
    name: T('Schicht'), size: [680, 96], def: { fontSize: 15, bold: true }, text: (x, y, w, h) => ({ x: x + 8, y: y + 6, w: Math.max(4, Math.min(w * 0.2, 150) - 16), h: Math.max(4, h - 12) }),
    draw(x, y, w, h) {
      const a = Math.min(w * 0.2, 150);
      return { main: rrectD(x, y, w, h, Math.min(w, h) * 0.08), lines: lineD(x + a, y, x + a, y + h) };
    },
  },
  archservice: {
    name: T('Dienst'), size: [200, 110], def: { fontSize: 16 }, text: [0.04, 0.04, 0.76, 0.92, 6],
    draw(x, y, w, h) {
      const s = Math.min(w, h) * 0.2;
      return { main: rrectD(x, y, w, h, Math.min(w, h) * 0.14), lines: gearD(x + w - s * 0.7, y + s * 0.7, s * 0.5) };
    },
  },
  archboundary: {
    name: T('Container-Rahmen'), size: [440, 280], def: { fill: 'transparent', dash: true, fontSize: 15, bold: true, align: 'left', valign: 'top' },
    draw: (x, y, w, h) => ({ main: rrectD(x, y, w, h, Math.min(w, h) * 0.05) }),
  },
};

for (const [k, s] of Object.entries(CUSTOM)) {
  if (s.ev) Object.assign(s, { size: [56, 56], round: true, below: true, def: { fontSize: 12 }, draw: eventShape(s.ev[0], s.ev[1]) });
  if (s.task) Object.assign(s, { size: [190, 110], def: { fontSize: 15 }, text: [0.05, 0.22, 0.9, 0.74, 3], draw: taskShape(s.task) });
  if (s.poly && !s.draw) s.draw = (x, y, w, h) => ({ main: polyD(s.poly, x, y, w, h) });
  CUSTOM[k] = s;
}

export const CATALOG_SHAPES = Object.entries(CUSTOM).map(([k, s]) => [k, s.name]);
export const CATALOG_DRAW = Object.fromEntries(Object.entries(CUSTOM).filter(([, s]) => s.draw).map(([k, s]) => [k, s.draw]));
export const CATALOG_DEFAULTS = Object.fromEntries(Object.entries(CUSTOM).map(([k, s]) => [k, { ...(s.size ? { w: s.size[0], h: s.size[1] } : {}), ...s.def }]));
export const CATALOG_BELOW = Object.keys(CUSTOM).filter((k) => CUSTOM[k].below);
export const CATALOG_ROUND = Object.keys(CUSTOM).filter((k) => CUSTOM[k].round);
export const CATALOG_HIT = new Set(Object.keys(CUSTOM).filter((k) => CUSTOM[k].hit));
export const CATALOG_COLUMNS = new Set(Object.keys(CUSTOM).filter((k) => CUSTOM[k].columns));
// Text um 90° gedreht im Kopfstreifen links (Pool, Lane)
export const CATALOG_VERTICAL = new Set(Object.keys(CUSTOM).filter((k) => CUSTOM[k].vertical));
export const CATALOG_OUTLINES = Object.fromEntries(Object.entries(CUSTOM).filter(([, s]) => s.outline || s.poly).map(([k, s]) => [k, s.outline || s.poly]));
export const CATALOG_OUTLINE_OF = Object.fromEntries(Object.entries(CUSTOM).filter(([, s]) => s.outlineOf).map(([k, s]) => [k, s.outlineOf]));

export function catalogTextBox(kind, x, y, w, h, pad) {
  if (!Object.hasOwn(CUSTOM, kind)) return null;
  const s = CUSTOM[kind];
  if (s.vertical) {
    const b = s.vertical(w);
    return { x: x + b / 2 - h / 2, y: y + h / 2 - b / 2, w: h, h: b };
  }
  if (typeof s.text === 'function') return s.text(x, y, w, h);
  const [ix, iy, iw, ih, p = pad] = s.text || [0, 0, 1, 1];
  return { x: x + w * ix + p, y: y + h * iy + p, w: Math.max(4, w * iw - p * 2), h: Math.max(4, h * ih - p * 2) };
}

/* ---------------- Pakete ---------------- */

// Die Kennungen stehen auch in lib/settings.js (SHAPE_PACK_IDS). „basic“ lässt sich nicht abschalten: Die Tasten S, R und O brauchen eine Form.
export const SHAPE_PACKS = [
  { id: 'basic', name: T('Grundformen'), keys: ['rect', 'roundrect', 'ellipse', 'diamond', 'triangle', 'pentagon', 'hexagon', 'octagon', 'parallelogram', 'trapezoid', 'star', 'pill', 'arrow', 'leftarrow', 'doublearrow', 'chevron', 'arrowflag', 'callout', 'bubble', 'cross', 'cloud', 'cloudround', 'cloudwide', 'cloudthought', 'braceleft', 'braceright', 'barprocess', 'snipcorner'] },
  // Die Symbole kommen erst mit der Symboldatei (public/js/icons.js), darum hat das Paket keine festen Einträge
  { id: 'icons', name: T('Allgemeine Symbole'), keys: [], lazy: true },
  {
    id: 'flow', name: T('Flussdiagramm'),
    keys: ['pill', 'rect', 'diamond', 'parallelogram', 'document', 'multidoc', 'subprocess', 'preparation', 'manualinput', 'manualop', 'cylinder', 'directstorage', 'internalstorage', 'delay', 'display', 'punchcard', 'punchtape', 'fcor', 'fcsum', 'fcsort', 'fcmerge', 'fcextract', 'collate', 'fcloop', 'storeddata', 'fcconnector', 'offpage', 'annotleft', 'annotright', 'seqaccess'],
    labels: () => ({ pill: T('Start / Ende'), rect: T('Prozess'), diamond: T('Entscheidung'), parallelogram: T('Daten'), subprocess: T('Vordefinierter Prozess'), cylinder: T('Datenbank'), manualop: T('Manueller Vorgang'), offpage: T('Seitenverweis') }),
  },
  {
    id: 'bpmn', name: T('BPMN (Prozesse)'),
    keys: ['event', 'eventmsg', 'eventtimer', 'eventerror', 'eventsignal', 'eventcancel', 'eventinter', 'intermsg', 'intertimer', 'intererror', 'intersignal', 'intercancel', 'eventend', 'endmsg', 'endtimer', 'enderror', 'endsignal', 'endcancel', 'roundrect', 'taskuser', 'taskservice', 'taskscript', 'tasksend', 'taskreceive', 'taskmanual', 'bpmnsub', 'gatewayx', 'gatewayplus', 'gatewayo', 'gatewayevent', 'gatewaycomplex', 'dataobject', 'datastore', 'annotleft', 'pool', 'lane'],
    labels: () => ({ roundrect: T('Aufgabe'), annotleft: T('Annotation') }),
  },
  {
    id: 'uml', name: T('UML'),
    keys: ['umlclass', 'umlinterface', 'umlobject', 'ellipse', 'actor', 'package', 'component', 'umlnode', 'note', 'roundrect', 'initial', 'final', 'diamond', 'forkbar', 'lifeline', 'activation', 'fragment', 'send', 'receive'],
    labels: () => ({ ellipse: T('Anwendungsfall'), roundrect: T('Zustand'), diamond: T('Entscheidung'), initial: T('Start'), final: T('Ende') }),
  },
  { id: 'erd', name: T('ERD (Datenmodell)'), keys: ['rect', 'erweak', 'diamond', 'ellipse', 'erkey', 'ertable'], labels: () => ({ rect: T('Entität'), diamond: T('Beziehung'), ellipse: T('Attribut') }) },
  { id: 'dfd', name: T('Data Flow'), keys: ['dfdprocess', 'rect', 'dfdstore'], labels: () => ({ rect: T('Externer Akteur') }) },
  { id: 'vsm', name: T('Value Stream'), keys: ['vsmprocess', 'vsmsupplier', 'vsminventory', 'vsmwarehouse', 'vsmkaizen', 'vsmpush', 'vsmpull', 'vsmdata'] },
  { id: 'arch', name: T('Architektur'), keys: ['archlayer', 'archservice', 'queue', 'container', 'archboundary'], labels: () => ({ queue: T('Warteschlange'), container: T('Container') }) },
  { id: 'net', name: T('Netzwerk & Rechenzentrum'), keys: ['router', 'switch', 'firewall', 'loadbalancer', 'accesspoint', 'internet', 'cloud', 'server', 'rack', 'storage', 'desktop', 'laptop', 'mobile', 'users'] },
  { id: 'it', name: T('Software & IT'), keys: ['server', 'cylinder', 'queue', 'container', 'browser', 'laptop', 'firewall', 'cloud', 'actor', 'component', 'gear', 'lock'] },
  { id: 'k8s', name: T('Container-Plattform'), keys: ['pod', 'deployment', 'k8sservice', 'ingress', 'k8snode', 'configmap', 'secret', 'volume'] },
];

// Untergruppen des Pakets „Allgemeine Symbole“. Kennungen und Zuordnung: scripts/build-icons.js
export const ICON_GROUPS = [
  ['arrows', T('Pfeile und Navigation')], ['comm', T('Kommunikation')], ['people', T('Personen')], ['files', T('Dateien')], ['devices', T('Geräte')], ['business', T('Geschäft')], ['weather', T('Wetter')],
  ['time', T('Zeit')], ['system', T('System und Oberfläche')], ['dev', T('Entwicklung und Daten')], ['design', T('Gestaltung und Medien')], ['places', T('Orte und Verkehr')], ['nature', T('Natur und Freizeit')], ['signs', T('Formen und Zeichen')],
];

// Pakete, die eine Person gerade sehen soll. Die Grundformen sind immer dabei, Abgewähltes ändert nichts an vorhandenen Elementen.
export function visiblePacks(adminOff = [], userOff = []) {
  return SHAPE_PACKS.filter((p) => p.id === 'basic' || (!adminOff.includes(p.id) && !userOff.includes(p.id)));
}

// Weitere Suchwörter. Der Name selbst und das Paket sind ohnehin durchsuchbar.
export function shapeSynonyms() {
  const start = T('beginn auslöser start'), inter = T('zwischen warten eingetreten'), end = T('abschluss schluss ende');
  const mark = { msg: T('brief mail nachricht message'), timer: T('uhr timer termin frist'), error: T('ausnahme exception blitz'), signal: T('broadcast rundruf dreieck'), cancel: T('storno rollback kreuz') };
  const out = {
    rect: T('viereck quadrat kasten box'), roundrect: T('abgerundetes rechteck karte zustand aufgabe task'), ellipse: T('kreis oval rund'), diamond: T('entscheidung verzweigung bedingung wenn'),
    triangle: T('pyramide spitze'), hexagon: T('wabe vorbereitung'), star: T('bewertung favorit'), pill: T('terminator start ende kapsel'), arrow: T('rechtspfeil richtung weiter'),
    callout: T('sprechblase kommentar zitat'), cross: T('plus hinzufügen'), cloud: T('internet dienst online'), cylinder: T('datenbank speicher tonne sql'), document: T('datei papier bericht'),
    multidoc: T('mehrfachdokument stapel dateien'), subprocess: T('vordefinierter prozess unterprogramm'), manualinput: T('tastatur eingeben formular'), manualop: T('manueller vorgang handarbeit'),
    display: T('bildschirm monitor ausgabe'), offpage: T('seitenverweis sprungmarke andere seite'), internalstorage: T('arbeitsspeicher ram'), delay: T('warten pause'),
    note: T('anmerkung hinweis eselsohr'), package: T('ordner namensraum'), actor: T('person benutzer strichmännchen'), umlclass: T('klasse attribut methode'), umlnode: T('quader verteilung server'),
    initial: T('startpunkt anfang'), final: T('endpunkt schluss'), forkbar: T('balken parallel synchronisation'), send: T('senden signal'), receive: T('empfangen signal'),
    gatewayx: T('exklusiv xor entweder oder'), gatewayplus: T('parallel und and'), gatewayo: T('inklusiv oder or'), queue: T('warteschlange nachrichten kafka'), container: T('docker box'),
    pentagon: T('pentagon fünf ecken'), octagon: T('oktagon stoppschild acht ecken'), bubble: T('sprechen dialog kommentar'), doublearrow: T('beidseitig hin und her'), leftarrow: T('zurück richtung'),
    braceleft: T('klammer gruppe zusammenfassen'), braceright: T('klammer gruppe zusammenfassen'), chevron: T('winkel phase schritt ablauf'), arrowflag: T('fahne etikett meilenstein'),
    barprocess: T('modul bibliothek seitenleiste'), cloudround: T('wolke rund'), cloudwide: T('wolke breit'), cloudthought: T('wolke idee denken überlegen'), snipcorner: T('ecke schräg abgeschnitten karte'),
    preparation: T('sechseck initialisierung einrichten'), directstorage: T('festplatte trommel liegender zylinder'), punchcard: T('karte alt datenträger'), punchtape: T('band streifen welle'),
    fcor: T('oder verknüpfung plus kreis'), fcsum: T('summe und kreuz kreis'), fcsort: T('reihenfolge ordnen'), fcmerge: T('zusammenfassen dreieck unten'), fcextract: T('auszug herausziehen dreieck oben'),
    collate: T('sanduhr ordnen zusammenstellen'), fcloop: T('schleife wiederholung anfang ende'), storeddata: T('speicher band ablage'), fcconnector: T('sprungmarke verbindung kreis'),
    annotleft: T('kommentar erläuterung klammer'), annotright: T('kommentar erläuterung klammer'), seqaccess: T('magnetband band tape'),
    taskuser: T('person mensch formular'), taskservice: T('automatisch api zahnrad'), taskscript: T('code automatisch'), tasksend: T('nachricht ausgehend'), taskreceive: T('nachricht eingehend'), taskmanual: T('hand ohne system'),
    bpmnsub: T('unterprozess aufklappen zusammengeklappt'), gatewayevent: T('warten pentagon event'), gatewaycomplex: T('stern asterisk komplex'), dataobject: T('dokument datei eingabe ausgabe'), datastore: T('datenbank ablage'),
    pool: T('swimlane teilnehmer organisation bahn'), lane: T('swimlane rolle bahn abteilung'), umlinterface: T('interface vertrag'), umlobject: T('instanz exemplar'), lifeline: T('sequenzdiagramm teilnehmer zeitachse'),
    activation: T('ausführung balken sequenzdiagramm'), fragment: T('alt opt loop rahmen sequenzdiagramm'), erweak: T('abhängig doppelter rahmen'), erkey: T('primärschlüssel unterstrichen id'), ertable: T('datenbank spalten zeilen schema krähenfuß'),
    dfdprocess: T('kreis yourdon verarbeitung'), dfdstore: T('datei ablage yourdon'), vsmprocess: T('wertstrom schritt arbeitsplatz'), vsmsupplier: T('fabrik firma werk'), vsminventory: T('lagerbestand i dreieck'),
    vsmwarehouse: T('supermarkt regal bestand'), vsmkaizen: T('verbesserung stern explosion'), vsmpush: T('schieben gestreift materialfluss'), vsmpull: T('ziehen kanban kreispfeil'), vsmdata: T('kennzahlen zykluszeit rüstzeit'),
    archlayer: T('layer ebene tier'), archservice: T('microservice api backend'), archboundary: T('gruppe abgrenzung vpc grenze gestrichelt'),
  };
  for (const [k, s] of Object.entries(CUSTOM)) if (s.ev) out[k] = `${{ start, inter, end }[s.ev[0]]} ${mark[s.ev[1]]}`;
  return out;
}
