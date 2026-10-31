'use strict';
// Boards, Mitglieder und Echtzeit-Kanal
const db = require('../db');
const auth = require('../auth');
const { looksLikeEmail } = require('../email');
const boards = require('../boards');
const settings = require('../settings');
const mail = require('../mail');
const uploads = require('../uploads');
const audit = require('../audit');
const comments = require('../comments');
const activity = require('../activity');
const notify = require('../notify');
const teams = require('../teams');
const invites = require('../invites');
const i18n = require('../i18n');
const { VERSION } = require('../version');
const ConcealOps = require('../../public/js/conceal-ops.js');
const { baseUrl } = require('./auth');
const { HttpError, readJson, readBody, json } = require('../http');

const MAX_THUMB = 2 * 1024 * 1024;
const SIGNALS = new Set(['cursor', 'view', 'sel', 'laser', 'reaction', 'summon', 'lead', 'chat', 'presence', 'editing', 'busy']);

// guests: auch Gäste (Zugang per Gastlink) zulassen – sonst nur Personen mit Konto
async function requireRole(req, id, min, { guests = false } = {}) {
  const user = await auth.requireUser(req, { guests });
  const { board, role } = await boards.access(id, user);
  if (!board) throw new HttpError(404, 'Board nicht gefunden.');
  if (!role) throw new HttpError(403, 'Du hast keinen Zugriff auf dieses Board.');
  if (boards.ROLE_RANK[role] < boards.ROLE_RANK[min]) {
    throw new HttpError(403, min === 'owner' ? 'Nur der Besitzer kann das ändern.' : min === 'commenter' ? 'Du darfst dieses Board nur ansehen.' : 'Du darfst dieses Board nicht bearbeiten.');
  }
  return { user, board, role };
}

// Während der Moderation: Bearbeitungssperre bzw. gesperrte Elemente gelten auch für REST-Aufrufe
async function checkModeration(boardId, user, role) {
  const b = await boards.load(boardId);
  if (!b || boards.isFacilitator(b, user.id, role)) return;
  const m = b.session.moderation;
  if (m && m.active && m.editLock) throw new HttpError(403, 'Die Moderation hat das Bearbeiten gerade gesperrt.');
  return b;
}

// Basisadresse für Links in E-Mails (fehlt sie, werden keine E-Mails verschickt)
const originOf = (req) => baseUrl(req).catch(() => null);

// Live-Werte aus dem Cache bevorzugen (noch nicht gespeicherte Änderungen)
function liveMeta(row, folders) {
  const c = boards.cache.get(row.id);
  return {
    team: row.team_id ? { id: String(row.team_id), name: row.team_name, role: row.team_role, member: !!row.team_member } : null,
    folders: folders ? folders.get(row.id) || [] : [],
    id: row.id,
    name: c ? c.name : row.name,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(c ? c.updatedAt : row.updated_at).getTime(),
    elementCount: c ? c.elements.size : Number(row.element_count),
    hasThumb: row.has_thumb,
    online: boards.onlineCount(row.id),
    linkAccess: row.link_access,
    role: row.role,
    owner: row.owner_name ? { displayName: row.owner_display || row.owner_name } : null,
    memberCount: Number(row.member_count || 0),
    member: !!row.is_member,
  };
}

const LIST_COLUMNS = `b.id, b.name, b.created_at, b.updated_at, b.link_access, (b.thumbnail IS NOT NULL) AS has_thumb,
  b.owner_id, b.team_id, b.team_role, t.name AS team_name,
  (SELECT count(*) FROM elements e WHERE e.board_id = b.id) AS element_count,
  (SELECT count(*) FROM board_members bm WHERE bm.board_id = b.id) AS member_count,
  o.username AS owner_name, o.display_name AS owner_display`;

function register(r) {
  r.route('GET', '/api/boards', async (req, res) => {
    const u = await auth.requireUser(req);
    // Ordnerzuordnung: persönliche Ordner und Ordner der eigenen Teams
    const fb = (await db.query(
      `SELECT fb.board_id, fb.folder_id FROM folder_boards fb JOIN folders f ON f.id = fb.folder_id
        WHERE f.user_id = $1 OR f.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)`, [u.id])).rows;
    const folders = new Map();
    for (const r of fb) folders.set(r.board_id, [...(folders.get(r.board_id) || []), String(r.folder_id)]);
    const owned = (await db.query(
      `SELECT ${LIST_COLUMNS}, 'owner' AS role, (tm.user_id IS NOT NULL) AS team_member FROM boards b
         LEFT JOIN users o ON o.id = b.owner_id LEFT JOIN teams t ON t.id = b.team_id
         LEFT JOIN team_members tm ON tm.team_id = b.team_id AND tm.user_id = $1
        WHERE b.owner_id = $1 AND b.deleted_at IS NULL`, [u.id])).rows;
    const shared = (await db.query(
      `SELECT ${LIST_COLUMNS}, m.role AS member_role, (tm.user_id IS NOT NULL) AS team_member,
              (m.user_id IS NOT NULL) AS is_member
         FROM boards b
         LEFT JOIN users o ON o.id = b.owner_id
         LEFT JOIN teams t ON t.id = b.team_id
         LEFT JOIN board_members m ON m.board_id = b.id AND m.user_id = $1
         LEFT JOIN team_members tm ON tm.team_id = b.team_id AND tm.user_id = $1
         LEFT JOIN board_visits v ON v.board_id = b.id AND v.user_id = $1
        WHERE b.owner_id IS DISTINCT FROM $1 AND b.deleted_at IS NULL
          AND (m.user_id IS NOT NULL OR tm.user_id IS NOT NULL OR (v.user_id IS NOT NULL AND b.link_access <> 'private'))`, [u.id])).rows;
    // Admins sehen fremde Boards hier nur als geteilt (nicht als eigene), mit ihrer eigentlichen Rolle
    const asUser = { ...u, role: 'user' };
    json(res, 200, {
      owned: owned.map((b) => liveMeta(b, folders)),
      shared: shared.map((b) => liveMeta({ ...b, role: boards.roleFor(b, asUser) || 'viewer' }, folders)),
      teams: await teams.listMine(u),
      folderList: await teams.listFolders(u),
    });
  });

  r.route('POST', '/api/boards', async (req, res) => {
    const u = await auth.requireUser(req);
    const body = await readJson(req);
    const elements = Array.isArray(body.elements) ? body.elements : [];
    // Bilder aus Importen ebenfalls prüfen; abgelehnte werden nicht übernommen
    const rejected = await uploads.checkElements(elements, { req, userId: u.id, kind: 'Import' });
    const bad = new Set(rejected.map((r) => r.id));
    const id = await boards.create({ name: body.name, ownerId: u.id, elements: elements.filter((e) => !e || !bad.has(e.id)) });
    json(res, 201, { id, rejected });
  });

  r.route('GET', '/api/boards/:id', async (req, res, { params }) => {
    const { board, role, user } = await requireRole(req, params.id, 'viewer', { guests: true });
    const owner = board.owner_id ? await db.one('SELECT username, display_name FROM users WHERE id = $1', [board.owner_id]) : null;
    const thumb = await db.one('SELECT (thumbnail IS NOT NULL) AS has FROM boards WHERE id = $1', [board.id]);
    const team = board.team_id ? await db.one('SELECT id, name FROM teams WHERE id = $1', [board.team_id]) : null;
    const s = (await settings.get()).collab;
    json(res, 200, {
      id: board.id, name: board.name, role, linkAccess: board.link_access, guest: user.role === 'guest',
      owner: owner ? { displayName: owner.display_name || owner.username } : null,
      hasThumb: !!(thumb && thumb.has),
      team: team ? { id: String(team.id), name: team.name, role: board.team_role } : null,
      features: { guestLinks: s.guestLinks, guestMaxDays: s.guestMaxDays, recordings: s.recordings, recordingMaxMinutes: s.recordingMaxMinutes },
    });
  });

  // Personen mit Bezug zum Board (für @Erwähnungen und das Zuweisen von Kommentaren)
  r.route('GET', '/api/boards/:id/people', async (req, res, { params }) => {
    const { board, user } = await requireRole(req, params.id, 'commenter', { guests: true });
    const people = await notify.boardPeople(board.id);
    // Gästen keine Anmeldenamen verraten – Erwähnen geht auch über den Anzeigenamen
    json(res, 200, { people: user.role === 'guest' ? people.map(({ username, ...p }) => p) : people });
  });

  // Aktivitätsverlauf (neueste zuerst); lastVisit: vorheriger Besuch der anfragenden Person
  r.route('GET', '/api/boards/:id/activity', async (req, res, { params, url }) => {
    const { board, user } = await requireRole(req, params.id, 'viewer', { guests: true });
    const items = await activity.list(board.id, { before: url.searchParams.get('before'), limit: url.searchParams.get('limit') });
    json(res, 200, { items, me: String(user.id) });
  });

  r.route('PATCH', '/api/boards/:id', async (req, res, { params }) => {
    const body = await readJson(req);
    const needOwner = body.linkAccess !== undefined || body.teamId !== undefined;
    const { board, user, role } = await requireRole(req, params.id, needOwner ? 'owner' : 'editor');
    if (body.linkAccess !== undefined && !['private', 'view', 'comment', 'edit'].includes(body.linkAccess)) throw new HttpError(400, 'Ungültige Freigabe.');
    if (typeof body.name === 'string') {
      await checkModeration(board.id, user, role);
      await boards.rename(board.id, body.name);
    }
    if (body.teamId !== undefined) {
      try {
        await teams.assignBoard(board.id, user, body.teamId ? String(body.teamId) : null, body.teamRole, await originOf(req));
      } catch (e) {
        if (e.status) throw new HttpError(e.status, e.message);
        throw e;
      }
    }
    if (body.linkAccess !== undefined) {
      await db.query('UPDATE boards SET link_access = $2 WHERE id = $1', [board.id, body.linkAccess]);
      boards.setLinkAccess(board.id, body.linkAccess);
      // Verbundene Nutzer mit Link-Zugriff neu verbinden lassen
      const room = boards.rooms.get(board.id);
      if (room) {
        const members = new Set((await db.query('SELECT user_id FROM board_members WHERE board_id = $1', [board.id])).rows.map((x) => String(x.user_id)));
        for (const c of [...room.values()]) if (c.role !== 'owner' && !members.has(String(c.uid))) boards.kickUser(board.id, c.uid);
      }
    }
    json(res, 200, { ok: true });
  });

  // Löschen legt das Board in den Papierkorb; endgültig entfernt es erst der Papierkorb (oder die Frist)
  r.route('DELETE', '/api/boards/:id', async (req, res, { params }) => {
    const { user } = await requireRole(req, params.id, 'owner');
    await boards.trash(params.id, user.id);
    audit.log(req, 'board_trashed', { userId: user.id, details: { board: params.id } });
    json(res, 200, { ok: true, trashDays: (await settings.get()).collab.trashDays });
  });

  /* ---------------- Papierkorb (nur eigene Boards) ---------------- */

  const trashed = async (req, id) => {
    const u = await auth.requireUser(req);
    if (!boards.validId(id)) throw new HttpError(404, 'Nicht im Papierkorb.');
    const row = await db.one('SELECT id, owner_id FROM boards WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
    if (!row || (String(row.owner_id) !== String(u.id) && u.role !== 'admin')) throw new HttpError(404, 'Nicht im Papierkorb.');
    return u;
  };

  r.route('GET', '/api/trash', async (req, res) => {
    const u = await auth.requireUser(req);
    const days = (await settings.get()).collab.trashDays;
    const rows = (await db.query(
      `SELECT b.id, b.name, b.deleted_at, (b.thumbnail IS NOT NULL) AS has_thumb,
              (SELECT count(*) FROM elements e WHERE e.board_id = b.id)::int AS element_count
         FROM boards b WHERE b.owner_id = $1 AND b.deleted_at IS NOT NULL ORDER BY b.deleted_at DESC`, [u.id])).rows;
    json(res, 200, {
      days,
      boards: rows.map((b) => ({
        id: b.id, name: b.name, deletedAt: new Date(b.deleted_at).getTime(), elementCount: b.element_count, hasThumb: b.has_thumb,
        purgeAt: new Date(b.deleted_at).getTime() + days * 86400000,
      })),
    });
  });

  // Vorschaubild gelöschter Boards: Die normale Route gilt nur für Boards außerhalb des Papierkorbs
  r.route('GET', '/api/trash/:id/thumb', async (req, res, { params }) => {
    await trashed(req, params.id);
    const row = await db.one('SELECT thumbnail FROM boards WHERE id = $1', [params.id]);
    if (!row || !row.thumbnail) throw new HttpError(404, 'Kein Vorschaubild');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=60' });
    res.end(row.thumbnail);
  });

  r.route('POST', '/api/trash/:id/restore', async (req, res, { params }) => {
    const u = await trashed(req, params.id);
    await boards.untrash(params.id);
    audit.log(req, 'board_restored_trash', { userId: u.id, details: { board: params.id } });
    json(res, 200, { ok: true });
  });

  r.route('DELETE', '/api/trash/:id', async (req, res, { params }) => {
    const u = await trashed(req, params.id);
    await boards.remove(params.id);
    audit.log(req, 'board_deleted', { userId: u.id, details: { board: params.id } });
    json(res, 200, { ok: true });
  });

  /* ---------------- Meine Aufgaben (Karten über alle Boards) ---------------- */

  r.route('GET', '/api/tasks', async (req, res) => {
    const u = await auth.requireUser(req);
    const names = [...new Set([u.display_name, u.username].filter(Boolean).map((n) => n.trim().toLowerCase()))];
    // Hinweis: Karten-Zuständigkeiten sind Freitext; bei gleichen Namen erscheinen Karten bei allen Gleichnamigen
    const rows = (await db.query(
      `SELECT b.id AS board_id, b.name AS board_name, b.owner_id, e.id, e.data
         FROM elements e
         JOIN boards b ON b.id = e.board_id
         LEFT JOIN board_members m ON m.board_id = b.id AND m.user_id = $1
         LEFT JOIN board_visits v ON v.board_id = b.id AND v.user_id = $1
        WHERE b.deleted_at IS NULL AND ((e.data->>'type' = 'card' AND (e.data->>'assigneeId' = $3 OR (NOT e.data ? 'assigneeId' AND lower(btrim(e.data->>'assignee')) = ANY($2::text[]))))
            OR (e.data->>'type' = 'comment' AND e.data->'task'->>'assigneeId' = $3))
          AND (b.owner_id = $1 OR m.user_id IS NOT NULL OR (v.user_id IS NOT NULL AND b.link_access <> 'private')
               OR b.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1))
          AND (NOT e.data ? 'priv' OR e.data->>'priv' = $3)
        LIMIT 500`, [u.id, names, String(u.id)])).rows;
    // Verborgene Bereiche der betroffenen Boards (auch solcher, die gerade nicht im Speicher sind)
    const boardIds = [...new Set(rows.map((r) => r.board_id))];
    const areas = new Map();
    if (boardIds.length) {
      for (const f of (await db.query(`SELECT board_id, data FROM elements WHERE board_id = ANY($1::text[]) AND data->>'type' = 'frame' AND data->>'concealed' = 'true'`, [boardIds])).rows) {
        areas.set(f.board_id, [...(areas.get(f.board_id) || []), f.data]);
      }
    }
    const isConcealed = (r, d, live) => {
      if (String(r.owner_id) === String(u.id) || u.role === 'admin') return false;
      if (live) return boards.concealedOf(live).has(r.id) && !boards.isFacilitator(live, u.id, null);
      return ConcealOps.inConcealedArea(d, areas.get(r.board_id) || []);
    };
    const tasks = rows.map((r) => {
      // Noch nicht gespeicherte Änderungen aus dem Arbeitsspeicher bevorzugen
      const live = boards.cache.get(r.board_id);
      const d = live ? live.elements.get(r.id) : r.data;
      // Elemente in verborgenen Bereichen erscheinen erst nach dem Aufdecken
      if (d && isConcealed(r, d, live)) return null;
      // Zugewiesene Kommentare: Text des ersten Beitrags als Titel, „Erledigt“ = Kommentar erledigt
      if (d && d.type === 'comment') {
        if (!d.task || d.task.assigneeId !== String(u.id)) return null;
        const first = (d.thread || [])[0];
        return {
          boardId: r.board_id, boardName: live ? live.name : r.board_name, id: r.id, comment: true,
          title: String(first ? first.text : i18n.tr('Kommentar')).slice(0, 200), status: i18n.tr(d.resolved ? 'Erledigt' : 'Offen'), due: /^\d{4}-\d{2}-\d{2}$/.test(d.task.due) ? d.task.due : '',
          priority: '', points: '', key: '', color: '#f59f00', by: d.task.by || '',
        };
      }
      if (!d || d.type !== 'card') return null;
      // Zuständigkeit: bevorzugt die ausgewählte Person (ID), sonst der eingetragene Name
      if (d.assigneeId ? d.assigneeId !== String(u.id) : !names.includes(String(d.assignee || '').trim().toLowerCase())) return null;
      if (d.priv && String(d.priv) !== String(u.id)) return null;
      return {
        boardId: r.board_id, boardName: live ? live.name : r.board_name, id: r.id,
        title: String(d.title || ''), status: String(d.status || '').trim(), due: /^\d{4}-\d{2}-\d{2}$/.test(d.due) ? d.due : '',
        priority: String(d.priority || ''), points: d.points == null ? '' : String(d.points), key: String(d.key || ''), color: d.color || '#4262ff',
      };
    }).filter(Boolean);
    json(res, 200, { tasks });
  });

  /* ---------------- Versionen ---------------- */

  r.route('GET', '/api/boards/:id/versions', async (req, res, { params }) => {
    const { board } = await requireRole(req, params.id, 'editor');
    const rows = (await db.query(
      `SELECT v.id, v.kind, v.label, v.name, v.element_count, v.created_at, u.display_name, u.username
         FROM board_versions v LEFT JOIN users u ON u.id = v.created_by
        WHERE v.board_id = $1 ORDER BY v.created_at DESC LIMIT 200`, [board.id])).rows;
    json(res, 200, {
      versions: rows.map((v) => ({
        id: String(v.id), kind: v.kind, label: v.label, name: v.name, elementCount: v.element_count,
        createdAt: new Date(v.created_at).getTime(), by: v.display_name || v.username || null,
      })),
    });
  });

  r.route('POST', '/api/boards/:id/versions', async (req, res, { params }) => {
    const { board, user } = await requireRole(req, params.id, 'editor');
    const body = await readJson(req);
    await boards.flushBoard(board.id);
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const v = await boards.createVersion(board.id, { kind: 'manual', label: label || null, userId: user.id });
    if (!v) throw new HttpError(413, 'Das Board ist zu groß für eine Version.');
    json(res, 201, { id: String(v.id) });
  });

  r.route('POST', '/api/boards/:id/versions/:vid/restore', async (req, res, { params }) => {
    const { board, user, role } = await requireRole(req, params.id, 'editor');
    // Wiederherstellen ersetzt alle Elemente – nicht erlaubt, solange die Moderation Bearbeiten oder Elemente sperrt
    const live = await checkModeration(board.id, user, role);
    if (live && [...live.elements.values()].some((e) => e.modLock || (e.type === 'frame' && e.concealed))) {
      throw new HttpError(403, 'Das Board enthält gesperrte Elemente oder verborgene Bereiche. Wiederherstellen kann nur, wer moderiert, oder der Besitzer.');
    }
    let r2;
    try {
      r2 = await boards.restoreVersion(board.id, params.vid, user);
    } catch (e) {
      if (e.status) throw new HttpError(e.status, e.message);
      throw e;
    }
    if (!r2) throw new HttpError(404, 'Version nicht gefunden.');
    audit.log(req, 'board_restored', { userId: user.id, details: { board: board.id, version: params.vid } });
    activity.record(board.id, { userId: String(user.id), name: user.display_name || user.username, color: user.color }, 'restored', null, { label: '' });
    json(res, 200, { ok: true, ...r2 });
  });

  // Version als neues Board öffnen (ohne fremde private Inhalte)
  r.route('POST', '/api/boards/:id/versions/:vid/copy', async (req, res, { params }) => {
    const { board, user, role } = await requireRole(req, params.id, 'editor');
    const v = await boards.versionData(board.id, params.vid);
    if (!v) throw new HttpError(404, 'Version nicht gefunden.');
    let els = (Array.isArray(v.data) ? v.data : []).filter((e) => e && (!e.priv || String(e.priv) === String(user.id)));
    // Inhalte verborgener Bereiche nur für Moderierende
    const live = await boards.load(board.id);
    if (live && !boards.isFacilitator(live, user.id, role)) {
      const hidden = ConcealOps.concealedIds(els);
      els = els.filter((e) => !hidden.has(e.id));
    }
    const stamp = new Date(v.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' });
    const id = await boards.create({ name: `${v.name} (Stand ${stamp})`, ownerId: user.id, elements: els, trusted: true });
    await require('../files').copyReferenced(board.id, id);
    json(res, 201, { id });
  });

  r.route('POST', '/api/boards/:id/duplicate', async (req, res, { params }) => {
    const { user, role } = await requireRole(req, params.id, 'viewer');
    const live = await boards.load(params.id);
    const skip = live && !boards.isFacilitator(live, user.id, role) ? boards.concealedOf(live) : null;
    const id = await boards.duplicate(params.id, user.id, skip);
    json(res, 201, { id });
  });

  /* ---------------- Retro-Serie: nächste Retro, Maßnahmen der letzten, Umfrage-Verlauf ---------------- */

  // Nächste Retro: neues Board mit der Struktur dieses Boards (ohne Beiträge), verknüpft als Serie
  r.route('POST', '/api/boards/:id/next-retro', async (req, res, { params }) => {
    const { board, user, role } = await requireRole(req, params.id, 'editor');
    const body = await readJson(req);
    const live = await boards.load(board.id);
    if (!live) throw new HttpError(404, 'Board nicht gefunden.');
    await boards.flushBoard(board.id);
    const hidden = boards.isFacilitator(live, user.id, role) ? new Set() : boards.concealedOf(live);
    const CONTENT = new Set(['sticky', 'card', 'comment', 'pen', 'image', 'file']);
    // Texte der Vorlage haben keine Autorschaft – selbst geschriebene sind Beiträge
    const keep = [...live.elements.values()].filter((e) => !e.priv && !hidden.has(e.id) && !CONTENT.has(e.type) && !(e.type === 'frame' && e.kind === 'topic') && !(e.type === 'text' && (e.author || e.anon)));
    const kept = new Set(keep.map((e) => e.id));
    // Verbindungen zu weggelassenen Elementen entfallen
    const els = keep.filter((e) => e.type !== 'connector' || [e.from, e.to].every((x) => !x || !x.id || kept.has(x.id)))
      .map((e) => {
        const o = { ...e };
        for (const k of ['reactions', 'anon', 'author']) delete o[k];
        return o;
      });
    const name = String(body.name || '').trim() || i18n.tr(`${live.name} (nächste)`);
    const id = await boards.create({ name, ownerId: user.id, elements: els, trusted: true });
    // Serie verknüpfen; Team und Freigabe übernimmt nur der Besitzer
    await db.query('UPDATE boards SET prev_retro_id = $2 WHERE id = $1', [id, board.id]);
    if (role === 'owner') {
      await db.query('UPDATE boards SET team_id = s.team_id, team_role = s.team_role, link_access = s.link_access FROM boards s WHERE boards.id = $1 AND s.id = $2', [id, board.id]);
      await db.query(`INSERT INTO board_members (board_id, user_id, role) SELECT $1, user_id, role FROM board_members WHERE board_id = $2 AND user_id <> $3
                      ON CONFLICT DO NOTHING`, [id, board.id, user.id]);
    }
    json(res, 201, { id });
  });

  // Vorgänger-Boards der Serie, auf die die Person Zugriff hat (neueste zuerst, höchstens zehn)
  async function seriesChain(boardId, user) {
    const out = [];
    let cur = (await db.one('SELECT prev_retro_id FROM boards WHERE id = $1', [boardId]))?.prev_retro_id;
    const seen = new Set([boardId]);
    while (cur && !seen.has(cur) && out.length < 10) {
      seen.add(cur);
      const { board, role } = await boards.access(cur, user);
      if (!board || !role) break;
      out.push({ id: board.id, name: board.name, role });
      cur = (await db.one('SELECT prev_retro_id FROM boards WHERE id = $1', [cur]))?.prev_retro_id;
    }
    return out;
  }

  const actionCards = (b) => [...b.elements.values()].filter((e) => e.type === 'card' && e.action && !e.priv && !boards.concealedOf(b).has(e.id));
  const DONE = /^(fertig|erledigt|done|geschlossen|closed|abgeschlossen|resolved|gelöst|übernommen|completed|finished|hecho|terminado|completado|cerrado|resuelto|transferido|terminé|fait|fermé|résolu|reporté|carried over|terminée|terminada|hecha|fermée|cerrada|completada|resuelta|résolue|reportée|transferida)$/i;

  r.route('GET', '/api/boards/:id/previous-actions', async (req, res, { params }) => {
    const { board, user } = await requireRole(req, params.id, 'viewer');
    const chain = await seriesChain(board.id, user);
    if (!chain.length) return json(res, 200, { previous: null, actions: [] });
    const prev = chain[0];
    const pb = await boards.load(prev.id);
    const actions = pb ? actionCards(pb).map((e) => ({
      id: e.id, title: String(e.title || ''), assignee: String(e.assignee || ''), assigneeId: e.assigneeId || null, due: e.due || '', status: String(e.status || ''),
      done: DONE.test(String(e.status || '').trim()),
    })) : [];
    json(res, 200, { previous: { id: prev.id, name: prev.name, canEdit: boards.canEdit(prev.role) }, actions });
  });

  // Maßnahme der vorherigen Retro als erledigt bzw. offen markieren (Rechte auf dem vorherigen Board nötig)
  r.route('POST', '/api/boards/:id/previous-actions/:eid', async (req, res, { params }) => {
    const { board, user } = await requireRole(req, params.id, 'viewer');
    const body = await readJson(req);
    const chain = await seriesChain(board.id, user);
    const prev = chain[0];
    if (!prev || !boards.canEdit(prev.role)) throw new HttpError(403, 'Auf der vorherigen Retro darfst du nichts ändern.');
    const pb = await boards.load(prev.id);
    const el = pb && pb.elements.get(params.eid);
    if (!el || el.type !== 'card' || !el.action) throw new HttpError(404, 'Maßnahme nicht gefunden.');
    const sender = { uid: String(user.id), role: prev.role, user: { name: user.display_name || user.username, color: user.color, clientId: null } };
    const status = i18n.tr(body.carried ? 'Übernommen' : body.done ? 'Erledigt' : 'Offen');
    const reply = boards.applyOps(pb, [{ op: 'upsert', el: { ...el, status } }], sender);
    if (reply.blocked) throw new HttpError(403, 'Die Moderation der vorherigen Retro hat das Bearbeiten gesperrt.');
    // Rückblick bei allen im aktuellen Board aktualisieren
    boards.broadcast(board.id, { type: 'actionsChanged' });
    json(res, 200, { ok: true });
  });

  // Ergebnisse von Schnellumfragen dieses Boards und der vorherigen Retros (für den Verlauf)
  r.route('GET', '/api/boards/:id/polls', async (req, res, { params }) => {
    const { board, user } = await requireRole(req, params.id, 'viewer', { guests: true });
    const chain = user.role === 'guest' ? [] : await seriesChain(board.id, user);
    const ids = [board.id, ...chain.map((c) => c.id)];
    const names = new Map([[board.id, board.name], ...chain.map((c) => [c.id, c.name])]);
    const rows = (await db.query('SELECT board_id, kind, question, results, participants, created_at FROM board_polls WHERE board_id = ANY($1::text[]) ORDER BY created_at LIMIT 500', [ids])).rows;
    json(res, 200, {
      polls: rows.map((p) => ({ boardId: p.board_id, boardName: names.get(p.board_id) || '', kind: p.kind, question: p.question, results: p.results, participants: p.participants, createdAt: new Date(p.created_at).getTime() })),
    });
  });

  // Retro-Zusammenfassung per E-Mail an die Beteiligten bzw. an den Team-Webhook (nur Moderierende)
  r.route('POST', '/api/boards/:id/summary', async (req, res, { params }) => {
    const { board, user, role } = await requireRole(req, params.id, 'editor');
    const live = await boards.load(board.id);
    // Verschicken nur durch Besitzer oder Moderierende – sonst könnte jede bearbeitende Person beliebigen Text mailen
    if (!live || !boards.isFacilitator(live, user.id, role)) throw new HttpError(403, 'Die Zusammenfassung verschickt der Besitzer oder wer moderiert.');
    auth.rateLimit('summary:' + board.id, 5, 60 * 60000);
    const body = await readJson(req);
    const lines = (Array.isArray(body.lines) ? body.lines : []).map((l) => String(l ?? '').slice(0, 500)).slice(0, 200);
    if (!lines.length) throw new HttpError(400, 'Die Zusammenfassung ist leer.');
    const origin = await originOf(req);
    const url = origin ? `${origin}/board/${board.id}` : null;
    let mailed = 0;
    if (body.email) {
      if (!(await settings.mailConfigured())) throw new HttpError(400, 'Es ist kein Mailserver eingerichtet.');
      const people = (await notify.boardPeople(board.id)).filter((p) => !p.guest).map((p) => p.id);
      const rows = (await db.query(`SELECT email, locale FROM users WHERE id = ANY($1::bigint[]) AND email IS NOT NULL AND status = 'active' LIMIT 200`, [people])).rows;
      for (const r2 of rows) {
        mail.sendQuietly(r2, `Zusammenfassung: ${live.name}`, `Zusammenfassung „${live.name}“`, lines, url ? { label: 'Board öffnen', url } : undefined);
        mailed++;
      }
    }
    let hooked = false;
    if (body.webhook && board.team_id) {
      require('../webhooks').forTeam(board.team_id, 'retro_summary', { title: `Zusammenfassung: ${live.name}`, text: lines.join('\n'), url, linkText: 'Board öffnen' });
      hooked = true;
    }
    json(res, 200, { mailed, webhook: hooked });
  });

  /* ---------------- Mitglieder ---------------- */

  r.route('GET', '/api/boards/:id/members', async (req, res, { params }) => {
    const { board, role, user } = await requireRole(req, params.id, 'viewer');
    const owner = board.owner_id ? await db.one('SELECT * FROM users WHERE id = $1', [board.owner_id]) : null;
    // team_only: Person teilt mit der anfragenden ein Team, in dem diese nicht verwaltet – dort bleibt die Adresse
    // verborgen (wie in der Team-Ansicht), sonst ließe sie sich über ein eigenes Board auslesen
    const members = (await db.query(
      `SELECT u.*, m.role AS member_role,
              (EXISTS (SELECT 1 FROM team_members a JOIN team_members b ON b.team_id = a.team_id WHERE a.user_id = $2 AND b.user_id = u.id)
               AND NOT EXISTS (SELECT 1 FROM team_members a JOIN team_members b ON b.team_id = a.team_id WHERE a.user_id = $2 AND a.role = 'admin' AND b.user_id = u.id)) AS team_only
         FROM board_members m JOIN users u ON u.id = m.user_id
        WHERE m.board_id = $1 ORDER BY lower(COALESCE(u.display_name, u.username))`, [board.id, user.id])).rows;
    // Namen sind nicht eindeutig: Der Besitzer sieht zur Unterscheidung die E-Mail-Adressen, alle anderen nur Namen
    const pub = (u) => ({ id: String(u.id), displayName: u.display_name || u.username, color: u.color, ...(role === 'owner' && !u.team_only ? { email: u.email || '' } : {}) });
    json(res, 200, {
      myRole: role,
      linkAccess: board.link_access,
      owner: owner ? pub(owner) : null,
      members: members.map((m) => ({ ...pub(m), role: m.member_role })),
      pending: role === 'owner' ? await invites.listFor({ boardId: board.id }) : [],
    });
  });

  // Einladung an eine Adresse ohne Konto zurückziehen
  r.route('DELETE', '/api/boards/:id/pending/:pid', async (req, res, { params }) => {
    const { board } = await requireRole(req, params.id, 'owner');
    try {
      await invites.revoke({ boardId: board.id }, params.pid);
    } catch (e) {
      if (e.status) throw new HttpError(e.status, e.message);
      throw e;
    }
    json(res, 200, { ok: true });
  });

  // Personen aus den eigenen Teams als Vorschläge zum Teilen (keine Suche über alle Nutzenden)
  r.route('GET', '/api/boards/:id/share-candidates', async (req, res, { params }) => {
    const { board, user } = await requireRole(req, params.id, 'owner');
    const rows = (await db.query(
      `SELECT u.id, u.display_name, u.username, u.color, array_agg(DISTINCT t.name ORDER BY t.name) AS teams
         FROM team_members mine
         JOIN team_members other ON other.team_id = mine.team_id AND other.user_id <> mine.user_id
         JOIN teams t ON t.id = mine.team_id
         JOIN users u ON u.id = other.user_id AND u.status = 'active' AND u.role <> 'guest'
        WHERE mine.user_id = $1
          AND u.id IS DISTINCT FROM (SELECT owner_id FROM boards WHERE id = $2)
          AND u.id NOT IN (SELECT user_id FROM board_members WHERE board_id = $2)
        GROUP BY u.id ORDER BY lower(COALESCE(u.display_name, u.username)) LIMIT 300`, [user.id, board.id])).rows;
    // Ohne E-Mail-Adressen; gleiche Namen unterscheiden sich über die gemeinsamen Teams
    json(res, 200, { candidates: rows.map((u) => ({ id: String(u.id), displayName: u.display_name || u.username, color: u.color, teams: u.teams })) });
  });

  // Einladen: Person aus einem gemeinsamen Team (userId) oder über die genaue E-Mail-Adresse
  r.route('POST', '/api/boards/:id/members', async (req, res, { params }) => {
    const { board, user } = await requireRole(req, params.id, 'owner');
    const body = await readJson(req);
    const role = ['viewer', 'commenter'].includes(body.role) ? body.role : 'editor';
    let target = null;
    if (body.userId) {
      if (!/^\d{1,18}$/.test(String(body.userId))) throw new HttpError(404, 'Person nicht gefunden.');
      target = await db.one(
        `SELECT u.* FROM users u WHERE u.id = $1 AND u.status = 'active' AND u.role <> 'guest'
            AND EXISTS (SELECT 1 FROM team_members a JOIN team_members b ON b.team_id = a.team_id WHERE a.user_id = $2 AND b.user_id = u.id)`,
        [body.userId, user.id]);
      if (!target) throw new HttpError(404, 'Diese Person ist in keinem deiner Teams. Lade sie über ihre E-Mail-Adresse ein.');
    } else {
      const email = String(body.email || body.user || '').trim().toLowerCase();
      if (!looksLikeEmail(email)) throw new HttpError(400, 'Bitte gib eine vollständige E-Mail-Adresse an.');
      // Gegen das Ausforschen von Adressen: wenige Versuche je Stunde
      auth.rateLimit('share-email:' + user.id, 30, 60 * 60000);
      target = await db.one(`SELECT * FROM users WHERE lower(email) = $1 AND status = 'active' AND role <> 'guest'`, [email]);
      if (!target) {
        // Ohne Konto: erst nachfragen (Hinweis im Browser), nach Bestätigung per E-Mail zur Registrierung einladen
        if (!body.inviteUnregistered) throw new HttpError(404, 'Zu dieser E-Mail-Adresse gibt es noch kein Konto.', 'not_registered');
        auth.rateLimit('invite-mail:' + user.id, 20, 60 * 60000);
        auth.rateLimit('invite-mail-to:' + email, 5, 24 * 60 * 60000);
        const who = user.display_name || user.username;
        try {
          await invites.create({
            email, target: { boardId: board.id }, role, inviter: user, baseUrl: await baseUrl(req),
            mailText: {
              subject: `${who} möchte das Board „${board.name}“ mit dir teilen`, title: 'Einladung zu einem Board',
              paragraphs: [`${who} möchte das Board „${board.name}“ mit dir teilen.`, 'Registriere dich jetzt kostenlos, um darauf zuzugreifen – danach ist das Board automatisch mit dir geteilt. Die Einladung ist 30 Tage gültig.', 'Kennst du die Person nicht, kannst du diese E-Mail ignorieren.'],
            },
          });
        } catch (e) {
          if (e.status) throw new HttpError(e.status, e.message);
          throw e;
        }
        audit.log(req, 'invite_sent', { userId: user.id, details: { board: board.id } });
        return json(res, 201, { invited: true });
      }
    }
    if (String(target.id) === String(board.owner_id)) throw new HttpError(400, 'Das ist bereits der Besitzer des Boards.');
    await db.query(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role`, [board.id, target.id, role]);
    boards.kickUser(board.id, target.id);
    let mailed = false;
    const base = await baseUrl(req).catch(() => null);
    if (body.notify !== false && target.email && base && (await settings.mailConfigured())) {
      const url = `${base}/board/${board.id}`;
      mail.sendQuietly(target, `Einladung zu „${board.name}“`, 'Du wurdest zu einem Board eingeladen',
        [`${user.display_name || user.username} hat dich zum Board „${board.name}“ eingeladen (${{ editor: 'darf bearbeiten', commenter: 'darf kommentieren', viewer: 'darf ansehen' }[role]}).`],
        { label: 'Board öffnen', url });
      mailed = true;
    }
    json(res, 200, { ok: true, mailed });
  });

  r.route('PATCH', '/api/boards/:id/members/:uid', async (req, res, { params }) => {
    if (!/^\d+$/.test(params.uid)) throw new HttpError(404, 'Benutzer nicht gefunden.');
    const { board } = await requireRole(req, params.id, 'owner');
    const body = await readJson(req);
    const role = ['viewer', 'commenter'].includes(body.role) ? body.role : 'editor';
    await db.query('UPDATE board_members SET role = $3 WHERE board_id = $1 AND user_id = $2', [board.id, params.uid, role]);
    boards.kickUser(board.id, params.uid);
    json(res, 200, { ok: true });
  });

  r.route('DELETE', '/api/boards/:id/members/:uid', async (req, res, { params }) => {
    if (!/^\d+$/.test(params.uid)) throw new HttpError(404, 'Benutzer nicht gefunden.');
    const user = await auth.requireUser(req);
    // Mitglieder dürfen sich selbst entfernen, sonst nur der Besitzer
    if (String(user.id) !== String(params.uid)) await requireRole(req, params.id, 'owner');
    await db.query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2', [params.id, params.uid]);
    await db.query('DELETE FROM board_visits WHERE board_id = $1 AND user_id = $2', [params.id, params.uid]);
    boards.kickUser(params.id, params.uid);
    json(res, 200, { ok: true });
  });

  /* ---------------- Vorschaubild ---------------- */

  r.route('GET', '/api/boards/:id/thumb', async (req, res, { params }) => {
    await requireRole(req, params.id, 'viewer');
    const row = await db.one('SELECT thumbnail FROM boards WHERE id = $1', [params.id]);
    if (!row || !row.thumbnail) throw new HttpError(404, 'Kein Vorschaubild');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=60' });
    res.end(row.thumbnail);
  });

  r.route('PUT', '/api/boards/:id/thumb', async (req, res, { params }) => {
    await requireRole(req, params.id, 'editor');
    const txt = await readBody(req, MAX_THUMB * 1.4);
    const m = /^data:image\/png;base64,(.+)$/.exec(txt);
    if (!m) throw new HttpError(400, 'PNG-Data-URL erwartet');
    const reason = await uploads.checkDataUrl(txt, { req, kind: 'Vorschaubild' });
    if (reason) throw new HttpError(422, reason, 'upload_rejected');
    await db.query('UPDATE boards SET thumbnail = $2 WHERE id = $1', [params.id, Buffer.from(m[1], 'base64')]);
    json(res, 200, { ok: true });
  });

  /* ---------------- Echtzeit ---------------- */

  r.route('GET', '/api/boards/:id/events', async (req, res, { params, url }) => {
    // Abbruch durch den Client schon während der Datenbankabfragen erkennen
    let closed = false;
    res.on('close', () => (closed = true));
    const { user, role } = await requireRole(req, params.id, 'viewer', { guests: true });
    const clientId = url.searchParams.get('client');
    if (!boards.validId(clientId)) throw new HttpError(400, 'client fehlt');
    const poll = url.searchParams.get('transport') === 'poll';
    if (!poll) {
      // Stream sofort öffnen – noch vor dem (bei großen Boards evtl. langsamen) Laden. Das Polster am Anfang hilft
      // Proxys und Virenscannern, die Daten erst ab einigen KB weitergeben; „stream“ zeigt dem Browser, dass Ereignisse
      // durchkommen, damit er nicht vorschnell auf Long-Polling wechselt.
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(':' + ' '.repeat(2048) + '\nretry: 2000\n\ndata: {"type":"stream"}\n\n');
    }
    // Fehler nach dem Öffnen des Streams lassen sich nicht mehr als HTTP-Status melden
    const fail = (status, message) => {
      if (poll) throw new HttpError(status, message);
      res.end();
    };
    const b = await boards.load(params.id);
    if (!b) return fail(404, 'Board nicht gefunden.');
    const existing = boards.client(b.id, clientId);
    if (existing && existing.uid !== String(user.id)) return fail(409, 'Verbindungskennung bereits vergeben.');
    if (closed) return;
    const info = {
      clientId,
      userId: String(user.id),
      name: (user.display_name || user.username) + (user.role === 'guest' ? ' (Gast)' : ''),
      color: user.color,
      viewOnly: !boards.canEdit(role),
      role,
      guest: user.role === 'guest',
    };
    // Letzter Besuch (für „Änderungen seit deinem letzten Besuch“); ein Wiederverbinden innerhalb von 30 Minuten
    // zählt nicht als neuer Besuch
    const prevVisit = await db.one('SELECT visited_at, previous_visit_at FROM board_visits WHERE board_id = $1 AND user_id = $2', [b.id, user.id]).catch(() => null);
    const lastVisit = prevVisit ? new Date(Date.now() - new Date(prevVisit.visited_at) > 30 * 60000 ? prevVisit.visited_at : prevVisit.previous_visit_at || 0).getTime() || null : null;
    const visit = () => db.query(`INSERT INTO board_visits (board_id, user_id) VALUES ($1, $2)
              ON CONFLICT (board_id, user_id) DO UPDATE SET
                previous_visit_at = CASE WHEN board_visits.visited_at < now() - interval '30 minutes' THEN board_visits.visited_at ELSE board_visits.previous_visit_at END,
                visited_at = now()`, [b.id, user.id]).catch(() => {});
    // Beim Verlassen: „letzter Besuch“ ist das Ende, nicht der Beginn der Sitzung
    const leftAt = () => db.query('UPDATE board_visits SET visited_at = now() WHERE board_id = $1 AND user_id = $2', [b.id, user.id]).catch(() => {});

    // Rückfall-Transport: Long-Polling (falls Server-Sent Events blockiert werden)
    if (poll) {
      const ch = new boards.PollChannel();
      const peers = boards.join(b.id, clientId, { res: ch, user: info, role, uid: String(user.id), sid: req._sid });
      if (!peers) throw new HttpError(409, 'Verbindungskennung bereits vergeben.');
      ch.onClose(() => {
        if (boards.leave(b.id, clientId, ch)) boards.broadcast(b.id, { type: 'leave', clientId });
        leftAt();
      });
      boards.broadcast(b.id, { type: 'join', user: info }, clientId);
      visit();
      return json(res, 200, { messages: [{ type: 'hello', serverTime: Date.now(), version: VERSION, role, me: info, lastVisit, seq: b.opSeq, board: boards.serialize(b, user.id, boards.isFacilitator(b, user.id, role)), save: boards.saveState(b), peers, transport: 'poll' }] });
    }

    const peers = boards.join(b.id, clientId, { res, user: info, role, uid: String(user.id), sid: req._sid });
    if (!peers) return res.end();
    boards.send(res, { type: 'hello', serverTime: Date.now(), version: VERSION, role, me: info, lastVisit, seq: b.opSeq, board: boards.serialize(b, user.id, boards.isFacilitator(b, user.id, role)), save: boards.saveState(b), peers });
    boards.broadcast(b.id, { type: 'join', user: info }, clientId);
    visit();
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    res.on('close', () => {
      clearInterval(ping);
      if (boards.leave(b.id, clientId, res)) boards.broadcast(b.id, { type: 'leave', clientId });
      leftAt();
    });
  });

  // Nachrichten abholen (Long-Polling): antwortet sofort, wenn etwas vorliegt, sonst nach spätestens 25 s
  r.route('GET', '/api/boards/:id/poll', async (req, res, { params, url }) => {
    const user = await auth.requireUser(req, { guests: true });
    const c = boards.client(params.id, url.searchParams.get('client'));
    if (!c || !c.res.poll || c.uid !== String(user.id) || c.res.ended) throw new HttpError(410, 'Verbindung beendet – bitte neu verbinden.');
    const ch = c.res;
    ch.lastPoll = Date.now();
    if (!ch.queue.length) {
      ch.wake(); // eine evtl. noch wartende ältere Abfrage freigeben
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 25000);
        ch.waiter = () => {
          clearTimeout(t);
          resolve();
        };
        res.on('close', () => {
          if (ch.waiter) ch.wake();
        });
      });
    }
    ch.lastPoll = Date.now();
    if (res.destroyed) return;
    json(res, 200, { messages: ch.take() });
  });

  r.route('POST', '/api/boards/:id/ops', async (req, res, { params }) => {
    const user = await auth.requireUser(req, { guests: true });
    const body = await readJson(req);
    if (!Array.isArray(body.ops)) throw new HttpError(400, 'ops fehlt');
    const client = boards.client(params.id, body.clientId);
    // Operationen nur von einer aktiven Verbindung desselben Benutzers
    if (!client || client.uid !== String(user.id)) throw new HttpError(409, 'Keine aktive Verbindung zum Board.');
    const b = await boards.load(params.id);
    if (!b) throw new HttpError(404, 'Board nicht gefunden.');
    if (b.restoring) throw new HttpError(409, 'Board wird gerade wiederhergestellt.');
    // Stimmen und Schätzwerte dürfen auch Betrachter abgeben, Kommentare ab der Rolle „Kommentieren“
    const votes = body.ops.filter((o) => o && o.op === 'vote');
    const estimates = body.ops.filter((o) => o && o.op === 'estimate');
    const commentOps = body.ops.filter((o) => o && o.op === 'comment');
    // Umfrage-Stimmen, Lean-Coffee-Daumen und Reaktionen dürfen alle Teilnehmenden abgeben (auch Betrachter)
    const OPEN_OPS = new Set(['vote', 'estimate', 'comment', 'pollVote', 'romanVote', 'react']);
    const lightOps = body.ops.filter((o) => o && ['pollVote', 'romanVote', 'react'].includes(o.op));
    let rest = body.ops.filter((o) => o && !OPEN_OPS.has(o.op));
    const reply = {};
    // Eingefügte Datei-Elemente aus anderen Boards: Die Datei gibt es hier nicht – als „nicht verfügbar“ anzeigen
    for (const o of rest) {
      if (o.op !== 'upsert' || !o.el || o.el.type !== 'file' || !o.el.fileId || b.elements.has(o.el.id)) continue;
      if (!(await require('../files').info(b.id, o.el.fileId))) {
        delete o.el.fileId;
        delete o.el.preview;
      }
    }
    // Hochgeladene Bilder vor dem Übernehmen prüfen (Dateityp + Virenscan). Feldänderungen ergeben ihr Ergebnis erst auf dem
    // aktuellen Stand, und der kann sich während der Prüfung ändern: Darum wird geprüft, bis nichts Ungeprüftes mehr übrig ist.
    // Zwischen dem letzten Durchlauf und dem Übernehmen liegt kein await.
    if (boards.canEdit(client.role)) {
      const verified = new Set();
      for (let round = 0; ; round++) {
        const todo = boards.expandPatches(b, rest).filter((o) => o.op === 'upsert' && o.el && o.el.type === 'image' && o.el.src && !verified.has(o.el.src)).map((o) => o.el);
        if (!todo.length) break;
        // Gleicher Inhalt wird nur einmal geprüft, das Ergebnis gilt für alle Elemente damit
        const unique = [...new Map(todo.map((el) => [el.src, el])).values()];
        const results = round < 4
          ? await uploads.checkElements(unique, { req, userId: user.id })
          : unique.map((el) => ({ id: el.id, reason: 'Der Virenscanner ist gerade nicht erreichbar. Bitte versuche es in einigen Minuten erneut.' }));
        const reasons = new Map(results.map((x) => [unique.find((el) => el.id === x.id).src, x.reason]));
        const rejected = todo.filter((el) => reasons.has(el.src)).map((el) => ({ id: el.id, reason: reasons.get(el.src) }));
        const bad = new Set(rejected.map((x) => x.id));
        for (const el of unique) if (!reasons.has(el.src)) verified.add(el.src);
        if (rejected.length) {
          rest = rest.filter((o) => !(o.op === 'upsert' && o.el && bad.has(o.el.id)) && !(o.op === 'patch' && bad.has(o.id)));
          reply.rejected = [...(reply.rejected || []), ...rejected];
        }
      }
    }
    if (rest.length) {
      if (!boards.canEdit(client.role)) throw new HttpError(403, 'Du darfst dieses Board nur ansehen.');
      // Kein await zwischen Prüfen, Anwenden und Übernehmen: Änderungen anderer dürfen nicht dazwischenrutschen
      const gone = rest.filter((o) => o.op === 'patch' && !b.elements.has(o.id)).map((o) => o.id);
      if (gone.length) reply.gone = gone;
      Object.assign(reply, boards.applyOps(b, boards.expandPatches(b, rest), client));
    }
    for (const v of votes) {
      const res = boards.applyVote(b, v, user.id);
      if (res) reply.voting = res;
    }
    for (const e of estimates) boards.applyEstimate(b, e, user);
    for (const o of lightOps.slice(0, 50)) {
      if (o.op === 'pollVote') boards.applyPollVote(b, o, user);
      else if (o.op === 'romanVote') boards.applyRomanVote(b, o, user);
      else if (o.op === 'react') {
        // Die Änderungen des Pakets sind übernommen: Eine Drosselung darf die Antwort nicht mehr zur Ablehnung machen
        try {
          auth.rateLimit('react:' + user.id, 300, 60000);
          boards.applyReaction(b, o, user, client.role);
        } catch (e) {
          if (!e.status) throw e;
          reply.error = i18n.tr(e.message);
        }
      }
    }
    if (commentOps.length) {
      const origin = await originOf(req);
      for (const o of commentOps.slice(0, 50)) {
        try {
          auth.rateLimit('comment:' + user.id, 120, 60000);
          await comments.apply(b, o, { user, client, origin });
        } catch (e) {
          if (!e.status) throw e;
          reply.error = i18n.tr(e.message);
          if (o.action === 'add' && !b.elements.has(o.id)) (reply.revert = reply.revert || []).push({ op: 'delete', id: o.id });
        }
      }
    }
    // Speicherstand: der Browser zeigt „gespeichert“, sobald savedSeq diesen Stand erreicht
    json(res, 200, { ok: true, ...reply, save: boards.saveState(b) });
  });

  r.route('POST', '/api/boards/:id/signal', async (req, res, { params }) => {
    const user = await auth.requireUser(req, { guests: true });
    const body = await readJson(req);
    const client = boards.client(params.id, body.clientId);
    if (!client || client.uid !== String(user.id)) throw new HttpError(409, 'Keine aktive Verbindung zum Board.');
    const kind = String(body.kind || '');
    if (!SIGNALS.has(kind)) throw new HttpError(400, 'Unbekanntes Signal.');
    // Ansichten anderer steuern dürfen nur Bearbeitende
    if ((kind === 'summon' || kind === 'lead') && !boards.canEdit(client.role)) throw new HttpError(403, 'Du darfst dieses Board nur ansehen.');
    if (kind === 'summon' || kind === 'lead') {
      const b = boards.cache.get(params.id);
      if (b && boards.toolsReserved(b, user.id, client.role)) throw new HttpError(403, 'Das ist während der Moderation den Moderierenden vorbehalten.');
    }
    boards.broadcast(params.id, { type: 'signal', from: body.clientId, kind, data: body.data }, body.clientId);
    json(res, 200, { ok: true });
  });
}

module.exports = { register };
