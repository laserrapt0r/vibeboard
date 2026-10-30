// Vorlagen-Galerie (wird im Board und im Dashboard verwendet)
import { T } from './i18n.js';
import { h, api, toast, confirmDialog } from './util.js';
import { renderSvgDocument } from './render.js';
import { TEMPLATES, CATEGORIES } from './templates.js';

const previewCache = new Map();
const OWN = 'Eigene Vorlagen';

export function templatePreview(t, els) {
  if (!previewCache.has(t.id)) {
    const list = els || t.build();
    previewCache.set(t.id, list.length ? renderSvgDocument(list, { padding: 30, background: '#ffffff' }).svg : '<div class="tpl-blank">+</div>');
  }
  return previewCache.get(t.id);
}

// Eigene und Team-Vorlagen (vom Server); Elemente werden erst bei Bedarf geladen
async function loadCustom() {
  try {
    return (await api('/api/templates', { quiet: true })).templates.map((t) => ({
      id: 'u' + t.id, remoteId: t.id, name: t.name, icon: t.icon || '⭐', category: OWN, custom: true, canDelete: t.canDelete,
      description: (t.description || (t.scope === 'team' ? T`Team „${t.teamName}“` : T('Persönliche Vorlage'))) + (t.by ? T` · von ${t.by}` : ''),
    }));
  } catch {
    return [];
  }
}

const customEls = new Map();
async function elementsOf(t) {
  if (!customEls.has(t.remoteId)) customEls.set(t.remoteId, (await api('/api/templates/' + t.remoteId)).elements);
  return customEls.get(t.remoteId);
}

// onPick erhält eine Vorlage mit build() – bei eigenen Vorlagen erst nach dem Laden der Elemente
export function templateGallery(onPick, { showBlank = true } = {}) {
  let cat = 'Alle', q = '';
  let custom = [];
  const grid = h('div', { class: 'tpl-grid' });
  const cats = h('div', { class: 'tpl-cats' });
  const search = h('input', { type: 'search', placeholder: T('Vorlagen durchsuchen …'), class: 'tpl-search', oninput: (e) => { q = e.target.value.toLowerCase(); render(); } });
  const pick = async (t) => {
    if (!t.custom) return onPick(t);
    try {
      const els = await elementsOf(t);
      onPick({ ...t, build: () => els.map((e) => ({ ...e })) });
    } catch (e) {
      toast(e.message);
    }
  };
  const render = () => {
    cats.innerHTML = '';
    const list = custom.length ? [CATEGORIES[0], OWN, ...CATEGORIES.slice(1)] : CATEGORIES;
    list.forEach((c) => cats.append(h('button', { class: 'tpl-cat' + (c === cat ? ' active' : ''), onclick: () => { cat = c; render(); } }, c === OWN ? `⭐ ${T(c)} (${custom.length})` : T(c))));
    grid.innerHTML = '';
    const all = [...custom, ...TEMPLATES];
    all.filter((t) => (showBlank || t.id !== 'blank') && (cat === 'Alle' || t.category === cat) && (!q || (t.name + ' ' + t.description).toLowerCase().includes(q))).forEach((t) => {
      const prev = h('div', { class: 'tpl-prev' });
      if (t.custom) {
        prev.innerHTML = previewCache.get(t.id) || `<div class="tpl-blank">${t.icon}</div>`;
        if (!previewCache.has(t.id)) elementsOf(t).then((els) => (prev.innerHTML = templatePreview(t, els))).catch(() => {});
      } else prev.innerHTML = templatePreview(t);
      const del = t.custom && t.canDelete ? h('button', { class: 'tpl-del icon-btn small', title: T('Vorlage löschen'), 'aria-label': T`Vorlage „${t.name}“ löschen`, onclick: async (e) => {
        e.stopPropagation();
        if (!(await confirmDialog(T('Vorlage löschen'), T`Die Vorlage „${t.name}“ wird gelöscht. Boards, die daraus entstanden sind, bleiben erhalten.`, T('Löschen'), true))) return;
        try {
          await api('/api/templates/' + t.remoteId, { method: 'DELETE' });
          custom = custom.filter((x) => x !== t);
          if (!custom.length && cat === OWN) cat = 'Alle';
          render();
        } catch (ex) {
          toast(ex.message);
        }
      } }, '×') : null;
      grid.append(h('div', { class: 'tpl-card-wrap' }, h('button', { class: 'tpl-card', onclick: () => pick(t) }, prev,
        h('div', { class: 'tpl-info' }, h('div', { class: 'tpl-name' }, `${t.icon}  ${t.name}`), h('div', { class: 'tpl-desc' }, t.description))), del));
    });
  };
  render();
  loadCustom().then((list) => {
    custom = list;
    if (list.length) render();
  });
  return h('div', { class: 'tpl-wrap' }, h('div', { class: 'tpl-side' }, search, cats), grid);
}
