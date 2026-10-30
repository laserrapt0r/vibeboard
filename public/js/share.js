// Teilen-Dialog: Link-Freigabe und Mitglieder eines Boards verwalten
import { T, LOCALE } from './i18n.js';
import { h, api, modal, toast, initials, confirmDialog, relTime, ICONS } from './util.js';

const LINK_OPTIONS = [
  ['private', T('🔒 Nur eingeladene Personen')],
  ['view', T('👁️ Alle angemeldeten Nutzer mit dem Link können ansehen')],
  ['comment', T('💬 Alle angemeldeten Nutzer mit dem Link können kommentieren')],
  ['edit', T('✏️ Alle angemeldeten Nutzer mit dem Link können bearbeiten')],
];
const ROLE_OPTIONS = [['editor', T('bearbeiten')], ['commenter', T('kommentieren')], ['viewer', T('ansehen')]];
const ROLE_TEXT = { editor: T('darf bearbeiten'), commenter: T('darf kommentieren'), viewer: T('darf ansehen') };
const roleSelect = (cur, onchange) => h('select', { onchange }, ROLE_OPTIONS.map(([v, l]) => h('option', { value: v, selected: v === cur }, l)));

// onClose: z. B. Startseite neu laden, damit Team, Freigabe und Mitglieder sofort stimmen
export async function openShareDialog(boardId, { me, onLeave, onClose } = {}) {
  const body = h('div', { class: 'form share' });
  const m = modal(T('Board teilen'), body, { onClose });
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
    body.append(h('label', {}, T('Link zum Board'), h('div', { class: 'copy-row' }, linkInput, h('button', { type: 'button', class: 'btn', onclick: async () => {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        linkInput.select();
        document.execCommand('copy');
      }
      toast(T('Link kopiert'));
    } }, T('Kopieren')))));

    const access = h('select', { disabled: !owner, onchange: async (e) => {
      try {
        await api(`/api/boards/${boardId}`, { method: 'PATCH', body: { linkAccess: e.target.value } });
        info.linkAccess = e.target.value;
        toast(T('Freigabe geändert'));
      } catch (ex) {
        e.target.value = info.linkAccess;
        toast(ex.message);
      }
    } }, LINK_OPTIONS.map(([v, l]) => h('option', { value: v, selected: v === info.linkAccess }, l)));
    body.append(h('label', {}, T('Wer hat über den Link Zugriff?'), access));

    // Einladen: über die genaue E-Mail-Adresse oder aus den eigenen Teams – eine Suche über alle Nutzenden gibt es nicht
    if (owner) {
      const input = h('input', { type: 'email', placeholder: T('E-Mail-Adresse'), autocomplete: 'off', inputmode: 'email' });
      const role = h('select', {}, ROLE_OPTIONS.map(([v]) => h('option', { value: v }, ROLE_TEXT[v])));
      const notify = h('input', { type: 'checkbox', checked: true });
      const add = async (body) => {
        try {
          const r = await api(`/api/boards/${boardId}/members`, { method: 'POST', body: { ...body, role: role.value, notify: notify.checked } });
          toast(r.invited ? T('Einladung verschickt – nach der Registrierung ist das Board geteilt') : r.mailed ? T('Eingeladen – E-Mail wurde verschickt') : T('Eingeladen'), 4000);
          render();
        } catch (ex) {
          // Adresse ohne Konto: erst nachfragen, dann zur Registrierung einladen
          if (ex.code === 'not_registered' && !body.inviteUnregistered) {
            if (await confirmDialog(T('Keine registrierte Adresse'), T`${body.email} ist nicht registriert. Soll eine Einladung per E-Mail verschickt werden? Nach der Registrierung ist das Board automatisch mit der Person geteilt.`, T('Einladung verschicken'))) add({ ...body, inviteUnregistered: true });
            return;
          }
          toast(ex.message, 5000);
        }
      };
      const invite = (e) => {
        e.preventDefault();
        if (input.value.trim()) add({ email: input.value.trim() });
      };
      const teamBox = h('div', { class: 'share-candidates' });
      body.append(h('form', { class: 'invite', onsubmit: invite },
        h('div', { class: 'label' }, T('Personen einladen')),
        h('div', { class: 'invite-row' }, input, role, h('button', { type: 'submit', class: 'btn primary' }, T('Einladen'))),
        h('label', { class: 'check' }, notify, T('Per E-Mail benachrichtigen')),
        teamBox));
      // Vorschläge: Personen aus gemeinsamen Teams
      api(`/api/boards/${boardId}/share-candidates`).then(({ candidates }) => {
        if (!candidates.length) return;
        const list = h('div', { class: 'candidate-list' });
        for (const c of candidates) {
          list.append(h('button', { type: 'button', class: 'candidate', title: T`Team: ${c.teams.join(', ')}`, onclick: () => add({ userId: c.id }) },
            h('span', { class: 'avatar xs', style: { background: c.color } }, initials(c.displayName)),
            h('span', { class: 'candidate-name' }, c.displayName, h('span', { class: 'muted small' }, T('Team: ') + c.teams.join(', '))),
            h('span', { class: 'muted small' }, T('+ einladen'))));
        }
        teamBox.append(h('div', { class: 'label' }, T('Aus deinen Teams')), list);
      }).catch(() => {});
    }

    // Mitglieder
    const row = (u, roleLabel, controls) => h('div', { class: 'member' },
      h('span', { class: 'avatar sm', style: { background: u.color } }, initials(u.displayName)),
      h('div', { class: 'member-name' }, h('b', {}, u.displayName + (me && u.id === me.id ? T(' (du)') : '')), u.email ? h('span', { class: 'muted small' }, u.email) : null),
      controls || h('span', { class: 'muted small' }, roleLabel));
    const list = h('div', { class: 'members' });
    if (info.owner) list.append(row(info.owner, T('Besitzer')));
    // Eingeladene Adressen ohne Konto
    for (const p of info.pending || []) {
      list.append(h('div', { class: 'member' },
        h('span', { class: 'avatar sm' }, '✉'),
        h('div', { class: 'member-name' }, h('b', {}, p.email), h('span', { class: 'muted small' }, T`Einladung verschickt · noch nicht registriert · ${relTime(p.createdAt)}`)),
        h('button', { class: 'btn small', onclick: async () => {
          await api(`/api/boards/${boardId}/pending/${p.id}`, { method: 'DELETE' }).catch((e) => toast(e.message));
          render();
        } }, T('Zurückziehen'))));
    }
    for (const mem of info.members) {
      let controls = null;
      if (owner) {
        controls = h('div', { class: 'row' },
          roleSelect(mem.role, async (e) => {
            try {
              await api(`/api/boards/${boardId}/members/${mem.id}`, { method: 'PATCH', body: { role: e.target.value } });
              mem.role = e.target.value;
              toast(T('Rolle geändert'));
            } catch (ex) {
              e.target.value = mem.role;
              toast(ex.message);
            }
          }),
          h('button', { type: 'button', class: 'btn small', title: T('Entfernen'), onclick: async () => {
            try {
              await api(`/api/boards/${boardId}/members/${mem.id}`, { method: 'DELETE' });
              render();
            } catch (ex) {
              toast(ex.message);
            }
          } }, T('Entfernen')));
      } else if (me && mem.id === me.id) {
        controls = h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
          if (!(await confirmDialog(T('Board verlassen'), T('Du verlierst den Zugriff auf dieses Board, bis du erneut eingeladen wirst.'), T('Verlassen'), true))) return;
          try {
            await api(`/api/boards/${boardId}/members/${mem.id}`, { method: 'DELETE' });
            m.close();
            onLeave ? onLeave() : (location.href = '/');
          } catch (ex) {
            toast(ex.message);
          }
        } }, T('Board verlassen'));
      }
      list.append(row(mem, ROLE_TEXT[mem.role] || mem.role, controls));
    }
    body.append(h('div', {}, h('div', { class: 'label' }, T`Mitglieder (${info.members.length + (info.owner ? 1 : 0)})`), list));

    if (owner) {
      await teamSection(body, boardId);
      await guestSection(body, boardId);
    }

    // Hinweis auf Netzwerkadressen, falls lokal geöffnet
    if (/^(localhost|127\.)/.test(location.hostname)) {
      const lan = (await api('/api/info').catch(() => ({}))).addresses || [];
      if (lan.length) body.append(h('div', { class: 'hint' }, h('b', {}, T('Im lokalen Netzwerk erreichbar unter:')),
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
    body.append(h('div', { class: 'share-block' }, h('div', { class: 'label' }, T('Team')), h('p', { class: 'muted small' }, T('Du bist in keinem Team. Teams legst du in der Übersicht links unter „Teams“ an – dann gelten Rechte für alle Mitglieder auf einmal.'))));
    return;
  }
  // Zugeordnetes Team, in dem man selbst nicht (mehr) Mitglied ist, trotzdem anzeigen
  const foreign = cur && !teams.some((t) => t.id === cur.id) ? [h('option', { value: cur.id, selected: true }, T`${cur.name} (du bist kein Mitglied)`)] : [];
  const team = h('select', {}, h('option', { value: '' }, T('– keinem Team zugeordnet –')), foreign, teams.map((t) => h('option', { value: t.id, selected: cur && cur.id === t.id }, t.name)));
  const role = roleSelect(cur ? cur.role : 'editor');
  const save = async () => {
    try {
      await api(`/api/boards/${boardId}`, { method: 'PATCH', body: { teamId: team.value || null, teamRole: role.value } });
      toast(team.value ? T('Board für das Team freigegeben') : T('Team-Zuordnung entfernt'));
    } catch (ex) {
      toast(ex.message);
    }
  };
  team.onchange = save;
  role.onchange = () => team.value && save();
  body.append(h('div', { class: 'share-block' }, h('div', { class: 'label' }, T('Team')),
    h('div', { class: 'row' }, team, h('span', { class: 'muted small' }, T('alle Mitglieder dürfen')), role)));
}

// Gastlinks: Zugang ohne Konto, befristet, nur ansehen oder kommentieren
async function guestSection(body, boardId) {
  let info, maxDays = 30;
  try {
    [info, { features: { guestMaxDays: maxDays = 30 } = {} }] = await Promise.all([api(`/api/boards/${boardId}/guest-links`), api(`/api/boards/${boardId}`)]);
  } catch {
    return;
  }
  const box = h('div', { class: 'share-block' }, h('div', { class: 'label' }, T('Gastlinks (ohne Konto)')));
  body.append(box);
  if (!info.enabled) {
    box.append(h('p', { class: 'muted small' }, T('Der Gastzugang ist in dieser Installation abgeschaltet. Ein Administrator kann ihn unter „Einstellungen → Zusammenarbeit“ einschalten.')));
    return;
  }
  const role = h('select', {}, h('option', { value: 'commenter' }, T('darf kommentieren')), h('option', { value: 'viewer' }, T('darf ansehen')));
  // Nur Laufzeiten bis zur Grenze der Administration anbieten
  const choices = [...new Set([1, 7, 14, 30, maxDays].filter((d) => d <= maxDays))].sort((a, b) => a - b);
  const days = h('select', {}, choices.map((d) => h('option', { value: d, selected: d === Math.min(7, maxDays) }, d === 1 ? T('1 Tag') : T`${d} Tage`)));
  const label = h('input', { type: 'text', maxlength: 80, placeholder: T('Bezeichnung, z. B. „Workshop Kunde“') });
  const result = h('div');
  const list = h('div', { class: 'guest-links' });
  const renderList = (links) => {
    list.innerHTML = '';
    for (const l of links.filter((x) => !x.revoked)) {
      list.append(h('div', { class: 'member' },
        h('span', { class: 'avatar sm guest', html: ICONS.guest }),
        h('div', { class: 'member-name' }, h('b', {}, l.label || T('Gastlink')),
          h('span', { class: 'muted small' }, T`${ROLE_TEXT[l.role]} · ${l.expired ? T('abgelaufen') : T('gültig bis ') + new Date(l.expiresAt).toLocaleDateString(LOCALE)} · ${l.guests} Gast/Gäste`)),
        h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
          if (!(await confirmDialog(T('Gastlink sperren'), T('Der Link funktioniert danach nicht mehr, und alle darüber angemeldeten Gäste verlieren sofort den Zugriff.'), T('Sperren'), true))) return;
          try {
            await api(`/api/boards/${boardId}/guest-links/${l.id}`, { method: 'DELETE' });
            renderList((await api(`/api/boards/${boardId}/guest-links`)).links);
          } catch (ex) {
            toast(ex.message);
          }
        } }, T('Sperren'))));
    }
  };
  renderList(info.links);
  box.append(
    h('p', { class: 'muted small' }, T('Gäste geben nur ihren Namen an und sehen ausschließlich dieses Board. Der Link läuft automatisch ab; danach werden die Gastzugänge gelöscht.')),
    h('div', { class: 'row wrap' }, role, days, label, h('button', { type: 'button', class: 'btn', onclick: async () => {
      try {
        const r = await api(`/api/boards/${boardId}/guest-links`, { method: 'POST', body: { role: role.value, days: Number(days.value), label: label.value } });
        const url = `${location.origin}/g/${r.token}`;
        const input = h('input', { type: 'text', value: url, readonly: true, onclick: (e) => e.target.select() });
        result.innerHTML = '';
        result.append(h('div', { class: 'hint' }, h('b', {}, T('Neuer Gastlink – jetzt kopieren, er wird nur einmal angezeigt:')),
          h('div', { class: 'copy-row' }, input, h('button', { type: 'button', class: 'btn', onclick: async () => {
            try {
              await navigator.clipboard.writeText(url);
            } catch {
              input.select();
              document.execCommand('copy');
            }
            toast(T('Gastlink kopiert'));
          } }, T('Kopieren')))));
        label.value = '';
        renderList((await api(`/api/boards/${boardId}/guest-links`)).links);
      } catch (ex) {
        toast(ex.message);
      }
    } }, T('Gastlink erstellen'))),
    result, list);
}
