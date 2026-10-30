// Administrationsoberfläche
import { h, append, api, ICONS, toast, modal, confirmDialog, initials, relTime, fmtDate, loadPref } from './util.js';
import { menu } from './menu.js';
import { accountMenuItems, openSecurityDialog } from './account.js';
import { renderMarkdown } from './markdown.js';
import { IMPRINT_TEMPLATE, PRIVACY_TEMPLATE } from './legal-templates.js';
import { legalFooter } from './footer.js';

const main = document.getElementById('admin-main');
const nav = document.getElementById('admin-nav');
let me = null;

// „neon“: Einstellung aus 3.5.0, wird als dunkles Design übernommen
if (loadPref('settings', {}).dark || loadPref('settings', {}).neon) document.body.classList.add('dark');

const SECTIONS = [
  ['overview', 'Übersicht', 'grid'],
  ['users', 'Benutzer', 'users'],
  ['boards', 'Boards', 'template'],
  ['settings', 'Allgemein', 'settings'],
  ['security', 'Sicherheit', 'lock'],
  ['collab', 'Zusammenarbeit', 'team'],
  ['mail', 'Mailserver', 'comment'],
  ['legal', 'Rechtliches', 'edit'],
  ['audit', 'Protokoll', 'layers'],
];

const STATUS = { active: ['Aktiv', 'ok'], pending: ['Wartet auf Freigabe', 'warn'], disabled: ['Deaktiviert', 'off'] };
const LINK = { private: 'Privat', view: 'Link: ansehen', comment: 'Link: kommentieren', edit: 'Link: bearbeiten' };

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
  ({ overview, users, boards, settings, security, collab, mail, legal, audit }[cur] || overview)().catch((e) => {
    if (e.code === 'mfa_required') {
      section('Zwei-Faktor-Anmeldung erforderlich',
        h('p', {}, e.message),
        h('button', { class: 'btn primary', onclick: () => openSecurityDialog(me, (u) => (me = u)) }, 'Jetzt einrichten'));
    } else section('Fehler', h('p', {}, e.message));
  });
}

/* ---------------- Übersicht ---------------- */

/* ---------------- Systemmetriken ---------------- */

const pct = (v) => (v == null ? '–' : `${String(Math.round(v * 10) / 10).replace('.', ',')} %`);

// Kleines Verlaufsdiagramm (letzte 10 Minuten) als SVG
function sparkline(values, max, color = '#4262ff') {
  if (values.length < 2) return h('div', { class: 'spark empty' });
  const w = 200, ht = 36, top = Math.max(max || 0, ...values, 1e-9);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(ht - (v / top) * (ht - 2) - 1).toFixed(1)}`).join(' ');
  return h('div', { class: 'spark', html: `<svg viewBox="0 0 ${w} ${ht}" preserveAspectRatio="none"><polyline points="0,${ht} ${pts} ${w},${ht}" fill="${color}" fill-opacity="0.12" stroke="none"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>` });
}

function renderSystem(box, m) {
  const tile = (label, value, sub, extra, warn) => h('div', { class: 'stat-tile' + (warn ? ' warn' : '') }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), sub ? h('div', { class: 'stat-sub' }, sub) : null, extra || null);
  const mem = m.memory;
  const memTotal = mem.containerLimit || mem.hostTotal;
  const memUsed = mem.containerLimit ? mem.containerUsed : mem.hostTotal - mem.hostFree;
  const memPct = memTotal ? (memUsed / memTotal) * 100 : null;
  const hist = m.history || [];
  box.innerHTML = '';
  box.append(h('div', { class: 'stat-grid' },
    tile('CPU (vibeboard)', pct(m.cpu.process), `${String(m.cpu.cores).replace('.', ',')} Kern${m.cpu.cores === 1 ? '' : 'e'} · Host ${pct(m.cpu.host)} · Last ${m.cpu.load.map((v) => v.toFixed(2).replace('.', ',')).join(' / ')}`,
      sparkline(hist.map((x) => x.cpu), 100), m.cpu.process > 80),
    tile('Arbeitsspeicher (vibeboard)', fmtBytes(mem.rss), `JavaScript-Heap ${fmtBytes(mem.heapUsed)} von ${fmtBytes(mem.heapTotal)}`,
      sparkline(hist.map((x) => x.rss), 0, '#12b886')),
    tile(mem.containerLimit ? 'Arbeitsspeicher (Container)' : 'Arbeitsspeicher (Host)', pct(memPct), `${fmtBytes(memUsed)} von ${fmtBytes(memTotal)} belegt${mem.containerLimit ? '' : ' · kein Container-Limit'}`, null, memPct > 90),
    tile('Reaktionszeit (Ereignisschleife)', m.eventLoopLagMs == null ? '–' : `${String(Math.round(m.eventLoopLagMs * 10) / 10).replace('.', ',')} ms`,
      `99 % unter ${m.eventLoopLagP99Ms == null ? '–' : String(Math.round(m.eventLoopLagP99Ms)) + ' ms'} · unter 10 ms ist gut`, sparkline(hist.map((x) => x.lag), 50, '#f59f00'), m.eventLoopLagMs > 50),
    ...m.disks.map((d) => tile(d.path === m.disks[0].path ? 'Speicherplatz (Anwendung)' : 'Speicherplatz (Sicherungen)', `${fmtBytes(d.free)} frei`,
      `von ${fmtBytes(d.total)} · ${pct(100 - (d.free / d.total) * 100)} belegt`, null, d.free / d.total < 0.1)),
    tile('Datenbank-Verbindungen', `${m.db.connections}`, `Pool je Instanz: ${m.db.poolSize} · Cache-Trefferquote ${pct(m.db.cacheHit)}`),
    tile('Echtzeit', `${m.realtime.online} verbunden`, `${m.realtime.activeBoards} aktive Boards · ${m.realtime.boardsInMemory} im Arbeitsspeicher`),
    tile('Laufzeit', fmtUptime(m.uptime.process), `Host seit ${fmtUptime(m.uptime.host)} · Node.js ${m.node} · ${m.platform}`),
  ), h('p', { class: 'muted small' }, 'Wird alle 5 Sekunden aktualisiert. Verlauf: letzte 10 Minuten. Rote Kacheln weisen auf Engpässe hin.'));
}

let metricsTimer = null;

async function overview() {
  const o = await api('/api/admin/overview');
  const systemBox = h('div', {}, h('p', { class: 'muted' }, 'Wird geladen …'));
  const refresh = async () => {
    if (!document.body.contains(systemBox)) {
      clearInterval(metricsTimer);
      metricsTimer = null;
      return;
    }
    try {
      renderSystem(systemBox, await api('/api/admin/metrics'));
    } catch {}
  };
  clearInterval(metricsTimer);
  metricsTimer = setInterval(refresh, 5000);
  setTimeout(refresh, 0);
  const tile = (label, value, sub) => h('div', { class: 'stat-tile' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), sub ? h('div', { class: 'stat-sub' }, sub) : null);
  const pending = o.users.pending || 0;
  const total = (o.users.active || 0) + pending + (o.users.disabled || 0);
  section('Übersicht',
    pending ? h('a', { class: 'notice warn', href: '#users' }, `⏳ ${pending} Registrierung${pending > 1 ? 'en warten' : ' wartet'} auf Freigabe →`) : null,
    !o.mailConfigured ? h('a', { class: 'notice warn', href: '#mail' }, '✉️ Es ist noch kein Mailserver eingerichtet. Ohne Mailserver ist keine Registrierung möglich (E-Mail-Bestätigung), und „Kennwort vergessen“ funktioniert nicht →') : null,
    o.mailConfigured && !o.baseUrl ? h('a', { class: 'notice', href: '#settings' }, '🔗 Tipp: Trage unter „Allgemein“ die öffentliche Adresse ein, damit Links in E-Mails auch bei Zugriff über einen Domainnamen funktionieren →') : null,
    !o.virusScanner.configured ? h('a', { class: 'notice warn', href: '#security' }, o.requireVirusScan
      ? '🦠 Es ist kein Virenscanner eingerichtet – Datei-Uploads sind deshalb gesperrt. Mit docker compose wird ClamAV automatisch mitgestartet (CLAMAV_HOST) →'
      : '🦠 Es ist kein Virenscanner eingerichtet – hochgeladene Dateien werden nicht auf Schadsoftware geprüft →') : null,
    o.virusScanner.configured && !o.virusScanner.reachable ? h('a', { class: 'notice warn', href: '#security' }, `🦠 Der Virenscanner ist nicht erreichbar (${o.virusScanner.error}). Nach einem Neustart braucht ClamAV einige Minuten.`) : null,
    o.virusScanner.outdated ? h('a', { class: 'notice warn', href: '#security' }, '🦠 Die Virensignaturen sind älter als drei Tage – bitte die automatische Aktualisierung (freshclam) prüfen.') : null,
    o.withoutEmail ? h('a', { class: 'notice warn', href: '#users' }, `✉️ ${o.withoutEmail} Konto${o.withoutEmail === 1 ? '' : 'en'} ohne E-Mail-Adresse. Angemeldet wird mit der E-Mail-Adresse – diese Konten können sich nur übergangsweise mit ihrem Namen anmelden. Bitte Adressen ergänzen →`) : null,
    o.network.hint === 'proxy' ? h('div', { class: 'notice warn' }, `🌐 Die Anfrage kam über einen Reverse-Proxy (X-Forwarded-For), TRUST_PROXY ist aber nicht gesetzt. Im Protokoll und bei den Anmeldesperren steht deshalb die Adresse des Proxys (${o.network.ip}) statt der echten Adresse. Lösung: TRUST_PROXY=1 in der .env setzen (siehe README, „Echte IP-Adressen“).`) : null,
    o.network.hint === 'gateway' ? h('div', { class: 'notice warn' }, `🌐 Deine Anfrage kommt beim Server von ${o.network.ip} an – das ist vermutlich das Docker-Netz, nicht deine Adresse. Im Protokoll und bei den Anmeldesperren landen dann alle Zugriffe unter derselben Adresse. Lösungen stehen im README unter „Echte IP-Adressen“.`) : null,
        o.failedLogins24h >= 20 ? h('a', { class: 'notice warn', href: '#audit' }, `🔐 ${o.failedLogins24h} fehlgeschlagene Anmeldungen in den letzten 24 Stunden →`) : null,
    h('div', { class: 'stat-grid' },
      tile('Benutzer', total, `${o.users.active || 0} aktiv · ${pending} wartend · ${o.users.disabled || 0} deaktiviert`),
      tile('Sicherheit', `${o.mfaUsers} / ${total}`, `mit Zwei-Faktor-Anmeldung · ${o.unverified} unbestätigt`),
      tile('Fehlgeschlagene Anmeldungen', o.failedLogins24h, 'in den letzten 24 Stunden'),
      tile('Boards', o.boards, `${o.elements.toLocaleString('de-DE')} Elemente`),
      tile('Gerade online', o.online, `auf ${o.activeBoards} Board${o.activeBoards === 1 ? '' : 's'}`),
      tile('Teams & Gäste', `${o.teams} / ${o.guests}`, 'Teams · aktive Gastzugänge'),
      tile('Angemeldete Sitzungen', o.sessions),
      tile('Datenbank', fmtBytes(o.dbSize), o.pgVersion),
      tile('Virenscanner', o.virusScanner.configured ? (o.virusScanner.reachable ? 'aktiv' : 'nicht erreichbar') : 'aus',
        o.virusScanner.reachable ? `${o.virusScanner.engine} · Signaturen ${o.virusScanner.signatures}${o.virusScanner.signaturesDate ? ' vom ' + new Date(o.virusScanner.signaturesDate).toLocaleDateString('de-DE') : ''} · ${o.uploadsBlocked30d} blockiert${o.uploadsUnscanned30d ? `, ${o.uploadsUnscanned30d} ungeprüft angenommen` : ''} (30 Tage)` : ''),
      tile('System', 'v' + o.version, `Laufzeit ${fmtUptime(o.uptime)} · ${o.disposableDomains.toLocaleString('de-DE')} gesperrte Wegwerf-Domains`),
    ),
    h('div', { class: 'version-history' }, h('h3', {}, 'System'), systemBox),
    o.versionHistory.length ? h('div', { class: 'version-history' }, h('h3', {}, 'Versionshistorie'),
      h('table', { class: 'admin-table' }, h('thead', {}, h('tr', {}, ['Version', 'vorher', 'Schema', 'Sicherung vor dem Upgrade', 'gestartet'].map((t) => h('th', {}, t)))),
        h('tbody', {}, o.versionHistory.map((v) => h('tr', {}, h('td', {}, h('b', {}, v.version)), h('td', {}, v.previous || '–'), h('td', {}, v.schema),
          h('td', { class: 'small' }, v.backup || h('span', { class: 'muted' }, '–')), h('td', {}, fmtDate(v.started_at))))))) : null);
}

/* ---------------- Benutzerverwaltung ---------------- */

async function users() {
  const list = await api('/api/admin/users');
  const search = h('input', { type: 'search', placeholder: 'Name, Benutzername oder E-Mail …', class: 'admin-search' });
  const filter = h('select', { class: 'admin-filter' },
    [['', 'Alle'], ['pending', 'Wartet auf Freigabe'], ['unverified', 'E-Mail unbestätigt'], ['disabled', 'Deaktiviert'], ['admin', 'Administratoren'], ['nomfa', 'Ohne Zwei-Faktor']].map(([v, l]) => h('option', { value: v }, l)));
  const table = h('div', { class: 'table-wrap' });
  const count = h('span', { class: 'muted small' });
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const f = filter.value;
    const rows = list.filter((u) => (!q || [u.displayName, u.email].join(' ').toLowerCase().includes(q))
      && (!f || (f === 'pending' && u.status === 'pending') || (f === 'disabled' && u.status === 'disabled') || (f === 'unverified' && !u.emailVerified)
        || (f === 'admin' && u.role === 'admin') || (f === 'nomfa' && !u.mfa)));
    count.textContent = `${rows.length} von ${list.length}`;
    table.innerHTML = '';
    table.append(h('table', { class: 'admin-table' },
      h('thead', {}, h('tr', {}, ['Benutzer', 'E-Mail', 'Rolle', 'Status', '2FA', 'Boards', 'Letzte Anmeldung', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((u) => {
        const [sl, sc] = STATUS[u.status];
        const actions = h('button', { class: 'icon-btn small', title: 'Aktionen', html: ICONS.more });
        actions.onclick = () => userMenu(actions, u);
        return h('tr', { class: u.status === 'pending' ? 'row-warn' : '' },
          h('td', {}, h('div', { class: 'user-cell' }, h('span', { class: 'avatar sm', style: { background: u.color } }, initials(u.displayName)),
            h('div', {}, h('b', {}, u.displayName), h('div', { class: 'muted small' }, (u.email || 'ohne E-Mail-Adresse') + (u.id === me.id ? ' · du' : ''))))),
          h('td', {}, u.email ? h('div', {}, u.email, ' ', u.emailVerified ? h('span', { class: 'pill ok', title: 'bestätigt' }, '✓') : h('span', { class: 'pill warn' }, 'unbestätigt')) : h('span', { class: 'muted' }, '–'),
            u.pendingEmail ? h('div', { class: 'muted small' }, '→ ' + u.pendingEmail + ' (wartet)') : null),
          h('td', {}, u.role === 'admin' ? h('span', { class: 'pill accent' }, 'Admin') : 'Benutzer'),
          h('td', {}, h('span', { class: 'pill ' + sc }, sl), u.status === 'pending' && u.emailVerified ? h('button', { class: 'btn small primary', style: { marginLeft: '8px' }, onclick: () => patchUser(u, { status: 'active' }, 'Freigeschaltet') }, 'Freischalten') : null),
          h('td', {}, u.mfa ? h('span', { class: 'pill ok', title: `${u.recoveryCodesLeft} Wiederherstellungscodes übrig` }, 'an') : h('span', { class: 'muted' }, 'aus')),
          h('td', {}, u.boardCount),
          h('td', { title: u.lastLoginAt ? fmtDate(u.lastLoginAt) : '' }, u.lastLoginAt ? relTime(new Date(u.lastLoginAt).getTime()) : h('span', { class: 'muted' }, 'nie')),
          h('td', { class: 'actions' }, actions));
      }))));
  };
  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  section('Benutzerverwaltung',
    h('div', { class: 'admin-toolbar' }, search, filter, count, h('span', { class: 'spacer' }), h('button', { class: 'btn primary', onclick: () => createUser() }, h('span', { html: ICONS.plus }), 'Benutzer anlegen')),
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

async function post(url, msg) {
  try {
    const r = await api(url, { method: 'POST' });
    toast(typeof msg === 'function' ? msg(r) : msg);
    return r;
  } catch (e) {
    toast(e.message);
  }
}

function userMenu(anchor, u) {
  const self = u.id === me.id;
  menu(anchor, [
    { label: 'Bearbeiten …', icon: 'edit', onClick: () => editUser(u) },
    u.status === 'pending' ? { label: 'Freischalten', icon: 'check', onClick: () => patchUser(u, { status: 'active' }, 'Freigeschaltet') } : null,
    !u.emailVerified && u.email ? { label: 'Bestätigungsmail erneut senden', icon: 'comment', onClick: () => post(`/api/admin/users/${u.id}/resend-verification`, (r) => `Bestätigungsmail an ${r.email} gesendet`) } : null,
    !u.emailVerified && u.email ? { label: 'E-Mail manuell bestätigen', icon: 'check', onClick: () => patchUser(u, { emailVerified: true }, 'E-Mail-Adresse als bestätigt markiert') } : null,
    { label: 'Link zum Kennwort-Zurücksetzen', icon: 'link', onClick: () => resetLink(u) },
    u.mfa && !self ? { label: 'Zwei-Faktor-Anmeldung zurücksetzen', icon: 'unlock', onClick: async () => {
      if (await confirmDialog('Zwei-Faktor zurücksetzen', `${u.displayName} kann sich danach wieder nur mit Kennwort anmelden und die Zwei-Faktor-Anmeldung neu einrichten. Nur nach sicherer Identitätsprüfung verwenden.`, 'Zurücksetzen', true)) patchUser(u, { resetMfa: true }, 'Zwei-Faktor-Anmeldung zurückgesetzt');
    } } : null,
    u.sessionCount && !self ? { label: `Alle Sitzungen beenden (${u.sessionCount})`, icon: 'close', onClick: () => post(`/api/admin/users/${u.id}/revoke-sessions`, 'Sitzungen beendet').then(users) } : null,
    u.status === 'active' && !self ? { label: 'Deaktivieren', icon: 'lock', onClick: () => patchUser(u, { status: 'disabled' }, 'Deaktiviert') } : null,
    u.status === 'disabled' ? { label: 'Aktivieren', icon: 'unlock', onClick: () => patchUser(u, { status: 'active' }, 'Aktiviert') } : null,
    !self ? { label: u.role === 'admin' ? 'Adminrechte entziehen' : 'Zum Admin machen', icon: 'settings', onClick: () => patchUser(u, { role: u.role === 'admin' ? 'user' : 'admin' }) } : null,
    { label: 'Protokoll anzeigen', icon: 'layers', onClick: () => (location.hash = 'audit/' + encodeURIComponent(u.email || u.displayName)) },
    !self ? '-' : null,
    !self ? { label: 'Löschen …', icon: 'trash', danger: true, onClick: () => deleteUser(u) } : null,
  ], { placement: 'left' });
}

function createUser() {
  const err = errorBox();
  const username = h('input', { type: 'text', required: true, maxlength: 60 });
  const email = h('input', { type: 'email', required: true });
  const role = h('select', {}, h('option', { value: 'user' }, 'Benutzer'), h('option', { value: 'admin' }, 'Administrator'));
  const inviteRadio = h('input', { type: 'radio', name: 'pwmode', checked: true });
  const pwRadio = h('input', { type: 'radio', name: 'pwmode' });
  const pw = h('input', { type: 'password', autocomplete: 'new-password', disabled: true, maxlength: 256 });
  const sync = () => {
    pw.disabled = inviteRadio.checked;
  };
  inviteRadio.addEventListener('change', sync);
  pwRadio.addEventListener('change', sync);
  sync();
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      const r = await api('/api/admin/users', { method: 'POST', body: { name: username.value, email: email.value, role: role.value, password: pwRadio.checked ? pw.value : '' } });
      m.close();
      toast(r.invited ? `Einladung an ${r.email} verschickt` : r.inviteError ? `Benutzer angelegt, Einladung fehlgeschlagen: ${r.inviteError}` : 'Benutzer angelegt', 5000);
      users();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('label', {}, 'Name', username, h('span', { class: 'field-hint' }, 'Muss nicht eindeutig sein.')),
  h('label', {}, 'E-Mail-Adresse', email, h('span', { class: 'field-hint' }, 'Damit meldet sich die Person an. Vom Admin eingetragene Adressen gelten als bestätigt.')),
  h('label', {}, 'Rolle', role),
  h('div', {}, h('div', { class: 'label' }, 'Kennwort'),
    h('label', { class: 'check' }, inviteRadio, 'Einladung per E-Mail – die Person legt ihr Kennwort selbst fest (empfohlen)'),
    h('label', { class: 'check' }, pwRadio, 'Kennwort jetzt festlegen'), pw),
  err.el,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, 'Anlegen')));
  const m = modal('Benutzer anlegen', form);
  setTimeout(() => username.focus(), 0);
}

function editUser(u) {
  const self = u.id === me.id; // eigene Rolle/Status nicht hier ändern (Selbstaussperrung)
  const err = errorBox();
  const display = h('input', { type: 'text', value: u.displayName, required: true, maxlength: 60 });
  const email = h('input', { type: 'email', value: u.email, required: !!u.email });
  const role = h('select', { disabled: self }, h('option', { value: 'user', selected: u.role === 'user' }, 'Benutzer'), h('option', { value: 'admin', selected: u.role === 'admin' }, 'Administrator'));
  const status = h('select', { disabled: self }, Object.entries(STATUS).map(([k, [l]]) => h('option', { value: k, selected: u.status === k }, l)));
  const pw = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'unverändert lassen', maxlength: 256 });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      await api('/api/admin/users/' + u.id, { method: 'PATCH', body: { displayName: display.value, email: email.value, ...(self ? {} : { role: role.value, status: status.value }), ...(pw.value ? { password: pw.value } : {}) } });
      m.close();
      toast('Gespeichert');
      users();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('label', {}, 'Name', display),
  h('label', {}, 'E-Mail-Adresse (Anmeldung)', email, h('span', { class: 'field-hint' }, !u.email ? 'Fehlt – ohne E-Mail-Adresse ist die Anmeldung nur übergangsweise mit dem Namen möglich.' : u.emailVerified ? 'Bestätigt. Eine neue Adresse gilt als bestätigt.' : 'Noch nicht bestätigt.')),
  h('div', { class: 'form-row' }, h('label', {}, 'Rolle', role), h('label', {}, 'Status', status)),
  h('label', {}, 'Neues Kennwort', pw, h('span', { class: 'field-hint' }, 'Besser: „Link zum Kennwort-Zurücksetzen“ im Aktionsmenü. Ein neues Kennwort meldet alle Sitzungen ab.')),
  err.el,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, 'Speichern')));
  const m = modal(`Benutzer bearbeiten: ${u.displayName}`, form);
}

async function resetLink(u) {
  try {
    const r = await api(`/api/admin/users/${u.id}/reset-link`, { method: 'POST' });
    if (r.sent) return toast(`E-Mail an ${r.email} verschickt`);
    const input = h('input', { type: 'text', value: r.link, readonly: true, onclick: (e) => e.target.select() });
    modal('Link zum Kennwort-Zurücksetzen', h('div', { class: 'form' },
      h('p', {}, r.error ? `Die E-Mail konnte nicht verschickt werden (${r.error}). Gib den Link bitte selbst weiter:` : `Für ${u.displayName} ist keine E-Mail-Adresse oder kein Mailserver hinterlegt. Gib diesen Link auf sicherem Weg weiter – er ist 24 Stunden gültig:`),
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
    h('p', {}, `„${u.displayName}“ (${u.email || 'ohne E-Mail-Adresse'}) wird endgültig gelöscht.`),
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
          { label: 'Öffnen', icon: 'fit', onClick: () => window.open('/board/' + b.id, '_blank', 'noopener') },
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
          h('td', {}, h('a', { href: '/board/' + b.id, target: '_blank', rel: 'noopener' }, b.name), b.online ? h('span', { class: 'pill ok', style: { marginLeft: '8px' } }, b.online + ' online') : null),
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
  const sel = h('select', {}, userList.filter((u) => u.status === 'active').map((u) => h('option', { value: u.id, selected: u.id === b.ownerId }, `${u.displayName} (${u.email || 'ohne E-Mail'})`)));
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

const LOG_LEVELS = [
  ['trace', 'trace – alles, auch Einzelschritte (nur zur Fehlersuche)'],
  ['debug', 'debug – zusätzlich jede Anfrage und abgelehnte Anfragen'],
  ['info', 'info – Start, Upgrades, wichtige Abläufe (empfohlen)'],
  ['warn', 'warn – nur Warnungen und Fehler'],
  ['error', 'error – nur Fehler'],
  ['fatal', 'fatal – nur Fehler, die den Betrieb beenden'],
  ['silent', 'silent – nichts protokollieren'],
];

async function settings() {
  const all = await api('/api/admin/settings');
  const s = all.general;
  const logLevel = h('select', {}, h('option', { value: '' }, `Vorgabe aus LOG_LEVEL (${all.logInfo.envLevel})`),
    LOG_LEVELS.map(([v, l]) => h('option', { value: v, selected: all.logging.level === v }, l)));
  const err = errorBox();
  const siteName = h('input', { type: 'text', value: s.siteName, maxlength: 60 });
  const baseUrl = h('input', { type: 'url', value: s.baseUrl, placeholder: location.origin });
  const radio = (v, label, hint) => h('label', { class: 'radio-card' }, h('input', { type: 'radio', name: 'reg', value: v, checked: s.registration === v }), h('div', {}, h('b', {}, label), h('div', { class: 'muted small' }, hint)));
  const notifyAdmins = h('input', { type: 'checkbox', checked: s.notifyAdmins });
  const form = h('form', { class: 'form admin-form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { general: {
        siteName: siteName.value, baseUrl: baseUrl.value, registration: form.querySelector('input[name=reg]:checked').value, notifyAdmins: notifyAdmins.checked,
      }, logging: { level: logLevel.value } } });
      toast('Einstellungen gespeichert');
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('fieldset', {}, h('legend', {}, 'Instanz'),
    h('label', {}, 'Name der Anwendung', siteName, h('span', { class: 'field-hint' }, 'Erscheint auf der Anmeldeseite, im Betreff von E-Mails und in Authenticator-Apps.')),
    h('label', {}, 'Öffentliche Adresse', baseUrl, h('span', { class: 'field-hint' }, 'Wird für Links in E-Mails verwendet, z. B. https://board.example.de. Leer: nur Zugriffe über localhost oder die IP-Adressen dieses Servers erzeugen Links.'))),
  h('fieldset', {}, h('legend', {}, 'Registrierung'),
    radio('open', 'Offen', 'Jede Person kann sich registrieren; nach Bestätigung der E-Mail-Adresse ist das Konto aktiv.'),
    radio('approval', 'Mit Freigabe', 'Nach Bestätigung der E-Mail-Adresse muss ein Administrator das Konto freischalten.'),
    radio('closed', 'Geschlossen', 'Nur Administratoren legen Konten an bzw. laden ein.'),
    h('label', { class: 'check' }, notifyAdmins, 'Administratoren per E-Mail über Registrierungen informieren, die auf Freigabe warten'),
    h('p', { class: 'muted small' }, 'Die E-Mail-Bestätigung ist immer erforderlich. Regeln für Kennwörter und E-Mail-Domains findest du unter „Sicherheit“.')),
  h('fieldset', {}, h('legend', {}, 'Protokollierung (Server-Log)'),
    h('label', {}, 'Protokollstufe', logLevel, h('span', { class: 'field-hint' },
      `Gilt sofort, ohne Neustart. Aktuell: ${all.logInfo.current} · Ausgabeformat: ${all.logInfo.format === 'json' ? 'JSON' : 'Text'} (LOG_FORMAT). Das Protokoll erscheint in der Konsole bzw. in „docker compose logs app“. Geheimnisse wie Kennwörter und Tokens werden geschwärzt, IP-Adressen nicht protokolliert.`)),
    h('p', { class: 'muted small' }, 'Sicherheitsrelevante Ereignisse (Anmeldungen, Änderungen) stehen unabhängig davon im „Protokoll“ der Administration.')),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, 'Speichern')));
  section('Allgemeine Einstellungen', form);
}

/* ---------------- Sicherheit ---------------- */

async function security() {
  const all = await api('/api/admin/settings');
  const s = all.security;
  const vs = all.virusScanner;
  const requireScan = h('input', { type: 'checkbox', checked: s.requireVirusScan });
  const failOpen = h('input', { type: 'checkbox', checked: s.virusScanFailOpen });
  const err = errorBox();
  const minLen = h('input', { type: 'number', min: 8, max: 64, value: s.passwordMinLength });
  const hibp = h('input', { type: 'checkbox', checked: s.hibpCheck });
  const disposable = h('input', { type: 'checkbox', checked: s.blockDisposable });
  const blocked = h('textarea', { rows: 4, placeholder: 'eine Domain pro Zeile, z. B. example.com' }, s.blockedDomains);
  const allowed = h('textarea', { rows: 3, placeholder: 'leer = alle Domains erlaubt' }, s.allowedDomains);
  const requireMfa = h('input', { type: 'checkbox', checked: s.requireMfaAdmins });
  const form = h('form', { class: 'form admin-form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { security: {
        passwordMinLength: Number(minLen.value), hibpCheck: hibp.checked, blockDisposable: disposable.checked,
        blockedDomains: blocked.value, allowedDomains: allowed.value, requireMfaAdmins: requireMfa.checked,
        requireVirusScan: requireScan.checked, virusScanFailOpen: failOpen.checked,
      } } });
      toast('Sicherheitseinstellungen gespeichert');
      security();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('fieldset', {}, h('legend', {}, 'Kennwörter'),
    h('label', {}, 'Mindestlänge', minLen, h('span', { class: 'field-hint' }, 'Empfohlen: 12 oder mehr. Zusätzlich werden die 10.000 häufigsten Kennwörter, einfache Muster und Kennwörter mit Benutzername/E-Mail abgelehnt. Erzwungene Sonderzeichen gibt es bewusst nicht (NIST SP 800-63B).')),
    h('label', { class: 'check' }, hibp, 'Kennwörter mit bekannten Datenlecks ablehnen („Have I Been Pwned“)'),
    h('p', { class: 'muted small' }, 'Dabei werden nur die ersten 5 Zeichen eines SHA-1-Hashs an api.pwnedpasswords.com übertragen (k-Anonymität), nie das Kennwort selbst. Ist der Dienst nicht erreichbar, wird die Prüfung übersprungen.')),
  h('fieldset', {}, h('legend', {}, 'E-Mail-Domains'),
    h('label', { class: 'check' }, disposable, 'Wegwerf-E-Mail-Adressen sperren (mehrere Tausend bekannte Anbieter)'),
    h('label', {}, 'Zusätzlich gesperrte Domains', blocked),
    h('label', {}, 'Nur diese Domains zulassen', allowed, h('span', { class: 'field-hint' }, 'Z. B. die Firmendomain. Ist hier etwas eingetragen, sind alle anderen Domains gesperrt. Subdomains sind eingeschlossen.'))),
  h('fieldset', {}, h('legend', {}, 'Virenscan für hochgeladene Dateien'),
    h('p', {}, vs.configured
      ? (vs.reachable
        ? h('span', {}, h('span', { class: 'pill ok' }, 'aktiv'), ` ${vs.engine}, Signaturen ${vs.signatures}${vs.signaturesDate ? ' vom ' + new Date(vs.signaturesDate).toLocaleString('de-DE') : ''}. Die Signaturen aktualisiert ClamAV selbstständig (freshclam).`)
        : h('span', {}, h('span', { class: 'pill warn' }, 'nicht erreichbar'), ` ${vs.error || ''}`))
      : h('span', {}, h('span', { class: 'pill off' }, 'nicht eingerichtet'), ' Mit docker compose wird ClamAV automatisch mitgestartet. Ohne Docker: ClamAV (clamd) installieren und CLAMAV_HOST/CLAMAV_PORT setzen.')),
    h('p', { class: 'muted small' }, 'Geprüft werden alle hochgeladenen Bilder (Einfügen, Drag & Drop, Upload), Bilder in importierten Boards und Vorschaubilder. Zusätzlich muss der Dateiinhalt zum angegebenen Bildtyp passen.'),
    h('label', { class: 'check' }, requireScan, 'Uploads sperren, solange kein Virenscanner eingerichtet ist (empfohlen)'),
    h('label', { class: 'check' }, failOpen, 'Uploads trotzdem annehmen, wenn der Scanner vorübergehend nicht erreichbar ist (nicht empfohlen)')),
  h('fieldset', {}, h('legend', {}, 'Zwei-Faktor-Anmeldung'),
    h('label', { class: 'check' }, requireMfa, 'Für Administratoren verpflichtend'),
    h('p', { class: 'muted small' }, 'Administratoren ohne Zwei-Faktor-Anmeldung haben dann keinen Zugriff auf die Administration, bis sie sie im Profil unter „Sicherheit & Geräte“ eingerichtet haben. Jeder Benutzer kann sie freiwillig nutzen.'),
    me.mfa ? null : h('p', { class: 'notice warn' }, 'Dein eigenes Konto hat noch keine Zwei-Faktor-Anmeldung.', ' ', h('button', { type: 'button', class: 'btn small', onclick: () => openSecurityDialog(me, (u) => (me = u)) }, 'Jetzt einrichten'))),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, 'Speichern')));
  section('Sicherheit', form);
}

/* ---------------- Zusammenarbeit ---------------- */

async function collab() {
  const all = await api('/api/admin/settings');
  const c = all.collab;
  const err = errorBox();
  const mentionEmails = h('input', { type: 'checkbox', checked: c.mentionEmails });
  const guestLinks = h('input', { type: 'checkbox', checked: c.guestLinks });
  const guestMaxDays = h('input', { type: 'number', min: 1, max: 365, value: c.guestMaxDays });
  const teamCreation = h('select', {}, h('option', { value: 'all', selected: c.teamCreation === 'all' }, 'alle angemeldeten Benutzer'), h('option', { value: 'admins', selected: c.teamCreation === 'admins' }, 'nur Administratoren'));
  const recordings = h('input', { type: 'checkbox', checked: c.recordings });
  const recordingMax = h('input', { type: 'number', min: 1, max: 30, value: c.recordingMaxMinutes });
  const files = h('input', { type: 'checkbox', checked: c.files });
  const fileMax = h('input', { type: 'number', min: 1, max: 100, value: c.fileMaxMb });
  const trashDays = h('input', { type: 'number', min: 1, max: 365, value: c.trashDays });
  const webhooks = h('input', { type: 'checkbox', checked: c.webhooks });
  const webhookPrivate = h('input', { type: 'checkbox', checked: c.webhookPrivate });
  const form = h('form', { class: 'form admin-form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    if (c.guestLinks && !guestLinks.checked && !(await confirmDialog('Gastzugang abschalten', 'Alle bestehenden Gastlinks werden gesperrt und alle Gäste sofort abgemeldet.', 'Abschalten', true))) return;
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { collab: {
        mentionEmails: mentionEmails.checked, guestLinks: guestLinks.checked, guestMaxDays: Number(guestMaxDays.value),
        teamCreation: teamCreation.value, recordings: recordings.checked, recordingMaxMinutes: Number(recordingMax.value),
        files: files.checked, fileMaxMb: Number(fileMax.value), trashDays: Number(trashDays.value),
        webhooks: webhooks.checked, webhookPrivate: webhookPrivate.checked,
      } } });
      toast('Einstellungen gespeichert');
      collab();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('fieldset', {}, h('legend', {}, 'Benachrichtigungen'),
    h('label', { class: 'check' }, mentionEmails, 'E-Mails bei @Erwähnungen, Antworten und zugewiesenen Kommentaren verschicken'),
    h('p', { class: 'muted small' }, 'In der Glocke erscheinen Benachrichtigungen immer. E-Mails gehen nur an Personen, die gerade nicht im Board sind – höchstens eine je Board alle zehn Minuten. Jede Person kann sie im Profil abschalten. Voraussetzung ist ein eingerichteter Mailserver.')),
  h('fieldset', {}, h('legend', {}, 'Gastzugang per Link'),
    h('label', { class: 'check' }, guestLinks, 'Besitzer dürfen Gastlinks erstellen (Zugang ohne Konto)'),
    h('label', {}, 'Längste Gültigkeit eines Gastlinks (Tage)', guestMaxDays),
    h('p', { class: 'muted small' }, 'Gäste geben nur einen Namen an, sehen ausschließlich das eine Board und dürfen höchstens kommentieren. Ihre Zugänge werden mit Ablauf oder Sperre des Links gelöscht. Bitte die Datenschutzerklärung ergänzen (Vorlage unter „Rechtliches“).')),
  h('fieldset', {}, h('legend', {}, 'Teams'),
    h('label', {}, 'Teams anlegen dürfen', teamCreation)),
  h('fieldset', {}, h('legend', {}, 'Aufzeichnungen (Rundgänge)'),
    h('label', { class: 'check' }, recordings, 'Aufzeichnungen erlauben (Ansicht, Zeiger, Laser – optional mit Ton)'),
    h('label', {}, 'Längste Aufzeichnung (Minuten)', recordingMax),
    h('p', { class: 'muted small' }, 'Tonspuren werden wie Uploads auf Schadsoftware geprüft und bis zum Löschen der Aufzeichnung gespeichert.')),
  h('fieldset', {}, h('legend', {}, 'Dateianhänge'),
    h('label', { class: 'check' }, files, 'Dateien auf Boards erlauben (PDF, Word, Excel, PowerPoint, OpenDocument, Text, CSV, JSON)'),
    h('label', {}, 'Größte Datei (MB)', fileMax),
    h('p', { class: 'muted small' }, 'Der Dateityp wird am Inhalt erkannt, jede Datei auf Schadsoftware geprüft und immer als Download ausgeliefert. Nicht mehr verwendete Dateien werden nach sieben Tagen entfernt.')),
  h('fieldset', {}, h('legend', {}, 'Papierkorb'),
    h('label', {}, 'Gelöschte Boards aufbewahren (Tage)', trashDays),
    h('p', { class: 'muted small' }, 'Bis dahin können Besitzer gelöschte Boards wiederherstellen; danach werden sie endgültig entfernt.')),
  h('fieldset', {}, h('legend', {}, 'Chat-Anbindung (Webhooks)'),
    h('label', { class: 'check' }, webhooks, 'Webhooks erlauben (Microsoft Teams, Slack, Matrix oder JSON)'),
    h('label', { class: 'check' }, webhookPrivate, 'Auch interne Adressen zulassen (Intranet, localhost) und http ohne Verschlüsselung'),
    h('p', { class: 'muted small' }, 'Personen können Benachrichtigungen an einen eigenen Kanal schicken lassen, Team-Verwaltende neue Team-Boards und Retro-Zusammenfassungen. Der Server ruft dabei fremde Adressen auf; interne Netze sind gesperrt, solange die zweite Option aus ist. Die Weitergabe an den Chat-Dienst gehört in die Datenschutzerklärung.')),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, 'Speichern')));
  section('Zusammenarbeit', form);
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
    h('option', { value: 'none', selected: s.security === 'none' }, 'Keine Verschlüsselung (nur im lokalen Netz!)'));
  security.addEventListener('change', () => {
    const def = { starttls: 587, tls: 465, none: 25 }[security.value];
    if ([25, 465, 587].includes(Number(port.value))) port.value = def;
  });
  const user = h('input', { type: 'text', value: s.user, autocomplete: 'off' });
  const pass = h('input', { type: 'password', autocomplete: 'new-password', placeholder: s.hasPassword ? '•••••••• (gespeichert – leer lassen zum Beibehalten)' : '' });
  const clearPw = h('input', { type: 'checkbox' });
  const from = h('input', { type: 'text', value: s.from, placeholder: 'vibeboard <noreply@example.de>' });
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
  h('p', { class: 'muted' }, 'Der Mailserver wird für die E-Mail-Bestätigung bei der Registrierung, „Kennwort vergessen“, Einladungen und Sicherheitshinweise verwendet. Ohne Mailserver ist keine Registrierung möglich.'),
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
    h('div', { class: 'copy-row' }, testTo, h('button', { type: 'button', class: 'btn', onclick: async () => {
      testResult.className = 'test-result';
      testResult.textContent = 'Sende …';
      try {
        await api('/api/admin/test-mail', { method: 'POST', body: { to: testTo.value, smtp: values() } });
        testResult.className = 'test-result ok';
        testResult.textContent = `✅ Testnachricht an ${testTo.value} wurde vom Server angenommen.`;
      } catch (ex) {
        testResult.className = 'test-result fail';
        testResult.textContent = '❌ ' + ex.message;
      }
    } }, 'Testmail senden')),
    testResult));
  section('Mailserver', form);
}

/* ---------------- Rechtliches: Impressum & Datenschutz ---------------- */

async function legal() {
  const l = (await api('/api/admin/settings')).legal;
  const docs = {
    imprint: { label: 'Impressum', path: '/impressum', template: IMPRINT_TEMPLATE },
    privacy: { label: 'Datenschutzerklärung', path: '/datenschutz', template: PRIVACY_TEMPLATE },
  };
  let current = (location.hash.split('/')[1] === 'privacy') ? 'privacy' : 'imprint';
  const texts = { imprint: l.imprint || '', privacy: l.privacy || '' };
  const err = errorBox();
  const tabs = h('div', { class: 'seg' });
  const editor = h('textarea', { class: 'legal-editor', rows: 24, spellcheck: true });
  const preview = h('article', { class: 'legal-text legal-preview' });
  const status = h('div', { class: 'muted small' });
  const updated = (k) => l[k + 'UpdatedAt'] ? 'zuletzt geändert am ' + new Date(l[k + 'UpdatedAt']).toLocaleString('de-DE') : 'noch nicht veröffentlicht';

  const renderPreview = () => {
    preview.innerHTML = '';
    preview.append(h('h1', {}, docs[current].label));
    if (editor.value.trim()) preview.append(renderMarkdown(editor.value));
    else preview.append(h('p', { class: 'muted' }, 'Kein Text – die Seite wird nicht verlinkt.'));
  };
  const select = (k) => {
    texts[current] = editor.value;
    current = k;
    editor.value = texts[k];
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.k === k));
    status.innerHTML = '';
    status.append(`Öffentlich unter `, h('a', { href: docs[k].path, target: '_blank', rel: 'noopener' }, location.origin + docs[k].path), ` · ${updated(k)}`);
    renderPreview();
  };
  for (const [k, d] of Object.entries(docs)) tabs.append(h('button', { type: 'button', class: 'btn small', 'data-k': k, onclick: () => select(k) }, d.label));
  let t;
  editor.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(renderPreview, 150);
  });

  const form = h('form', { class: 'form legal-form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    texts[current] = editor.value;
    try {
      const r = await api('/api/admin/settings', { method: 'PUT', body: { legal: { imprint: texts.imprint, privacy: texts.privacy } } });
      Object.assign(l, r.legal);
      toast('Gespeichert und veröffentlicht');
      select(current);
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('div', { class: 'notice' }, h('b', {}, 'Hinweis: '), 'Die Vorlagen sind Formulierungshilfen, die auf die tatsächliche Datenverarbeitung von vibeboard zugeschnitten sind. Sie ersetzen keine Rechtsberatung. Ersetze alle Angaben in [eckigen Klammern], entferne nicht zutreffende Abschnitte und lass die Texte im Zweifel prüfen.'),
  h('div', { class: 'admin-toolbar' }, tabs, h('span', { class: 'spacer' }),
    h('button', { type: 'button', class: 'btn small', onclick: async () => {
      if (editor.value.trim() && !(await confirmDialog('Vorlage einfügen', 'Der aktuelle Text wird durch die Vorlage ersetzt.', 'Ersetzen', true))) return;
      editor.value = docs[current].template;
      renderPreview();
    } }, 'Vorlage einfügen')),
  status,
  h('div', { class: 'legal-split' },
    h('div', { class: 'legal-col' }, editor,
      h('details', { class: 'md-help' }, h('summary', {}, 'Formatierung'),
        h('pre', {}, '# Überschrift\n\nAbsatz – Zeilenumbrüche bleiben erhalten.\n\n- Aufzählung\n- noch ein Punkt\n\n**fett**  *kursiv*\n[Linktext](https://example.de)\nE-Mail-Adressen und https://…-Links werden automatisch verlinkt.\n\n---  (Trennlinie)'))),
    h('div', { class: 'legal-col' }, h('div', { class: 'label' }, 'Vorschau'), preview)),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, 'Speichern & veröffentlichen'),
    h('span', { class: 'muted small' }, 'Leere Texte werden nicht veröffentlicht; die Links verschwinden dann automatisch.')));
  section('Impressum & Datenschutz', form);
  // Gespeicherten Text zuerst in den Editor laden – select() übernimmt sonst den leeren Editor als Text
  editor.value = texts[current] || '';
  select(current);
}

/* ---------------- Sicherheitsprotokoll ---------------- */

async function audit() {
  const preset = decodeURIComponent(location.hash.split('/')[1] || '');
  const search = h('input', { type: 'search', placeholder: 'Benutzer oder IP …', class: 'admin-search', value: preset });
  const filter = h('select', { class: 'admin-filter' }, h('option', { value: '' }, 'Alle Ereignisse'));
  const table = h('div', { class: 'table-wrap' });
  const more = h('button', { class: 'btn small hidden' }, 'Ältere laden');
  let entries = [];
  let labelsLoaded = false;

  async function load(append = false) {
    const p = new URLSearchParams({ limit: 200 });
    if (search.value.trim()) p.set('q', search.value.trim());
    if (filter.value) p.set('event', filter.value);
    if (append && entries.length) p.set('before', entries[entries.length - 1].id);
    const r = await api('/api/admin/audit?' + p);
    if (!labelsLoaded) {
      labelsLoaded = true;
      for (const [k, l] of Object.entries(r.events)) filter.append(h('option', { value: k }, l));
    }
    entries = append ? entries.concat(r.entries) : r.entries;
    more.classList.toggle('hidden', r.entries.length < 200);
    table.innerHTML = '';
    table.append(h('table', { class: 'admin-table' },
      h('thead', {}, h('tr', {}, ['Zeit', 'Ereignis', 'Benutzer', 'Durch', 'IP-Adresse', 'Details'].map((t) => h('th', {}, t)))),
      h('tbody', {}, entries.map((e) => h('tr', { class: /failed/.test(e.event) ? 'row-warn' : '' },
        h('td', { title: fmtDate(e.at) }, new Date(e.at).toLocaleString('de-DE')),
        h('td', {}, e.label),
        h('td', {}, e.user_name || (e.details && e.details.login) || h('span', { class: 'muted' }, '–')),
        h('td', {}, e.actor_name || ''),
        h('td', { title: e.user_agent || '' }, e.ip || ''),
        h('td', { class: 'muted small' }, e.details ? Object.entries(e.details).filter(([k]) => k !== 'login').map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ') : ''))))));
    if (!entries.length) table.append(h('p', { class: 'muted pad' }, 'Keine Einträge.'));
  }
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => load().catch((e) => toast(e.message)), 300);
  });
  filter.addEventListener('change', () => load().catch((e) => toast(e.message)));
  more.addEventListener('click', () => load(true).catch((e) => toast(e.message)));
  section('Sicherheitsprotokoll',
    h('p', { class: 'muted' }, 'Anmeldungen, Kontoänderungen und Administrationsaktionen der letzten 12 Monate.'),
    h('div', { class: 'admin-toolbar' }, search, filter), table, more);
  await load();
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
  legalFooter().then((f) => nav.append(f));
})();
