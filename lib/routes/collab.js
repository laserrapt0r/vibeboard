'use strict';
// Zusammenarbeit im Team: Benachrichtigungen, Gastlinks, Teams und Ordner, Aufzeichnungen
const auth = require('../auth');
const boards = require('../boards');
const notify = require('../notify');
const guests = require('../guests');
const teams = require('../teams');
const recordings = require('../recordings');
const activity = require('../activity');
const audit = require('../audit');
const webhooks = require('../webhooks');
const { HttpError, readJson, readBody, json, clientIp } = require('../http');

// Fachliche Fehler der Module (mit status) als HTTP-Fehler weitergeben
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
  if (!role || boards.ROLE_RANK[role] < boards.ROLE_RANK[min]) throw new HttpError(403, min === 'owner' ? 'Nur der Besitzer kann das ändern.' : 'Dafür fehlen dir die Rechte auf diesem Board.');
  return { user, board, role };
}

const MAX_RECORDING_BODY = 25 * 1024 * 1024;

function register(r) {
  /* ---------------- Benachrichtigungen ---------------- */

  r.route('GET', '/api/notifications', wrap(async (req, res, { url }) => {
    const u = await auth.requireUser(req);
    json(res, 200, await notify.list(u.id, Number(url.searchParams.get('limit')) || 50));
  }));

  r.route('POST', '/api/notifications/read', wrap(async (req, res) => {
    const u = await auth.requireUser(req);
    const body = await readJson(req);
    await notify.markRead(u.id, { ids: body.ids, all: body.all === true, boardId: boards.validId(body.boardId) ? body.boardId : null, elementId: boards.validId(body.elementId) ? body.elementId : null });
    json(res, 200, await notify.list(u.id, 50));
  }));

  /* ---------------- Gastlinks ---------------- */

  r.route('GET', '/api/boards/:id/guest-links', wrap(async (req, res, { params }) => {
    const { board } = await boardRole(req, params.id, 'owner');
    json(res, 200, { enabled: await guests.enabled(), links: await guests.list(board.id) });
  }));

  r.route('POST', '/api/boards/:id/guest-links', wrap(async (req, res, { params }) => {
    const { board, user } = await boardRole(req, params.id, 'owner');
    auth.rateLimit('guest-link:' + user.id, 30, 60 * 60000);
    const body = await readJson(req);
    const { token, link } = await guests.create(board.id, user, body);
    audit.log(req, 'guest_link_created', { userId: user.id, details: { board: board.id, role: link.role, expiresAt: link.expiresAt } });
    json(res, 201, { token, link });
  }));

  r.route('DELETE', '/api/boards/:id/guest-links/:lid', wrap(async (req, res, { params }) => {
    const { board, user } = await boardRole(req, params.id, 'owner');
    if (!(await guests.revoke(board.id, params.lid))) throw new HttpError(404, 'Gastlink nicht gefunden.');
    audit.log(req, 'guest_link_revoked', { userId: user.id, details: { board: board.id, link: params.lid } });
    json(res, 200, { ok: true });
  }));

  // Beitrittsseite (ohne Anmeldung)
  r.route('GET', '/api/guest/:token', wrap(async (req, res, { params }) => {
    auth.rateLimit('guest-info:' + clientIp(req), 120, 10 * 60000);
    const me = await auth.currentUser(req);
    json(res, 200, { ...(await guests.info(params.token, me)), signedIn: !!(me && me.role !== 'guest') });
  }));

  r.route('POST', '/api/guest/join', wrap(async (req, res) => {
    auth.rateLimit('guest-join:' + clientIp(req), 20, 10 * 60000);
    const me = await auth.currentUser(req);
    if (me && me.role !== 'guest') throw new HttpError(400, 'Du bist bereits angemeldet. Gastlinks sind für Personen ohne Konto gedacht.');
    const body = await readJson(req);
    if (body.consent !== true) throw new HttpError(400, 'Bitte bestätige den Hinweis zum Datenschutz.');
    // Eine bestehende Gastsitzung (anderer Link) wird ersetzt – das alte Gastkonto wird entfernt
    if (me) {
      await auth.destroySession(req, res);
      await guests.drop(me.id);
    }
    const { boardId, user } = await guests.join(body.token, body.name, req, res);
    audit.log(req, 'guest_joined', { userId: user.id, details: { board: boardId } });
    json(res, 200, { boardId });
  }));

  /* ---------------- Teams ---------------- */

  r.route('GET', '/api/teams', wrap(async (req, res) => {
    const u = await auth.requireUser(req);
    json(res, 200, { teams: await teams.listMine(u) });
  }));

  r.route('POST', '/api/teams', wrap(async (req, res) => {
    const u = await auth.requireUser(req);
    auth.rateLimit('team-create:' + u.id, 20, 60 * 60000);
    const body = await readJson(req);
    json(res, 201, { id: await teams.create(u, body.name) });
  }));

  r.route('GET', '/api/teams/:tid', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    json(res, 200, await teams.details(params.tid, u));
  }));

  r.route('PATCH', '/api/teams/:tid', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    const body = await readJson(req);
    await teams.rename(params.tid, u, body.name);
    json(res, 200, { ok: true });
  }));

  r.route('DELETE', '/api/teams/:tid', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    await teams.remove(params.tid, u);
    json(res, 200, { ok: true });
  }));

  // Einladen (Mitglied erst nach Annahme)
  r.route('POST', '/api/teams/:tid/invitations', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    const body = await readJson(req);
    await teams.invite(params.tid, u, body.email, body.role, await require('./auth').baseUrl(req).catch(() => null));
    json(res, 201, { ok: true });
  }));

  r.route('DELETE', '/api/teams/:tid/invitations/:uid', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    await teams.revokeInvite(params.tid, u, params.uid);
    json(res, 200, { ok: true });
  }));

  r.route('GET', '/api/team-invitations', wrap(async (req, res) => {
    const u = await auth.requireUser(req);
    json(res, 200, { invitations: await teams.myInvitations(u) });
  }));

  r.route('POST', '/api/team-invitations/:tid/accept', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    await teams.answer(params.tid, u, true);
    json(res, 200, { ok: true });
  }));

  r.route('POST', '/api/team-invitations/:tid/decline', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    await teams.answer(params.tid, u, false);
    json(res, 200, { ok: true });
  }));

  r.route('PATCH', '/api/teams/:tid/members/:uid', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    const body = await readJson(req);
    await teams.setMemberRole(params.tid, u, params.uid, body.role);
    json(res, 200, { ok: true });
  }));

  r.route('DELETE', '/api/teams/:tid/members/:uid', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    await teams.removeMember(params.tid, u, params.uid);
    json(res, 200, { ok: true });
  }));

  /* ---------------- Webhooks (Chat-Anbindung) ---------------- */

  r.route('GET', '/api/webhooks/meta', wrap(async (req, res) => {
    await auth.requireUser(req);
    json(res, 200, { enabled: await webhooks.enabled(), userEvents: webhooks.USER_EVENTS, teamEvents: webhooks.TEAM_EVENTS, formats: webhooks.FORMATS });
  }));

  // Eigentümer eines Webhooks: die eigene Person oder ein Team (nur Team-Verwaltende)
  const hookOwner = async (req, tid) => {
    const u = await auth.requireUser(req);
    if (!tid) return { u, owner: { userId: u.id } };
    await teams.requireMember(tid, u, true);
    return { u, owner: { teamId: tid } };
  };

  for (const [base, team] of [['/api/webhooks', false], ['/api/teams/:tid/webhooks', true]]) {
    r.route('GET', base, wrap(async (req, res, { params }) => {
      const { owner } = await hookOwner(req, team ? params.tid : null);
      json(res, 200, { webhooks: await webhooks.list(owner) });
    }));
    r.route('POST', base, wrap(async (req, res, { params }) => {
      const { u, owner } = await hookOwner(req, team ? params.tid : null);
      auth.rateLimit('webhook:' + u.id, 20, 60 * 60000);
      const hook = await webhooks.create(owner, await readJson(req), u.id);
      audit.log(req, 'webhook_created', { userId: u.id, details: { webhook: hook.id, host: hook.host, team: team ? params.tid : null } });
      json(res, 201, hook);
    }));
    r.route('DELETE', base + '/:hid', wrap(async (req, res, { params }) => {
      const { u, owner } = await hookOwner(req, team ? params.tid : null);
      await webhooks.remove(owner, params.hid);
      audit.log(req, 'webhook_deleted', { userId: u.id, details: { webhook: params.hid, team: team ? params.tid : null } });
      json(res, 200, { ok: true });
    }));
    r.route('POST', base + '/:hid/test', wrap(async (req, res, { params }) => {
      const { u, owner } = await hookOwner(req, team ? params.tid : null);
      auth.rateLimit('webhook-test:' + u.id, 20, 10 * 60000);
      await webhooks.test(owner, params.hid, await require('./auth').baseUrl(req).catch(() => null));
      json(res, 200, { ok: true });
    }));
  }

  /* ---------------- Ordner ---------------- */

  r.route('GET', '/api/folders', wrap(async (req, res) => {
    const u = await auth.requireUser(req);
    json(res, 200, { folders: await teams.listFolders(u) });
  }));

  r.route('POST', '/api/folders', wrap(async (req, res) => {
    const u = await auth.requireUser(req);
    const body = await readJson(req);
    json(res, 201, { id: await teams.createFolder(u, body.name, body.teamId ? String(body.teamId) : null) });
  }));

  r.route('PATCH', '/api/folders/:fid', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    const body = await readJson(req);
    await teams.renameFolder(params.fid, u, body.name);
    json(res, 200, { ok: true });
  }));

  r.route('DELETE', '/api/folders/:fid', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    await teams.deleteFolder(params.fid, u);
    json(res, 200, { ok: true });
  }));

  r.route('PUT', '/api/folders/:fid/boards/:id', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    await teams.moveBoard(params.fid, u, params.id);
    json(res, 200, { ok: true });
  }));

  r.route('DELETE', '/api/folders/:fid/boards/:id', wrap(async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    await teams.unfileBoard(params.fid, u, params.id);
    json(res, 200, { ok: true });
  }));

  /* ---------------- Aufzeichnungen ---------------- */

  r.route('GET', '/api/boards/:id/recordings', wrap(async (req, res, { params }) => {
    const { board } = await boardRole(req, params.id, 'viewer', { guests: true });
    json(res, 200, { recordings: await recordings.list(board.id) });
  }));

  r.route('POST', '/api/boards/:id/recordings', wrap(async (req, res, { params }) => {
    const { board, user } = await boardRole(req, params.id, 'commenter', { guests: true });
    auth.rateLimit('recording:' + user.id, 30, 60 * 60000);
    const raw = await readBody(req, MAX_RECORDING_BODY);
    let body;
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      throw new HttpError(400, 'Ungültiges JSON');
    }
    const id = await recordings.create(board.id, user, body, req);
    activity.record(board.id, { userId: String(user.id), name: user.display_name || user.username, color: user.color }, 'recorded', null, { label: String(body.title || 'Rundgang').slice(0, 80) });
    boards.broadcast(board.id, { type: 'recordings' });
    json(res, 201, { id });
  }));

  r.route('GET', '/api/boards/:id/recordings/:rid', wrap(async (req, res, { params }) => {
    const { board } = await boardRole(req, params.id, 'viewer', { guests: true });
    const rec = await recordings.get(board.id, params.rid);
    if (!rec) throw new HttpError(404, 'Aufzeichnung nicht gefunden.');
    json(res, 200, rec);
  }));

  r.route('GET', '/api/boards/:id/recordings/:rid/audio', wrap(async (req, res, { params }) => {
    const { board } = await boardRole(req, params.id, 'viewer', { guests: true });
    const a = await recordings.audio(board.id, params.rid);
    if (!a) throw new HttpError(404, 'Keine Tonspur vorhanden.');
    res.writeHead(200, { 'Content-Type': a.audio_type, 'Content-Length': a.audio.length, 'Cache-Control': 'private, max-age=3600' });
    res.end(a.audio);
  }));

  r.route('DELETE', '/api/boards/:id/recordings/:rid', wrap(async (req, res, { params }) => {
    const { board, user, role } = await boardRole(req, params.id, 'viewer', { guests: true });
    await recordings.remove(board.id, params.rid, user, role);
    boards.broadcast(board.id, { type: 'recordings' });
    json(res, 200, { ok: true });
  }));
}

module.exports = { register };
