// Freigaben: Frames und Dateien Prüfenden vorlegen, Entscheidungen sammeln und den Stand sichtbar machen
import { T, LOCALE } from './i18n.js';
import { h, api, toast, modal, initials, confirmDialog } from './util.js';
import { app, getEl, fitTo, setSelection, scheduleRender, markDirty } from './core.js';
import { currentSidePanel, renderSidePanel, toggleSidePanel, boardPeople } from './ui.js';

const STATUS = {
  open: [T('In Prüfung'), 'warn'],
  approved: [T('Freigegeben'), 'ok'],
  rejected: [T('Abgelehnt'), 'bad'],
  outdated: [T('Geändert nach Freigabe'), 'warn'],
  missing: [T('Element gelöscht'), 'off'],
};
const base = () => `/api/boards/${encodeURIComponent(app.boardId)}/reviews`;

export async function loadReviews() {
  if (app.guest) return;
  try {
    const { reviews } = await api(base(), { quiet: true });
    const before = [...(app.reviews?.keys() || [])];
    app.reviews = new Map(reviews.map((r) => [r.elementId, r]));
    [...before, ...app.reviews.keys()].forEach(markDirty);
    scheduleRender(true);
    if (currentSidePanel() === 'reviews') renderSidePanel();
  } catch {
    /* ohne Freigaben weiterarbeiten */
  }
}

async function send(run, message) {
  try {
    await run();
    if (message) toast(message);
    await loadReviews();
  } catch (e) {
    toast(e.message, 6000);
  }
}

export async function requestReview(el) {
  const people = (await boardPeople()).filter((p) => !p.guest);
  const boxes = people.map((p) => ({ p, cb: h('input', { type: 'checkbox', value: p.id }) }));
  const note = h('textarea', { rows: 3, maxlength: 2000 });
  const due = h('input', { type: 'date' });
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    const reviewers = boxes.filter((b) => b.cb.checked).map((b) => b.p.id);
    if (!reviewers.length) {
      err.textContent = T('Bitte wähle mindestens eine prüfende Person aus.');
      return err.classList.remove('hidden');
    }
    await send(() => api(base(), { method: 'POST', body: { elementId: el.id, reviewers, note: note.value, due: due.value } }), T('Freigabe angefordert'));
    m.close();
    toggleReviews(true);
  } },
  h('fieldset', { class: 'plain' }, h('legend', {}, T('Prüfende Personen')),
    h('div', { class: 'check-grid' }, boxes.map((b) => h('label', { class: 'check' }, b.cb, b.p.displayName)))),
  h('label', {}, T('Hinweis an die Prüfenden (optional)'), note),
  h('label', {}, T('Bis wann (optional)'), due),
  err,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Anfordern'))));
  const m = modal(T`Freigabe anfordern: ${el.title || el.name || T('Frame')}`, form);
}

function decide(r, decision) {
  const comment = h('textarea', { rows: 3, maxlength: 2000, required: decision === 'rejected' });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    await send(() => api(`${base()}/${r.id}/decision`, { method: 'POST', body: { decision, comment: comment.value } }), decision === 'approved' ? T('Freigegeben') : T('Abgelehnt'));
    m.close();
  } },
  h('label', {}, decision === 'rejected' ? T('Begründung') : T('Anmerkung (optional)'), comment),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')),
    h('button', { type: 'submit', class: 'btn ' + (decision === 'rejected' ? 'danger' : 'primary') }, decision === 'approved' ? T('Freigeben') : T('Ablehnen'))));
  const m = modal(decision === 'approved' ? T`„${r.title}“ freigeben` : T`„${r.title}“ ablehnen`, form);
}

function renderPanel(side, close) {
  const list = [...(app.reviews?.values() || [])];
  side.append(h('div', { class: 'side-head' }, h('h3', {}, T('Freigaben')), h('span', { class: 'spacer' }), close));
  if (!list.length) side.append(h('p', { class: 'muted pad' }, T('Noch keine Freigaben. Wähle einen Frame oder eine Datei aus und fordere im Kontextmenü eine Freigabe an.')));
  const me = String(app.user.id);
  for (const r of list) {
    const [label, cls] = STATUS[r.status];
    const mine = r.people.find((p) => p.id === me);
    const manage = r.byId === me || app.role === 'owner';
    const el = getEl(r.elementId);
    side.append(h('section', { class: 'review-item' },
      h('button', { class: 'review-title', disabled: !el, onclick: () => {
        setSelection([r.elementId]);
        fitTo({ x: el.x, y: el.y, w: el.w, h: el.h }, { pad: 60, maxZ: 2 });
      } }, r.title || T('Ohne Titel')),
      h('span', { class: 'pill ' + cls }, label),
      r.due ? h('div', { class: 'muted small' }, T`bis ${new Date(r.due + 'T00:00').toLocaleDateString(LOCALE)}`) : null,
      r.note ? h('p', { class: 'small' }, r.note) : null,
      h('ul', { class: 'review-people' }, r.people.map((p) => h('li', {},
        h('span', { class: 'avatar xs', style: { background: p.color } }, initials(p.name)),
        h('span', {}, p.name), ' ',
        h('span', { class: 'muted small' }, p.decision === 'approved' ? (p.outdated ? T('hat einen älteren Stand freigegeben') : T('hat freigegeben')) : p.decision === 'rejected' ? T('hat abgelehnt') : T('steht aus')),
        p.comment ? h('div', { class: 'small' }, p.comment) : null))),
      h('div', { class: 'row wrap' },
        mine && !app.guest ? h('button', { class: 'btn small primary', onclick: () => decide(r, 'approved') }, T('Freigeben')) : null,
        mine && !app.guest ? h('button', { class: 'btn small', onclick: () => decide(r, 'rejected') }, T('Ablehnen')) : null,
        manage && !app.viewOnly && r.status !== 'open' ? h('button', { class: 'btn small', onclick: () => send(() => api(`${base()}/${r.id}/restart`, { method: 'POST' }), T('Erneut vorgelegt')) }, T('Erneut vorlegen')) : null,
        manage && !app.viewOnly ? h('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmDialog(T('Freigabe entfernen'), T('Die Freigabe mit allen Entscheidungen wird gelöscht.'), T('Entfernen'), true)) send(() => api(`${base()}/${r.id}`, { method: 'DELETE' }));
        } }, T('Entfernen')) : null)));
  }
}

function toggleReviews(open) {
  if (open && currentSidePanel() === 'reviews') return renderSidePanel();
  toggleSidePanel('reviews');
}

app.on('reviewsChanged', loadReviews);
app.on('loaded', loadReviews);

app.on('renderPanel', (kind, side, close) => {
  if (kind === 'reviews') renderPanel(side, close);
});

app.on('ctxItems', (items, sel, { one, actBtn }) => {
  if (!one || !['frame', 'file'].includes(one.type) || app.viewOnly || app.guest || one.kind === 'topic') return;
  const r = app.reviews?.get(one.id);
  items.push(actBtn('check', r ? T('Freigabe anzeigen') : T('Freigabe anfordern'), () => (r ? toggleReviews(true) : requestReview(one))));
});
