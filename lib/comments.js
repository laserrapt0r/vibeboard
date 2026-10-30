'use strict';
// Kommentare: Schreiben, Antworten, Erledigen, Zuweisen und Löschen laufen über eigene Operationen.
// So legt der Server Autorschaft und Zeitpunkt fest, erkennt @Erwähnungen und benachrichtigt Beteiligte.
// Erlaubt ab der Rolle „Kommentieren“ (auch für Gäste mit dieser Rolle).
const boards = require('./boards');
const activity = require('./activity');
const notify = require('./notify');
const { validId } = require('./sanitize');
const ConcealOps = require('../public/js/conceal-ops.js');
const log = require('./log').child('comments');

const MAX_TEXT = 5000;
const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// user: Benutzerzeile, client: Verbindung (Rolle), origin: Basisadresse für E-Mail-Links (oder null)
async function apply(b, op, { user, client, origin }) {
  if (!boards.canComment(client.role)) throw fail('Du darfst auf diesem Board nicht kommentieren.', 403);
  if (b.removed) return null;
  const uid = String(user.id);
  const name = client.user.name;
  const actor = { userId: uid, name, color: user.color };
  const id = op.id;
  if (!validId(id)) throw fail('Ungültiger Kommentar.');
  const prev = b.elements.get(id);
  if (prev && prev.type !== 'comment') throw fail('Ungültiger Kommentar.');
  // Von der Moderation gesperrte Kommentare ändern nur Moderierende
  const fac = boards.isFacilitator(b, uid, client.role);
  if (prev && prev.modLock && !fac) throw fail('Dieser Kommentar ist von der Moderation gesperrt.', 403);
  // Verborgene Bereiche: Teilnehmende kennen diese Kommentare nicht und können dort keine anlegen
  if (!fac && prev && boards.concealedOf(b).has(id)) throw fail('Kommentar nicht gefunden.', 404);
  if (!fac && !prev && ConcealOps.inConcealedArea({ type: 'comment', x: num(op.x), y: num(op.y) }, b.elements)) throw fail('Dieser Bereich ist verborgen.', 403);
  const concealed = () => boards.concealedOf(b).has(id);
  const MAX_THREAD = 500;
  const publish = (el) => {
    b.elements.set(el.id, el);
    b.dirty.add(el.id);
    b.deleted.delete(el.id);
    boards.schedule(b);
    // an alle, auch an den Absender: der Server hat Autor, Zeitpunkt und Nachrichten-ID ergänzt
    // (je Person geprüft, damit Kommentare in verborgenen Bereichen nur Moderierende erreichen)
    boards.broadcastOps(b, [{ op: 'upsert', el }], null);
  };

  switch (op.action) {
    case 'add': {
      const text = String(op.text || '').trim().slice(0, MAX_TEXT);
      if (!text) throw fail('Der Kommentar ist leer.');
      const people = await notify.boardPeople(b.id);
      const mentioned = notify.mentionedIds(text, people, Array.isArray(op.mentions) ? op.mentions.slice(0, 50) : []);
      // Erwähnte Personen am Beitrag merken (für die Hervorhebung, auch bei gleichen Namen)
      const mentions = [...mentioned].map((id) => ({ id, name: people.find((p) => p.id === id).displayName }));
      const msg = { id: boards.newId(), uid, author: name, color: user.color, text, ts: Date.now(), ...(mentions.length ? { mentions } : {}) };
      let el;
      // Nach dem Warten auf die Personenliste den aktuellen Stand nehmen (gleichzeitige Antworten anderer)
      const cur = b.elements.get(id);
      if (cur && cur.type !== 'comment') throw fail('Ungültiger Kommentar.');
      if (cur && (cur.thread || []).length >= MAX_THREAD) throw fail('Dieser Kommentar-Thread ist voll. Bitte beginne einen neuen Kommentar.');
      if (cur) {
        el = { ...cur, thread: [...(cur.thread || []), msg] };
      } else {
        let z = 0;
        for (const e of b.elements.values()) z = Math.max(z, num(e.z));
        el = { id, type: 'comment', x: num(op.x), y: num(op.y), z: z + 1, thread: [msg], resolved: false, color: user.color, author: name };
      }
      publish(el);
      activity.record(b.id, actor, 'commented', el, { label: concealed() ? '' : text.replace(/\s+/g, ' ').slice(0, 80) });
      // Kommentare in verborgenen Bereichen lösen keine Benachrichtigungen aus (sie enthalten den Text)
      if (concealed()) return el;
      // Benachrichtigen: Erwähnte und alle, die vorher in diesem Thread geschrieben haben
      const earlier = new Set((cur ? cur.thread || [] : []).map((m) => m.uid).filter(Boolean));
      if (cur && cur.task) earlier.add(cur.task.assigneeId);
      for (const x of mentioned) earlier.delete(x);
      const base = { boardId: b.id, boardName: b.name, actor: user, elementId: id, excerpt: text, origin };
      // Der Beitrag ist schon veröffentlicht – ein Fehler beim Benachrichtigen darf ihn nicht als gescheitert melden
      // (der Client würde sonst erneut senden und einen doppelten Beitrag erzeugen)
      await notifySafely({ ...base, kind: 'mention', userIds: mentioned });
      await notifySafely({ ...base, kind: 'reply', userIds: earlier });
      return el;
    }
    case 'resolve': {
      if (!prev) throw fail('Kommentar nicht gefunden.', 404);
      const el = { ...prev, resolved: !!op.resolved };
      publish(el);
      activity.record(b.id, actor, el.resolved ? 'resolved' : 'reopened', el, concealed() ? { label: '' } : {});
      return el;
    }
    case 'task': {
      if (!prev) throw fail('Kommentar nicht gefunden.', 404);
      let task;
      if (op.assigneeId) {
        const people = await notify.boardPeople(b.id);
        const p = people.find((x) => x.id === String(op.assigneeId));
        if (!p) throw fail('Diese Person hat keinen Zugriff auf das Board.');
        // Zuständig sein kann nur, wer den Kommentar auch erledigen darf
        const target = await require('./db').one('SELECT * FROM users WHERE id = $1', [p.id]);
        const { role } = await boards.access(b.id, target);
        if (!boards.canComment(role)) throw fail(`${p.displayName} darf auf diesem Board nur ansehen und kann daher nicht zuständig sein.`);
        task = { assigneeId: p.id, assignee: p.displayName, due: isDate(op.due) ? op.due : '', by: name };
      }
      // Während der Prüfungen oben kann sich der Kommentar geändert haben (Antwort, Erledigt, Löschen) – aktuellen Stand nehmen
      const cur = b.elements.get(id);
      if (!cur || cur.type !== 'comment') throw fail('Kommentar nicht gefunden.', 404);
      const el = { ...cur };
      if (task) el.task = task;
      else delete el.task;
      publish(el);
      activity.record(b.id, actor, 'assigned', el, { label: concealed() ? '' : task ? `${task.assignee}: ${activity.labelOf(el)}` : activity.labelOf(el) });
      if (concealed()) return el;
      const changedPerson = task && (!cur.task || cur.task.assigneeId !== task.assigneeId);
      if (changedPerson) {
        const first = (el.thread || [])[0];
        await notifySafely({ boardId: b.id, boardName: b.name, kind: 'task', actor: user, elementId: id, excerpt: first ? first.text : '', userIds: [task.assigneeId], origin });
      }
      return el;
    }
    case 'delete': {
      if (!prev) return null;
      // Bearbeitende dürfen jeden Kommentar löschen, sonst nur eigene Threads ohne Antworten anderer
      const own = (prev.thread || []).every((m) => m.uid === uid);
      const m = b.session.moderation;
      const editLocked = !!(m && m.active && m.editLock) && !boards.isFacilitator(b, uid, client.role);
      if (!own && (!boards.canEdit(client.role) || editLocked)) throw fail('Du kannst nur eigene Kommentare löschen.', 403);
      // Gleiches Löschen wie über die Leinwand (Rückgängig möglich, Stimmen werden entfernt)
      boards.applyOps(b, [{ op: 'delete', id }], { ...client, role: 'owner' });
      return null;
    }
    default:
      throw fail('Unbekannte Kommentar-Aktion.');
  }
}

async function notifySafely(args) {
  try {
    await notify.create(args);
  } catch (err) {
    log.error('Benachrichtigung konnte nicht angelegt werden', { boardId: args.boardId, kind: args.kind, err });
  }
}

module.exports = { apply };
