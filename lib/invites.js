'use strict';
const log = require('./log').child('invites');
// Einladungen an Adressen ohne Konto: Board oder Team wird vorgemerkt und per E-Mail angeboten.
// Sobald ein Konto mit dieser (bestätigten) Adresse existiert, wird die Einladung eingelöst.
// Der Link in der E-Mail beweist den Zugriff auf das Postfach; wer sich darüber registriert, nimmt Team-Einladungen damit an.
const crypto = require('crypto');
const db = require('./db');
const settings = require('./settings');
const mail = require('./mail');
const { checkEmail } = require('./email');

const VALID_DAYS = 30;
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

function fail(message, status = 400, code) {
  return Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
}

// Darf an diese Adresse eingeladen werden? Die Regeln der Registrierung gelten auch hier.
async function assertPossible(email) {
  const s = await settings.get();
  if (!(await settings.mailConfigured())) throw fail('Einladungen per E-Mail sind erst möglich, wenn ein Administrator den E-Mail-Versand eingerichtet hat.');
  if (s.general.registration === 'closed') throw fail('Die Registrierung ist geschlossen. Neue Konten kann nur ein Administrator anlegen.', 403);
  checkEmail(email, s.security);
}

// target: { boardId } oder { teamId }; mailText: { subject, title, paragraphs }
async function create({ email, target, role, inviter, baseUrl, mailText }) {
  await assertPossible(email);
  const token = crypto.randomBytes(32).toString('base64url');
  const conflict = target.boardId ? '(board_id, email) WHERE board_id IS NOT NULL' : '(team_id, email) WHERE team_id IS NOT NULL';
  await db.query(
    `INSERT INTO pending_invites (email, board_id, team_id, role, invited_by, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(days => $7))
     ON CONFLICT ${conflict} DO UPDATE SET role = EXCLUDED.role, invited_by = EXCLUDED.invited_by, token_hash = EXCLUDED.token_hash,
       expires_at = EXCLUDED.expires_at, created_at = now()`,
    [email, target.boardId || null, target.teamId || null, role, inviter.id, hash(token), VALID_DAYS]);
  try {
    await mail.send(email, mailText.subject, mailText.title, mailText.paragraphs, { label: 'Jetzt registrieren', url: `${baseUrl}/register?invite=${encodeURIComponent(token)}` });
  } catch (e) {
    log.error('Einladungsmail fehlgeschlagen', { userId: inviter.id, err: e });
    await db.query('DELETE FROM pending_invites WHERE token_hash = $1', [hash(token)]);
    throw fail('Die Einladung konnte nicht verschickt werden. Bitte versuche es später erneut.', 422);
  }
  log.info('Einladung an neue Adresse verschickt', { userId: inviter.id, boardId: target.boardId, teamId: target.teamId });
}

// Angaben für die Registrierungsseite; der Token ist das Geheimnis
async function info(token) {
  const r = await db.one(
    `SELECT p.email, p.board_id, p.team_id, b.name AS board_name, t.name AS team_name, COALESCE(u.display_name, u.username) AS inviter
       FROM pending_invites p
       LEFT JOIN boards b ON b.id = p.board_id
       LEFT JOIN teams t ON t.id = p.team_id
       LEFT JOIN users u ON u.id = p.invited_by
      WHERE p.token_hash = $1 AND p.expires_at > now()`, [hash(token)]);
  return r && { email: r.email, kind: r.board_id ? 'board' : 'team', name: r.board_name || r.team_name || '', inviter: r.inviter || '' };
}

// Registrierung über den Link: Team-Einladung gilt als angenommen; liefert, ob der Link zur Adresse passt
async function accept(token, email) {
  const r = await db.one('UPDATE pending_invites SET accepted = true WHERE token_hash = $1 AND email = $2 AND expires_at > now() RETURNING id', [hash(token), email]);
  return !!r;
}

// Einlösen, sobald die Adresse bestätigt ist (Registrierung, Bestätigung, geänderte Adresse, Anmeldung)
async function claim(user) {
  if (!user || !user.email || !user.email_verified_at || user.role === 'guest') return 0;
  const email = String(user.email).toLowerCase();
  const rows = (await db.query('SELECT * FROM pending_invites WHERE email = $1 AND expires_at > now()', [email])).rows;
  for (const p of rows) {
    if (p.board_id) {
      await db.query(
        `INSERT INTO board_members (board_id, user_id, role)
         SELECT $1, $2, $3 FROM boards WHERE id = $1 AND owner_id IS DISTINCT FROM $2 ON CONFLICT DO NOTHING`, [p.board_id, user.id, p.role]);
    } else if (p.accepted) {
      await db.query('INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [p.team_id, user.id, p.role]);
    } else {
      // Registrierung ohne den Link: wie jede Team-Einladung erst nach Annahme
      const team = await db.one('SELECT * FROM teams WHERE id = $1', [p.team_id]);
      const by = p.invited_by ? await db.one('SELECT * FROM users WHERE id = $1', [p.invited_by]) : null;
      const member = await db.one('SELECT 1 AS x FROM team_members WHERE team_id = $1 AND user_id = $2', [p.team_id, user.id]);
      if (team && by && !member) {
        const row = await db.one(`INSERT INTO team_invitations (team_id, user_id, role, invited_by) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING user_id`, [p.team_id, user.id, p.role, by.id]);
        if (row) await require('./notify').teamInvite({ target: user, actor: by, team, origin: null });
      }
    }
    await db.query('DELETE FROM pending_invites WHERE id = $1', [p.id]);
  }
  if (rows.length) log.info('Einladungen eingelöst', { userId: user.id, count: rows.length });
  return rows.length;
}

const pub = (r) => ({ id: String(r.id), email: r.email, role: r.role, createdAt: new Date(r.created_at).getTime(), expiresAt: new Date(r.expires_at).getTime() });

async function listFor(target) {
  const rows = (await db.query(`SELECT * FROM pending_invites WHERE ${target.boardId ? 'board_id' : 'team_id'} = $1 AND expires_at > now() ORDER BY created_at`, [target.boardId || target.teamId])).rows;
  return rows.map(pub);
}

async function revoke(target, id) {
  if (!/^\d{1,18}$/.test(String(id))) throw fail('Einladung nicht gefunden.', 404);
  const r = await db.one(`DELETE FROM pending_invites WHERE id = $1 AND ${target.boardId ? 'board_id' : 'team_id'} = $2 RETURNING id`, [id, target.boardId || target.teamId]);
  if (!r) throw fail('Einladung nicht gefunden.', 404);
}

const cleanup = () => db.query('DELETE FROM pending_invites WHERE expires_at < now()');

module.exports = { create, info, accept, claim, listFor, revoke, cleanup, fail };
