// Öffentliche Seite für Impressum bzw. Datenschutzerklärung
import { h, api, loadPref } from './util.js';
import { renderMarkdown } from './markdown.js';
import { legalFooter } from './footer.js';

if (loadPref('settings', {}).dark) document.body.classList.add('dark');

const kind = location.pathname.slice(1); // impressum | datenschutz
const box = document.getElementById('legal');

(async () => {
  try {
    const d = await api('/api/legal/' + encodeURIComponent(kind));
    document.title = `${d.title} – ${d.siteName}`;
    document.getElementById('legal-site').textContent = d.siteName;
    box.append(h('h1', {}, d.title));
    if (d.text && d.text.trim()) {
      box.append(renderMarkdown(d.text));
      if (d.updatedAt) box.append(h('p', { class: 'muted small legal-updated' }, 'Stand: ' + new Date(d.updatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })));
    } else {
      box.append(h('p', { class: 'muted' }, 'Dieser Text wurde noch nicht hinterlegt.'));
    }
  } catch (e) {
    box.append(h('h1', {}, 'Nicht gefunden'), h('p', {}, e.message));
  }
  document.getElementById('footer').append(await legalFooter({ back: true }));
})();
