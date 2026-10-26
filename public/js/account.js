// Konto-Dialoge (Profil, Kennwort) und Benutzermenü – genutzt von Übersicht und Board
import { h, api, modal, toast, initials, USER_COLORS, logout } from './util.js';

function colorPicker(current, onPick) {
  let color = current;
  const sw = h('div', { class: 'swatches' }, USER_COLORS.map((c) => h('button', {
    type: 'button', class: 'swatch' + (c === color ? ' active' : ''), style: { background: c }, title: c,
    onclick: () => {
      color = c;
      onPick(c);
      sw.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s.title === c));
    },
  })));
  return sw;
}

function errorBox() {
  const box = h('div', { class: 'form-error hidden' });
  return {
    box,
    show(msg) {
      box.textContent = msg;
      box.classList.remove('hidden');
    },
    hide: () => box.classList.add('hidden'),
  };
}

export function openProfileDialog(me, onSaved) {
  let color = me.color;
  const err = errorBox();
  const display = h('input', { type: 'text', value: me.displayName || '', maxlength: 60, placeholder: me.username });
  const email = h('input', { type: 'email', value: me.email || '', placeholder: 'name@beispiel.de' });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    err.hide();
    try {
      const { user } = await api('/api/auth/me', { method: 'PATCH', body: { displayName: display.value, email: email.value, color } });
      m.close();
      toast('Profil gespeichert');
      onSaved && onSaved(user);
    } catch (ex) {
      err.show(ex.message);
    }
  } },
  h('div', { class: 'profile-head' }, h('span', { class: 'avatar lg', style: { background: me.color } }, initials(me.displayName)),
    h('div', {}, h('b', {}, me.username), h('div', { class: 'muted small' }, me.role === 'admin' ? 'Administrator' : 'Benutzer'))),
  h('label', {}, 'Anzeigename', display),
  h('label', {}, 'E-Mail-Adresse', email, h('span', { class: 'field-hint' }, 'Für Einladungen und „Kennwort vergessen“.')),
  h('div', {}, h('div', { class: 'label' }, 'Farbe (Cursor & Avatar)'), colorPicker(color, (c) => (color = c))),
  err.box,
  h('div', { class: 'form-actions' },
    h('button', { type: 'button', class: 'btn', onclick: () => { m.close(); openPasswordDialog(); } }, 'Kennwort ändern'),
    h('span', { class: 'spacer' }),
    h('button', { type: 'submit', class: 'btn primary' }, 'Speichern')));
  const m = modal('Profil', form);
}

export function openPasswordDialog() {
  const err = errorBox();
  const cur = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const pw = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: 8 });
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
  h('label', {}, 'Aktuelles Kennwort', cur),
  h('label', {}, 'Neues Kennwort', pw, h('span', { class: 'field-hint' }, 'Mindestens 8 Zeichen.')),
  h('label', {}, 'Neues Kennwort wiederholen', pw2),
  err.box,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, 'Kennwort ändern')));
  const m = modal('Kennwort ändern', form);
  setTimeout(() => cur.focus(), 0);
}

// Menüeinträge für das Benutzermenü
export function accountMenuItems(me, onSaved) {
  return [
    { header: me.displayName + (me.displayName !== me.username ? ` (@${me.username})` : '') },
    { label: 'Profil bearbeiten', icon: 'users', onClick: () => openProfileDialog(me, onSaved) },
    { label: 'Kennwort ändern', icon: 'lock', onClick: openPasswordDialog },
    { label: 'Alle Boards', icon: 'home', onClick: () => (location.href = '/') },
    me.role === 'admin' ? { label: 'Administration', icon: 'settings', onClick: () => (location.href = '/admin') } : null,
    '-',
    { label: 'Abmelden', icon: 'close', onClick: logout },
  ].filter(Boolean);
}
