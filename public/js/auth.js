// Anmelden (inkl. Zwei-Faktor), Registrieren, E-Mail bestätigen, Kennwort vergessen / zurücksetzen
import { T } from './i18n.js';
import { h, append, api, loadPref } from './util.js';
import { passwordMeter } from './pwmeter.js';
import { legalFooter } from './footer.js';

const box = document.getElementById('auth');
const params = new URLSearchParams(location.search);
const mode = location.pathname.slice(1) || 'login';
let config = { siteName: 'vibeboard', registration: 'open', registrationReason: '', passwordMinLength: 12, mailEnabled: false, needsSetup: false };

if (loadPref('settings', {}).dark) document.body.classList.add('dark');

// Token nicht im Verlauf/Referrer stehen lassen
if (params.get('token')) history.replaceState(null, '', location.pathname);

// Nur relative Ziele innerhalb der Anwendung zulassen
function nextUrl() {
  try {
    const u = new URL(params.get('next') || '/', location.origin);
    return u.origin === location.origin ? u.pathname + u.search + u.hash : '/';
  } catch {
    return '/';
  }
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
  box.querySelector('input:not([type=hidden]):not([hidden])')?.focus();
}

function errorBox() {
  const el = h('div', { class: 'form-error hidden', role: 'alert' });
  return { el, show: (m) => { el.textContent = m; el.classList.remove('hidden'); }, hide: () => el.classList.add('hidden') };
}

const toLogin = (label = T('Zur Anmeldung')) => h('a', { class: 'btn primary block', href: '/login' }, label);

/* ---------------- Anmelden ---------------- */

function renderLogin() {
  if (config.needsSetup) return location.replace('/register');
  const err = errorBox();
  const extra = h('div');
  const login = field(T('E-Mail-Adresse'), { type: 'text', inputmode: 'email', autocomplete: 'username', required: true, autocapitalize: 'none', spellcheck: 'false' },
    T('Früher hast du dich mit einem Benutzernamen angemeldet? Jetzt gilt die E-Mail-Adresse deines Kontos.'));
  const pw = field(T('Kennwort'), { type: 'password', autocomplete: 'current-password', required: true });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    extra.innerHTML = '';
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { login: login.input.value, password: pw.input.value } });
      if (r.mfa) return renderMfa(r.ticket);
      location.href = nextUrl();
    } catch (ex) {
      err.show(ex.message);
      pw.input.select();
      if (ex.code === 'unverified') {
        extra.append(h('button', { type: 'button', class: 'btn block', onclick: async (ev) => {
          await api('/api/auth/resend-verification', { method: 'POST', body: { login: login.input.value } });
          ev.target.replaceWith(h('p', { class: 'muted small' }, T('Falls die Adresse noch nicht bestätigt ist, haben wir dir eine neue Bestätigungsmail geschickt.')));
        } }, T('Bestätigungsmail erneut senden')));
      }
    }
  } }, login.el, pw.el, err.el, extra, h('button', { type: 'submit', class: 'btn primary block' }, T('Anmelden')));
  const links = h('div', { class: 'auth-links' },
    config.mailEnabled ? h('a', { href: '/forgot' }, T('Kennwort vergessen?')) : h('span', { class: 'muted small' }, T('Kennwort vergessen? Wende dich an einen Administrator.')),
    config.registration !== 'closed' ? h('span', {}, T('Noch kein Konto? '), h('a', { href: '/register' + location.search }, T('Registrieren'))) : null);
  shell(T('Anmelden'), null, form, links);
}

function renderMfa(ticket) {
  const err = errorBox();
  const code = field(T('Bestätigungscode'), { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', required: true, maxlength: 20, pattern: '[0-9a-zA-Z -]{6,20}' },
    T('Den 6-stelligen Code aus deiner Authenticator-App – oder einen Wiederherstellungscode.'));
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      await api('/api/auth/login/mfa', { method: 'POST', body: { ticket, code: code.input.value } });
      location.href = nextUrl();
    } catch (ex) {
      if (ex.code === 'mfa_expired') return renderLogin();
      err.show(ex.message);
      code.input.select();
    }
  } }, code.el, err.el, h('button', { type: 'submit', class: 'btn primary block' }, T('Bestätigen')));
  shell(T('Zwei-Faktor-Anmeldung'), T('Bitte gib den aktuellen Code ein.'), form,
    h('div', { class: 'auth-links' }, h('a', { href: '/login' }, T('Abbrechen'))));
}

/* ---------------- Registrieren ---------------- */

async function renderRegister() {
  // Einladungslink: Adresse und Hinweis, wer was teilen möchte
  const inviteToken = new URLSearchParams(location.search).get('invite') || '';
  let invite = null;
  if (inviteToken) invite = await api('/api/invites/' + encodeURIComponent(inviteToken)).catch(() => null);
  if (config.registration === 'closed') {
    shell(T('Registrierung nicht möglich'), config.registrationReason || T('Neue Konten können derzeit nur von einem Administrator angelegt werden.'), toLogin());
    return;
  }
  const err = errorBox();
  const min = config.passwordMinLength;
  const user = field(T('Name'), { type: 'text', autocomplete: 'name', required: true, maxlength: 60 }, T('So sehen dich andere auf den Boards – zum Beispiel Vor- und Nachname.'));
  const email = field(T('E-Mail-Adresse'), { type: 'email', autocomplete: 'email', required: true, value: invite ? invite.email : '' },
    config.needsSetup ? T('Damit meldest du dich an.') : T('Damit meldest du dich an. Du bekommst einen Bestätigungslink; Wegwerf-Adressen sind nicht möglich.'));
  const pw = field(T('Kennwort'), { type: 'password', autocomplete: 'new-password', required: true, minlength: min, maxlength: 256 });
  const pw2 = field(T('Kennwort wiederholen'), { type: 'password', autocomplete: 'new-password', required: true });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    if (pw.input.value !== pw2.input.value) return err.show(T('Die Kennwörter stimmen nicht überein.'));
    try {
      const r = await api('/api/auth/register', { method: 'POST', body: { name: user.input.value, email: email.input.value, password: pw.input.value, inviteToken: invite ? inviteToken : undefined } });
      if (r.status === 'pending') {
        shell(T('Fast geschafft'), T('Dein Konto wartet noch auf die Freigabe durch einen Administrator. Danach kannst du dich anmelden; das Geteilte steht dann bereit.'), toLogin());
        return;
      }
      if (r.status === 'verify') {
        shell(T('Bitte E-Mail bestätigen'), T`Wir haben einen Bestätigungslink an ${email.input.value} geschickt. Bitte öffne ihn, um dein Konto zu aktivieren. Der Link ist 48 Stunden gültig.`,
          h('p', { class: 'muted small' }, T('Keine E-Mail erhalten? Prüfe den Spam-Ordner. Auf der Anmeldeseite kannst du die Bestätigungsmail erneut anfordern.')),
          toLogin());
        return;
      }
      location.href = nextUrl();
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  invite ? h('div', { class: 'hint' }, h('b', {}, invite.kind === 'team' ? T`${invite.inviter} lädt dich in das Team „${invite.name}“ ein` : T`${invite.inviter} möchte das Board „${invite.name}“ mit dir teilen`), T('Registriere dich mit dieser E-Mail-Adresse – danach steht es direkt bereit.')) : null,
  inviteToken && !invite ? h('div', { class: 'hint' }, T('Diese Einladung ist ungültig oder abgelaufen. Du kannst dich trotzdem registrieren.')) : null,
  config.needsSetup ? h('div', { class: 'hint' }, h('b', {}, T('Ersteinrichtung')), T('Das erste Konto erhält automatisch Administratorrechte. Richte danach in der Administration den Mailserver ein, damit sich weitere Personen registrieren können.')) : null,
  config.registration === 'approval' && !config.needsSetup ? h('div', { class: 'hint' }, T('Nach der Bestätigung deiner E-Mail-Adresse schaltet ein Administrator dein Konto frei.')) : null,
  user.el, email.el, pw.el, passwordMeter(pw.input, min), pw2.el,
  config.legal && config.legal.privacy ? h('p', { class: 'muted small' }, T('Informationen zur Verarbeitung deiner Daten findest du in der '),
    h('a', { href: '/datenschutz', target: '_blank', rel: 'noopener' }, T('Datenschutzerklärung')), '.') : null,
  err.el,
  h('button', { type: 'submit', class: 'btn primary block' }, config.needsSetup ? T('Administrator-Konto anlegen') : T('Konto erstellen')));
  shell(config.needsSetup ? T('Willkommen!') : T('Konto erstellen'), null, form,
    config.needsSetup ? null : h('div', { class: 'auth-links' }, h('span', {}, T('Schon registriert? '), h('a', { href: '/login' + location.search }, T('Anmelden')))));
}

/* ---------------- E-Mail bestätigen ---------------- */

async function renderVerify() {
  const token = params.get('token');
  if (!token) return shell(T('Link unvollständig'), T('Bitte öffne den Link aus der E-Mail vollständig.'), toLogin());
  shell(T('E-Mail wird bestätigt …'), null);
  try {
    const r = await api('/api/auth/verify', { method: 'POST', body: { token } });
    if (r.changed) return shell(T('Neue Adresse bestätigt'), T('Deine E-Mail-Adresse wurde geändert.'), h('a', { class: 'btn primary block', href: '/' }, T('Weiter')));
    if (r.status === 'pending') return shell(T('E-Mail bestätigt'), T('Danke! Ein Administrator schaltet dein Konto in Kürze frei. Du bekommst dann eine E-Mail.'), toLogin());
    shell(T('E-Mail bestätigt'), T('Dein Konto ist aktiv. Du kannst dich jetzt anmelden.'), toLogin(T('Jetzt anmelden')));
  } catch (ex) {
    shell(T('Bestätigung fehlgeschlagen'), ex.message, toLogin());
  }
}

/* ---------------- Kennwort vergessen / zurücksetzen ---------------- */

function renderForgot() {
  const err = errorBox();
  const login = field(T('E-Mail-Adresse'), { type: 'email', autocomplete: 'email', required: true, autocapitalize: 'none' });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      const r = await api('/api/auth/forgot', { method: 'POST', body: { login: login.input.value } });
      shell(T('E-Mail unterwegs'), r.mail === false
        ? T('Der E-Mail-Versand ist nicht eingerichtet. Bitte wende dich an einen Administrator.')
        : T('Falls ein Konto mit hinterlegter E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt. Er ist eine Stunde gültig.'),
      toLogin());
    } catch (ex) {
      err.show(ex.message);
    }
  } }, login.el, err.el, h('button', { type: 'submit', class: 'btn primary block' }, T('Link anfordern')));
  shell(T('Kennwort vergessen'), T('Wir schicken dir einen Link, mit dem du ein neues Kennwort festlegen kannst.'), form,
    h('div', { class: 'auth-links' }, h('a', { href: '/login' }, T('Zurück zur Anmeldung'))));
}

const resetToken = params.get('token');

function renderReset() {
  if (!resetToken) return shell(T('Link unvollständig'), T('Bitte öffne den Link aus der E-Mail vollständig.'), h('a', { class: 'btn primary block', href: '/forgot' }, T('Neuen Link anfordern')));
  const err = errorBox();
  const min = config.passwordMinLength;
  const pw = field(T('Neues Kennwort'), { type: 'password', autocomplete: 'new-password', required: true, minlength: min, maxlength: 256 });
  const pw2 = field(T('Kennwort wiederholen'), { type: 'password', autocomplete: 'new-password', required: true });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    if (pw.input.value !== pw2.input.value) return err.show(T('Die Kennwörter stimmen nicht überein.'));
    try {
      await api('/api/auth/reset', { method: 'POST', body: { token: resetToken, password: pw.input.value } });
      shell(T('Kennwort gespeichert'), T('Du kannst dich jetzt mit deinem neuen Kennwort anmelden.'), toLogin());
    } catch (ex) {
      err.show(ex.message);
    }
  } }, h('input', { type: 'text', autocomplete: 'username', hidden: true, 'aria-hidden': 'true' }),
  pw.el, passwordMeter(pw.input, min), pw2.el, err.el, h('button', { type: 'submit', class: 'btn primary block' }, T('Kennwort speichern')));
  shell(T('Neues Kennwort festlegen'), null, form);
}

(async () => {
  try {
    config = { ...config, ...(await api('/api/config')) };
  } catch {}
  ({ login: renderLogin, register: renderRegister, verify: renderVerify, forgot: renderForgot, reset: renderReset }[mode] || renderLogin)();
  document.querySelector('.auth-wrap').append(await legalFooter());
})();
