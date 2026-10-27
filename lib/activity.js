'use strict';
const log = require('./log').child('activity');
// Aktivitätsverlauf je Board: wer hat wann was erstellt, geändert, gelöscht oder kommentiert.
// Viele kleine Änderungen derselben Person am selben Element werden innerhalb von fünf Minuten zu einem Eintrag
// zusammengefasst (Zähler), damit der Verlauf lesbar bleibt und die Datenbank nicht mit jedem Tastendruck wächst.
const db = require('./db');

const MERGE_MS = 5 * 60000;
const KEEP_DAYS = 90;
const KEEP_PER_BOARD = 2000;
const KINDS = new Set(['created', 'changed', 'deleted', 'commented', 'resolved', 'reopened', 'assigned', 'renamed', 'revealed', 'restored', 'recorded']);

const buffer = new Map(); // boardId -> Map(key -> { row, dbId, lastAt, dirty })

// Kurze Beschreibung eines Elements für den Verlauf (ohne Bilddaten oder lange Texte)
function labelOf(el) {
  if (!el) return '';
  let t = el.title || el.text || el.label || el.char || '';
  if (!t && el.type === 'table' && Array.isArray(el.cells)) t = (el.cells[0] || []).filter(Boolean).join(' · ');
  if (!t && el.type === 'comment' && Array.isArray(el.thread) && el.thread[0]) t = el.thread[0].text;
  return String(t).replace(/\s+/g, ' ').trim().slice(0, 80);
}

// actor: { userId, name, color }
function record(boardId, actor, kind, el = null, { label, count = 1 } = {}) {
  if (!KINDS.has(kind) || !actor) return;
  // Private Elemente erscheinen erst nach dem Aufdecken im Verlauf
  if (el && el.priv) return;
  const now = Date.now();
  if (!buffer.has(boardId)) buffer.set(boardId, new Map());
  const map = buffer.get(boardId);
  // Erstellen und sofortiges Weiterbearbeiten zählt als „erstellt“
  const key = `${actor.userId}|${el ? el.id : '-'}|${kind === 'changed' && map.has(`${actor.userId}|${el ? el.id : '-'}|created`) ? 'created' : kind}`;
  const cur = map.get(key);
  if (cur && now - cur.lastAt < MERGE_MS) {
    if (kind === 'changed' || kind === 'revealed') cur.row.count += count;
    if (el) cur.row.label = label ?? labelOf(el) ?? cur.row.label;
    cur.lastAt = now;
    cur.dirty = true;
    return;
  }
  map.set(key, {
    row: {
      board_id: boardId, user_id: actor.userId || null, user_name: actor.name || '', user_color: actor.color || null, kind,
      element_id: el ? el.id : null, element_type: el ? el.type : null, label: label ?? labelOf(el), count,
    },
    dbId: null, lastAt: now, dirty: true,
  });
}

let flushing = false;
async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const now = Date.now();
    for (const [bid, map] of buffer) {
      for (const [key, e] of map) {
        if (e.dirty) {
          e.dirty = false;
          const r = e.row;
          try {
            if (e.dbId) {
              await db.query('UPDATE board_activity SET count = $2, label = $3, at = to_timestamp($4 / 1000.0) WHERE id = $1', [e.dbId, r.count, r.label, e.lastAt]);
            } else {
              const row = await db.one(
                `INSERT INTO board_activity (board_id, user_id, user_name, user_color, kind, element_id, element_type, label, count, at)
                 SELECT $1, u.id, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10 / 1000.0)
                   FROM (SELECT 1) x LEFT JOIN users u ON u.id = $2
                  WHERE EXISTS (SELECT 1 FROM boards WHERE id = $1)
                 RETURNING id`,
                [bid, /^\d+$/.test(String(r.user_id)) ? r.user_id : null, r.user_name, r.user_color, r.kind, r.element_id, r.element_type, r.label, r.count, e.lastAt]);
              e.dbId = row ? row.id : -1;
            }
          } catch (err) {
            log.warn('Aktivität konnte nicht gespeichert werden', { boardId: bid, err });
          }
        }
        if (now - e.lastAt > MERGE_MS) map.delete(key);
      }
      if (!map.size) buffer.delete(bid);
    }
  } finally {
    flushing = false;
  }
}

setInterval(flush, 5000).unref();

// Alte Einträge entfernen (täglich)
async function prune() {
  try {
    await db.query(`DELETE FROM board_activity WHERE at < now() - $1 * interval '1 day'`, [KEEP_DAYS]);
    await db.query(
      `DELETE FROM board_activity a USING (
         SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY board_id ORDER BY at DESC) AS n FROM board_activity) x WHERE n > $1
       ) old WHERE a.id = old.id`, [KEEP_PER_BOARD]);
  } catch (err) {
    log.warn('Aktivitätsverlauf konnte nicht bereinigt werden', { err });
  }
}
setInterval(prune, 24 * 3600000).unref();
setTimeout(prune, 60000).unref();

async function list(boardId, { before = null, limit = 50 } = {}) {
  await flush();
  const rows = (await db.query(
    `SELECT id, user_id, user_name, user_color, kind, element_id, element_type, label, count, at FROM board_activity
      WHERE board_id = $1 AND ($2::bigint IS NULL OR id < $2) ORDER BY at DESC, id DESC LIMIT $3`,
    [boardId, before && /^\d{1,18}$/.test(String(before)) ? before : null, Math.max(1, Math.min(200, Number(limit) || 50))])).rows;
  return rows.map((r) => ({
    id: String(r.id), userId: r.user_id ? String(r.user_id) : null, user: r.user_name, color: r.user_color, kind: r.kind,
    elementId: r.element_id, elementType: r.element_type, label: r.label || '', count: r.count, at: new Date(r.at).getTime(),
  }));
}

module.exports = { record, flush, list, labelOf };
