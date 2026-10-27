// Moderation: Bearbeiten für Teilnehmende sperren, Werkzeuge (Timer, Abstimmung, Schätzrunde, privater Modus,
// „Alle zu mir“) den Moderierenden vorbehalten, Elemente für Teilnehmende sperren. Der Server prüft alles.
import { h, append, ICONS, toast } from './util.js';
import { app, setTool, finishEdit, setSelection, scheduleRender } from './core.js';
import { menu, rebuildTools } from './ui.js';

const banner = h('div', { id: 'moderation-banner', class: 'panel chrome hidden', role: 'status' });
document.body.append(banner);
let wasLocked = false;
let wasActive = null;

const mod = () => (app.session.moderation && app.session.moderation.active ? app.session.moderation : null);
const myId = () => String(app.user.id);

export function isFacilitator() {
  const m = mod();
  return app.role === 'owner' || !!(m && (m.facilitators || []).includes(myId()));
}

// Sind Werkzeuge wie Timer oder Abstimmung gerade den Moderierenden vorbehalten?
export function toolsReserved() {
  const m = mod();
  return !!(m && m.reserveTools) && !isFacilitator();
}

export function setModeration(patch) {
  app.sync.op({ op: 'moderation', ...patch });
}

function apply() {
  const m = mod();
  app.isFacilitator = isFacilitator();
  const locked = !!(m && m.editLock) && !app.isFacilitator;
  if (locked !== wasLocked) {
    wasLocked = locked;
    // Bearbeitungssperre: wie „nur ansehen“ – Kommentieren, Abstimmen und Schätzen bleiben möglich
    app.viewOnly = locked || app.baseViewOnly;
    if (app.sync) app.sync.viewOnly = app.viewOnly;
    if (locked) {
      finishEdit();
      setTool('select');
      setSelection([]);
    }
    document.body.classList.toggle('edit-locked', locked);
    rebuildTools();
  }
  if (wasActive !== null && !!m !== wasActive) toast(m ? `${m.by || 'Jemand'} hat die Moderation gestartet` : 'Moderation beendet', 3500);
  wasActive = !!m;
  document.getElementById('btn-moderation')?.classList.toggle('active', !!m);
  banner.classList.toggle('hidden', !m);
  banner.innerHTML = '';
  if (m) {
    const names = (m.facilitators || []).map((id) => (id === myId() ? 'du' : [...app.peers.values()].find((p) => p.userId === id)?.name)).filter(Boolean);
    append(banner,
      h('span', { class: 'pm-icon', html: ICONS.shield }),
      h('span', {}, h('b', {}, 'Moderation'), names.length ? ` · ${names.join(', ')}` : '',
        locked ? h('span', { class: 'mod-chip' }, '🔒 Bearbeiten gesperrt') : m.editLock ? h('span', { class: 'mod-chip' }, '🔒 Teilnehmende können nicht bearbeiten') : null,
        m.reserveTools ? h('span', { class: 'muted small' }, ' · Timer, Abstimmung & Co. nur für Moderierende') : null));
  }
  scheduleRender(true);
  app.emit('moderation');
}

app.on('session', (kind) => {
  if (kind === 'all' || kind === 'moderation') apply();
});
app.on('peers', () => mod() && apply());

function openMenu(anchor) {
  const m = mod();
  if (!m) {
    if (app.viewOnly) return toast('Moderieren kann, wer das Board bearbeiten darf');
    menu(anchor, [
      { header: 'Moderation' },
      { label: 'Moderation starten', icon: 'shield', onClick: () => setModeration({ active: true }) },
      { label: 'Starten und Bearbeiten sofort sperren', icon: 'lock', onClick: () => setModeration({ active: true, editLock: true }) },
    ]);
    return;
  }
  if (!app.isFacilitator) {
    menu(anchor, [{ header: `Moderation läuft (${m.by || 'jemand'})` }, { label: 'Nur Moderierende können die Einstellungen ändern', disabled: true }]);
    return;
  }
  menu(anchor, [
    { header: 'Moderation' },
    { label: m.editLock ? 'Bearbeiten wieder freigeben' : 'Bearbeiten für Teilnehmende sperren', icon: m.editLock ? 'unlock' : 'lock', onClick: () => setModeration({ editLock: !m.editLock }) },
    { label: m.reserveTools ? 'Werkzeuge für alle freigeben' : 'Timer, Abstimmung & Co. nur für Moderierende', icon: 'timer', onClick: () => setModeration({ reserveTools: !m.reserveTools }) },
    { label: 'Elemente sperren: auswählen → Schild-Symbol', icon: 'shield', disabled: true },
    '-',
    { label: 'Moderation beenden', icon: 'close', danger: true, onClick: () => setModeration({ active: false }) },
  ]);
}

app.on('buildCollabTools', (box) => {
  // Moderieren kann nur, wer bearbeiten darf
  if (app.guest || app.baseViewOnly) return;
  const b = h('button', { class: 'icon-btn', id: 'btn-moderation', title: 'Moderation', html: ICONS.shield });
  b.onclick = () => openMenu(b);
  box.prepend(b);
});

// Einträge im Menü einer teilnehmenden Person (Avatar)
export function facilitatorItems(p) {
  const m = mod();
  if (!m || !app.isFacilitator || !p.userId || p.guest) return [];
  const is = (m.facilitators || []).includes(p.userId);
  return [{ label: is ? 'Aus der Moderation entfernen' : 'Zur Moderation hinzufügen', icon: 'shield', onClick: () => setModeration(is ? { removeFacilitator: p.userId } : { addFacilitator: p.userId }) }];
}

const REASONS = {
  editLock: 'Die Moderation hat das Bearbeiten gerade gesperrt.',
  modLock: 'Dieses Element hat die Moderation für Teilnehmende gesperrt.',
  reserved: 'Das ist während der Moderation den Moderierenden vorbehalten.',
};
let lastBlocked = 0;
app.on('blocked', (why) => {
  if (Date.now() - lastBlocked < 3000) return;
  lastBlocked = Date.now();
  toast(REASONS[why] || 'Die Änderung wurde abgelehnt.', 4000);
});
