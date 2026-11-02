// Leisten auf dem Handy: Banner lassen sich einklappen und stapeln sich, statt sich zu überdecken. Meldungen stehen über
// --stack-top unter den oberen Bannern. Am Rechner bleibt alles, wie es das Stylesheet vorgibt.
import { T } from './i18n.js';
import { h } from './util.js';

const phone = matchMedia('(max-width: 760px)');
const GAP = 6;
const TOP = ['#timer-widget', '#moderation-banner', '#private-banner'];
const BOTTOM = ['#retro-bar', '#voting-banner', '#filter-banner'];
const ABOVE_BARS = ['#bottom-left', '#bottom-right'];
const chosen = new Map(); // Entscheidung dieser Sitzung je Banner, sonst der Standard
const watched = new WeakSet();

const shown = (el) => el && el.getClientRects().length > 0;

function stack() {
  const root = document.documentElement.style;
  const all = [...TOP, ...BOTTOM, ...ABOVE_BARS].map((s) => document.querySelector(s)).filter(Boolean);
  if (!phone.matches) {
    all.forEach((el) => {
      el.style.top = '';
      el.style.bottom = '';
    });
    root.removeProperty('--stack-top');
    return;
  }
  let top = (document.querySelector('#topright')?.getBoundingClientRect().bottom || 112) + GAP;
  for (const el of TOP.map((s) => document.querySelector(s))) {
    if (!shown(el)) continue;
    el.style.top = top + 'px';
    top += el.offsetHeight + GAP;
  }
  root.setProperty('--stack-top', top + 'px');
  const tools = document.querySelector('#tools');
  const base = shown(tools) ? innerHeight - tools.getBoundingClientRect().top + GAP : 12;
  let bottom = base;
  for (const el of BOTTOM.map((s) => document.querySelector(s))) {
    if (!shown(el)) continue;
    el.style.bottom = bottom + 'px';
    bottom += el.offsetHeight + GAP;
  }
  // Rückgängig und Hilfe rutschen mit nach oben, sonst lägen sie hinter den Leisten
  for (const el of ABOVE_BARS.map((s) => document.querySelector(s))) if (el) el.style.bottom = bottom > base ? bottom + 'px' : '';
}

const observer = new ResizeObserver(stack);

function watch(el) {
  if (el && !watched.has(el)) {
    watched.add(el);
    observer.observe(el);
  }
}

/**
 * Knopf zum Ein- und Ausklappen, nach jedem Neuaufbau des Banners aufzurufen. Eingeklappt verschwindet, was .banner-detail trägt.
 * Wer nur teilnimmt, sieht das Banner zunächst eingeklappt.
 */
export function foldable(banner, key, folded, host = banner) {
  const fold = chosen.get(key) ?? folded;
  const label = (f) => (f ? T('Mehr anzeigen') : T('Weniger anzeigen'));
  const set = (f) => {
    banner.classList.toggle('banner-folded', f);
    button.setAttribute('aria-expanded', String(!f));
    button.title = label(f);
    button.setAttribute('aria-label', label(f));
    button.textContent = f ? '▾' : '▴';
  };
  const button = h('button', { type: 'button', class: 'icon-btn small banner-fold', onclick: () => {
    const f = !banner.classList.contains('banner-folded');
    chosen.set(key, f);
    set(f);
  } });
  set(fold);
  host.append(button);
  watch(banner);
}

setTimeout(() => {
  [...TOP, ...BOTTOM].forEach((s) => watch(document.querySelector(s)));
  watch(document.querySelector('#topright'));
  watch(document.querySelector('#tools'));
  stack();
}, 0);
addEventListener('resize', stack);
phone.addEventListener('change', stack);
