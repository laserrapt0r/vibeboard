'use strict';
// Dateianhänge und eigene Vorlagen
const auth = require('../auth');
const boards = require('../boards');
const files = require('../files');
const templates = require('../templates');
const { HttpError, readRaw, readBody, readJson, json } = require('../http');

const wrap = (fn) => async (req, res, ctx) => {
  try {
    return await fn(req, res, ctx);
  } catch (e) {
    if (e.status && !(e instanceof HttpError)) throw new HttpError(e.status, e.message);
    throw e;
  }
};

async function boardRole(req, id, min, opts = {}) {
  const user = await auth.requireUser(req, { guests: !!opts.guests });
  const { board, role } = await boards.access(id, user);
  if (!board) throw new HttpError(404, 'Board nicht gefunden.');
  if (!role || boards.ROLE_RANK[role] < boards.ROLE_RANK[min]) throw new HttpError(403, 'Dafür fehlen dir die Rechte auf diesem Board.');
  return { user, board, role };
}

// Dateinamen in Content-Disposition: ASCII-Ersatz plus UTF-8-Variante (RFC 6266)
const disposition = (name) => `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`;

function register(r) {
  /* ---------------- Dateianhänge ---------------- */

  r.route('POST', '/api/boards/:id/files', wrap(async (req, res, { params }) => {
    const { board, user } = await boardRole(req, params.id, 'editor');
    auth.rateLimit('file-upload:' + user.id, 60, 60 * 60000);
    let name;
    try {
      name = decodeURIComponent(String(req.headers['x-file-name'] || ''));
    } catch {
      throw new HttpError(400, 'Ungültiger Dateiname.');
    }
    // Obergrenze großzügig; die eigentliche Grenze aus den Einstellungen prüft files.store
    const buf = await readRaw(req, 101 * 1024 * 1024);
    json(res, 201, await files.store(board.id, user, name, buf, req));
  }));

  r.route('GET', '/api/boards/:id/files/:fid', wrap(async (req, res, { params }) => {
    const { board } = await boardRole(req, params.id, 'viewer', { guests: true });
    const f = await files.get(board.id, params.fid);
    if (!f) throw new HttpError(404, 'Datei nicht gefunden.');
    // Immer als Download und nie im Browser ausführen lassen
    res.writeHead(200, {
      'Content-Type': f.mime, 'Content-Length': f.data.length, 'Content-Disposition': disposition(f.name),
      'Cache-Control': 'private, max-age=3600', 'Content-Security-Policy': "sandbox; default-src 'none'",
    });
    res.end(f.data);
  }));

  r.route('GET', '/api/boards/:id/files/:fid/info', wrap(async (req, res, { params }) => {
    const { board } = await boardRole(req, params.id, 'viewer', { guests: true });
    const f = await files.info(board.id, params.fid);
    if (!f) throw new HttpError(404, 'Datei nicht gefunden.');
    json(res, 200, { id: f.id, name: f.name, mime: f.mime, size: f.size, hasPreview: f.has_preview });
  }));

  r.route('GET', '/api/boards/:id/files/:fid/preview', wrap(async (req, res, { params }) => {
    const { board } = await boardRole(req, params.id, 'viewer', { guests: true });
    const png = await files.preview(board.id, params.fid);
    if (!png) throw new HttpError(404, 'Keine Vorschau vorhanden.');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length, 'Cache-Control': 'private, max-age=3600' });
    res.end(png);
  }));

  r.route('PUT', '/api/boards/:id/files/:fid/preview', wrap(async (req, res, { params }) => {
    const { board, user } = await boardRole(req, params.id, 'editor');
    await files.setPreview(board.id, params.fid, await readBody(req, 3 * 1024 * 1024), req, user.id);
    json(res, 200, { ok: true });
  }));

  /* ---------------- Eigene Vorlagen ---------------- */

  r.route('GET', '/api/templates', wrap(async (req, res) => {
    const u = await auth.requireUser(req);
    json(res, 200, { templates: await templates.list(u), recent: await templates.recent(u) });
  }));

  // Merkt die zuletzt verwendeten Vorlagen je Konto, damit sie auf allen Geräten zuerst erscheinen
  r.route('POST', '/api/templates/used', wrap(async (req, res) => {
    const u = await auth.requireUser(req);
    await templates.markUsed(u, (await readJson(req)).id);
    json(res, 200, { ok: true });
  }));

  r.route('GET', '/api/templates/:tid', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    json(res, 200, await templates.get(u, params.tid));
  }));

  r.route('POST', '/api/templates', wrap(async (req, res) => {
    const u = await auth.requireUser(req);
    auth.rateLimit('template:' + u.id, 30, 60 * 60000);
    const body = await readJson(req);
    json(res, 201, { id: await templates.create(u, body) });
  }));

  r.route('DELETE', '/api/templates/:tid', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    await templates.remove(u, params.tid);
    json(res, 200, { ok: true });
  }));
}

module.exports = { register };
