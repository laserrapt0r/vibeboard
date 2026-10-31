'use strict';
const log = require('./log').child('files');
// Dateianhänge auf Boards (PDF, Office-Dokumente, Text). Der Dateityp wird am Inhalt erkannt, nie an Angaben des
// Browsers; jede Datei läuft durch den Virenscanner. Ausgeliefert wird immer als Download, Vorschauen erzeugt der
// Browser (PDF über pdf.js) und lädt sie als geprüftes PNG hoch.
const crypto = require('crypto');
const db = require('./db');
const settings = require('./settings');
const uploads = require('./uploads');

const MAX_PER_BOARD = 200;
const MAX_PREVIEW = 2 * 1024 * 1024;

// Erlaubte Endungen mit Dateityp und Erkennung am Dateianfang
const ZIP = (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const OLE = (b) => b.length > 8 && b.readUInt32BE(0) === 0xd0cf11e0 && b.readUInt32BE(4) === 0xa1b11ae1;
// Text: UTF-8 oder ältere Kodierungen (Windows-1252 aus Excel) ohne Nullbytes, UTF-16 mit BOM
const TEXT = (b) => (b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff) || !b.includes(0);
// Office-Container: ZIP mit dem jeweiligen Inhaltsverzeichnis, nicht irgendein Archiv
const OOXML = (b) => ZIP(b) && b.includes('[Content_Types].xml');
const ODF = (b) => ZIP(b) && b.includes('mimetypeapplication/vnd.oasis.opendocument');
const TYPES = {
  pdf: ['application/pdf', (b) => b.length > 5 && b.toString('latin1', 0, 5) === '%PDF-'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', OOXML],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', OOXML],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', OOXML],
  odt: ['application/vnd.oasis.opendocument.text', ODF],
  ods: ['application/vnd.oasis.opendocument.spreadsheet', ODF],
  odp: ['application/vnd.oasis.opendocument.presentation', ODF],
  doc: ['application/msword', OLE],
  xls: ['application/vnd.ms-excel', OLE],
  ppt: ['application/vnd.ms-powerpoint', OLE],
  txt: ['text/plain', TEXT],
  md: ['text/markdown', TEXT],
  csv: ['text/csv', TEXT],
  json: ['application/json', TEXT],
};

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const validFileId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{8,32}$/.test(id);

// Dateiname: ohne Pfadanteile und Steuerzeichen
function cleanName(name) {
  const n = String(name || '').normalize('NFC').replace(/[\u0000-\u001f\u007f/\\]/g, '').trim().slice(0, 200);
  return n || 'Datei';
}

function typeOf(name, buf) {
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(name) || [])[1];
  const t = ext && TYPES[ext.toLowerCase()];
  if (!t) throw fail('Dieser Dateityp wird nicht unterstützt. Erlaubt sind PDF, Word, Excel, PowerPoint, OpenDocument sowie Text, Markdown, CSV und JSON.', 415);
  if (!t[1](buf)) throw fail('Der Inhalt der Datei passt nicht zu ihrer Endung.', 415);
  return t[0];
}

async function store(boardId, user, rawName, buf, req) {
  const s = (await settings.get()).collab;
  if (!s.files) throw fail('Dateianhänge sind in dieser Installation abgeschaltet.', 403);
  if (!buf.length) throw fail('Die Datei ist leer.');
  if (buf.length > s.fileMaxMb * 1024 * 1024) throw fail(`Dateien dürfen höchstens ${s.fileMaxMb} MB groß sein.`, 413);
  const name = cleanName(rawName);
  const mime = typeOf(name, buf);
  const n = Number((await db.one('SELECT count(*) AS n FROM board_files WHERE board_id = $1', [boardId])).n);
  if (n >= MAX_PER_BOARD) throw fail(`Ein Board kann höchstens ${MAX_PER_BOARD} Dateien enthalten.`);
  const reason = await uploads.checkBuffer(buf, { req, userId: user.id, kind: 'Dateianhang' });
  if (reason) throw fail(reason, 422);
  const id = crypto.randomBytes(9).toString('base64url');
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  await db.query(`INSERT INTO board_files (board_id, id, name, mime, size, sha256, data, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [boardId, id, name, mime, buf.length, sha256, buf, user.id]);
  log.info('Dateianhang gespeichert', { boardId, fileId: id, mime, bytes: buf.length, userId: user.id });
  return { id, name, mime, size: buf.length };
}

async function get(boardId, id) {
  if (!validFileId(id)) return null;
  return db.one('SELECT id, name, mime, size, data FROM board_files WHERE board_id = $1 AND id = $2', [boardId, id]);
}

async function info(boardId, id) {
  if (!validFileId(id)) return null;
  return db.one('SELECT id, name, mime, size, (preview IS NOT NULL) AS has_preview FROM board_files WHERE board_id = $1 AND id = $2', [boardId, id]);
}

// Vorschaubild (erste Seite eines PDFs), vom Browser erzeugt – wird wie jedes Bild geprüft
async function setPreview(boardId, id, dataUrl, req, userId) {
  if (!validFileId(id)) throw fail('Datei nicht gefunden.', 404);
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) throw fail('PNG-Vorschau erwartet.');
  const png = Buffer.from(m[1], 'base64');
  if (png.length > MAX_PREVIEW) throw fail('Die Vorschau ist zu groß.', 413);
  const reason = await uploads.checkDataUrl(String(dataUrl), { req, userId, kind: 'Dateivorschau' });
  if (reason) throw fail(reason, 422);
  const r = await db.one('UPDATE board_files SET preview = $3 WHERE board_id = $1 AND id = $2 RETURNING id', [boardId, id, png]);
  if (!r) throw fail('Datei nicht gefunden.', 404);
}

async function preview(boardId, id) {
  if (!validFileId(id)) return null;
  const r = await db.one('SELECT preview FROM board_files WHERE board_id = $1 AND id = $2 AND preview IS NOT NULL', [boardId, id]);
  return r && r.preview;
}

// Beim Kopieren eines Boards die Dateien mitnehmen (gleiche Kennungen, damit die Elemente passen)
async function copyAll(srcId, dstId, c = db) {
  await c.query(`INSERT INTO board_files (board_id, id, name, mime, size, sha256, data, preview, created_by, created_at)
                 SELECT $2, id, name, mime, size, sha256, data, preview, created_by, created_at FROM board_files WHERE board_id = $1
                 ON CONFLICT DO NOTHING`, [srcId, dstId]);
}

// Dateien, auf die nach sieben Tagen weder ein Element noch eine Version des Boards verweist, werden gelöscht
// (so lange bleiben Rückgängig-Machen und Versionen möglich)
async function cleanup() {
  const r = await db.query(
    `DELETE FROM board_files f
      WHERE f.created_at < now() - interval '7 days'
        AND NOT EXISTS (SELECT 1 FROM elements e WHERE e.board_id = f.board_id AND e.data->>'fileId' = f.id)
        AND NOT EXISTS (SELECT 1 FROM board_versions v WHERE v.board_id = f.board_id AND v.data @> jsonb_build_array(jsonb_build_object('fileId', f.id)))`);
  if (r.rowCount) log.info('Nicht mehr verwendete Dateianhänge entfernt', { count: r.rowCount });
}

// Optionaler Dienst für Office-Dateien (Gotenberg): Die Datei verlässt dabei die Anwendung, bleibt aber in deiner Installation
const CONVERT_URL = String(process.env.OFFICE_CONVERTER_URL || '').replace(/\/+$/, '');
const CONVERT_TIMEOUT = 120000;
const CONVERTIBLE = /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i;

async function toPdf(f) {
  if (/\.pdf$/i.test(f.name)) return f.data;
  if (!CONVERT_URL) throw fail('Die Umwandlung von Office-Dateien ist in dieser Installation nicht eingerichtet.');
  if (!CONVERTIBLE.test(f.name)) throw fail('Dieser Dateityp lässt sich nicht umwandeln.');
  const form = new FormData();
  // Fester Name: Der Dateiname ist eine Eingabe und geht den Dienst nichts an, nur die Endung zählt
  form.append('files', new Blob([f.data]), 'datei' + /\.[a-z]+$/i.exec(f.name)[0].toLowerCase());
  let r;
  try {
    r = await fetch(`${CONVERT_URL}/forms/libreoffice/convert`, { method: 'POST', body: form, signal: AbortSignal.timeout(CONVERT_TIMEOUT) });
  } catch (e) {
    log.error('Umwandlungsdienst nicht erreichbar', { err: e });
    throw fail('Der Umwandlungsdienst ist gerade nicht erreichbar.', 424);
  }
  if (!r.ok) {
    log.warn('Umwandlung fehlgeschlagen', { status: r.status });
    throw fail('Die Datei konnte nicht umgewandelt werden.', 422);
  }
  return Buffer.from(await r.arrayBuffer());
}

module.exports = { store, get, info, setPreview, preview, copyAll, cleanup, validFileId, toPdf, TYPES, converterEnabled: !!CONVERT_URL };
