'use strict';
// Öffentliche Rechtstexte (Impressum, Datenschutzerklärung) – ohne Anmeldung abrufbar
const settings = require('../settings');
const { HttpError, json } = require('../http');

const KINDS = {
  impressum: { key: 'imprint', title: 'Impressum' },
  datenschutz: { key: 'privacy', title: 'Datenschutzerklärung' },
};

async function available() {
  const l = (await settings.get()).legal;
  return { imprint: !!l.imprint.trim(), privacy: !!l.privacy.trim() };
}

function register(r) {
  r.route('GET', '/api/legal', async (req, res) => {
    json(res, 200, await available());
  });

  r.route('GET', '/api/legal/:kind', async (req, res, { params }) => {
    const k = Object.hasOwn(KINDS, params.kind) ? KINDS[params.kind] : null;
    if (!k) throw new HttpError(404, 'Nicht gefunden');
    const s = await settings.get();
    json(res, 200, { title: k.title, text: s.legal[k.key], updatedAt: s.legal[k.key + 'UpdatedAt'] || null, siteName: s.general.siteName });
  });
}

module.exports = { register, available };
