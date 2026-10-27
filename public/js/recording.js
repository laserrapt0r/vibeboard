// Geführte Aufzeichnungen: Ansicht, Mauszeiger und Laserpointer als Zeitspur aufnehmen, optional mit Ton,
// und später abspielen – das Board bleibt dabei bedienbar
import { h, api, ICONS, toast, modal, relTime, confirmDialog, throttle } from './util.js';
import { app, $, stage, toWorld, toScreen, visibleRect, viewFor, applyView } from './core.js';
import { menu, currentSidePanel, renderSidePanel, showSidePanel } from './ui.js';
import { addLaser } from './collab.js';

const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const enabled = () => app.features && app.features.recordings !== false;
const canRecord = () => enabled() && app.canComment;

/* ================================================================== */
/* Aufnehmen                                                           */
/* ================================================================== */

let rec = null;

function pickMime() {
  if (!window.MediaRecorder) return null;
  return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || null;
}

function openRecordDialog() {
  if (rec) return;
  const title = h('input', { type: 'text', maxlength: 120, placeholder: 'z. B. Rundgang durch die Architektur', value: '' });
  const mic = h('input', { type: 'checkbox', checked: !!pickMime() && !!navigator.mediaDevices, disabled: !pickMime() || !navigator.mediaDevices });
  const max = (app.features && app.features.recordingMaxMinutes) || 10;
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    m.close();
    start(title.value.trim() || 'Rundgang', mic.checked);
  } },
  h('p', { class: 'muted' }, `Aufgezeichnet werden deine Ansicht, dein Mauszeiger und der Laserpointer – höchstens ${max} Minuten. Andere können den Rundgang später abspielen und dabei selbst im Board navigieren.`),
  h('label', {}, 'Titel', title),
  h('label', { class: 'check' }, mic, 'Mit Ton aufnehmen (Mikrofon)'),
  h('p', { class: 'muted small' }, 'Mit Ton wird deine Stimme zusammen mit der Aufzeichnung gespeichert, bis du oder die Besitzerin bzw. der Besitzer des Boards sie löschen. Alle mit Zugriff auf das Board können sie abspielen.'),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, h('span', { html: ICONS.record }), 'Aufnahme starten')));
  const m = modal('Rundgang aufzeichnen', form);
  setTimeout(() => title.focus(), 0);
}

async function start(title, withMic) {
  let stream = null, recorder = null, chunks = [];
  const mime = pickMime();
  if (withMic && mime) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.start(1000);
    } catch {
      toast('Kein Zugriff auf das Mikrofon – es wird ohne Ton aufgezeichnet', 5000);
      stream = null;
      recorder = null;
    }
  }
  const t0 = performance.now();
  const max = ((app.features && app.features.recordingMaxMinutes) || 10) * 60000;
  const track = [];
  const t = () => Math.round(performance.now() - t0);
  const pushView = () => {
    const r = visibleRect();
    track.push({ t: t(), k: 'v', x: r.x, y: r.y, w: r.w, h: r.h });
  };
  pushView();
  const onView = throttle(pushView, 80);
  const onMove = throttle((e) => {
    const w = toWorld(e.clientX, e.clientY);
    track.push({ t: t(), k: 'c', x: Math.round(w.x), y: Math.round(w.y) });
  }, 40);
  const onLeave = () => track.push({ t: t(), k: 'h' });
  const onLaser = (p) => track.push({ t: t(), k: 'l', x: Math.round(p.x), y: Math.round(p.y) });
  app.on('view', onView);
  app.on('laser', onLaser);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);
  const bar = h('div', { id: 'rec-bar', class: 'panel' },
    h('span', { class: 'rec-dot' }), h('b', {}, 'Aufnahme'), h('span', { class: 'rec-time' }, '0:00'), h('span', { class: 'muted small' }, `/ ${fmt(max)}`),
    stream ? h('span', { class: 'rec-mic', html: ICONS.mic, title: 'Mit Ton' }) : null,
    h('button', { class: 'btn small primary', onclick: () => stop(true) }, 'Beenden & speichern'),
    h('button', { class: 'btn small', onclick: async () => {
      if (await confirmDialog('Aufnahme verwerfen', 'Die bisherige Aufnahme wird nicht gespeichert.', 'Verwerfen', true)) stop(false);
    } }, 'Verwerfen'));
  document.body.append(bar);
  const tick = setInterval(() => {
    bar.querySelector('.rec-time').textContent = fmt(t());
    if (t() >= max) stop(true);
  }, 250);
  rec = { title, track, t };

  async function stop(save) {
    if (!rec) return;
    const duration = t();
    rec = null;
    clearInterval(tick);
    bar.remove();
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerleave', onLeave);
    app.off('view', onView);
    app.off('laser', onLaser);
    let audio = null;
    if (recorder) {
      await new Promise((res) => {
        recorder.onstop = res;
        recorder.stop();
      });
      stream.getTracks().forEach((x) => x.stop());
      if (save && chunks.length) {
        const blob = new Blob(chunks, { type: recorder.mimeType.split(';')[0] });
        audio = await new Promise((res) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(blob);
        });
      }
    }
    if (!save) return toast('Aufnahme verworfen');
    if (duration < 1500) return toast('Die Aufnahme war zu kurz und wurde nicht gespeichert');
    try {
      await api(`/api/boards/${app.boardId}/recordings`, { method: 'POST', body: { title, durationMs: duration, track, audio } });
      toast('Rundgang gespeichert – alle mit Zugriff können ihn unter „Aufzeichnungen“ abspielen', 5000);
      list = null;
      showSidePanel('recordings');
    } catch (e) {
      toast('Speichern fehlgeschlagen: ' + e.message, 6000);
    }
  }
}

/* ================================================================== */
/* Liste                                                               */
/* ================================================================== */

let list = null;

async function loadList() {
  try {
    list = (await api(`/api/boards/${app.boardId}/recordings`)).recordings;
  } catch (e) {
    list = [];
    toast(e.message);
  }
}

async function renderPanel(side, close) {
  side.append(h('div', { class: 'side-head' }, h('h3', {}, 'Aufzeichnungen'), h('span', { class: 'spacer' }), close));
  if (canRecord()) side.append(h('div', { class: 'side-actions' }, h('button', { class: 'btn small primary', onclick: openRecordDialog }, h('span', { html: ICONS.record }), 'Rundgang aufzeichnen')));
  if (!list) {
    await loadList();
    if (currentSidePanel() === 'recordings') renderSidePanel();
    return;
  }
  if (!list.length) {
    side.append(h('p', { class: 'muted pad' }, 'Noch keine Aufzeichnungen. Ein Rundgang erklärt das Board ohne Termin: Ansicht, Zeiger und Laserpointer werden aufgenommen – auf Wunsch mit deiner Stimme.'));
    return;
  }
  for (const r of list) {
    const mine = r.byId === String(app.user.id);
    side.append(h('div', { class: 'rec-item' },
      h('button', { class: 'icon-btn', title: 'Abspielen', html: ICONS.play, onclick: () => play(r.id) }),
      h('div', { class: 'rec-main' }, h('b', {}, r.title), h('span', { class: 'muted small' }, `${r.by} · ${fmt(r.durationMs)}${r.hasAudio ? ' · mit Ton' : ''} · ${relTime(r.createdAt)}`)),
      mine || app.role === 'owner' ? h('button', { class: 'icon-btn small', title: 'Löschen', html: ICONS.trash, onclick: async () => {
        if (!(await confirmDialog('Aufzeichnung löschen', `„${r.title}“ wird für alle gelöscht.`, 'Löschen', true))) return;
        try {
          await api(`/api/boards/${app.boardId}/recordings/${r.id}`, { method: 'DELETE' });
          list = null;
          renderSidePanel();
        } catch (e) {
          toast(e.message);
        }
      } }) : null));
  }
}

app.on('renderPanel', (kind, side, close) => {
  if (kind === 'recordings') renderPanel(side, close);
});
app.on('recordingsChanged', () => {
  list = null;
  if (currentSidePanel() === 'recordings') renderSidePanel();
});

/* ================================================================== */
/* Abspielen                                                           */
/* ================================================================== */

let player = null;

async function play(id) {
  stopPlayer();
  let data;
  try {
    data = await api(`/api/boards/${app.boardId}/recordings/${id}`);
  } catch (e) {
    return toast(e.message);
  }
  let audio = null;
  if (data.hasAudio) {
    try {
      const r = await fetch(`/api/boards/${app.boardId}/recordings/${id}/audio`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error();
      audio = new Audio(URL.createObjectURL(await r.blob()));
    } catch {
      toast('Die Tonspur konnte nicht geladen werden – Wiedergabe ohne Ton', 4000);
    }
  }
  const cursor = h('div', { class: 'peer-cursor rec-cursor hidden' },
    h('span', { class: 'peer-arrow', html: '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M1 1l6 15 2-6 6-2z" fill="#e8590c" stroke="#fff" stroke-width="1.2"/></svg>' }),
    h('span', { class: 'peer-name', style: { background: '#e8590c' } }, '▶ ' + data.by));
  $('#cursors').append(cursor);
  const range = h('input', { type: 'range', min: 0, max: data.durationMs, value: 0, step: 100 });
  const time = h('span', { class: 'rec-time' }, `0:00 / ${fmt(data.durationMs)}`);
  const pp = h('button', { class: 'icon-btn', title: 'Pause', html: ICONS.pause });
  const followBtn = h('button', { class: 'btn small active', title: 'Der Ansicht der Aufzeichnung folgen' }, 'Ansicht folgen');
  const bar = h('div', { id: 'play-bar', class: 'panel' }, pp, h('b', { class: 'play-title' }, data.title), range, time, followBtn,
    h('button', { class: 'icon-btn', title: 'Schließen', html: ICONS.close, onclick: stopPlayer }));
  document.body.append(bar);
  player = { data, audio, cursor, bar, playing: true, follow: true, base: performance.now(), offset: 0, idx: 0, lastT: 0, raf: 0, applying: false };
  const now = () => (audio && !audio.paused ? audio.currentTime * 1000 : player.playing ? player.offset + performance.now() - player.base : player.offset);
  const setPlaying = (on) => {
    player.offset = now();
    player.base = performance.now();
    player.playing = on;
    if (audio) on ? audio.play().catch(() => {}) : audio.pause();
    pp.innerHTML = on ? ICONS.pause : ICONS.play;
    pp.title = on ? 'Pause' : 'Abspielen';
  };
  const setFollow = (on) => {
    player.follow = on;
    followBtn.classList.toggle('active', on);
    followBtn.textContent = on ? 'Ansicht folgen' : 'Wieder folgen';
  };
  pp.onclick = () => {
    if (!player.playing && now() >= data.durationMs) seek(0);
    setPlaying(!player.playing);
  };
  followBtn.onclick = () => {
    setFollow(!player.follow);
    if (player.follow) applyState(now(), true);
  };
  const seek = (ms) => {
    player.offset = ms;
    player.base = performance.now();
    if (audio) audio.currentTime = ms / 1000;
    applyState(ms, true);
  };
  range.oninput = () => seek(Number(range.value));
  // Eigenes Verschieben oder Zoomen beendet das Folgen (wie beim Folgen einer Person)
  player.onView = () => {
    if (player && !player.applying && player.follow) setFollow(false);
  };
  app.on('view', player.onView);

  function applyState(ms, jump) {
    const tr = data.track;
    let view = null, cur = null;
    for (const e of tr) {
      if (e.t > ms) break;
      if (e.k === 'v') view = e;
      else if (e.k === 'c' || e.k === 'l') cur = e;
      else if (e.k === 'h') cur = null;
    }
    if (view && player.follow) {
      player.applying = true;
      app.view = viewFor({ x: view.x, y: view.y, w: view.w, h: view.h }, 0, 8);
      applyView(true);
      player.applying = false;
    }
    // Laserspur seit dem letzten Bild
    if (!jump) for (const e of tr) if (e.k === 'l' && e.t > player.lastT && e.t <= ms) addLaser('rec', '#e8590c', e);
    player.lastT = ms;
    cursor.classList.toggle('hidden', !cur);
    if (cur) {
      const s = toScreen(cur.x, cur.y);
      cursor.style.transform = `translate(${s.x}px, ${s.y}px)`;
    }
  }

  const loop = () => {
    if (!player) return;
    const ms = Math.min(now(), data.durationMs);
    applyState(ms, false);
    range.value = ms;
    time.textContent = `${fmt(ms)} / ${fmt(data.durationMs)}`;
    if (ms >= data.durationMs && player.playing && (!audio || audio.ended || audio.paused)) setPlaying(false);
    player.raf = requestAnimationFrame(loop);
  };
  setPlaying(true);
  applyState(0, true);
  player.raf = requestAnimationFrame(loop);
}

function stopPlayer() {
  if (!player) return;
  cancelAnimationFrame(player.raf);
  if (player.audio) {
    player.audio.pause();
    URL.revokeObjectURL(player.audio.src);
  }
  player.cursor.remove();
  player.bar.remove();
  app.off('view', player.onView);
  player = null;
}

app.on('key', (e) => {
  if (e.key === 'Escape' && player && !app.editing) stopPlayer();
});

/* ================================================================== */
/* Schaltfläche in der Kopfzeile                                        */
/* ================================================================== */

app.on('buildCollabTools', (box) => {
  if (!enabled()) return;
  const b = h('button', { class: 'icon-btn', id: 'btn-recordings', title: 'Aufzeichnungen (Rundgänge)', html: ICONS.record });
  b.onclick = () => menu(b, [
    { header: 'Rundgänge' },
    canRecord() ? { label: 'Neuen Rundgang aufzeichnen …', icon: 'record', onClick: openRecordDialog } : null,
    { label: 'Aufzeichnungen ansehen', icon: 'play', onClick: () => showSidePanel('recordings') },
  ]);
  box.append(b);
});
