// Fußzeile mit Links zu Impressum und Datenschutzerklärung (nur, wenn hinterlegt)
import { h, api } from './util.js';

let cache = null;

export async function legalLinks() {
  if (!cache) cache = api('/api/legal').catch(() => ({ imprint: false, privacy: false }));
  return cache;
}

export async function legalFooter({ back = false, newTab = false } = {}) {
  const l = await legalLinks();
  const attrs = newTab ? { target: '_blank', rel: 'noopener' } : {};
  const links = [
    back ? h('a', { href: '/' }, '← Zur Startseite') : null,
    l.imprint ? h('a', { href: '/impressum', ...attrs }, 'Impressum') : null,
    l.privacy ? h('a', { href: '/datenschutz', ...attrs }, 'Datenschutz') : null,
  ].filter(Boolean);
  return h('nav', { class: 'legal-links', 'aria-label': 'Rechtliches' }, links);
}
