'use strict';
// Kennwortrichtlinie nach NIST SP 800-63B / BSI: Mindestlänge, keine bekannten oder kompromittierten
// Kennwörter, kein Bezug zu Benutzername/E-Mail – aber keine erzwungenen Zeichenklassen.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { HttpError } = require('./http');

const MAX_LENGTH = 256;

const COMMON = new Set(
  fs.readFileSync(path.join(__dirname, 'data', 'common-passwords.txt'), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.trim().toLowerCase()),
);

// Häufige deutsche Grundwörter, die mit angehängten Ziffern/Zeichen gern als Kennwort dienen
const LOCAL_WORDS = new Set(`passwort kennwort password passw0rt geheim geheimnis sicher sicherheit hallo hallihallo willkommen
  schatz schatzi liebe ichliebedich liebling mausi maus hase hasi baerchen bärchen engel prinzessin schnecke spatz
  fussball fußball bayern fcbayern schalke dortmund borussia werder hertha deutschland berlin hamburg muenchen münchen
  koeln köln sommer winter fruehling frühling herbst sonne sonnenschein mond sterne blume hund katze pferd
  admin administrator root benutzer computer internet test testtest gott jesus freiheit zuhause familie
  qwertz qwertzu asdfgh yxcvbn vibeboard whiteboard board`.split(/\s+/).filter(Boolean));

// Einfache Muster: nur ein Zeichen, auf- oder absteigende Folgen, Tastaturreihen
const KEYBOARD_ROWS = ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnm', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'abcdefghijklmnopqrstuvwxyz'];
const ROWS = KEYBOARD_ROWS.flatMap((r) => [r, [...r].reverse().join('')]);

// Länge des längsten Teilstücks, das einer Tastaturreihe oder Zeichenfolge entspricht
function longestRun(p) {
  let best = 0;
  for (let i = 0; i < p.length; i++) {
    for (let j = p.length; j > i + best; j--) {
      const part = p.slice(i, j);
      if (ROWS.some((r) => r.includes(part))) {
        best = j - i;
        break;
      }
    }
  }
  return best;
}

function isTrivial(pw) {
  const p = pw.toLowerCase();
  if (new Set(p).size <= 3) return true;
  // überwiegend Tastaturreihe/Folge, z. B. „qwertzuiopas“, „1234567890ab“
  if (longestRun(p) >= Math.max(6, p.length * 0.6)) return true;
  // bekanntes Grundwort plus Ziffern/Sonderzeichen, z. B. „Passwort1234!“
  const core = p.replace(/^[^a-zäöüß]+|[^a-zäöüß]+$/g, '');
  if (core.length >= 3 && (COMMON.has(core) || LOCAL_WORDS.has(core)) && p.length - core.length <= 8) return true;
  // gleiche Sequenz mehrfach wiederholt, z. B. "abcabcabcabc"
  for (let n = 1; n <= p.length / 2; n++) {
    if (p.length % n === 0 && p.slice(0, n).repeat(p.length / n) === p) return true;
  }
  return false;
}

// Optional: Abgleich mit der „Have I Been Pwned“-Datenbank per k-Anonymität.
// Es werden nur die ersten 5 Zeichen des SHA-1-Hashs übertragen, nie das Kennwort.
async function pwnedCount(pw) {
  const hash = crypto.createHash('sha1').update(pw).digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5), suffix = hash.slice(5);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true' }, signal: ctrl.signal });
    if (!r.ok) return 0;
    for (const line of (await r.text()).split('\n')) {
      const [suf, count] = line.trim().split(':');
      if (suf === suffix) return Number(count) || 0;
    }
    return 0;
  } catch (e) {
    console.warn('Kennwort-Abgleich (HIBP) nicht möglich:', e.message);
    return 0; // Dienst nicht erreichbar → nicht blockieren
  } finally {
    clearTimeout(t);
  }
}

// Prüft ein Kennwort und wirft bei Verstoß einen verständlichen Fehler
async function checkPassword(pw, { minLength = 12, username = '', email = '', hibp = false } = {}) {
  pw = String(pw || '');
  if ([...pw].length < minLength) throw new HttpError(400, `Das Kennwort muss mindestens ${minLength} Zeichen lang sein.`);
  if (pw.length > MAX_LENGTH) throw new HttpError(400, `Das Kennwort darf höchstens ${MAX_LENGTH} Zeichen lang sein.`);
  const lower = pw.toLowerCase();
  if (COMMON.has(lower) || isTrivial(pw)) throw new HttpError(400, 'Dieses Kennwort ist zu leicht zu erraten. Bitte wähle ein anderes.');
  const parts = [username, String(email).split('@')[0]].map((s) => String(s || '').toLowerCase()).filter((s) => s.length >= 4);
  if (parts.some((s) => lower.includes(s))) throw new HttpError(400, 'Das Kennwort darf weder den Benutzernamen noch die E-Mail-Adresse enthalten.');
  if (hibp) {
    const n = await pwnedCount(pw);
    if (n > 0) throw new HttpError(400, `Dieses Kennwort ist in ${n.toLocaleString('de-DE')} bekannten Datenlecks aufgetaucht. Bitte wähle ein anderes.`);
  }
  return pw;
}

module.exports = { checkPassword, MAX_LENGTH };
