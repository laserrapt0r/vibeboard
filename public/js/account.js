// Konto-Dialoge (Profil, Kennwort, Zwei-Faktor, Geräte) und Benutzermenü – genutzt von Übersicht, Board und Administration
import { h, api, modal, toast, initials, USER_COLORS, logout, relTime, fmtDate, confirmDialog } from './util.js';
import { passwordMeter } from './pwmeter.js';

let minLength = 12;
api('/api/config').then((c) => (minLength = c.passwordMinLength || 12)).catch(() => {});

function colorPicker(current, onPick) {
  const sw = h('div', { class: 'swatches' }, USER_COLORS.map((c) => h('button', {
    type: 'button', class: 'swatch' + (c === current ? ' active' : ''), style: { background: c }, title: c,
    onclick: () => {
      onPick(c);
      sw.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s.title === c));
    },
  })));
  return sw;
}

function errorBox() {
  const box = h('div', { class: 'form-error hidden', role: 'alert' });
  return {
    box,
    show(msg) {
      box.textContent = msg;
      box.classList.remove('hidden');
    },
    hide: () => box.classList.add('hidden'),
  };
}

/* ---------------- Profil ---------------- */

export function openProfileDialog(me, onSaved) {
  let color = me.color;
  const err = errorBox();
  const display = h('input', { type: 'text', value: me.displayName || '', maxlength: 60, required: true, autocomplete: 'name' });
  const email = h('input', { type: 'email', value: me.email || '', placeholder: 'name@beispiel.de', autocomplete: 'email' });
  const status = me.pendingEmail
    ? h('span', { class: 'field-hint warn' }, `Änderung auf ${me.pendingEmail} wartet auf Bestätigung – bitte den Link in der E-Mail öffnen.`)
    : h('span', { class: 'field-hint' }, me.emailVerified && me.email ? '✓ bestätigt. Eine neue Adresse wird erst nach Bestätigung übernommen.' : 'Für Einladungen und „Kennwort vergessen“.');
  const notifyEmail = h('input', { type: 'checkbox', checked: me.notifyEmail !== false });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      const r = await api('/api/auth/me', { method: 'PATCH', body: { displayName: display.value, email: email.value, color, notifyEmail: notifyEmail.checked } });
      m.close();
      toast(r.mailed ? `Gespeichert – bitte bestätige die neue Adresse über den Link an ${email.value}` : 'Profil gespeichert', r.mailed ? 6000 : 2200);
      onSaved && onSaved(r.user);
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('div', { class: 'profile-head' }, h('span', { class: 'avatar lg', style: { background: me.color } }, initials(me.displayName)),
    h('div', {}, h('b', {}, me.email || 'Keine E-Mail-Adresse hinterlegt'), h('div', { class: 'muted small' }, me.role === 'admin' ? 'Administrator' : 'Benutzer'))),
  h('label', {}, 'Name', display, h('span', { class: 'field-hint' }, 'So sehen dich andere. Er muss nicht eindeutig sein.')),
  h('label', {}, 'E-Mail-Adresse', email, status),
  h('div', {}, h('div', { class: 'label' }, 'Farbe (Cursor & Avatar)'), colorPicker(color, (c) => (color = c))),
  h('label', { class: 'check' }, notifyEmail, 'E-Mail bei Erwähnungen, Antworten und zugewiesenen Kommentaren'),
  h('span', { class: 'field-hint' }, 'Höchstens eine E-Mail je Board alle zehn Minuten – und nur, wenn du gerade nicht im Board bist. In der Glocke erscheinen die Hinweise immer.'),
  err.box,
  h('div', { class: 'form-actions' },
    h('button', { type: 'button', class: 'btn', onclick: () => { m.close(); openSecurityDialog(me, onSaved); } }, 'Sicherheit …'),
    h('span', { class: 'spacer' }),
    h('button', { type: 'submit', class: 'btn primary' }, 'Speichern')));
  const m = modal('Profil', form);
}

/* ---------------- Kennwort ---------------- */

export function openPasswordDialog() {
  const err = errorBox();
  const cur = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const pw = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: minLength, maxlength: 256 });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password', required: true });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    if (pw.value !== pw2.value) return err.show('Die Kennwörter stimmen nicht überein.');
    try {
      await api('/api/auth/password', { method: 'POST', body: { current: cur.value, password: pw.value } });
      m.close();
      toast('Kennwort geändert – andere Geräte wurden abgemeldet');
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('input', { type: 'text', autocomplete: 'username', hidden: true, 'aria-hidden': 'true' }),
  h('label', {}, 'Aktuelles Kennwort', cur),
  h('label', {}, 'Neues Kennwort', pw), passwordMeter(pw, minLength),
  h('label', {}, 'Neues Kennwort wiederholen', pw2),
  err.box,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, 'Kennwort ändern')));
  const m = modal('Kennwort ändern', form);
  setTimeout(() => cur.focus(), 0);
}

/* ---------------- Sicherheit: Zwei-Faktor & Geräte ---------------- */

function shortAgent(ua) {
  ua = String(ua || '');
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} unter ${os}` : browser;
}

function showRecoveryCodes(codes) {
  const text = codes.join('\n');
  modal('Wiederherstellungscodes', h('div', { class: 'form' },
    h('p', {}, 'Bewahre diese Codes sicher auf (z. B. ausgedruckt oder im Passwortmanager). Jeder Code funktioniert genau einmal, falls du keinen Zugriff auf deine Authenticator-App hast.'),
    h('pre', { class: 'codes' }, text),
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn', onclick: async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast('Codes kopiert');
        } catch {
          toast('Kopieren nicht möglich – bitte manuell markieren');
        }
      } }, 'Kopieren'))));
}

export async function openSecurityDialog(me, onSaved) {
  const body = h('div', { class: 'form security' });
  const m = modal('Sicherheit', body);

  async function render() {
    const [{ user, recoveryCodesLeft, mfaRequired }, sessions] = await Promise.all([api('/api/auth/me'), api('/api/auth/sessions')]);
    body.innerHTML = '';

    // Zwei-Faktor
    const mfaBox = h('section', { class: 'sec-block' }, h('h3', {}, 'Zwei-Faktor-Anmeldung'));
    if (user.mfa) {
      mfaBox.append(
        h('p', {}, h('span', { class: 'pill ok' }, 'Aktiv'), ` Bei der Anmeldung wird zusätzlich ein Code aus deiner Authenticator-App abgefragt. Noch ${recoveryCodesLeft} Wiederherstellungscodes übrig.`),
        h('div', { class: 'row wrap' },
          h('button', { type: 'button', class: 'btn small', onclick: () => askPassword('Neue Wiederherstellungscodes', 'Die bisherigen Codes werden ungültig.', async (password) => {
            const r = await api('/api/auth/2fa/recovery-codes', { method: 'POST', body: { password } });
            showRecoveryCodes(r.recoveryCodes);
            render();
          }) }, 'Neue Wiederherstellungscodes'),
          h('button', { type: 'button', class: 'btn small danger', onclick: () => askPassword('Zwei-Faktor-Anmeldung ausschalten', mfaRequired ? 'Achtung: Für Administratoren ist die Zwei-Faktor-Anmeldung vorgeschrieben – ohne sie hast du keinen Zugriff auf die Administration.' : 'Dein Konto ist danach nur noch durch das Kennwort geschützt.', async (password) => {
            await api('/api/auth/2fa/disable', { method: 'POST', body: { password } });
            toast('Zwei-Faktor-Anmeldung ausgeschaltet');
            render();
          }) }, 'Ausschalten')));
    } else {
      mfaBox.append(
        h('p', {}, mfaRequired ? h('b', {}, 'Für Administratoren vorgeschrieben. ') : null,
          'Schützt dein Konto zusätzlich mit einem Code aus einer Authenticator-App (z. B. Aegis, FreeOTP, 2FAS, Google oder Microsoft Authenticator).'),
        h('button', { type: 'button', class: 'btn primary small', onclick: () => setupMfa(render) }, 'Einrichten'));
    }
    body.append(mfaBox);

    // Geräte
    const list = h('div', { class: 'sessions' }, sessions.map((s) => h('div', { class: 'session' },
      h('div', {}, h('b', {}, shortAgent(s.userAgent)), s.current ? h('span', { class: 'pill accent' }, 'dieses Gerät') : null,
        h('div', { class: 'muted small', title: `angemeldet ${fmtDate(s.createdAt)}` }, `zuletzt aktiv ${relTime(new Date(s.lastSeenAt).getTime())}${s.ip ? ' · ' + s.ip : ''}`)),
      s.current ? null : h('button', { type: 'button', class: 'btn small', onclick: async () => {
        await api('/api/auth/sessions/' + s.id, { method: 'DELETE' });
        toast('Gerät abgemeldet');
        render();
      } }, 'Abmelden'))));
    body.append(h('section', { class: 'sec-block' }, h('h3', {}, 'Angemeldete Geräte'), list,
      sessions.length > 1 ? h('button', { type: 'button', class: 'btn small', onclick: async () => {
        if (!(await confirmDialog('Andere Geräte abmelden', 'Alle anderen Sitzungen werden beendet.', 'Abmelden'))) return;
        await api('/api/auth/sessions/revoke-others', { method: 'POST' });
        toast('Andere Geräte abgemeldet');
        render();
      } }, 'Alle anderen Geräte abmelden') : null));

    body.append(h('section', { class: 'sec-block' }, h('h3', {}, 'Kennwort'),
      h('button', { type: 'button', class: 'btn small', onclick: () => openPasswordDialog() }, 'Kennwort ändern')));
    onSaved && onSaved(user);
  }

  function askPassword(title, text, fn) {
    const err = errorBox();
    const pw = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const f = h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      try {
        await fn(pw.value);
        mm.close();
      } catch (ex) {
        err.show(ex.message);
      }
    } }, h('p', {}, text), h('label', {}, 'Kennwort zur Bestätigung', pw), err.box,
    h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => mm.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, 'Bestätigen')));
    const mm = modal(title, f);
    setTimeout(() => pw.focus(), 0);
  }

  async function setupMfa(done) {
    let data;
    try {
      data = await api('/api/auth/2fa/setup', { method: 'POST' });
    } catch (ex) {
      return toast(ex.message);
    }
    const err = errorBox();
    const qr = h('div', { class: 'qr' });
    qr.innerHTML = data.qr; // vom Server erzeugtes SVG, enthält nur Rechtecke
    const code = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', required: true, maxlength: 6, pattern: '[0-9]{6}', placeholder: '123456' });
    const f = h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      try {
        const r = await api('/api/auth/2fa/enable', { method: 'POST', body: { code: code.value } });
        mm.close();
        toast('Zwei-Faktor-Anmeldung aktiviert');
        showRecoveryCodes(r.recoveryCodes);
        done();
      } catch (ex) {
        err.show(ex.message);
        code.select();
      }
    } },
    h('p', {}, '1. Scanne den QR-Code mit deiner Authenticator-App.'), qr,
    h('details', {}, h('summary', {}, 'QR-Code lässt sich nicht scannen?'),
      h('p', { class: 'small' }, 'Gib diesen Schlüssel manuell ein (zeitbasiert, 6 Ziffern, 30 Sekunden):'),
      h('code', { class: 'secret' }, data.secret.replace(/(.{4})/g, '$1 ').trim()),
      h('p', { class: 'small' }, h('a', { href: data.otpauth }, 'Direkt in der App öffnen (auf dem Smartphone)'))),
    h('label', {}, '2. Code aus der App eingeben', code), err.box,
    h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => mm.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, 'Aktivieren')));
    const mm = modal('Zwei-Faktor-Anmeldung einrichten', f);
    setTimeout(() => code.focus(), 0);
  }

  try {
    await render();
  } catch (ex) {
    m.close();
    toast(ex.message);
  }
}

// Menüeinträge für das Benutzermenü
export function accountMenuItems(me, onSaved) {
  // Gäste haben kein Profil – nur Abmelden (Gastzugang beenden)
  if (me.guest) {
    return [
      { header: `${me.displayName} (Gast)` },
      { label: `Gastzugang gültig bis ${new Date(me.guestExpiresAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`, disabled: true },
      '-',
      { label: 'Gastzugang beenden', icon: 'close', onClick: logout },
    ];
  }
  return [
    { header: me.displayName + (me.email ? ` · ${me.email}` : '') },
    { label: 'Profil bearbeiten', icon: 'users', onClick: () => openProfileDialog(me, onSaved) },
    { label: 'Sicherheit & Geräte', icon: 'lock', onClick: () => openSecurityDialog(me, onSaved) },
    { label: 'Alle Boards', icon: 'home', onClick: () => (location.href = '/') },
    me.role === 'admin' ? { label: 'Administration', icon: 'settings', onClick: () => (location.href = '/admin') } : null,
    '-',
    { label: 'Abmelden', icon: 'close', onClick: logout },
  ].filter(Boolean);
}
