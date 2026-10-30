import { T } from './i18n.js';
// Einfaches, sicheres Markdown für Rechtstexte: erzeugt DOM-Knoten (kein innerHTML).
// Unterstützt: # Überschriften, Absätze, Zeilenumbrüche, - / * / 1. Listen, **fett**, *kursiv*,
// [Linktext](https://…), automatische Links für http(s)-Adressen und E-Mail-Adressen, --- Trennlinie.

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i;

function inline(text) {
  const out = [];
  // Reihenfolge: Links, fett, kursiv, URLs, E-Mail-Adressen
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)));
    if (m[1] !== undefined) {
      const url = m[2];
      if (SAFE_URL.test(url)) {
        const a = document.createElement('a');
        a.href = url;
        a.append(...inline(m[1]));
        if (/^https?:/i.test(url)) {
          a.target = '_blank';
          a.rel = T('noopener noreferrer');
        }
        out.push(a);
      } else out.push(document.createTextNode(m[1]));
    } else if (m[3] !== undefined) {
      const b = document.createElement('strong');
      b.append(...inline(m[3]));
      out.push(b);
    } else if (m[4] !== undefined) {
      const i = document.createElement('em');
      i.append(...inline(m[4]));
      out.push(i);
    } else if (m[5] !== undefined) {
      const a = document.createElement('a');
      a.href = m[5];
      a.textContent = m[5];
      a.target = '_blank';
      a.rel = T('noopener noreferrer');
      out.push(a);
    } else if (m[6] !== undefined) {
      const a = document.createElement('a');
      a.href = 'mailto:' + m[6];
      a.textContent = m[6];
      out.push(a);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  return out;
}

function lineNodes(lines) {
  const out = [];
  lines.forEach((l, i) => {
    if (i) out.push(document.createElement('br'));
    out.push(...inline(l));
  });
  return out;
}

export function renderMarkdown(src) {
  const frag = document.createDocumentFragment();
  const blocks = String(src || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) continue;
    const first = lines[0].trim();
    const hm = /^(#{1,4})\s+(.*)$/.exec(first);
    if (hm) {
      const hEl = document.createElement('h' + Math.min(4, hm[1].length + 1)); // # → h2 (h1 ist der Seitentitel)
      hEl.append(...inline(hm[2]));
      frag.append(hEl);
      if (lines.length > 1) {
        const p = document.createElement('p');
        p.append(...lineNodes(lines.slice(1)));
        frag.append(p);
      }
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(first) && lines.length === 1) {
      frag.append(document.createElement('hr'));
      continue;
    }
    if (lines.every((l) => /^\s*([-*]|\d+[.)])\s+/.test(l))) {
      const ordered = /^\s*\d+[.)]/.test(first);
      const list = document.createElement(ordered ? 'ol' : 'ul');
      for (const l of lines) {
        const li = document.createElement('li');
        li.append(...inline(l.replace(/^\s*([-*]|\d+[.)])\s+/, '')));
        list.append(li);
      }
      frag.append(list);
      continue;
    }
    const p = document.createElement('p');
    p.append(...lineNodes(lines));
    frag.append(p);
  }
  return frag;
}
