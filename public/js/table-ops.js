/*
 * Zellgenaue Änderungen an Tabellen – gemeinsam für Browser und Server, damit beide identisch rechnen.
 * Im Browser als klassisches Skript geladen (globalThis.TableOps), auf dem Server per require().
 *
 * Patch:     { cells: [[r, c, text]], styles: [[r, c, style | null]], props: { … } }
 * Struktur:  { action: 'insertRows' | 'insertCols' | 'deleteRows' | 'deleteCols', at, count, size }
 *            size = Höhe bzw. Breite jeder eingefügten Zeile/Spalte in Pixeln
 */
(function (root) {
  'use strict';

  // Diese Eigenschaften dürfen per Patch geändert werden (Zellinhalte und -formate laufen separat)
  const PROPS = ['x', 'y', 'w', 'h', 'z', 'colW', 'rowH', 'header', 'headerFill', 'stroke', 'fill', 'fontSize', 'textColor', 'locked', 'groupId', 'link'];

  function fractions(list, n) {
    const ok = Array.isArray(list) && list.length === n && list.every((v) => Number.isFinite(v) && v > 0);
    if (!ok) return Array(n).fill(1 / n);
    const sum = list.reduce((a, b) => a + b, 0);
    return list.map((v) => v / sum);
  }

  function grid(t) {
    const rows = Math.max(1, t.rows | 0), cols = Math.max(1, t.cols | 0);
    return {
      rows, cols,
      cells: Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (t.cells && t.cells[r] && t.cells[r][c] != null ? String(t.cells[r][c]) : ''))),
      styles: Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (t.styles && t.styles[r] && t.styles[r][c]) || null)),
      colPx: fractions(t.colW, cols).map((f) => f * t.w),
      rowPx: fractions(t.rowH, rows).map((f) => f * t.h),
    };
  }

  function rebuild(t, g) {
    const w = g.colPx.reduce((a, b) => a + b, 0), h = g.rowPx.reduce((a, b) => a + b, 0);
    return { ...t, rows: g.rowPx.length, cols: g.colPx.length, cells: g.cells, styles: g.styles, w, h, colW: g.colPx.map((v) => v / w), rowH: g.rowPx.map((v) => v / h) };
  }

  // Zellinhalte, Zellformate und Eigenschaften setzen; Zellen außerhalb der Tabelle werden ignoriert
  function applyPatch(t, p) {
    if (!t || t.type !== 'table' || !p) return t;
    const out = { ...t };
    if (Array.isArray(p.cells) && p.cells.length) {
      out.cells = (t.cells || []).map((row) => (Array.isArray(row) ? [...row] : []));
      for (const e of p.cells) {
        if (!Array.isArray(e)) continue;
        const [r, c, text] = e;
        if (!(r >= 0 && r < t.rows && c >= 0 && c < t.cols)) continue;
        while (out.cells.length <= r) out.cells.push([]);
        out.cells[r][c] = String(text == null ? '' : text).slice(0, 10000);
      }
    }
    if (Array.isArray(p.styles) && p.styles.length) {
      out.styles = Array.from({ length: t.rows }, (_, r) => Array.from({ length: t.cols }, (_, c) => (t.styles && t.styles[r] && t.styles[r][c]) || null));
      for (const e of p.styles) {
        if (!Array.isArray(e)) continue;
        const [r, c, st] = e;
        if (!(r >= 0 && r < t.rows && c >= 0 && c < t.cols)) continue;
        out.styles[r][c] = st && typeof st === 'object' && Object.keys(st).length ? st : null;
      }
    }
    if (p.props && typeof p.props === 'object') {
      for (const k of PROPS) {
        if (!(k in p.props)) continue;
        if (p.props[k] === null) delete out[k];
        else out[k] = p.props[k];
      }
    }
    return out;
  }

  // Zeilen/Spalten einfügen oder löschen; liefert null, wenn die Änderung nicht passt
  function applyStruct(t, s) {
    if (!t || t.type !== 'table' || !s) return null;
    const g = grid(t);
    const count = Math.max(1, Math.min(100, s.count | 0 || 1));
    const avg = (list) => list.reduce((a, b) => a + b, 0) / list.length;
    switch (s.action) {
      case 'insertRows': {
        const at = Math.max(0, Math.min(g.rows, s.at | 0));
        if (g.rows + count > 200) return null;
        const size = Number(s.size) > 0 ? Number(s.size) : avg(g.rowPx);
        for (let i = 0; i < count; i++) {
          g.cells.splice(at, 0, Array(g.cols).fill(''));
          g.styles.splice(at, 0, Array(g.cols).fill(null));
          g.rowPx.splice(at, 0, size);
        }
        break;
      }
      case 'insertCols': {
        const at = Math.max(0, Math.min(g.cols, s.at | 0));
        if (g.cols + count > 50) return null;
        const size = Number(s.size) > 0 ? Number(s.size) : avg(g.colPx);
        for (let i = 0; i < count; i++) {
          g.cells.forEach((row) => row.splice(at, 0, ''));
          g.styles.forEach((row) => row.splice(at, 0, null));
          g.colPx.splice(at, 0, size);
        }
        break;
      }
      case 'deleteRows': {
        const at = s.at | 0;
        if (at < 0 || at + count > g.rows || count >= g.rows) return null;
        g.cells.splice(at, count);
        g.styles.splice(at, count);
        g.rowPx.splice(at, count);
        break;
      }
      case 'deleteCols': {
        const at = s.at | 0;
        if (at < 0 || at + count > g.cols || count >= g.cols) return null;
        g.cells.forEach((row) => row.splice(at, count));
        g.styles.forEach((row) => row.splice(at, count));
        g.colPx.splice(at, count);
        break;
      }
      default:
        return null;
    }
    return rebuild(t, g);
  }

  // Wohin wandert Zelle (r, c), wenn eine Strukturänderung angewendet wird? null = Zelle wurde gelöscht
  function mapCell(s, r, c) {
    const count = Math.max(1, s.count | 0 || 1), at = s.at | 0;
    switch (s.action) {
      case 'insertRows': return [r >= at ? r + count : r, c];
      case 'insertCols': return [r, c >= at ? c + count : c];
      case 'deleteRows': return r >= at && r < at + count ? null : [r >= at + count ? r - count : r, c];
      case 'deleteCols': return c >= at && c < at + count ? null : [r, c >= at + count ? c - count : c];
    }
    return [r, c];
  }

  const api = { applyPatch, applyStruct, mapCell, fractions, PROPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TableOps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
