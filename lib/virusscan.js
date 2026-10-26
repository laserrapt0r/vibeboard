'use strict';
// Virenprüfung hochgeladener Dateien über ClamAV (clamd, TCP, INSTREAM-Protokoll).
// Die Signaturen aktualisiert der ClamAV-Dienst selbst (freshclam).
const net = require('net');
const crypto = require('crypto');

const HOST = process.env.CLAMAV_HOST || '';
const PORT = Number(process.env.CLAMAV_PORT) || 3310;
const TIMEOUT = Number(process.env.CLAMAV_TIMEOUT) || 30000;
const CHUNK = 64 * 1024;

const configured = () => !!HOST;

// Ergebnisse sauberer Dateien merken (dieselben Bilder werden beim Verschieben erneut gesendet)
const cleanCache = new Map();
const CACHE_MAX = 5000;

function talk(write, { timeout = TIMEOUT } = {}) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: HOST, port: PORT });
    const chunks = [];
    let done = false;
    const finish = (err, val) => {
      if (done) return;
      done = true;
      sock.destroy();
      err ? reject(err) : resolve(val);
    };
    sock.setTimeout(timeout, () => finish(new Error('Zeitüberschreitung beim Virenscanner')));
    sock.on('error', (e) => finish(new Error('Virenscanner nicht erreichbar (' + e.code + ')')));
    sock.on('data', (d) => {
      chunks.push(d);
      const s = Buffer.concat(chunks).toString('utf8');
      if (s.includes('\0')) finish(null, s.slice(0, s.indexOf('\0')).trim());
    });
    sock.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim()));
    sock.on('connect', () => write(sock));
  });
}

async function command(cmd) {
  return talk((s) => s.write(`z${cmd}\0`), { timeout: 5000 });
}

// Prüft einen Puffer. Ergebnis: { clean: true } oder { clean: false, virus } – wirft bei technischen Fehlern.
async function scanBuffer(buf) {
  const key = crypto.createHash('sha256').update(buf).digest('hex');
  if (cleanCache.has(key)) return { clean: true, cached: true };
  const reply = await talk((s) => {
    s.write('zINSTREAM\0');
    for (let i = 0; i < buf.length; i += CHUNK) {
      const part = buf.subarray(i, i + CHUNK);
      const len = Buffer.alloc(4);
      len.writeUInt32BE(part.length);
      s.write(len);
      s.write(part);
    }
    s.write(Buffer.alloc(4)); // Länge 0 = Ende
  });
  if (/: OK$/.test(reply)) {
    cleanCache.set(key, true);
    if (cleanCache.size > CACHE_MAX) cleanCache.delete(cleanCache.keys().next().value);
    return { clean: true };
  }
  const m = /: (.+) FOUND$/.exec(reply);
  if (m) return { clean: false, virus: m[1] };
  throw new Error('Unerwartete Antwort des Virenscanners: ' + reply.slice(0, 120));
}

// Zustand für die Administration: erreichbar? Version und Datum der Signaturen
async function status() {
  if (!configured()) return { configured: false };
  try {
    const v = await command('VERSION'); // z. B. "ClamAV 1.4.1/27795/Mon Oct 26 08:21:03 2026"
    const [engine, db, date] = v.split('/');
    const dbDate = date ? new Date(date) : null;
    return {
      configured: true, reachable: true, engine, signatures: db || null,
      signaturesDate: dbDate && !isNaN(dbDate) ? dbDate.toISOString() : null,
      outdated: dbDate && !isNaN(dbDate) ? Date.now() - dbDate.getTime() > 3 * 86400000 : null,
    };
  } catch (e) {
    return { configured: true, reachable: false, error: e.message };
  }
}

/* ---------------- Datei-Typprüfung ---------------- */

const MAGIC = {
  png: (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47,
  jpeg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpg: (b) => MAGIC.jpeg(b),
  gif: (b) => b.length > 6 && /^GIF8[79]a/.test(b.subarray(0, 6).toString('latin1')),
  webp: (b) => b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  'svg+xml': (b) => /<svg[\s>]/i.test(b.subarray(0, 4096).toString('utf8')),
};

// Zerlegt eine Bild-Data-URL; prüft, ob der Inhalt zum angegebenen Typ passt
function decodeImageDataUrl(src) {
  const m = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(src || ''));
  if (!m) return { error: 'Ungültiges Bildformat' };
  const type = m[1].toLowerCase();
  const buf = Buffer.from(m[2], 'base64');
  if (!MAGIC[type] || !MAGIC[type](buf)) return { error: 'Der Dateiinhalt passt nicht zum angegebenen Bildtyp' };
  return { type, buf };
}

module.exports = { configured, scanBuffer, status, decodeImageDataUrl, HOST, PORT };
