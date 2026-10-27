// Zusammenarbeit: Teilnehmer, Cursor, Folgen, Timer, Abstimmung, Reaktionen, Laser, Präsentation
import { h, append, api, ICONS, esc, toast, modal, initials, FONT } from './util.js';
import {
  app, $, stage, getEl, bounds, toScreen, visibleRect, viewFor, applyView, fitTo, fitAll, now, frames, setTool,
  loadElements, applyRemoteOp, applyRemoteTableOp, scheduleRender, rerenderAll, setSelection, finishEdit, abortEdit, initCore, lastPointer,
} from './core.js';
import { throttle } from './util.js';
import { menu, popover, closePop, toggleSidePanel, showSidePanel, currentSidePanel, renderSidePanel, openProfile } from './ui.js';
import { facilitatorItems, toolsReserved } from './moderation.js';
import * as bell from './notifications.js';

// Gesperrte Werkzeuge (Moderation): Hinweis statt Aktion
const reservedHint = () => toolsReserved() && (toast('Das ist während der Moderation den Moderierenden vorbehalten'), true);

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
    const b = h('button', { class: 'avatar' + (app.following === p.clientId ? ' following' : '') + (p.away ? ' away' : ''), style: { background: p.color }, title: p.name + (p.role === 'commenter' ? ' (kommentieren)' : p.viewOnly ? ' (ansehen)' : '') + (p.away ? ' – abwesend' : '') }, initials(p.name));
    b.onclick = () => menu(b, [
      { header: p.name },
      { label: app.following === p.clientId ? 'Nicht mehr folgen' : 'Folgen', icon: 'users', onClick: () => follow(app.following === p.clientId ? null : p.clientId) },
      { label: 'Zur Position springen', icon: 'fit', disabled: !p.view, onClick: () => p.view && fitTo(p.view, { pad: 0, maxZ: 8 }) },
      ...facilitatorItems(p),
    ]);
    box.append(b);
  }
  if (peers.length > 6) box.append(h('span', { class: 'avatar more' }, '+' + (peers.length - 6)));
  if (peers.length && !app.viewOnly) {
    const all = h('button', { class: 'icon-btn', title: 'Alle zu mir holen / Alle folgen mir', html: ICONS.users });
    all.onclick = () => !reservedHint() && menu(all, [
      { header: 'Aufmerksamkeit lenken' },
      { label: 'Alle zu mir holen (einmalig)', icon: 'fit', onClick: () => {
        app.sync.signal('summon', { rect: visibleRect(), name: app.user.name });
        toast('Alle Teilnehmenden wurden zu deiner Ansicht geholt');
      } },
      { label: 'Alle folgen mir (Moderation)', icon: 'users', onClick: () => {
        if (app.following) follow(null);
        app.sync.signal('lead', { rect: visibleRect(), name: app.user.name });
        toast('Alle folgen jetzt deiner Ansicht – bis sie selbst navigieren');
      } },
    ]);
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

const CHAT_MS = 6000;

function updateCursor(p) {
  let c = cursorEls.get(p.clientId);
  if (!p.cursor) return;
  if (!c) {
    c = h('div', { class: 'peer-cursor' },
      h('span', { class: 'peer-arrow', html: `<svg width="18" height="18" viewBox="0 0 18 18"><path d="M1 1l6 15 2-6 6-2z" fill="${p.color}" stroke="#fff" stroke-width="1.2"/></svg>` }),
      h('span', { class: 'peer-name', style: { background: p.color } }, p.name),
      h('span', { class: 'peer-chat hidden', style: { background: p.color } }));
    // Liegt der Zeiger außerhalb der Ansicht, springt ein Klick auf den Randpfeil dorthin
    c.addEventListener('click', () => p.cursor && fitTo({ x: p.cursor.x - 300, y: p.cursor.y - 200, w: 600, h: 400 }, { maxZ: app.view.z }));
    cursorsLayer.append(c);
    cursorEls.set(p.clientId, c);
  }
  const chat = c.querySelector('.peer-chat');
  const showChat = p.chat && p.chat.text && Date.now() - p.chat.t < CHAT_MS;
  chat.classList.toggle('hidden', !showChat);
  if (showChat) chat.textContent = p.chat.text;
  const s = toScreen(p.cursor.x, p.cursor.y);
  const W = stage.clientWidth, H = stage.clientHeight, m = 14;
  const off = s.x < 0 || s.y < 0 || s.x > W || s.y > H;
  c.classList.toggle('offscreen', off);
  if (off) {
    // nicht unter Werkzeugleiste (links), Kopfzeilen (oben) sowie Minimap/Zoom (rechts unten) legen
    const cx = Math.max(m + 64, Math.min(W - m - 110, s.x));
    let cy = Math.max(m + 64, Math.min(H - m - 70, s.y));
    if (cx > W - 260 && cy > H - 230) cy = H - 230;
    // Die Pfeilspitze zeigt im Ausgangszustand nach links oben (−135°) – auf die Richtung zum Zeiger drehen
    const ang = (Math.atan2(s.y - H / 2, s.x - W / 2) * 180) / Math.PI;
    c.style.transform = `translate(${cx}px, ${cy}px)`;
    c.querySelector('.peer-arrow').style.transform = `rotate(${ang + 135}deg)`;
    c.title = `${p.name} – klicken, um hinzuspringen`;
  } else {
    c.style.transform = `translate(${s.x}px, ${s.y}px)`;
    c.querySelector('.peer-arrow').style.transform = '';
    c.title = '';
  }
  c.classList.toggle('idle', !showChat && Date.now() - (p.lastMove || 0) > 8000);
  c.classList.toggle('away', !!p.away);
}

/* ---------------- Cursor-Chat: kurze Nachricht am eigenen Mauszeiger (Taste /) ---------------- */

let chatBox = null;
const sendChat = throttle((text) => app.sync.signal('chat', { text }), 120);

function openCursorChat() {
  if (chatBox) return;
  const p = toScreen(lastPointer().x, lastPointer().y);
  const sr = stage.getBoundingClientRect();
  const input = h('input', { type: 'text', maxlength: 120, placeholder: 'Nachricht an alle …', 'aria-label': 'Cursor-Chat' });
  chatBox = h('div', { class: 'cursor-chat-input', style: { left: Math.min(innerWidth - 260, sr.left + p.x + 18) + 'px', top: Math.min(innerHeight - 60, sr.top + p.y + 22) + 'px', background: app.user.color } }, input);
  document.body.append(chatBox);
  input.focus();
  const close = (clear) => {
    if (!chatBox) return;
    chatBox.remove();
    chatBox = null;
    if (clear) app.sync.signal('chat', { text: '' });
  };
  input.addEventListener('input', () => sendChat(input.value.slice(0, 120)));
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') close(true);
    else if (e.key === 'Enter') {
      app.sync.signal('chat', { text: input.value.slice(0, 120) });
      close(false);
    }
  });
  input.addEventListener('blur', () => setTimeout(() => close(false), 100));
}

app.on('key', (e) => {
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !app.editing) {
    e.preventDefault();
    openCursorChat();
  }
});

// Abwesenheit (Tab im Hintergrund) für die anderen sichtbar machen
document.addEventListener('visibilitychange', () => app.sync && app.sync.signal('presence', { away: document.hidden }));

// Anzeige „… schreibt“ an Elementen, die gerade bearbeitet werden
app.on('editing', (on) => app.sync && app.sync.signal('editing', on && app.editing ? app.editing.id : null));

function removeCursor(id) {
  cursorEls.get(id)?.remove();
  cursorEls.delete(id);
}

app.on('view', () => app.peers.forEach(updateCursor));
setInterval(() => app.peers.forEach(updateCursor), 1000);

/* ================================================================== */
/* Laserpointer                                                        */
/* ================================================================== */

const laserCanvas = $('#laser');
const lctx = laserCanvas.getContext('2d');
const trails = new Map(); // clientId -> { color, pts: [{x,y,t}] }
let laserRaf = 0;

export function addLaser(id, color, p) {
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
  timerBtn.onclick = () => !reservedHint() && openTimerMenu(timerBtn);
  const voteBtn = h('button', { class: 'icon-btn', id: 'btn-vote', title: 'Abstimmung', html: ICONS.vote });
  voteBtn.onclick = () => {
    const v = app.session.voting;
    if (toolsReserved()) return v ? openResults() : reservedHint();
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

function showUpdateBanner(version) {
  if (document.getElementById('update-banner')) return;
  document.body.append(h('div', { id: 'update-banner', class: 'panel' },
    h('span', {}, `vibeboard wurde auf Version ${version} aktualisiert.`),
    h('button', { class: 'btn small primary', onclick: () => location.reload() }, 'Neu laden')));
}

// Benachrichtigung öffnen: im selben Board ohne Neuladen zum Kommentar springen
export function openNotification(n) {
  bell.markRead({ ids: [n.id] });
  if (n.boardId === app.boardId && n.elementId) {
    if (location.hash === '#el=' + n.elementId) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = 'el=' + n.elementId;
  } else if (n.boardId) location.href = `/board/${encodeURIComponent(n.boardId)}${n.elementId ? '#el=' + encodeURIComponent(n.elementId) : ''}`;
}

app.on('readNotifications', (body) => bell.markRead(body));
app.on('openNotification', openNotification);

export function initCollab() {
  const hadView = initCore();
  const s = app.sync;
  let first = true;
  s.on('hello', (msg) => {
    // Rechte haben sich geändert (z. B. Rolle angepasst) – Oberfläche neu aufbauen
    if (msg.role && msg.role !== app.role) return location.reload();
    app.serverOffset = msg.serverTime - Date.now();
    if (first) app.lastVisit = msg.lastVisit || null;
    // Nach einem Update des Servers: Hinweis zum Neuladen (neue Oberfläche, evtl. geänderte Schnittstellen)
    if (msg.version) {
      if (app.serverVersion && app.serverVersion !== msg.version) showUpdateBanner(msg.version);
      app.serverVersion = app.serverVersion || msg.version;
    }
    loadElements(msg.board.elements);
    // Eigene, noch nicht bestätigte Änderungen wieder anwenden – sie werden gleich (erneut) gesendet
    for (const op of app.sync.pendingOps()) {
      const srv = op.op === 'upsert' && getEl(op.el.id);
      if (srv && srv.hidden) continue;
      applyRemoteOp(srv && srv.priv ? { ...op, el: { ...op.el, priv: srv.priv, privName: srv.privName } } : op);
    }
    if (app.editing && !getEl(app.editing.id)) abortEdit();
    app.name = msg.board.name;
    app.session = msg.board.session || { timer: null, voting: null };
    app.peers.clear();
    cursorEls.forEach((c) => c.remove());
    cursorEls.clear();
    for (const p of msg.peers) app.peers.set(p.clientId, { ...p });
    app.loaded = true;
    app.emit('session', 'all');
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
      else if (op.op === 'tpatch' || op.op === 'tstruct') applyRemoteTableOp(op);
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
      } else if (op.op === 'privateMode' || op.op === 'estimation' || op.op === 'moderation') {
        app.session[op.op] = op[op.op];
        app.emit('session', op.op);
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
    // Neu Hinzukommende kennen den eigenen Zustand noch nicht
    if (document.hidden) s.signal('presence', { away: true });
    if (app.editing) s.signal('editing', app.editing.id);
    if (app.sel.size) s.signal('sel', [...app.sel].slice(0, 200));
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
    // Signale kommen ungeprüft von anderen Teilnehmenden – nur gültige Werte übernehmen
    const d = msg.data;
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    const isPoint = (v) => v && num(v.x) && num(v.y);
    const isRect = (v) => isPoint(v) && num(v.w) && num(v.h) && v.w > 0 && v.h > 0;
    if ((msg.kind === 'cursor' && !isPoint(d)) || ((msg.kind === 'view' || msg.kind === 'summon' || msg.kind === 'lead') && !isRect(msg.kind === 'view' ? d : d && d.rect))) return;
    switch (msg.kind) {
      case 'cursor':
        p.cursor = { x: d.x, y: d.y };
        p.lastMove = Date.now();
        updateCursor(p);
        break;
      case 'view':
        p.view = msg.data;
        if (app.following === msg.from) applyFollowView(msg.data);
        break;
      case 'sel':
        p.sel = Array.isArray(d) ? d.filter((x) => typeof x === 'string').slice(0, 200) : [];
        scheduleRender(true);
        break;
      case 'laser':
        if (Array.isArray(d)) for (const pt of d.slice(0, 200)) if (isPoint(pt)) addLaser(msg.from, p.color, pt);
        break;
      case 'reaction':
        if (d && typeof d.emoji === 'string') showReaction(d.emoji.slice(0, 8), p.name);
        break;
      case 'summon':
        fitTo(d.rect, { pad: 0, maxZ: 8 });
        toast(`${p.name} hat alle zu sich geholt`);
        break;
      case 'lead':
        p.view = d.rect;
        follow(msg.from);
        toast(`${p.name} moderiert – du folgst der Ansicht. Eigenes Verschieben beendet das Folgen.`, 4000);
        break;
      case 'chat':
        p.chat = { text: d && typeof d.text === 'string' ? d.text.slice(0, 120) : '', t: Date.now() };
        p.lastMove = Date.now();
        updateCursor(p);
        break;
      case 'presence':
        p.away = !!(d && d.away === true);
        updateCursor(p);
        app.emit('peers');
        scheduleRender(true);
        break;
      case 'editing':
        p.editing = typeof d === 'string' ? d.slice(0, 64) : null;
        scheduleRender(true);
        break;
    }
  });
  s.on('reload', (msg) => {
    s.close();
    if (msg.reason === 'disabled') location.href = '/login';
    else location.reload();
  });
  s.on('deleted', () => {
    alert('Dieses Board wurde gelöscht.');
    location.href = '/';
  });
  s.on('error', (err) => toast(err, 5000));
  s.on('blocked', (why) => app.emit('blocked', why));
  s.on('recordings', () => app.emit('recordingsChanged'));
  // Benachrichtigung in Echtzeit (z. B. @Erwähnung): Glocke aktualisieren, Hinweis mit Sprung zum Kommentar
  s.on('notify', (msg) => bell.push(msg.item, { onOpen: openNotification }));
  let checking = false;
  // Vom Server abgelehnte Uploads (Virenscan/Dateityp) auch lokal entfernen
  s.on('rejected', (list) => {
    for (const r of list) applyRemoteOp({ op: 'delete', id: r.id });
    toast(list[0].reason, 7000);
  });
  // Privater Modus: Server hat neue eigene Elemente als privat markiert – nur das Kennzeichen übernehmen
  // Vom Server abgelehnte Änderungen (z. B. an fremden privaten Elementen) rückgängig machen
  s.on('revert', (list) => list.forEach((op) => applyRemoteOp(op)));
  s.on('marks', (list) => {
    for (const m of list) {
      const el = getEl(m.id);
      if (el) applyRemoteOp({ op: 'upsert', el: { ...el, priv: m.priv, privName: m.privName } });
    }
  });
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
