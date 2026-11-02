// Popover und Menüs
import { T } from './i18n.js';
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
  } else if (placement === 'at') {
    x = r.left;
    y = r.top;
  } else if (!r.width && !r.height && !r.left && !r.top) {
    // Anker ist ausgeblendet (schmales Fenster, Aufruf aus der Befehlssuche)
    x = (innerWidth - pr.width) / 2;
    y = 72;
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
// own: Alle Tasten gehören dem Menü. Sonst wirkten sie auf die Auswahl dahinter (Entf, Pfeile, Werkzeugkürzel).
function menuKeys(list, own) {
  list.addEventListener('keydown', (e) => {
    const items = [...list.querySelectorAll('[role^=menuitem]:not([disabled])')];
    const i = items.indexOf(document.activeElement);
    // Untermenüs öffnen auch per Pfeil nach rechts, Zurück per Pfeil nach links
    const step = e.key === 'ArrowRight' && document.activeElement?.dataset.sub ? document.activeElement : e.key === 'ArrowLeft' ? list.querySelector('[data-back]') : null;
    if (step) {
      e.preventDefault();
      e.stopPropagation();
      return step.click();
    }
    const target = { ArrowDown: items[(i + 1) % items.length], ArrowUp: items[(i - 1 + items.length) % items.length], Home: items[0], End: items[items.length - 1] }[e.key];
    if (own) e.stopPropagation();
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

// Überschriften ohne Einträge und doppelte Trennlinien fallen weg: So bleibt keine Gruppe leer stehen
export function tidyMenu(items) {
  const list = items.filter(Boolean);
  const out = [];
  list.forEach((it, i) => {
    if (it.header) {
      const next = list.slice(i + 1).find((x) => x !== '-');
      if (!next || next.header) return;
    }
    if (it !== '-' || (out.length && out.at(-1) !== '-')) out.push(it);
  });
  while (out.at(-1) === '-') out.pop();
  return out;
}

// Ein Eintrag mit items öffnet ein Untermenü an derselben Stelle: Das bleibt auf dem Handy und mit der Tastatur bedienbar.
// items darf eine Funktion sein, dann entsteht der Inhalt erst beim Öffnen.
export function menu(anchor, items, opts) {
  const back = opts?.back;
  const shown = tidyMenu(items);
  const list = h('div', { class: 'menu', role: 'menu' }, [
    back ? h('button', { role: 'menuitem', class: 'menu-item menu-back', 'data-back': '1', onclick: () => {
      closePop();
      back();
    } }, h('span', { class: 'mi-icon', html: ICONS.chevLeft }), h('span', { class: 'mi-label' }, T('Zurück'))) : null,
    ...shown.map((it) => {
    if (it === '-') return h('div', { class: 'menu-sep', role: 'separator' });
    if (it.header) return h('div', { class: 'menu-header', role: 'presentation' }, it.header);
    return h('button', {
      'data-sub': it.items ? '1' : null,
      'aria-haspopup': it.items ? 'menu' : null,
      role: it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem',
      'aria-checked': it.checked !== undefined ? String(!!it.checked) : null,
      class: 'menu-item' + (it.checked ? ' checked' : '') + (it.danger ? ' danger' : ''),
      disabled: it.disabled,
      onclick: () => {
        if (it.items) {
          const sub = typeof it.items === 'function' ? it.items() : it.items;
          closePop();
          return menu(anchor, sub, { ...opts, back: () => menu(anchor, items, opts) });
        }
        if (!it.keep) closePop();
        it.onClick && it.onClick();
      },
    }, h('span', { class: 'mi-icon', html: it.icon ? ICONS[it.icon] || it.icon : it.checked !== undefined ? (it.checked ? ICONS.check : '') : '' }),
    h('span', { class: 'mi-label' }, it.label), it.hint ? h('span', { class: 'mi-hint' }, it.hint) : null,
    it.items ? h('span', { class: 'mi-sub', html: ICONS.chevRight }) : null);
    }),
  ]);
  const pop = popover(anchor, list, opts);
  menuKeys(list, opts?.placement === 'at');
  anchor.setAttribute?.('aria-haspopup', 'menu');
  anchor.setAttribute?.('aria-expanded', 'true');
  list.querySelector('[role^=menuitem]:not([disabled])')?.focus({ preventScroll: true });
  return pop;
}

// Dasselbe Menü an einer Stelle des Bildschirms, etwa als Kontextmenü an der Maus
export function menuAt(x, y, items, cls = '') {
  const anchor = { getBoundingClientRect: () => ({ left: x, right: x, top: y, bottom: y, width: 0, height: 0 }), contains: () => false };
  return menu(anchor, items, { placement: 'at', cls });
}

