// Administrationsoberfläche
import { h, append, api, ICONS, toast, modal, confirmDialog, initials, relTime, fmtDate, loadPref } from './util.js';
import { menu } from './menu.js';
import { accountMenuItems } from './account.js';

const main = document.getElementById('admin-main');
const nav = document.getElementById('admin-nav');
let me = null;

if (loadPref('settings', {}).dark) document.body.classList.add('dark');

const SECTIONS = [
  ['overview', 'Übersicht', 'grid'],
  ['users', 'Benutzer', 'users'],
  ['boards', 'Boards', 'template'],
  ['settings', 'Allgemein', 'settings'],
  ['mail', 'Mailserver', 'comment'],
];

const STATUS = { active: ['Aktiv', 'ok'], pending: ['Wartet auf Freigabe', 'warn'], disabled: ['Deaktiviert', 'off'] };
const LINK = { private: 'Privat', view: 'Link: ansehen', edit: 'Link: bearbeiten' };

function fmtBytes(n) {
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}

function fmtUptime(s) {
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d} T ${hh} Std` : hh ? `${hh} Std ${m} Min` : `${m} Min`;
}

function section(title, ...content) {
  main.innerHTML = '';
  append(main, h('h1', {}, title), ...content);
}

function errorBox() {
  const el = h('div', { class: 'form-error hidden', role: 'alert' });
  return { el, show: (m) => { el.textContent = m; el.classList.remove('hidden'); }, hide: () => el.classList.add('hidden') };
}

function route() {
  const cur = (location.hash.slice(1) || 'overview').split('/')[0];
  nav.innerHTML = '';
  for (const [id, label, icon] of SECTIONS) {
    nav.append(h('a', { href: '#' + id, class: 'admin-nav-item' + (id === cur ? ' active' : '') }, h('span', { html: ICONS[icon] }), label));
  }
  ({ overview, users, boards, settings, mail }[cur] || overview)().catch((e) => section('Fehler', h('p', {}, e.message)));
}

/* ---------------- Übersicht ---------------- */

async function overview() {
  const o = await api('/api/admin/overview');
  const tile = (label, value, sub) => h('div', { class: 'stat-tile' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), sub ? h('div', { class: 'stat-sub' }, sub) : null);
  const pending = o.users.pending || 0;
  section('Übersicht',
    pending ? h('a', { class: 'notice warn', href: '#users' }, `⏳ ${pending} Registrierung${pending > 1 ? 'en warten' : ' wartet'} auf Freigabe →`) : null,
    !o.mailConfigured ? h('a', { class: 'notice', href: '#mail' }, '✉️ Es ist noch kein Mailserver eingerichtet. Ohne Mailserver funktionieren „Kennwort vergessen“ und Einladungs-E-Mails nicht →') : null,
    h('div', { class: 'stat-grid' },
      tile('Benutzer', (o.users.active || 0) + (o.users.pending || 0) + (o.users.disabled || 0), `${o.users.active || 0} aktiv · ${pending} wartend · ${o.users.disabled || 0} deaktiviert`),
      tile('Boards', o.boards, `${o.elements.toLocaleString('de-DE')} Elemente`),
      tile('Gerade online', o.online, `auf ${o.activeBoards} Board${o.activeBoards === 1 ? '' : 's'}`),
      tile('Angemeldete Sitzungen', o.sessions),
      tile('Datenbank', fmtBytes(o.dbSize), o.pgVersion),
      tile('System', 'v' + o.version, 'Laufzeit ' + fmtUptime(o.uptime)),
    ));
}

/* ---------------- Benutzer ---------------- */

async function users() {
  const list = await api('/api/admin/users');
  const search = h('input', { type: 'search', placeholder: 'Suchen …', class: 'admin-search' });
  const table = h('div', { class: 'table-wrap' });
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const rows = list.filter((u) => !q || [u.username, u.displayName, u.email].join(' ').toLowerCase().includes(q));
    table.innerHTML = '';
    table.append(h('table', { class: 'admin-table' },
      h('thead', {}, h('tr', {}, ['Benutzer', 'E-Mail', 'Rolle', 'Status', 'Boards', 'Letzte Anmeldung', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((u) => {
        const [sl, sc] = STATUS[u.status];
        const actions = h('button', { class: 'icon-btn small', title: 'Aktionen', html: ICONS.more });
        actions.onclick = () => userMenu(actions, u);
        return h('tr', { class: u.status === 'pending' ? 'row-warn' : '' },
          h('td', {}, h('div', { class: 'user-cell' }, h('span', { class: 'avatar sm', style: { background: u.color } }, initials(u.displayName)),
            h('div', {}, h('b', {}, u.displayName), h('div', { class: 'muted small' }, '@' + u.username + (u.id === me.id ? ' · du' : ''))))),
          h('td', {}, u.email || h('span', { class: 'muted' }, '–')),
          h('td', {}, u.role === 'admin' ? h('span', { class: 'pill accent' }, 'Admin') : 'Benutzer'),
          h('td', {}, h('span', { class: 'pill ' + sc }, sl), u.status === 'pending' ? h('button', { class: 'btn small primary', style: { marginLeft: '8px' }, onclick: () => patchUser(u, { status: 'active' }, 'Freigeschaltet') }, 'Freischalten') : null),
          h('td', {}, u.boardCount),
          h('td', { title: u.lastLoginAt ? fmtDate(u.lastLoginAt) : '' }, u.lastLoginAt ? relTime(new Date(u.lastLoginAt).getTime()) : h('span', { class: 'muted' }, 'nie')),
          h('td', { class: 'actions' }, actions));
      }))));
  };
  search.addEventListener('input', render);
  section('Benutzer',
    h('div', { class: 'admin-toolbar' }, search, h('span', { class: 'spacer' }), h('button', { class: 'btn primary', onclick: () => editUser(null) }, h('span', { html: ICONS.plus }), 'Benutzer anlegen')),
    table);
  render();
}

async function patchUser(u, patch, msg) {
  try {
    await api('/api/admin/users/' + u.id, { method: 'PATCH', body: patch });
    toast(msg || 'Gespeichert');
    users();
  } catch (e) {
    toast(e.message);
  }
}

function userMenu(anchor, u) {
  const self = u.id === me.id;
  menu(anchor, [
    { label: 'Bearbeiten …', icon: 'edit', onClick: () => editUser(u) },
    { label: 'Link zum Kennwort-Zurücksetzen', icon: 'link', onClick: () => resetLink(u) },
    u.status === 'pending' ? { label: 'Freischalten', icon: 'check', onClick: () => patchUser(u, { status: 'active' }, 'Freigeschaltet') } : null,
    u.status === 'active' && !self ? { label: 'Deaktivieren', icon: 'lock', onClick: () => patchUser(u, { status: 'disabled' }, 'Deaktiviert') } : null,
    u.status === 'disabled' ? { label: 'Aktivieren', icon: 'unlock', onClick: () => patchUser(u, { status: 'active' }, 'Aktiviert') } : null,
    !self ? { label: u.role === 'admin' ? 'Adminrechte entziehen' : 'Zum Admin machen', icon: 'settings', onClick: () => patchUser(u, { role: u.role === 'admin' ? 'user' : 'admin' }) } : null,
    !self ? '-' : null,
    !self ? { label: 'Löschen …', icon: 'trash', danger: true, onClick: () => deleteUser(u) } : null,
  ], { placement: 'left' });
}

function editUser(u) {
  const isNew = !u;
  const self = !!u && u.id === me.id; // eigene Rolle/Status nicht hier ändern (Selbstaussperrung)
  const err = errorBox();
  const username = h('input', { type: 'text', value: u ? u.username : '', disabled: !isNew, required: true });
  const display = h('input', { type: 'text', value: u ? (u.displayName === u.username ? '' : u.displayName) : '' });
  const email = h('input', { type: 'email', value: u ? u.email : '' });
  const role = h('select', { disabled: self }, h('option', { value: 'user', selected: !u || u.role === 'user' }, 'Benutzer'), h('option', { value: 'admin', selected: u && u.role === 'admin' }, 'Administrator'));
  const status = h('select', { disabled: isNew || self }, Object.entries(STATUS).map(([k, [l]]) => h('option', { value: k, selected: u ? u.status === k : k === 'active' }, l)));
  const pw = h('input', { type: 'password', autocomplete: 'new-password', required: isNew, minlength: 8, placeholder: isNew ? '' : 'unverändert lassen' });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      if (isNew) await api('/api/admin/users', { method: 'POST', body: { username: username.value, displayName: display.value, email: email.value, role: role.value, password: pw.value } });
      else await api('/api/admin/users/' + u.id, { method: 'PATCH', body: { displayName: display.value, email: email.value, ...(self ? {} : { role: role.value, status: status.value }), ...(pw.value ? { password: pw.value } : {}) } });
      m.close();
      toast(isNew ? 'Benutzer angelegt' : 'Gespeichert');
      users();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('label', {}, 'Benutzername', username),
  h('label', {}, 'Anzeigename', display),
  h('label', {}, 'E-Mail-Adresse', email),
  h('div', { class: 'form-row' }, h('label', {}, 'Rolle', role), h('label', {}, 'Status', status)),
  h('label', {}, isNew ? 'Kennwort' : 'Neues Kennwort', pw, h('span', { class: 'field-hint' }, isNew ? 'Mindestens 8 Zeichen. Teile es der Person auf sicherem Weg mit.' : 'Setzt das Kennwort und meldet alle Sitzungen ab.')),
  err.el,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, isNew ? 'Anlegen' : 'Speichern')));
  const m = modal(isNew ? 'Benutzer anlegen' : `Benutzer bearbeiten: ${u.username}`, form);
}

async function resetLink(u) {
  try {
    const r = await api(`/api/admin/users/${u.id}/reset-link`, { method: 'POST' });
    if (r.sent) return toast(`E-Mail an ${r.email} verschickt`);
    const input = h('input', { type: 'text', value: r.link, readonly: true, onclick: (e) => e.target.select() });
    modal('Link zum Kennwort-Zurücksetzen', h('div', { class: 'form' },
      h('p', {}, r.error ? `Die E-Mail konnte nicht verschickt werden (${r.error}). Gib den Link bitte selbst weiter:` : `Für ${u.displayName} ist keine E-Mail-Adresse oder kein Mailserver hinterlegt. Gib diesen Link weiter – er ist 24 Stunden gültig:`),
      h('div', { class: 'copy-row' }, input, h('button', { class: 'btn', onclick: async () => {
        await navigator.clipboard.writeText(r.link).catch(() => input.select());
        toast('Link kopiert');
      } }, 'Kopieren'))));
  } catch (e) {
    toast(e.message);
  }
}

function deleteUser(u) {
  const transfer = h('input', { type: 'radio', name: 'b', checked: true });
  const del = h('input', { type: 'radio', name: 'b' });
  const m = modal('Benutzer löschen', h('div', { class: 'form' },
    h('p', {}, `„${u.displayName}“ (@${u.username}) wird endgültig gelöscht.`),
    u.boardCount ? h('div', {}, h('div', { class: 'label' }, `Was passiert mit ${u.boardCount} eigenen Board${u.boardCount > 1 ? 's' : ''}?`),
      h('label', { class: 'check' }, transfer, 'An mich übertragen'),
      h('label', { class: 'check' }, del, 'Ebenfalls löschen')) : null,
    h('div', { class: 'form-actions' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Abbrechen'),
      h('button', { class: 'btn danger primary', onclick: async () => {
        try {
          await api(`/api/admin/users/${u.id}?boards=${del.checked ? 'delete' : 'transfer'}`, { method: 'DELETE' });
          m.close();
          toast('Benutzer gelöscht');
          users();
        } catch (e) {
          toast(e.message);
        }
      } }, 'Endgültig löschen'))));
}

/* ---------------- Boards ---------------- */

async function boards() {
  const [list, userList] = await Promise.all([api('/api/admin/boards'), api('/api/admin/users')]);
  const search = h('input', { type: 'search', placeholder: 'Suchen …', class: 'admin-search' });
  const table = h('div', { class: 'table-wrap' });
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const rows = list.filter((b) => !q || (b.name + ' ' + (b.owner || '')).toLowerCase().includes(q));
    table.innerHTML = '';
    table.append(h('table', { class: 'admin-table' },
      h('thead', {}, h('tr', {}, ['Board', 'Besitzer', 'Elemente', 'Mitglieder', 'Freigabe', 'Geändert', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((b) => {
        const actions = h('button', { class: 'icon-btn small', title: 'Aktionen', html: ICONS.more });
        actions.onclick = () => menu(actions, [
          { label: 'Öffnen', icon: 'fit', onClick: () => window.open('/board/' + b.id, '_blank') },
          { label: 'Besitzer ändern …', icon: 'users', onClick: () => changeOwner(b, userList) },
          '-',
          { label: 'Löschen', icon: 'trash', danger: true, onClick: async () => {
            if (!(await confirmDialog('Board löschen', `„${b.name}“ wird unwiderruflich gelöscht.`, 'Löschen', true))) return;
            try {
              await api('/api/boards/' + b.id, { method: 'DELETE' });
              toast('Board gelöscht');
              boards();
            } catch (e) {
              toast(e.message);
            }
          } },
        ], { placement: 'left' });
        return h('tr', {},
          h('td', {}, h('a', { href: '/board/' + b.id, target: '_blank' }, b.name), b.online ? h('span', { class: 'pill ok', style: { marginLeft: '8px' } }, b.online + ' online') : null),
          h('td', {}, b.owner || h('span', { class: 'muted' }, 'ohne')),
          h('td', {}, b.elements),
          h('td', {}, b.members),
          h('td', {}, LINK[b.linkAccess]),
          h('td', { title: fmtDate(b.updatedAt) }, relTime(new Date(b.updatedAt).getTime())),
          h('td', { class: 'actions' }, actions));
      }))));
  };
  search.addEventListener('input', render);
  section('Boards', h('div', { class: 'admin-toolbar' }, search, h('span', { class: 'muted small' }, `${list.length} Boards insgesamt`)), table);
  render();
}

function changeOwner(b, userList) {
  const sel = h('select', {}, userList.filter((u) => u.status === 'active').map((u) => h('option', { value: u.id, selected: u.id === b.ownerId }, `${u.displayName} (@${u.username})`)));
  const m = modal('Besitzer ändern', h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/boards/' + b.id, { method: 'PATCH', body: { ownerId: sel.value } });
      m.close();
      toast('Besitzer geändert');
      boards();
    } catch (ex) {
      toast(ex.message);
    }
  } }, h('p', {}, `Neuer Besitzer für „${b.name}“:`), sel,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, 'Übernehmen'))));
}

/* ---------------- Allgemeine Einstellungen ---------------- */

async function settings() {
  const s = (await api('/api/admin/settings')).general;
  const err = errorBox();
  const siteName = h('input', { type: 'text', value: s.siteName, maxlength: 60 });
  const baseUrl = h('input', { type: 'url', value: s.baseUrl, placeholder: location.origin });
  const radio = (v, label, hint) => h('label', { class: 'radio-card' }, h('input', { type: 'radio', name: 'reg', value: v, checked: s.registration === v }), h('div', {}, h('b', {}, label), h('div', { class: 'muted small' }, hint)));
  const requireEmail = h('input', { type: 'checkbox', checked: s.requireEmail });
  const notifyAdmins = h('input', { type: 'checkbox', checked: s.notifyAdmins });
  const form = h('form', { class: 'form admin-form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { general: {
        siteName: siteName.value, baseUrl: baseUrl.value, registration: form.querySelector('input[name=reg]:checked').value,
        requireEmail: requireEmail.checked, notifyAdmins: notifyAdmins.checked,
      } } });
      toast('Einstellungen gespeichert');
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('fieldset', {}, h('legend', {}, 'Instanz'),
    h('label', {}, 'Name der Anwendung', siteName, h('span', { class: 'field-hint' }, 'Erscheint auf der Anmeldeseite und im Betreff von E-Mails.')),
    h('label', {}, 'Öffentliche Adresse', baseUrl, h('span', { class: 'field-hint' }, 'Wird für Links in E-Mails verwendet, z. B. https://board.example.de. Leer lassen, um die Adresse aus der jeweiligen Anfrage zu übernehmen.'))),
  h('fieldset', {}, h('legend', {}, 'Registrierung'),
    radio('open', 'Offen', 'Jede Person kann sich registrieren und sofort loslegen.'),
    radio('approval', 'Mit Freigabe', 'Neue Konten müssen von einem Administrator freigeschaltet werden.'),
    radio('closed', 'Geschlossen', 'Nur Administratoren können Konten anlegen.'),
    h('label', { class: 'check' }, requireEmail, 'E-Mail-Adresse bei der Registrierung verlangen'),
    h('label', { class: 'check' }, notifyAdmins, 'Administratoren per E-Mail über Registrierungen informieren, die auf Freigabe warten')),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, 'Speichern')));
  section('Allgemeine Einstellungen', form);
}

/* ---------------- Mailserver ---------------- */

async function mail() {
  const s = (await api('/api/admin/settings')).smtp;
  const err = errorBox();
  const host = h('input', { type: 'text', value: s.host, placeholder: 'smtp.example.de' });
  const port = h('input', { type: 'number', value: s.port, min: 1, max: 65535 });
  const security = h('select', {},
    h('option', { value: 'starttls', selected: s.security === 'starttls' }, 'STARTTLS (meist Port 587)'),
    h('option', { value: 'tls', selected: s.security === 'tls' }, 'SSL/TLS (meist Port 465)'),
    h('option', { value: 'none', selected: s.security === 'none' }, 'Keine Verschlüsselung (z. B. Port 25)'));
  security.addEventListener('change', () => {
    const def = { starttls: 587, tls: 465, none: 25 }[security.value];
    if ([25, 465, 587].includes(Number(port.value))) port.value = def;
  });
  const user = h('input', { type: 'text', value: s.user, autocomplete: 'off' });
  const pass = h('input', { type: 'password', autocomplete: 'new-password', placeholder: s.hasPassword ? '•••••••• (gespeichert – leer lassen zum Beibehalten)' : '' });
  const clearPw = h('input', { type: 'checkbox' });
  const from = h('input', { type: 'text', value: s.from, placeholder: 'dlzboard <noreply@example.de>' });
  const verify = h('input', { type: 'checkbox', checked: s.rejectUnauthorized !== false });
  const testTo = h('input', { type: 'email', value: me.email || '', placeholder: 'empfaenger@example.de' });
  const values = () => ({ host: host.value, port: Number(port.value), security: security.value, user: user.value, pass: pass.value, from: from.value, rejectUnauthorized: verify.checked, clearPassword: clearPw.checked });
  const testResult = h('div', { class: 'test-result hidden' });
  const form = h('form', { class: 'form admin-form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { smtp: values() } });
      toast('Mailserver gespeichert');
      mail();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('p', { class: 'muted' }, 'Der Mailserver wird für „Kennwort vergessen“, Einladungen zu Boards und Benachrichtigungen über neue Registrierungen verwendet.'),
  h('fieldset', {}, h('legend', {}, 'Server'),
    h('div', { class: 'form-row wide-first' }, h('label', {}, 'SMTP-Server', host), h('label', {}, 'Port', port)),
    h('label', {}, 'Verschlüsselung', security),
    h('label', { class: 'check' }, verify, 'TLS-Zertifikat prüfen (nur bei selbstsignierten Zertifikaten abschalten)')),
  h('fieldset', {}, h('legend', {}, 'Anmeldung'),
    h('label', {}, 'Benutzername', user, h('span', { class: 'field-hint' }, 'Leer lassen, wenn der Server keine Anmeldung verlangt.')),
    h('label', {}, 'Kennwort', pass),
    s.hasPassword ? h('label', { class: 'check' }, clearPw, 'Gespeichertes Kennwort entfernen') : null),
  h('fieldset', {}, h('legend', {}, 'Absender'),
    h('label', {}, 'Absenderadresse', from, h('span', { class: 'field-hint' }, 'Muss vom Mailserver akzeptiert werden, oft identisch mit dem Benutzernamen.'))),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, 'Speichern')),
  h('fieldset', {}, h('legend', {}, 'Verbindung testen'),
    h('p', { class: 'muted small' }, 'Verschickt eine Testnachricht mit den Werten aus dem Formular – auch ohne vorher zu speichern.'),
    h('div', { class: 'copy-row' }, testTo, h('button', { type: 'button', class: 'btn', onclick: async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      testResult.className = 'test-result';
      testResult.textContent = 'Sende …';
      try {
        await api('/api/admin/test-mail', { method: 'POST', body: { to: testTo.value, smtp: values() } });
        testResult.className = 'test-result ok';
        testResult.textContent = `✅ Testnachricht an ${testTo.value} wurde vom Server angenommen.`;
      } catch (ex) {
        testResult.className = 'test-result fail';
        testResult.textContent = '❌ ' + ex.message;
      } finally {
        btn.disabled = false;
      }
    } }, 'Testmail senden')),
    testResult));
  section('Mailserver', form);
}

/* ---------------- Start ---------------- */

(async () => {
  try {
    me = (await api('/api/auth/me')).user;
  } catch {
    location.href = '/login?next=/admin';
    return;
  }
  const btn = document.getElementById('admin-user');
  btn.textContent = initials(me.displayName);
  btn.style.background = me.color;
  btn.onclick = () => menu(btn, accountMenuItems(me, (u) => (me = u)), { placement: 'bottom' });
  window.addEventListener('hashchange', route);
  route();
})();
