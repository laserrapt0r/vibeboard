// Administration: eigene Formenpakete anlegen, aus SVG-Dateien oder ZIP-Archiven füllen, umbenennen und löschen
import { T } from './i18n.js';
import { h, api, toast, modal, confirmDialog } from './util.js';
import { readZip } from './zip.js';
import { planImport } from './shape-import.js';

const BATCH = 50;
const MAX_FILE = 512 * 1024; // Gleiche Grenze in lib/svg-clean.js

// Gründe des Servers (lib/svg-clean.js, lib/routes/shape-packs.js) in der Sprache der Oberfläche
const REASONS = {
  leer: T('Die Datei ist leer.'),
  'zu groß': T('Die Datei ist zu groß.'),
  'Entitäten sind nicht erlaubt': T('Die Datei enthält XML-Entitäten.'),
  'keine gültige SVG-Datei': T('Keine gültige SVG-Datei.'),
  'Größe fehlt (viewBox oder width/height)': T('Die Datei hat keine Größenangabe.'),
  'zu tief verschachtelt': T('Die Zeichnung ist zu tief verschachtelt.'),
  'zu viele Elemente': T('Die Zeichnung hat zu viele Elemente.'),
  'keine Zeichnung enthalten': T('Die Datei enthält nichts Darstellbares.'),
  'Zeichnung zu umfangreich': T('Die Zeichnung ist zu umfangreich.'),
  'Das Paket ist voll.': T('Das Paket ist voll.'),
};
const reason = (r) => REASONS[r] || r;

const kb = (n) => `${Math.max(1, Math.round(n / 1024)).toLocaleString()} KB`;

// Dateien einlesen: ein ZIP-Archiv oder beliebig viele SVG-Dateien. Gelesen wird erst beim Hochladen.
async function collect(files) {
  const list = [...files];
  if (list.length === 1 && /\.zip$/i.test(list[0].name)) {
    const zip = await readZip(await list[0].arrayBuffer(), { maxFiles: 50000 }).catch(() => {
      throw new Error(T('Das ZIP-Archiv konnte nicht gelesen werden.'));
    });
    return { plan: planImport(zip.names, list[0].name), read: (p) => zip.text(p) };
  }
  const byName = new Map(list.filter((f) => /\.svg$/i.test(f.name)).map((f) => [f.name, f]));
  return { plan: planImport([...byName.keys()], ''), read: (p) => byName.get(p).text(), sizes: new Map([...byName].map(([k, f]) => [k, f.size])) };
}

async function upload(packId, data, progress) {
  const { items } = data.plan;
  let added = 0;
  const rejected = [];
  for (let i = 0; i < items.length; i += BATCH) {
    const part = items.slice(i, i + BATCH);
    const icons = [];
    for (const it of part) {
      const svg = await data.read(it.path).catch(() => null);
      if (svg == null) rejected.push({ name: it.name, reason: T('Die Datei konnte nicht gelesen werden.') });
      else if (svg.length > MAX_FILE) rejected.push({ name: it.name, reason: 'zu groß' });
      else icons.push({ name: it.name, group: it.group, svg });
    }
    if (icons.length) {
      const res = await api(`/api/admin/shape-packs/${packId}/icons`, { method: 'POST', body: { icons } });
      added += res.added.length;
      rejected.push(...res.rejected);
    }
    progress(Math.min(items.length, i + BATCH), items.length);
  }
  return { added, rejected };
}

function resultDialog(added, rejected) {
  const lines = rejected.slice(0, 30).map((r) => h('li', {}, h('strong', {}, r.name), ': ', reason(r.reason)));
  modal(T('Import abgeschlossen'), h('div', { class: 'form' },
    h('p', {}, added === 1 ? T('1 Symbol wurde übernommen.') : T`${added} Symbole wurden übernommen.`),
    rejected.length ? h('p', {}, rejected.length === 1 ? T('1 Datei wurde abgelehnt:') : T`${rejected.length} Dateien wurden abgelehnt:`) : null,
    lines.length ? h('ul', { class: 'small' }, lines) : null,
    rejected.length > 30 ? h('p', { class: 'muted small' }, T`… und ${rejected.length - 30} weitere.`) : null));
}

// Import: erkennen, Namen und Herkunft bestätigen, hochladen. pack: vorhandenes Paket oder null für ein neues.
async function importFiles(files, pack, done) {
  let data;
  try {
    data = await collect(files);
  } catch (e) {
    return toast(e.message);
  }
  const { plan } = data;
  if (!plan.items.length) return toast(T('Keine SVG-Dateien gefunden.'));
  const groups = new Map();
  for (const it of plan.items) groups.set(it.group, (groups.get(it.group) || 0) + 1);
  const name = h('input', { type: 'text', maxlength: 80, required: true, value: pack ? pack.name : plan.name });
  const source = h('input', { type: 'text', maxlength: 300, value: pack ? pack.source : plan.source, placeholder: T('z. B. Hersteller, Name des Symbolsatzes, Lizenz') });
  const status = h('p', { class: 'muted small', role: 'status' });
  const go = h('button', { type: 'submit', class: 'btn primary' }, T('Importieren'));
  const vendor = { aws: 'AWS', azure: 'Azure', gcp: 'Google Cloud' }[plan.vendor];
  const summary = plan.items.length === 1 ? T('1 Symbol erkannt.') : T`${plan.items.length} Symbole erkannt.`;
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    go.disabled = true;
    try {
      let id = pack?.id;
      if (!id) id = (await api('/api/admin/shape-packs', { method: 'POST', body: { name: name.value, source: source.value } })).id;
      else if (name.value !== pack.name || source.value !== pack.source) await api('/api/admin/shape-packs/' + id, { method: 'PATCH', body: { name: name.value, source: source.value } });
      const res = await upload(id, data, (n, total) => (status.textContent = T`${n} von ${total} Dateien verarbeitet …`));
      m.close();
      resultDialog(res.added, res.rejected);
      done();
    } catch (ex) {
      status.textContent = ex.message;
      go.disabled = false;
    }
  } },
  h('p', {}, summary, ' ', vendor ? T`Aufbau erkannt: ${vendor}.` : '', ' ', plan.skipped ? T`${plan.skipped} andere Dateien werden übersprungen.` : ''),
  groups.size > 1 ? h('p', { class: 'muted small' }, [...groups].slice(0, 16).map(([g, n]) => `${g || T('Ohne Gruppe')} (${n})`).join(' · ') + (groups.size > 16 ? ' …' : '')) : null,
  h('label', {}, T('Name des Pakets'), name),
  h('label', {}, T('Herkunft und Lizenz'), source, h('span', { class: 'field-hint' }, T('Erscheint in der Formenverwaltung bei allen, die das Paket nutzen.'))),
  status,
  h('div', { class: 'form-actions' }, go));
  const m = modal(pack ? T('Symbole hinzufügen') : T('Formenpaket importieren'), form);
  name.focus();
  return undefined;
}

function pickFiles(onPick) {
  const input = h('input', { type: 'file', accept: '.zip,.svg,image/svg+xml,application/zip', multiple: true, hidden: true, onchange: () => {
    if (input.files.length) onPick(input.files);
    input.remove();
  } });
  document.body.append(input);
  input.click();
}

function editPack(p, done) {
  const name = h('input', { type: 'text', maxlength: 80, required: true, value: p.name });
  const source = h('input', { type: 'text', maxlength: 300, value: p.source });
  const err = h('p', { class: 'form-error', hidden: true });
  const m = modal(T('Formenpaket bearbeiten'), h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/shape-packs/' + p.id, { method: 'PATCH', body: { name: name.value, source: source.value } });
      m.close();
      done();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  } }, h('label', {}, T('Name des Pakets'), name), h('label', {}, T('Herkunft und Lizenz'), source), err, h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn primary' }, T('Speichern')))));
}

// Abschnitt für „Design & Vorlagen“
export async function customPacksSection() {
  const box = h('div', { class: 'custom-packs' });
  const render = async () => {
    const packs = await api('/api/shape-packs').catch((e) => {
      toast(e.message);
      return [];
    });
    const rows = packs.map((p) => h('tr', {},
      h('td', {}, h('strong', {}, p.name), p.source ? h('div', { class: 'muted small' }, p.source) : null),
      h('td', { class: 'muted' }, p.count === 1 ? T('1 Symbol') : T`${p.count} Symbole`, ' · ', kb(p.bytes)),
      h('td', { class: 'actions' },
        h('button', { class: 'btn small', type: 'button', onclick: () => pickFiles((f) => importFiles(f, p, render)) }, T('Symbole hinzufügen')),
        h('button', { class: 'btn small', type: 'button', onclick: () => editPack(p, render) }, T('Bearbeiten')),
        h('button', { class: 'btn small danger', type: 'button', onclick: async () => {
          if (!(await confirmDialog(T('Formenpaket löschen'), T`Das Paket „${p.name}“ wird gelöscht. Symbole daraus erscheinen auf Boards danach als Platzhalter.`, T('Löschen'), true))) return;
          await api('/api/admin/shape-packs/' + p.id, { method: 'DELETE' }).catch((ex) => toast(ex.message));
          render();
        } }, T('Löschen')))));
    box.replaceChildren(
      h('p', { class: 'muted' }, T('Lade SVG-Dateien oder ein ZIP-Archiv hoch, zum Beispiel die offiziellen Symbolpakete von AWS, Azure oder Google Cloud. vibeboard erkennt deren Aufbau, bereinigt jede Datei und legt daraus ein Paket für alle an. Für die Symbole gelten die Nutzungsbedingungen ihres Herstellers.')),
      packs.length ? h('table', { class: 'admin-table' }, h('tbody', {}, rows)) : h('p', { class: 'muted' }, T('Noch keine eigenen Formenpakete.')),
      h('div', { class: 'form-actions start' }, h('button', { class: 'btn primary', type: 'button', onclick: () => pickFiles((f) => importFiles(f, null, render)) }, T('Formenpaket importieren'))));
  };
  await render();
  return box;
}
