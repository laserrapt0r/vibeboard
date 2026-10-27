// Teilen-Dialog: Link-Freigabe und Mitglieder eines Boards verwalten
import { h, api, modal, toast, initials, debounce, confirmDialog, ICONS } from './util.js';

const LINK_OPTIONS = [
  ['private', '🔒 Nur eingeladene Personen'],
  ['view', '👁️ Alle angemeldeten Nutzer mit dem Link können ansehen'],
  ['comment', '💬 Alle angemeldeten Nutzer mit dem Link können kommentieren'],
  ['edit', '✏️ Alle angemeldeten Nutzer mit dem Link können bearbeiten'],
];
const ROLE_OPTIONS = [['editor', 'bearbeiten'], ['commenter', 'kommentieren'], ['viewer', 'ansehen']];
const ROLE_TEXT = { editor: 'darf bearbeiten', commenter: 'darf kommentieren', viewer: 'darf ansehen' };
const roleSelect = (cur, onchange) => h('select', { onchange }, ROLE_OPTIONS.map(([v, l]) => h('option', { value: v, selected: v === cur }, l)));

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
      const role = h('select', {}, ROLE_OPTIONS.map(([v]) => h('option', { value: v }, ROLE_TEXT[v])));
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
          roleSelect(mem.role, async (e) => {
            try {
              await api(`/api/boards/${boardId}/members/${mem.id}`, { method: 'PATCH', body: { role: e.target.value } });
              mem.role = e.target.value;
              toast('Rolle geändert');
            } catch (ex) {
              e.target.value = mem.role;
              toast(ex.message);
            }
          }),
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
      list.append(row(mem, ROLE_TEXT[mem.role] || mem.role, controls));
    }
    body.append(h('div', {}, h('div', { class: 'label' }, `Mitglieder (${info.members.length + (info.owner ? 1 : 0)})`), list));

    if (owner) {
      await teamSection(body, boardId);
      await guestSection(body, boardId);
    }

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

// Team: Board für alle Mitglieder eines Teams freigeben (mit einer Rolle für das ganze Team)
async function teamSection(body, boardId) {
  let meta, teams;
  try {
    [meta, { teams }] = await Promise.all([api(`/api/boards/${boardId}`), api('/api/teams')]);
  } catch {
    return;
  }
  const cur = meta.team;
  if (!teams.length && !cur) {
    body.append(h('div', { class: 'share-block' }, h('div', { class: 'label' }, 'Team'), h('p', { class: 'muted small' }, 'Du bist in keinem Team. Teams legst du in der Übersicht links unter „Teams“ an – dann gelten Rechte für alle Mitglieder auf einmal.')));
    return;
  }
  const team = h('select', {}, h('option', { value: '' }, '– keinem Team zugeordnet –'), teams.map((t) => h('option', { value: t.id, selected: cur && cur.id === t.id }, t.name)));
  const role = roleSelect(cur ? cur.role : 'editor');
  const save = async () => {
    try {
      await api(`/api/boards/${boardId}`, { method: 'PATCH', body: { teamId: team.value || null, teamRole: role.value } });
      toast(team.value ? 'Board für das Team freigegeben' : 'Team-Zuordnung entfernt');
    } catch (ex) {
      toast(ex.message);
    }
  };
  team.onchange = save;
  role.onchange = () => team.value && save();
  body.append(h('div', { class: 'share-block' }, h('div', { class: 'label' }, 'Team'),
    h('div', { class: 'row' }, team, h('span', { class: 'muted small' }, 'alle Mitglieder dürfen'), role)));
}

// Gastlinks: Zugang ohne Konto, befristet, nur ansehen oder kommentieren
async function guestSection(body, boardId) {
  let info;
  try {
    info = await api(`/api/boards/${boardId}/guest-links`);
  } catch {
    return;
  }
  const box = h('div', { class: 'share-block' }, h('div', { class: 'label' }, 'Gastlinks (ohne Konto)'));
  body.append(box);
  if (!info.enabled) {
    box.append(h('p', { class: 'muted small' }, 'Der Gastzugang ist in dieser Installation abgeschaltet. Ein Administrator kann ihn unter „Einstellungen → Zusammenarbeit“ einschalten.'));
    return;
  }
  const role = h('select', {}, h('option', { value: 'commenter' }, 'darf kommentieren'), h('option', { value: 'viewer' }, 'darf ansehen'));
  const days = h('select', {}, [[1, '1 Tag'], [7, '7 Tage'], [14, '14 Tage'], [30, '30 Tage']].map(([d, l]) => h('option', { value: d, selected: d === 7 }, l)));
  const label = h('input', { type: 'text', maxlength: 80, placeholder: 'Bezeichnung, z. B. „Workshop Kunde“' });
  const result = h('div');
  const list = h('div', { class: 'guest-links' });
  const renderList = (links) => {
    list.innerHTML = '';
    for (const l of links.filter((x) => !x.revoked)) {
      list.append(h('div', { class: 'member' },
        h('span', { class: 'avatar sm guest', html: ICONS.guest }),
        h('div', { class: 'member-name' }, h('b', {}, l.label || 'Gastlink'),
          h('span', { class: 'muted small' }, `${ROLE_TEXT[l.role]} · ${l.expired ? 'abgelaufen' : 'gültig bis ' + new Date(l.expiresAt).toLocaleDateString('de-DE')} · ${l.guests} Gast/Gäste`)),
        h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
          if (!(await confirmDialog('Gastlink sperren', 'Der Link funktioniert danach nicht mehr, und alle darüber angemeldeten Gäste verlieren sofort den Zugriff.', 'Sperren', true))) return;
          try {
            await api(`/api/boards/${boardId}/guest-links/${l.id}`, { method: 'DELETE' });
            renderList((await api(`/api/boards/${boardId}/guest-links`)).links);
          } catch (ex) {
            toast(ex.message);
          }
        } }, 'Sperren')));
    }
  };
  renderList(info.links);
  box.append(
    h('p', { class: 'muted small' }, 'Gäste geben nur ihren Namen an und sehen ausschließlich dieses Board. Der Link läuft automatisch ab; danach werden die Gastzugänge gelöscht.'),
    h('div', { class: 'row wrap' }, role, days, label, h('button', { type: 'button', class: 'btn', onclick: async () => {
      try {
        const r = await api(`/api/boards/${boardId}/guest-links`, { method: 'POST', body: { role: role.value, days: Number(days.value), label: label.value } });
        const url = `${location.origin}/g/${r.token}`;
        const input = h('input', { type: 'text', value: url, readonly: true, onclick: (e) => e.target.select() });
        result.innerHTML = '';
        result.append(h('div', { class: 'hint' }, h('b', {}, 'Neuer Gastlink – jetzt kopieren, er wird nur einmal angezeigt:'),
          h('div', { class: 'copy-row' }, input, h('button', { type: 'button', class: 'btn', onclick: async () => {
            try {
              await navigator.clipboard.writeText(url);
            } catch {
              input.select();
              document.execCommand('copy');
            }
            toast('Gastlink kopiert');
          } }, 'Kopieren'))));
        label.value = '';
        renderList((await api(`/api/boards/${boardId}/guest-links`)).links);
      } catch (ex) {
        toast(ex.message);
      }
    } }, 'Gastlink erstellen')),
    result, list);
}
