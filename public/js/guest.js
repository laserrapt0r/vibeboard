// Beitritt per Gastlink: Name angeben, Datenschutzhinweis bestätigen, Board öffnen
import { h, api, loadPref } from './util.js';
import { legalFooter, legalLinks } from './footer.js';

const card = document.getElementById('guest');
const token = location.pathname.split('/').pop();
const ROLE = { viewer: 'ansehen', commenter: 'ansehen und kommentieren' };
if (loadPref('settings', {}).dark) document.body.classList.add('dark');

function brand() {
  return h('div', { class: 'auth-brand', html: '<svg viewBox="0 0 32 32" width="34" height="34"><rect x="2" y="2" width="28" height="28" rx="7" fill="#4262ff"/><rect x="8" y="8" width="9" height="9" rx="1.5" fill="#fff9b1"/><rect x="15" y="15" width="9" height="9" rx="1.5" fill="#ffcee0"/></svg><span>vibeboard</span>' });
}

async function main() {
  let info;
  try {
    info = await api('/api/guest/' + encodeURIComponent(token));
  } catch (e) {
    info = { valid: false, error: e.message };
  }
  card.innerHTML = '';
  card.append(brand());
  if (!info.valid) {
    card.append(h('h1', {}, 'Link nicht gültig'), h('p', { class: 'muted' }, info.error || 'Dieser Gastlink ist abgelaufen, wurde gesperrt oder der Gastzugang ist abgeschaltet. Bitte frage die Person, die dir den Link geschickt hat, nach einem neuen.'));
    return;
  }
  if (info.signedIn) {
    card.append(h('h1', {}, info.boardName), h('p', { class: 'muted' }, 'Du bist bereits mit einem Konto angemeldet. Gastlinks sind für Personen ohne Konto gedacht – bitte die Besitzerin oder den Besitzer, dich direkt einzuladen.'),
      h('a', { class: 'btn primary', href: '/' }, 'Zur Übersicht'));
    return;
  }
  const legal = await legalLinks();
  const name = h('input', { type: 'text', required: true, minlength: 2, maxlength: 40, autocomplete: 'name', placeholder: 'z. B. Alex Beispiel' });
  const consent = h('input', { type: 'checkbox', required: true });
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  const until = new Date(info.expiresAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  card.append(
    h('h1', {}, info.boardName),
    h('p', { class: 'muted' }, `Du wurdest eingeladen, dieses Board als Gast zu ${ROLE[info.role] || 'ansehen'}. Der Zugang gilt bis ${until}.`),
    h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      err.classList.add('hidden');
      try {
        const r = await api('/api/guest/join', { method: 'POST', body: { token, name: name.value, consent: consent.checked } });
        location.href = '/board/' + r.boardId;
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('hidden');
      }
    } },
    h('label', {}, 'Dein Name (für die anderen sichtbar)', name),
    h('label', { class: 'check' }, consent, h('span', {}, 'Ich habe zur Kenntnis genommen, dass mein Name, meine Beiträge und technisch nötige Daten (Sitzung, Zugriffszeit) gespeichert werden.',
      legal.privacy ? [' ', h('a', { href: '/datenschutz', target: '_blank', rel: 'noopener' }, 'Datenschutzerklärung')] : null)),
    err,
    h('button', { type: 'submit', class: 'btn primary' }, 'Als Gast beitreten')));
  card.append(await legalFooter({ newTab: true }));
  name.focus();
}

main();
