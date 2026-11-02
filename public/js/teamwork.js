// Privater Modus (verdecktes Sammeln) und Schätzrunden mit verdeckten Karten
import { T, DEC } from './i18n.js';
import { h, append, ICONS, toast, modal, initials, throttle } from './util.js';
import { app, getEl, bounds, fitTo, setSelection, selectedEls, act, updateEl } from './core.js';
import { foldable } from './banners.js';
import { menu } from './ui.js';
import { leads, toolsReserved } from './moderation.js';

const myId = () => String(app.user.id);

/* ================================================================== */
/* Privater Modus                                                      */
/* ================================================================== */

const pmBanner = h('div', { id: 'private-banner', class: 'panel chrome hidden', role: 'status' });
document.body.append(pmBanner);
let pmWasActive = null;

function setPrivateMode(active) {
  if (app.viewOnly) return toast(T('Das Bearbeiten ist gerade gesperrt'));
  app.sync.op({ op: 'privateMode', active });
}

function renderPrivate() {
  const pm = app.session.privateMode;
  const active = !!(pm && pm.active);
  document.getElementById('btn-private')?.classList.toggle('active', active);
  pmBanner.classList.toggle('hidden', !active);
  if (!active) return;
  let mine = 0, others = 0;
  for (const el of app.els.values()) {
    if (el.hidden) others++;
    else if (el.priv && String(el.priv) === myId()) mine++;
  }
  pmBanner.innerHTML = '';
  append(pmBanner,
    h('span', { class: 'pm-icon', html: ICONS.eyeOff }),
    h('span', {}, h('b', {}, T('Privater Modus')), h('span', { class: 'banner-detail' }, T` · gestartet von ${pm.by || T('jemandem')} – neue Notizen, Texte, Karten, Formen, Code-Blöcke, Tabellen und Bilder sieht nur, wer sie erstellt. Das gilt auch für bisher leere Notizen, die du jetzt beschreibst. `,
        h('span', { class: 'muted small' }, T`Deine privaten Elemente: ${mine} · verdeckt von anderen: ${others}`))),
    canReveal(pm) ? h('button', { class: 'btn small primary', onclick: () => setPrivateMode(false) }, T('Aufdecken & beenden')) : null);
  foldable(pmBanner, 'private', !canReveal(pm));
}

// Aufdecken zeigt die Beiträge aller: Das entscheidet, wer den Modus gestartet hat oder das Board leitet (prüft auch der Server)
const canReveal = (pm) => !app.viewOnly && leads(pm.byId);

app.on('session', (kind) => {
  if (kind !== 'all' && kind !== 'privateMode') return;
  const pm = app.session.privateMode;
  const active = !!(pm && pm.active);
  if (pmWasActive !== null && active !== pmWasActive) {
    const startMsg = !pm ? '' : app.viewOnly ? T`${pm.by || T('Jemand')} hat den privaten Modus gestartet – neue Inhalte bleiben bis zum Aufdecken verdeckt` : T`${pm.by || T('Jemand')} hat den privaten Modus gestartet – deine neuen Inhalte sind vorerst nur für dich sichtbar`;
    toast(active ? startMsg : T('Privater Modus beendet – alle Inhalte sind jetzt für alle sichtbar'), 5000);
  }
  pmWasActive = active;
  renderPrivate();
});
app.on('render', throttle(() => app.session.privateMode && renderPrivate(), 400));
app.on('peers', () => app.session.privateMode && renderPrivate());

/* ================================================================== */
/* Schätzrunde mit verdeckten Karten                                  */
/* ================================================================== */

const DECKS = {
  fib: { label: T('Fibonacci (Story Points)'), cards: ['0', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'] },
  tshirt: { label: T('T-Shirt-Größen'), cards: [T('XS'), 'S', 'M', 'L', T('XL'), T('XXL'), '?', '☕'] },
  hours: { label: T('Stunden'), cards: ['1', '2', '4', '8', '16', '24', '40', '?', '☕'] },
};

const panel = h('div', { id: 'estimation', class: 'panel hidden', role: 'dialog', 'aria-label': T('Schätzrunde') });
document.body.append(panel);
let lastEstId = null;

function estOp(action, extra = {}) {
  app.sync.op({ op: 'estimation', action, ...extra });
}

// Eine Karte oder mehrere nacheinander: Die weiteren stehen in der Warteschlange der Runde, der Server prüft sie beim Start
app.on('startEstimation', (ids) => {
  const list = [ids].flat().map(getEl).filter((e) => e && !e.hidden);
  const el = list[0];
  if (!el || app.viewOnly) return;
  const id = el.id;
  const queue = list.slice(1).map((e) => e.id);
  const cur = app.session.estimation;
  let deck = (cur && cur.deck) || 'fib';
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    estOp('start', { elId: id, deck, ...(queue.length ? { queue } : {}) });
    m.close();
  } },
  h('p', { class: 'muted' }, T('Alle Teilnehmenden wählen verdeckt eine Karte. Die Werte erscheinen erst beim Aufdecken – so beeinflusst niemand die anderen.')),
  queue.length ? h('div', {}, h('p', {}, h('b', {}, T`${list.length} Karten nacheinander schätzen`)), h('ol', { class: 'est-queue' }, list.map((c) => h('li', {}, c.title || T('Karte'))))) : h('p', {}, h('b', {}, el.title || T('Karte'))),
  h('div', { class: 'label' }, T('Kartendeck')),
  h('div', { class: 'radio-list' }, Object.entries(DECKS).map(([k, d]) => h('label', { class: 'radio-card' },
    h('input', { type: 'radio', name: 'deck', value: k, checked: k === deck, onchange: () => (deck = k) }),
    h('span', {}, h('b', {}, d.label), h('br'), h('span', { class: 'muted small' }, d.cards.join(' · ')))))),
  cur ? h('p', { class: 'muted small' }, T('Eine laufende Schätzrunde wird dabei ersetzt.')) : null,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Schätzrunde starten'))));
  const m = modal(T('Schätzrunde starten'), form);
});

function participants(est) {
  const list = new Map();
  list.set(myId(), app.user.name);
  for (const p of app.peers.values()) if (p.userId) list.set(String(p.userId), p.name);
  for (const [uid, v] of Object.entries(est.votes || {})) if (!list.has(uid)) list.set(uid, v.name);
  return [...list.entries()].map(([uid, name]) => ({ uid, name, vote: est.votes?.[uid] }));
}

function stats(values) {
  const nums = values.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const avg = nums.reduce((s, n) => s + n, 0) / nums.length;
  const mid = nums.length % 2 ? nums[(nums.length - 1) / 2] : (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2;
  return { avg: Math.round(avg * 10) / 10, median: mid, min: nums[0], max: nums.at(-1) };
}

function renderEstimation() {
  const est = app.session.estimation;
  panel.classList.toggle('hidden', !est);
  if (!est) {
    lastEstId = null;
    return;
  }
  const card = getEl(est.elId);
  const deck = DECKS[est.deck] || DECKS.fib;
  const people = participants(est);
  const mine = est.votes?.[myId()]?.value;
  const voted = people.filter((p) => p.vote).length;
  // Warteschlange: Fortschritt für alle, Weiterschalten für alle, die auch beenden dürfen
  const left = est.queue?.length || 0;
  const place = (est.done || 0) + 1, total = place + left;
  const canStep = !app.viewOnly && !toolsReserved();
  const next = () => estOp('next');
  panel.innerHTML = '';
  const head = h('div', { class: 'est-head' },
    h('span', { html: ICONS.poker }),
    h('div', { class: 'est-title' }, h('div', { class: 'muted small' }, T`Schätzrunde · gestartet von ${est.by || T('jemandem')}`),
      h('button', { class: 'linkish', title: T('Zur Karte springen'), onclick: () => card && (setSelection([card.id]), fitTo(bounds(card), { maxZ: 1.5, pad: 200 })) }, (card && !card.hidden && card.title) || est.title || (card && card.hidden ? T('🔒 Verdeckte Karte') : T('Karte')))),
    app.viewOnly ? null : h('button', { class: 'icon-btn small', title: T('Schätzrunde beenden'), html: ICONS.close, onclick: () => estOp('close') }));
  panel.append(head);
  if (total > 1) panel.append(h('div', { class: 'est-progress' }, h('span', { class: 'muted small' }, T`Karte ${place} von ${total}`), h('progress', { value: place, max: total, 'aria-label': T('Fortschritt der Schätzrunde') })));
  if (!est.revealed) {
    panel.append(h('div', { class: 'est-deck' }, deck.cards.map((c) => h('button', {
      class: 'est-card' + (mine === c ? ' active' : ''), title: c === '☕' ? T('Pause nötig') : c === '?' ? T('Unklar') : T('Wert ') + c,
      onclick: () => app.sync.op({ op: 'estimate', value: mine === c ? null : c }),
    }, c))));
    panel.append(h('div', { class: 'est-people' }, people.map((p) => h('span', { class: 'est-person' + (p.vote ? ' done' : '') },
      h('span', { class: 'avatar xs' }, initials(p.name)), p.name, h('span', { class: 'est-state' }, p.vote ? '✓' : '…')))));
    panel.append(h('div', { class: 'est-actions' },
      h('span', { class: 'muted small' }, T`${voted} von ${people.length} haben geschätzt`),
      h('span', { class: 'spacer' }),
      left && canStep ? h('button', { class: 'btn small', onclick: next }, T('Nächste Karte')) : null,
      app.viewOnly ? null : h('button', { class: 'btn small primary', disabled: !voted, onclick: () => estOp('reveal') }, T('Aufdecken'))));
  } else {
    const votes = people.filter((p) => p.vote && p.vote.value);
    const values = votes.map((p) => p.vote.value);
    const st = stats(values);
    const counts = {};
    values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const real = values.filter((v) => v !== '?' && v !== '☕');
    const consensus = real.length > 1 && real.length === values.length && new Set(real).size === 1;
    panel.append(h('div', { class: 'est-results' }, votes.sort((a, b) => deck.cards.indexOf(a.vote.value) - deck.cards.indexOf(b.vote.value)).map((p) =>
      h('div', { class: 'est-result' }, h('span', { class: 'est-card small active' }, p.vote.value), p.name))));
    panel.append(h('div', { class: 'est-stats' },
      consensus ? h('b', { class: 'ok-text' }, T('🎉 Einigkeit!')) : null,
      st ? h('span', {}, T`Ø ${String(st.avg).replace('.', DEC)} · Median ${String(st.median).replace('.', DEC)} · Spanne ${st.min}–${st.max}`) : null,
      !values.length ? h('span', { class: 'muted' }, T('Niemand hat geschätzt.')) : null));
    if (!app.viewOnly) {
      const canApply = card && !card.hidden;
      const apply = (v) => {
        if (card) act(() => updateEl(card.id, { points: v }));
        // Mit Warteschlange geht es direkt weiter, die letzte Karte schließt die Runde
        toast(left ? T`Schätzung ${v} übernommen, weiter mit der nächsten Karte` : total > 1 ? T('Schätzung übernommen, alle Karten sind durch') : T`Schätzung ${v} auf die Karte übernommen`);
        estOp(left ? 'next' : 'close');
      };
      panel.append(h('div', { class: 'est-actions' },
        h('button', { class: 'btn small', onclick: () => estOp('reset') }, T('Neu schätzen')),
        h('span', { class: 'spacer' }),
        left && canStep ? h('button', { class: 'btn small', onclick: next }, T('Nächste Karte')) : null,
        !canApply ? null : top.filter(([v]) => v !== '?' && v !== '☕').slice(0, 3).map(([v]) => h('button', { class: 'btn small primary', onclick: () => apply(v), title: T('Als Story Points übernehmen') }, T`${v} übernehmen`))));
    }
  }
}

app.on('session', (kind) => {
  if (kind !== 'all' && kind !== 'estimation') return;
  const est = app.session.estimation;
  if (est && est.id !== lastEstId && kind === 'estimation' && !est.revealed && !Object.keys(est.votes || {}).length && !est.done && !est.advanced) {
    toast(T`${est.by || T('Jemand')} hat eine Schätzrunde gestartet`);
  }
  if (est) lastEstId = est.id;
  renderEstimation();
});
app.on('peers', () => app.session.estimation && renderEstimation());

/* ================================================================== */
/* Schaltflächen in der Kopfzeile                                      */
/* ================================================================== */

// In Leserichtung: Die Reihenfolge der Elemente im Speicher hängt davon ab, wie die Datenbank sie liefert
const cardsOnBoard = () => [...app.els.values()].filter((e) => e.type === 'card' && !e.hidden).sort((a, b) => a.y - b.y || a.x - b.x);

function privateItems() {
  const pm = app.session.privateMode;
  return pm?.active ? [
    { header: T('Privater Modus läuft') },
    canReveal(pm) ? { label: T('Aufdecken & beenden'), icon: 'check', onClick: () => setPrivateMode(false) } : { label: T`Aufdecken kann ${pm.by || T('die startende Person')}`, disabled: true },
  ] : [
    { header: T('Privater Modus') },
    { label: T('Für alle starten'), icon: 'eyeOff', onClick: () => setPrivateMode(true) },
  ];
}

const unestimated = () => cardsOnBoard().filter((c) => c.points === undefined || c.points === null || c.points === '');

function pickCards() {
  const boxes = cardsOnBoard().map((c) => ({ id: c.id, box: h('input', { type: 'checkbox', checked: unestimated().includes(c) }), label: c.title || T('Karte'), points: c.points }));
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    const ids = boxes.filter((b) => b.box.checked).map((b) => b.id);
    if (!ids.length) return toast(T('Bitte mindestens eine Karte wählen'));
    m.close();
    app.emit('startEstimation', ids);
  } },
  h('div', { class: 'est-pick' }, boxes.map((b) => h('label', { class: 'check' }, b.box, h('span', {}, b.label), b.points ? h('span', { class: 'muted small' }, b.points) : null))),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Weiter'))));
  const m = modal(T('Karten für die Schätzrunde wählen'), form);
}

// Die Schätzrunde gilt den ausgewählten Karten, sonst fragt das Menü nach einer Karte oder mehreren
function chooseCard(anchor) {
  const sel = selectedEls();
  if (sel.length && sel.every((e) => e.type === 'card')) return app.emit('startEstimation', sel.map((e) => e.id));
  const cards = cardsOnBoard();
  const open = unestimated();
  menu(anchor, [
    { header: T('Karte für die Schätzrunde') },
    ...(cards.length > 1 ? [
      ...(open.length > 1 ? [{ label: T`Alle ohne Schätzung (${open.length})`, icon: 'poker', onClick: () => app.emit('startEstimation', open.map((c) => c.id)) }] : []),
      { label: T('Mehrere Karten wählen …'), icon: 'check', onClick: pickCards },
      '-',
    ] : []),
    ...cards.map((c) => ({ label: c.title || T('Karte'), icon: 'card', onClick: () => app.emit('startEstimation', c.id) })),
  ]);
}

app.on('moderateItems', (list) => {
  if (app.viewOnly) return;
  list.push({ key: 'private', order: 40, label: T('Privater Modus'), icon: 'eyeOff', active: !!app.session.privateMode?.active, items: privateItems });
  if (cardsOnBoard().length && !toolsReserved()) list.push({ key: 'estimate', order: 60, label: T('Schätzrunde …'), icon: 'poker', active: !!app.session.estimation, onClick: chooseCard });
});
