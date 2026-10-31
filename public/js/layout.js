// Automatisches Layout: reine Berechnung, ohne Zugriff auf das Board.
// Eingabe: nodes [{ id, x, y, w, h }], edges [{ from, to }]. Ausgabe: Map id -> { x, y }.

const GAP_LAYER = 100;
const GAP_NODE = 40;

function adjacency(nodes, edges) {
  const ids = new Set(nodes.map((n) => n.id));
  const out = new Map(nodes.map((n) => [n.id, []]));
  const inc = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
    out.get(e.from).push(e.to);
    inc.get(e.to).push(e.from);
  }
  return { out, inc };
}

// Rückwärtskanten (Zyklen) ignorieren, damit jede Kante „vorwärts“ zeigt
function forwardEdges(nodes, out) {
  const state = new Map();
  const keep = [];
  const visit = (start) => {
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
      const to = list[top[1]++];
      if (state.get(to) === 1) continue;
      keep.push([top[0], to]);
      if (!state.has(to)) {
        state.set(to, 1);
        stack.push([to, 0]);
      }
    }
  };
  for (const n of nodes) if (!state.has(n.id)) visit(n.id);
  return keep;
}

function ranks(nodes, edges) {
  const rank = new Map(nodes.map((n) => [n.id, 0]));
  const incoming = new Map(nodes.map((n) => [n.id, 0]));
  const next = new Map(nodes.map((n) => [n.id, []]));
  for (const [a, b] of edges) {
    incoming.set(b, incoming.get(b) + 1);
    next.get(a).push(b);
  }
  const queue = nodes.filter((n) => !incoming.get(n.id)).map((n) => n.id);
  while (queue.length) {
    const id = queue.shift();
    for (const to of next.get(id)) {
      rank.set(to, Math.max(rank.get(to), rank.get(id) + 1));
      incoming.set(to, incoming.get(to) - 1);
      if (!incoming.get(to)) queue.push(to);
    }
  }
  return rank;
}

// Schichten nach dem Mittelwert der Nachbarn sortieren, das verringert Kreuzungen
function orderLayers(layers, edges) {
  const pos = new Map();
  const remember = () => layers.forEach((l) => l.forEach((id, i) => pos.set(id, i)));
  remember();
  const nearby = (id, list) => {
    const v = list.filter(([a, b]) => a === id || b === id).map(([a, b]) => pos.get(a === id ? b : a));
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : pos.get(id);
  };
  for (let round = 0; round < 6; round++) {
    const seq = round % 2 ? [...layers].reverse() : layers;
    for (const layer of seq) {
      const key = new Map(layer.map((id) => [id, nearby(id, edges)]));
      layer.sort((a, b) => key.get(a) - key.get(b));
      layer.forEach((id, i) => pos.set(id, i));
    }
  }
}

/** Geschichtetes Layout. dir: 'LR' (von links nach rechts) oder 'TB' (von oben nach unten). */
export function layered(nodes, edges, dir = 'LR', origin = null) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const { out } = adjacency(nodes, edges);
  const forward = forwardEdges(nodes, out);
  const rank = ranks(nodes, forward);
  const layers = [];
  for (const n of [...nodes].sort((a, b) => (dir === 'LR' ? a.y - b.y : a.x - b.x))) {
    (layers[rank.get(n.id)] ||= []).push(n.id);
  }
  const used = layers.filter(Boolean);
  orderLayers(used, forward);
  const lr = dir === 'LR';
  const main = (n) => (lr ? n.w : n.h), cross = (n) => (lr ? n.h : n.w);
  const crossSizes = used.map((l) => l.reduce((s, id) => s + cross(byId.get(id)), 0) + GAP_NODE * (l.length - 1));
  const widest = Math.max(...crossSizes);
  const ox = origin ? origin.x : Math.min(...nodes.map((n) => n.x));
  const oy = origin ? origin.y : Math.min(...nodes.map((n) => n.y));
  const result = new Map();
  let at = 0;
  used.forEach((layer, i) => {
    const thick = Math.max(...layer.map((id) => main(byId.get(id))));
    let c = (widest - crossSizes[i]) / 2;
    for (const id of layer) {
      const n = byId.get(id);
      const m = at + (thick - main(n)) / 2;
      result.set(id, lr ? { x: ox + m, y: oy + c } : { x: ox + c, y: oy + m });
      c += cross(n) + GAP_NODE;
    }
    at += thick + GAP_LAYER;
  });
  return result;
}

/** Baum um eine Wurzel, die direkten Kinder bleiben auf ihrer Seite (Mindmap). */
export function tree(nodes, edges, rootId) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (!links.has(e.from) || !links.has(e.to)) continue;
    links.get(e.from).push(e.to);
    links.get(e.to).push(e.from);
  }
  const kids = new Map();
  const seen = new Set([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    const list = links.get(id).filter((k) => !seen.has(k));
    list.forEach((k) => seen.add(k));
    list.sort((a, b) => byId.get(a).y - byId.get(b).y);
    kids.set(id, list);
    queue.push(...list);
  }
  const height = new Map();
  const measureTree = (id) => {
    const list = kids.get(id) || [];
    const sum = list.reduce((s, k) => s + measureTree(k), 0) + GAP_NODE * Math.max(0, list.length - 1);
    height.set(id, Math.max(byId.get(id).h, sum));
    return height.get(id);
  };
  const root = byId.get(rootId);
  const result = new Map([[rootId, { x: root.x, y: root.y }]]);
  const place = (id, side, left, top) => {
    const n = byId.get(id);
    const h = height.get(id);
    result.set(id, { x: side > 0 ? left : left - n.w, y: top + (h - n.h) / 2 });
    let y = top;
    for (const k of kids.get(id) || []) {
      place(k, side, side > 0 ? left + n.w + GAP_LAYER : left - n.w - GAP_LAYER, y);
      y += height.get(k) + GAP_NODE;
    }
  };
  const first = kids.get(rootId) || [];
  const cx = root.x + root.w / 2;
  let right = first.filter((k) => byId.get(k).x + byId.get(k).w / 2 >= cx);
  let left = first.filter((k) => !right.includes(k));
  // Liegt alles auf einer Seite, verteilt die Mindmap sich gleichmäßig
  if (!left.length && right.length > 3) {
    left = right.filter((_, i) => i % 2);
    right = right.filter((_, i) => !(i % 2));
  }
  measureTree(rootId);
  const side = (list, dir) => {
    const total = list.reduce((s, k) => s + height.get(k), 0) + GAP_NODE * Math.max(0, list.length - 1);
    let y = root.y + root.h / 2 - total / 2;
    for (const k of list) {
      place(k, dir, dir > 0 ? root.x + root.w + GAP_LAYER : root.x - GAP_LAYER, y);
      y += height.get(k) + GAP_NODE;
    }
  };
  side(right, 1);
  side(left, -1);
  return result;
}

/** Prozess in Swimlanes: Spalten nach Abfolge, die Bahn jedes Elements bleibt erhalten. */
export function lanes(nodes, edges, laneOf, laneCount) {
  const { out } = adjacency(nodes, edges);
  const rank = ranks(nodes, forwardEdges(nodes, out));
  const cells = new Map();
  for (const n of [...nodes].sort((a, b) => a.y - b.y)) {
    const key = `${rank.get(n.id)}:${laneOf(n)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(n);
  }
  const colCount = Math.max(...nodes.map((n) => rank.get(n.id))) + 1;
  const colW = Array.from({ length: colCount }, (_, c) => Math.max(0, ...nodes.filter((n) => rank.get(n.id) === c).map((n) => n.w)));
  const laneH = Array.from({ length: laneCount }, (_, l) => {
    let need = 0;
    for (let c = 0; c < colCount; c++) {
      const list = cells.get(`${c}:${l}`) || [];
      need = Math.max(need, list.reduce((s, n) => s + n.h, 0) + GAP_NODE * Math.max(0, list.length - 1));
    }
    return need;
  });
  return { rank, cells, colW, laneH, colCount, GAP_LAYER, GAP_NODE };
}
