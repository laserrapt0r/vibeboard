// Popover und Menüs
import { h, ICONS } from './util.js';

let openPop = null;

export function closePop() {
  if (openPop) {
    openPop.el.remove();
    openPop.onClose && openPop.onClose();
    openPop = null;
  }
}

export function popover(anchor, content, { placement = 'bottom', onClose, cls = '' } = {}) {
  closePop();
  const el = h('div', { class: 'popover panel ' + cls }, content);
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  const pr = el.getBoundingClientRect();
  let x, y;
  if (placement === 'right') {
    x = r.right + 8;
    y = r.top;
  } else if (placement === 'top') {
    x = r.left + r.width / 2 - pr.width / 2;
    y = r.top - pr.height - 8;
  } else if (placement === 'left') {
    x = r.left - pr.width - 8;
    y = r.top;
  } else {
    x = r.left + r.width / 2 - pr.width / 2;
    y = r.bottom + 8;
  }
  x = Math.max(8, Math.min(innerWidth - pr.width - 8, x));
  y = Math.max(8, Math.min(innerHeight - pr.height - 8, y));
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  openPop = { el, anchor, onClose };
  return el;
}

document.addEventListener('pointerdown', (e) => {
  if (openPop && !openPop.el.contains(e.target) && !openPop.anchor.contains(e.target)) closePop();
}, true);

export function menu(anchor, items, opts) {
  const list = h('div', { class: 'menu' }, items.filter(Boolean).map((it) => {
    if (it === '-') return h('div', { class: 'menu-sep' });
    if (it.header) return h('div', { class: 'menu-header' }, it.header);
    return h('button', {
      class: 'menu-item' + (it.checked ? ' checked' : '') + (it.danger ? ' danger' : ''),
      disabled: it.disabled,
      onclick: () => {
        if (!it.keep) closePop();
        it.onClick && it.onClick();
      },
    }, h('span', { class: 'mi-icon', html: it.icon ? ICONS[it.icon] || it.icon : it.checked !== undefined ? (it.checked ? ICONS.check : '') : '' }),
    h('span', { class: 'mi-label' }, it.label), it.hint ? h('span', { class: 'mi-hint' }, it.hint) : null);
  }));
  return popover(anchor, list, opts);
}

