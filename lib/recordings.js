'use strict';
// Geführte Aufzeichnungen: Ansicht, Mauszeiger und Laserpointer als Zeitspur, optional mit Tonspur (Mikrofon).
// Zum asynchronen Ansehen eines Rundgangs durch das Board.
const db = require('./db');
const settings = require('./settings');
const uploads = require('./uploads');

const MAX_EVENTS = 60000;
const MAX_AUDIO = 15 * 1024 * 1024;
// Erlaubte Tonformate mit Kennung am Dateianfang
const AUDIO = {
  'audio/webm': (b) => b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  'audio/ogg': (b) => b.length > 4 && b.toString('latin1', 0, 4) === 'OggS',
  'audio/mp4': (b) => b.length > 8 && b.toString('latin1', 4, 8) === 'ftyp',
};

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const fin = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : null);

// Zeitspur prüfen: nur bekannte Ereignisarten mit Zahlenwerten
function cleanTrack(track, durationMs) {
  if (!Array.isArray(track)) throw fail('Die Aufzeichnung ist unvollständig.');
  if (track.length > MAX_EVENTS) throw fail('Die Aufzeichnung enthält zu viele Ereignisse.');
  const out = [];
  for (const e of track) {
    if (!e || typeof e !== 'object') continue;
    const t = fin(e.t);
    if (t === null || t < 0 || t > durationMs + 5000) continue;
    if (e.k === 'v') {
      const [x, y, w, h] = [fin(e.x), fin(e.y), fin(e.w), fin(e.h)];
      if ([x, y, w, h].some((v) => v === null) || w <= 0 || h <= 0) continue;
      out.push({ t, k: 'v', x, y, w, h });
    } else if (e.k === 'c' || e.k === 'l') {
      const [x, y] = [fin(e.x), fin(e.y)];
      if (x === null || y === null) continue;
      out.push({ t, k: e.k, x, y });
    } else if (e.k === 'h') out.push({ t, k: 'h' }); // Zeiger verlässt das Board
  }
  return out.sort((a, b) => a.t - b.t);
}

async function create(boardId, user, body, req) {
  const s = (await settings.get()).collab;
  if (!s.recordings) throw fail('Aufzeichnungen sind in dieser Installation abgeschaltet.', 403);
  const durationMs = Math.round(Number(body.durationMs) || 0);
  if (durationMs < 1000) throw fail('Die Aufzeichnung ist zu kurz.');
  if (durationMs > s.recordingMaxMinutes * 60000 + 5000) throw fail(`Aufzeichnungen dürfen höchstens ${s.recordingMaxMinutes} Minuten lang sein.`);
  const track = cleanTrack(body.track, durationMs);
  let audio = null, audioType = null;
  if (body.audio) {
    const m = /^data:(audio\/(?:webm|ogg|mp4))(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.audio));
    if (!m) throw fail('Die Tonspur hat ein unbekanntes Format.');
    audio = Buffer.from(m[2], 'base64');
    audioType = m[1];
    if (audio.length > MAX_AUDIO) throw fail('Die Tonspur ist zu groß.');
    if (!AUDIO[audioType](audio)) throw fail('Die Tonspur ist beschädigt oder hat ein falsches Format.');
    const reason = await uploads.checkBuffer(audio, { req, userId: user.id, kind: 'Tonspur' });
    if (reason) throw fail(reason, 422);
  }
  const title = String(body.title || '').trim().slice(0, 120) || 'Rundgang';
  const row = await db.one(
    `INSERT INTO board_recordings (board_id, created_by, author_name, title, duration_ms, track, audio, audio_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [boardId, user.id, user.display_name || user.username, title, durationMs, JSON.stringify(track), audio, audioType]);
  return String(row.id);
}

async function list(boardId) {
  const rows = (await db.query(
    `SELECT id, created_by, author_name, title, duration_ms, (audio IS NOT NULL) AS has_audio, created_at
       FROM board_recordings WHERE board_id = $1 ORDER BY created_at DESC LIMIT 100`, [boardId])).rows;
  return rows.map((r) => ({
    id: String(r.id), by: r.author_name || '', byId: r.created_by ? String(r.created_by) : null, title: r.title,
    durationMs: r.duration_ms, hasAudio: r.has_audio, createdAt: new Date(r.created_at).getTime(),
  }));
}

const checkId = (id) => /^\d{1,18}$/.test(String(id));

async function get(boardId, id) {
  if (!checkId(id)) return null;
  const r = await db.one('SELECT id, author_name, title, duration_ms, track, (audio IS NOT NULL) AS has_audio FROM board_recordings WHERE id = $1 AND board_id = $2', [id, boardId]);
  return r && { id: String(r.id), by: r.author_name, title: r.title, durationMs: r.duration_ms, track: r.track, hasAudio: r.has_audio };
}

async function audio(boardId, id) {
  if (!checkId(id)) return null;
  return db.one('SELECT audio, audio_type FROM board_recordings WHERE id = $1 AND board_id = $2 AND audio IS NOT NULL', [id, boardId]);
}

// Löschen: wer aufgezeichnet hat, oder der Besitzer des Boards
async function remove(boardId, id, user, role) {
  if (!checkId(id)) throw fail('Aufzeichnung nicht gefunden.', 404);
  const r = await db.one('SELECT created_by FROM board_recordings WHERE id = $1 AND board_id = $2', [id, boardId]);
  if (!r) throw fail('Aufzeichnung nicht gefunden.', 404);
  if (role !== 'owner' && String(r.created_by) !== String(user.id)) throw fail('Nur wer aufgezeichnet hat oder der Besitzer kann die Aufzeichnung löschen.', 403);
  await db.query('DELETE FROM board_recordings WHERE id = $1', [id]);
}

module.exports = { create, list, get, audio, remove, cleanTrack };
