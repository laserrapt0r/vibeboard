'use strict';
// Teams (gemeinsame Bereiche mit Rechten für alle Mitglieder) und Ordner (persönlich oder im Team)
const db = require('./db');
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
            (SELECT count(*) FROM boards b WHERE b.team_id = t.id)::int AS boards
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
  const members = (await db.query(
    `SELECT u.id, u.username, u.display_name, u.color, m.role FROM team_members m JOIN users u ON u.id = m.user_id
      WHERE m.team_id = $1 ORDER BY m.role, lower(u.username)`, [team.id])).rows;
  return {
    id: String(team.id), name: team.name, myRole,
    members: members.map((u) => ({ id: String(u.id), username: u.username, displayName: u.display_name || u.username, color: u.color, role: u.role })),
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

async function addMember(teamId, user, login, role) {
  await requireMember(teamId, user, true);
  const target = await db.one(
    `SELECT id FROM users WHERE (lower(username) = lower($1) OR lower(email) = lower($1)) AND status = 'active' AND role <> 'guest'`, [String(login || '').trim()]);
  if (!target) throw fail('Benutzer nicht gefunden.', 404);
  // Bestehende Mitglieder bleiben unverändert (Rollenwechsel nur über setMemberRole mit Schutz der letzten Verwaltung)
  const added = await db.one(
    `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (team_id, user_id) DO NOTHING RETURNING user_id`, [teamId, target.id, role === 'admin' ? 'admin' : 'member']);
  if (!added) throw fail('Diese Person ist bereits im Team. Die Rolle änderst du in der Mitgliederliste.', 409);
  await refreshTeamBoards(teamId, target.id);
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
async function assignBoard(boardId, user, teamId, teamRole) {
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
  listMine, create, details, rename, remove, addMember, setMemberRole, removeMember, assignBoard, membership,
  listFolders, createFolder, renameFolder, deleteFolder, moveBoard, unfileBoard,
};
