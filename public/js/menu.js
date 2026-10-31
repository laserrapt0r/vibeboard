// Popover und Menüs
import { h, ICONS } from './util.js';

let openPop = null;

export function closePop() {
  if (openPop) {
    const { el, anchor, onClose } = openPop;
    const hadFocus = el.contains(document.activeElement);
    el.remove();
    anchor.setAttribute?.('aria-expanded', 'false');
    onClose && onClose();
    openPop = null;
    if (hadFocus) anchor.focus?.();
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
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    closePop();
  });
  return el;
}

// Pfeiltasten, Pos1 und Ende bewegen den Fokus zwischen den Einträgen (Tastaturmuster für Menüs)
function menuKeys(list) {
  list.addEventListener('keydown', (e) => {
    const items = [...list.querySelectorAll('[role^=menuitem]:not([disabled])')];
    const i = items.indexOf(document.activeElement);
    const target = { ArrowDown: items[(i + 1) % items.length], ArrowUp: items[(i - 1 + items.length) % items.length], Home: items[0], End: items[items.length - 1] }[e.key];
    if (e.key === 'Tab') return closePop();
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    target.focus();
  });
}

// Auch Popups, in denen kein Eintrag den Fokus hat (Farbauswahl)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openPop) {
    e.stopPropagation();
    closePop();
  }
}, true);

document.addEventListener('pointerdown', (e) => {
  if (openPop && !openPop.el.contains(e.target) && !openPop.anchor.contains(e.target)) closePop();
}, true);

export function menu(anchor, items, opts) {
  const list = h('div', { class: 'menu', role: 'menu' }, items.filter(Boolean).map((it) => {
    if (it === '-') return h('div', { class: 'menu-sep', role: 'separator' });
    if (it.header) return h('div', { class: 'menu-header', role: 'presentation' }, it.header);
    return h('button', {
      role: it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem',
      'aria-checked': it.checked !== undefined ? String(!!it.checked) : null,
      class: 'menu-item' + (it.checked ? ' checked' : '') + (it.danger ? ' danger' : ''),
      disabled: it.disabled,
      onclick: () => {
        if (!it.keep) closePop();
        it.onClick && it.onClick();
      },
    }, h('span', { class: 'mi-icon', html: it.icon ? ICONS[it.icon] || it.icon : it.checked !== undefined ? (it.checked ? ICONS.check : '') : '' }),
    h('span', { class: 'mi-label' }, it.label), it.hint ? h('span', { class: 'mi-hint' }, it.hint) : null);
  }));
  const pop = popover(anchor, list, opts);
  menuKeys(list);
  anchor.setAttribute?.('aria-haspopup', 'menu');
  anchor.setAttribute?.('aria-expanded', 'true');
  list.querySelector('[role^=menuitem]:not([disabled])')?.focus({ preventScroll: true });
  return pop;
}

