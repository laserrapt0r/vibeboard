// Board mit Jira oder Azure DevOps verbinden
import { T } from './i18n.js';
import { h, api, toast, modal, relTime } from './util.js';
import { app } from './core.js';

const base = () => `/api/boards/${encodeURIComponent(app.boardId)}/tracker`;
const EXAMPLE = { jira: 'project = VB AND statusCategory != Done', azure: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.State] <> 'Closed'" };

async function syncNow() {
  try {
    const r = await api(`${base()}/sync`, { method: 'POST' });
    if (!r.result) return toast(T('Der Abgleich läuft bereits.'));
    const { created, updated, pushed, conflicts } = r.result;
    toast(T`Abgeglichen: ${created} neu, ${updated} aktualisiert, ${pushed} gesendet${conflicts ? T`, ${conflicts} Konflikte (Ticket gewinnt)` : ''}`, 6000);
  } catch (e) {
    toast(e.message, 6000);
  }
}

app.on('openTracker', async () => {
  let info;
  try {
    info = await api(base());
  } catch (e) {
    return toast(e.message, 5000);
  }
  const { connections, link } = info;
  if (!connections.length) return toast(T('Es gibt noch keine Verbindung. Eine Administratorin oder ein Administrator kann sie unter „Anbindungen“ einrichten.'), 6000);
  const conn = h('select', {}, connections.map((c) => h('option', { value: c.id, selected: link && link.connectionId === c.id }, `${c.name} (${c.kind === 'azure' ? 'Azure DevOps' : 'Jira'})`)));
  const query = h('textarea', { rows: 3, spellcheck: 'false', required: true }, link ? link.query : '');
  const project = h('input', { type: 'text', value: link ? link.project : '' });
  const kindOf = () => connections.find((c) => c.id === conn.value)?.kind;
  const hint = h('span', { class: 'field-hint' });
  const paint = () => (hint.textContent = T`Beispiel: ${EXAMPLE[kindOf()]}`);
  conn.addEventListener('change', paint);
  paint();
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await api(base(), { method: 'PUT', body: { connectionId: conn.value, query: query.value, project: project.value } });
      m.close();
      syncNow();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    }
  } },
  link ? h('p', { class: 'muted' }, link.lastSync ? T`Zuletzt abgeglichen ${relTime(link.lastSync)}.` : T('Noch nicht abgeglichen.')) : null,
  link && link.lastError ? h('p', { class: 'notice warn' }, link.lastError) : null,
  h('label', {}, T('Verbindung'), conn),
  h('label', {}, T('Abfrage (JQL oder WIQL)'), query, hint),
  h('label', {}, T('Projekt (für neue Tickets, bei Azure DevOps immer nötig)'), project),
  h('p', { class: 'muted small' }, T('Der Abgleich läuft alle fünf Minuten: Treffer werden zu Karten, Änderungen gehen in beide Richtungen. Zuständige Personen kommen nur aus dem Ticket. Ändern sich Karte und Ticket gleichzeitig, gewinnt das Ticket.')),
  err,
  h('div', { class: 'form-actions' },
    link ? h('button', { type: 'button', class: 'btn danger', onclick: async () => {
      await api(base(), { method: 'DELETE' }).catch((ex) => toast(ex.message));
      m.close();
      toast(T('Verbindung gelöst. Die Karten bleiben auf dem Board.'));
    } }, T('Verbindung lösen')) : null,
    link ? h('button', { type: 'button', class: 'btn', onclick: () => {
      m.close();
      syncNow();
    } }, T('Jetzt abgleichen')) : null,
    h('span', { class: 'spacer' }),
    h('button', { type: 'submit', class: 'btn primary' }, T('Speichern und abgleichen'))));
  const m = modal(T('Jira / Azure DevOps'), form);
});

app.on('ctxItems', (items, sel, { one, actBtn }) => {
  if (!one || one.type !== 'card' || one.ext || app.guest || app.viewOnly) return;
  items.push(actBtn('upload', T('Als Ticket anlegen'), async () => {
    try {
      const r = await api(`${base()}/issue`, { method: 'POST', body: { elementId: one.id } });
      toast(T`Ticket ${r.id} angelegt`);
    } catch (e) {
      toast(e.message, 6000);
    }
  }));
});
