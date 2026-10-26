// Anmelden, Registrieren, Kennwort vergessen / zurücksetzen
import { h, append, api, loadPref } from './util.js';

const box = document.getElementById('auth');
const params = new URLSearchParams(location.search);
const mode = location.pathname.slice(1) || 'login';
let config = { siteName: 'dlzboard', registration: 'open', requireEmail: false, mailEnabled: false, needsSetup: false };

if (loadPref('settings', {}).dark) document.body.classList.add('dark');

// Nur relative Ziele innerhalb der Anwendung zulassen
function nextUrl() {
  const n = params.get('next') || '/';
  return n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

const logo = () => h('div', { class: 'auth-brand', html: `<svg viewBox="0 0 32 32" width="40" height="40"><rect x="2" y="2" width="28" height="28" rx="7" fill="#4262ff"/><rect x="8" y="8" width="9" height="9" rx="1.5" fill="#fff9b1"/><rect x="15" y="15" width="9" height="9" rx="1.5" fill="#ffcee0"/></svg><span></span>` });

function field(label, attrs, hint) {
  const input = h('input', attrs);
  return { input, el: h('label', {}, label, input, hint ? h('span', { class: 'field-hint' }, hint) : null) };
}

function shell(title, subtitle, ...content) {
  box.innerHTML = '';
  const brand = logo();
  brand.querySelector('span').textContent = config.siteName;
  append(box, brand, h('h1', {}, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null, ...content);
  document.title = `${title} – ${config.siteName}`;
}

function errorBox() {
  const el = h('div', { class: 'form-error hidden', role: 'alert' });
  return { el, show: (m) => { el.textContent = m; el.classList.remove('hidden'); }, hide: () => el.classList.add('hidden') };
}

function submitting(form, on) {
  form.querySelectorAll('button, input').forEach((x) => (x.disabled = on));
}

function renderLogin() {
  const err = errorBox();
  const login = field('Benutzername oder E-Mail', { type: 'text', autocomplete: 'username', required: true, autofocus: true });
  const pw = field('Kennwort', { type: 'password', autocomplete: 'current-password', required: true });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    submitting(form, true);
    try {
      await api('/api/auth/login', { method: 'POST', body: { login: login.input.value, password: pw.input.value } });
      location.href = nextUrl();
    } catch (ex) {
      err.show(ex.message);
      submitting(form, false);
      pw.input.select();
    }
  } }, login.el, pw.el, err.el, h('button', { type: 'submit', class: 'btn primary block' }, 'Anmelden'));
  const links = h('div', { class: 'auth-links' },
    config.mailEnabled ? h('a', { href: '/forgot' }, 'Kennwort vergessen?') : h('span', { class: 'muted small' }, 'Kennwort vergessen? Wende dich an einen Administrator.'),
    config.registration !== 'closed' ? h('span', {}, 'Noch kein Konto? ', h('a', { href: '/register' + location.search }, 'Registrieren')) : null);
  shell('Anmelden', null, form, links);
  if (config.needsSetup) location.replace('/register');
}

function renderRegister() {
  if (config.registration === 'closed') {
    shell('Registrierung geschlossen', 'Neue Konten können derzeit nur von einem Administrator angelegt werden.', h('a', { class: 'btn primary block', href: '/login' }, 'Zur Anmeldung'));
    return;
  }
  const err = errorBox();
  const user = field('Benutzername', { type: 'text', autocomplete: 'username', required: true, autofocus: true, pattern: '[A-Za-z0-9][A-Za-z0-9._\\-]{2,31}', maxlength: 32 }, '3–32 Zeichen: Buchstaben, Ziffern, . _ -');
  const display = field('Anzeigename (optional)', { type: 'text', autocomplete: 'name', maxlength: 60 }, 'So sehen dich andere auf den Boards.');
  const email = field(config.requireEmail ? 'E-Mail-Adresse' : 'E-Mail-Adresse (optional)', { type: 'email', autocomplete: 'email', required: config.requireEmail }, 'Für Einladungen und zum Zurücksetzen des Kennworts.');
  const pw = field('Kennwort', { type: 'password', autocomplete: 'new-password', required: true, minlength: 8 }, 'Mindestens 8 Zeichen.');
  const pw2 = field('Kennwort wiederholen', { type: 'password', autocomplete: 'new-password', required: true });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    if (pw.input.value !== pw2.input.value) return err.show('Die Kennwörter stimmen nicht überein.');
    submitting(form, true);
    try {
      const r = await api('/api/auth/register', { method: 'POST', body: { username: user.input.value, displayName: display.input.value, email: email.input.value, password: pw.input.value } });
      if (r.status === 'pending') {
        shell('Fast geschafft', 'Dein Konto wurde angelegt und muss noch von einem Administrator freigeschaltet werden.' + (email.input.value && config.mailEnabled ? ' Du bekommst eine E-Mail, sobald es so weit ist.' : ''),
          h('a', { class: 'btn primary block', href: '/login' }, 'Zur Anmeldung'));
        return;
      }
      location.href = nextUrl();
    } catch (ex) {
      err.show(ex.message);
      submitting(form, false);
    }
  } },
  config.needsSetup ? h('div', { class: 'hint' }, h('b', {}, 'Ersteinrichtung'), 'Das erste Konto erhält automatisch Administratorrechte.') : null,
  config.registration === 'approval' && !config.needsSetup ? h('div', { class: 'hint' }, 'Neue Konten werden von einem Administrator freigeschaltet.') : null,
  user.el, display.el, email.el, pw.el, pw2.el, err.el,
  h('button', { type: 'submit', class: 'btn primary block' }, config.needsSetup ? 'Administrator-Konto anlegen' : 'Konto erstellen'));
  shell(config.needsSetup ? 'Willkommen!' : 'Konto erstellen', null, form,
    config.needsSetup ? null : h('div', { class: 'auth-links' }, h('span', {}, 'Schon registriert? ', h('a', { href: '/login' + location.search }, 'Anmelden'))));
}

function renderForgot() {
  const err = errorBox();
  const login = field('Benutzername oder E-Mail', { type: 'text', autocomplete: 'username', required: true, autofocus: true });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    submitting(form, true);
    try {
      const r = await api('/api/auth/forgot', { method: 'POST', body: { login: login.input.value } });
      shell('E-Mail unterwegs', r.mail === false
        ? 'Der E-Mail-Versand ist nicht eingerichtet. Bitte wende dich an einen Administrator.'
        : 'Falls ein Konto mit hinterlegter E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt. Er ist eine Stunde gültig.',
      h('a', { class: 'btn primary block', href: '/login' }, 'Zur Anmeldung'));
    } catch (ex) {
      err.show(ex.message);
      submitting(form, false);
    }
  } }, login.el, err.el, h('button', { type: 'submit', class: 'btn primary block' }, 'Link anfordern'));
  shell('Kennwort vergessen', 'Wir schicken dir einen Link, mit dem du ein neues Kennwort festlegen kannst.', form,
    h('div', { class: 'auth-links' }, h('a', { href: '/login' }, 'Zurück zur Anmeldung')));
}

function renderReset() {
  const token = params.get('token');
  if (!token) return shell('Link unvollständig', 'Bitte öffne den Link aus der E-Mail vollständig.', h('a', { class: 'btn primary block', href: '/forgot' }, 'Neuen Link anfordern'));
  const err = errorBox();
  const pw = field('Neues Kennwort', { type: 'password', autocomplete: 'new-password', required: true, minlength: 8, autofocus: true }, 'Mindestens 8 Zeichen.');
  const pw2 = field('Kennwort wiederholen', { type: 'password', autocomplete: 'new-password', required: true });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    if (pw.input.value !== pw2.input.value) return err.show('Die Kennwörter stimmen nicht überein.');
    submitting(form, true);
    try {
      await api('/api/auth/reset', { method: 'POST', body: { token, password: pw.input.value } });
      shell('Kennwort geändert', 'Du kannst dich jetzt mit deinem neuen Kennwort anmelden.', h('a', { class: 'btn primary block', href: '/login' }, 'Zur Anmeldung'));
    } catch (ex) {
      err.show(ex.message);
      submitting(form, false);
    }
  } }, h('input', { type: 'text', autocomplete: 'username', hidden: true, 'aria-hidden': 'true' }), pw.el, pw2.el, err.el, h('button', { type: 'submit', class: 'btn primary block' }, 'Kennwort speichern'));
  shell('Neues Kennwort', null, form);
}

(async () => {
  try {
    config = await api('/api/config');
  } catch {}
  ({ login: renderLogin, register: renderRegister, forgot: renderForgot, reset: renderReset }[mode] || renderLogin)();
})();
