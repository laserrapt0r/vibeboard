// Board in einen Ordner legen: eigene Ordner und (falls das Board einem Team gehört) die Ordner dieses Teams.
// Genutzt von der Startseite und vom Boardmenü.
import { T } from './i18n.js';
import { h, api, modal, toast, ICONS } from './util.js';

export function openFolderDialog(b, folderList, onDone) {
  const options = folderList.filter((f) => !f.teamId || (b.team && f.teamId === b.team.id));
  const body = h('div', { class: 'form' });
  const m = modal(T`„${b.name}“ in Ordner verschieben`, body);
  if (!options.length) body.append(h('p', { class: 'muted' }, T('Noch keine Ordner. Lege auf der Startseite links unter „Ordner“ einen an.')));
  const groups = [[null, T('Meine Ordner')], ...(b.team ? [[b.team.id, T`Team „${b.team.name}“`]] : [])];
  for (const [tid, label] of groups) {
    const fl = options.filter((f) => (f.teamId || null) === tid);
    if (!fl.length) continue;
    body.append(h('div', { class: 'label' }, label));
    for (const f of fl) {
      const inIt = b.folders.includes(f.id);
      body.append(h('button', { class: 'folder-pick' + (inIt ? ' active' : ''), onclick: async () => {
        try {
          if (inIt) await api(`/api/folders/${f.id}/boards/${b.id}`, { method: 'DELETE' });
          else await api(`/api/folders/${f.id}/boards/${b.id}`, { method: 'PUT' });
          m.close();
          toast(inIt ? T('Aus dem Ordner entfernt') : T`In „${f.name}“ verschoben`);
          onDone && onDone();
        } catch (e) {
          toast(e.message);
        }
      } }, h('span', { html: ICONS.folder }), f.name, inIt ? h('span', { class: 'muted small' }, T(' – enthalten, Klick entfernt')) : null));
    }
  }
}
