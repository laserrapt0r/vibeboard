/*
 * Verborgene Bereiche: Frames mit „concealed“ verdecken ihren Inhalt für alle außer den Moderierenden.
 * Gemeinsam für Browser und Server, damit beide dieselben Elemente als verborgen ansehen.
 * Im Browser als klassisches Skript geladen (globalThis.ConcealOps), auf dem Server per require().
 */
(function (root) {
  'use strict';

  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  function center(el) {
    if (el.type === 'comment') return { x: num(el.x) + 15, y: num(el.y) - 15 };
    return { x: num(el.x) + num(el.w) / 2, y: num(el.y) + num(el.h) / 2 };
  }

  const inside = (p, f) => p.x >= num(f.x) && p.x <= num(f.x) + num(f.w) && p.y >= num(f.y) && p.y <= num(f.y) + num(f.h);

  // Liefert die Kennungen aller verborgenen Elemente (ohne die verbergenden Frames selbst)
  function concealedIds(elements) {
    const list = elements instanceof Map ? [...elements.values()] : Array.isArray(elements) ? elements : Object.values(elements || {});
    const areas = list.filter((e) => e && e.type === 'frame' && e.concealed);
    const out = new Set();
    if (!areas.length) return out;
    const areaIds = new Set(areas.map((f) => f.id));
    for (const el of list) {
      if (!el || el.type === 'connector' || areaIds.has(el.id)) continue;
      const c = center(el);
      if (areas.some((f) => inside(c, f))) out.add(el.id);
    }
    // Verbindungen: verborgen, wenn ein Ende an einem verborgenen Element hängt oder beide freien Enden im Bereich liegen
    for (const el of list) {
      if (!el || el.type !== 'connector') continue;
      const ends = [el.from || {}, el.to || {}];
      if (ends.some((e) => e.id && out.has(e.id))) out.add(el.id);
      else if (ends.every((e) => !e.id && areas.some((f) => inside({ x: num(e.x), y: num(e.y) }, f)))) out.add(el.id);
    }
    return out;
  }

  // Liegt ein (neues oder verschobenes) Element in einem verborgenen Bereich?
  function inConcealedArea(el, elements) {
    if (!el || el.type === 'connector') return false;
    const list = elements instanceof Map ? [...elements.values()] : Array.isArray(elements) ? elements : Object.values(elements || {});
    const c = center(el);
    return list.some((f) => f && f.type === 'frame' && f.concealed && f.id !== el.id && inside(c, f));
  }

  const api = { concealedIds, inConcealedArea };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ConcealOps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
