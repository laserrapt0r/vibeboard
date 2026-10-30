// Privater Modus (verdecktes Sammeln) und Schätzrunden mit verdeckten Karten
import { T, DEC } from './i18n.js';
import { h, append, ICONS, toast, modal, initials, throttle } from './util.js';
import { app, getEl, bounds, fitTo, setSelection, act, updateEl } from './core.js';
import { menu } from './ui.js';

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
    h('span', {}, h('b', {}, T('Privater Modus')), T` · gestartet von ${pm.by || T('jemandem')} – neue Notizen, Texte, Karten, Formen, Code-Blöcke, Tabellen und Bilder sieht nur, wer sie erstellt. `,
      h('span', { class: 'muted small' }, T`Deine privaten Elemente: ${mine} · verdeckt von anderen: ${others}`)),
    app.viewOnly ? null : h('button', { class: 'btn small primary', onclick: () => setPrivateMode(false) }, T('Aufdecken & beenden')));
}

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

app.on('startEstimation', (id) => {
  const el = getEl(id);
  if (!el || app.viewOnly) return;
  const cur = app.session.estimation;
  let deck = (cur && cur.deck) || 'fib';
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    estOp('start', { elId: id, deck });
    m.close();
  } },
  h('p', { class: 'muted' }, T('Alle Teilnehmenden wählen verdeckt eine Karte. Die Werte erscheinen erst beim Aufdecken – so beeinflusst niemand die anderen.')),
  h('p', {}, h('b', {}, el.title || T('Karte'))),
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
  panel.innerHTML = '';
  const head = h('div', { class: 'est-head' },
    h('span', { html: ICONS.poker }),
    h('div', { class: 'est-title' }, h('div', { class: 'muted small' }, T`Schätzrunde · gestartet von ${est.by || T('jemandem')}`),
      h('button', { class: 'linkish', title: T('Zur Karte springen'), onclick: () => card && (setSelection([card.id]), fitTo(bounds(card), { maxZ: 1.5, pad: 200 })) }, (card && !card.hidden && card.title) || est.title || (card && card.hidden ? T('🔒 Verdeckte Karte') : T('Karte')))),
    app.viewOnly ? null : h('button', { class: 'icon-btn small', title: T('Schätzrunde beenden'), html: ICONS.close, onclick: () => estOp('close') }));
  panel.append(head);
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
        toast(T`Schätzung ${v} auf die Karte übernommen`);
        estOp('close');
      };
      panel.append(h('div', { class: 'est-actions' },
        h('button', { class: 'btn small', onclick: () => estOp('reset') }, T('Neu schätzen')),
        h('span', { class: 'spacer' }),
        !canApply ? null : top.filter(([v]) => v !== '?' && v !== '☕').slice(0, 3).map(([v]) => h('button', { class: 'btn small primary', onclick: () => apply(v), title: T('Als Story Points übernehmen') }, T`${v} übernehmen`))));
    }
  }
}

app.on('session', (kind) => {
  if (kind !== 'all' && kind !== 'estimation') return;
  const est = app.session.estimation;
  if (est && est.id !== lastEstId && kind === 'estimation' && !est.revealed && !Object.keys(est.votes || {}).length) {
    toast(T`${est.by || T('Jemand')} hat eine Schätzrunde gestartet`);
  }
  if (est) lastEstId = est.id;
  renderEstimation();
});
app.on('peers', () => app.session.estimation && renderEstimation());

/* ================================================================== */
/* Schaltflächen in der Kopfzeile                                      */
/* ================================================================== */

app.on('buildCollabTools', (box) => {
  if (app.viewOnly) return;
  const b = h('button', { class: 'icon-btn', id: 'btn-private', title: T('Privater Modus (verdeckt sammeln)'), html: ICONS.eyeOff });
  b.onclick = () => {
    const active = !!app.session.privateMode?.active;
    menu(b, active ? [
      { header: T('Privater Modus läuft') },
      { label: T('Aufdecken & beenden'), icon: 'check', onClick: () => setPrivateMode(false) },
    ] : [
      { header: T('Privater Modus') },
      { label: T('Für alle starten'), icon: 'eyeOff', onClick: () => setPrivateMode(true) },
    ]);
  };
  box.prepend(b);
});
