'use strict';
// Teams (gemeinsame Bereiche mit Rechten für alle Mitglieder) und Ordner (persönlich oder im Team)
const db = require('./db');
const { looksLikeEmail } = require('./email');
const boards = require('./boards');
const settings = require('./settings');

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const validName = (n, what) => {
  const s = String(n || '').trim().slice(0, 80);
  if (!s) throw fail(`Bitte gib einen Namen für ${what} an.`);
  return s;
};
const checkId = (id) => {
  if (!/^\d{1,18}$/.test(String(id))) throw fail('Nicht gefunden.', 404);
  return String(id);
};

async function membership(teamId, userId) {
  return db.one('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
}

async function requireMember(teamId, user, admin = false) {
  checkId(teamId);
  const team = await db.one('SELECT * FROM teams WHERE id = $1', [teamId]);
  if (!team) throw fail('Team nicht gefunden.', 404);
  const m = await membership(teamId, user.id);
  const isAdmin = user.role === 'admin' || (m && m.role === 'admin');
  if (!m && user.role !== 'admin') throw fail('Du gehörst nicht zu diesem Team.', 403);
  if (admin && !isAdmin) throw fail('Nur Team-Verwaltende können das ändern.', 403);
  return { team, myRole: m ? m.role : 'admin' };
}

// Verbindungen auf allen Boards eines Teams neu aufbauen lassen (Rechte haben sich geändert)
async function refreshTeamBoards(teamId, userId = null) {
  const ids = (await db.query('SELECT id FROM boards WHERE team_id = $1', [teamId])).rows.map((r) => r.id);
  for (const id of ids) {
    if (userId) boards.kickUser(id, userId);
    else for (const c of [...(boards.rooms.get(id)?.values() || [])]) if (c.role !== 'owner') boards.kickUser(id, c.uid);
  }
}

async function listMine(user) {
  const rows = (await db.query(
    `SELECT t.id, t.name, m.role, (SELECT count(*) FROM team_members x WHERE x.team_id = t.id)::int AS members,
            (SELECT count(*) FROM boards b WHERE b.team_id = t.id AND b.deleted_at IS NULL)::int AS boards
       FROM teams t JOIN team_members m ON m.team_id = t.id AND m.user_id = $1 ORDER BY lower(t.name)`, [user.id])).rows;
  return rows.map((t) => ({ id: String(t.id), name: t.name, role: t.role, members: t.members, boards: t.boards }));
}

async function create(user, name) {
  const s = (await settings.get()).collab;
  if (s.teamCreation === 'admins' && user.role !== 'admin') throw fail('Teams können in dieser Installation nur Administratoren anlegen.', 403);
  const n = validName(name, 'das Team');
  return db.tx(async (c) => {
    const t = (await c.query('INSERT INTO teams (name, created_by) VALUES ($1, $2) RETURNING id', [n, user.id])).rows[0];
    await c.query(`INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'admin')`, [t.id, user.id]);
    return String(t.id);
  });
}

async function details(teamId, user) {
  const { team, myRole } = await requireMember(teamId, user);
  const admin = myRole === 'admin';
  const members = (await db.query(
    `SELECT u.id, u.username, u.display_name, u.color, u.email, m.role FROM team_members m JOIN users u ON u.id = m.user_id
      WHERE m.team_id = $1 ORDER BY m.role, lower(COALESCE(u.display_name, u.username))`, [team.id])).rows;
  // Offene Einladungen sehen nur Team-Verwaltende (mit E-Mail-Adresse, da Namen nicht eindeutig sind)
  const invites = admin ? (await db.query(
    `SELECT u.id, u.display_name, u.username, u.email, u.color, i.role, i.created_at FROM team_invitations i JOIN users u ON u.id = i.user_id
      WHERE i.team_id = $1 ORDER BY i.created_at`, [team.id])).rows : [];
  return {
    id: String(team.id), name: team.name, myRole,
    // Team-Verwaltende sehen zur Unterscheidung gleichnamiger Personen die E-Mail-Adressen
    members: members.map((u) => ({ id: String(u.id), displayName: u.display_name || u.username, color: u.color, role: u.role, ...(admin ? { email: u.email || '' } : {}) })),
    invitations: invites.map((u) => ({ id: String(u.id), displayName: u.display_name || u.username, email: u.email || '', color: u.color, role: u.role, createdAt: new Date(u.created_at).getTime() })),
    pending: admin ? await require('./invites').listFor({ teamId: team.id }) : [],
  };
}

async function rename(teamId, user, name) {
  await requireMember(teamId, user, true);
  await db.query('UPDATE teams SET name = $2 WHERE id = $1', [teamId, validName(name, 'das Team')]);
}

async function remove(teamId, user) {
  await requireMember(teamId, user, true);
  const ids = (await db.query('SELECT id FROM boards WHERE team_id = $1', [teamId])).rows.map((r) => r.id);
  await db.query('DELETE FROM teams WHERE id = $1', [teamId]);
  // Erst nach dem Löschen neu verbinden lassen, sonst gälte beim sofortigen Wiederverbinden noch die Teamrolle
  for (const id of ids) for (const c of [...(boards.rooms.get(id)?.values() || [])]) if (c.role !== 'owner') boards.kickUser(id, c.uid);
}

// Einladen über die genaue E-Mail-Adresse. Mitglied wird die Person erst, wenn sie die Einladung annimmt.
async function invite(teamId, user, email, role, origin, inviteUnregistered = false) {
  const { team } = await requireMember(teamId, user, true);
  const addr = String(email || '').trim().toLowerCase();
  if (!looksLikeEmail(addr)) throw fail('Bitte gib eine vollständige E-Mail-Adresse an.');
  require('./auth').rateLimit('team-invite:' + user.id, 30, 60 * 60000);
  const target = await db.one(`SELECT * FROM users WHERE lower(email) = $1 AND status = 'active' AND role <> 'guest'`, [addr]);
  const r = role === 'admin' ? 'admin' : 'member';
  if (!target) {
    if (!inviteUnregistered) throw Object.assign(fail('Zu dieser E-Mail-Adresse gibt es noch kein Konto.', 404), { code: 'not_registered' });
    const auth = require('./auth');
    auth.rateLimit('invite-mail:' + user.id, 20, 60 * 60000);
    auth.rateLimit('invite-mail-to:' + addr, 5, 24 * 60 * 60000);
    if (!origin) throw fail('Die öffentliche Adresse ist nicht eingerichtet.');
    const who = user.display_name || user.username;
    await require('./invites').create({
      email: addr, target: { teamId }, role: r, inviter: user, baseUrl: origin,
      mailText: {
        subject: `${who} lädt dich in das Team „${team.name}“ ein`, title: 'Einladung in ein Team',
        paragraphs: [`${who} lädt dich in das Team „${team.name}“ ein.`, 'Registriere dich jetzt kostenlos über den Link in dieser E-Mail – damit trittst du dem Team bei und siehst seine Boards. Die Einladung ist 30 Tage gültig.', 'Kennst du die Person nicht, kannst du diese E-Mail ignorieren.'],
      },
    });
    return { invited: true };
  }
  if (await membership(teamId, target.id)) throw fail('Diese Person ist bereits im Team.', 409);
  const row = await db.one(
    `INSERT INTO team_invitations (team_id, user_id, role, invited_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (team_id, user_id) DO NOTHING RETURNING user_id`, [teamId, target.id, r, user.id]);
  if (!row) throw fail('Diese Person ist bereits eingeladen.', 409);
  await require('./notify').teamInvite({ target, actor: user, team, origin });
  return { invited: false };
}

async function revokeInvite(teamId, user, uid) {
  await requireMember(teamId, user, true);
  checkId(uid);
  await db.query('DELETE FROM team_invitations WHERE team_id = $1 AND user_id = $2', [teamId, uid]);
  // Die Benachrichtigung zur zurückgezogenen Einladung ergibt keinen Sinn mehr
  await db.query(`DELETE FROM notifications WHERE user_id = $1 AND team_id = $2 AND kind = 'team_invite'`, [uid, teamId]);
}

// Eigene offene Einladungen
async function myInvitations(user) {
  const rows = (await db.query(
    `SELECT t.id, t.name, i.role, i.created_at, COALESCE(u.display_name, u.username) AS by_name
       FROM team_invitations i JOIN teams t ON t.id = i.team_id LEFT JOIN users u ON u.id = i.invited_by
      WHERE i.user_id = $1 ORDER BY i.created_at DESC`, [user.id])).rows;
  return rows.map((r) => ({ teamId: String(r.id), teamName: r.name, role: r.role, by: r.by_name || '', createdAt: new Date(r.created_at).getTime() }));
}

// Einladung annehmen oder ablehnen
async function answer(teamId, user, accept) {
  checkId(teamId);
  const done = await db.tx(async (c) => {
    const inv = (await c.query('DELETE FROM team_invitations WHERE team_id = $1 AND user_id = $2 RETURNING role', [teamId, user.id])).rows[0];
    if (!inv) throw fail('Diese Einladung gibt es nicht mehr.', 404);
    if (accept) await c.query(`INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [teamId, user.id, inv.role]);
    return true;
  });
  await db.query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND team_id = $2 AND kind = 'team_invite' AND read_at IS NULL`, [user.id, teamId]);
  if (accept) await refreshTeamBoards(teamId, user.id);
  return done;
}

async function setMemberRole(teamId, user, uid, role) {
  await requireMember(teamId, user, true);
  checkId(uid);
  const r = role === 'admin' ? 'admin' : 'member';
  await db.tx(async (c) => {
    await c.query('LOCK TABLE team_members IN SHARE ROW EXCLUSIVE MODE');
    if (r === 'member') {
      const others = (await c.query(`SELECT count(*)::int AS n FROM team_members WHERE team_id = $1 AND role = 'admin' AND user_id <> $2`, [teamId, uid])).rows[0].n;
      if (!others) throw fail('Ein Team braucht mindestens eine verwaltende Person.');
    }
    await c.query('UPDATE team_members SET role = $3 WHERE team_id = $1 AND user_id = $2', [teamId, uid, r]);
  });
}

// Mitglied entfernen (Verwaltende) oder selbst austreten
async function removeMember(teamId, user, uid) {
  checkId(uid);
  if (String(uid) !== String(user.id)) await requireMember(teamId, user, true);
  else await requireMember(teamId, user);
  await db.tx(async (c) => {
    await c.query('LOCK TABLE team_members IN SHARE ROW EXCLUSIVE MODE');
    const m = (await c.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, uid])).rows[0];
    if (!m) return;
    if (m.role === 'admin') {
      const others = (await c.query(`SELECT count(*)::int AS n FROM team_members WHERE team_id = $1 AND role = 'admin' AND user_id <> $2`, [teamId, uid])).rows[0].n;
      if (!others) throw fail('Die letzte verwaltende Person kann das Team nicht verlassen. Ernenne zuerst jemand anderen oder lösche das Team.');
    }
    await c.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, uid]);
  });
  await refreshTeamBoards(teamId, uid);
}

// Board einem Team zuordnen (nur Besitzer, nur eigene Teams) oder die Zuordnung lösen
async function assignBoard(boardId, user, teamId, teamRole, origin = null) {
  const role = ['editor', 'commenter', 'viewer'].includes(teamRole) ? teamRole : 'editor';
  const before = await db.one('SELECT team_id FROM boards WHERE id = $1', [boardId]);
  if (teamId) {
    await requireMember(teamId, user);
    await db.query('UPDATE boards SET team_id = $2, team_role = $3 WHERE id = $1', [boardId, teamId, role]);
  } else {
    await db.query(`UPDATE boards SET team_id = NULL, team_role = 'editor' WHERE id = $1`, [boardId]);
  }
  // Aus Ordnern des bisherigen Teams entfernen
  if (before && before.team_id && String(before.team_id) !== String(teamId || '')) {
    await db.query('DELETE FROM folder_boards fb USING folders f WHERE fb.folder_id = f.id AND f.team_id = $1 AND fb.board_id = $2', [before.team_id, boardId]);
  }
  for (const c of [...(boards.rooms.get(boardId)?.values() || [])]) if (c.role !== 'owner') boards.kickUser(boardId, c.uid);
  // Team-Webhook: Board neu für das Team freigegeben
  if (teamId && (!before || String(before.team_id || '') !== String(teamId))) {
    const info = await db.one('SELECT b.name, t.name AS team FROM boards b JOIN teams t ON t.id = $2 WHERE b.id = $1', [boardId, teamId]);
    if (info) {
      require('./webhooks').forTeam(teamId, 'board_shared', {
        title: 'Neues Board im Team', text: `${user.display_name || user.username} hat das Board „${info.name}“ für das Team „${info.team}“ freigegeben.`,
        url: origin ? `${origin}/board/${boardId}` : null, linkText: 'Board öffnen', data: { boardId, teamId: String(teamId) },
      });
    }
  }
}

/* ---------------- Ordner ---------------- */

async function listFolders(user) {
  const rows = (await db.query(
    `SELECT f.id, f.name, f.team_id, f.user_id FROM folders f
      WHERE f.user_id = $1 OR f.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)
      ORDER BY lower(f.name)`, [user.id])).rows;
  return rows.map((f) => ({ id: String(f.id), name: f.name, teamId: f.team_id ? String(f.team_id) : null }));
}

async function requireFolder(folderId, user) {
  checkId(folderId);
  const f = await db.one('SELECT * FROM folders WHERE id = $1', [folderId]);
  if (!f) throw fail('Ordner nicht gefunden.', 404);
  if (f.user_id && String(f.user_id) !== String(user.id)) throw fail('Ordner nicht gefunden.', 404);
  if (f.team_id) await requireMember(f.team_id, user);
  return f;
}

async function createFolder(user, name, teamId) {
  const n = validName(name, 'den Ordner');
  if (teamId) {
    await requireMember(teamId, user);
    return String((await db.one('INSERT INTO folders (name, team_id) VALUES ($1, $2) RETURNING id', [n, teamId])).id);
  }
  return String((await db.one('INSERT INTO folders (name, user_id) VALUES ($1, $2) RETURNING id', [n, user.id])).id);
}

async function renameFolder(folderId, user, name) {
  await requireFolder(folderId, user);
  await db.query('UPDATE folders SET name = $2 WHERE id = $1', [folderId, validName(name, 'den Ordner')]);
}

async function deleteFolder(folderId, user) {
  await requireFolder(folderId, user);
  await db.query('DELETE FROM folders WHERE id = $1', [folderId]); // Boards bleiben erhalten
}

// Board in einen Ordner legen; je Bereich (persönlich bzw. Team) liegt ein Board in höchstens einem Ordner
async function moveBoard(folderId, user, boardId) {
  const f = await requireFolder(folderId, user);
  const { board, role } = await boards.access(boardId, user);
  if (!board || !role) throw fail('Board nicht gefunden.', 404);
  if (f.team_id && String(board.team_id) !== String(f.team_id)) throw fail('Das Board gehört nicht zu diesem Team. Ordne es zuerst dem Team zu.');
  await db.tx(async (c) => {
    if (f.team_id) await c.query('DELETE FROM folder_boards fb USING folders x WHERE fb.folder_id = x.id AND x.team_id = $1 AND fb.board_id = $2', [f.team_id, boardId]);
    else await c.query('DELETE FROM folder_boards fb USING folders x WHERE fb.folder_id = x.id AND x.user_id = $1 AND fb.board_id = $2', [user.id, boardId]);
    await c.query('INSERT INTO folder_boards (folder_id, board_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [f.id, boardId]);
  });
}

async function unfileBoard(folderId, user, boardId) {
  await requireFolder(folderId, user);
  await db.query('DELETE FROM folder_boards WHERE folder_id = $1 AND board_id = $2', [folderId, boardId]);
}

module.exports = {
  requireMember,
  listMine, create, details, rename, remove, invite, revokeInvite, myInvitations, answer, setMemberRole, removeMember, assignBoard, membership,
  listFolders, createFolder, renameFolder, deleteFolder, moveBoard, unfileBoard,
};
