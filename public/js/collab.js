// Zusammenarbeit: Teilnehmer, Cursor, Folgen, Timer, Abstimmung, Reaktionen, Laser, Präsentation
import { h, append, api, ICONS, esc, toast, modal, initials, FONT } from './util.js';
import {
  app, $, stage, getEl, bounds, toScreen, visibleRect, viewFor, applyView, fitTo, fitAll, now, frames, setTool,
  loadElements, applyRemoteOp, scheduleRender, rerenderAll, setSelection, finishEdit, abortEdit, initCore,
} from './core.js';
import { menu, popover, closePop, toggleSidePanel, showSidePanel, currentSidePanel, renderSidePanel, openProfile } from './ui.js';

/* ================================================================== */
/* Teilnehmer & Cursor                                                 */
/* ================================================================== */

const cursorsLayer = $('#cursors');
const cursorEls = new Map();

function renderAvatars() {
  const box = $('#avatars');
  if (!box) return;
  box.innerHTML = '';
  const me = h('button', { class: 'avatar', style: { background: app.user.color }, title: `${app.user.name || 'Gast'} (du) – Profil bearbeiten`, onclick: () => openProfile() }, initials(app.user.name || 'Gast'));
  box.append(me);
  const peers = [...app.peers.values()];
  for (const p of peers.slice(0, 6)) {
    const b = h('button', { class: 'avatar' + (app.following === p.clientId ? ' following' : ''), style: { background: p.color }, title: p.name + (p.viewOnly ? ' (ansehen)' : '') }, initials(p.name));
    b.onclick = () => menu(b, [
      { header: p.name },
      { label: app.following === p.clientId ? 'Nicht mehr folgen' : 'Folgen', icon: 'users', onClick: () => follow(app.following === p.clientId ? null : p.clientId) },
      { label: 'Zur Position springen', icon: 'fit', disabled: !p.view, onClick: () => p.view && fitTo(p.view, { pad: 0, maxZ: 8 }) },
    ]);
    box.append(b);
  }
  if (peers.length > 6) box.append(h('span', { class: 'avatar more' }, '+' + (peers.length - 6)));
  if (peers.length) {
    const all = h('button', { class: 'icon-btn', title: 'Alle zu mir holen', html: ICONS.users });
    all.onclick = () => {
      app.sync.signal('summon', { rect: visibleRect(), name: app.user.name });
      toast('Alle Teilnehmenden wurden zu deiner Ansicht geholt');
    };
    box.append(all);
  }
  const fb = $('#follow-banner');
  const fp = app.following && app.peers.get(app.following);
  fb.classList.toggle('hidden', !fp);
  if (fp) {
    fb.style.setProperty('--c', fp.color);
    fb.innerHTML = '';
    fb.append(h('span', {}, `Du folgst ${fp.name}`), h('button', { class: 'btn small', onclick: () => follow(null) }, 'Beenden'));
  }
  stage.style.boxShadow = fp ? `inset 0 0 0 4px ${fp.color}` : '';
}

app.on('peers', renderAvatars);

function follow(clientId) {
  app.following = clientId;
  const p = clientId && app.peers.get(clientId);
  if (p && p.view) applyFollowView(p.view);
  renderAvatars();
}

function applyFollowView(rect) {
  app._applyingFollow = true;
  app.view = viewFor(rect, 0, 8);
  applyView(true);
  app._applyingFollow = false;
}

function updateCursor(p) {
  let c = cursorEls.get(p.clientId);
  if (!p.cursor) return;
  if (!c) {
    c = h('div', { class: 'peer-cursor' },
      h('span', { html: `<svg width="18" height="18" viewBox="0 0 18 18"><path d="M1 1l6 15 2-6 6-2z" fill="${p.color}" stroke="#fff" stroke-width="1.2"/></svg>` }),
      h('span', { class: 'peer-name', style: { background: p.color } }, p.name));
    cursorsLayer.append(c);
    cursorEls.set(p.clientId, c);
  }
  const s = toScreen(p.cursor.x, p.cursor.y);
  c.style.transform = `translate(${s.x}px, ${s.y}px)`;
  c.classList.toggle('idle', Date.now() - (p.lastMove || 0) > 8000);
}

function removeCursor(id) {
  cursorEls.get(id)?.remove();
  cursorEls.delete(id);
}

app.on('view', () => app.peers.forEach(updateCursor));
setInterval(() => app.peers.forEach(updateCursor), 3000);

/* ================================================================== */
/* Laserpointer                                                        */
/* ================================================================== */

const laserCanvas = $('#laser');
const lctx = laserCanvas.getContext('2d');
const trails = new Map(); // clientId -> { color, pts: [{x,y,t}] }
let laserRaf = 0;

function addLaser(id, color, p) {
  if (!trails.has(id)) trails.set(id, { color, pts: [] });
  trails.get(id).pts.push({ x: p.x, y: p.y, t: performance.now() });
  if (!laserRaf) laserRaf = requestAnimationFrame(drawLaser);
}

function drawLaser() {
  laserRaf = 0;
  const W = (laserCanvas.width = stage.clientWidth * devicePixelRatio);
  const H = (laserCanvas.height = stage.clientHeight * devicePixelRatio);
  lctx.clearRect(0, 0, W, H);
  lctx.scale(devicePixelRatio, devicePixelRatio);
  const t = performance.now();
  let alive = false;
  for (const [id, tr] of trails) {
    tr.pts = tr.pts.filter((p) => t - p.t < 900);
    if (!tr.pts.length) {
      trails.delete(id);
      continue;
    }
    alive = true;
    lctx.lineCap = 'round';
    lctx.lineJoin = 'round';
    for (let i = 1; i < tr.pts.length; i++) {
      const a = toScreen(tr.pts[i - 1].x, tr.pts[i - 1].y), b = toScreen(tr.pts[i].x, tr.pts[i].y);
      const age = (t - tr.pts[i].t) / 900;
      lctx.strokeStyle = tr.color;
      lctx.globalAlpha = Math.max(0, 1 - age);
      lctx.lineWidth = 6 * (1 - age) + 1;
      lctx.beginPath();
      lctx.moveTo(a.x, a.y);
      lctx.lineTo(b.x, b.y);
      lctx.stroke();
    }
    const last = tr.pts[tr.pts.length - 1];
    const s = toScreen(last.x, last.y);
    lctx.globalAlpha = 1;
    lctx.fillStyle = tr.color;
    lctx.shadowColor = tr.color;
    lctx.shadowBlur = 12;
    lctx.beginPath();
    lctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
    lctx.fill();
    lctx.shadowBlur = 0;
  }
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  if (alive) laserRaf = requestAnimationFrame(drawLaser);
}

let laserBuf = [];
let laserTimer = null;
app.on('laser', (p) => {
  addLaser('me', '#f03e3e', p);
  laserBuf.push({ x: Math.round(p.x), y: Math.round(p.y) });
  if (!laserTimer) {
    laserTimer = setTimeout(() => {
      app.sync.signal('laser', laserBuf);
      laserBuf = [];
      laserTimer = null;
    }, 50);
  }
});

/* ================================================================== */
/* Reaktionen                                                          */
/* ================================================================== */

const REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🤔', '🔥', '😮'];

function showReaction(emoji, name) {
  const el = h('div', { class: 'reaction', style: { left: 20 + Math.random() * 60 + '%' } }, h('span', { class: 'r-emoji' }, emoji), name ? h('span', { class: 'r-name' }, name) : null);
  document.body.append(el);
  setTimeout(() => el.remove(), 3000);
}

/* ================================================================== */
/* Timer                                                               */
/* ================================================================== */

const timerWidget = $('#timer-widget');
let beepedFor = null;

function timerRemaining(t) {
  if (!t) return 0;
  if (!t.running) return t.remaining;
  return Math.max(0, t.endsAt - now());
}

function setTimer(t) {
  app.session.timer = t;
  app.sync.op({ op: 'timer', timer: t });
  renderTimer();
}

function startTimer(ms) {
  setTimer({ duration: ms, running: true, endsAt: now() + ms, remaining: ms, by: app.user.name });
}

function fmt(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((d) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d + 0.2);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + d);
      o.stop(ac.currentTime + d + 0.22);
    });
  } catch {}
}

function renderTimer() {
  const t = app.session.timer;
  timerWidget.classList.toggle('hidden', !t);
  $('#btn-timer')?.classList.toggle('active', !!t);
  if (!t) return;
  const rem = timerRemaining(t);
  if (!timerWidget.firstChild) {
    timerWidget.append(
      h('span', { class: 'timer-icon', html: ICONS.timer }),
      h('span', { class: 'timer-time' }),
      h('button', { class: 'icon-btn small', title: '+1 Minute', onclick: () => {
        const c = app.session.timer;
        if (!c) return;
        if (c.running) setTimer({ ...c, endsAt: Math.max(c.endsAt, now()) + 60000, duration: c.duration + 60000 });
        else setTimer({ ...c, remaining: c.remaining + 60000, duration: c.duration + 60000 });
      } }, '+1'),
      h('button', { class: 'icon-btn small timer-pp' }),
      h('button', { class: 'icon-btn small', title: 'Timer beenden', html: ICONS.stop, onclick: () => setTimer(null) }),
    );
  }
  timerWidget.querySelector('.timer-time').textContent = fmt(rem);
  const pp = timerWidget.querySelector('.timer-pp');
  pp.innerHTML = t.running ? ICONS.pause : ICONS.play;
  pp.title = t.running ? 'Pausieren' : rem > 0 ? 'Fortsetzen' : 'Neu starten';
  pp.onclick = () => {
    const c = app.session.timer;
    if (c.running) setTimer({ ...c, running: false, remaining: timerRemaining(c) });
    else if (c.remaining > 0) setTimer({ ...c, running: true, endsAt: now() + c.remaining });
    else startTimer(c.duration);
  };
  const done = t.running && rem <= 0;
  timerWidget.classList.toggle('done', done || (!t.running && rem <= 0));
  timerWidget.classList.toggle('warn', t.running && rem > 0 && rem < 10000);
  if (done && beepedFor !== t.endsAt) {
    beepedFor = t.endsAt;
    beep();
    toast('⏰ Die Zeit ist abgelaufen!', 4000);
  }
}

setInterval(() => app.session.timer && renderTimer(), 250);

function openTimerMenu(anchor) {
  const custom = h('input', { type: 'number', min: 1, max: 180, value: 5, style: { width: '64px' } });
  popover(anchor, h('div', { class: 'timer-pop' },
    h('div', { class: 'pop-title' }, 'Timer für alle starten'),
    h('div', { class: 'row wrap' }, [1, 2, 3, 5, 10, 15, 30].map((m) => h('button', { class: 'btn small', onclick: () => { startTimer(m * 60000); closePop(); } }, m + ' Min'))),
    h('div', { class: 'row', style: { marginTop: '10px' } }, custom, h('span', {}, 'Minuten'), h('button', { class: 'btn primary small', onclick: () => {
      const m = Math.max(1, Math.min(180, Number(custom.value) || 5));
      startTimer(m * 60000);
      closePop();
    } }, 'Start')),
    app.session.timer ? h('button', { class: 'btn small danger', style: { marginTop: '10px' }, onclick: () => { setTimer(null); closePop(); } }, 'Timer beenden') : null));
}

/* ================================================================== */
/* Abstimmung                                                          */
/* ================================================================== */

const banner = $('#voting-banner');
const layerVotes = $('#layer-votes');
let hideResults = false;

function myVotesUsed(v) {
  return Object.values(v.votes || {}).reduce((s, m) => s + (m[app.user.id] || 0), 0);
}

function setVoting(v) {
  app.session.voting = v;
  app.sync.op({ op: 'voting', voting: v });
  renderVoting();
}

function openVotingMenu(anchor) {
  const v = app.session.voting;
  if (v && v.active) {
    menu(anchor, [
      { header: 'Abstimmung läuft' },
      { label: 'Abstimmung beenden & Ergebnisse zeigen', icon: 'check', onClick: endVoting },
      { label: 'Abstimmung abbrechen', icon: 'close', danger: true, onClick: () => setVoting(null) },
    ]);
    return;
  }
  const num = h('input', { type: 'number', min: 1, max: 50, value: 3 });
  const title = h('input', { type: 'text', placeholder: 'z. B. Welche Idee setzen wir um?' });
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    setVoting({ active: true, votesPerUser: Math.max(1, Math.min(50, Number(num.value) || 3)), votes: {}, title: title.value.trim(), by: app.user.name, startedAt: Date.now() });
    hideResults = false;
    m.close();
    toast('Abstimmung gestartet – klicke auf Elemente, um abzustimmen');
  } },
  h('p', { class: 'muted' }, 'Alle Teilnehmenden können Sticky Notes, Formen, Karten und Bilder anklicken, um Stimmen zu vergeben. Die Stimmen der anderen bleiben bis zum Ende verborgen.'),
  h('label', {}, 'Frage (optional)', title),
  h('label', {}, 'Stimmen pro Person', num),
  v && !v.active ? h('p', { class: 'muted small' }, 'Die Ergebnisse der letzten Abstimmung werden dabei verworfen.') : null,
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, 'Abstimmung starten')));
  const m = modal('Abstimmung starten', form);
}

function endVoting() {
  const v = app.session.voting;
  if (!v) return;
  setVoting({ ...v, active: false, endedAt: Date.now() });
  hideResults = false;
  openResults();
}

function openResults() {
  if (!app.session.voting) return;
  showSidePanel('votes');
}

app.on('renderVotesPanel', (side, close) => {
  const v = app.session.voting;
  side.append(h('div', { class: 'side-head' }, h('h3', {}, 'Abstimmungsergebnis'), h('span', { class: 'spacer' }), close));
  if (!v) {
    side.append(h('p', { class: 'muted pad' }, 'Keine Abstimmung vorhanden.'));
    return;
  }
  if (v.title) side.append(h('p', { class: 'pad' }, h('b', {}, v.title)));
  if (v.active) {
    side.append(h('p', { class: 'muted pad' }, 'Die Abstimmung läuft noch. Ergebnisse erscheinen nach dem Beenden.'));
    return;
  }
  const rows = Object.entries(v.votes || {}).map(([id, m]) => ({ id, el: getEl(id), n: Object.values(m).reduce((a, b) => a + b, 0), voters: Object.keys(m).length })).filter((r) => r.el).sort((a, b) => b.n - a.n);
  const total = rows.reduce((s, r) => s + r.n, 0);
  side.append(h('p', { class: 'muted pad small' }, `${total} Stimmen auf ${rows.length} Elemente verteilt`));
  const max = rows[0]?.n || 1;
  rows.forEach((r, i) => {
    const label = r.el.text || r.el.title || r.el.char || r.el.name || r.el.type;
    side.append(h('div', { class: 'vote-row', onclick: () => {
      setSelection([r.id]);
      fitTo(bounds(r.el), { maxZ: 1.2, pad: 160 });
    } },
    h('span', { class: 'vote-rank' }, i + 1),
    h('span', { class: 'vote-swatch', style: { background: r.el.fill || r.el.color || '#ddd' } }),
    h('span', { class: 'vote-label' }, String(label).slice(0, 80)),
    h('span', { class: 'vote-bar' }, h('span', { style: { width: (r.n / max) * 100 + '%' } })),
    h('b', { class: 'vote-n' }, r.n)));
  });
  side.append(h('div', { class: 'side-actions' },
    h('button', { class: 'btn small', onclick: () => { hideResults = true; toggleSidePanel('votes'); renderVotes(); } }, 'Ausblenden'),
    app.viewOnly ? null : h('button', { class: 'btn small danger', onclick: () => { setVoting(null); toggleSidePanel('votes'); } }, 'Ergebnisse löschen')));
});

function renderVoting() {
  const v = app.session.voting;
  const active = v && v.active;
  banner.classList.toggle('hidden', !active);
  $('#btn-vote')?.classList.toggle('active', !!active);
  stage.classList.toggle('voting', !!(active && app.voteMode));
  if (active) {
    const left = v.votesPerUser - myVotesUsed(v);
    banner.innerHTML = '';
    append(banner,
      h('span', { html: ICONS.vote }),
      h('span', {}, h('b', {}, v.title || 'Abstimmung läuft'), ' · ', left > 0 ? `Noch ${left} von ${v.votesPerUser} Stimmen` : 'Alle Stimmen vergeben', h('span', { class: 'muted small' }, '  (Klick = Stimme, Alt+Klick = zurücknehmen)')),
      h('button', { class: 'btn small', onclick: () => { app.voteMode = !app.voteMode; renderVoting(); } }, app.voteMode ? 'Pausieren' : 'Abstimmen'),
      app.viewOnly ? null : h('button', { class: 'btn small primary', onclick: endVoting }, 'Beenden'),
    );
  }
  renderVotes();
  if (currentSidePanel() === 'votes') renderSidePanel();
}

function renderVotes() {
  const v = app.session.voting;
  if (!v || (!v.active && hideResults)) {
    layerVotes.innerHTML = '';
    return;
  }
  const z = app.view.z;
  let out = '';
  for (const [id, m] of Object.entries(v.votes || {})) {
    const el = getEl(id);
    if (!el) continue;
    const n = v.active ? m[app.user.id] || 0 : Object.values(m).reduce((a, b) => a + b, 0);
    if (!n) continue;
    const b = bounds(el);
    const r = 14 / z;
    const cx = b.x + b.w - r * 0.3, cy = b.y + r * 0.3;
    const color = v.active ? '#4262ff' : '#e8590c';
    out += `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="#fff" stroke-width="${2 / z}"/><text x="${cx}" y="${cy + 5 / z}" text-anchor="middle" font-family="${esc(FONT)}" font-weight="bold" font-size="${14 / z}" fill="#fff">${n}</text></g>`;
  }
  layerVotes.innerHTML = out;
}

app.on('render', renderVotes);
app.on('view', renderVotes);

app.on('vote', (elId, delta) => {
  const v = app.session.voting;
  if (!v || !v.active) return;
  if (delta > 0 && myVotesUsed(v) >= v.votesPerUser) return toast('Du hast alle Stimmen vergeben (Alt+Klick nimmt eine zurück)');
  app.sync.op({ op: 'vote', elId, delta });
});

/* ================================================================== */
/* Präsentationsmodus                                                  */
/* ================================================================== */

let present = null;
const pbar = $('#present-bar');

app.on('present', (startId) => startPresentation(startId));

function startPresentation(startId) {
  const list = frames();
  if (!list.length) return toast('Lege zuerst Frames an – sie werden zu Folien');
  finishEdit();
  setSelection([]);
  setTool('select');
  present = { list, i: Math.max(0, list.findIndex((f) => f.id === startId)) };
  document.body.classList.add('presenting');
  document.documentElement.requestFullscreen?.().catch(() => {});
  showSlide();
}

const mask = $('#present-mask');

function positionMask() {
  if (!present) return;
  const f = getEl(present.list[present.i].id) || present.list[present.i];
  const p1 = toScreen(f.x, f.y), p2 = toScreen(f.x + f.w, f.y + f.h);
  Object.assign(mask.style, { left: p1.x + 'px', top: p1.y + 'px', width: p2.x - p1.x + 'px', height: p2.y - p1.y + 'px' });
}

app.on('view', positionMask);

function showSlide() {
  if (!present) return;
  const f = present.list[present.i];
  const el = getEl(f.id) || f;
  mask.classList.remove('hidden');
  fitTo({ x: el.x, y: el.y, w: el.w, h: el.h }, { pad: 24, maxZ: 8 });
  pbar.innerHTML = '';
  pbar.append(
    h('button', { class: 'icon-btn', title: 'Zurück (←)', html: ICONS.chevLeft, onclick: () => go(-1) }),
    h('span', {}, `${present.i + 1} / ${present.list.length} · ${el.title || 'Frame'}`),
    h('button', { class: 'icon-btn', title: 'Weiter (→)', html: ICONS.chevRight, onclick: () => go(1) }),
    h('button', { class: 'icon-btn', title: 'Beenden (Esc)', html: ICONS.close, onclick: stopPresentation }),
  );
  pbar.classList.remove('hidden');
}

function go(d) {
  if (!present) return;
  present.i = Math.max(0, Math.min(present.list.length - 1, present.i + d));
  showSlide();
}

function stopPresentation() {
  if (!present) return;
  present = null;
  document.body.classList.remove('presenting');
  pbar.classList.add('hidden');
  mask.classList.add('hidden');
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && present) stopPresentation();
});
window.addEventListener('resize', () => present && setTimeout(showSlide, 50));

app.on('key', (e) => {
  if (!present) return;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
    e.preventDefault();
    go(1);
  } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
    e.preventDefault();
    go(-1);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    stopPresentation();
  }
});

/* ================================================================== */
/* Kollaborations-Schaltflächen in der Kopfzeile                       */
/* ================================================================== */

app.on('buildCollabTools', (box) => {
  const timerBtn = h('button', { class: 'icon-btn', id: 'btn-timer', title: 'Timer', html: ICONS.timer });
  timerBtn.onclick = () => openTimerMenu(timerBtn);
  const voteBtn = h('button', { class: 'icon-btn', id: 'btn-vote', title: 'Abstimmung', html: ICONS.vote });
  voteBtn.onclick = () => {
    const v = app.session.voting;
    if (v && !v.active && !app.viewOnly) {
      menu(voteBtn, [
        { label: 'Ergebnisse anzeigen', icon: 'vote', onClick: () => { hideResults = false; renderVotes(); openResults(); } },
        { label: 'Neue Abstimmung', icon: 'plus', onClick: () => openVotingMenu(voteBtn) },
      ]);
    } else if (!app.viewOnly) openVotingMenu(voteBtn);
    else openResults();
  };
  const reactBtn = h('button', { class: 'icon-btn', title: 'Reaktion senden', html: ICONS.smile });
  reactBtn.onclick = () => popover(reactBtn, h('div', { class: 'react-row' }, REACTIONS.map((r) => h('button', { class: 'emoji-btn', onclick: () => {
    showReaction(r, app.user.name);
    app.sync.signal('reaction', { emoji: r, name: app.user.name });
  } }, r))));
  const presentBtn = h('button', { class: 'icon-btn', title: 'Präsentieren', html: ICONS.present, onclick: () => startPresentation(null) });
  if (!app.viewOnly) box.append(timerBtn, voteBtn);
  box.append(reactBtn, presentBtn);
});

/* ================================================================== */
/* Server-Ereignisse                                                   */
/* ================================================================== */

export function initCollab() {
  const hadView = initCore();
  const s = app.sync;
  let first = true;
  s.on('hello', (msg) => {
    // Rechte haben sich geändert (z. B. Rolle angepasst) – Oberfläche neu aufbauen
    if (msg.role && msg.role !== app.role) return location.reload();
    app.serverOffset = msg.serverTime - Date.now();
    loadElements(msg.board.elements);
    // Eigene, noch nicht bestätigte Änderungen wieder anwenden – sie werden gleich (erneut) gesendet
    for (const op of app.sync.pendingOps()) applyRemoteOp(op);
    if (app.editing && !getEl(app.editing.id)) abortEdit();
    app.name = msg.board.name;
    app.session = msg.board.session || { timer: null, voting: null };
    app.peers.clear();
    cursorEls.forEach((c) => c.remove());
    cursorEls.clear();
    for (const p of msg.peers) app.peers.set(p.clientId, { ...p });
    app.loaded = true;
    app.emit('name');
    app.emit('peers');
    renderTimer();
    renderVoting();
    if (first) {
      first = false;
      if (!hadView) requestAnimationFrame(() => fitAll(false));
      if (app.session.voting && !app.session.voting.active && Object.keys(app.session.voting.votes || {}).length) hideResults = true;
    }
    rerenderAll();
    app.emit('loaded');
  });
  s.on('ops', (msg) => {
    for (const op of msg.ops) {
      if (op.op === 'upsert' || op.op === 'delete') applyRemoteOp(op);
      else if (op.op === 'rename') {
        app.name = op.name;
        app.emit('name');
      } else if (op.op === 'timer') {
        app.session.timer = op.timer;
        renderTimer();
      } else if (op.op === 'voting') {
        const was = app.session.voting;
        app.session.voting = op.voting;
        if (was && was.active && op.voting && !op.voting.active) {
          hideResults = false;
          openResults();
          toast('Abstimmung beendet – Ergebnisse sind da');
        } else if (op.voting && op.voting.active && (!was || !was.active)) {
          app.voteMode = true;
          toast(`${op.voting.by || 'Jemand'} hat eine Abstimmung gestartet`);
        }
        renderVoting();
      }
    }
  });
  s.on('voting', (v) => {
    app.session.voting = v;
    renderVoting();
  });
  s.on('join', (msg) => {
    app.peers.set(msg.user.clientId, { ...msg.user });
    app.emit('peers');
    toast(`${msg.user.name} ist dem Board beigetreten`);
  });
  s.on('leave', (msg) => {
    const p = app.peers.get(msg.clientId);
    app.peers.delete(msg.clientId);
    removeCursor(msg.clientId);
    if (app.following === msg.clientId) app.following = null;
    app.emit('peers');
    scheduleRender(true);
    if (p) toast(`${p.name} hat das Board verlassen`);
  });
  s.on('signal', (msg) => {
    const p = app.peers.get(msg.from);
    if (!p) return;
    switch (msg.kind) {
      case 'cursor':
        p.cursor = msg.data;
        p.lastMove = Date.now();
        updateCursor(p);
        break;
      case 'view':
        p.view = msg.data;
        if (app.following === msg.from) applyFollowView(msg.data);
        break;
      case 'sel':
        p.sel = msg.data;
        scheduleRender(true);
        break;
      case 'laser':
        for (const pt of msg.data || []) addLaser(msg.from, p.color, pt);
        break;
      case 'reaction':
        showReaction(msg.data.emoji, msg.data.name);
        break;
      case 'summon':
        fitTo(msg.data.rect, { pad: 0, maxZ: 8 });
        toast(`${msg.data.name || p.name} hat alle zu sich geholt`);
        break;
    }
  });
  s.on('reload', (msg) => {
    s.es.close();
    if (msg.reason === 'disabled') location.href = '/login';
    else location.reload();
  });
  s.on('deleted', () => {
    alert('Dieses Board wurde gelöscht.');
    location.href = '/';
  });
  s.on('error', (err) => toast(err));
  let checking = false;
  s.on('status', async (ok) => {
    app.emit('status', ok);
    // Verbindung verloren: prüfen, ob Session oder Zugriff weggefallen sind
    if (ok || checking) return;
    checking = true;
    try {
      await api(`/api/boards/${app.boardId}`);
    } catch (e) {
      if (e.status === 403 || e.status === 404) location.reload();
    } finally {
      setTimeout(() => (checking = false), 5000);
    }
  });
  s.connect();
}
