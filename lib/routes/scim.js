'use strict';
const log = require('../log').child('scim');
// SCIM 2.0: Der Identitätsanbieter legt Konten an, ändert sie und sperrt sie. Gruppen werden nicht übertragen.
const crypto = require('crypto');
const db = require('../db');
const auth = require('../auth');
const boards = require('../boards');
const settings = require('../settings');
const audit = require('../audit');
const invites = require('../invites');
const { readBody, clientIp } = require('../http');
const { looksLikeEmail } = require('../email');

const USER = 'urn:ietf:params:scim:schemas:core:2.0:User';
const LIST = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const ERROR = 'urn:ietf:params:scim:api:messages:2.0:Error';
const PATCH = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
const MAX_PAGE = 200;

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/scim+json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

class ScimError extends Error {
  constructor(status, detail, scimType) {
    super(detail);
    this.status = status;
    this.scimType = scimType;
  }
}

async function authorized(req) {
  const s = (await settings.get()).scim;
  if (!s.enabled || !s.tokenHash) throw new ScimError(404, 'SCIM is not enabled.');
  auth.rateLimit('scim:' + clientIp(req), 600, 60000);
  const m = /^Bearer\s+(\S+)$/i.exec(String(req.headers.authorization || ''));
  const given = Buffer.from(auth.sha256(m ? m[1] : ''));
  if (!crypto.timingSafeEqual(given, Buffer.from(s.tokenHash))) {
    auth.rateLimit('scim-fail:' + clientIp(req), 20, 15 * 60000);
    throw new ScimError(401, 'Invalid token.');
  }
}

const baseOf = (req) => `/scim/v2`;

function toScim(u, req) {
  return {
    schemas: [USER], id: String(u.id), userName: u.email, displayName: u.display_name || u.username, active: u.status === 'active',
    name: { formatted: u.display_name || u.username }, emails: [{ value: u.email, primary: true, type: 'work' }],
    meta: { resourceType: 'User', created: new Date(u.created_at).toISOString(), lastModified: new Date(u.last_login_at || u.created_at).toISOString(), location: `${baseOf(req)}/Users/${u.id}` },
  };
}

const truthy = (v) => v === true || String(v).toLowerCase() === 'true';
const validEmail = looksLikeEmail;

// Angaben aus einem SCIM-Benutzer, unabhängig davon, wie der Anbieter sie schickt
function fieldsOf(body) {
  const primary = Array.isArray(body.emails) ? (body.emails.find((e) => e && e.primary) || body.emails[0]) : null;
  const email = String(body.userName || (primary && primary.value) || '').trim().toLowerCase();
  const name = String(body.displayName || (body.name && (body.name.formatted || [body.name.givenName, body.name.familyName].filter(Boolean).join(' '))) || email.split('@')[0] || '').trim();
  return { email, name, active: body.active === undefined ? undefined : truthy(body.active) };
}

async function byId(id) {
  if (!/^\d{1,18}$/.test(String(id))) throw new ScimError(404, 'User not found.');
  const u = await db.one(`SELECT * FROM users WHERE id = $1 AND role <> 'guest'`, [id]);
  if (!u) throw new ScimError(404, 'User not found.');
  return u;
}

// Das letzte lokale Admin-Konto bleibt, auch wenn der Identitätsanbieter es abschaltet
async function assertMayDisable(u) {
  if (u.role !== 'admin' || u.password_hash === auth.EXTERNAL_HASH) return;
  const r = await db.one(`SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND status = 'active' AND password_hash <> $1 AND id <> $2`, [auth.EXTERNAL_HASH, u.id]);
  if (!r.n) throw new ScimError(409, 'The last local administrator cannot be disabled.', 'mutability');
}

async function update(u, f, req) {
  const name = f.name ? auth.validateName(f.name.slice(0, 60)) : u.display_name;
  if (f.email && !validEmail(f.email)) throw new ScimError(400, 'Invalid e-mail address.', 'invalidValue');
  const email = f.email || u.email;
  // Lokale Administration bleibt in eigener Hand: Über die Adresse ließe sich sonst per „Kennwort vergessen“ ihr Konto übernehmen
  if (u.role === 'admin' && u.password_hash !== auth.EXTERNAL_HASH && email.toLowerCase() !== String(u.email).toLowerCase()) throw new ScimError(403, 'The address of a local administrator cannot be changed through SCIM.', 'mutability');
  if (f.active === false && u.status === 'active') await assertMayDisable(u);
  const status = f.active === undefined ? u.status : f.active ? (u.status === 'disabled' ? 'active' : u.status) : 'disabled';
  let row;
  try {
    row = await db.one(`UPDATE users SET email = $2, display_name = $3, username = $3, status = $4, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1 RETURNING *`, [u.id, email, name, status]);
  } catch (e) {
    if (e.code === '23505') throw new ScimError(409, 'This e-mail address is already in use.', 'uniqueness');
    throw e;
  }
  auth.invalidateUser(u.id);
  if (status === 'disabled' && u.status !== 'disabled') {
    await auth.destroyUserSessions(u.id);
    boards.kickUser(null, u.id, 'disabled');
    audit.log(req, 'scim_user_disabled', { userId: u.id });
  }
  return row;
}

// Nur die einfachen Pfade, die Identitätsanbieter tatsächlich senden
function applyPatch(f, ops) {
  for (const op of ops) {
    if (!op || typeof op !== 'object') throw new ScimError(400, 'Invalid operation.', 'invalidSyntax');
    if (!/^(add|replace)$/i.test(String(op.op))) {
      if (/^remove$/i.test(String(op.op))) continue;
      throw new ScimError(400, 'Unknown operation.', 'invalidSyntax');
    }
    const path = String(op.path || '');
    const values = path ? { [path]: op.value } : (op.value && typeof op.value === 'object' ? op.value : {});
    for (const [k, v] of Object.entries(values)) {
      const key = k.toLowerCase();
      if (key === 'active') f.active = truthy(v);
      else if (key === 'username' || key.startsWith('emails')) f.email = String(Array.isArray(v) ? v[0]?.value : v?.value ?? v).trim().toLowerCase();
      else if (key === 'displayname' || key === 'name.formatted') f.name = String(v).trim();
      else if (key === 'name.givenname') f.given = String(v).trim();
      else if (key === 'name.familyname') f.family = String(v).trim();
    }
  }
  if (!f.name && (f.given || f.family)) f.name = [f.given, f.family].filter(Boolean).join(' ');
  return f;
}

async function listUsers(req, res, url) {
  const start = Math.min(1e9, Math.max(1, Math.floor(Number(url.searchParams.get('startIndex'))) || 1));
  const count = Math.max(0, Math.min(MAX_PAGE, Math.floor(Number(url.searchParams.get('count') ?? 100)) || 0));
  const filter = url.searchParams.get('filter') || '';
  let where = `role <> 'guest' AND email IS NOT NULL`;
  const args = [];
  if (filter) {
    const m = /^(userName|emails\.value|emails)\s+eq\s+"([^"]*)"$/i.exec(filter.trim());
    if (!m) throw new ScimError(400, 'This filter is not supported.', 'invalidFilter');
    args.push(m[2].toLowerCase());
    where += ` AND lower(email) = $${args.length}`;
  }
  const total = (await db.one(`SELECT count(*)::int AS n FROM users WHERE ${where}`, args)).n;
  const rows = (await db.query(`SELECT * FROM users WHERE ${where} ORDER BY id LIMIT ${count} OFFSET ${start - 1}`, args)).rows;
  send(res, 200, { schemas: [LIST], totalResults: total, startIndex: start, itemsPerPage: rows.length, Resources: rows.map((u) => toScim(u, req)) });
}

async function createUser(req, res, body) {
  const f = fieldsOf(body);
  if (!validEmail(f.email)) throw new ScimError(400, 'userName must be an e-mail address.', 'invalidValue');
  const name = auth.validateName((f.name || f.email.split('@')[0]).slice(0, 60));
  const row = await db.tx(async (c) => {
    await c.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    if ((await c.query('SELECT 1 FROM users WHERE lower(email) = $1', [f.email])).rows[0]) throw new ScimError(409, 'This account already exists.', 'uniqueness');
    return (await c.query(
      `INSERT INTO users (username, email, display_name, password_hash, role, status, color, email_verified_at, password_changed_at)
       VALUES ($1, $2, $1, $3, 'user', $4, $5, now(), now()) RETURNING *`,
      [name, f.email, auth.EXTERNAL_HASH, f.active === false ? 'disabled' : 'active', auth.randomColor()])).rows[0];
  });
  audit.log(req, 'scim_user_created', { userId: row.id });
  await invites.claim(row).catch((e) => log.error('Einladungen konnten nicht eingelöst werden', { userId: row.id, err: e }));
  send(res, 201, toScim(row, req));
}

const SERVICE_CONFIG = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
  patch: { supported: true }, bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 }, filter: { supported: true, maxResults: MAX_PAGE },
  changePassword: { supported: false }, sort: { supported: false }, etag: { supported: false },
  authenticationSchemes: [{ type: 'oauthbearertoken', name: 'Bearer', description: 'Token from the administration' }],
};
const RESOURCE_TYPE = { schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'], id: 'User', name: 'User', endpoint: '/Users', schema: USER };

async function route(req, res, url) {
  await authorized(req);
  const path = url.pathname.replace(/^\/scim\/v2\/?/, '').replace(/\/$/, '');
  const [kind, id] = path.split('/');
  const parse = async () => {
    let body;
    try {
      body = JSON.parse(await readBody(req, 256 * 1024));
    } catch {
      throw new ScimError(400, 'Invalid JSON.', 'invalidSyntax');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ScimError(400, 'Invalid JSON.', 'invalidSyntax');
    return body;
  };
  if (kind === 'ServiceProviderConfig' && req.method === 'GET') return send(res, 200, SERVICE_CONFIG);
  if (kind === 'ResourceTypes' && req.method === 'GET') return send(res, 200, { schemas: [LIST], totalResults: 1, Resources: [RESOURCE_TYPE] });
  if (kind === 'Schemas' && req.method === 'GET') return send(res, 200, { schemas: [LIST], totalResults: 1, Resources: [{ id: USER, name: 'User', attributes: [] }] });
  if (kind !== 'Users') throw new ScimError(404, 'Not found.');
  if (!id) {
    if (req.method === 'GET') return listUsers(req, res, url);
    if (req.method === 'POST') return createUser(req, res, await parse());
    throw new ScimError(405, 'Method not allowed.');
  }
  const u = await byId(id);
  if (req.method === 'GET') return send(res, 200, toScim(u, req));
  if (req.method === 'PUT') return send(res, 200, toScim(await update(u, fieldsOf(await parse()), req), req));
  if (req.method === 'PATCH') {
    const body = await parse();
    if (!Array.isArray(body.Operations)) throw new ScimError(400, 'Operations are missing.', 'invalidSyntax');
    return send(res, 200, toScim(await update(u, applyPatch({}, body.Operations), req), req));
  }
  // Gelöscht wird nicht: Boards und Verlauf bleiben, die Person kommt nur nicht mehr hinein
  if (req.method === 'DELETE') {
    await update(u, { active: false }, req);
    return send(res, 204);
  }
  throw new ScimError(405, 'Method not allowed.');
}

async function handle(req, res, url) {
  try {
    await route(req, res, url);
  } catch (e) {
    if (e instanceof ScimError || (e.status && e.status < 500)) return send(res, e.status, { schemas: [ERROR], status: String(e.status), detail: e.message, ...(e.scimType ? { scimType: e.scimType } : {}) });
    log.error('SCIM-Anfrage fehlgeschlagen', { err: e });
    send(res, 500, { schemas: [ERROR], status: '500', detail: 'Internal error' });
  }
}

module.exports = { handle, PATCH };
