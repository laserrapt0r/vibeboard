// Teilen-Dialog: Link-Freigabe und Mitglieder eines Boards verwalten
import { h, api, modal, toast, initials, debounce, confirmDialog } from './util.js';

const LINK_OPTIONS = [
  ['private', '🔒 Nur eingeladene Personen'],
  ['view', '👁️ Alle angemeldeten Nutzer mit dem Link können ansehen'],
  ['edit', '✏️ Alle angemeldeten Nutzer mit dem Link können bearbeiten'],
];

export async function openShareDialog(boardId, { me, onLeave } = {}) {
  const body = h('div', { class: 'form share' });
  const m = modal('Board teilen', body);
  const url = `${location.origin}/board/${boardId}`;

  async function render() {
    let info;
    try {
      info = await api(`/api/boards/${boardId}/members`);
    } catch (e) {
      body.textContent = e.message;
      return;
    }
    const owner = info.myRole === 'owner';
    body.innerHTML = '';

    // Link
    const linkInput = h('input', { type: 'text', value: url, readonly: true, onclick: (e) => e.target.select() });
    body.append(h('label', {}, 'Link zum Board', h('div', { class: 'copy-row' }, linkInput, h('button', { type: 'button', class: 'btn', onclick: async () => {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        linkInput.select();
        document.execCommand('copy');
      }
      toast('Link kopiert');
    } }, 'Kopieren'))));

    const access = h('select', { disabled: !owner, onchange: async (e) => {
      try {
        await api(`/api/boards/${boardId}`, { method: 'PATCH', body: { linkAccess: e.target.value } });
        info.linkAccess = e.target.value;
        toast('Freigabe geändert');
      } catch (ex) {
        e.target.value = info.linkAccess;
        toast(ex.message);
      }
    } }, LINK_OPTIONS.map(([v, l]) => h('option', { value: v, selected: v === info.linkAccess }, l)));
    body.append(h('label', {}, 'Wer hat über den Link Zugriff?', access));

    // Einladen
    if (owner) {
      const input = h('input', { type: 'text', placeholder: 'Name oder E-Mail', autocomplete: 'off' });
      const role = h('select', {}, h('option', { value: 'editor' }, 'darf bearbeiten'), h('option', { value: 'viewer' }, 'darf ansehen'));
      const notify = h('input', { type: 'checkbox', checked: true });
      const suggest = h('div', { class: 'suggest hidden' });
      const search = debounce(async () => {
        const q = input.value.trim();
        if (!q) return suggest.classList.add('hidden');
        const list = await api('/api/users/search?q=' + encodeURIComponent(q)).catch(() => []);
        suggest.innerHTML = '';
        list.filter((u) => u.id !== info.owner?.id && !info.members.some((x) => x.id === u.id)).forEach((u) => suggest.append(h('button', {
          type: 'button', class: 'suggest-item', onclick: () => {
            input.value = u.username;
            suggest.classList.add('hidden');
          },
        }, h('span', { class: 'avatar xs', style: { background: u.color } }, initials(u.displayName)), h('span', {}, u.displayName), h('span', { class: 'muted small' }, '@' + u.username))));
        suggest.classList.toggle('hidden', !suggest.childElementCount);
      }, 200);
      input.addEventListener('input', search);
      const invite = async (e) => {
        e.preventDefault();
        if (!input.value.trim()) return;
        try {
          const r = await api(`/api/boards/${boardId}/members`, { method: 'POST', body: { user: input.value.trim(), role: role.value, notify: notify.checked } });
          toast(r.mailed ? 'Eingeladen – E-Mail wurde verschickt' : 'Eingeladen');
          render();
        } catch (ex) {
          toast(ex.message);
        }
      };
      body.append(h('form', { class: 'invite', onsubmit: invite },
        h('div', { class: 'label' }, 'Personen einladen'),
        h('div', { class: 'invite-row' }, h('div', { class: 'suggest-wrap' }, input, suggest), role, h('button', { type: 'submit', class: 'btn primary' }, 'Einladen')),
        h('label', { class: 'check' }, notify, 'Per E-Mail benachrichtigen (falls hinterlegt)')));
    }

    // Mitglieder
    const row = (u, roleLabel, controls) => h('div', { class: 'member' },
      h('span', { class: 'avatar sm', style: { background: u.color } }, initials(u.displayName)),
      h('div', { class: 'member-name' }, h('b', {}, u.displayName + (me && u.id === me.id ? ' (du)' : '')), h('span', { class: 'muted small' }, '@' + u.username)),
      controls || h('span', { class: 'muted small' }, roleLabel));
    const list = h('div', { class: 'members' });
    if (info.owner) list.append(row(info.owner, 'Besitzer'));
    for (const mem of info.members) {
      let controls = null;
      if (owner) {
        controls = h('div', { class: 'row' },
          h('select', { onchange: async (e) => {
            try {
              await api(`/api/boards/${boardId}/members/${mem.id}`, { method: 'PATCH', body: { role: e.target.value } });
              mem.role = e.target.value;
              toast('Rolle geändert');
            } catch (ex) {
              e.target.value = mem.role;
              toast(ex.message);
            }
          } }, h('option', { value: 'editor', selected: mem.role === 'editor' }, 'bearbeiten'), h('option', { value: 'viewer', selected: mem.role === 'viewer' }, 'ansehen')),
          h('button', { type: 'button', class: 'btn small', title: 'Entfernen', onclick: async () => {
            try {
              await api(`/api/boards/${boardId}/members/${mem.id}`, { method: 'DELETE' });
              render();
            } catch (ex) {
              toast(ex.message);
            }
          } }, 'Entfernen'));
      } else if (me && mem.id === me.id) {
        controls = h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
          if (!(await confirmDialog('Board verlassen', 'Du verlierst den Zugriff auf dieses Board, bis du erneut eingeladen wirst.', 'Verlassen', true))) return;
          try {
            await api(`/api/boards/${boardId}/members/${mem.id}`, { method: 'DELETE' });
            m.close();
            onLeave ? onLeave() : (location.href = '/');
          } catch (ex) {
            toast(ex.message);
          }
        } }, 'Board verlassen');
      }
      list.append(row(mem, mem.role === 'editor' ? 'darf bearbeiten' : 'darf ansehen', controls));
    }
    body.append(h('div', {}, h('div', { class: 'label' }, `Mitglieder (${info.members.length + (info.owner ? 1 : 0)})`), list));

    // Hinweis auf Netzwerkadressen, falls lokal geöffnet
    if (/^(localhost|127\.)/.test(location.hostname)) {
      const lan = (await api('/api/info').catch(() => ({}))).addresses || [];
      if (lan.length) body.append(h('div', { class: 'hint' }, h('b', {}, 'Im lokalen Netzwerk erreichbar unter:'),
        ...lan.map((a) => h('code', {}, `http://${a}:${location.port || 80}/board/${boardId}`))));
    }
  }

  await render();
  return m;
}
