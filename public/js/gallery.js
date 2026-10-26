// Vorlagen-Galerie (wird im Board und im Dashboard verwendet)
import { h } from './util.js';
import { renderSvgDocument } from './render.js';
import { TEMPLATES, CATEGORIES } from './templates.js';

const previewCache = new Map();

export function templatePreview(t) {
  if (!previewCache.has(t.id)) {
    const els = t.build();
    previewCache.set(t.id, els.length ? renderSvgDocument(els, { padding: 30, background: '#ffffff' }).svg : '<div class="tpl-blank">+</div>');
  }
  return previewCache.get(t.id);
}

export function templateGallery(onPick, { showBlank = true } = {}) {
  let cat = 'Alle', q = '';
  const grid = h('div', { class: 'tpl-grid' });
  const cats = h('div', { class: 'tpl-cats' });
  const search = h('input', { type: 'search', placeholder: 'Vorlagen durchsuchen …', class: 'tpl-search', oninput: (e) => { q = e.target.value.toLowerCase(); render(); } });
  const render = () => {
    cats.innerHTML = '';
    CATEGORIES.forEach((c) => cats.append(h('button', { class: 'tpl-cat' + (c === cat ? ' active' : ''), onclick: () => { cat = c; render(); } }, c)));
    grid.innerHTML = '';
    TEMPLATES.filter((t) => (showBlank || t.id !== 'blank') && (cat === 'Alle' || t.category === cat) && (!q || (t.name + ' ' + t.description).toLowerCase().includes(q))).forEach((t) => {
      const prev = h('div', { class: 'tpl-prev' });
      prev.innerHTML = templatePreview(t);
      grid.append(h('button', { class: 'tpl-card', onclick: () => onPick(t) }, prev,
        h('div', { class: 'tpl-info' }, h('div', { class: 'tpl-name' }, `${t.icon}  ${t.name}`), h('div', { class: 'tpl-desc' }, t.description))));
    });
  };
  render();
  return h('div', { class: 'tpl-wrap' }, h('div', { class: 'tpl-side' }, search, cats), grid);
}

