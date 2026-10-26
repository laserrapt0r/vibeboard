'use strict';
// HTTP-Hilfsfunktionen
const fs = require('fs');
const path = require('path');

const MAX_BODY = 40 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readBody(req, limit = MAX_BODY) {
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
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const txt = await readBody(req);
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    throw new HttpError(400, 'Ungültiges JSON');
  }
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
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isHttps(req) {
  return !!req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function clientIp(req) {
  // Hinter einem Reverse-Proxy steht die echte Adresse in X-Forwarded-For
  const fwd = process.env.TRUST_PROXY === '1' ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
  return fwd || req.socket.remoteAddress || '';
}

function requestOrigin(req) {
  const proto = isHttps(req) ? 'https' : 'http';
  return `${proto}://${req.headers.host}`;
}

module.exports = { HttpError, readBody, readJson, json, redirect, serveFile, serveStatic, parseCookies, isHttps, clientIp, requestOrigin, MIME };
