// Verwaltung der Chat-Anbindung (Webhooks) – für die eigene Person (Profil) oder ein Team (Team-Verwaltung)
import { T } from './i18n.js';
import { h, append, api, toast, modal, relTime, confirmDialog } from './util.js';

const FORMAT_LABEL = { teams: T('Microsoft Teams'), slack: T('Slack / Mattermost / Rocket.Chat'), matrix: T('Matrix (Hookshot)'), generic: T('Allgemein (JSON)') };

export async function openWebhooks({ teamId = null, teamName = '' } = {}) {
  const base = teamId ? `/api/teams/${teamId}/webhooks` : '/api/webhooks';
  let meta;
  try {
    meta = await api('/api/webhooks/meta');
  } catch (e) {
    return toast(e.message);
  }
  const events = teamId ? meta.teamEvents : meta.userEvents;
  const list = h('div', { class: 'hook-list' });
  const body = h('div', { class: 'form' });
  const m = modal(teamId ? T`Chat-Anbindung für „${teamName}“` : T('Chat-Anbindung (Webhooks)'), body, { wide: true });

  const load = async () => {
    list.innerHTML = '';
    let hooks = [];
    try {
      hooks = (await api(base)).webhooks;
    } catch (e) {
      list.append(h('p', { class: 'muted' }, e.message));
      return;
    }
    if (!hooks.length) list.append(h('p', { class: 'muted' }, T('Noch keine Webhooks eingerichtet.')));
    for (const w of hooks) {
      list.append(h('div', { class: 'hook-row' + (w.disabled ? ' disabled' : '') },
        h('div', { class: 'hook-main' },
          h('b', {}, w.name || w.host), h('span', { class: 'muted small' }, ` ${FORMAT_LABEL[w.format] || w.format} · ${w.host}`),
          h('div', { class: 'muted small' }, w.events.map((e) => events[e] || e).join(', ')),
          h('div', { class: 'small ' + (w.failures ? 'warn-text' : 'muted') },
            w.disabled ? T`Pausiert nach ${w.failures} Fehlern – „Testen“ setzt ihn zurück. Letzter Fehler: ${w.lastStatus}`
              : w.lastAt ? T`Zuletzt ${relTime(w.lastAt)}: ${w.lastStatus === '200' || /^2\d\d$/.test(w.lastStatus || '') ? T('zugestellt') : w.lastStatus}` : T('Noch nichts gesendet'))),
        h('button', { class: 'btn small', onclick: async () => {
          try {
            await api(`${base}/${w.id}/test`, { method: 'POST' });
            toast(T('Testnachricht zugestellt'));
          } catch (e) {
            toast(e.message, 6000);
          }
          load();
        } }, T('Testen')),
        h('button', { class: 'btn small danger', onclick: async () => {
          if (!(await confirmDialog(T('Webhook entfernen'), T`Der Webhook an ${w.host} wird gelöscht.`, T('Entfernen'), true))) return;
          await api(`${base}/${w.id}`, { method: 'DELETE' }).catch((e) => toast(e.message));
          load();
        } }, T('Entfernen'))));
    }
  };

  const name = h('input', { type: 'text', maxlength: 60, placeholder: T('z. B. Team-Kanal') });
  const url = h('input', { type: 'url', required: true, placeholder: 'https://…', autocomplete: 'off' });
  const format = h('select', {}, meta.formats.map((f) => h('option', { value: f, selected: f === 'teams' }, FORMAT_LABEL[f] || f)));
  const checks = Object.entries(events).map(([k, label]) => ({ k, cb: h('input', { type: 'checkbox', value: k, checked: true }), label }));
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await api(base, { method: 'POST', body: { name: name.value, url: url.value, format: format.value, events: checks.filter((c) => c.cb.checked).map((c) => c.k) } });
      url.value = '';
      name.value = '';
      toast(T('Webhook eingerichtet – mit „Testen“ prüfen'));
      load();
    } catch (ex) {
      toast(ex.message, 6000);
    }
  } },
  h('div', { class: 'label' }, T('Neuen Webhook einrichten')),
  h('div', { class: 'form-row' }, h('label', {}, T('Bezeichnung'), name), h('label', {}, T('Dienst'), format)),
  h('label', {}, T('Webhook-Adresse'), url, h('span', { class: 'field-hint' }, T('In Microsoft Teams: Kanal → Workflows → „Bei Webhook-Anfrage im Kanal posten“. In Slack: App „Incoming Webhooks“. Die Adresse ist ein Geheimnis – sie wird nach dem Speichern nur gekürzt angezeigt.'))),
  h('div', {}, h('div', { class: 'label' }, T('Senden bei')), h('div', { class: 'check-grid' }, checks.map((c) => h('label', { class: 'check' }, c.cb, c.label)))),
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, T('Einrichten'))));

  append(body,
    meta.enabled ? null : h('p', { class: 'notice warn' }, T('Webhooks sind in dieser Installation abgeschaltet. Eine Administratorin oder ein Administrator kann sie unter „Zusammenarbeit“ einschalten.')),
    h('p', { class: 'muted' }, teamId
      ? T('Neue Boards im Team und Retro-Zusammenfassungen erscheinen im Chat-Kanal des Teams.')
      : T('Deine Benachrichtigungen (Erwähnungen, Antworten, Zuweisungen, Team-Einladungen) erscheinen zusätzlich in deinem Chat. Dabei wird der Text des Kommentars an den Chat-Dienst übertragen.')),
    list, meta.enabled ? form : null);
  load();
  void m;
}
