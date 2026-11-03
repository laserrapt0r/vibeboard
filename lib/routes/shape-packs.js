'use strict';
// Eigene Formenpakete: Die Administration lädt SVG-Dateien hoch (einzeln oder aus einem ZIP-Archiv, entpackt im Browser).
// Jede Datei läuft durch lib/svg-clean.js. Gespeichert und ausgeliefert wird nur die bereinigte Baumstruktur, nie die Datei selbst.
const crypto = require('crypto');
const db = require('../db');
const auth = require('../auth');
const audit = require('../audit');
const log = require('../log').child('shape-packs');
const { cleanSvg, SvgError } = require('../svg-clean');
const { HttpError, readJson, json } = require('../http');

const MAX_PACKS = 50;
const MAX_ICONS = 3000;           // je Paket
const MAX_PACK_BYTES = 24 * 1024 * 1024;
const MAX_BATCH = 100;            // Dateien je Aufruf
const MAX_GROUPS = 200;
const ID_RE = /^[a-z0-9]{6,12}$/; // Gleiche Form in public/js/icons.js (cu-<Paket>-<Nr>)

const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function checkId(id) {
  if (!ID_RE.test(String(id))) throw new HttpError(404, 'Formenpaket nicht gefunden.');
}

async function packOr404(id, c = db) {
  checkId(id);
  const p = (await c.query('SELECT * FROM shape_packs WHERE id = $1', [id])).rows[0];
  if (!p) throw new HttpError(404, 'Formenpaket nicht gefunden.');
  return p;
}

function register(r) {
  // Liste für das Panel und die Verwaltung. Alle Angemeldeten dürfen sie sehen, auch Gäste: Ihre Boards zeigen die Symbole ebenfalls.
  r.route('GET', '/api/shape-packs', async (req, res) => {
    await auth.requireUser(req, { guests: true });
    const rows = (await db.query(`SELECT p.id, p.name, p.source, p.version, p.updated_at, count(i.n)::int AS count, coalesce(sum(i.bytes), 0)::int AS bytes
                                    FROM shape_packs p LEFT JOIN shape_pack_icons i ON i.pack_id = p.id GROUP BY p.id ORDER BY lower(p.name)`)).rows;
    json(res, 200, rows.map((p) => ({ id: p.id, name: p.name, source: p.source, version: p.version, count: p.count, bytes: p.bytes, updatedAt: p.updated_at })));
  });

  // Inhalt eines Pakets im Format der mitgelieferten Sätze (scripts/build-symbols.js). Die Version steckt im ETag.
  r.route('GET', '/api/shape-packs/:pid', async (req, res, { params: { pid: id } }) => {
    await auth.requireUser(req, { guests: true });
    const p = await packOr404(id);
    const etag = `"sp-${p.id}-${p.version}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': 'private, no-cache' });
      return res.end();
    }
    const icons = (await db.query('SELECT n, name, grp, tags, drawing FROM shape_pack_icons WHERE pack_id = $1 ORDER BY n', [p.id])).rows;
    const body = { set: 'cu-' + p.id, name: p.name, source: p.source, version: p.version, mode: 'color',
      groups: (p.groups || []).map((g, i) => [String(i), g]),
      icons: icons.map((i) => [i.n.toString(36), i.grp, i.name, i.tags, i.drawing.vb, i.drawing.nodes]) };
    return json(res, 200, body, { ETag: etag, 'Cache-Control': 'private, no-cache' });
  });

  r.route('POST', '/api/admin/shape-packs', async (req, res) => {
    const admin = await auth.requireAdmin(req);
    auth.rateLimit('shape-pack-create:' + admin.id, 30, 10 * 60000);
    const body = await readJson(req);
    const name = text(body.name, 80);
    if (!name) throw new HttpError(400, 'Bitte einen Namen für das Paket angeben.');
    const n = Number((await db.query('SELECT count(*) AS n FROM shape_packs')).rows[0].n);
    if (n >= MAX_PACKS) throw new HttpError(400, 'Es gibt schon zu viele Formenpakete.');
    const id = crypto.randomBytes(6).toString('hex').slice(0, 10);
    await db.query('INSERT INTO shape_packs (id, name, source, created_by) VALUES ($1, $2, $3, $4)', [id, name, text(body.source, 300), admin.id]);
    audit.log(req, 'admin_shape_pack', { actorId: admin.id, details: { action: 'create', pack: id, name } });
    log.info('Formenpaket angelegt', { pack: id });
    json(res, 201, { id });
  });

  r.route('PATCH', '/api/admin/shape-packs/:pid', async (req, res, { params: { pid: id } }) => {
    const admin = await auth.requireAdmin(req);
    const p = await packOr404(id);
    const body = await readJson(req);
    const name = body.name !== undefined ? text(body.name, 80) : p.name;
    if (!name) throw new HttpError(400, 'Bitte einen Namen für das Paket angeben.');
    const source = body.source !== undefined ? text(body.source, 300) : p.source;
    await db.query('UPDATE shape_packs SET name = $2, source = $3, version = version + 1, updated_at = now() WHERE id = $1', [p.id, name, source]);
    audit.log(req, 'admin_shape_pack', { actorId: admin.id, details: { action: 'update', pack: p.id, name } });
    json(res, 200, { ok: true });
  });

  r.route('DELETE', '/api/admin/shape-packs/:pid', async (req, res, { params: { pid: id } }) => {
    const admin = await auth.requireAdmin(req);
    const p = await packOr404(id);
    await db.query('DELETE FROM shape_packs WHERE id = $1', [p.id]);
    audit.log(req, 'admin_shape_pack', { actorId: admin.id, details: { action: 'delete', pack: p.id, name: p.name } });
    log.info('Formenpaket gelöscht', { pack: p.id });
    json(res, 200, { ok: true });
  });

  // Dateien in Portionen hinzufügen. Was die Prüfung nicht besteht, kommt mit Grund zurück, der Rest wird gespeichert.
  r.route('POST', '/api/admin/shape-packs/:pid/icons', async (req, res, { params: { pid: id } }) => {
    const admin = await auth.requireAdmin(req);
    auth.rateLimit('shape-pack-upload:' + admin.id, 600, 10 * 60000);
    checkId(id);
    const body = await readJson(req);
    const list = Array.isArray(body.icons) ? body.icons : [];
    if (!list.length || list.length > MAX_BATCH) throw new HttpError(400, 'Ungültige Anzahl an Dateien.');
    const added = [], rejected = [];
    await db.tx(async (c) => {
      // Sperre: Zwei gleichzeitige Portionen vergeben sonst dieselben Nummern
      const p = (await c.query('SELECT * FROM shape_packs WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!p) throw new HttpError(404, 'Formenpaket nicht gefunden.');
      const stat = (await c.query('SELECT coalesce(max(n), -1)::int AS last, count(*)::int AS count, coalesce(sum(bytes), 0)::int AS bytes FROM shape_pack_icons WHERE pack_id = $1', [p.id])).rows[0];
      const groups = Array.isArray(p.groups) ? [...p.groups] : [];
      let next = stat.last + 1, count = stat.count, bytes = stat.bytes;
      for (const item of list) {
        const name = text(item?.name, 80) || 'Symbol';
        if (count >= MAX_ICONS) {
          rejected.push({ name, reason: 'Das Paket ist voll.' });
          continue;
        }
        let drawing;
        try {
          drawing = cleanSvg(typeof item?.svg === 'string' ? item.svg : '', `cu-${p.id}-${next.toString(36)}`);
        } catch (e) {
          if (!(e instanceof SvgError)) throw e;
          rejected.push({ name, reason: e.message });
          continue;
        }
        const size = JSON.stringify(drawing).length;
        if (bytes + size > MAX_PACK_BYTES) {
          rejected.push({ name, reason: 'Das Paket ist voll.' });
          continue;
        }
        const group = text(item.group, 60);
        let grp = groups.indexOf(group);
        if (grp < 0 && groups.length < MAX_GROUPS) grp = groups.push(group) - 1;
        if (grp < 0) grp = 0;
        await c.query('INSERT INTO shape_pack_icons (pack_id, n, name, grp, tags, drawing, bytes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [p.id, next, name, grp, text(item.tags, 300), JSON.stringify(drawing), size]);
        added.push({ key: `cu-${p.id}-${next.toString(36)}`, name });
        next += 1;
        count += 1;
        bytes += size;
      }
      if (!groups.length) groups.push('');
      await c.query('UPDATE shape_packs SET groups = $2, version = version + 1, updated_at = now() WHERE id = $1', [p.id, JSON.stringify(groups)]);
    });
    if (added.length) audit.log(req, 'admin_shape_pack', { actorId: admin.id, details: { action: 'upload', pack: id, added: added.length, rejected: rejected.length } });
    json(res, 200, { added, rejected });
  });

  // Einzelne Symbole entfernen
  r.route('DELETE', '/api/admin/shape-packs/:pid/icons/:n', async (req, res, { params: { pid: id, n } }) => {
    const admin = await auth.requireAdmin(req);
    const p = await packOr404(id);
    if (!/^[a-z0-9]{1,6}$/.test(n)) throw new HttpError(404, 'Symbol nicht gefunden.');
    const gone = await db.query('DELETE FROM shape_pack_icons WHERE pack_id = $1 AND n = $2', [p.id, parseInt(n, 36)]);
    if (!gone.rowCount) throw new HttpError(404, 'Symbol nicht gefunden.');
    await db.query('UPDATE shape_packs SET version = version + 1, updated_at = now() WHERE id = $1', [p.id]);
    audit.log(req, 'admin_shape_pack', { actorId: admin.id, details: { action: 'remove', pack: p.id } });
    json(res, 200, { ok: true });
  });
}

module.exports = { register, MAX_BATCH, MAX_ICONS };
