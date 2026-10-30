'use strict';
// HTTP-Hilfsfunktionen
const fs = require('fs');
const path = require('path');

const MAX_BODY = 40 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    if (code) this.code = code; // maschinenlesbarer Grund, z. B. 'unverified'
  }
}

function readBody(req, limit = MAX_BODY) {
  return readRaw(req, limit).then((b) => b.toString('utf8'));
}

// Rohdaten (z. B. hochgeladene Dateien)
function readRaw(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'Anfrage zu groß'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const txt = await readBody(req);
  if (!txt) return {};
  let v;
  try {
    v = JSON.parse(txt);
  } catch {
    throw new HttpError(400, 'Ungültiges JSON');
  }
  // Routen greifen direkt auf Felder zu – null, Zahlen und Texte sind kein gültiger Inhalt
  if (!v || typeof v !== 'object') throw new HttpError(400, 'Ungültiges JSON');
  return v;
}

function json(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

function serveFile(res, file, extraHeaders = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Nicht gefunden');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
      ...extraHeaders,
    });
    fs.createReadStream(file).pipe(res);
  });
}

function serveStatic(res, root, urlPath) {
  let rel;
  try {
    rel = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  } catch {
    throw new HttpError(400, 'Ungültiger Pfad');
  }
  const file = path.join(root, rel);
  if (!file.startsWith(root + path.sep)) throw new HttpError(403, 'Verboten');
  serveFile(res, file);
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v; // fremde Cookies mit ungültiger Kodierung nicht zum Fehler werden lassen
    }
  }
  return out;
}

/*
 * Reverse-Proxy (TRUST_PROXY):
 *   leer/0      – Kopfzeilen X-Forwarded-* werden ignoriert (Standard)
 *   1 / true    – genau ein Proxy direkt davor (z. B. Caddy, nginx, Traefik)
 *   2, 3 …      – so viele Proxys hintereinander
 *   Liste       – Adressen bzw. Netze der vertrauenswürdigen Proxys, z. B. „127.0.0.1, 172.16.0.0/12, ::1“
 * X-Forwarded-For wird von rechts gelesen: Jeder Proxy hängt die Adresse an, von der er die Anfrage bekam. Den linken
 * Teil kann der Aufrufer selbst setzen – er ist daher nie vertrauenswürdig.
 */
const net = require('net');

const normIp = (ip) => String(ip || '').trim().replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, '$1');

function parseTrust(v) {
  v = String(v || '').trim().toLowerCase();
  if (!v || v === '0' || v === 'false') return { hops: 0 };
  if (v === 'true') return { hops: 1 };
  if (/^\d+$/.test(v)) return { hops: Number(v) };
  const list = new net.BlockList();
  for (const part of v.split(/[\s,;]+/).filter(Boolean)) {
    const [addr, bits] = part.split('/');
    const type = net.isIPv6(addr) ? 'ipv6' : net.isIPv4(addr) ? 'ipv4' : null;
    const max = type === 'ipv6' ? 128 : 32;
    // Ungültige Einträge überspringen statt beim Start abzustürzen
    if (!type || (bits !== undefined && !(/^\d+$/.test(bits) && Number(bits) <= max))) {
      require('./log').child('http').warn('Ungültiger Eintrag in TRUST_PROXY wird ignoriert', { entry: part });
      continue;
    }
    if (bits !== undefined) list.addSubnet(addr, Number(bits), type);
    else list.addAddress(addr, type);
  }
  return { list };
}

let trust = parseTrust(process.env.TRUST_PROXY);
const trusted = (ip) => {
  if (!trust.list) return false;
  const a = normIp(ip);
  return net.isIP(a) ? trust.list.check(a, net.isIPv6(a) ? 'ipv6' : 'ipv4') : false;
};
// Kommt die Anfrage direkt von einem vertrauenswürdigen Proxy?
const fromProxy = (req) => (trust.list ? trusted(req.socket.remoteAddress) : trust.hops > 0);

function isHttps(req) {
  if (req.socket.encrypted) return true;
  return fromProxy(req) && String(req.headers['x-forwarded-proto'] || '').split(',').pop().trim() === 'https';
}

function clientIp(req) {
  const peer = normIp(req.socket.remoteAddress);
  if (!fromProxy(req)) return peer;
  const chain = String(req.headers['x-forwarded-for'] || '').split(',').map(normIp).filter(Boolean);
  if (!chain.length) return peer;
  if (trust.list) {
    // Von rechts alle vertrauenswürdigen Proxys überspringen; die erste fremde Adresse ist der Client
    for (let i = chain.length - 1; i >= 0; i--) if (!trusted(chain[i])) return chain[i];
    return chain[0];
  }
  // Feste Anzahl Proxys: der n-te Eintrag von rechts
  return chain[Math.max(0, chain.length - trust.hops)];
}

// Für Tests und die Administration
const trustInfo = () => (trust.list ? 'Liste' : String(trust.hops));
const setTrust = (v) => (trust = parseTrust(v));

function requestOrigin(req) {
  const proto = isHttps(req) ? 'https' : 'http';
  return `${proto}://${req.headers.host}`;
}

module.exports = { HttpError, readBody, readRaw, readJson, json, redirect, serveFile, serveStatic, parseCookies, isHttps, clientIp, requestOrigin, trustInfo, setTrust, MIME };
