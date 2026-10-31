// Vorlagen-Galerie (wird im Board und im Dashboard verwendet)
import { T } from './i18n.js';
import { h, api, toast, confirmDialog, design } from './util.js';
import { renderSvgDocument } from './render.js';
import { TEMPLATES, CATEGORIES } from './templates.js';

const previewCache = new Map();
const hideBuiltin = () => !!design().hideBuiltin;
const OWN = 'Eigene Vorlagen';
const ORG = 'Unsere Vorlagen';

export function templatePreview(t, els) {
  if (!previewCache.has(t.id)) {
    const list = els || t.build();
    previewCache.set(t.id, list.length ? renderSvgDocument(list, { padding: 30, background: '#ffffff' }).svg : '<div class="tpl-blank">+</div>');
  }
  return previewCache.get(t.id);
}

// Eigene und Team-Vorlagen (vom Server) samt den zuletzt verwendeten; Elemente werden erst bei Bedarf geladen
export async function loadCustom() {
  try {
    const r = await api('/api/templates', { quiet: true });
    return {
      recent: r.recent,
      custom: r.templates.map((t) => ({
        id: 'u' + t.id, remoteId: t.id, name: t.name, icon: t.icon || '⭐', category: t.scope === 'org' ? ORG : OWN, custom: true, canDelete: t.canDelete,
        description: (t.description || (t.scope === 'org' ? T('Zentrale Vorlage') : t.scope === 'team' ? T`Team „${t.teamName}“` : T('Persönliche Vorlage'))) + (t.by ? T` · von ${t.by}` : ''),
      })),
    };
  } catch {
    return { recent: [], custom: [] };
  }
}

// Sortiert zuletzt verwendete Vorlagen nach vorn, der Rest behält seine Reihenfolge.
// „Leeres Board“ ist keine Vorlage im eigentlichen Sinn und bleibt daher immer an erster Stelle.
export function byRecent(list, recent) {
  const rank = (t) => (t.id === 'blank' ? -1 : recent.includes(t.id) ? recent.indexOf(t.id) : recent.length);
  return [...list].sort((a, b) => rank(a) - rank(b));
}

export function markTemplateUsed(t) {
  if (t.id === 'blank') return Promise.resolve();
  return api('/api/templates/used', { method: 'POST', body: { id: t.id }, quiet: true }).catch(() => {});
}

// Eigene Vorlagen erhalten ihr build() erst nach dem Laden der Elemente
export async function loadTemplate(t) {
  if (!t.custom) return t;
  const els = await elementsOf(t);
  return { ...t, build: () => els.map((e) => ({ ...e })) };
}

export function fillPreview(prev, t) {
  if (t.custom) {
    prev.innerHTML = previewCache.get(t.id) || `<div class="tpl-blank">${t.icon}</div>`;
    if (!previewCache.has(t.id)) elementsOf(t).then((els) => (prev.innerHTML = templatePreview(t, els))).catch(() => {});
  } else prev.innerHTML = templatePreview(t);
}

const customEls = new Map();
async function elementsOf(t) {
  if (!customEls.has(t.remoteId)) customEls.set(t.remoteId, (await api('/api/templates/' + t.remoteId)).elements);
  return customEls.get(t.remoteId);
}

// onPick erhält eine Vorlage mit build() – bei eigenen Vorlagen erst nach dem Laden der Elemente
export function templateGallery(onPick, { showBlank = true } = {}) {
  let cat = 'Alle', q = '';
  let custom = [], recent = [];
  const grid = h('div', { class: 'tpl-grid' });
  const cats = h('div', { class: 'tpl-cats' });
  const search = h('input', { type: 'search', placeholder: T('Vorlagen durchsuchen …'), class: 'tpl-search', oninput: (e) => { q = e.target.value.toLowerCase(); render(); } });
  const pick = async (t) => {
    try {
      onPick(await loadTemplate(t));
    } catch (e) {
      toast(e.message);
    }
  };
  const render = () => {
    cats.innerHTML = '';
    const count = (c) => custom.filter((t) => t.category === c).length;
    const special = [ORG, OWN].filter(count);
    const builtin = hideBuiltin() ? [] : CATEGORIES.slice(1);
    const list = [CATEGORIES[0], ...special, ...builtin];
    list.forEach((c) => cats.append(h('button', { class: 'tpl-cat' + (c === cat ? ' active' : ''), onclick: () => { cat = c; render(); } }, special.includes(c) ? `⭐ ${T(c)} (${count(c)})` : T(c))));
    grid.innerHTML = '';
    const all = byRecent([...custom, ...(hideBuiltin() ? TEMPLATES.filter((t) => t.id === 'blank') : TEMPLATES)], recent);
    all.filter((t) => (showBlank || t.id !== 'blank') && (cat === 'Alle' || t.category === cat) && (!q || (t.name + ' ' + t.description).toLowerCase().includes(q))).forEach((t) => {
      const prev = h('div', { class: 'tpl-prev' });
      fillPreview(prev, t);
      const del = t.custom && t.canDelete ? h('button', { class: 'tpl-del icon-btn small', title: T('Vorlage löschen'), 'aria-label': T`Vorlage „${t.name}“ löschen`, onclick: async (e) => {
        e.stopPropagation();
        if (!(await confirmDialog(T('Vorlage löschen'), T`Die Vorlage „${t.name}“ wird gelöscht. Boards, die daraus entstanden sind, bleiben erhalten.`, T('Löschen'), true))) return;
        try {
          await api('/api/templates/' + t.remoteId, { method: 'DELETE' });
          custom = custom.filter((x) => x !== t);
          if (![ORG, OWN].some((c) => c === cat && custom.some((x) => x.category === c)) && [ORG, OWN].includes(cat)) cat = 'Alle';
          render();
        } catch (ex) {
          toast(ex.message);
        }
      } }, '×') : null;
      grid.append(h('div', { class: 'tpl-card-wrap' }, h('button', { class: 'tpl-card', onclick: () => pick(t) }, prev,
        h('div', { class: 'tpl-info' }, h('div', { class: 'tpl-name' }, `${t.icon}  ${t.name}`), h('div', { class: 'tpl-desc' }, t.description), recent.includes(t.id) ? h('div', { class: 'tpl-recent' }, T('Zuletzt verwendet')) : null)), del));
    });
  };
  render();
  loadCustom().then((r) => {
    custom = r.custom;
    recent = r.recent;
    if (custom.length || recent.length) render();
  });
  return h('div', { class: 'tpl-wrap' }, h('div', { class: 'tpl-side' }, search, cats), grid);
}
