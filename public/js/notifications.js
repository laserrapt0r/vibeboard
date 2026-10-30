// Benachrichtigungen (Glocke): Erwähnungen, Antworten und zugewiesene Kommentare – auf der Startseite und im Board
import { T, guestName } from './i18n.js';
import { h, api, ICONS, relTime, toast, initials } from './util.js';
import { popover, closePop } from './menu.js';

const KIND = { mention: T('hat dich erwähnt'), reply: T('hat geantwortet'), task: T('hat dir einen Kommentar zugewiesen'), team_invite: T('lädt dich in ein Team ein') };

let state = { unread: 0, items: [] };
const buttons = new Set();

function paint() {
  for (const b of buttons) {
    const badge = b.querySelector('.bell-badge');
    badge.textContent = state.unread > 99 ? '99+' : String(state.unread);
    badge.classList.toggle('hidden', !state.unread);
    b.title = state.unread === 1 ? T('1 ungelesene Benachrichtigung') : state.unread ? T`${state.unread} ungelesene Benachrichtigungen` : T('Benachrichtigungen');
  }
}

export async function refresh() {
  try {
    state = await api('/api/notifications', { quiet: true });
    paint();
  } catch {
    /* z. B. abgemeldet */
  }
}

export async function markRead(body) {
  try {
    state = await api('/api/notifications/read', { method: 'POST', body });
    paint();
  } catch {
    /* ohne Bedeutung für die Bedienung */
  }
}

// Live-Benachrichtigung (im Board per Echtzeit-Kanal)
export function push(item, { onOpen } = {}) {
  state = { unread: state.unread + 1, items: [item, ...state.items].slice(0, 50) };
  paint();
  toast(T`🔔 ${guestName(item.actor)} ${KIND[item.kind] || ''}: „${String(item.excerpt).slice(0, 80)}“`, 6000, onOpen ? { label: T('Öffnen'), onClick: () => onOpen(item) } : undefined);
}

// open(item): Navigation zum Kommentar (im Board ggf. ohne Neuladen)
export function bellButton({ open } = {}) {
  const b = h('button', { class: 'icon-btn bell', title: T('Benachrichtigungen'), 'aria-label': T('Benachrichtigungen') },
    h('span', { html: ICONS.bell }), h('span', { class: 'bell-badge hidden' }, '0'));
  buttons.add(b);
  b.onclick = async () => {
    await refresh();
    const list = h('div', { class: 'notif-list' });
    if (!state.items.length) list.append(h('p', { class: 'muted pad' }, T('Keine Benachrichtigungen. Hier erscheint, wenn dich jemand in einem Kommentar @erwähnt, dir antwortet, dir einen Kommentar zuweist oder in ein Team einlädt.')));
    for (const n of state.items) {
      list.append(h('button', { class: 'notif-item' + (n.read ? '' : ' unread'), onclick: () => {
        closePop();
        markRead({ ids: [n.id] });
        (open || defaultOpen)(n);
      } },
      h('span', { class: 'avatar xs' }, initials(n.actor || '?')),
      h('span', { class: 'notif-main' },
        h('span', {}, h('b', {}, guestName(n.actor)), ' ', KIND[n.kind] || ''),
        h('span', { class: 'notif-excerpt' }, n.excerpt),
        h('span', { class: 'muted small' }, `${n.teamId ? T('Team') : n.boardName || T('Board')} · ${relTime(n.createdAt)}`))));
    }
    popover(b, h('div', { class: 'notif-pop' },
      h('div', { class: 'notif-head' }, h('b', {}, T('Benachrichtigungen')), h('span', { class: 'spacer' }),
        state.unread ? h('button', { class: 'btn small', onclick: async () => { await markRead({ all: true }); closePop(); } }, T('Alle als gelesen markieren')) : null),
      list,
      h('div', { class: 'muted small pad' }, T('E-Mail-Benachrichtigungen lassen sich im Profil abschalten.'))), { placement: 'bottom' });
  };
  paint();
  return b;
}

// Team-Einladungen werden auf der Startseite angenommen oder abgelehnt
export function openTeamInvite() {
  if (location.pathname === '/' && location.hash === '#einladungen') window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.href = '/#einladungen';
}

function defaultOpen(n) {
  if (n.teamId) return openTeamInvite();
  if (n.boardId) location.href = `/board/${encodeURIComponent(n.boardId)}${n.elementId ? '#el=' + encodeURIComponent(n.elementId) : ''}`;
}
