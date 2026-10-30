'use strict';
// Retro-Werkzeuge im Board: geführter Ablauf, Besprechungsmodus (mit Daumen-Abstimmung), Schnellumfragen,
// Zufallsauswahl und Reaktionen auf Elemente. Der Zustand liegt in der Sitzung des Boards (b.session);
// Rechte und Werte prüft ausschließlich der Server.
const crypto = require('crypto');
const db = require('./db');
const log = require('./log').child('retro');
const { validId } = require('./sanitize');

const STEPS = ['checkin', 'review', 'collect', 'reveal', 'group', 'vote', 'discuss', 'actions', 'close'];
const REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🤔', '🔥', '😮', '➕', '✅'];
const REACT_TYPES = new Set(['sticky', 'card', 'shape', 'text', 'image', 'file', 'code', 'table']);
const POLL_KINDS = {
  mood: { values: ['1', '2', '3', '4', '5'] },
  fist: { values: ['0', '1', '2', '3', '4', '5'] },
  roti: { values: ['1', '2', '3', '4', '5'] },
  custom: {},
  health: {},
};
const HEALTH_VALUES = ['1', '2', '3']; // rot, gelb, grün
const ROMAN = ['up', 'side', 'down'];

const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const randInt = (n) => crypto.randomInt(0, n);

/* ---------------- Umfragen: Stimmen bleiben anonym ---------------- */

// Ergebnis ohne Personenbezug: Anzahl je Wert (bei Health-Check je Thema)
function pollResults(p) {
  const votes = Object.values(p.votes || {});
  if (p.kind === 'health') {
    const out = {};
    for (const it of p.items || []) {
      out[it.id] = Object.fromEntries(HEALTH_VALUES.map((v) => [v, 0]));
      for (const v of votes) if (v && HEALTH_VALUES.includes(v[it.id])) out[it.id][v[it.id]]++;
    }
    return { items: out };
  }
  const counts = {};
  for (const v of votes) counts[v] = (counts[v] || 0) + 1;
  return { counts };
}

// Ansicht für eine Person: vor dem Schließen nur die Zahl der Teilnehmenden und die eigene Stimme
function redactPoll(p, uid) {
  if (!p) return p;
  const { votes, ...rest } = p;
  const n = Object.keys(votes || {}).length;
  const mine = votes && Object.hasOwn(votes, String(uid)) ? votes[String(uid)] : null;
  return { ...rest, participants: p.closed ? p.participants : n, mine, ...(p.closed ? {} : { results: null }) };
}

function redactSession(session, uid) {
  if (!session || !session.poll) return session;
  return { ...session, poll: redactPoll(session.poll, uid) };
}

/* ---------------- Operationen ---------------- */

// ctx: { sender, uid, fac, canSteer, reserved, all, revertSession, blocked, schedule }
// Liefert true, wenn die Operation hierher gehört
function apply(b, op, ctx) {
  const s = b.session;
  const steerOnly = (key, valueFn) => {
    if (!ctx.canSteer) {
      ctx.revertSession({ op: key, [key]: valueFn() });
      ctx.blocked('reserved');
      return false;
    }
    return true;
  };
  switch (op.op) {
    case 'retro': {
      if (!steerOnly('retro', () => s.retro || null)) return true;
      if (op.action === 'start') {
        const steps = (Array.isArray(op.steps) ? op.steps : STEPS).filter((x) => STEPS.includes(x));
        const o = op.opts && typeof op.opts === 'object' ? op.opts : {};
        const minutes = (v, d) => Math.max(0, Math.min(60, Math.round(Number(v ?? d)) || 0));
        const opts = {
          anonymous: o.anonymous !== false, collectMin: minutes(o.collectMin, 7), groupMin: minutes(o.groupMin, 5),
          votes: Math.max(1, Math.min(20, Math.round(Number(o.votes) || 3))), discussMin: minutes(o.discussMin, 5),
        };
        s.retro = { active: true, steps: steps.length ? [...new Set(steps)] : STEPS, step: 0, opts, by: ctx.sender.user.name, byId: ctx.uid, startedAt: Date.now() };
      } else if (op.action === 'step' && s.retro && s.retro.active) {
        const i = Math.round(Number(op.step));
        if (!(i >= 0 && i < s.retro.steps.length)) return true;
        s.retro = { ...s.retro, step: i, stepAt: Date.now() };
      } else if (op.action === 'stop') s.retro = null;
      else return true;
      ctx.all.push({ op: 'retro', retro: s.retro || null });
      b.metaDirty = true;
      return true;
    }
    case 'discussion': {
      if (!steerOnly('discussion', () => s.discussion || null)) return true;
      const d = s.discussion;
      if (op.action === 'start') {
        const topics = (Array.isArray(op.topics) ? op.topics : []).slice(0, 100)
          .filter((t) => t && validId(t.id) && b.elements.has(t.id) && !ctx.hidden.has(t.id))
          .map((t) => ({ id: t.id, title: str(t.title, 120), votes: Math.max(0, Math.round(Number(t.votes) || 0)) }));
        if (!topics.length) return true;
        const perTopicMs = Math.max(0, Math.min(60, Math.round(Number(op.minutes) || 0))) * 60000;
        s.discussion = { active: true, topics, index: 0, perTopicMs, done: [], by: ctx.sender.user.name, startedAt: Date.now(), roman: null };
      } else if (d && op.action === 'goto') {
        const i = Math.round(Number(op.index));
        if (!(i >= 0 && i < d.topics.length)) return true;
        const done = op.markDone && !d.done.includes(d.topics[d.index].id) ? [...d.done, d.topics[d.index].id] : d.done;
        s.discussion = { ...d, index: i, done, roman: null, topicAt: Date.now() };
      } else if (d && op.action === 'roman') {
        // Lean Coffee: „Weiter diskutieren?“ – Daumen hoch / seitlich / runter
        s.discussion = { ...d, roman: op.open ? { open: true, votes: {}, at: Date.now() } : d.roman ? { ...d.roman, open: false } : null };
      } else if (op.action === 'stop') s.discussion = null;
      else return true;
      ctx.all.push({ op: 'discussion', discussion: s.discussion || null });
      b.metaDirty = true;
      return true;
    }
    case 'poll': {
      if (!steerOnly('poll', () => redactPoll(s.poll || null, ctx.uid))) return true;
      if (op.action === 'start') {
        const kind = Object.hasOwn(POLL_KINDS, op.kind) ? op.kind : 'mood';
        const p = { id: Date.now(), kind, question: str(op.question, 200), by: ctx.sender.user.name, startedAt: Date.now(), closed: false, votes: {} };
        if (kind === 'custom') {
          p.options = (Array.isArray(op.options) ? op.options : []).map((o) => str(o, 80)).filter(Boolean).slice(0, 8);
          if (p.options.length < 2) return true;
        }
        if (kind === 'health') {
          p.items = (Array.isArray(op.items) ? op.items : []).map((o, i) => ({ id: 'i' + i, label: str(o, 80) })).filter((o) => o.label).slice(0, 12);
          if (!p.items.length) return true;
        }
        s.poll = p;
      } else if (s.poll && op.action === 'close' && !s.poll.closed) {
        const p = s.poll;
        p.results = pollResults(p);
        p.participants = Object.keys(p.votes || {}).length;
        p.closed = true;
        p.closedAt = Date.now();
        // Einzelstimmen werden nach dem Schließen verworfen – übrig bleibt nur das Ergebnis
        p.votes = {};
        if (p.participants) {
          db.query('INSERT INTO board_polls (board_id, kind, question, results, participants) VALUES ($1, $2, $3, $4, $5)',
            [b.id, p.kind, p.question, JSON.stringify({ ...p.results, options: p.options, labels: p.items }), p.participants])
            .catch((e) => log.error('Umfrage-Ergebnis konnte nicht gespeichert werden', { boardId: b.id, err: e }));
        }
      } else if (op.action === 'clear') s.poll = null;
      else return true;
      b.metaDirty = true;
      ctx.personal.push({ op: 'poll', poll: s.poll || null });
      return true;
    }
    case 'picker': {
      if (!steerOnly('picker', () => s.picker || null)) return true;
      if (op.action === 'clear') s.picker = null;
      else {
        const names = [...new Set((Array.isArray(op.names) ? op.names : []).map((n) => str(n, 60)).filter(Boolean))].slice(0, 50);
        if (!names.length) return true;
        if (op.action === 'spin') s.picker = { kind: 'wheel', names, result: randInt(names.length), at: Date.now(), by: ctx.sender.user.name };
        else if (op.action === 'order') {
          const order = names.map((_, i) => i);
          for (let i = order.length - 1; i > 0; i--) {
            const j = randInt(i + 1);
            [order[i], order[j]] = [order[j], order[i]];
          }
          s.picker = { kind: 'order', names, order, at: Date.now(), by: ctx.sender.user.name };
        } else return true;
      }
      ctx.all.push({ op: 'picker', picker: s.picker || null });
      b.metaDirty = true;
      return true;
    }
    default:
      return false;
  }
}

// Stimme in einer Umfrage – auch Betrachter; die Person kommt aus der Sitzung, die Stimme bleibt anonym
function vote(b, op, user, send) {
  const p = b.session.poll;
  if (!p || p.closed || b.removed) return;
  const uid = String(user.id);
  if (op.value === null) delete p.votes[uid];
  else if (p.kind === 'health') {
    const v = op.value && typeof op.value === 'object' ? op.value : {};
    const clean = {};
    for (const it of p.items || []) if (HEALTH_VALUES.includes(String(v[it.id]))) clean[it.id] = String(v[it.id]);
    if (!Object.keys(clean).length) return;
    p.votes[uid] = clean;
  } else {
    const allowed = p.kind === 'custom' ? (p.options || []).map((_, i) => String(i)) : POLL_KINDS[p.kind].values;
    if (!allowed.includes(String(op.value))) return;
    p.votes[uid] = String(op.value);
  }
  b.metaDirty = true;
  send();
}

// Lean-Coffee-Daumen: öffentlich (wie Handzeichen), auch für Betrachter
function romanVote(b, op, user) {
  const d = b.session.discussion;
  if (!d || !d.roman || !d.roman.open || b.removed) return false;
  const uid = String(user.id);
  if (op.value === null) delete d.roman.votes[uid];
  else if (ROMAN.includes(op.value)) d.roman.votes[uid] = op.value;
  else return false;
  b.metaDirty = true;
  return true;
}

// Reaktion (Emoji) auf ein Element an- oder abschalten
function react(b, op, user) {
  if (!validId(op.id) || !REACTIONS.includes(op.emoji) || b.removed) return null;
  const el = b.elements.get(op.id);
  if (!el || !REACT_TYPES.has(el.type) || (el.priv && String(el.priv) !== String(user.id))) return null;
  const uid = String(user.id);
  const r = { ...(el.reactions || {}) };
  const set = { ...(r[op.emoji] || {}) };
  if (set[uid]) delete set[uid];
  else {
    if (Object.keys(set).length >= 200) return null;
    set[uid] = str(user.display_name || user.username, 60);
  }
  if (Object.keys(set).length) r[op.emoji] = set;
  else delete r[op.emoji];
  const next = { ...el, reactions: r };
  if (!Object.keys(r).length) delete next.reactions;
  b.elements.set(el.id, next);
  b.dirty.add(el.id);
  return next;
}

module.exports = { apply, vote, romanVote, react, redactPoll, redactSession, pollResults, STEPS, REACTIONS, REACT_TYPES, POLL_KINDS };
