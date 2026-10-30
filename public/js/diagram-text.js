// Dialog „Diagramm aus Text“ (Mermaid-Schreibweise) mit Live-Vorschau
import { T } from './i18n.js';
import { h, toast, modal, debounce } from './util.js';
import { renderSvgDocument } from './render.js';
import { app } from './core.js';
import { placeElements } from './ui.js';
import { EXAMPLES, textToElements } from './diagram-parse.js';

/* ================================================================== */
/* Dialog                                                              */
/* ================================================================== */

app.on('openDiagramText', () => {
  if (app.viewOnly) return;
  const ta = h('textarea', { rows: 16, class: 'mono', spellcheck: false }, EXAMPLES.flow);
  const preview = h('div', { class: 'diagram-preview' });
  const err = h('div', { class: 'form-error hidden', role: 'alert' });
  let els = [];
  const update = () => {
    try {
      els = textToElements(ta.value);
      preview.innerHTML = renderSvgDocument(els, { padding: 30 }).svg;
      err.classList.add('hidden');
    } catch (e) {
      els = [];
      preview.innerHTML = '';
      err.textContent = e.message;
      err.classList.remove('hidden');
    }
  };
  ta.addEventListener('input', debounce(update, 250));
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
  });
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    update();
    if (!els.length) return;
    placeElements(els.map((x) => (x.type === 'shape' ? { ...x, author: app.user.name || '' } : x)), { select: true });
    toast(T`Diagramm mit ${els.filter((x) => x.type !== 'connector').length} Elementen eingefügt`);
    m.close();
  } },
  h('p', { class: 'muted' }, T('Beschreibe ein Fluss- oder Sequenzdiagramm in Textform (Mermaid-Schreibweise). Daraus entstehen normale Formen und Verbindungen, die du danach frei bearbeiten kannst.')),
  h('div', { class: 'row' },
    h('button', { type: 'button', class: 'btn small', onclick: () => { ta.value = EXAMPLES.flow; update(); } }, T('Beispiel: Flussdiagramm')),
    h('button', { type: 'button', class: 'btn small', onclick: () => { ta.value = EXAMPLES.seq; update(); } }, T('Beispiel: Sequenzdiagramm'))),
  h('div', { class: 'diagram-split' }, ta, preview),
  err,
  h('details', { class: 'md-help' }, h('summary', {}, T('Kurzreferenz')), h('pre', {},
    T('flowchart TD | LR | BT | RL\n  A[Rechteck]  B(abgerundet)  C{Entscheidung}  D((Kreis))\n  E([Start/Ende])  F[(Datenbank)]  G[[Unterprozess]]  H{{Sechseck}}\n  A --> B   A --- B   A -.-> B   A ==> B   A -->|Text| B   A -- Text --> B\n  A & B --> C      subgraph Titel … end\n\nsequenceDiagram\n  participant A as Name   actor B\n  A->>B: Nachricht   A-->>B: Antwort   A->>A: an sich selbst\n  Note over A,B: Notiz   autonumber\n  alt … else … end   loop … end   opt … end'))),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Einfügen'))));
  const m = modal(T('Diagramm aus Text'), form, { wide: true });
  update();
});
