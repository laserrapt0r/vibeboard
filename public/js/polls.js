// Schnellumfragen im Board: Stimmungsbarometer, Fist of Five, ROTI, Team-Health-Check und eigene Fragen.
// Stimmen sind anonym – der Server schickt vor dem Auflösen nur die Zahl der Teilnehmenden und die eigene Stimme.
import { h, append, api, ICONS, toast, modal } from './util.js';
import { app } from './core.js';
import { canSteer } from './retro.js';

const op = (o) => app.sync.op(o);

export const KINDS = {
  mood: { label: 'Stimmungsbarometer', question: 'Wie geht es dir heute?', values: [['1', '😫'], ['2', '🙁'], ['3', '😐'], ['4', '🙂'], ['5', '😄']] },
  fist: { label: 'Fist of Five', question: 'Wie sehr stimmst du zu?', values: [['0', '✊'], ['1', '☝️'], ['2', '✌️'], ['3', '🤟'], ['4', '🖖'], ['5', '🖐️']] },
  roti: { label: 'ROTI (Return on Time Invested)', question: 'Wie wertvoll war dieses Meeting für dich?', values: [['1', '1 · verschwendet'], ['2', '2'], ['3', '3 · ausgeglichen'], ['4', '4'], ['5', '5 · sehr wertvoll']] },
  health: { label: 'Team-Health-Check', question: 'Wie steht es um unser Team?' },
  custom: { label: 'Eigene Frage', question: '' },
};
const HEALTH_DEFAULT = ['Spaß an der Arbeit', 'Lernen', 'Tempo', 'Klarer Auftrag', 'Teamwork', 'Unterstützung', 'Einfach auszuliefern', 'Qualität'];
const LIGHTS = [['3', '🟢', 'gut'], ['2', '🟡', 'gemischt'], ['1', '🔴', 'schlecht']];

app.on('openPollDialog', () => {
  const kind = h('select', {}, Object.entries(KINDS).map(([k, d]) => h('option', { value: k }, d.label)));
  const question = h('input', { type: 'text', maxlength: 200, value: KINDS.mood.question });
  const options = h('textarea', { rows: 4, placeholder: 'Eine Antwort pro Zeile (2–8)' });
  const items = h('textarea', { rows: 8 }, HEALTH_DEFAULT.join('\n'));
  const optBox = h('label', { class: 'hidden' }, 'Antworten (eine pro Zeile)', options);
  const itemBox = h('label', { class: 'hidden' }, 'Themen (eines pro Zeile, je mit 🟢 🟡 🔴 zu bewerten)', items);
  kind.addEventListener('change', () => {
    question.value = KINDS[kind.value].question;
    optBox.classList.toggle('hidden', kind.value !== 'custom');
    itemBox.classList.toggle('hidden', kind.value !== 'health');
  });
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    const lines = (t) => t.value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (kind.value === 'custom' && lines(options).length < 2) return toast('Bitte mindestens zwei Antworten angeben');
    op({ op: 'poll', action: 'start', kind: kind.value, question: question.value.trim(), options: lines(options), items: lines(items) });
    m.close();
  } },
  h('p', { class: 'muted' }, 'Alle antworten anonym. Bis zum Auflösen sieht man nur, wie viele schon abgestimmt haben.'),
  h('label', {}, 'Art', kind), h('label', {}, 'Frage', question), optBox, itemBox,
  app.session.poll ? h('p', { class: 'muted small' }, 'Eine laufende Umfrage wird dabei ersetzt.') : null,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, 'Umfrage starten')));
  const m = modal('Schnellumfrage', form);
});

/* ---------------- Anzeige ---------------- */

const panel = h('div', { id: 'poll-panel', class: 'panel hidden', role: 'region', 'aria-label': 'Umfrage' });
document.body.append(panel);
let hiddenFor = null;
let lastPollId = null;
let healthDraft = {};

function bars(counts, values) {
  const max = Math.max(1, ...values.map(([k]) => counts[k] || 0));
  return h('div', { class: 'poll-bars' }, values.map(([k, label]) => h('div', { class: 'poll-bar-row' },
    h('span', { class: 'poll-bar-label' }, label),
    h('span', { class: 'poll-bar' }, h('span', { style: { width: ((counts[k] || 0) / max) * 100 + '%' } })),
    h('b', {}, String(counts[k] || 0)))));
}

function average(counts) {
  const n = Object.values(counts).reduce((a, b) => a + b, 0);
  return n ? Object.entries(counts).reduce((s, [k, c]) => s + Number(k) * c, 0) / n : null;
}

function render() {
  const p = app.session.poll;
  if (p && p.id !== lastPollId) {
    lastPollId = p.id;
    hiddenFor = null;
    healthDraft = p.mine && typeof p.mine === 'object' ? { ...p.mine } : {};
    if (!p.closed && !canSteer()) toast(`${p.by || 'Jemand'} hat eine Umfrage gestartet`);
  }
  panel.classList.toggle('hidden', !p || hiddenFor === p.id);
  if (!p) return;
  const steer = canSteer();
  const d = KINDS[p.kind] || KINDS.mood;
  panel.innerHTML = '';
  append(panel, h('div', { class: 'disc-head' }, h('span', { class: 'muted small' }, `${d.label}${p.closed ? ' · Ergebnis' : ''}`), h('span', { class: 'spacer' }),
    h('button', { class: 'icon-btn small', title: steer ? 'Umfrage für alle schließen' : 'Ausblenden', html: ICONS.close, onclick: () => (steer ? op({ op: 'poll', action: 'clear' }) : (hiddenFor = p.id, render())) })),
  h('div', { class: 'poll-question' }, p.question || d.question));
  const values = p.kind === 'custom' ? (p.options || []).map((o, i) => [String(i), o]) : d.values;
  if (!p.closed) {
    if (p.kind === 'health') {
      panel.append(h('div', { class: 'health-grid' }, (p.items || []).map((it) => h('div', { class: 'health-row' }, h('span', {}, it.label),
        h('span', { class: 'health-lights' }, LIGHTS.map(([v, e, l]) => h('button', { class: 'emoji-btn' + (healthDraft[it.id] === v ? ' active' : ''), title: l, 'aria-pressed': String(healthDraft[it.id] === v), onclick: () => {
          healthDraft = { ...healthDraft, [it.id]: v };
          op({ op: 'pollVote', value: healthDraft });
          render();
        } }, e)))))));
    } else {
      panel.append(h('div', { class: 'poll-options' + (p.kind === 'roti' || p.kind === 'custom' ? ' wide' : '') }, values.map(([v, label]) => h('button', {
        class: 'poll-option' + (p.mine === v ? ' active' : ''), 'aria-pressed': String(p.mine === v),
        onclick: () => op({ op: 'pollVote', value: p.mine === v ? null : v }),
      }, label))));
    }
    panel.append(h('div', { class: 'est-actions' }, h('span', { class: 'muted small' }, `${p.participants || 0} ${p.participants === 1 ? 'Person hat' : 'Personen haben'} abgestimmt`), h('span', { class: 'spacer' }),
      steer ? h('button', { class: 'btn small primary', disabled: !p.participants, onclick: () => op({ op: 'poll', action: 'close' }) }, 'Ergebnis zeigen') : null));
    return;
  }
  const res = p.results || {};
  if (p.kind === 'health') {
    panel.append(h('div', { class: 'health-grid' }, (p.items || []).map((it) => {
      const c = (res.items && res.items[it.id]) || {};
      const n = (c['1'] || 0) + (c['2'] || 0) + (c['3'] || 0);
      return h('div', { class: 'health-row' }, h('span', {}, it.label), h('span', { class: 'health-result' },
        LIGHTS.map(([v, e]) => h('span', { title: `${c[v] || 0} von ${n}` }, `${e} ${c[v] || 0}`))));
    })));
  } else {
    const counts = res.counts || {};
    panel.append(bars(counts, values));
    const avg = p.kind !== 'custom' ? average(counts) : null;
    if (avg !== null) panel.append(h('p', { class: 'poll-avg' }, `Ø ${avg.toFixed(1).replace('.', ',')}`));
  }
  panel.append(h('div', { class: 'est-actions' }, h('span', { class: 'muted small' }, `${p.participants || 0} Teilnehmende · anonym`), h('span', { class: 'spacer' }),
    h('button', { class: 'btn small', onclick: () => app.emit('openPollHistory') }, 'Verlauf')));
}

app.on('session', (kind) => (kind === 'all' || kind === 'poll' || kind === 'moderation') && render());

/* ---------------- Verlauf (auch über die Retro-Serie) ---------------- */

app.on('openPollHistory', async () => {
  let polls = [];
  try {
    polls = (await api(`/api/boards/${app.boardId}/polls`)).polls;
  } catch (e) {
    return toast(e.message);
  }
  const body = h('div', { class: 'poll-history' });
  if (!polls.length) body.append(h('p', { class: 'muted' }, 'Noch keine abgeschlossenen Umfragen. Ergebnisse werden beim Auflösen gespeichert – bei einer Retro-Serie auch über mehrere Retros hinweg.'));
  for (const [kind, d] of Object.entries(KINDS)) {
    const list = polls.filter((p) => p.kind === kind);
    if (!list.length) continue;
    body.append(h('h4', {}, d.label));
    const rows = h('div', { class: 'trend' });
    for (const p of list) {
      const date = new Date(p.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
      let value = '', pct = 0;
      if (kind === 'health') {
        // Mittelwert über alle Themen (grün = 3, gelb = 2, rot = 1)
        const scores = Object.values((p.results && p.results.items) || {}).map((c) => {
          const n = (c['1'] || 0) + (c['2'] || 0) + (c['3'] || 0);
          return n ? ((c['3'] || 0) * 3 + (c['2'] || 0) * 2 + (c['1'] || 0)) / n : null;
        }).filter((x) => x !== null);
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
        pct = avg === null ? 0 : (avg - 1) / 2;
        value = avg === null ? '–' : `Ø ${avg.toFixed(1).replace('.', ',')} von 3`;
      } else if (kind === 'custom') {
        const counts = (p.results && p.results.counts) || {};
        const opts = (p.results && p.results.options) || [];
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        value = top ? `${opts[Number(top[0])] || '?'} (${top[1]})` : '–';
        pct = top ? top[1] / p.participants : 0;
      } else {
        const avg = average((p.results && p.results.counts) || {});
        const max = 5, min = kind === 'fist' ? 0 : 1;
        value = avg === null ? '–' : `Ø ${avg.toFixed(1).replace('.', ',')}`;
        pct = avg === null ? 0 : (avg - min) / (max - min);
      }
      rows.append(h('div', { class: 'trend-row' + (p.boardId === app.boardId ? ' current' : '') },
        h('span', { class: 'trend-label' }, `${date} · ${p.boardName}`),
        h('span', { class: 'poll-bar' }, h('span', { style: { width: Math.max(2, Math.min(100, pct * 100)) + '%' } })),
        h('b', {}, value), h('span', { class: 'muted small' }, ` ${p.participants}×`)));
    }
    body.append(rows);
  }
  modal('Umfrage-Verlauf', body, { wide: true });
});
