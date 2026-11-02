// Eigene Tooltips für Kopfzeile und Werkzeugleiste: Name und Kürzel, kurz verzögert, auch bei Tastaturfokus.
// Ein Knopf trägt sie als data-tip und data-key; Browser-title erscheint spät und nie für die Tastatur.
import { h } from './util.js';

const DELAY = 350, STAY = 500;
const box = h('div', { class: 'tooltip hidden', role: 'tooltip' });
let timer = null, shownFor = null, lastHide = 0, watch = null;

function hide() {
  clearTimeout(timer);
  if (shownFor) lastHide = Date.now();
  shownFor = null;
  clearInterval(watch);
  box.classList.add('hidden');
}

function show(el) {
  if (!el.isConnected) return;
  shownFor = el;
  box.replaceChildren(h('span', {}, el.dataset.tip), el.dataset.key ? h('kbd', {}, el.dataset.key) : null);
  if (!box.isConnected) document.body.append(box);
  box.classList.remove('hidden');
  const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  // Werkzeugleiste: rechts daneben, sonst darunter; am Fensterrand darüber
  const inTools = !!el.closest('#tools') && innerWidth > 760;
  let x = inTools ? r.right + 8 : r.left + r.width / 2 - b.width / 2;
  let y = inTools ? r.top + r.height / 2 - b.height / 2 : r.bottom + 8;
  if (y + b.height > innerHeight - 8) y = r.top - b.height - 8;
  box.style.left = Math.max(8, Math.min(innerWidth - b.width - 8, x)) + 'px';
  box.style.top = Math.max(8, y) + 'px';
  // Wird der Knopf ersetzt, meldet das kein Ereignis, er ist einfach weg
  clearInterval(watch);
  watch = setInterval(() => !el.isConnected && hide(), 250);
}

function schedule(el) {
  clearTimeout(timer);
  // Wer von Knopf zu Knopf fährt, wartet nicht jedes Mal
  timer = setTimeout(() => show(el), Date.now() - lastHide < STAY ? 0 : DELAY);
}

document.addEventListener('pointerover', (e) => {
  if (e.pointerType === 'touch') return;
  const el = e.target.closest?.('[data-tip]');
  if (el === shownFor) return;
  hide();
  if (el) schedule(el);
});
document.addEventListener('focusin', (e) => {
  const el = e.target.closest?.('[data-tip]');
  if (el && e.target.matches(':focus-visible')) schedule(el);
});
// Kein Ziel: Der Zeiger hat das Fenster verlassen
document.addEventListener('pointerout', (e) => !e.relatedTarget && hide());
addEventListener('blur', hide);
document.addEventListener('focusout', hide);
document.addEventListener('pointerdown', hide, true);
document.addEventListener('wheel', hide, { passive: true, capture: true });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hide();
}, true);
