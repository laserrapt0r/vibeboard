// Kennwort-Stärkeanzeige (nur zur Orientierung – die verbindliche Prüfung macht der Server)
import { T } from './i18n.js';
import { h } from './util.js';

const WEAK_PARTS = ['passwort', 'password', 'kennwort', 'qwert', 'asdf', 'yxcv', '1234', 'abcd', 'hallo', 'admin', 'vibeboard'];

export function scorePassword(pw, minLength = 12) {
  if (!pw) return { score: 0, label: '' };
  const len = [...pw].length;
  let pool = 0;
  if (/[a-zäöüß]/.test(pw)) pool += 26;
  if (/[A-ZÄÖÜ]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^A-Za-zÄÖÜäöüß0-9]/.test(pw)) pool += 20;
  // grobe Entropie-Schätzung, abgewertet bei Wiederholungen und bekannten Mustern
  let bits = len * Math.log2(Math.max(pool, 1));
  const unique = new Set(pw.toLowerCase()).size;
  if (unique < len / 2) bits *= 0.6;
  if (WEAK_PARTS.some((w) => pw.toLowerCase().includes(w))) bits *= 0.5;
  if (len < minLength) return { score: 1, label: T`Zu kurz – mindestens ${minLength} Zeichen` };
  if (bits < 50) return { score: 1, label: T('Schwach') };
  if (bits < 65) return { score: 2, label: T('Mittel') };
  if (bits < 85) return { score: 3, label: T('Gut') };
  return { score: 4, label: T('Sehr gut') };
}

// Liefert ein Element mit Balken und Text, das sich an ein Eingabefeld hängt
export function passwordMeter(input, minLength = 12) {
  const bar = h('div', { class: 'pw-bar' }, h('span'));
  const text = h('span', { class: 'pw-text' });
  const el = h('div', { class: 'pw-meter', 'aria-live': 'polite' }, bar, text,
    h('div', { class: 'field-hint' }, T`Mindestens ${minLength} Zeichen. Am sichersten ist ein langer Satz aus mehreren Wörtern, z. B. „Rotkehlchen tanzen im Nebel“.`));
  const update = () => {
    const { score, label } = scorePassword(input.value, minLength);
    el.dataset.score = score;
    text.textContent = label;
  };
  input.addEventListener('input', update);
  update();
  return el;
}
