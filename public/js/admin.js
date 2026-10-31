// Administrationsoberfläche
import { T, LOCALE, DEC } from './i18n.js';
import { h, append, api, ICONS, toast, modal, confirmDialog, initials, relTime, fmtDate, loadPref, readableOn } from './util.js';
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
  ['overview', T('Übersicht'), 'grid'],
  ['users', T('Benutzer'), 'users'],
  ['boards', T('Boards'), 'template'],
  ['settings', T('Allgemein'), 'settings'],
  ['security', T('Sicherheit'), 'lock'],
  ['signin', T('Anmeldung'), 'unlock'],
  ['integrations', T('Anbindungen'), 'link'],
  ['brand', T('Design & Vorlagen'), 'template'],
  ['collab', T('Zusammenarbeit'), 'team'],
  ['mail', T('Mailserver'), 'comment'],
  ['legal', T('Rechtliches'), 'edit'],
  ['audit', T('Protokoll'), 'layers'],
];

const PROVIDER = { oidc: 'Keycloak', ldap: 'LDAP', kerberos: 'Kerberos', saml: 'SAML' };

const STATUS = { active: [T('Aktiv'), 'ok'], pending: [T('Wartet auf Freigabe'), 'warn'], disabled: [T('Deaktiviert'), 'off'] };
const LINK = { private: T('Privat'), view: T('Link: ansehen'), comment: T('Link: kommentieren'), edit: T('Link: bearbeiten') };

function fmtBytes(n) {
  const u = ['B', T('KB'), T('MB'), T('GB')];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}

function fmtUptime(s) {
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? T`${d} T ${hh} Std` : hh ? T`${hh} Std ${m} Min` : T`${m} Min`;
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
  ({ overview, users, boards, settings, security, signin, integrations, brand, collab, mail, legal, audit }[cur] || overview)().catch((e) => {
    if (e.code === 'mfa_required') {
      section(T('Zwei-Faktor-Anmeldung erforderlich'),
        h('p', {}, e.message),
        h('button', { class: 'btn primary', onclick: () => openSecurityDialog(me, (u) => (me = u)) }, T('Jetzt einrichten')));
    } else section(T('Fehler'), h('p', {}, e.message));
  });
}

/* ---------------- Übersicht ---------------- */

/* ---------------- Systemmetriken ---------------- */

const pct = (v) => (v == null ? '–' : `${String(Math.round(v * 10) / 10).replace('.', DEC)} %`);

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
    tile(T('CPU (vibeboard)'), pct(m.cpu.process), T`Kerne: ${String(m.cpu.cores)} · Host ${pct(m.cpu.host)} · Last ${m.cpu.load.map((v) => v.toFixed(2).replace('.', DEC)).join(' / ')}`,
      sparkline(hist.map((x) => x.cpu), 100), m.cpu.process > 80),
    tile(T('Arbeitsspeicher (vibeboard)'), fmtBytes(mem.rss), T`JavaScript-Heap ${fmtBytes(mem.heapUsed)} von ${fmtBytes(mem.heapTotal)}`,
      sparkline(hist.map((x) => x.rss), 0, '#12b886')),
    tile(mem.containerLimit ? T('Arbeitsspeicher (Container)') : T('Arbeitsspeicher (Host)'), pct(memPct), T`${fmtBytes(memUsed)} von ${fmtBytes(memTotal)} belegt${mem.containerLimit ? '' : T(' · kein Container-Limit')}`, null, memPct > 90),
    tile(T('Reaktionszeit (Ereignisschleife)'), m.eventLoopLagMs == null ? '–' : T`${String(Math.round(m.eventLoopLagMs * 10) / 10).replace('.', DEC)} ms`,
      T`99 % unter ${m.eventLoopLagP99Ms == null ? '–' : String(Math.round(m.eventLoopLagP99Ms)) + T(' ms')} · unter 10 ms ist gut`, sparkline(hist.map((x) => x.lag), 50, '#f59f00'), m.eventLoopLagMs > 50),
    ...m.disks.map((d) => tile(d.path === m.disks[0].path ? T('Speicherplatz (Anwendung)') : T('Speicherplatz (Sicherungen)'), T`${fmtBytes(d.free)} frei`,
      T`von ${fmtBytes(d.total)} · ${pct(100 - (d.free / d.total) * 100)} belegt`, null, d.free / d.total < 0.1)),
    tile(T('Datenbank-Verbindungen'), `${m.db.connections}`, T`Pool je Instanz: ${m.db.poolSize} · Cache-Trefferquote ${pct(m.db.cacheHit)}`),
    tile(T('Echtzeit'), T`${m.realtime.online} verbunden`, T`${m.realtime.activeBoards} aktive Boards · ${m.realtime.boardsInMemory} im Arbeitsspeicher`),
    tile(T('Laufzeit'), fmtUptime(m.uptime.process), T`Host seit ${fmtUptime(m.uptime.host)} · Node.js ${m.node} · ${m.platform}`),
  ), h('p', { class: 'muted small' }, T('Wird alle 5 Sekunden aktualisiert. Verlauf: letzte 10 Minuten. Rote Kacheln weisen auf Engpässe hin.')));
}

let metricsTimer = null;

async function overview() {
  const o = await api('/api/admin/overview');
  const systemBox = h('div', {}, h('p', { class: 'muted' }, T('Wird geladen …')));
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
  section(T('Übersicht'),
    pending ? h('a', { class: 'notice warn', href: '#users' }, pending > 1 ? T`⏳ ${pending} Registrierungen warten auf Freigabe →` : T('⏳ 1 Registrierung wartet auf Freigabe →')) : null,
    !o.mailConfigured ? h('a', { class: 'notice warn', href: '#mail' }, T('✉️ Es ist noch kein Mailserver eingerichtet. Ohne Mailserver ist keine Registrierung möglich (E-Mail-Bestätigung), und „Kennwort vergessen“ funktioniert nicht →')) : null,
    o.mailConfigured && !o.baseUrl ? h('a', { class: 'notice', href: '#settings' }, T('🔗 Tipp: Trage unter „Allgemein“ die öffentliche Adresse ein, damit Links in E-Mails auch bei Zugriff über einen Domainnamen funktionieren →')) : null,
    !o.virusScanner.configured ? h('a', { class: 'notice warn', href: '#security' }, o.requireVirusScan
      ? T('🦠 Es ist kein Virenscanner eingerichtet – Datei-Uploads sind deshalb gesperrt. Mit docker compose wird ClamAV automatisch mitgestartet (CLAMAV_HOST) →')
      : T('🦠 Es ist kein Virenscanner eingerichtet – hochgeladene Dateien werden nicht auf Schadsoftware geprüft →')) : null,
    o.virusScanner.configured && !o.virusScanner.reachable ? h('a', { class: 'notice warn', href: '#security' }, T`🦠 Der Virenscanner ist nicht erreichbar (${o.virusScanner.error}). Nach einem Neustart braucht ClamAV einige Minuten.`) : null,
    o.virusScanner.outdated ? h('a', { class: 'notice warn', href: '#security' }, T('🦠 Die Virensignaturen sind älter als drei Tage – bitte die automatische Aktualisierung (freshclam) prüfen.')) : null,
    o.withoutEmail ? h('a', { class: 'notice warn', href: '#users' }, T`✉️ Konten ohne E-Mail-Adresse: ${o.withoutEmail}. Angemeldet wird mit der E-Mail-Adresse – diese Konten können sich nur übergangsweise mit ihrem Namen anmelden. Bitte Adressen ergänzen →`) : null,
    o.network.hint === 'proxy' ? h('div', { class: 'notice warn' }, T`🌐 Die Anfrage kam über einen Reverse-Proxy (X-Forwarded-For), TRUST_PROXY ist aber nicht gesetzt. Im Protokoll und bei den Anmeldesperren steht deshalb die Adresse des Proxys (${o.network.ip}) statt der echten Adresse. Lösung: TRUST_PROXY=1 in der .env setzen (siehe README, „Echte IP-Adressen“).`) : null,
    o.network.hint === 'gateway' ? h('div', { class: 'notice warn' }, T`🌐 Deine Anfrage kommt beim Server von ${o.network.ip} an – das ist vermutlich das Docker-Netz, nicht deine Adresse. Im Protokoll und bei den Anmeldesperren landen dann alle Zugriffe unter derselben Adresse. Lösungen stehen im README unter „Echte IP-Adressen“.`) : null,
        o.failedLogins24h >= 20 ? h('a', { class: 'notice warn', href: '#audit' }, T`🔐 ${o.failedLogins24h} fehlgeschlagene Anmeldungen in den letzten 24 Stunden →`) : null,
    h('div', { class: 'stat-grid' },
      tile(T('Benutzer'), total, T`${o.users.active || 0} aktiv · ${pending} wartend · ${o.users.disabled || 0} deaktiviert`),
      tile(T('Sicherheit'), `${o.mfaUsers} / ${total}`, T`mit Zwei-Faktor-Anmeldung · ${o.unverified} unbestätigt`),
      tile(T('Fehlgeschlagene Anmeldungen'), o.failedLogins24h, T('in den letzten 24 Stunden')),
      tile(T('Boards'), o.boards, T`${o.elements.toLocaleString(LOCALE)} Elemente`),
      tile(T('Gerade online'), o.online, T`Boards: ${o.activeBoards}`),
      tile(T('Teams & Gäste'), `${o.teams} / ${o.guests}`, T('Teams · aktive Gastzugänge')),
      tile(T('Angemeldete Sitzungen'), o.sessions),
      tile(T('Datenbank'), fmtBytes(o.dbSize), o.pgVersion),
      tile(T('Virenscanner'), o.virusScanner.configured ? (o.virusScanner.reachable ? T('aktiv') : T('nicht erreichbar')) : T('aus'),
        o.virusScanner.reachable ? T`${o.virusScanner.engine} · Signaturen ${o.virusScanner.signatures}${o.virusScanner.signaturesDate ? T(' vom ') + new Date(o.virusScanner.signaturesDate).toLocaleDateString(LOCALE) : ''} · ${o.uploadsBlocked30d} blockiert${o.uploadsUnscanned30d ? T`, ${o.uploadsUnscanned30d} ungeprüft angenommen` : ''} (30 Tage)` : ''),
      tile(T('System'), 'v' + o.version, T`Laufzeit ${fmtUptime(o.uptime)} · ${o.disposableDomains.toLocaleString(LOCALE)} gesperrte Wegwerf-Domains`),
    ),
    h('div', { class: 'version-history' }, h('h2', {}, T('System')), systemBox),
    o.versionHistory.length ? h('div', { class: 'version-history' }, h('h2', {}, T('Versionshistorie')),
      h('table', { class: 'admin-table' }, h('thead', {}, h('tr', {}, [T('Version'), T('vorher'), T('Schema'), T('Sicherung vor dem Upgrade'), T('gestartet')].map((t) => h('th', {}, t)))),
        h('tbody', {}, o.versionHistory.map((v) => h('tr', {}, h('td', {}, h('b', {}, v.version)), h('td', {}, v.previous || '–'), h('td', {}, v.schema),
          h('td', { class: 'small' }, v.backup || h('span', { class: 'muted' }, '–')), h('td', {}, fmtDate(v.started_at))))))) : null);
}

/* ---------------- Benutzerverwaltung ---------------- */

async function users() {
  const list = await api('/api/admin/users');
  const search = h('input', { type: 'search', placeholder: T('Name, Benutzername oder E-Mail …'), 'aria-label': T('Suchen'), class: 'admin-search' });
  const filter = h('select', { class: 'admin-filter', 'aria-label': T('Filter') },
    [['', T('Alle')], ['pending', T('Wartet auf Freigabe')], ['unverified', T('E-Mail unbestätigt')], ['disabled', T('Deaktiviert')], ['admin', T('Administratoren')], ['nomfa', T('Ohne Zwei-Faktor')]].map(([v, l]) => h('option', { value: v }, l)));
  const table = h('div', { class: 'table-wrap' });
  const count = h('span', { class: 'muted small' });
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const f = filter.value;
    const rows = list.filter((u) => (!q || [u.displayName, u.email].join(' ').toLowerCase().includes(q))
      && (!f || (f === 'pending' && u.status === 'pending') || (f === 'disabled' && u.status === 'disabled') || (f === 'unverified' && !u.emailVerified)
        || (f === 'admin' && u.role === 'admin') || (f === 'nomfa' && !u.mfa)));
    count.textContent = T`${rows.length} von ${list.length}`;
    table.innerHTML = '';
    table.append(h('table', { class: 'admin-table' },
      h('thead', {}, h('tr', {}, [T('Benutzer'), T('E-Mail'), T('Rolle'), T('Status'), '2FA', T('Boards'), T('Letzte Anmeldung')].map((t) => h('th', {}, t)), h('th', {}, h('span', { class: 'sr-only' }, T('Aktionen'))))),
      h('tbody', {}, rows.map((u) => {
        const [sl, sc] = STATUS[u.status];
        const actions = h('button', { class: 'icon-btn small', title: T('Aktionen'), html: ICONS.more });
        actions.onclick = () => userMenu(actions, u);
        return h('tr', { class: u.status === 'pending' ? 'row-warn' : '' },
          h('td', {}, h('div', { class: 'user-cell' }, h('span', { class: 'avatar sm', style: { background: u.color } }, initials(u.displayName)),
            h('div', {}, h('b', {}, u.displayName), h('div', { class: 'muted small' }, (u.email || T('ohne E-Mail-Adresse')) + (u.id === me.id ? T(' · du') : '')),
              u.providers.length ? h('div', { class: 'muted small' }, u.providers.map((p) => PROVIDER[p] || p).join(', ')) : null))),
          h('td', {}, u.email ? h('div', {}, u.email, ' ', u.emailVerified ? h('span', { class: 'pill ok', title: T('bestätigt') }, '✓') : h('span', { class: 'pill warn' }, T('unbestätigt'))) : h('span', { class: 'muted' }, '–'),
            u.pendingEmail ? h('div', { class: 'muted small' }, '→ ' + u.pendingEmail + T(' (wartet)')) : null),
          h('td', {}, u.role === 'admin' ? h('span', { class: 'pill accent' }, T('Admin')) : T('Benutzer')),
          h('td', {}, h('span', { class: 'pill ' + sc }, sl), u.status === 'pending' && u.emailVerified ? h('button', { class: 'btn small primary', style: { marginLeft: '8px' }, onclick: () => patchUser(u, { status: 'active' }, T('Freigeschaltet')) }, T('Freischalten')) : null),
          h('td', {}, u.mfa ? h('span', { class: 'pill ok', title: T`${u.recoveryCodesLeft} Wiederherstellungscodes übrig` }, 'an') : h('span', { class: 'muted' }, 'aus')),
          h('td', {}, u.boardCount),
          h('td', { title: u.lastLoginAt ? fmtDate(u.lastLoginAt) : '' }, u.lastLoginAt ? relTime(new Date(u.lastLoginAt).getTime()) : h('span', { class: 'muted' }, T('nie'))),
          h('td', { class: 'actions' }, actions));
      }))));
  };
  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  section(T('Benutzerverwaltung'),
    h('div', { class: 'admin-toolbar' }, search, filter, count, h('span', { class: 'spacer' }), h('button', { class: 'btn primary', onclick: () => createUser() }, h('span', { html: ICONS.plus }), T('Benutzer anlegen'))),
    table);
  render();
}

async function patchUser(u, patch, msg) {
  try {
    await api('/api/admin/users/' + u.id, { method: 'PATCH', body: patch });
    toast(msg || T('Gespeichert'));
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
    { label: T('Bearbeiten …'), icon: 'edit', onClick: () => editUser(u) },
    u.status === 'pending' ? { label: T('Freischalten'), icon: 'check', onClick: () => patchUser(u, { status: 'active' }, T('Freigeschaltet')) } : null,
    !u.emailVerified && u.email ? { label: T('Bestätigungsmail erneut senden'), icon: 'comment', onClick: () => post(`/api/admin/users/${u.id}/resend-verification`, (r) => T`Bestätigungsmail an ${r.email} gesendet`) } : null,
    !u.emailVerified && u.email ? { label: T('E-Mail manuell bestätigen'), icon: 'check', onClick: () => patchUser(u, { emailVerified: true }, T('E-Mail-Adresse als bestätigt markiert')) } : null,
    u.external ? null : { label: T('Link zum Kennwort-Zurücksetzen'), icon: 'link', onClick: () => resetLink(u) },
    u.mfa && !self ? { label: T('Zwei-Faktor-Anmeldung zurücksetzen'), icon: 'unlock', onClick: async () => {
      if (await confirmDialog(T('Zwei-Faktor zurücksetzen'), T`${u.displayName} kann sich danach wieder nur mit Kennwort anmelden und die Zwei-Faktor-Anmeldung neu einrichten. Nur nach sicherer Identitätsprüfung verwenden.`, T('Zurücksetzen'), true)) patchUser(u, { resetMfa: true }, T('Zwei-Faktor-Anmeldung zurückgesetzt'));
    } } : null,
    u.sessionCount && !self ? { label: T`Alle Sitzungen beenden (${u.sessionCount})`, icon: 'close', onClick: () => post(`/api/admin/users/${u.id}/revoke-sessions`, T('Sitzungen beendet')).then(users) } : null,
    u.status === 'active' && !self ? { label: T('Deaktivieren'), icon: 'lock', onClick: () => patchUser(u, { status: 'disabled' }, T('Deaktiviert')) } : null,
    u.status === 'disabled' ? { label: T('Aktivieren'), icon: 'unlock', onClick: () => patchUser(u, { status: 'active' }, T('Aktiviert')) } : null,
    !self ? { label: u.role === 'admin' ? T('Adminrechte entziehen') : T('Zum Admin machen'), icon: 'settings', onClick: () => patchUser(u, { role: u.role === 'admin' ? 'user' : 'admin' }) } : null,
    u.role === 'admin' && !u.providers.length ? { label: u.externalLinkOk ? T('Externe Anmeldung nicht mehr freigeben') : T('Für externe Anmeldung freigeben'), icon: 'link', onClick: () => patchUser(u, { allowExternalLink: !u.externalLinkOk }, u.externalLinkOk ? T('Freigabe zurückgenommen') : T('Bei der nächsten externen Anmeldung mit dieser Adresse wird das Konto verknüpft')) } : null,
    u.providers.length && !u.external ? { label: T('Externe Verknüpfung lösen'), icon: 'unlock', onClick: () => patchUser(u, { unlinkExternal: true }, T('Verknüpfung gelöst')) } : null,
    { label: T('Protokoll anzeigen'), icon: 'layers', onClick: () => (location.hash = 'audit/' + encodeURIComponent(u.email || u.displayName)) },
    !self ? '-' : null,
    !self ? { label: T('Löschen …'), icon: 'trash', danger: true, onClick: () => deleteUser(u) } : null,
  ], { placement: 'left' });
}

function createUser() {
  const err = errorBox();
  const username = h('input', { type: 'text', required: true, maxlength: 60 });
  const email = h('input', { type: 'email', required: true });
  const role = h('select', {}, h('option', { value: 'user' }, T('Benutzer')), h('option', { value: 'admin' }, T('Administrator')));
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
      toast(r.invited ? T`Einladung an ${r.email} verschickt` : r.inviteError ? T`Benutzer angelegt, Einladung fehlgeschlagen: ${r.inviteError}` : T('Benutzer angelegt'), 5000);
      users();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('label', {}, T('Name'), username, h('span', { class: 'field-hint' }, T('Muss nicht eindeutig sein.'))),
  h('label', {}, T('E-Mail-Adresse'), email, h('span', { class: 'field-hint' }, T('Damit meldet sich die Person an. Vom Admin eingetragene Adressen gelten als bestätigt.'))),
  h('label', {}, T('Rolle'), role),
  h('div', {}, h('div', { class: 'label' }, T('Kennwort')),
    h('label', { class: 'check' }, inviteRadio, T('Einladung per E-Mail – die Person legt ihr Kennwort selbst fest (empfohlen)')),
    h('label', { class: 'check' }, pwRadio, T('Kennwort jetzt festlegen')), pw),
  err.el,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Anlegen'))));
  const m = modal(T('Benutzer anlegen'), form);
  setTimeout(() => username.focus(), 0);
}

function editUser(u) {
  const self = u.id === me.id; // eigene Rolle/Status nicht hier ändern (Selbstaussperrung)
  const err = errorBox();
  const display = h('input', { type: 'text', value: u.displayName, required: true, maxlength: 60 });
  const email = h('input', { type: 'email', value: u.email, required: !!u.email });
  const role = h('select', { disabled: self }, h('option', { value: 'user', selected: u.role === 'user' }, T('Benutzer')), h('option', { value: 'admin', selected: u.role === 'admin' }, T('Administrator')));
  const status = h('select', { disabled: self }, Object.entries(STATUS).map(([k, [l]]) => h('option', { value: k, selected: u.status === k }, l)));
  const pw = h('input', { type: 'password', autocomplete: 'new-password', placeholder: T('unverändert lassen'), maxlength: 256 });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      await api('/api/admin/users/' + u.id, { method: 'PATCH', body: { displayName: display.value, email: email.value, ...(self ? {} : { role: role.value, status: status.value }), ...(pw.value ? { password: pw.value } : {}) } });
      m.close();
      toast(T('Gespeichert'));
      users();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('label', {}, T('Name'), display),
  h('label', {}, T('E-Mail-Adresse (Anmeldung)'), email, h('span', { class: 'field-hint' }, !u.email ? T('Fehlt – ohne E-Mail-Adresse ist die Anmeldung nur übergangsweise mit dem Namen möglich.') : u.emailVerified ? T('Bestätigt. Eine neue Adresse gilt als bestätigt.') : T('Noch nicht bestätigt.'))),
  h('div', { class: 'form-row' }, h('label', {}, T('Rolle'), role), h('label', {}, T('Status'), status)),
  h('label', {}, T('Neues Kennwort'), pw, h('span', { class: 'field-hint' }, T('Besser: „Link zum Kennwort-Zurücksetzen“ im Aktionsmenü. Ein neues Kennwort meldet alle Sitzungen ab.'))),
  err.el,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Speichern'))));
  const m = modal(T`Benutzer bearbeiten: ${u.displayName}`, form);
}

async function resetLink(u) {
  try {
    const r = await api(`/api/admin/users/${u.id}/reset-link`, { method: 'POST' });
    if (r.sent) return toast(T`E-Mail an ${r.email} verschickt`);
    const input = h('input', { type: 'text', value: r.link, readonly: true, onclick: (e) => e.target.select() });
    modal(T('Link zum Kennwort-Zurücksetzen'), h('div', { class: 'form' },
      h('p', {}, r.error ? T`Die E-Mail konnte nicht verschickt werden (${r.error}). Gib den Link bitte selbst weiter:` : T`Für ${u.displayName} ist keine E-Mail-Adresse oder kein Mailserver hinterlegt. Gib diesen Link auf sicherem Weg weiter – er ist 24 Stunden gültig:`),
      h('div', { class: 'copy-row' }, input, h('button', { class: 'btn', onclick: async () => {
        await navigator.clipboard.writeText(r.link).catch(() => input.select());
        toast(T('Link kopiert'));
      } }, T('Kopieren')))));
  } catch (e) {
    toast(e.message);
  }
}

function deleteUser(u) {
  const transfer = h('input', { type: 'radio', name: 'b', checked: true });
  const del = h('input', { type: 'radio', name: 'b' });
  const m = modal(T('Benutzer löschen'), h('div', { class: 'form' },
    h('p', {}, T`„${u.displayName}“ (${u.email || T('ohne E-Mail-Adresse')}) wird endgültig gelöscht.`),
    u.boardCount ? h('div', {}, h('div', { class: 'label' }, T`Was passiert mit den eigenen Boards (${u.boardCount})?`),
      h('label', { class: 'check' }, transfer, T('An mich übertragen')),
      h('label', { class: 'check' }, del, T('Ebenfalls löschen'))) : null,
    h('div', { class: 'form-actions' }, h('button', { class: 'btn', onclick: () => m.close() }, T('Abbrechen')),
      h('button', { class: 'btn danger primary', onclick: async () => {
        try {
          await api(`/api/admin/users/${u.id}?boards=${del.checked ? 'delete' : 'transfer'}`, { method: 'DELETE' });
          m.close();
          toast(T('Benutzer gelöscht'));
          users();
        } catch (e) {
          toast(e.message);
        }
      } }, T('Endgültig löschen')))));
}

/* ---------------- Boards ---------------- */

async function boards() {
  const [list, userList] = await Promise.all([api('/api/admin/boards'), api('/api/admin/users')]);
  const search = h('input', { type: 'search', placeholder: T('Suchen …'), 'aria-label': T('Suchen'), class: 'admin-search' });
  const table = h('div', { class: 'table-wrap' });
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const rows = list.filter((b) => !q || (b.name + ' ' + (b.owner || '')).toLowerCase().includes(q));
    table.innerHTML = '';
    table.append(h('table', { class: 'admin-table' },
      h('thead', {}, h('tr', {}, [T('Board'), T('Besitzer'), T('Elemente'), T('Mitglieder'), T('Freigabe'), T('Geändert'), ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((b) => {
        const actions = h('button', { class: 'icon-btn small', title: T('Aktionen'), html: ICONS.more });
        actions.onclick = () => menu(actions, [
          { label: T('Öffnen'), icon: 'fit', onClick: () => window.open('/board/' + b.id, '_blank', 'noopener') },
          { label: T('Besitzer ändern …'), icon: 'users', onClick: () => changeOwner(b, userList) },
          '-',
          { label: T('Löschen'), icon: 'trash', danger: true, onClick: async () => {
            if (!(await confirmDialog(T('Board löschen'), T`„${b.name}“ wird unwiderruflich gelöscht.`, T('Löschen'), true))) return;
            try {
              await api('/api/boards/' + b.id, { method: 'DELETE' });
              toast(T('Board gelöscht'));
              boards();
            } catch (e) {
              toast(e.message);
            }
          } },
        ], { placement: 'left' });
        return h('tr', {},
          h('td', {}, h('a', { href: '/board/' + b.id, target: '_blank', rel: 'noopener' }, b.name), b.online ? h('span', { class: 'pill ok', style: { marginLeft: '8px' } }, b.online + T(' online')) : null),
          h('td', {}, b.owner || h('span', { class: 'muted' }, T('ohne'))),
          h('td', {}, b.elements),
          h('td', {}, b.members),
          h('td', {}, LINK[b.linkAccess]),
          h('td', { title: fmtDate(b.updatedAt) }, relTime(new Date(b.updatedAt).getTime())),
          h('td', { class: 'actions' }, actions));
      }))));
  };
  search.addEventListener('input', render);
  section(T('Boards'), h('div', { class: 'admin-toolbar' }, search, h('span', { class: 'muted small' }, T`${list.length} Boards insgesamt`)), table);
  render();
}

function changeOwner(b, userList) {
  const sel = h('select', {}, userList.filter((u) => u.status === 'active').map((u) => h('option', { value: u.id, selected: u.id === b.ownerId }, `${u.displayName} (${u.email || T('ohne E-Mail')})`)));
  const m = modal(T('Besitzer ändern'), h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/boards/' + b.id, { method: 'PATCH', body: { ownerId: sel.value } });
      m.close();
      toast(T('Besitzer geändert'));
      boards();
    } catch (ex) {
      toast(ex.message);
    }
  } }, h('p', {}, T`Neuer Besitzer für „${b.name}“:`), sel,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Übernehmen')))));
}

/* ---------------- Allgemeine Einstellungen ---------------- */

const LOG_LEVELS = [
  ['trace', T('trace – alles, auch Einzelschritte (nur zur Fehlersuche)')],
  ['debug', T('debug – zusätzlich jede Anfrage und abgelehnte Anfragen')],
  ['info', T('info – Start, Upgrades, wichtige Abläufe (empfohlen)')],
  ['warn', T('warn – nur Warnungen und Fehler')],
  ['error', T('error – nur Fehler')],
  ['fatal', T('fatal – nur Fehler, die den Betrieb beenden')],
  ['silent', T('silent – nichts protokollieren')],
];

async function settings() {
  const all = await api('/api/admin/settings');
  const s = all.general;
  const logLevel = h('select', {}, h('option', { value: '' }, T`Vorgabe aus LOG_LEVEL (${all.logInfo.envLevel})`),
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
      toast(T('Einstellungen gespeichert'));
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('fieldset', {}, h('legend', {}, T('Instanz')),
    h('label', {}, T('Name der Anwendung'), siteName, h('span', { class: 'field-hint' }, T('Erscheint auf der Anmeldeseite, im Betreff von E-Mails und in Authenticator-Apps.'))),
    h('label', {}, T('Öffentliche Adresse'), baseUrl, h('span', { class: 'field-hint' }, T('Wird für Links in E-Mails verwendet, z. B. https://board.example.de. Leer: nur Zugriffe über localhost oder die IP-Adressen dieses Servers erzeugen Links.')))),
  h('fieldset', {}, h('legend', {}, T('Registrierung')),
    radio('open', T('Offen'), T('Jede Person kann sich registrieren; nach Bestätigung der E-Mail-Adresse ist das Konto aktiv.')),
    radio('approval', T('Mit Freigabe'), T('Nach Bestätigung der E-Mail-Adresse muss ein Administrator das Konto freischalten.')),
    radio('closed', T('Geschlossen'), T('Nur Administratoren legen Konten an bzw. laden ein.')),
    h('label', { class: 'check' }, notifyAdmins, T('Administratoren per E-Mail über Registrierungen informieren, die auf Freigabe warten')),
    h('p', { class: 'muted small' }, T('Die E-Mail-Bestätigung ist immer erforderlich. Regeln für Kennwörter und E-Mail-Domains findest du unter „Sicherheit“.'))),
  h('fieldset', {}, h('legend', {}, T('Protokollierung (Server-Log)')),
    h('label', {}, T('Protokollstufe'), logLevel, h('span', { class: 'field-hint' },
      T`Gilt sofort, ohne Neustart. Aktuell: ${all.logInfo.current} · Ausgabeformat: ${all.logInfo.format === 'json' ? T('JSON') : T('Text')} (LOG_FORMAT). Das Protokoll erscheint in der Konsole bzw. in „docker compose logs app“. Geheimnisse wie Kennwörter und Tokens werden geschwärzt, IP-Adressen nicht protokolliert.`)),
    h('p', { class: 'muted small' }, T('Sicherheitsrelevante Ereignisse (Anmeldungen, Änderungen) stehen unabhängig davon im „Protokoll“ der Administration.'))),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, T('Speichern'))));
  section(T('Allgemeine Einstellungen'), form);
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
  const blocked = h('textarea', { rows: 4, placeholder: T('eine Domain pro Zeile, z. B. example.com') }, s.blockedDomains);
  const allowed = h('textarea', { rows: 3, placeholder: T('leer = alle Domains erlaubt') }, s.allowedDomains);
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
      toast(T('Sicherheitseinstellungen gespeichert'));
      security();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('fieldset', {}, h('legend', {}, T('Kennwörter')),
    h('label', {}, T('Mindestlänge'), minLen, h('span', { class: 'field-hint' }, T('Empfohlen: 12 oder mehr. Zusätzlich werden die 10.000 häufigsten Kennwörter, einfache Muster und Kennwörter mit Benutzername/E-Mail abgelehnt. Erzwungene Sonderzeichen gibt es bewusst nicht (NIST SP 800-63B).'))),
    h('label', { class: 'check' }, hibp, T('Kennwörter mit bekannten Datenlecks ablehnen („Have I Been Pwned“)')),
    h('p', { class: 'muted small' }, T('Dabei werden nur die ersten 5 Zeichen eines SHA-1-Hashs an api.pwnedpasswords.com übertragen (k-Anonymität), nie das Kennwort selbst. Ist der Dienst nicht erreichbar, wird die Prüfung übersprungen.'))),
  h('fieldset', {}, h('legend', {}, T('E-Mail-Domains')),
    h('label', { class: 'check' }, disposable, T('Wegwerf-E-Mail-Adressen sperren (mehrere Tausend bekannte Anbieter)')),
    h('label', {}, T('Zusätzlich gesperrte Domains'), blocked),
    h('label', {}, T('Nur diese Domains zulassen'), allowed, h('span', { class: 'field-hint' }, T('Z. B. die Firmendomain. Ist hier etwas eingetragen, sind alle anderen Domains gesperrt. Subdomains sind eingeschlossen.')))),
  h('fieldset', {}, h('legend', {}, T('Virenscan für hochgeladene Dateien')),
    h('p', {}, vs.configured
      ? (vs.reachable
        ? h('span', {}, h('span', { class: 'pill ok' }, T('aktiv')), T` ${vs.engine}, Signaturen ${vs.signatures}${vs.signaturesDate ? T(' vom ') + new Date(vs.signaturesDate).toLocaleString(LOCALE) : ''}. Die Signaturen aktualisiert ClamAV selbstständig (freshclam).`)
        : h('span', {}, h('span', { class: 'pill warn' }, T('nicht erreichbar')), ` ${vs.error || ''}`))
      : h('span', {}, h('span', { class: 'pill off' }, T('nicht eingerichtet')), T(' Mit docker compose wird ClamAV automatisch mitgestartet. Ohne Docker: ClamAV (clamd) installieren und CLAMAV_HOST/CLAMAV_PORT setzen.'))),
    h('p', { class: 'muted small' }, T('Geprüft werden alle hochgeladenen Bilder (Einfügen, Drag & Drop, Upload), Bilder in importierten Boards und Vorschaubilder. Zusätzlich muss der Dateiinhalt zum angegebenen Bildtyp passen.')),
    h('label', { class: 'check' }, requireScan, T('Uploads sperren, solange kein Virenscanner eingerichtet ist (empfohlen)')),
    h('label', { class: 'check' }, failOpen, T('Uploads trotzdem annehmen, wenn der Scanner vorübergehend nicht erreichbar ist (nicht empfohlen)'))),
  h('fieldset', {}, h('legend', {}, T('Zwei-Faktor-Anmeldung')),
    h('label', { class: 'check' }, requireMfa, T('Für Administratoren verpflichtend')),
    h('p', { class: 'muted small' }, T('Administratoren ohne Zwei-Faktor-Anmeldung haben dann keinen Zugriff auf die Administration, bis sie sie im Profil unter „Sicherheit & Geräte“ eingerichtet haben. Jeder Benutzer kann sie freiwillig nutzen.')),
    me.mfa ? null : h('p', { class: 'notice warn' }, T('Dein eigenes Konto hat noch keine Zwei-Faktor-Anmeldung.'), ' ', h('button', { type: 'button', class: 'btn small', onclick: () => openSecurityDialog(me, (u) => (me = u)) }, T('Jetzt einrichten')))),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, T('Speichern'))));
  section(T('Sicherheit'), form);
}

/* ---------------- Zusammenarbeit ---------------- */

/* ---------------- Anmeldung ---------------- */

const adField = (label, input, hint) => h('label', {}, label, input, hint ? h('span', { class: 'field-hint' }, hint) : null);

// Ergebnis eines Verbindungstests – als Live-Region, damit Screenreader es ansagen
function testButton(provider, loginInput) {
  const out = h('div', { class: 'auth-test', role: 'status' });
  const btn = h('button', { type: 'button', class: 'btn', onclick: async () => {
    btn.disabled = true;
    out.textContent = T('Wird geprüft …');
    try {
      const { steps } = await api('/api/admin/auth/test', { method: 'POST', body: { provider, login: loginInput ? loginInput.value : '' } });
      out.textContent = '';
      for (const s of steps) {
        out.append(h('div', { class: s.ok ? 'ok-text' : 'warn-text' }, `${s.ok ? '✓' : '✗'} ${T(s.text)}`,
          s.details ? h('span', { class: 'muted small' }, ' ' + Object.entries(s.details).map(([k, v]) => `${k}: ${v}`).join(' · ')) : null));
      }
    } catch (e) {
      out.textContent = e.message;
    }
    btn.disabled = false;
  } }, T('Gespeicherte Einstellungen testen'));
  return h('div', { class: 'auth-test-row' }, loginInput ? adField(T('Beispiel-Anmeldename (optional)'), loginInput) : null, btn, out);
}

async function signin() {
  const all = await api('/api/admin/settings');
  const { auth, oidc, ldap, kerberos, saml, scim } = all;
  const err = errorBox();
  const text = (value, attrs = {}) => h('input', { type: 'text', value, spellcheck: 'false', autocomplete: 'off', ...attrs });
  const box = (checked) => h('input', { type: 'checkbox', checked });
  const select = (value, options) => h('select', {}, options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
  const a = {
    localLogin: select(auth.localLogin, [['all', T('Alle lokalen Konten')], ['admins', T('Nur Administratoren (Notzugang)')]]),
    provision: select(auth.provision, [['active', T('Konto automatisch anlegen und freischalten')], ['pending', T('Konto anlegen, Freigabe durch Admin')], ['off', T('Kein neues Konto – nur vorhandene Adressen')]]),
    sessionHours: h('input', { type: 'number', min: 1, max: 720, value: auth.sessionHours }),
    autoSso: select(auth.autoSso, [['', T('Nein, Anmeldeseite zeigen')], ['oidc', 'Keycloak'], ['saml', 'SAML'], ['kerberos', 'Kerberos']]),
  };
  const o = {
    enabled: box(oidc.enabled), label: text(oidc.label, { maxlength: 40 }), issuer: text(oidc.issuer, { placeholder: 'https://sso.example.org/realms/firma' }), clientId: text(oidc.clientId),
    clientSecret: h('input', { type: 'password', autocomplete: 'new-password', placeholder: oidc.hasSecret ? T('unverändert lassen') : '' }),
    scopes: text(oidc.scopes), requiredRole: text(oidc.requiredRole), adminRole: text(oidc.adminRole), trustUnverifiedEmail: box(oidc.trustUnverifiedEmail),
  };
  const l = {
    enabled: box(ldap.enabled), url: text(ldap.url, { placeholder: 'ldaps://dc.example.org:636' }), startTls: box(ldap.startTls), rejectUnauthorized: box(ldap.rejectUnauthorized),
    caCert: h('textarea', { rows: 3, spellcheck: 'false', placeholder: '-----BEGIN CERTIFICATE-----' }, ldap.caCert),
    bindDn: text(ldap.bindDn, { placeholder: 'CN=vibeboard,OU=Dienste,DC=example,DC=org' }),
    bindPassword: h('input', { type: 'password', autocomplete: 'new-password', placeholder: ldap.hasPassword ? T('unverändert lassen') : '' }),
    baseDn: text(ldap.baseDn, { placeholder: 'DC=example,DC=org' }), userFilter: h('textarea', { rows: 3, spellcheck: 'false' }, ldap.userFilter),
    attrId: text(ldap.attrId), attrLogin: text(ldap.attrLogin), attrEmail: text(ldap.attrEmail), attrName: text(ldap.attrName), attrGroups: text(ldap.attrGroups),
    nestedGroups: box(ldap.nestedGroups), requiredGroup: text(ldap.requiredGroup), adminGroup: text(ldap.adminGroup),
  };
  const k = { enabled: box(kerberos.enabled), label: text(kerberos.label, { maxlength: 40 }), realm: text(kerberos.realm, { placeholder: 'EXAMPLE.ORG' }), servicePrincipal: text(kerberos.servicePrincipal, { placeholder: 'HTTP/board.example.org' }), emailDomain: text(kerberos.emailDomain) };
  const sa = {
    enabled: box(saml.enabled), label: text(saml.label, { maxlength: 40 }), entryPoint: text(saml.entryPoint, { placeholder: 'https://idp.example.org/saml/sso' }), issuer: text(saml.issuer),
    idpCert: h('textarea', { rows: 4, spellcheck: 'false', placeholder: '-----BEGIN CERTIFICATE-----' }, saml.idpCert),
    attrEmail: text(saml.attrEmail), attrName: text(saml.attrName), attrGroups: text(saml.attrGroups), requiredGroup: text(saml.requiredGroup), adminGroup: text(saml.adminGroup),
  };
  const scimOn = box(scim.enabled);
  const scimOut = h('div', { role: 'status' });
  const values = (fields) => Object.fromEntries(Object.entries(fields).map(([key, el]) => [key, el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value]));
  const form = h('form', { class: 'form admin-form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    if (auth.localLogin === 'all' && a.localLogin.value === 'admins'
      && !(await confirmDialog(T('Lokale Anmeldung einschränken'), T('Personen mit lokalem Kennwort können sich dann nicht mehr damit anmelden. Sie brauchen ein Konto beim Anmeldedienst mit derselben E-Mail-Adresse. Administratoren behalten den Notzugang.'), T('Einschränken'), true))) return;
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { oidc: values(o), ldap: values(l), kerberos: values(k), saml: values(sa), scim: { enabled: scimOn.checked }, auth: values(a) } });
      toast(T('Einstellungen gespeichert'));
      signin();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('p', { class: 'muted' }, T('Mehrere Methoden können gleichzeitig aktiv sein. So lässt sich umstellen, ohne dass jemand den Zugang verliert. Lokale Administrator-Konten behalten immer ihren Notzugang, auch wenn ein Anmeldedienst ausfällt.')),
  h('fieldset', {}, h('legend', {}, T('Allgemein')),
    adField(T('Anmeldung mit lokalem Kennwort'), a.localLogin, T('„Nur Administratoren“ schließt zugleich die Registrierung.')),
    adField(T('Bei der ersten externen Anmeldung'), a.provision, T('Hat jemand bereits ein Konto mit derselben E-Mail-Adresse, wird es verknüpft. Administrator-Konten nur nach Freigabe in der Benutzerverwaltung.')),
    adField(T('Gültigkeit externer Sitzungen (Stunden)'), a.sessionHours, T('Im Verzeichnis gesperrte Personen fallen spätestens nach dieser Zeit heraus.')),
    adField(T('Anmeldeseite direkt weiterleiten'), a.autoSso, T('Mit ?local=1 an der Adresse /login bleibt die Anmeldeseite erreichbar.'))),
  h('fieldset', {}, h('legend', {}, 'Keycloak (OpenID Connect)'),
    h('label', { class: 'check' }, o.enabled, T('Anmeldung über Keycloak einschalten')),
    h('p', { class: 'muted small' }, T`Client in Keycloak mit Standard Flow anlegen. Gültige Weiterleitung: ${(location.origin)}/api/auth/oidc/callback · nach der Abmeldung: ${location.origin}/login`),
    adField(T('Aussteller-Adresse (Issuer)'), o.issuer), h('div', { class: 'form-row' }, adField(T('Client-ID'), o.clientId), adField(T('Client-Geheimnis'), o.clientSecret)),
    h('div', { class: 'form-row' }, adField(T('Text auf der Schaltfläche'), o.label), adField(T('Scopes'), o.scopes)),
    h('div', { class: 'form-row' }, adField(T('Nötige Rolle oder Gruppe (optional)'), o.requiredRole), adField(T('Rolle oder Gruppe für Adminrechte (optional)'), o.adminRole)),
    h('label', { class: 'check' }, o.trustUnverifiedEmail, T('E-Mail-Adressen auch ohne Bestätigungsvermerk vertrauen')),
    h('p', { class: 'muted small' }, T('Nur einschalten, wenn in Keycloak niemand seine Adresse selbst ändern kann: Sonst ließen sich fremde Konten und Einladungen übernehmen.')),
    testButton('oidc')),
  h('fieldset', {}, h('legend', {}, 'LDAP / Active Directory'),
    h('label', { class: 'check' }, l.enabled, T('Anmeldung über LDAP einschalten')),
    h('p', { class: 'muted small' }, T('Die Felder sind für Active Directory vorbelegt. Angemeldet wird im normalen Formular mit Anmeldename, UPN oder E-Mail-Adresse.')),
    adField(T('Server-Adresse'), l.url, T('ldaps:// oder ldap:// mit StartTLS – Kennwörter gehen nie unverschlüsselt über das Netz.')),
    h('label', { class: 'check' }, l.startTls, T('StartTLS verwenden')), h('label', { class: 'check' }, l.rejectUnauthorized, T('Serverzertifikat prüfen')),
    adField(T('Eigene Zertifizierungsstelle (PEM, optional)'), l.caCert),
    h('div', { class: 'form-row' }, adField(T('Dienstkonto (Bind-DN)'), l.bindDn), adField(T('Kennwort des Dienstkontos'), l.bindPassword)),
    adField(T('Suchbasis (Base-DN)'), l.baseDn), adField(T('Suchfilter'), l.userFilter, T('{login} wird durch die Eingabe ersetzt. Vorbelegt: Personen, keine deaktivierten Konten.')),
    h('div', { class: 'form-row' }, adField(T('Dauerhafte Kennung'), l.attrId), adField(T('Anmeldename'), l.attrLogin)),
    h('div', { class: 'form-row' }, adField(T('E-Mail-Adresse'), l.attrEmail), adField(T('Anzeigename'), l.attrName)),
    adField(T('Gruppen'), l.attrGroups),
    h('div', { class: 'form-row' }, adField(T('Nötige Gruppe (DN, optional)'), l.requiredGroup), adField(T('Gruppe für Adminrechte (DN, optional)'), l.adminGroup)),
    h('label', { class: 'check' }, l.nestedGroups, T('Verschachtelte Gruppen auflösen (nur Active Directory)')),
    testButton('ldap', text(''))),
  h('fieldset', {}, h('legend', {}, 'SAML 2.0'),
    h('label', { class: 'check' }, sa.enabled, T('Anmeldung über SAML einschalten')),
    h('p', { class: 'muted small' }, T`Metadaten für den Identitätsanbieter: ${location.origin}/api/auth/saml/metadata · Antwortadresse (ACS): ${location.origin}/api/auth/saml/acs`),
    adField(T('Anmeldeadresse des Identitätsanbieters (SSO-URL)'), sa.entryPoint), adField(T('Zertifikat des Identitätsanbieters (PEM)'), sa.idpCert),
    h('div', { class: 'form-row' }, adField(T('Eigene Kennung (Entity ID, optional)'), sa.issuer), adField(T('Text auf der Schaltfläche'), sa.label)),
    h('div', { class: 'form-row' }, adField(T('Attribut für die E-Mail-Adresse'), sa.attrEmail), adField(T('Attribut für den Namen'), sa.attrName)),
    h('div', { class: 'form-row' }, adField(T('Attribut für Gruppen'), sa.attrGroups), adField(T('Nötige Gruppe (optional)'), sa.requiredGroup)),
    adField(T('Gruppe für Adminrechte (optional)'), sa.adminGroup),
    testButton('saml')),
  h('fieldset', {}, h('legend', {}, 'SCIM 2.0'),
    h('label', { class: 'check' }, scimOn, T('Konten automatisch über SCIM anlegen und sperren')),
    h('p', { class: 'muted small' }, T`Der Identitätsanbieter verwaltet die Konten über ${location.origin}/scim/v2. Gesperrt wird statt gelöscht, Boards bleiben erhalten. Gruppen werden nicht übertragen.`),
    h('div', {}, h('button', { type: 'button', class: 'btn', onclick: async () => {
      if (scim.hasToken && !(await confirmDialog(T('Neues Token erzeugen'), T('Das bisherige Token verliert sofort seine Gültigkeit.'), T('Erzeugen'), true))) return;
      try {
        const r = await api('/api/admin/scim/token', { method: 'POST' });
        scimOut.textContent = '';
        scimOut.append(h('p', {}, T('Das Token wird nur jetzt angezeigt:')), h('pre', { class: 'codes' }, r.token));
      } catch (ex) {
        toast(ex.message);
      }
    } }, scim.hasToken ? T('Neues Token erzeugen') : T('Token erzeugen'))), scimOut),
  h('fieldset', {}, h('legend', {}, 'Kerberos (SSO)'),
    h('label', { class: 'check' }, k.enabled, T('Einmalanmeldung per Kerberos einschalten')),
    h('p', { class: 'muted small' }, T('Braucht eine Keytab-Datei für den Dienst (KRB5_KTNAME) und im Browser die Freigabe dieser Adresse. Ist LDAP eingeschaltet, kommen Adresse, Name und Gruppen aus dem Verzeichnis.')),
    h('div', { class: 'form-row' }, adField(T('Realm'), k.realm), adField(T('Dienstprinzipal (optional)'), k.servicePrincipal)),
    h('div', { class: 'form-row' }, adField(T('Text auf der Schaltfläche'), k.label), adField(T('E-Mail-Domain (nötig ohne LDAP)'), k.emailDomain, T('Kurzname@Domain muss das Postfach der Person sein: Darüber werden Konten und Einladungen zugeordnet.'))),
    testButton('kerberos')),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, T('Speichern'))));
  section(T('Anmeldung'), form);
}

async function collab() {
  const all = await api('/api/admin/settings');
  const c = all.collab;
  const err = errorBox();
  const mentionEmails = h('input', { type: 'checkbox', checked: c.mentionEmails });
  const guestLinks = h('input', { type: 'checkbox', checked: c.guestLinks });
  const guestMaxDays = h('input', { type: 'number', min: 1, max: 365, value: c.guestMaxDays });
  const teamCreation = h('select', {}, h('option', { value: 'all', selected: c.teamCreation === 'all' }, T('alle angemeldeten Benutzer')), h('option', { value: 'admins', selected: c.teamCreation === 'admins' }, T('nur Administratoren')));
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
    if (c.guestLinks && !guestLinks.checked && !(await confirmDialog(T('Gastzugang abschalten'), T('Alle bestehenden Gastlinks werden gesperrt und alle Gäste sofort abgemeldet.'), T('Abschalten'), true))) return;
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { collab: {
        mentionEmails: mentionEmails.checked, guestLinks: guestLinks.checked, guestMaxDays: Number(guestMaxDays.value),
        teamCreation: teamCreation.value, recordings: recordings.checked, recordingMaxMinutes: Number(recordingMax.value),
        files: files.checked, fileMaxMb: Number(fileMax.value), trashDays: Number(trashDays.value),
        webhooks: webhooks.checked, webhookPrivate: webhookPrivate.checked,
      } } });
      toast(T('Einstellungen gespeichert'));
      collab();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('fieldset', {}, h('legend', {}, T('Benachrichtigungen')),
    h('label', { class: 'check' }, mentionEmails, T('E-Mails bei @Erwähnungen, Antworten und zugewiesenen Kommentaren verschicken')),
    h('p', { class: 'muted small' }, T('In der Glocke erscheinen Benachrichtigungen immer. E-Mails gehen nur an Personen, die gerade nicht im Board sind – höchstens eine je Board alle zehn Minuten. Jede Person kann sie im Profil abschalten. Voraussetzung ist ein eingerichteter Mailserver.'))),
  h('fieldset', {}, h('legend', {}, T('Gastzugang per Link')),
    h('label', { class: 'check' }, guestLinks, T('Besitzer dürfen Gastlinks erstellen (Zugang ohne Konto)')),
    h('label', {}, T('Längste Gültigkeit eines Gastlinks (Tage)'), guestMaxDays),
    h('p', { class: 'muted small' }, T('Gäste geben nur einen Namen an, sehen ausschließlich das eine Board und dürfen höchstens kommentieren. Ihre Zugänge werden mit Ablauf oder Sperre des Links gelöscht. Bitte die Datenschutzerklärung ergänzen (Vorlage unter „Rechtliches“).'))),
  h('fieldset', {}, h('legend', {}, T('Teams')),
    h('label', {}, T('Teams anlegen dürfen'), teamCreation)),
  h('fieldset', {}, h('legend', {}, T('Aufzeichnungen (Rundgänge)')),
    h('label', { class: 'check' }, recordings, T('Aufzeichnungen erlauben (Ansicht, Zeiger, Laser – optional mit Ton)')),
    h('label', {}, T('Längste Aufzeichnung (Minuten)'), recordingMax),
    h('p', { class: 'muted small' }, T('Tonspuren werden wie Uploads auf Schadsoftware geprüft und bis zum Löschen der Aufzeichnung gespeichert.'))),
  h('fieldset', {}, h('legend', {}, T('Dateianhänge')),
    h('label', { class: 'check' }, files, T('Dateien auf Boards erlauben (PDF, Word, Excel, PowerPoint, OpenDocument, Text, CSV, JSON)')),
    h('label', {}, T('Größte Datei (MB)'), fileMax),
    h('p', { class: 'muted small' }, T('Der Dateityp wird am Inhalt erkannt, jede Datei auf Schadsoftware geprüft und immer als Download ausgeliefert. Nicht mehr verwendete Dateien werden nach sieben Tagen entfernt.'))),
  h('fieldset', {}, h('legend', {}, T('Papierkorb')),
    h('label', {}, T('Gelöschte Boards aufbewahren (Tage)'), trashDays),
    h('p', { class: 'muted small' }, T('Bis dahin können Besitzer gelöschte Boards wiederherstellen; danach werden sie endgültig entfernt.'))),
  h('fieldset', {}, h('legend', {}, T('Chat-Anbindung (Webhooks)')),
    h('label', { class: 'check' }, webhooks, T('Webhooks erlauben (Microsoft Teams, Slack, Matrix oder JSON)')),
    h('label', { class: 'check' }, webhookPrivate, T('Auch interne Adressen zulassen (Intranet, localhost) und http ohne Verschlüsselung')),
    h('p', { class: 'muted small' }, T('Personen können Benachrichtigungen an einen eigenen Kanal schicken lassen, Team-Verwaltende neue Team-Boards und Retro-Zusammenfassungen. Der Server ruft dabei fremde Adressen auf; interne Netze sind gesperrt, solange die zweite Option aus ist. Die Weitergabe an den Chat-Dienst gehört in die Datenschutzerklärung.'))),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, T('Speichern'))));
  section(T('Zusammenarbeit'), form);
}

/* ---------------- Anbindungen ---------------- */

async function integrations() {
  const { connections } = await api('/api/admin/trackers');
  const list = h('div', { class: 'form' });
  const test = async (c, out) => {
    out.textContent = T('Wird geprüft …');
    try {
      const r = await api(`/api/admin/trackers/${c.id}/test`, { method: 'POST' });
      out.textContent = r.ok ? T('✓ Verbindung funktioniert') : `✗ ${r.error}`;
    } catch (e) {
      out.textContent = e.message;
    }
  };
  for (const c of connections) {
    const out = h('span', { class: 'small', role: 'status' });
    list.append(h('div', { class: 'row wrap' }, h('b', {}, c.name), h('span', { class: 'muted small' }, `${c.kind === 'azure' ? 'Azure DevOps' : 'Jira'} · ${c.baseUrl}`), h('span', { class: 'spacer' }), out,
      h('button', { class: 'btn small', onclick: () => test(c, out) }, T('Testen')),
      h('button', { class: 'btn small danger', onclick: async () => {
        if (!(await confirmDialog(T('Verbindung löschen'), T`„${c.name}“ wird gelöscht. Boards verlieren ihre Verbindung, die Karten bleiben.`, T('Löschen'), true))) return;
        await api('/api/admin/trackers/' + c.id, { method: 'DELETE' }).catch((e) => toast(e.message));
        integrations();
      } }, T('Löschen'))));
  }
  const err = errorBox();
  const kind = h('select', {}, h('option', { value: 'jira' }, 'Jira'), h('option', { value: 'azure' }, 'Azure DevOps'));
  const name = h('input', { type: 'text', required: true, maxlength: 80 });
  const baseUrl = h('input', { type: 'url', required: true, placeholder: 'https://firma.atlassian.net' });
  const username = h('input', { type: 'text', autocomplete: 'off' });
  const secret = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
  const form = h('form', { class: 'form admin-form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      await api('/api/admin/trackers', { method: 'POST', body: { kind: kind.value, name: name.value, baseUrl: baseUrl.value, username: username.value, secret: secret.value } });
      toast(T('Verbindung gespeichert'));
      integrations();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('fieldset', {}, h('legend', {}, T('Neue Verbindung')),
    h('div', { class: 'form-row' }, h('label', {}, T('Dienst'), kind), h('label', {}, T('Name'), name)),
    h('label', {}, T('Adresse'), baseUrl, h('span', { class: 'field-hint' }, T('Jira: Adresse der Instanz. Azure DevOps: https://dev.azure.com/organisation'))),
    h('div', { class: 'form-row' }, h('label', {}, T('Benutzer (Jira Cloud: E-Mail-Adresse, sonst leer)'), username), h('label', {}, T('API-Token oder persönliches Zugriffstoken'), secret)),
    h('p', { class: 'muted small' }, T('Alle, die ein Board bearbeiten dürfen, können über diese Verbindung Tickets lesen und ändern. Gib dem Token daher nur Zugriff auf die nötigen Projekte.')),
    err.el,
    h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, T('Speichern')))));
  section(T('Anbindungen'), h('h2', {}, T('Jira und Azure DevOps')), connections.length ? list : h('p', { class: 'muted' }, T('Noch keine Verbindung eingerichtet.')), form);
}

/* ---------------- Design und zentrale Vorlagen ---------------- */

async function brand() {
  const all = await api('/api/admin/settings');
  const d = all.design;
  const err = errorBox();
  const accent = h('input', { type: 'text', value: d.accent, placeholder: '#4262ff', spellcheck: 'false', maxlength: 7 });
  const picker = h('input', { type: 'color', value: d.accent || '#4262ff', 'aria-label': T('Akzentfarbe wählen'), oninput: (e) => (accent.value = e.target.value) });
  const palette = h('textarea', { rows: 2, spellcheck: 'false', placeholder: '#1a1a1a #4262ff #12b886' }, d.palette);
  const sticky = h('textarea', { rows: 2, spellcheck: 'false', placeholder: '#fff9b1 #a6ccf5 #93d275' }, d.stickyColors);
  const hideBuiltin = h('input', { type: 'checkbox', checked: d.hideBuiltin });
  const form = h('form', { class: 'form admin-form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { design: { accent: accent.value, palette: palette.value, stickyColors: sticky.value, hideBuiltin: hideBuiltin.checked } } });
      toast(T('Einstellungen gespeichert'));
      location.reload();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('fieldset', {}, h('legend', {}, T('Designvorgaben')),
    h('label', {}, T('Akzentfarbe'), h('div', { class: 'row' }, picker, accent), h('span', { class: 'field-hint' }, T('Schrift auf Akzentfarbe und Links passen sich an, damit der Kontrast stimmt. Leer = Standard.'))),
    h('label', {}, T('Farben für Formen und Text'), palette, h('span', { class: 'field-hint' }, T('Hexwerte, getrennt durch Leerzeichen. Nur diese Farben stehen dann zur Auswahl. Leer = Standard.'))),
    h('label', {}, T('Farben für Haftnotizen'), sticky),
    h('p', { class: 'muted small' }, T('Die Vorgaben gelten für neue Inhalte. Bestehende Elemente behalten ihre Farbe.'))),
  h('fieldset', {}, h('legend', {}, T('Vorlagen')),
    h('label', { class: 'check' }, hideBuiltin, T('Nur zentrale und eigene Vorlagen anbieten (mitgelieferte ausblenden)')),
    h('p', { class: 'muted small' }, T('Zentrale Vorlagen legst du im Board an: Exportieren & Importieren → Board als Vorlage speichern → Sichtbar für alle. Sie erscheinen bei allen unter „Unsere Vorlagen“.'))),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, T('Speichern'))));
  const { templates } = await api('/api/templates');
  const org = templates.filter((t) => t.scope === 'org');
  section(T('Design & Vorlagen'), form, h('h2', {}, T('Zentrale Vorlagen')),
    org.length ? h('table', { class: 'admin-table' }, h('tbody', {}, org.map((t) => h('tr', {}, h('td', {}, `${t.icon} ${t.name}`), h('td', { class: 'muted' }, t.description), h('td', { class: 'actions' },
      h('button', { class: 'btn small danger', onclick: async () => {
        if (!(await confirmDialog(T('Vorlage löschen'), T`Die Vorlage „${t.name}“ wird gelöscht. Boards, die daraus entstanden sind, bleiben erhalten.`, T('Löschen'), true))) return;
        await api('/api/templates/' + t.id, { method: 'DELETE' }).catch((ex) => toast(ex.message));
        brand();
      } }, T('Löschen'))))))) : h('p', { class: 'muted' }, T('Noch keine zentralen Vorlagen.')));
}

/* ---------------- Mailserver ---------------- */

async function mail() {
  const s = (await api('/api/admin/settings')).smtp;
  const err = errorBox();
  const host = h('input', { type: 'text', value: s.host, placeholder: 'smtp.example.de' });
  const port = h('input', { type: 'number', value: s.port, min: 1, max: 65535 });
  const security = h('select', {},
    h('option', { value: 'starttls', selected: s.security === 'starttls' }, T('STARTTLS (meist Port 587)')),
    h('option', { value: 'tls', selected: s.security === 'tls' }, T('SSL/TLS (meist Port 465)')),
    h('option', { value: 'none', selected: s.security === 'none' }, T('Keine Verschlüsselung (nur im lokalen Netz!)')));
  security.addEventListener('change', () => {
    const def = { starttls: 587, tls: 465, none: 25 }[security.value];
    if ([25, 465, 587].includes(Number(port.value))) port.value = def;
  });
  const user = h('input', { type: 'text', value: s.user, autocomplete: 'off' });
  const pass = h('input', { type: 'password', autocomplete: 'new-password', placeholder: s.hasPassword ? T('•••••••• (gespeichert – leer lassen zum Beibehalten)') : '' });
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
      toast(T('Mailserver gespeichert'));
      mail();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('p', { class: 'muted' }, T('Der Mailserver wird für die E-Mail-Bestätigung bei der Registrierung, „Kennwort vergessen“, Einladungen und Sicherheitshinweise verwendet. Ohne Mailserver ist keine Registrierung möglich.')),
  h('fieldset', {}, h('legend', {}, T('Server')),
    h('div', { class: 'form-row wide-first' }, h('label', {}, T('SMTP-Server'), host), h('label', {}, T('Port'), port)),
    h('label', {}, T('Verschlüsselung'), security),
    h('label', { class: 'check' }, verify, T('TLS-Zertifikat prüfen (nur bei selbstsignierten Zertifikaten abschalten)'))),
  h('fieldset', {}, h('legend', {}, T('Anmeldung')),
    h('label', {}, T('Benutzername'), user, h('span', { class: 'field-hint' }, T('Leer lassen, wenn der Server keine Anmeldung verlangt.'))),
    h('label', {}, T('Kennwort'), pass),
    s.hasPassword ? h('label', { class: 'check' }, clearPw, T('Gespeichertes Kennwort entfernen')) : null),
  h('fieldset', {}, h('legend', {}, T('Absender')),
    h('label', {}, T('Absenderadresse'), from, h('span', { class: 'field-hint' }, T('Muss vom Mailserver akzeptiert werden, oft identisch mit dem Benutzernamen.')))),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, T('Speichern'))),
  h('fieldset', {}, h('legend', {}, T('Verbindung testen')),
    h('p', { class: 'muted small' }, T('Verschickt eine Testnachricht mit den Werten aus dem Formular – auch ohne vorher zu speichern.')),
    h('div', { class: 'copy-row' }, testTo, h('button', { type: 'button', class: 'btn', onclick: async () => {
      testResult.className = 'test-result';
      testResult.textContent = T('Sende …');
      try {
        await api('/api/admin/test-mail', { method: 'POST', body: { to: testTo.value, smtp: values() } });
        testResult.className = 'test-result ok';
        testResult.textContent = T`✅ Testnachricht an ${testTo.value} wurde vom Server angenommen.`;
      } catch (ex) {
        testResult.className = 'test-result fail';
        testResult.textContent = '❌ ' + ex.message;
      }
    } }, T('Testmail senden'))),
    testResult));
  section(T('Mailserver'), form);
}

/* ---------------- Rechtliches: Impressum & Datenschutz ---------------- */

async function legal() {
  const l = (await api('/api/admin/settings')).legal;
  const docs = {
    imprint: { label: T('Impressum'), path: '/impressum', template: IMPRINT_TEMPLATE },
    privacy: { label: T('Datenschutzerklärung'), path: '/datenschutz', template: PRIVACY_TEMPLATE },
  };
  let current = (location.hash.split('/')[1] === 'privacy') ? 'privacy' : 'imprint';
  const texts = { imprint: l.imprint || '', privacy: l.privacy || '' };
  const err = errorBox();
  const tabs = h('div', { class: 'seg' });
  const editor = h('textarea', { class: 'legal-editor', rows: 24, spellcheck: true, 'aria-label': T('Text') });
  const preview = h('article', { class: 'legal-text legal-preview' });
  const status = h('div', { class: 'muted small' });
  const updated = (k) => l[k + 'UpdatedAt'] ? T('zuletzt geändert am ') + new Date(l[k + 'UpdatedAt']).toLocaleString(LOCALE) : T('noch nicht veröffentlicht');

  const renderPreview = () => {
    preview.innerHTML = '';
    preview.append(h('h1', {}, docs[current].label));
    if (editor.value.trim()) preview.append(renderMarkdown(editor.value));
    else preview.append(h('p', { class: 'muted' }, T('Kein Text – die Seite wird nicht verlinkt.')));
  };
  const select = (k) => {
    texts[current] = editor.value;
    current = k;
    editor.value = texts[k];
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.k === k));
    status.innerHTML = '';
    status.append(T`Öffentlich unter `, h('a', { href: docs[k].path, target: '_blank', rel: 'noopener' }, location.origin + docs[k].path), ` · ${updated(k)}`);
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
      toast(T('Gespeichert und veröffentlicht'));
      select(current);
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('div', { class: 'notice' }, h('b', {}, T('Hinweis: ')), T('Die Vorlagen sind Formulierungshilfen, die auf die tatsächliche Datenverarbeitung von vibeboard zugeschnitten sind. Sie ersetzen keine Rechtsberatung. Ersetze alle Angaben in [eckigen Klammern], entferne nicht zutreffende Abschnitte und lass die Texte im Zweifel prüfen.')),
  h('div', { class: 'admin-toolbar' }, tabs, h('span', { class: 'spacer' }),
    h('button', { type: 'button', class: 'btn small', onclick: async () => {
      if (editor.value.trim() && !(await confirmDialog(T('Vorlage einfügen'), T('Der aktuelle Text wird durch die Vorlage ersetzt.'), T('Ersetzen'), true))) return;
      editor.value = docs[current].template;
      renderPreview();
    } }, T('Vorlage einfügen'))),
  status,
  h('div', { class: 'legal-split' },
    h('div', { class: 'legal-col' }, editor,
      h('details', { class: 'md-help' }, h('summary', {}, T('Formatierung')),
        h('pre', {}, T('# Überschrift\n\nAbsatz – Zeilenumbrüche bleiben erhalten.\n\n- Aufzählung\n- noch ein Punkt\n\n**fett**  *kursiv*\n[Linktext](https://example.de)\nE-Mail-Adressen und https://…-Links werden automatisch verlinkt.\n\n---  (Trennlinie)')))),
    h('div', { class: 'legal-col' }, h('div', { class: 'label' }, T('Vorschau')), preview)),
  err.el,
  h('div', { class: 'form-actions start' }, h('button', { type: 'submit', class: 'btn primary' }, T('Speichern & veröffentlichen')),
    h('span', { class: 'muted small' }, T('Leere Texte werden nicht veröffentlicht; die Links verschwinden dann automatisch.'))));
  section(T('Impressum & Datenschutz'), form);
  // Gespeicherten Text zuerst in den Editor laden – select() übernimmt sonst den leeren Editor als Text
  editor.value = texts[current] || '';
  select(current);
}

/* ---------------- Sicherheitsprotokoll ---------------- */

async function audit() {
  const preset = decodeURIComponent(location.hash.split('/')[1] || '');
  const search = h('input', { type: 'search', placeholder: T('Benutzer oder IP …'), 'aria-label': T('Suchen'), class: 'admin-search', value: preset });
  const filter = h('select', { class: 'admin-filter', 'aria-label': T('Ereignis') }, h('option', { value: '' }, T('Alle Ereignisse')));
  const table = h('div', { class: 'table-wrap' });
  const more = h('button', { class: 'btn small hidden' }, T('Ältere laden'));
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
      for (const [k, l] of Object.entries(r.events)) filter.append(h('option', { value: k }, T(l)));
    }
    entries = append ? entries.concat(r.entries) : r.entries;
    more.classList.toggle('hidden', r.entries.length < 200);
    table.innerHTML = '';
    table.append(h('table', { class: 'admin-table' },
      h('thead', {}, h('tr', {}, [T('Zeit'), T('Ereignis'), T('Benutzer'), T('Durch'), T('IP-Adresse'), T('Details')].map((t) => h('th', {}, t)))),
      h('tbody', {}, entries.map((e) => h('tr', { class: /failed/.test(e.event) ? 'row-warn' : '' },
        h('td', { title: fmtDate(e.at) }, new Date(e.at).toLocaleString(LOCALE)),
        h('td', {}, T(e.label)),
        h('td', {}, e.user_name || (e.details && e.details.login) || h('span', { class: 'muted' }, '–')),
        h('td', {}, e.actor_name || ''),
        h('td', { title: e.user_agent || '' }, e.ip || ''),
        h('td', { class: 'muted small' }, e.details ? Object.entries(e.details).filter(([k]) => k !== 'login').map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ') : ''))))));
    if (!entries.length) table.append(h('p', { class: 'muted pad' }, T('Keine Einträge.')));
  }
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => load().catch((e) => toast(e.message)), 300);
  });
  filter.addEventListener('change', () => load().catch((e) => toast(e.message)));
  more.addEventListener('click', () => load(true).catch((e) => toast(e.message)));
  section(T('Sicherheitsprotokoll'),
    h('p', { class: 'muted' }, T('Anmeldungen, Kontoänderungen und Administrationsaktionen der letzten 12 Monate.')),
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
  btn.style.color = readableOn(me.color);
  btn.onclick = () => menu(btn, accountMenuItems(me, (u) => (me = u)), { placement: 'bottom' });
  window.addEventListener('hashchange', route);
  route();
  legalFooter().then((f) => nav.append(f));
})();
