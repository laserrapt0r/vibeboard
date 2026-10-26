// Vorlagen für Softwareentwicklung, Projektmanagement und IT-Service-Management
import { B, C, LIGHT, dayOffset, columnsTemplate, quadrantTemplate } from './template-kit.js';
import { textToElements } from './diagram-parse.js';
import { uid } from './util.js';

/* ---------------- Bausteine ---------------- */

// Rasterförmig angeordnete Themenblöcke mit Überschrift und Hinweistext
function blocks(b, x, y, w, items, { cols = 3, h = 300, gap = 24 } = {}) {
  const bw = (w - gap * (cols - 1)) / cols;
  items.forEach((it, i) => {
    const bx = x + (i % cols) * (bw + gap), by = y + Math.floor(i / cols) * (h + gap);
    b.block(bx, by, bw, h, it.title, it.hint, it.fill || '#ffffff');
    (it.stickies || []).forEach((t, k) => b.sticky(bx + 16 + (k % 2) * 165, by + 100 + Math.floor(k / 2) * 165, t, it.sticky || C.yellow, 150, 150));
  });
  return y + Math.ceil(items.length / cols) * (h + gap) - gap;
}

// Kanban-Spalten mit Kopf und optionalen Karten
function lanes(b, x, y, cols, { colW = 320, colH = 820, gap = 20 } = {}) {
  cols.forEach((c, i) => {
    const cx = x + i * (colW + gap);
    b.zone(cx, y, colW, colH, c.light || LIGHT.grey);
    b.shape(cx, y, colW, 64, { shape: 'roundrect', fill: c.color, stroke: 'none', strokeWidth: 0, text: c.title, fontSize: 20, bold: true, locked: true, textColor: c.textColor });
    if (c.hint) b.text(cx + 14, y + 74, colW - 28, c.hint, 13, { color: '#6b6b6b' });
    (c.cards || []).forEach((cd, k) => b.card(cx + 10, y + (c.hint ? 120 : 84) + k * 175, cd.title, { w: colW - 20, h: 160, ...cd, title: cd.title }));
  });
  return x + cols.length * (colW + gap) - gap;
}

function shift(els, dx, dy) {
  return els.map((e) => (e.type === 'connector'
    ? { ...e, from: e.from.id ? e.from : { ...e.from, x: e.from.x + dx, y: e.from.y + dy }, to: e.to.id ? e.to : { ...e.to, x: e.to.x + dx, y: e.to.y + dy } }
    : { ...e, x: e.x + dx, y: e.y + dy }));
}

function bboxOf(els) {
  const r = els.filter((e) => e.type !== 'connector');
  const x1 = Math.min(...r.map((e) => e.x)), y1 = Math.min(...r.map((e) => e.y));
  return { x: x1, y: y1, w: Math.max(...r.map((e) => e.x + e.w)) - x1, h: Math.max(...r.map((e) => e.y + e.h)) - y1 };
}

// Diagramm aus Text in eine Vorlage einbetten
function addDiagram(b, text, x, y) {
  const els = textToElements(text);
  const bb = bboxOf(els);
  // IDs beibehalten (Verbindungen verweisen darauf) – daher nicht über b.add()
  for (const e of shift(els, x - bb.x, y - bb.y)) b.els.push({ ...e, z: ++b.z });
  return { w: bb.w, h: bb.h };
}

// Höhe eines Code-Blocks passend zur Zeilenzahl (Kopf 30, Innenabstand 2×12, Zeilenhöhe 1,25)
const codeH = (text, fs = 14) => 30 + 24 + text.split('\n').length * fs * 1.25;

const SEV = { 1: '#e03131', 2: '#f08c00', 3: '#fab005', 4: '#12b886' };

/* ================================================================== */
/* Softwareentwicklung                                                 */
/* ================================================================== */

export const TECH_TEMPLATES = [
  {
    id: 'sprint-planning', name: 'Sprint-Planung', category: 'Softwareentwicklung', icon: '🏃',
    description: 'Sprintziel, Kapazität, Backlog-Auswahl mit Story Points und Risiken.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2160, 1320, 'Sprint-Planung');
      b.heading(60, 40, 'Sprint-Planung', `Sprint … · ${dayOffset(1)} bis ${dayOffset(14)}`, 1400);
      b.shape(60, 180, 980, 150, { shape: 'roundrect', fill: '#4262ff', stroke: 'none', strokeWidth: 0, text: '🎯 Sprintziel: …', textColor: '#ffffff', fontSize: 26, bold: true, align: 'left' });
      b.text(1080, 180, 400, 'Kapazität', 22, { bold: true });
      b.table(1080, 224, 1020, 210, [['Person', 'Verfügbare Tage', 'Kapazität (SP)', 'Notizen'], ['', '', '', ''], ['', '', '', ''], ['Summe', '', '', '']]);
      lanes(b, 60, 470, [
        { title: '📚 Product Backlog', color: '#e9ecef', light: LIGHT.grey, hint: 'Nach Priorität sortiert. Ganz oben: Kandidaten für diesen Sprint.',
          cards: [{ title: 'User Story A', points: '5', priority: 'high', key: 'VB-101' }, { title: 'User Story B', points: '3', priority: 'medium', key: 'VB-102' }, { title: 'Bug C', points: '2', priority: 'critical', key: 'VB-103', color: '#e03131' }] },
        { title: '✅ Sprint Backlog', color: '#d3f9d8', light: LIGHT.green, hint: 'Ziehe Karten hierher, bis die Kapazität erreicht ist. Mit 🃏 schätzen.' },
        { title: '⚠️ Risiken & Abhängigkeiten', color: '#ffe3e3', light: LIGHT.red, hint: 'Was könnte das Sprintziel gefährden?' },
        { title: '❓ Offene Fragen', color: '#fff3bf', light: LIGHT.yellow, hint: 'Klärungsbedarf mit Product Owner oder Stakeholdern.' },
      ], { colW: 495, colH: 790 });
      return b.els;
    },
  },
  {
    id: 'dev-kanban', name: 'Entwicklungs-Kanban mit WIP-Limits', category: 'Softwareentwicklung', icon: '🧑‍💻',
    description: 'Durchlauf von Backlog bis Fertig mit Review, Test und WIP-Limits.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2180, 1120, 'Entwicklungs-Kanban');
      b.heading(60, 40, 'Entwicklungs-Kanban', 'WIP-Limit = maximale Anzahl Karten pro Spalte · Erst fertig machen, dann neu anfangen', 1600);
      lanes(b, 60, 180, [
        { title: 'Backlog', color: '#e9ecef', cards: [{ title: 'Feature: Export als CSV', points: '5', tags: ['Feature'] }, { title: 'Login-Fehler bei SSO', priority: 'high', tags: ['Bug'], color: '#e03131' }] },
        { title: 'Bereit', color: '#d0ebff', hint: 'Definition of Ready erfüllt' },
        { title: 'In Arbeit · WIP 3', color: '#fff3bf', cards: [{ title: 'API-Endpunkt /reports', assignee: 'Alex', points: '3', status: 'In Arbeit' }] },
        { title: 'Review · WIP 2', color: '#e5dbff', hint: 'Code-Review, Pair-Review' },
        { title: 'Test', color: '#ffe8cc' },
        { title: 'Fertig', color: '#d3f9d8', hint: 'Definition of Done erfüllt' },
      ], { colW: 330, colH: 880 });
      return b.els;
    },
  },
  {
    id: 'dor-dod', name: 'Definition of Ready & Done', category: 'Softwareentwicklung', icon: '☑️',
    description: 'Gemeinsame Kriterien, wann eine Story startklar und wann sie fertig ist.',
    build: () => columnsTemplate('Definition of Ready & Done', 'Gemeinsam vereinbaren · sichtbar halten · regelmäßig überprüfen', [
      { title: 'Definition of Ready', emoji: '🚦', color: '#d0ebff', light: LIGHT.blue, sticky: C.blue, hint: 'z. B. Nutzen beschrieben · Akzeptanzkriterien vorhanden · geschätzt · Abhängigkeiten geklärt · passt in einen Sprint' },
      { title: 'Definition of Done', emoji: '✅', color: '#d3f9d8', light: LIGHT.green, sticky: C.green, hint: 'z. B. Code reviewt · Tests grün · Doku aktualisiert · Akzeptanzkriterien erfüllt · ausgeliefert auf Staging' },
      { title: 'Offene Punkte', emoji: '💬', color: '#fff3bf', light: LIGHT.yellow, hint: 'Was wollen wir ergänzen oder streichen?' },
    ], { colW: 560, colH: 720, stickies: 4 }),
  },
  {
    id: 'c4-context', name: 'Architektur (C4-Kontext)', category: 'Softwareentwicklung', icon: '🏛️',
    description: 'Systemkontext: Nutzer, eigenes System, Nachbarsysteme und Datenflüsse.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1900, 1220, 'Systemkontext');
      b.heading(60, 40, 'Systemkontext (C4 – Ebene 1)', 'Wer nutzt das System, mit welchen Systemen spricht es?', 1400);
      const user = b.shape(160, 230, 140, 200, { shape: 'actor', fill: '#ffffff', text: 'Kundin / Kunde', fontSize: 16, bold: true });
      const admin = b.shape(160, 760, 140, 200, { shape: 'actor', fill: '#ffffff', text: 'Support', fontSize: 16, bold: true });
      const sys = b.shape(700, 450, 440, 260, { shape: 'roundrect', fill: '#1168bd', stroke: '#0b4884', text: 'Unser System\n\n[Software-System]\nBeschreibung der Hauptaufgabe', textColor: '#ffffff', fontSize: 18 });
      const mail = b.shape(1420, 220, 360, 200, { shape: 'roundrect', fill: '#999999', stroke: '#6b6b6b', text: 'E-Mail-System\n[extern]', textColor: '#ffffff', fontSize: 17 });
      const pay = b.shape(1420, 480, 360, 200, { shape: 'roundrect', fill: '#999999', stroke: '#6b6b6b', text: 'Zahlungsanbieter\n[extern]', textColor: '#ffffff', fontSize: 17 });
      const db = b.shape(1420, 760, 360, 220, { shape: 'cylinder', fill: '#e6fcf5', stroke: '#12b886', text: 'Altsystem / ERP\n[extern]', fontSize: 17 });
      b.conn(user, sys, { label: 'nutzt (HTTPS)', routing: 'curve' });
      b.conn(admin, sys, { label: 'verwaltet', routing: 'curve' });
      b.conn(sys, mail, { label: 'sendet E-Mails (SMTP)', fromSide: 'top', toSide: 'left' });
      b.conn(sys, pay, { label: 'Zahlungen (REST)', fromSide: 'right', toSide: 'left' });
      b.conn(sys, db, { label: 'liest Stammdaten', dash: true, fromSide: 'bottom', toSide: 'left' });
      b.shape(60, 1040, 760, 130, { shape: 'roundrect', fill: '#f8f9fa', stroke: '#ced4da', strokeWidth: 1, align: 'left', fontSize: 14, locked: true,
        text: 'Legende: 🧍 Person · blau = eigenes System · grau = externes System · Pfeile = Beziehung mit Zweck und Protokoll' });
      return b.els;
    },
  },
  {
    id: 'sequence', name: 'Sequenzdiagramm', category: 'Softwareentwicklung', icon: '🔁',
    description: 'Ablauf zwischen Akteuren und Systemen – erzeugt aus Text, frei bearbeitbar.',
    build: () => {
      const b = new B();
      const d = addDiagram(b, `sequenceDiagram
  autonumber
  actor U as Nutzer
  participant F as Frontend
  participant A as API
  participant D as Datenbank
  U->>F: Formular absenden
  F->>A: POST /bestellungen
  A->>D: INSERT bestellung
  D-->>A: OK
  A-->>F: 201 Created
  F-->>U: Bestätigung anzeigen`, 80, 220);
      const f = b.frame(0, 0, d.w + 160, d.h + 300, 'Sequenzdiagramm');
      b.els.splice(b.els.indexOf(f), 1);
      b.els.unshift(f);
      b.heading(60, 40, 'Sequenzdiagramm', 'Tipp: Über „Diagramm aus Text“ lassen sich eigene Abläufe in Sekunden erzeugen.', d.w);
      return b.els;
    },
  },
  {
    id: 'erd', name: 'ER-Diagramm', category: 'Softwareentwicklung', icon: '🗄️',
    description: 'Datenmodell mit Tabellen, Spalten, Schlüsseln und Beziehungen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1880, 1060, 'ER-Diagramm');
      b.heading(60, 40, 'Datenmodell', 'Entitäten · Attribute · Beziehungen (PK = Primärschlüssel, FK = Fremdschlüssel)', 1400);
      // Kopf und Spaltentabelle gruppiert; Verbindungen setzen am Kopf (oben) bzw. an der Tabelle (seitlich/unten) an
      const ent = (x, y, name, rows) => {
        const groupId = uid();
        const head = b.shape(x, y, 420, 50, { shape: 'rect', fill: '#4262ff', stroke: '#4262ff', text: name, textColor: '#ffffff', fontSize: 18, bold: true, groupId });
        const table = b.table(x, y + 50, 420, 44 * (rows.length + 1), [['Spalte', 'Typ', 'Schlüssel'], ...rows], { fontSize: 14, groupId });
        table.head = head;
        return table;
      };
      const kunde = ent(60, 200, 'kunde', [['id', 'bigint', 'PK'], ['name', 'text', ''], ['email', 'text', 'unique'], ['erstellt_am', 'timestamptz', '']]);
      const best = ent(720, 200, 'bestellung', [['id', 'bigint', 'PK'], ['kunde_id', 'bigint', 'FK → kunde'], ['status', 'text', ''], ['summe', 'numeric', '']]);
      const pos = ent(720, 620, 'position', [['id', 'bigint', 'PK'], ['bestellung_id', 'bigint', 'FK → bestellung'], ['artikel_id', 'bigint', 'FK → artikel'], ['menge', 'int', '']]);
      const art = ent(1380, 620, 'artikel', [['id', 'bigint', 'PK'], ['bezeichnung', 'text', ''], ['preis', 'numeric', '']]);
      b.conn(kunde, best, { label: '1 : n', routing: 'elbow', arrowEnd: true });
      b.conn(best, pos.head, { label: '1 : n', routing: 'elbow', arrowEnd: true, fromSide: 'bottom', toSide: 'top' });
      delete kunde.head; delete best.head; delete pos.head; delete art.head;
      b.conn(art, pos, { label: '1 : n', routing: 'elbow', arrowEnd: true });
      return b.els;
    },
  },
  {
    id: 'event-storming', name: 'Event Storming', category: 'Softwareentwicklung', icon: '⚡',
    description: 'Fachliche Abläufe mit Domain Events, Commands, Aggregaten und Hotspots entdecken.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2400, 1180, 'Event Storming');
      b.heading(60, 40, 'Event Storming', 'Zeitstrahl von links nach rechts · zuerst Events sammeln, dann ordnen und anreichern', 1600);
      const legend = [['Domain Event', '#ff9d48', 'Etwas ist passiert (Vergangenheit)'], ['Command', '#a6ccf5', 'Auslöser / Absicht'], ['Aggregat', '#fff9b1', 'Hält Regeln & Zustand'],
        ['Policy', '#c9b2e8', '„Immer wenn … dann …“'], ['Read Model', '#93d275', 'Informationen für Entscheidungen'], ['Externes System', '#ffcee0', 'Fremdsystem'], ['Hotspot', '#f99fb1', 'Problem / offene Frage'], ['Akteur', '#fffbe0', 'Person / Rolle']];
      legend.forEach(([t, c, hint], i) => {
        b.sticky(60 + i * 285, 180, t, c, 120, 120);
        b.text(190 + i * 285, 200, 140, hint, 13, { color: '#555' });
      });
      b.line(60, 420, 2340, 420, { arrowEnd: true, strokeWidth: 3, stroke: '#868e96' });
      b.text(2160, 380, 200, 'Zeit →', 16, { bold: true, color: '#868e96' });
      const flow = [['Kunde registriert', '#ff9d48'], ['Warenkorb gefüllt', '#ff9d48'], ['Bestellung aufgegeben', '#ff9d48'], ['Zahlung eingegangen', '#ff9d48'], ['Ware versendet', '#ff9d48']];
      flow.forEach(([t, c], i) => {
        b.sticky(120 + i * 440, 460, t, c, 180, 180);
        b.sticky(120 + i * 440, 680, i === 2 ? 'Bestellung aufgeben' : '', '#a6ccf5', 180, 180);
      });
      b.sticky(1880, 900, 'Was passiert bei Teillieferung?', '#f99fb1', 200, 160);
      return b.els;
    },
  },
  {
    id: 'bug-triage', name: 'Bug-Triage', category: 'Softwareentwicklung', icon: '🐞',
    description: 'Fehler nach Schwere und Häufigkeit einordnen und priorisieren.',
    build: () => quadrantTemplate('Bug-Triage', 'Jeden neuen Fehler einordnen · oben rechts zuerst', [
      { title: 'Planen', emoji: '🗓️', color: '#ffd8a8', light: LIGHT.orange, hint: 'Schwer, aber selten – in den nächsten Sprint', sticky: C.orange },
      { title: 'Sofort beheben', emoji: '🚨', color: '#ffc9c9', light: LIGHT.red, hint: 'Schwer und häufig – Hotfix', sticky: C.red },
      { title: 'Backlog', emoji: '📥', color: '#e9ecef', light: LIGHT.grey, hint: 'Leicht und selten – bei Gelegenheit', sticky: C.grey },
      { title: 'Schnell erledigen', emoji: '⚡', color: '#fff3bf', light: LIGHT.yellow, hint: 'Leicht, aber häufig – Quick Win', sticky: C.yellow },
    ], { xAxis: 'Häufigkeit / Anzahl Betroffene →', yAxis: 'Schwere ↑' }),
  },
  {
    id: 'tech-debt', name: 'Tech-Debt-Matrix', category: 'Softwareentwicklung', icon: '🧱',
    description: 'Technische Schulden nach Nutzen und Aufwand bewerten.',
    build: () => quadrantTemplate('Technische Schulden', 'Welche Schulden zahlen wir zuerst zurück?', [
      { title: 'Sofort angehen', emoji: '✅', color: '#d3f9d8', light: LIGHT.green, hint: 'Hoher Nutzen, wenig Aufwand', sticky: C.green },
      { title: 'Große Vorhaben', emoji: '🏗️', color: '#d0ebff', light: LIGHT.blue, hint: 'Hoher Nutzen, hoher Aufwand – einplanen', sticky: C.blue },
      { title: 'Nebenbei', emoji: '🧹', color: '#fff3bf', light: LIGHT.yellow, hint: 'Wenig Nutzen, wenig Aufwand – Pfadfinderregel', sticky: C.yellow },
      { title: 'Hinterfragen', emoji: '🤔', color: '#ffe3e3', light: LIGHT.red, hint: 'Wenig Nutzen, viel Aufwand', sticky: C.red },
    ], { xAxis: 'Aufwand →', yAxis: 'Nutzen / Risiko ↑' }),
  },
  {
    id: 'release-plan', name: 'Release-Planung', category: 'Softwareentwicklung', icon: '🚀',
    description: 'Funktionen auf Releases verteilen, mit Terminen und Abhängigkeiten.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2040, 1160, 'Release-Planung');
      b.heading(60, 40, 'Release-Planung', 'Was kommt wann? Abhängigkeiten als Pfeile verbinden.', 1400);
      const rel = [['Release 1.0', dayOffset(30), '#4262ff'], ['Release 1.1', dayOffset(60), '#7048e8'], ['Release 2.0', dayOffset(120), '#e64980']];
      const firsts = [];
      rel.forEach(([t, d, c], i) => {
        const x = 60 + i * 660;
        b.shape(x, 180, 620, 90, { shape: 'roundrect', fill: c, stroke: 'none', strokeWidth: 0, text: `${t}  ·  📅 ${new Date(d + 'T00:00').toLocaleDateString('de-DE')}`, textColor: '#fff', fontSize: 22, bold: true, locked: true });
        b.zone(x, 290, 620, 820, LIGHT.grey);
        const c1 = b.card(x + 20, 310, i === 0 ? 'Anmeldung & Konten' : i === 1 ? 'Benachrichtigungen' : 'Mandantenfähigkeit', { w: 580, color: c, points: i === 2 ? '13' : '8' });
        b.card(x + 20, 470, 'Weitere Funktion', { w: 580, color: c });
        firsts.push(c1);
      });
      b.conn(firsts[0], firsts[1], { stroke: '#e03131', dash: true, label: 'benötigt' });
      return b.els;
    },
  },
  {
    id: 'api-design', name: 'API-Design', category: 'Softwareentwicklung', icon: '🔌',
    description: 'Endpunkte, Datenformate und offene Fragen einer Schnittstelle abstimmen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2000, 1180, 'API-Design');
      b.heading(60, 40, 'API-Design', 'Ressource: /bestellungen · Version: v1', 1400);
      b.table(60, 190, 1100, 360, [['Methode', 'Pfad', 'Beschreibung', 'Rechte'], ['GET', '/bestellungen', 'Liste (paginiert)', 'lesen'], ['POST', '/bestellungen', 'Neue Bestellung', 'schreiben'],
        ['GET', '/bestellungen/{id}', 'Einzelne Bestellung', 'lesen'], ['PATCH', '/bestellungen/{id}', 'Status ändern', 'schreiben'], ['DELETE', '/bestellungen/{id}', 'Stornieren', 'admin']], { fontSize: 15 });
      const json = '{\n  "id": 4711,\n  "status": "offen",\n  "kunde": { "id": 12, "name": "Muster GmbH" },\n  "positionen": [\n    { "artikel": 1, "menge": 2 }\n  ],\n  "summe": 99.90\n}';
      b.add({ type: 'code', x: 1200, y: 190, w: 740, h: codeH(json), lang: 'json', theme: 'dark', fontSize: 14, title: 'Beispiel-Antwort', text: json });
      b.text(60, 600, 500, 'Offene Fragen', 22, { bold: true });
      ['Pagination per Cursor oder Seite?', 'Fehlerformat (RFC 9457)?', 'Rate-Limits?'].forEach((t, i) => b.sticky(60 + i * 190, 650, t, C.pink, 170, 170));
      b.text(700, 640, 500, 'Entscheidungen', 22, { bold: true });
      b.sticky(700, 690, 'JSON, camelCase', C.green, 170, 170);
      return b.els;
    },
  },
  {
    id: 'adr', name: 'Architekturentscheidung (ADR)', category: 'Softwareentwicklung', icon: '📐',
    description: 'Eine Architekturentscheidung mit Kontext, Optionen und Konsequenzen festhalten.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 1220, 'ADR');
      b.heading(60, 40, 'ADR-001: …', 'Status: vorgeschlagen · Datum: ' + new Date().toLocaleDateString('de-DE') + ' · Beteiligte: …', 1400);
      blocks(b, 60, 190, 1680, [
        { title: '1. Kontext', hint: 'Welches Problem lösen wir? Welche Rahmenbedingungen gelten?' },
        { title: '2. Optionen', hint: 'Welche Alternativen wurden betrachtet? Vor- und Nachteile.', sticky: C.blue, stickies: ['Option A', 'Option B'] },
        { title: '3. Entscheidung', hint: 'Wofür haben wir uns entschieden – und warum?', fill: '#f4fbef' },
        { title: '4. Konsequenzen', hint: 'Was wird einfacher, was schwieriger? Folgearbeiten?' },
        { title: '5. Risiken', hint: 'Was beobachten wir?', sticky: C.red },
        { title: '6. Status & Nachverfolgung', hint: 'vorgeschlagen · akzeptiert · abgelöst durch …' },
      ], { cols: 3, h: 470 });
      return b.els;
    },
  },

  /* ================================================================== */
  /* Projektmanagement                                                   */
  /* ================================================================== */

  {
    id: 'kickoff', name: 'Projekt-Kick-off', category: 'Projektmanagement', icon: '🎬',
    description: 'Ziele, Umfang, Rollen, Zeitplan und Spielregeln zum Projektstart.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2040, 1260, 'Projekt-Kick-off');
      b.heading(60, 40, 'Projekt-Kick-off', 'Projekt: … · Auftraggeber: … · Start: ' + new Date().toLocaleDateString('de-DE'), 1600);
      blocks(b, 60, 190, 1920, [
        { title: '🎯 Ziele & Nutzen', hint: 'Woran erkennen wir Erfolg? (messbar)' },
        { title: '📦 Umfang', hint: 'Was gehört dazu – und ausdrücklich nicht?', sticky: C.green, stickies: ['Im Umfang', 'Nicht im Umfang'] },
        { title: '👥 Team & Rollen', hint: 'Wer entscheidet, wer arbeitet mit, wer wird informiert?' },
        { title: '🗓️ Zeitplan & Meilensteine', hint: 'Wichtige Termine und Abhängigkeiten' },
        { title: '💬 Zusammenarbeit', hint: 'Meetings, Kanäle, Ablage, Entscheidungswege' },
        { title: '⚠️ Risiken & Annahmen', hint: 'Was könnte schiefgehen? Wovon gehen wir aus?', sticky: C.red },
      ], { cols: 3, h: 500 });
      return b.els;
    },
  },
  {
    id: 'risk-matrix', name: 'Risikomatrix', category: 'Projektmanagement', icon: '🎲',
    description: 'Risiken nach Eintrittswahrscheinlichkeit und Auswirkung bewerten.',
    build: () => {
      const b = new B();
      const X = 200, Y = 200, s = 160;
      b.frame(0, 0, X + s * 5 + 760, Y + s * 5 + 160, 'Risikomatrix');
      b.heading(60, 40, 'Risikomatrix', 'Risiken als Notizen in die passende Zelle ziehen', 1400);
      const col = (p, i) => (p * i >= 15 ? '#ffc9c9' : p * i >= 8 ? '#ffe8cc' : p * i >= 4 ? '#fff3bf' : '#d3f9d8');
      for (let p = 5; p >= 1; p--) {
        for (let i = 1; i <= 5; i++) b.shape(X + (i - 1) * s, Y + (5 - p) * s, s, s, { fill: col(p, i), stroke: '#ffffff', strokeWidth: 3, locked: true, text: String(p * i), textColor: '#adb5bd', fontSize: 14, align: 'right', valign: 'top' });
        b.text(X - 60, Y + (5 - p) * s + s / 2 - 14, 50, String(p), 20, { bold: true, align: 'center' });
      }
      for (let i = 1; i <= 5; i++) b.text(X + (i - 1) * s, Y + 5 * s + 10, s, String(i), 20, { bold: true, align: 'center' });
      b.text(X, Y + 5 * s + 50, s * 5, 'Auswirkung →', 18, { bold: true, align: 'center', color: '#444' });
      b.text(40, Y - 50, 260, 'Wahrscheinlichkeit ↑', 18, { bold: true, color: '#444' });
      b.sticky(X + 3 * s + 10, Y + s + 10, 'Schlüsselperson fällt aus', C.red, 140, 140);
      b.text(X + s * 5 + 60, Y, 600, 'Risikoliste', 22, { bold: true });
      b.table(X + s * 5 + 60, Y + 44, 640, 400, [['Risiko', 'W', 'A', 'Maßnahme', 'Verantwortlich'], ['', '', '', '', ''], ['', '', '', '', ''], ['', '', '', '', ''], ['', '', '', '', '']], { fontSize: 13 });
      return b.els;
    },
  },
  {
    id: 'raid', name: 'RAID-Log', category: 'Projektmanagement', icon: '📋',
    description: 'Risiken, Annahmen, Probleme und Abhängigkeiten an einem Ort.',
    build: () => columnsTemplate('RAID-Log', 'Regelmäßig im Projektmeeting durchgehen · Verantwortliche und Termine auf Karten pflegen', [
      { title: 'Risiken', emoji: '⚠️', color: '#ffc9c9', light: LIGHT.red, hint: 'Was könnte eintreten?', sticky: C.red },
      { title: 'Annahmen', emoji: '💭', color: '#d0ebff', light: LIGHT.blue, hint: 'Wovon gehen wir aus?', sticky: C.blue },
      { title: 'Probleme', emoji: '🔥', color: '#ffd8a8', light: LIGHT.orange, hint: 'Was ist bereits eingetreten?', sticky: C.orange },
      { title: 'Abhängigkeiten', emoji: '🔗', color: '#e5dbff', light: LIGHT.violet, hint: 'Worauf warten wir – wer wartet auf uns?', sticky: C.violet },
    ], { stickies: 2 }),
  },
  {
    id: 'status-report', name: 'Projektstatus', category: 'Projektmanagement', icon: '🚦',
    description: 'Ampelstatus für Zeit, Budget, Umfang und Qualität mit nächsten Schritten.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1900, 1180, 'Projektstatus');
      b.heading(60, 40, 'Projektstatus', 'Berichtszeitraum: … · Gesamtstatus: 🟢 / 🟡 / 🔴', 1400);
      [['Zeit', '#40c057'], ['Budget', '#fab005'], ['Umfang', '#40c057'], ['Qualität', '#40c057']].forEach(([t, c], i) => {
        const x = 60 + i * 450;
        b.shape(x, 190, 420, 150, { shape: 'roundrect', fill: '#ffffff', stroke: '#dee2e6', strokeWidth: 1, text: '', locked: true });
        b.shape(x + 24, 220, 90, 90, { shape: 'ellipse', fill: c, stroke: 'none', strokeWidth: 0 });
        b.text(x + 140, 230, 260, t, 26, { bold: true });
        b.text(x + 140, 272, 260, 'Kurzkommentar …', 15, { color: '#6b6b6b' });
      });
      blocks(b, 60, 380, 1780, [
        { title: '✅ Erreicht', hint: 'Seit dem letzten Bericht', sticky: C.green },
        { title: '➡️ Nächste Schritte', hint: 'Bis zum nächsten Bericht', sticky: C.blue },
        { title: '⚠️ Risiken & Probleme', hint: 'Mit Gegenmaßnahmen', sticky: C.red },
        { title: '🗳️ Entscheidungsbedarf', hint: 'Was muss der Lenkungskreis entscheiden?', sticky: C.violet },
      ], { cols: 4, h: 740 });
      return b.els;
    },
  },
  {
    id: 'milestones', name: 'Meilensteinplan', category: 'Projektmanagement', icon: '🏁',
    description: 'Projektphasen und Meilensteine auf einer Zeitachse.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2200, 900, 'Meilensteinplan');
      b.heading(60, 40, 'Meilensteinplan', 'Phasen als Balken, Meilensteine als Rauten', 1400);
      b.line(80, 470, 2120, 470, { strokeWidth: 4, arrowEnd: true, stroke: '#495057' });
      const phases = [['Initiierung', 0, 300, '#d0ebff'], ['Konzeption', 300, 700, '#e5dbff'], ['Umsetzung', 700, 1500, '#fff3bf'], ['Einführung', 1500, 1960, '#d3f9d8']];
      phases.forEach(([t, a, e, c]) => b.shape(100 + a, 520, e - a - 10, 70, { shape: 'roundrect', fill: c, stroke: 'none', strokeWidth: 0, text: t, fontSize: 18, bold: true }));
      const ms = [['Projektauftrag', 0, 0], ['Konzept abgenommen', 300, 30], ['Go-Live', 1500, 100], ['Projektabschluss', 1960, 140]];
      ms.forEach(([t, x, d]) => {
        b.shape(70 + x, 440, 60, 60, { shape: 'diamond', fill: '#e8590c', stroke: '#ffffff', strokeWidth: 2 });
        b.text(20 + x, 300, 220, `${t}\n📅 ${new Date(dayOffset(d) + 'T00:00').toLocaleDateString('de-DE')}`, 16, { bold: true, align: 'center' });
      });
      return b.els;
    },
  },
  {
    id: 'raci', name: 'RACI-Matrix', category: 'Projektmanagement', icon: '🧩',
    description: 'Verantwortlichkeiten klären: Responsible, Accountable, Consulted, Informed.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 1000, 'RACI-Matrix');
      b.heading(60, 40, 'RACI-Matrix', 'R = führt durch · A = verantwortet (genau eine Person) · C = wird gefragt · I = wird informiert', 1600);
      b.table(60, 190, 1680, 560, [['Aufgabe / Ergebnis', 'Projektleitung', 'Fachbereich', 'Entwicklung', 'Betrieb', 'Datenschutz'],
        ['Anforderungen erheben', 'A', 'R', 'C', 'C', 'I'], ['Architektur festlegen', 'A', 'I', 'R', 'C', 'C'], ['Umsetzung', 'A', 'C', 'R', 'I', 'I'],
        ['Abnahme', 'R', 'A', 'C', 'C', 'I'], ['Betriebsübergabe', 'A', 'I', 'C', 'R', 'I'], ['Datenschutz-Folgenabschätzung', 'C', 'C', 'C', 'I', 'A']], { fontSize: 16 });
      [['R', 'Responsible', '#4262ff'], ['A', 'Accountable', '#e03131'], ['C', 'Consulted', '#f59f00'], ['I', 'Informed', '#868e96']].forEach(([k, t, c], i) => {
        b.shape(60 + i * 300, 800, 60, 60, { shape: 'ellipse', fill: c, stroke: 'none', strokeWidth: 0, text: k, textColor: '#fff', bold: true, fontSize: 22 });
        b.text(130 + i * 300, 815, 200, t, 18);
      });
      return b.els;
    },
  },
  {
    id: 'team-planning', name: 'Teamübergreifende Planung', category: 'Projektmanagement', icon: '🗺️',
    description: 'Teams × Iterationen mit Features, Meilensteinen und Abhängigkeiten.',
    build: () => {
      const b = new B();
      const its = ['Iteration 1', 'Iteration 2', 'Iteration 3', 'Iteration 4', 'Puffer'], teams = ['Meilensteine', 'Team Alpha', 'Team Beta', 'Team Gamma'];
      const X = 260, Y = 190, cw = 360, rh = 220;
      b.frame(0, 0, X + cw * its.length + 60, Y + 70 + rh * teams.length + 60, 'Teamübergreifende Planung');
      b.heading(60, 40, 'Teamübergreifende Planung', 'Features als Karten · Abhängigkeiten als rote Pfeile · Ziele je Team festhalten', 1600);
      its.forEach((t, i) => b.shape(X + i * cw, Y, cw - 6, 60, { shape: 'roundrect', fill: '#212529', stroke: 'none', strokeWidth: 0, text: t, textColor: '#fff', bold: true, fontSize: 18, locked: true }));
      const cells = [];
      teams.forEach((t, r) => {
        const y = Y + 70 + r * rh;
        b.shape(60, y, X - 80, rh - 6, { shape: 'roundrect', fill: r ? '#eef1ff' : '#fff4e6', stroke: 'none', strokeWidth: 0, text: t, bold: true, fontSize: 18, locked: true });
        its.forEach((_, i) => cells.push(b.zone(X + i * cw, y, cw - 6, rh - 6, LIGHT.grey)));
      });
      b.shape(X + 2 * cw + 140, Y + 70 + 60, 70, 70, { shape: 'diamond', fill: '#e8590c', stroke: 'none', strokeWidth: 0 });
      b.text(X + 2 * cw + 40, Y + 70 + 140, 280, 'Release Demo', 14, { bold: true, align: 'center' });
      const f1 = b.sticky(X + 20, Y + 70 + rh + 30, 'Feature: Login', C.blue, 150, 150);
      const f2 = b.sticky(X + cw + 20, Y + 70 + rh * 2 + 30, 'Feature: Profil', C.blue, 150, 150);
      b.sticky(X + cw + 190, Y + 70 + rh + 30, 'Feature: Suche', C.blue, 150, 150);
      b.conn(f1, f2, { stroke: '#e03131', strokeWidth: 3, label: 'Abhängigkeit' });
      return b.els;
    },
  },
  {
    id: 'lessons-learned', name: 'Lessons Learned', category: 'Projektmanagement', icon: '🎓',
    description: 'Erfahrungen aus einem Projekt sichern und in Maßnahmen übersetzen.',
    build: () => columnsTemplate('Lessons Learned', 'Projekt: … · Was nehmen wir für künftige Projekte mit?', [
      { title: 'Was lief gut?', emoji: '👍', color: '#d3f9d8', light: LIGHT.green, sticky: C.green },
      { title: 'Was lief nicht gut?', emoji: '👎', color: '#ffc9c9', light: LIGHT.red, sticky: C.red },
      { title: 'Was haben wir gelernt?', emoji: '💡', color: '#fff3bf', light: LIGHT.yellow, sticky: C.yellow },
      { title: 'Empfehlungen & Maßnahmen', emoji: '➡️', color: '#d0ebff', light: LIGHT.blue, sticky: C.blue },
    ], { stickies: 2 }),
  },

  /* ================================================================== */
  /* IT-Service-Management                                               */
  /* ================================================================== */

  {
    id: 'postmortem', name: 'Incident-Postmortem', category: 'IT-Service-Management', icon: '🧯',
    description: 'Schuldfreie Nachbetrachtung: Ablauf, Ursache, Auswirkung und Maßnahmen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2160, 1540, 'Incident-Postmortem');
      b.heading(60, 40, 'Incident-Postmortem', 'Blameless: Wir suchen Ursachen in Systemen und Abläufen, nicht bei Personen.', 1600);
      b.table(60, 190, 980, 300, [['Feld', 'Wert'], ['Incident-ID', 'INC-…'], ['Schweregrad', 'SEV 1 / 2 / 3'], ['Beginn – Ende', '… – … (Dauer …)'], ['Betroffene Services', '…'], ['Incident Manager', '…']], { fontSize: 15 });
      b.block(1080, 190, 1020, 300, '📉 Auswirkung', 'Wer war betroffen, wie stark, wie lange? Kennzahlen, SLA-Verletzungen, Kundenkontakte.');
      b.text(60, 530, 600, '⏱️ Zeitleiste', 24, { bold: true });
      b.line(60, 650, 2100, 650, { strokeWidth: 3, arrowEnd: true, stroke: '#868e96' });
      [['Erkannt', '09:12', SEV[1]], ['Eskaliert', '09:20', SEV[2]], ['Ursache gefunden', '10:05', SEV[3]], ['Behoben', '10:40', SEV[4]], ['Kommunikation abgeschlossen', '11:00', '#4262ff']].forEach(([t, time, c], i) => {
        b.shape(80 + i * 400, 630, 40, 40, { shape: 'ellipse', fill: c, stroke: '#ffffff', strokeWidth: 3 });
        b.card(40 + i * 400, 690, `${time} · ${t}`, { w: 340, h: 110, color: c });
      });
      blocks(b, 60, 850, 2040, [
        { title: '🔍 Ursachen (5 Warum)', hint: 'Warum? → Warum? → … bis zur systemischen Ursache', sticky: C.orange, stickies: ['Warum 1', 'Warum 2'] },
        { title: '👍 Was lief gut?', hint: 'Erkennung, Zusammenarbeit, Werkzeuge', sticky: C.green },
        { title: '👎 Was lief schlecht?', hint: 'Wo haben wir Zeit verloren?', sticky: C.red },
        { title: '🍀 Wo hatten wir Glück?', hint: 'Was hätte schlimmer kommen können?', sticky: C.yellow },
      ], { cols: 4, h: 370 });
      b.text(60, 1260, 600, '✅ Maßnahmen', 24, { bold: true });
      ['Monitoring-Alarm für … ergänzen', 'Runbook aktualisieren', 'Automatischen Failover testen'].forEach((t, i) => b.card(60 + i * 340, 1310, t, { w: 320, h: 150, assignee: '', due: dayOffset(14), status: 'Offen', priority: i ? 'medium' : 'high', color: '#4262ff' }));
      return b.els;
    },
  },
  {
    id: 'major-incident', name: 'Major-Incident-Lagezentrum', category: 'IT-Service-Management', icon: '🚨',
    description: 'Lagebild, Rollen, Hypothesen und Kommunikation während einer schweren Störung.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2160, 1300, 'Major Incident');
      b.heading(60, 40, '🚨 Major Incident: …', 'Start: … · Schweregrad: SEV 1 · Nächstes Status-Update: … (Timer starten!)', 1700);
      b.shape(60, 180, 2040, 110, { shape: 'roundrect', fill: '#e03131', stroke: 'none', strokeWidth: 0, textColor: '#ffffff', fontSize: 22, bold: true, align: 'left', text: 'Lagebild: Was funktioniert nicht? Wer ist betroffen? Seit wann?' });
      b.table(60, 320, 640, 330, [['Rolle', 'Person'], ['Incident Manager', ''], ['Technische Leitung', ''], ['Kommunikation', ''], ['Protokoll', ''], ['Service Owner', '']], { fontSize: 15 });
      blocks(b, 740, 320, 1360, [
        { title: '🧪 Hypothesen', hint: 'Vermutung → Test → Ergebnis', sticky: C.violet, stickies: ['Hypothese A', 'Hypothese B'] },
        { title: '🛠️ Laufende Maßnahmen', hint: 'Wer macht gerade was? (Karten mit Zuständigkeit)', sticky: C.blue },
      ], { cols: 2, h: 330 });
      blocks(b, 60, 690, 2040, [
        { title: '⏱️ Zeitleiste', hint: 'Uhrzeit · Ereignis · Entscheidung', sticky: C.grey },
        { title: '📣 Kommunikation', hint: 'Status-Updates an Nutzer, Management, Kunden (mit Uhrzeit)', sticky: C.yellow },
        { title: '🔁 Workaround & Wiederherstellung', hint: 'Übergangslösung, Rollback, Failover', sticky: C.green },
      ], { cols: 3, h: 560 });
      return b.els;
    },
  },
  {
    id: 'problem-analysis', name: 'Problem-Analyse (Ist / Ist nicht)', category: 'IT-Service-Management', icon: '🔬',
    description: 'Ursachen eines wiederkehrenden Problems systematisch eingrenzen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2000, 1260, 'Problem-Analyse');
      b.heading(60, 40, 'Problem-Analyse', 'Problem-ID: PRB-… · Verknüpfte Incidents: …', 1600);
      b.table(60, 190, 1880, 480, [['Frage', 'Ist (beobachtet)', 'Ist nicht (könnte, ist aber nicht)', 'Besonderheit / Unterschied', 'Änderung (seit wann?)'],
        ['Was? (Objekt, Fehler)', '', '', '', ''], ['Wo? (Standort, System, Komponente)', '', '', '', ''], ['Wann? (zuerst, Muster, Zeitpunkt)', '', '', '', ''], ['Ausmaß? (wie viele, wie stark, Trend)', '', '', '', '']], { fontSize: 14 });
      blocks(b, 60, 710, 1880, [
        { title: '🔍 Mögliche Ursachen', hint: 'Erklärt die Ursache alle Ist- und Ist-nicht-Beobachtungen?', sticky: C.orange, stickies: ['Ursache 1', 'Ursache 2'] },
        { title: '🩹 Workaround', hint: 'Übergangslösung für den Service Desk', sticky: C.green },
        { title: '📚 Known Error / Lösung', hint: 'Eintrag für die Wissensdatenbank (KEDB) · Change für die dauerhafte Lösung', sticky: C.blue },
      ], { cols: 3, h: 480 });
      return b.els;
    },
  },
  {
    id: 'change-cab', name: 'Change-Request & CAB', category: 'IT-Service-Management', icon: '🔄',
    description: 'Changes beantragen, bewerten und im Change Advisory Board freigeben.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2260, 1360, 'Change Management');
      b.heading(60, 40, 'Change Management', 'Standard-Changes sind vorab genehmigt · Normale Changes ins CAB · Notfall-Changes ins ECAB', 1800);
      b.table(60, 190, 760, 620, [['Feld', 'Angabe'], ['Change-ID', 'CHG-…'], ['Typ', 'Standard / Normal / Notfall'], ['Beschreibung', ''], ['Begründung', ''], ['Betroffene CIs / Services', ''],
        ['Risiko & Auswirkung', 'niedrig / mittel / hoch'], ['Umsetzungsplan', ''], ['Rückfallplan (Rollback)', ''], ['Zeitfenster', ''], ['Genehmigt durch', '']], { fontSize: 14 });
      lanes(b, 860, 190, [
        { title: 'Beantragt', color: '#e9ecef', cards: [{ title: 'Datenbank-Update auf PostgreSQL 16.4', key: 'CHG-1042', priority: 'medium', due: dayOffset(7), tags: ['Normal'] }] },
        { title: 'Bewertung / CAB', color: '#d0ebff', cards: [{ title: 'Firewall-Regel für Partner-VPN', key: 'CHG-1039', priority: 'high', tags: ['Normal'] }] },
        { title: 'Genehmigt', color: '#d3f9d8' },
        { title: 'Umgesetzt', color: '#e5dbff' },
        { title: 'Abgelehnt', color: '#ffc9c9' },
      ], { colW: 260, colH: 1120 });
      return b.els;
    },
  },
  {
    id: 'service-blueprint', name: 'Service Blueprint', category: 'IT-Service-Management', icon: '🧭',
    description: 'Kundenschritte, sichtbare und unsichtbare Abläufe sowie unterstützende Systeme.',
    build: () => {
      const b = new B();
      const steps = ['Problem bemerken', 'Ticket melden', 'Rückfrage', 'Lösung erhalten', 'Bewerten'];
      const rows = [['Physische Belege', '#f1f3f5', C.grey], ['Kundenaktionen', '#fff4e6', C.orange], ['Frontstage (sichtbar)', '#e7f5ff', C.blue], ['Backstage (unsichtbar)', '#f3f0ff', C.violet], ['Unterstützende Prozesse & Systeme', '#ebfbee', C.green]];
      const X = 320, Y = 260, cw = 330, rh = 200;
      b.frame(0, 0, X + cw * steps.length + 60, Y + rh * rows.length + 80, 'Service Blueprint');
      b.heading(60, 40, 'Service Blueprint', 'Service: IT-Support · Persona: …', 1400);
      steps.forEach((s, i) => b.shape(X + i * cw, 180, cw - 10, 60, { shape: 'pill', fill: '#212529', stroke: 'none', strokeWidth: 0, text: `${i + 1}. ${s}`, textColor: '#fff', bold: true, fontSize: 16, locked: true }));
      rows.forEach(([t, bg, st], r) => {
        const y = Y + r * rh;
        b.zone(60, y, X - 80 + cw * steps.length, rh - 10, bg);
        b.text(76, y + 16, X - 110, t, 17, { bold: true });
        steps.forEach((_, i) => r > 0 && r < 4 && i < 3 && b.sticky(X + i * cw + 10, y + 20, '', st, 150, 150));
      });
      const lines = [['Interaktionslinie', Y + rh * 2 - 5], ['Sichtbarkeitslinie', Y + rh * 3 - 5], ['Interne Interaktionslinie', Y + rh * 4 - 5]];
      lines.forEach(([t, y]) => {
        b.line(60, y, X + cw * steps.length - 20, y, { dash: true, stroke: '#495057' });
        b.text(X + cw * steps.length - 300, y - 26, 280, t, 13, { italic: true, color: '#495057', align: 'right' });
      });
      return b.els;
    },
  },
  {
    id: 'sipoc', name: 'SIPOC', category: 'IT-Service-Management', icon: '🔗',
    description: 'Prozessüberblick: Lieferanten, Eingaben, Prozess, Ergebnisse, Kunden.',
    build: () => columnsTemplate('SIPOC', 'Prozess: … · Start: … · Ende: …', [
      { title: 'Suppliers', emoji: '🏭', color: '#d0ebff', light: LIGHT.blue, hint: 'Wer liefert?', sticky: C.blue },
      { title: 'Inputs', emoji: '📥', color: '#e5dbff', light: LIGHT.violet, hint: 'Was wird benötigt?', sticky: C.violet },
      { title: 'Process', emoji: '⚙️', color: '#fff3bf', light: LIGHT.yellow, hint: '4–7 Hauptschritte', sticky: C.yellow },
      { title: 'Outputs', emoji: '📤', color: '#d3f9d8', light: LIGHT.green, hint: 'Was entsteht?', sticky: C.green },
      { title: 'Customers', emoji: '🙋', color: '#ffd8a8', light: LIGHT.orange, hint: 'Wer erhält das Ergebnis?', sticky: C.orange },
    ], { colW: 360, stickies: 2 }),
  },
  {
    id: 'value-stream', name: 'Wertstromanalyse', category: 'IT-Service-Management', icon: '🌊',
    description: 'Durchlaufzeit, Bearbeitungszeit und Wartezeiten eines Prozesses sichtbar machen.',
    build: () => {
      const b = new B();
      const steps = [['Anfrage', '10 min', '1 Tag'], ['Freigabe', '15 min', '3 Tage'], ['Bereitstellung', '2 h', '2 Tage'], ['Test', '1 h', '1 Tag'], ['Übergabe', '20 min', '–']];
      b.frame(0, 0, 2160, 1000, 'Wertstrom');
      b.heading(60, 40, 'Wertstromanalyse', 'Beispiel: Bereitstellung eines neuen Arbeitsplatzes · Wo entsteht Wartezeit?', 1700);
      let prev = null;
      steps.forEach(([t, pt, wt], i) => {
        const x = 60 + i * 420;
        const box = b.shape(x, 220, 320, 160, { shape: 'rect', fill: '#e7f5ff', stroke: '#1971c2', text: t, fontSize: 20, bold: true });
        b.table(x, 400, 320, 130, [['Bearbeitungszeit', pt], ['Fehlerquote', '… %']], { header: false, fontSize: 13 });
        if (prev) b.conn(prev, box, { routing: 'straight', strokeWidth: 3 });
        prev = box;
        if (wt !== '–') {
          b.shape(x + 330, 600, 80, 70, { shape: 'triangle', fill: '#ffe066', stroke: '#e67700', text: '', strokeWidth: 2 });
          b.text(x + 300, 680, 140, `⏳ ${wt}`, 15, { bold: true, align: 'center' });
        }
      });
      b.line(60, 780, 2080, 780, { strokeWidth: 2, stroke: '#495057' });
      b.text(60, 800, 1200, 'Durchlaufzeit gesamt: ca. 7 Tage · Bearbeitungszeit: ca. 3,75 h · Flusseffizienz: ≈ 2 %', 20, { bold: true });
      b.sticky(1700, 820, 'Wo können wir Wartezeit streichen?', C.pink, 200, 140);
      return b.els;
    },
  },
  {
    id: 'service-catalog', name: 'Service-Katalog', category: 'IT-Service-Management', icon: '🗂️',
    description: 'Services mit Verantwortlichen, Servicezeiten und SLA-Zielen im Überblick.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2040, 1100, 'Service-Katalog');
      b.heading(60, 40, 'Service-Katalog', 'Business-Services für Anwender · technische Services im Hintergrund', 1500);
      b.text(60, 180, 800, 'Business-Services', 24, { bold: true });
      [['E-Mail & Kalender', 'Mo–Fr 7–19 Uhr · 99,5 %'], ['Arbeitsplatz-Bereitstellung', '5 Arbeitstage'], ['Kollaborations-Plattform', '24/7 · 99,9 %'], ['Service Desk', 'Reaktion < 30 min']].forEach(([t, d], i) =>
        b.card(60 + i * 490, 230, t, { w: 460, h: 160, description: d, status: 'Live', assignee: 'Service Owner', tags: ['Business'], color: '#4262ff' }));
      b.text(60, 450, 800, 'Technische Services', 24, { bold: true });
      [['Identitäts- & Zugriffsverwaltung', 'Basis für alle Anmeldungen'], ['Netzwerk & VPN', 'Standorte und Homeoffice'], ['Datenbank-Plattform', 'PostgreSQL-Cluster'], ['Backup & Wiederherstellung', 'RPO 24 h · RTO 4 h']].forEach(([t, d], i) =>
        b.card(60 + i * 490, 500, t, { w: 460, h: 160, description: d, status: 'Live', tags: ['Technisch'], color: '#12b886' }));
      b.text(60, 720, 800, 'In Planung / Auslaufend', 24, { bold: true });
      b.card(60, 770, 'Self-Service-Portal', { w: 460, h: 150, status: 'Geplant', color: '#f59f00' });
      b.card(550, 770, 'Fax-Server', { w: 460, h: 150, status: 'Auslaufend', color: '#868e96' });
      return b.els;
    },
  },
  {
    id: 'oncall-handover', name: 'On-Call-Übergabe', category: 'IT-Service-Management', icon: '📟',
    description: 'Bereitschaftswechsel: offene Störungen, Beobachtungen, Changes und Kontakte.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1900, 1100, 'On-Call-Übergabe');
      b.heading(60, 40, 'On-Call-Übergabe', `Von: … · An: … · Zeitraum: ${new Date().toLocaleDateString('de-DE')} – …`, 1400);
      blocks(b, 60, 190, 1780, [
        { title: '🔴 Offene Incidents', hint: 'Status, nächste Schritte, Ansprechpartner', sticky: C.red },
        { title: '👀 Beobachten', hint: 'Auffälligkeiten ohne Störung (Last, Speicher, Zertifikate …)', sticky: C.yellow },
        { title: '🗓️ Geplante Changes', hint: 'Wartungsfenster in der Bereitschaft', sticky: C.blue },
        { title: '📚 Bekannte Probleme & Workarounds', hint: 'Mit Link auf Runbook', sticky: C.violet },
        { title: '☎️ Kontakte & Eskalation', hint: 'Wer ist erreichbar? Dienstleister-Hotlines', sticky: C.green },
        { title: '📝 Notizen', hint: 'Alles Weitere', sticky: C.grey },
      ], { cols: 3, h: 420 });
      return b.els;
    },
  },
  {
    id: 'runbook', name: 'Runbook / Störungsbehebung', category: 'IT-Service-Management', icon: '📖',
    description: 'Entscheidungsbaum zur Fehlerbehebung mit den passenden Befehlen.',
    build: () => {
      const b = new B();
      b.heading(60, 40, 'Runbook: Webanwendung nicht erreichbar', 'Schritt für Schritt – Befehle rechts kopieren', 1100);
      const d = addDiagram(b, `flowchart TD
  a([Alarm: Website down]) --> b{Server erreichbar?}
  b -->|nein| c[Hosting / Netzwerk prüfen]
  b -->|ja| d{Container läuft?}
  d -->|nein| e[Container neu starten]
  d -->|ja| f{Datenbank erreichbar?}
  f -->|nein| g[[DB-Runbook]]
  f -->|ja| h[Logs analysieren]
  e --> i([Funktion prüfen & dokumentieren])
  h --> i
  c --> i`, 60, 190);
      const cmds = '# Status der Container\ndocker compose ps\n\n# Logs der letzten 15 Minuten\ndocker compose logs --since 15m app\n\n# Neustart\ndocker compose restart app\n\n# Erreichbarkeit prüfen\ncurl -fsS https://example.org/healthz';
      b.add({ type: 'code', x: d.w + 140, y: 190, w: 680, h: codeH(cmds), lang: 'bash', theme: 'dark', fontSize: 14, title: 'Befehle', text: cmds });
      const f = b.frame(0, 0, d.w + 900, Math.max(d.h, 560) + 280, 'Runbook');
      b.els.splice(b.els.indexOf(f), 1);
      b.els.unshift(f);
      return b.els;
    },
  },
  {
    id: 'sla-review', name: 'SLA- / Service-Review', category: 'IT-Service-Management', icon: '📈',
    description: 'Servicequalität gegen vereinbarte Ziele prüfen und Maßnahmen ableiten.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2000, 1180, 'Service-Review');
      b.heading(60, 40, 'Service-Review', 'Zeitraum: … · Teilnehmende: Service Owner, Kunde, Betrieb', 1400);
      b.table(60, 190, 1880, 400, [['Service', 'Kennzahl', 'Ziel', 'Ist', 'Status', 'Kommentar'],
        ['E-Mail', 'Verfügbarkeit', '99,5 %', '99,8 %', '🟢', ''], ['Service Desk', 'Reaktionszeit P2', '< 4 h', '5,2 h', '🔴', 'Personalengpass'],
        ['Service Desk', 'Lösungsquote 1st Level', '70 %', '68 %', '🟡', ''], ['Plattform', 'Geplante Wartung angekündigt', '100 %', '100 %', '🟢', '']], { fontSize: 15 });
      blocks(b, 60, 630, 1880, [
        { title: '📊 Trends & Auffälligkeiten', hint: 'Was hat sich verändert?', sticky: C.blue },
        { title: '🙋 Feedback der Kunden', hint: 'Zufriedenheit, Beschwerden, Lob', sticky: C.yellow },
        { title: '✅ Maßnahmen', hint: 'Als Karten mit Zuständigkeit und Termin', sticky: C.green },
      ], { cols: 3, h: 480 });
      return b.els;
    },
  },
];
