// Retrospektiven: geführter Ablauf, Themengruppen, Besprechungsmodus, Maßnahmen mit Nachverfolgung,
// Zusammenfassung und Zufallsauswahl. Den Zustand verwaltet der Server (Sitzung des Boards).
import { T, LOCALE, DEC } from './i18n.js';
import { h, append, api, ICONS, toast, modal, promptDialog, esc, throttle } from './util.js';
import { app, getEl, bounds, fitTo, act, updateEl, addElements, makeElement, frameChildren, now, markDirty, viewCenter } from './core.js';
import { menu, showSidePanel, currentSidePanel, renderSidePanel, boardPeople } from './ui.js';
import { isFacilitator } from './moderation.js';
import { setTimer, setVoting } from './collab.js';
import { download, safeName } from './exporter.js';

const myId = () => String(app.user.id);
const op = (o) => app.sync.op(o);

// Steuern darf, wer moderiert – ohne Moderation, wer bearbeiten darf (prüft auch der Server)
export function canSteer() {
  const m = app.session.moderation;
  return app.role === 'owner' || (m && m.active ? isFacilitator() : !app.viewOnly);
}

export const STEPS = {
  checkin: { label: T('Check-in'), icon: '👋', hint: T('Wie geht es allen? Beantwortet die Stimmungsabfrage.') },
  review: { label: T('Rückblick'), icon: '🔁', hint: T('Was ist aus den Maßnahmen der letzten Retro geworden? Hakt Erledigtes ab.') },
  collect: { label: T('Sammeln'), icon: '✍️', hint: T('Schreibt eure Beiträge auf Sticky Notes – sie bleiben verdeckt, bis aufgedeckt wird.') },
  reveal: { label: T('Aufdecken'), icon: '👀', hint: T('Alle Beiträge sind sichtbar. Stellt sie reihum kurz vor.') },
  group: { label: T('Gruppieren'), icon: '🗂', hint: T('Schiebt Ähnliches zusammen: Beiträge auswählen und „Themengruppe bilden“.') },
  vote: { label: T('Abstimmen'), icon: '🗳', hint: T('Vergebt eure Stimmen auf die Themen, die ihr besprechen wollt.') },
  discuss: { label: T('Besprechen'), icon: '💬', hint: T('Die Themen werden in der Reihenfolge der Stimmen besprochen.') },
  actions: { label: T('Maßnahmen'), icon: '✅', hint: T('Haltet fest, wer was bis wann tut: Beitrag auswählen → „Als Maßnahme“.') },
  close: { label: T('Abschluss'), icon: '🏁', hint: T('Wie wertvoll war die Retro? Bewertet sie – danach gibt es die Zusammenfassung.') },
};

const topics = () => [...app.els.values()].filter((e) => e.type === 'frame' && e.kind === 'topic' && !e.hidden);
const textOf = (el) => String(el.title || el.text || el.label || '').replace(/\s+/g, ' ').trim();

/* ================================================================== */
/* Sitzungs-Hilfen (Timer, Abstimmung, privater Modus)                 */
/* ================================================================== */

function startTimer(minutes) {
  if (!minutes) return;
  const ms = minutes * 60000;
  setTimer({ duration: ms, running: true, endsAt: now() + ms, remaining: ms, by: app.user.name });
}

function voteTotals() {
  const v = app.session.voting;
  const out = new Map();
  for (const [id, m] of Object.entries((v && v.votes) || {})) out.set(id, Object.values(m).reduce((a, b) => a + b, 0));
  return out;
}

// Themen für die Besprechung: Themengruppen (sonst bewertete Elemente) nach Stimmen
function rankedTopics() {
  const totals = voteTotals();
  const list = topics().length ? topics() : [...totals.keys()].map(getEl).filter(Boolean);
  return list.map((t) => ({ id: t.id, title: textOf(t) || T('Thema'), votes: totals.get(t.id) || 0 }))
    .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title));
}

/* ================================================================== */
/* Ablauf                                                              */
/* ================================================================== */

const bar = h('div', { id: 'retro-bar', class: 'panel chrome hidden', role: 'region', 'aria-label': T('Retro-Ablauf') });
document.body.append(bar);
let lastStep = null;

function enterStep(id) {
  const o = (app.session.retro && app.session.retro.opts) || {};
  const pm = app.session.privateMode;
  const v = app.session.voting;
  // Umfrage des vorigen Schritts auflösen; bereits angezeigte Ergebnisse räumen den Bildschirm wieder frei
  const poll = app.session.poll;
  if (poll && id !== 'checkin' && id !== 'close') op(poll.closed || !poll.participants ? { op: 'poll', action: 'clear' } : { op: 'poll', action: 'close' });
  // Auch beim Überspringen oder Zurückspringen passt der Zustand zum Schritt
  if (pm && pm.active && ['reveal', 'group', 'vote', 'discuss', 'actions', 'close'].includes(id)) op({ op: 'privateMode', active: false });
  if (app.session.discussion && id !== 'discuss') op({ op: 'discussion', action: 'stop' });
  if (v && v.active && id !== 'vote' && id !== 'discuss') setVoting({ ...v, active: false, endedAt: Date.now() });
  switch (id) {
    case 'checkin':
      op({ op: 'poll', action: 'start', kind: 'mood', question: T('Wie geht es dir heute?') });
      break;
    case 'collect':
      // Läuft der private Modus schon ohne Anonymität, wird er umgestellt
      if (!(pm && pm.active) || (o.anonymous !== false && !pm.anonymous)) op({ op: 'privateMode', active: true, anonymous: o.anonymous !== false });
      startTimer(o.collectMin ?? 7);
      break;
    case 'reveal':
      setTimer(null);
      break;
    case 'group':
      startTimer(o.groupMin ?? 5);
      break;
    case 'vote': {
      const t = topics().length ? 'topics' : undefined;
      setVoting({ active: true, votesPerUser: o.votes || 3, votes: {}, title: t ? T('Welche Themen wollen wir besprechen?') : T('Was wollen wir besprechen?'), target: t, by: app.user.name, startedAt: Date.now() });
      setTimer(null);
      if (!t) toast(T('Tipp: Ohne Themengruppen wird über einzelne Beiträge abgestimmt.'), 4000);
      break;
    }
    case 'discuss': {
      if (v && v.active) setVoting({ ...v, active: false, endedAt: Date.now() });
      // Kurz warten, damit letzte Stimmen noch ankommen
      setTimeout(() => {
        const list = rankedTopics();
        if (!list.length) return toast(T('Keine Themen zum Besprechen – bildet Themengruppen oder stimmt ab.'), 4000);
        op({ op: 'discussion', action: 'start', topics: list, minutes: o.discussMin ?? 5 });
        startTimer(o.discussMin ?? 5);
      }, 300);
      break;
    }
    case 'actions':
      setTimer(null);
      break;
    case 'close':
      op({ op: 'poll', action: 'start', kind: 'roti', question: T('Wie wertvoll war diese Retro für dich? (Return on Time Invested)') });
      break;
  }
}

function goStep(i) {
  const r = app.session.retro;
  if (!r || i < 0 || i >= r.steps.length) return;
  op({ op: 'retro', action: 'step', step: i });
  enterStep(r.steps[i]);
}

function renderBar() {
  const r = app.session.retro;
  bar.classList.toggle('hidden', !(r && r.active));
  document.body.classList.toggle('retro-active', !!(r && r.active));
  if (!r || !r.active) {
    lastStep = null;
    return;
  }
  const cur = r.steps[r.step];
  const steer = canSteer();
  bar.innerHTML = '';
  const chips = h('ol', { class: 'retro-steps' }, r.steps.map((s, i) => h('li', { class: 'retro-step' + (i === r.step ? ' current' : i < r.step ? ' done' : '') },
    steer ? h('button', { type: 'button', title: T`Zu „${STEPS[s].label}“ springen`, onclick: () => goStep(i) }, `${STEPS[s].icon} ${STEPS[s].label}`) : h('span', {}, `${STEPS[s].icon} ${STEPS[s].label}`))));
  append(bar,
    h('div', { class: 'retro-head' }, h('b', {}, T('Retro')), h('span', { class: 'muted small' }, T` · Schritt ${r.step + 1} von ${r.steps.length}`), chips),
    h('div', { class: 'retro-hint' }, h('span', {}, STEPS[cur].hint),
      cur === 'review' || cur === 'actions' ? h('button', { class: 'btn small', onclick: () => showSidePanel('actions') }, T('Maßnahmen anzeigen')) : null,
      cur === 'close' ? h('button', { class: 'btn small', onclick: openSummary }, T('Zusammenfassung')) : null,
      h('span', { class: 'spacer' }),
      steer ? h('button', { class: 'btn small', disabled: r.step === 0, onclick: () => goStep(r.step - 1) }, T('◀ Zurück')) : null,
      steer && r.step < r.steps.length - 1 ? h('button', { class: 'btn small primary', onclick: () => goStep(r.step + 1) }, T`Weiter: ${STEPS[r.steps[r.step + 1]].label} ▶`) : null,
      steer && r.step === r.steps.length - 1 ? h('button', { class: 'btn small primary', onclick: () => op({ op: 'retro', action: 'stop' }) }, T('Retro beenden')) : null));
  if (lastStep !== null && lastStep !== cur) {
    toast(T`Retro: ${STEPS[cur].icon} ${STEPS[cur].label}`, 3000);
    if ((cur === 'review' || cur === 'actions') && currentSidePanel() !== 'actions') showSidePanel('actions');
  }
  lastStep = cur;
}

function openStart() {
  const hasPrev = !!app.prevRetroId;
  const checks = Object.entries(STEPS).map(([id, s]) => {
    const cb = h('input', { type: 'checkbox', value: id, checked: id !== 'review' || hasPrev });
    return { id, cb, el: h('label', { class: 'check' }, cb, `${s.icon} ${s.label}`, id === 'review' && !hasPrev ? h('span', { class: 'muted small' }, T(' (keine frühere Retro verknüpft)')) : null) };
  });
  const anon = h('input', { type: 'checkbox', checked: true });
  const num = (v, max = 60) => h('input', { type: 'number', min: 0, max, value: v, style: { width: '70px' } });
  const collect = num(7), group = num(5), votes = num(3, 20), discuss = num(5);
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    const steps = checks.filter((c) => c.cb.checked).map((c) => c.id);
    if (!steps.length) return toast(T('Bitte mindestens einen Schritt wählen'));
    op({ op: 'retro', action: 'start', steps, opts: { anonymous: anon.checked, collectMin: +collect.value, groupMin: +group.value, votes: +votes.value, discussMin: +discuss.value } });
    m.close();
    // Den ersten Schritt gleich vorbereiten
    setTimeout(() => {
      const r = app.session.retro;
      if (r && r.active) enterStep(r.steps[0]);
    }, 300);
  } },
  h('p', { class: 'muted' }, T('Die Leiste führt alle durch die Retro. Beim Wechsel stellt vibeboard die passenden Werkzeuge ein: verdecktes Sammeln, Timer, Abstimmung über Themen, Besprechung und Umfragen.')),
  h('div', { class: 'label' }, T('Schritte')),
  h('div', { class: 'check-grid' }, checks.map((c) => c.el)),
  h('label', { class: 'check' }, anon, T('Beiträge anonym sammeln (auch nach dem Aufdecken ohne Namen)')),
  h('div', { class: 'form-row' }, h('label', {}, T('Sammeln (Min.)'), collect), h('label', {}, T('Gruppieren (Min.)'), group)),
  h('div', { class: 'form-row' }, h('label', {}, T('Stimmen pro Person'), votes), h('label', {}, T('Minuten je Thema'), discuss)),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Retro starten'))));
  const m = modal(T('Retro-Ablauf starten'), form);
}

/* ================================================================== */
/* Besprechungsmodus                                                   */
/* ================================================================== */

const dpanel = h('div', { id: 'discussion-panel', class: 'panel hidden', role: 'region', 'aria-label': T('Besprechung') });
document.body.append(dpanel);
let lastTopic = null;

function gotoTopic(i, markDone) {
  const d = app.session.discussion;
  if (!d) return;
  op({ op: 'discussion', action: 'goto', index: i, markDone });
  if (d.perTopicMs) startTimer(d.perTopicMs / 60000);
}

function renderDiscussion() {
  const d = app.session.discussion;
  dpanel.classList.toggle('hidden', !(d && d.active));
  const prevFocus = app.discussFocus;
  app.discussFocus = d && d.active ? d.topics[d.index]?.id : null;
  if (prevFocus !== app.discussFocus) {
    if (prevFocus) markDirty(prevFocus);
    if (app.discussFocus) markDirty(app.discussFocus);
  }
  if (!d || !d.active) {
    lastTopic = null;
    return;
  }
  const t = d.topics[d.index];
  const steer = canSteer();
  // Neues Thema: alle schauen hin (außer wer gerade einer Person folgt)
  if (t && t.id !== lastTopic) {
    lastTopic = t.id;
    const el = getEl(t.id);
    if (el && !app.following) fitTo(bounds(el), { pad: 80, maxZ: 1.4 });
  }
  dpanel.innerHTML = '';
  const roman = d.roman;
  const counts = { up: 0, side: 0, down: 0 };
  for (const v of Object.values((roman && roman.votes) || {})) counts[v] = (counts[v] || 0) + 1;
  const mine = roman && roman.votes ? roman.votes[myId()] : null;
  append(dpanel,
    h('div', { class: 'disc-head' }, h('span', { class: 'muted small' }, T`Besprechung · Thema ${d.index + 1} von ${d.topics.length}`),
      h('span', { class: 'spacer' }), steer ? h('button', { class: 'icon-btn small', title: T('Besprechung beenden'), html: ICONS.close, onclick: () => op({ op: 'discussion', action: 'stop' }) }) : null),
    h('div', { class: 'disc-title' }, h('b', {}, t ? t.title : ''), t && t.votes ? h('span', { class: 'disc-votes' }, T`Stimmen: ${t.votes}`) : null),
    h('ol', { class: 'disc-list' }, d.topics.map((x, i) => h('li', { class: (i === d.index ? 'current ' : '') + (d.done.includes(x.id) ? 'done' : '') },
      steer ? h('button', { type: 'button', onclick: () => gotoTopic(i, false) }, x.title) : x.title))),
    roman && (roman.open || Object.keys(roman.votes || {}).length) ? h('div', { class: 'disc-roman' },
      h('span', {}, roman.open ? T('Weiter über dieses Thema sprechen?') : T('Ergebnis:')),
      [['up', '👍', T('Weiter')], ['side', '✋', T('Egal')], ['down', '👎', T('Nächstes Thema')]].map(([k, e, l]) => h('button', {
        class: 'btn small' + (mine === k ? ' active' : ''), disabled: !roman.open, title: l,
        onclick: () => op({ op: 'romanVote', value: mine === k ? null : k }),
      }, `${e} ${counts[k] || 0}`))) : null,
    steer ? h('div', { class: 'disc-actions' },
      h('button', { class: 'btn small', disabled: d.index === 0, onclick: () => gotoTopic(d.index - 1, false) }, '◀'),
      h('button', { class: 'btn small', onclick: () => op({ op: 'discussion', action: 'roman', open: !(roman && roman.open) }) }, roman && roman.open ? T('Daumen-Abfrage beenden') : T('Weiter diskutieren? 👍👎')),
      h('span', { class: 'spacer' }),
      d.index < d.topics.length - 1 ? h('button', { class: 'btn small primary', onclick: () => gotoTopic(d.index + 1, true) }, T('Erledigt · nächstes ▶'))
        : h('button', { class: 'btn small primary', onclick: () => op({ op: 'discussion', action: 'stop' }) }, T('Besprechung abschließen'))) : null);
}

/* ================================================================== */
/* Themengruppen und Maßnahmen                                         */
/* ================================================================== */

async function makeTopic(sel) {
  const items = sel.filter((e) => e.type !== 'frame' && e.type !== 'connector');
  if (!items.length) return;
  const title = await promptDialog(T('Themengruppe bilden'), T('Name des Themas'), items.length === 1 ? textOf(items[0]).slice(0, 60) : '');
  if (title === null) return;
  const b = items.map(bounds).reduce((a, r) => ({ x: Math.min(a.x, r.x), y: Math.min(a.y, r.y), x2: Math.max(a.x2, r.x + r.w), y2: Math.max(a.y2, r.y + r.h) }), { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity });
  const f = makeElement('frame', 0, 0, { kind: 'topic', title: title.trim() || T('Thema'), fill: '#eef2ff', x: b.x - 30, y: b.y - 70, w: b.x2 - b.x + 60, h: b.y2 - b.y + 100 });
  delete f.order;
  addElements([f], { select: false });
  toast(T('Themengruppe angelegt – weitere Beiträge einfach hineinziehen'));
}

export async function openActionDialog({ title = '', near = null, el = null } = {}) {
  const people = await boardPeople();
  const t = h('input', { type: 'text', value: title, required: true, maxlength: 200 });
  const who = h('select', {}, h('option', { value: '' }, T('– niemand / Name eingeben –')), people.filter((p) => !p.guest).map((p) => h('option', { value: p.id, selected: el && el.assigneeId === p.id }, p.displayName + (p.id === myId() ? T(' (du)') : ''))));
  const name = h('input', { type: 'text', value: el && !el.assigneeId ? el.assignee || '' : '', placeholder: T('Name (falls nicht in der Liste)') });
  const due = h('input', { type: 'date', value: (el && el.due) || '' });
  who.addEventListener('change', () => (name.disabled = !!who.value));
  name.disabled = !!who.value;
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    const p = people.find((x) => x.id === who.value);
    const patch = { title: t.value.trim(), assignee: p ? p.displayName : name.value.trim(), assigneeId: p ? p.id : undefined, due: due.value };
    if (el) act(() => updateEl(el.id, patch));
    else {
      // unter dem Beitrag, sonst in der Bildmitte
      const nb = near ? bounds(near) : null;
      const c = nb ? { x: nb.x + 150, y: nb.y + nb.h + 90 } : viewCenter();
      const card = makeElement('card', c.x, c.y, { ...patch, status: T('Offen'), action: true, color: '#12b886', tags: [T('Maßnahme')] });
      if (!patch.assigneeId) delete card.assigneeId;
      addElements([card]);
    }
    m.close();
    if (currentSidePanel() === 'actions') renderSidePanel();
    toast(el ? T('Maßnahme gespeichert') : T('Maßnahme angelegt – sie erscheint bei der zuständigen Person unter „Meine Aufgaben“'), 4000);
  } },
  h('label', {}, T('Was ist zu tun?'), t),
  h('div', { class: 'form-row' }, h('label', {}, T('Verantwortlich'), who), h('label', {}, T('Fällig am'), due)),
  h('label', {}, T('Andere Person'), name),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Speichern'))));
  const m = modal(el ? T('Maßnahme bearbeiten') : T('Maßnahme festhalten'), form);
  setTimeout(() => t.focus(), 0);
}

const DONE = /^(fertig|erledigt|done|geschlossen|closed|abgeschlossen|resolved|gelöst|übernommen|completed|finished|hecho|terminado|completado|cerrado|resuelto|transferido|terminé|fait|fermé|résolu|reporté|carried over|terminée|terminada|hecha|fermée|cerrada|completada|resuelta|résolue|reportée|transferida)$/i;
const actionCards = () => [...app.els.values()].filter((e) => e.type === 'card' && e.action && !e.hidden);
const fmtDate = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

let prevCache = null;
async function previousActions(force) {
  if (!force && prevCache && Date.now() - prevCache.t < 30000) return prevCache.data;
  try {
    prevCache = { t: Date.now(), data: await api(`/api/boards/${app.boardId}/previous-actions`) };
  } catch {
    prevCache = { t: Date.now(), data: { previous: null, actions: [] } };
  }
  return prevCache.data;
}

app.on('renderPanel', (kind, side, close) => {
  if (kind !== 'actions') return;
  const list = actionCards();
  side.append(h('div', { class: 'side-head' }, h('h3', {}, T`Maßnahmen (${list.filter((c) => !DONE.test(String(c.status || '').trim())).length} offen)`), h('span', { class: 'spacer' }), close));
  if (!app.viewOnly) side.append(h('div', { class: 'side-actions' }, h('button', { class: 'btn small primary', onclick: () => openActionDialog() }, h('span', { html: ICONS.plus }), T('Maßnahme'))));
  if (!list.length) side.append(h('p', { class: 'muted pad' }, T('Noch keine Maßnahmen. Wähle einen Beitrag oder ein Thema aus und klicke auf „Als Maßnahme“ – oder lege oben eine neue an.')));
  for (const c of list) {
    const done = DONE.test(String(c.status || '').trim());
    side.append(h('div', { class: 'action-row' + (done ? ' done' : '') },
      h('input', { type: 'checkbox', checked: done, disabled: app.viewOnly, title: done ? T('Wieder öffnen') : T('Als erledigt markieren'), onchange: (e) => act(() => updateEl(c.id, { status: e.target.checked ? T('Erledigt') : T('Offen') })) }),
      h('button', { class: 'action-main linkish', onclick: () => fitTo(bounds(c), { pad: 160, maxZ: 1.2 }) },
        h('span', { class: 'action-title' }, c.title || T('Maßnahme')),
        h('span', { class: 'muted small' }, [c.assignee || T('niemand zugeordnet'), c.due ? T`fällig ${fmtDate(c.due)}` : ''].filter(Boolean).join(' · '))),
      app.viewOnly ? null : h('button', { class: 'icon-btn small', title: T('Bearbeiten'), html: ICONS.edit, onclick: () => openActionDialog({ el: c, title: c.title }) })));
  }
  // Maßnahmen der vorherigen Retro (Serie)
  const prevBox = h('div', { class: 'prev-actions' }, h('p', { class: 'muted pad small' }, T('Lade frühere Maßnahmen …')));
  side.append(prevBox);
  previousActions().then((d) => {
    prevBox.innerHTML = '';
    if (!d.previous) {
      prevBox.append(h('p', { class: 'muted pad small' }, T('Diese Retro ist mit keiner früheren verknüpft. Am Ende über „Retro“ → „Nächste Retro anlegen“ entsteht eine Serie – dann erscheinen hier die offenen Maßnahmen.')));
      return;
    }
    prevBox.append(h('div', { class: 'side-sub' }, h('b', {}, T('Aus der letzten Retro: ')), h('a', { href: '/board/' + encodeURIComponent(d.previous.id), target: '_blank', rel: 'noopener' }, d.previous.name)));
    if (!d.actions.length) prevBox.append(h('p', { class: 'muted pad small' }, T('Dort wurden keine Maßnahmen festgehalten.')));
    for (const a of d.actions) {
      prevBox.append(h('div', { class: 'action-row' + (a.done ? ' done' : '') },
        h('input', { type: 'checkbox', checked: a.done, disabled: !d.previous.canEdit, title: d.previous.canEdit ? T('Erledigt?') : T('Auf der vorherigen Retro fehlen dir die Rechte'), onchange: async (e) => {
          try {
            await api(`/api/boards/${app.boardId}/previous-actions/${encodeURIComponent(a.id)}`, { method: 'POST', body: { done: e.target.checked } });
            prevCache = null;
            renderSidePanel();
          } catch (ex) {
            toast(ex.message);
            e.target.checked = !e.target.checked;
          }
        } }),
        h('span', { class: 'action-main' }, h('span', { class: 'action-title' }, a.title), h('span', { class: 'muted small' }, [a.assignee, a.due ? T`fällig ${fmtDate(a.due)}` : '', a.status].filter(Boolean).join(' · '))),
        app.viewOnly || a.done || list.some((c) => c.fromAction === a.id) ? null : h('button', { class: 'btn small', title: T('Als offene Maßnahme in diese Retro übernehmen'), onclick: async (e) => {
          e.target.disabled = true;
          const c = viewCenter();
          const card = makeElement('card', c.x, c.y, { title: a.title, assignee: a.assignee, assigneeId: a.assigneeId || undefined, due: a.due, status: T('Offen'), action: true, fromAction: a.id, color: '#12b886', tags: [T('Maßnahme'), T('Übernommen')] });
          if (!a.assigneeId) delete card.assigneeId;
          const all = actionCards().map(bounds);
          if (all.length) Object.assign(card, { x: Math.max(...all.map((r) => r.x + r.w)) + 40, y: Math.min(...all.map((r) => r.y)) });
          addElements([card]);
          // Das Original gilt als übernommen – sonst stünde die Aufgabe zweimal in „Meine Aufgaben“
          if (d.previous.canEdit) {
            await api(`/api/boards/${app.boardId}/previous-actions/${encodeURIComponent(a.id)}`, { method: 'POST', body: { carried: true } }).catch(() => {});
          }
          prevCache = null;
          toast(T('Übernommen'));
          renderSidePanel();
        } }, T('In diese Retro übernehmen'))));
    }
  });
});

/* ================================================================== */
/* Zusammenfassung                                                     */
/* ================================================================== */

const MOOD = ['', '😫', '🙁', '😐', '🙂', '😄'];

function pollLine(p) {
  if (p.kind === 'health') {
    const items = (p.results && p.results.items) || {};
    const rows = ((p.results && p.results.labels) || []).map((it) => {
      const c = items[it.id] || {};
      return `${it.label}: 🟢 ${c['3'] || 0} 🟡 ${c['2'] || 0} 🔴 ${c['1'] || 0}`;
    });
    return rows.length ? T`Team-Health-Check – ${rows.join(' · ')}` : null;
  }
  const counts = (p.results && p.results.counts) || {};
  const n = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!n) return null;
  if (p.kind === 'custom') {
    const opts = (p.results && p.results.options) || [];
    return `${p.question || T('Umfrage')}: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${opts[Number(k)] || '?'} (${c})`).join(', ')}`;
  }
  const avg = Object.entries(counts).reduce((s, [k, c]) => s + Number(k) * c, 0) / n;
  const label = p.kind === 'roti' ? T('ROTI (1–5)') : p.kind === 'mood' ? T('Stimmung (1–5)') : p.kind === 'fist' ? T('Fist of Five (0–5)') : p.question || T('Umfrage');
  return T`${label}: Ø ${avg.toFixed(1).replace('.', DEC)} (${n} Stimmen)`;
}

async function summaryData() {
  const totals = voteTotals();
  const tlist = topics().map((t) => ({ t, votes: totals.get(t.id) || 0 })).sort((a, b) => b.votes - a.votes);
  let polls = [];
  try {
    polls = (await api(`/api/boards/${app.boardId}/polls`)).polls.filter((p) => p.boardId === app.boardId);
  } catch {}
  const prev = await previousActions(true);
  return { tlist, totals, polls, actions: actionCards(), prev };
}

function summaryMarkdown(d) {
  const out = [`# ${app.name}`, '', T`Retro vom ${new Date().toLocaleDateString(LOCALE, { day: '2-digit', month: 'long', year: 'numeric' })}`, ''];
  const pl = d.polls.map(pollLine).filter(Boolean);
  if (pl.length) out.push(T('## Stimmung'), ...pl.map((l) => `- ${l}`), '');
  if (d.tlist.length) {
    out.push(T('## Themen'));
    for (const { t, votes } of d.tlist) {
      out.push(`- **${textOf(t) || T('Thema')}**${votes ? T` (Stimmen: ${votes})` : ''}`);
      for (const c of frameChildren(t).filter((e) => e.type === 'sticky' && textOf(e))) out.push(`  - ${textOf(c)}`);
    }
    out.push('');
  } else if (d.totals.size) {
    out.push(T('## Meistgewählte Beiträge'));
    for (const [id, n] of [...d.totals].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      const el = getEl(id);
      if (el) out.push(`- ${textOf(el)} (${n})`);
    }
    out.push('');
  }
  out.push(T('## Maßnahmen'));
  if (!d.actions.length) out.push(T('- keine'));
  for (const c of d.actions) out.push(`- [${DONE.test(String(c.status || '').trim()) ? 'x' : ' '}] ${c.title || T('Maßnahme')}${c.assignee ? ` – ${c.assignee}` : ''}${c.due ? T` (bis ${fmtDate(c.due)})` : ''}`);
  if (d.prev.previous && d.prev.actions.length) {
    out.push('', T`## Maßnahmen der letzten Retro („${d.prev.previous.name}“)`);
    for (const a of d.prev.actions) out.push(`- [${a.done ? 'x' : ' '}] ${a.title}${a.assignee ? ` – ${a.assignee}` : ''}`);
  }
  return out.join('\n');
}

export async function openSummary() {
  const d = await summaryData();
  const md = summaryMarkdown(d);
  const pre = h('textarea', { class: 'summary-text', rows: 16, readonly: true }, md);
  const send = async (body, ok) => {
    try {
      const r = await api(`/api/boards/${app.boardId}/summary`, { method: 'POST', body: { lines: md.split('\n').filter((l) => l.trim()), ...body } });
      toast(ok(r), 4000);
    } catch (e) {
      toast(e.message, 5000);
    }
  };
  const m = modal(T('Retro-Zusammenfassung'), h('div', { class: 'form' },
    h('p', { class: 'muted' }, T('Themen, Stimmung und Maßnahmen dieser Retro – zum Kopieren, Herunterladen, Drucken oder Verschicken.')),
    pre,
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn small', onclick: () => navigator.clipboard.writeText(md).then(() => toast(T('Kopiert')), () => toast(T('Kopieren nicht möglich'))) }, T('Kopieren')),
      h('button', { class: 'btn small', onclick: () => download(safeName(app.name) + '-' + T('zusammenfassung') + '.md', new Blob([md], { type: 'text/markdown' })) }, T('Als Markdown herunterladen')),
      h('button', { class: 'btn small', onclick: () => printSummary(md) }, T('Drucken / PDF')),
      isFacilitator() ? h('button', { class: 'btn small', onclick: () => send({ email: true }, (r) => T`Zusammenfassung verschickt, Empfänger: ${r.mailed}`) }, T('Per E-Mail an Beteiligte')) : null,
      isFacilitator() ? h('button', { class: 'btn small', onclick: () => send({ webhook: true }, (r) => (r.webhook ? T('An den Team-Kanal geschickt (sofern ein Team-Webhook eingerichtet ist)') : T('Das Board gehört zu keinem Team – kein Team-Kanal'))) }, T('An Team-Kanal')) : null),
    app.viewOnly ? null : h('div', { class: 'form-actions' }, h('button', { class: 'btn primary', onclick: () => {
      m.close();
      nextRetro();
    } }, T('Nächste Retro anlegen …')))), { wide: true });
}

function printSummary(md) {
  const win = window.open('', '_blank');
  if (!win) return toast(T('Pop-up wurde blockiert'));
  const html = md.split('\n').map((l) => {
    if (l.startsWith('# ')) return `<h1>${esc(l.slice(2))}</h1>`;
    if (l.startsWith('## ')) return `<h2>${esc(l.slice(3))}</h2>`;
    if (/^\s*- /.test(l)) return `<p style="margin:2px 0 2px ${l.startsWith('  ') ? 36 : 12}px">• ${esc(l.replace(/^\s*- /, '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`;
    return l ? `<p>${esc(l)}</p>` : '';
  }).join('');
  win.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(app.name)}</title><body style="font-family:sans-serif;max-width:800px;margin:24px auto">${html}</body>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

async function nextRetro() {
  const name = await promptDialog(T('Nächste Retro anlegen'), T('Name der nächsten Retro'), T`${app.name.replace(/\s*\([^()]*\)$/, '')} (nächste)`);
  if (name === null) return;
  try {
    const r = await api(`/api/boards/${app.boardId}/next-retro`, { method: 'POST', body: { name } });
    toast(T('Nächste Retro angelegt – die Struktur wurde übernommen, offene Maßnahmen erscheinen dort im Rückblick.'), 5000, { label: T('Öffnen'), onClick: () => (location.href = '/board/' + r.id) });
  } catch (e) {
    toast(e.message);
  }
}

/* ================================================================== */
/* Zufallsauswahl und Redereihenfolge                                  */
/* ================================================================== */

const ppanel = h('div', { id: 'picker-panel', class: 'panel hidden', role: 'status', 'aria-live': 'polite' });
document.body.append(ppanel);
let lastPick = null;
let spinTimer = null;

function participantNames() {
  return [...new Set([app.user.name, ...[...app.peers.values()].map((p) => p.name)].filter(Boolean).map((n) => n.replace(T(' (Gast)'), '')))];
}

function openPicker(kind) {
  const names = h('textarea', { rows: 8 }, participantNames().join('\n'));
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    const list = names.value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!list.length) return toast(T('Bitte mindestens einen Namen eintragen'));
    op({ op: 'picker', action: kind === 'order' ? 'order' : 'spin', names: list });
    m.close();
  } },
  h('p', { class: 'muted' }, kind === 'order' ? T('Alle sehen dieselbe zufällige Reihenfolge – z. B. fürs Vorstellen der Beiträge.') : T('Das Rad wählt zufällig eine Person aus; alle sehen dasselbe Ergebnis.')),
  h('label', {}, T('Namen (einer pro Zeile)'), names),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, kind === 'order' ? T('Reihenfolge mischen') : T('Rad drehen'))));
  const m = modal(kind === 'order' ? T('Redereihenfolge') : T('Zufallsauswahl'), form);
}

function renderPicker() {
  const p = app.session.picker;
  clearInterval(spinTimer);
  ppanel.classList.toggle('hidden', !p);
  if (!p) return;
  const steer = canSteer();
  const head = h('div', { class: 'disc-head' }, h('span', { class: 'muted small' }, p.kind === 'order' ? T('Redereihenfolge') : T('Zufallsauswahl')), h('span', { class: 'spacer' }),
    h('button', { class: 'icon-btn small', title: steer ? T('Für alle schließen') : T('Ausblenden'), html: ICONS.close, onclick: () => (steer ? op({ op: 'picker', action: 'clear' }) : ppanel.classList.add('hidden')) }));
  ppanel.innerHTML = '';
  ppanel.append(head);
  if (p.kind === 'order') {
    ppanel.append(h('ol', { class: 'picker-order' }, p.order.map((i) => h('li', {}, p.names[i]))));
    return;
  }
  const big = h('div', { class: 'picker-name' });
  ppanel.append(big, steer ? h('button', { class: 'btn small', onclick: () => op({ op: 'picker', action: 'spin', names: p.names }) }, T('Nochmal drehen')) : '');
  const fresh = lastPick !== p.at && Date.now() - p.at < 4000 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  lastPick = p.at;
  if (!fresh) {
    big.textContent = '🎯 ' + p.names[p.result];
    return;
  }
  // kurz durch die Namen laufen, dann beim Ergebnis anhalten
  let i = 0, steps = 18 + p.result;
  big.classList.add('spinning');
  spinTimer = setInterval(() => {
    big.textContent = p.names[i % p.names.length];
    i++;
    if (i > steps && (i - 1) % p.names.length === p.result) {
      clearInterval(spinTimer);
      big.classList.remove('spinning');
      big.textContent = '🎯 ' + p.names[p.result];
    }
  }, 90);
}

/* ================================================================== */
/* Menü, Kontextleiste, Ereignisse                                     */
/* ================================================================== */

function retroMenu(anchor) {
  const r = app.session.retro;
  const steer = canSteer();
  menu(anchor, [
    { header: T('Retro') },
    r && r.active
      ? { label: T('Retro-Ablauf beenden'), icon: 'stop', disabled: !steer, onClick: () => op({ op: 'retro', action: 'stop' }) }
      : { label: T('Retro-Ablauf starten …'), icon: 'play', disabled: !steer, onClick: openStart },
    { label: T('Schnellumfrage …'), icon: 'vote', disabled: !steer, onClick: () => app.emit('openPollDialog') },
    { label: T('Zufallsauswahl …'), icon: 'users', disabled: !steer, onClick: () => openPicker('wheel') },
    { label: T('Redereihenfolge …'), icon: 'users', disabled: !steer, onClick: () => openPicker('order') },
    '-',
    { label: T('Maßnahmen'), icon: 'tasks', onClick: () => showSidePanel('actions') },
    { label: T('Zusammenfassung'), icon: 'download', onClick: openSummary },
    { label: T('Umfrage-Verlauf'), icon: 'activity', onClick: () => app.emit('openPollHistory') },
    app.viewOnly ? null : { label: T('Nächste Retro anlegen …'), icon: 'plus', onClick: nextRetro },
  ].filter(Boolean));
}

app.on('retroMenu', retroMenu);

app.on('buildCollabTools', (box) => {
  const b = h('button', { class: 'icon-btn', id: 'btn-retro', title: T('Retro: Ablauf, Umfragen, Maßnahmen'), html: '<span class="emoji-icon">🔁</span>' });
  b.onclick = () => retroMenu(b);
  box.prepend(b);
});

app.on('ctxItems', (items, sel, { locked, one, actBtn }) => {
  if (locked || app.viewOnly) return;
  const contributions = sel.filter((e) => !['frame', 'connector', 'comment'].includes(e.type));
  if (contributions.length && contributions.length === sel.length) items.push(actBtn('<span class="emoji-icon">🗂</span>', T('Themengruppe bilden'), () => makeTopic(sel)));
  if (one && (one.type === 'sticky' || one.type === 'text' || (one.type === 'frame' && one.kind === 'topic'))) {
    items.push(actBtn('<span class="emoji-icon">✅</span>', T('Als Maßnahme festhalten'), () => openActionDialog({ title: textOf(one).slice(0, 200), near: one })));
  }
  if (one && one.type === 'card' && one.action) items.push(actBtn('<span class="emoji-icon">✅</span>', T('Maßnahme bearbeiten'), () => openActionDialog({ el: one, title: one.title })));
});

app.on('session', (kind) => {
  if (kind === 'all' || kind === 'retro') renderBar();
  if (kind === 'all' || kind === 'discussion') renderDiscussion();
  if (kind === 'all' || kind === 'picker') renderPicker();
  if (kind === 'moderation') {
    renderBar();
    renderDiscussion();
    renderPicker();
  }
});
// Rückblick: Jemand hat eine Maßnahme der letzten Retro abgehakt oder übernommen
app.on('actionsChanged', () => {
  prevCache = null;
  if (currentSidePanel() === 'actions') renderSidePanel();
});

// Maßnahmen-Panel aktuell halten, wenn sich Karten ändern
let actionSig = '';
app.on('render', throttle(() => {
  if (currentSidePanel() !== 'actions') return;
  const sig = JSON.stringify(actionCards().map((c) => [c.id, c.title, c.status, c.assignee, c.due]));
  if (sig !== actionSig) {
    actionSig = sig;
    renderSidePanel();
  }
}, 600));
app.on('loaded', () => {
  if (app.prevRetroId && !sessionStorage.getItem('seriesHint:' + app.boardId)) {
    sessionStorage.setItem('seriesHint:' + app.boardId, '1');
    toast(T('Diese Retro gehört zu einer Serie – offene Maßnahmen der letzten Retro findest du unter „Maßnahmen“.'), 5000, { label: T('Anzeigen'), onClick: () => showSidePanel('actions') });
  }
});
