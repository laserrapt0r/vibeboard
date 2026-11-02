// Prüfungen: Frames und Dateien Prüfenden vorlegen, Entscheidungen sammeln und den Stand sichtbar machen
import { T, LOCALE } from './i18n.js';
import { h, api, toast, modal, initials, confirmDialog } from './util.js';
import { app, getEl, fitTo, setSelection, scheduleRender, markDirty } from './core.js';
import { currentSidePanel, renderSidePanel, toggleSidePanel, boardPeople } from './ui.js';

const STATUS = {
  open: [T('In Prüfung'), 'warn'],
  approved: [T('Genehmigt'), 'ok'],
  rejected: [T('Abgelehnt'), 'bad'],
  outdated: [T('Geändert nach Prüfung'), 'warn'],
  missing: [T('Element gelöscht'), 'off'],
};
const base = () => `/api/boards/${encodeURIComponent(app.boardId)}/reviews`;
let focusId = null; // Prüfung, zu der gerade gesprungen wurde

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
    /* ohne Prüfungen weiterarbeiten */
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

const ROLE_NAME = { owner: T('Besitzer'), editor: T('Bearbeiten'), commenter: T('Kommentieren'), viewer: T('Ansehen') };

export async function requestReview(el) {
  // Entscheiden braucht mindestens das Recht zu kommentieren: Wer nur ansehen darf, ist sichtbar, aber nicht wählbar
  const people = (await api(`/api/boards/${app.boardId}/people?roles=1`)).people.filter((p) => !p.guest);
  const boxes = people.map((p) => ({ p, cb: h('input', { type: 'checkbox', value: p.id, disabled: p.role === 'viewer' }) }));
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
    try {
      await api(base(), { method: 'POST', body: { elementId: el.id, reviewers, note: note.value, due: due.value } });
    } catch (ex) {
      // Dialog bleibt offen, damit Hinweis und Datum nicht verloren gehen
      err.textContent = ex.message;
      return err.classList.remove('hidden');
    }
    toast(T('Prüfung angefordert'));
    await loadReviews();
    m.close();
    toggleReviews(true);
  } },
  h('fieldset', { class: 'plain' }, h('legend', {}, T('Prüfende Personen')),
    h('div', { class: 'check-grid' }, boxes.map((b) => h('label', { class: 'check' + (b.cb.disabled ? ' muted' : '') }, b.cb, b.p.displayName, h('span', { class: 'muted small' }, ' · ' + (ROLE_NAME[b.p.role] || '') + (b.cb.disabled ? T(' – kann nicht prüfen') : '')))))),
  h('label', {}, T('Hinweis an die Prüfenden (optional)'), note),
  h('label', {}, T('Bis wann (optional)'), due),
  err,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Anfordern'))));
  const m = modal(T`Prüfung anfordern: ${el.title || el.name || T('Frame')}`, form);
}

function decide(r, decision) {
  const comment = h('textarea', { rows: 3, maxlength: 2000, required: decision === 'rejected' });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    await send(() => api(`${base()}/${r.id}/decision`, { method: 'POST', body: { decision, comment: comment.value } }), decision === 'approved' ? T('Genehmigt') : T('Abgelehnt'));
    m.close();
  } },
  h('label', {}, decision === 'rejected' ? T('Begründung') : T('Anmerkung (optional)'), comment),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')),
    h('button', { type: 'submit', class: 'btn ' + (decision === 'rejected' ? 'danger' : 'primary') }, decision === 'approved' ? T('Genehmigen') : T('Ablehnen'))));
  const m = modal(decision === 'approved' ? T`„${r.title}“ genehmigen` : T`„${r.title}“ ablehnen`, form);
}

function restart(r) {
  const note = h('textarea', { rows: 3, maxlength: 2000 });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    await send(() => api(`${base()}/${r.id}/restart`, { method: 'POST', body: { note: note.value } }), T('Erneut vorgelegt'));
    m.close();
  } },
  h('p', { class: 'muted small' }, T('Die bisherigen Entscheidungen bleiben als frühere Runde sichtbar. Die Prüfenden entscheiden neu.')),
  h('label', {}, T('Hinweis an die Prüfenden (optional)'), note),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Erneut vorlegen'))));
  const m = modal(T`„${r.title || T('Ohne Titel')}“ erneut vorlegen`, form);
  note.focus();
}

const when = (t) => new Date(t).toLocaleDateString(LOCALE);

function pastRounds(r) {
  if (!r.rounds?.length) return null;
  return h('details', { class: 'review-rounds' }, h('summary', { class: 'small' }, r.rounds.length === 1 ? T('1 frühere Runde') : T`${r.rounds.length} frühere Runden`),
    r.rounds.map((o) => h('div', { class: 'review-round' },
      h('div', { class: 'muted small' }, o.closedBy ? T`Runde ${o.round} · ${when(o.closedAt)} erneut vorgelegt von ${o.closedBy}` : T`Runde ${o.round} · ${when(o.closedAt)} erneut vorgelegt`),
      o.note ? h('p', { class: 'small' }, o.note) : null,
      h('ul', { class: 'review-people' }, o.people.map((p) => h('li', {},
        h('span', { class: 'avatar xs', style: { background: p.color } }, initials(p.name)),
        h('span', {}, p.name), ' ',
        h('span', { class: 'muted small' }, p.decision === 'approved' ? T('hat genehmigt') : p.decision === 'rejected' ? T('hat abgelehnt') : T('hat nicht entschieden')),
        p.comment ? h('div', { class: 'small' }, p.comment) : null))))));
}

function renderPanel(side, close) {
  const list = [...(app.reviews?.values() || [])];
  side.append(h('div', { class: 'side-head' }, h('h3', {}, T('Prüfungen')), h('span', { class: 'spacer' }), close));
  if (!list.length) side.append(h('p', { class: 'muted pad' }, (app.viewOnly ? T('Noch keine Prüfungen.') : T('Noch keine Prüfungen. Wähle einen Frame oder eine Datei aus und fordere im Kontextmenü eine Prüfung an.'))));
  const me = String(app.user.id);
  for (const r of list) {
    const [label, cls] = STATUS[r.status];
    const mine = r.people.find((p) => p.id === me);
    const manage = r.byId === me || app.role === 'owner';
    const el = getEl(r.elementId);
    const item = h('section', { class: 'review-item' + (focusId === r.elementId ? ' focus' : ''), 'data-review': r.elementId },
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
        h('span', { class: 'muted small' }, p.decision === 'approved' ? (p.outdated ? T('hat einen älteren Stand genehmigt') : T('hat genehmigt')) : p.decision === 'rejected' ? T('hat abgelehnt') : T('steht aus')),
        p.comment ? h('div', { class: 'small' }, p.comment) : null))),
      pastRounds(r),
      h('div', { class: 'row wrap' },
        mine && !app.guest ? h('button', { class: 'btn small primary', onclick: () => decide(r, 'approved') }, T('Genehmigen')) : null,
        mine && !app.guest ? h('button', { class: 'btn small', onclick: () => decide(r, 'rejected') }, T('Ablehnen')) : null,
        manage && !app.viewOnly && r.status !== 'open' ? h('button', { class: 'btn small', onclick: () => restart(r) }, T('Erneut vorlegen')) : null,
        manage && !app.viewOnly ? h('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmDialog(T('Prüfung entfernen'), T('Die Prüfung mit allen Entscheidungen wird gelöscht.'), T('Entfernen'), true)) send(() => api(`${base()}/${r.id}`, { method: 'DELETE' }));
        } }, T('Entfernen')) : null));
    side.append(item);
    if (focusId === r.elementId) requestAnimationFrame(() => item.scrollIntoView({ block: 'nearest' }));
  }
}

function toggleReviews(open) {
  if (open && currentSidePanel() === 'reviews') return renderSidePanel();
  toggleSidePanel('reviews');
}

// Sprung aus „Meine Aufgaben“ oder einer Benachrichtigung: Panel auf, Element zeigen
async function jumpToReview(elementId) {
  await loadReviews();
  const r = app.reviews?.get(elementId);
  if (!r) return toast(T('Diese Prüfung gibt es nicht mehr oder du darfst sie nicht sehen.'), 5000);
  focusId = elementId;
  toggleReviews(true);
  const el = getEl(elementId);
  if (!el) return;
  setSelection([elementId]);
  fitTo({ x: el.x, y: el.y, w: el.w, h: el.h }, { pad: 60, maxZ: 2 });
}

function fromHash() {
  const m = /^#review=([\w-]{1,64})$/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  jumpToReview(m[1]);
}

let firstLoad = true;
app.on('reviewsChanged', loadReviews);
app.on('openReview', jumpToReview);
app.on('loaded', () => {
  loadReviews();
  if (firstLoad) fromHash();
  firstLoad = false;
});
window.addEventListener('hashchange', fromHash);

app.on('renderPanel', (kind, side, close) => {
  if (kind === 'reviews') renderPanel(side, close);
});

const reviewable = (el) => !!el && ['frame', 'file'].includes(el.type) && !app.viewOnly && !app.guest && el.kind !== 'topic';
const reviewLabel = (el) => (app.reviews?.get(el.id) ? T('Prüfung anzeigen') : T('Prüfung anfordern'));
const openReview = (el) => (app.reviews?.get(el.id) ? toggleReviews(true) : requestReview(el));

app.on('ctxItems', (items, sel, { one }) => {
  if (reviewable(one)) items.push({ label: reviewLabel(one), icon: 'check', group: 'collab', onClick: () => openReview(one) });
});
