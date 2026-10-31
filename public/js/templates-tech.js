// Vorlagen für Softwareentwicklung, Projektmanagement und IT-Service-Management
import { T, LOCALE } from './i18n.js';
import { B, C, LIGHT, dayOffset, columnsTemplate, quadrantTemplate } from './template-kit.js';
import { textToElements } from './diagram-parse.js';
import { columnName, uid } from './util.js';

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
function lanes(b, x, y, cols, { colW = 320, colH = 820, gap = 20, status = false } = {}) {
  cols.forEach((c, i) => {
    const cx = x + i * (colW + gap);
    b.zone(cx, y, colW, colH, c.light || LIGHT.grey, status ? { statusCol: true } : {});
    b.shape(cx, y, colW, 64, { shape: 'roundrect', fill: c.color, stroke: 'none', strokeWidth: 0, text: c.title, fontSize: 20, bold: true, locked: true, textColor: c.textColor });
    if (c.hint) b.text(cx + 14, y + 74, colW - 28, c.hint, 13, { color: '#6b6b6b' });
    (c.cards || []).forEach((cd, k) => b.card(cx + 10, y + (c.hint ? 120 : 84) + k * 175, cd.title, { w: colW - 20, h: 160, ...(status ? { status: columnName(c.title) } : {}), ...cd, title: cd.title }));
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
    id: 'sprint-planning', name: T('Sprint-Planung'), category: 'Softwareentwicklung', icon: '🏃',
    description: T('Sprintziel, Kapazität, Backlog-Auswahl mit Story Points und Risiken.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2160, 1320, T('Sprint-Planung'));
      b.heading(60, 40, T('Sprint-Planung'), T`Sprint … · ${dayOffset(1)} bis ${dayOffset(14)}`, 1400);
      b.shape(60, 180, 980, 150, { shape: 'roundrect', fill: '#4262ff', stroke: 'none', strokeWidth: 0, text: T('🎯 Sprintziel: …'), textColor: '#ffffff', fontSize: 26, bold: true, align: 'left' });
      b.text(1080, 180, 400, T('Kapazität'), 22, { bold: true });
      b.table(1080, 224, 1020, 210, [[T('Person'), T('Verfügbare Tage'), T('Kapazität (SP)'), T('Notizen')], ['', '', '', ''], ['', '', '', ''], [T('Summe'), '', '', '']]);
      lanes(b, 60, 470, [
        { title: T('📚 Product Backlog'), color: '#e9ecef', light: LIGHT.grey, hint: T('Nach Priorität sortiert. Ganz oben: Kandidaten für diesen Sprint.'),
          cards: [{ title: T('User Story A'), points: '5', priority: 'high', key: 'VB-101' }, { title: T('User Story B'), points: '3', priority: 'medium', key: 'VB-102' }, { title: T('Bug C'), points: '2', priority: 'critical', key: 'VB-103', color: '#e03131' }] },
        { title: T('✅ Sprint Backlog'), color: '#d3f9d8', light: LIGHT.green, hint: T('Ziehe Karten hierher, bis die Kapazität erreicht ist. Mit 🃏 schätzen.') },
        { title: T('⚠️ Risiken & Abhängigkeiten'), color: '#ffe3e3', light: LIGHT.red, hint: T('Was könnte das Sprintziel gefährden?') },
        { title: T('❓ Offene Fragen'), color: '#fff3bf', light: LIGHT.yellow, hint: T('Klärungsbedarf mit Product Owner oder Stakeholdern.') },
      ], { colW: 495, colH: 790 });
      return b.els;
    },
  },
  {
    id: 'dev-kanban', name: T('Entwicklungs-Kanban mit WIP-Limits'), category: 'Softwareentwicklung', icon: '🧑‍💻',
    description: T('Durchlauf von Backlog bis Fertig mit Review, Test und WIP-Limits.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2180, 1120, T('Entwicklungs-Kanban'));
      b.heading(60, 40, T('Entwicklungs-Kanban'), T('WIP-Limit = maximale Anzahl Karten pro Spalte · Erst fertig machen, dann neu anfangen'), 1600);
      lanes(b, 60, 180, [
        { title: T('Backlog'), color: '#e9ecef', cards: [{ title: T('Feature: Export als CSV'), points: '5', tags: [T('Feature')] }, { title: T('Login-Fehler bei SSO'), priority: 'high', tags: [T('Bug')], color: '#e03131' }] },
        { title: T('Bereit'), color: '#d0ebff', hint: T('Definition of Ready erfüllt') },
        { title: T('In Arbeit · WIP 3'), color: '#fff3bf', cards: [{ title: T('API-Endpunkt /reports'), assignee: T('Alex'), points: '3', status: T('In Arbeit') }] },
        { title: T('Review · WIP 2'), color: '#e5dbff', hint: T('Code-Review, Pair-Review') },
        { title: T('Test'), color: '#ffe8cc' },
        { title: T('Fertig'), color: '#d3f9d8', hint: T('Definition of Done erfüllt') },
      ], { status: true, colW: 330, colH: 880 });
      return b.els;
    },
  },
  {
    id: 'dor-dod', name: T('Definition of Ready & Done'), category: 'Softwareentwicklung', icon: '☑️',
    description: T('Gemeinsame Kriterien, wann eine Story startklar und wann sie fertig ist.'),
    build: () => columnsTemplate(T('Definition of Ready & Done'), T('Gemeinsam vereinbaren · sichtbar halten · regelmäßig überprüfen'), [
      { title: T('Definition of Ready'), emoji: '🚦', color: '#d0ebff', light: LIGHT.blue, sticky: C.blue, hint: T('z. B. Nutzen beschrieben · Akzeptanzkriterien vorhanden · geschätzt · Abhängigkeiten geklärt · passt in einen Sprint') },
      { title: T('Definition of Done'), emoji: '✅', color: '#d3f9d8', light: LIGHT.green, sticky: C.green, hint: T('z. B. Code reviewt · Tests grün · Doku aktualisiert · Akzeptanzkriterien erfüllt · ausgeliefert auf Staging') },
      { title: T('Offene Punkte'), emoji: '💬', color: '#fff3bf', light: LIGHT.yellow, hint: T('Was wollen wir ergänzen oder streichen?') },
    ], { colW: 560, colH: 720, stickies: 4 }),
  },
  {
    id: 'c4-context', name: T('Architektur (C4-Kontext)'), category: 'Softwareentwicklung', icon: '🏛️',
    description: T('Systemkontext: Nutzer, eigenes System, Nachbarsysteme und Datenflüsse.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1900, 1220, T('Systemkontext'));
      b.heading(60, 40, T('Systemkontext (C4 – Ebene 1)'), T('Wer nutzt das System, mit welchen Systemen spricht es?'), 1400);
      const user = b.shape(160, 230, 140, 200, { shape: 'actor', fill: '#ffffff', text: T('Kundin / Kunde'), fontSize: 16, bold: true });
      const admin = b.shape(160, 760, 140, 200, { shape: 'actor', fill: '#ffffff', text: T('Support'), fontSize: 16, bold: true });
      const sys = b.shape(700, 450, 440, 260, { shape: 'roundrect', fill: '#1168bd', stroke: '#0b4884', text: T('Unser System\n\n[Software-System]\nBeschreibung der Hauptaufgabe'), textColor: '#ffffff', fontSize: 18 });
      const mail = b.shape(1420, 220, 360, 200, { shape: 'roundrect', fill: '#999999', stroke: '#6b6b6b', text: T('E-Mail-System\n[extern]'), textColor: '#ffffff', fontSize: 17 });
      const pay = b.shape(1420, 480, 360, 200, { shape: 'roundrect', fill: '#999999', stroke: '#6b6b6b', text: T('Zahlungsanbieter\n[extern]'), textColor: '#ffffff', fontSize: 17 });
      const db = b.shape(1420, 760, 360, 220, { shape: 'cylinder', fill: '#e6fcf5', stroke: '#12b886', text: T('Altsystem / ERP\n[extern]'), fontSize: 17 });
      b.conn(user, sys, { label: T('nutzt (HTTPS)'), routing: 'curve' });
      b.conn(admin, sys, { label: 'verwaltet', routing: 'curve' });
      b.conn(sys, mail, { label: T('sendet E-Mails (SMTP)'), fromSide: 'top', toSide: 'left' });
      b.conn(sys, pay, { label: T('Zahlungen (REST)'), fromSide: 'right', toSide: 'left' });
      b.conn(sys, db, { label: T('liest Stammdaten'), dash: true, fromSide: 'bottom', toSide: 'left' });
      b.shape(60, 1040, 760, 130, { shape: 'roundrect', fill: '#f8f9fa', stroke: '#ced4da', strokeWidth: 1, align: 'left', fontSize: 14, locked: true,
        text: T('Legende: 🧍 Person · blau = eigenes System · grau = externes System · Pfeile = Beziehung mit Zweck und Protokoll') });
      return b.els;
    },
  },
  {
    id: 'sequence', name: T('Sequenzdiagramm'), category: 'UML', icon: '🔁',
    description: T('Ablauf zwischen Akteuren und Systemen – erzeugt aus Text, frei bearbeitbar.'),
    build: () => {
      const b = new B();
      const d = addDiagram(b, T`sequenceDiagram
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
      const f = b.frame(0, 0, d.w + 160, d.h + 300, T('Sequenzdiagramm'));
      b.els.splice(b.els.indexOf(f), 1);
      b.els.unshift(f);
      b.heading(60, 40, T('Sequenzdiagramm'), T('Tipp: Über „Diagramm aus Text“ lassen sich eigene Abläufe in Sekunden erzeugen.'), d.w);
      return b.els;
    },
  },
  {
    id: 'erd', name: T('ER-Diagramm'), category: 'Softwareentwicklung', icon: '🗄️',
    description: T('Datenmodell mit Tabellen, Spalten, Schlüsseln und Beziehungen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1880, 1060, T('ER-Diagramm'));
      b.heading(60, 40, T('Datenmodell'), T('Entitäten · Attribute · Beziehungen (PK = Primärschlüssel, FK = Fremdschlüssel)'), 1400);
      // Kopf und Spaltentabelle gruppiert; Verbindungen setzen am Kopf (oben) bzw. an der Tabelle (seitlich/unten) an
      const ent = (x, y, name, rows) => {
        const groupId = uid();
        const head = b.shape(x, y, 420, 50, { shape: 'rect', fill: '#4262ff', stroke: '#4262ff', text: name, textColor: '#ffffff', fontSize: 18, bold: true, groupId });
        const table = b.table(x, y + 50, 420, 44 * (rows.length + 1), [[T('Spalte'), T('Typ'), T('Schlüssel')], ...rows], { fontSize: 14, groupId });
        table.head = head;
        return table;
      };
      const kunde = ent(60, 200, 'kunde', [['id', 'bigint', T('PK')], ['name', 'text', ''], ['email', 'text', 'unique'], ['erstellt_am', 'timestamptz', '']]);
      const best = ent(720, 200, 'bestellung', [['id', 'bigint', T('PK')], ['kunde_id', 'bigint', T('FK → kunde')], ['status', 'text', ''], ['summe', 'numeric', '']]);
      const pos = ent(720, 620, 'position', [['id', 'bigint', T('PK')], ['bestellung_id', 'bigint', T('FK → bestellung')], ['artikel_id', 'bigint', T('FK → artikel')], ['menge', 'int', '']]);
      const art = ent(1380, 620, 'artikel', [['id', 'bigint', T('PK')], ['bezeichnung', 'text', ''], ['preis', 'numeric', '']]);
      b.conn(kunde, best, { label: '1 : n', routing: 'elbow', arrowEnd: true });
      b.conn(best, pos.head, { label: '1 : n', routing: 'elbow', arrowEnd: true, fromSide: 'bottom', toSide: 'top' });
      delete kunde.head; delete best.head; delete pos.head; delete art.head;
      b.conn(art, pos, { label: '1 : n', routing: 'elbow', arrowEnd: true });
      return b.els;
    },
  },
  {
    id: 'event-storming', name: T('Event Storming'), category: 'Softwareentwicklung', icon: '⚡',
    description: T('Fachliche Abläufe mit Domain Events, Commands, Aggregaten und Hotspots entdecken.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2400, 1180, T('Event Storming'));
      b.heading(60, 40, T('Event Storming'), T('Zeitstrahl von links nach rechts · zuerst Events sammeln, dann ordnen und anreichern'), 1600);
      const legend = [[T('Domain Event'), '#ff9d48', T('Etwas ist passiert (Vergangenheit)')], [T('Command'), '#a6ccf5', T('Auslöser / Absicht')], [T('Aggregat'), '#fff9b1', T('Hält Regeln & Zustand')],
        [T('Policy'), '#c9b2e8', T('„Immer wenn … dann …“')], [T('Read Model'), '#93d275', T('Informationen für Entscheidungen')], [T('Externes System'), '#ffcee0', T('Fremdsystem')], [T('Hotspot'), '#f99fb1', T('Problem / offene Frage')], [T('Akteur'), '#fffbe0', T('Person / Rolle')]];
      legend.forEach(([t, c, hint], i) => {
        b.sticky(60 + i * 285, 180, t, c, 120, 120);
        b.text(190 + i * 285, 200, 140, hint, 13, { color: '#555' });
      });
      b.line(60, 420, 2340, 420, { arrowEnd: true, strokeWidth: 3, stroke: '#868e96' });
      b.text(2160, 380, 200, T('Zeit →'), 16, { bold: true, color: '#868e96' });
      const flow = [[T('Kunde registriert'), '#ff9d48'], [T('Warenkorb gefüllt'), '#ff9d48'], [T('Bestellung aufgegeben'), '#ff9d48'], [T('Zahlung eingegangen'), '#ff9d48'], [T('Ware versendet'), '#ff9d48']];
      flow.forEach(([t, c], i) => {
        b.sticky(120 + i * 440, 460, t, c, 180, 180);
        b.sticky(120 + i * 440, 680, i === 2 ? T('Bestellung aufgeben') : '', '#a6ccf5', 180, 180);
      });
      b.sticky(1880, 900, T('Was passiert bei Teillieferung?'), '#f99fb1', 200, 160);
      return b.els;
    },
  },
  {
    id: 'bug-triage', name: T('Bug-Triage'), category: 'Softwareentwicklung', icon: '🐞',
    description: T('Fehler nach Schwere und Häufigkeit einordnen und priorisieren.'),
    build: () => quadrantTemplate(T('Bug-Triage'), T('Jeden neuen Fehler einordnen · oben rechts zuerst'), [
      { title: T('Planen'), emoji: '🗓️', color: '#ffd8a8', light: LIGHT.orange, hint: T('Schwer, aber selten – in den nächsten Sprint'), sticky: C.orange },
      { title: T('Sofort beheben'), emoji: '🚨', color: '#ffc9c9', light: LIGHT.red, hint: T('Schwer und häufig – Hotfix'), sticky: C.red },
      { title: T('Backlog'), emoji: '📥', color: '#e9ecef', light: LIGHT.grey, hint: T('Leicht und selten – bei Gelegenheit'), sticky: C.grey },
      { title: T('Schnell erledigen'), emoji: '⚡', color: '#fff3bf', light: LIGHT.yellow, hint: T('Leicht, aber häufig – Quick Win'), sticky: C.yellow },
    ], { xAxis: T('Häufigkeit / Anzahl Betroffene →'), yAxis: T('Schwere ↑') }),
  },
  {
    id: 'tech-debt', name: T('Tech-Debt-Matrix'), category: 'Softwareentwicklung', icon: '🧱',
    description: T('Technische Schulden nach Nutzen und Aufwand bewerten.'),
    build: () => quadrantTemplate(T('Technische Schulden'), T('Welche Schulden zahlen wir zuerst zurück?'), [
      { title: T('Sofort angehen'), emoji: '✅', color: '#d3f9d8', light: LIGHT.green, hint: T('Hoher Nutzen, wenig Aufwand'), sticky: C.green },
      { title: T('Große Vorhaben'), emoji: '🏗️', color: '#d0ebff', light: LIGHT.blue, hint: T('Hoher Nutzen, hoher Aufwand – einplanen'), sticky: C.blue },
      { title: T('Nebenbei'), emoji: '🧹', color: '#fff3bf', light: LIGHT.yellow, hint: T('Wenig Nutzen, wenig Aufwand – Pfadfinderregel'), sticky: C.yellow },
      { title: T('Hinterfragen'), emoji: '🤔', color: '#ffe3e3', light: LIGHT.red, hint: T('Wenig Nutzen, viel Aufwand'), sticky: C.red },
    ], { xAxis: T('Aufwand →'), yAxis: T('Nutzen / Risiko ↑') }),
  },
  {
    id: 'release-plan', name: T('Release-Planung'), category: 'Softwareentwicklung', icon: '🚀',
    description: T('Funktionen auf Releases verteilen, mit Terminen und Abhängigkeiten.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2040, 1160, T('Release-Planung'));
      b.heading(60, 40, T('Release-Planung'), T('Was kommt wann? Abhängigkeiten als Pfeile verbinden.'), 1400);
      const rel = [[T('Release 1.0'), dayOffset(30), '#4262ff'], [T('Release 1.1'), dayOffset(60), '#7048e8'], [T('Release 2.0'), dayOffset(120), '#e64980']];
      const firsts = [];
      rel.forEach(([t, d, c], i) => {
        const x = 60 + i * 660;
        b.shape(x, 180, 620, 90, { shape: 'roundrect', fill: c, stroke: 'none', strokeWidth: 0, text: `${t}  ·  📅 ${new Date(d + 'T00:00').toLocaleDateString(LOCALE)}`, textColor: '#fff', fontSize: 22, bold: true, locked: true });
        b.zone(x, 290, 620, 820, LIGHT.grey);
        const c1 = b.card(x + 20, 310, i === 0 ? T('Anmeldung & Konten') : i === 1 ? T('Benachrichtigungen') : T('Mandantenfähigkeit'), { w: 580, color: c, points: i === 2 ? '13' : '8' });
        b.card(x + 20, 470, T('Weitere Funktion'), { w: 580, color: c });
        firsts.push(c1);
      });
      b.conn(firsts[0], firsts[1], { stroke: '#e03131', dash: true, label: T('benötigt') });
      return b.els;
    },
  },
  {
    id: 'api-design', name: T('API-Design'), category: 'Softwareentwicklung', icon: '🔌',
    description: T('Endpunkte, Datenformate und offene Fragen einer Schnittstelle abstimmen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2000, 1180, T('API-Design'));
      b.heading(60, 40, T('API-Design'), T('Ressource: /bestellungen · Version: v1'), 1400);
      b.table(60, 190, 1100, 360, [[T('Methode'), T('Pfad'), T('Beschreibung'), T('Rechte')], ['GET', '/bestellungen', T('Liste (paginiert)'), 'lesen'], ['POST', '/bestellungen', T('Neue Bestellung'), 'schreiben'],
        ['GET', '/bestellungen/{id}', T('Einzelne Bestellung'), 'lesen'], ['PATCH', '/bestellungen/{id}', T('Status ändern'), 'schreiben'], ['DELETE', '/bestellungen/{id}', T('Stornieren'), 'admin']], { fontSize: 15 });
      const json = T('{\n  "id": 4711,\n  "status": "offen",\n  "kunde": { "id": 12, "name": "Muster GmbH" },\n  "positionen": [\n    { "artikel": 1, "menge": 2 }\n  ],\n  "summe": 99.90\n}');
      b.add({ type: 'code', x: 1200, y: 190, w: 740, h: codeH(json), lang: 'json', theme: 'dark', fontSize: 14, title: 'Beispiel-Antwort', text: json });
      b.text(60, 600, 500, T('Offene Fragen'), 22, { bold: true });
      [T('Pagination per Cursor oder Seite?'), T('Fehlerformat (RFC 9457)?'), T('Rate-Limits?')].forEach((t, i) => b.sticky(60 + i * 190, 650, t, C.pink, 170, 170));
      b.text(700, 640, 500, T('Entscheidungen'), 22, { bold: true });
      b.sticky(700, 690, T('JSON, camelCase'), C.green, 170, 170);
      return b.els;
    },
  },
  {
    id: 'adr', name: T('Architekturentscheidung (ADR)'), category: 'Softwareentwicklung', icon: '📐',
    description: T('Eine Architekturentscheidung mit Kontext, Optionen und Konsequenzen festhalten.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 1220, T('ADR'));
      b.heading(60, 40, T('ADR-001: …'), T('Status: vorgeschlagen · Datum: ') + new Date().toLocaleDateString(LOCALE) + T(' · Beteiligte: …'), 1400);
      blocks(b, 60, 190, 1680, [
        { title: T('1. Kontext'), hint: T('Welches Problem lösen wir? Welche Rahmenbedingungen gelten?') },
        { title: T('2. Optionen'), hint: T('Welche Alternativen wurden betrachtet? Vor- und Nachteile.'), sticky: C.blue, stickies: [T('Option A'), T('Option B')] },
        { title: T('3. Entscheidung'), hint: T('Wofür haben wir uns entschieden – und warum?'), fill: '#f4fbef' },
        { title: T('4. Konsequenzen'), hint: T('Was wird einfacher, was schwieriger? Folgearbeiten?') },
        { title: T('5. Risiken'), hint: T('Was beobachten wir?'), sticky: C.red },
        { title: T('6. Status & Nachverfolgung'), hint: T('vorgeschlagen · akzeptiert · abgelöst durch …') },
      ], { cols: 3, h: 470 });
      return b.els;
    },
  },

  /* ================================================================== */
  /* Projektmanagement                                                   */
  /* ================================================================== */

  {
    id: 'kickoff', name: T('Projekt-Kick-off'), category: 'Projektmanagement', icon: '🎬',
    description: T('Ziele, Umfang, Rollen, Zeitplan und Spielregeln zum Projektstart.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2040, 1260, T('Projekt-Kick-off'));
      b.heading(60, 40, T('Projekt-Kick-off'), T('Projekt: … · Auftraggeber: … · Start: ') + new Date().toLocaleDateString(LOCALE), 1600);
      blocks(b, 60, 190, 1920, [
        { title: T('🎯 Ziele & Nutzen'), hint: T('Woran erkennen wir Erfolg? (messbar)') },
        { title: T('📦 Umfang'), hint: T('Was gehört dazu – und ausdrücklich nicht?'), sticky: C.green, stickies: [T('Im Umfang'), T('Nicht im Umfang')] },
        { title: T('👥 Team & Rollen'), hint: T('Wer entscheidet, wer arbeitet mit, wer wird informiert?') },
        { title: T('🗓️ Zeitplan & Meilensteine'), hint: T('Wichtige Termine und Abhängigkeiten') },
        { title: T('💬 Zusammenarbeit'), hint: T('Meetings, Kanäle, Ablage, Entscheidungswege') },
        { title: T('⚠️ Risiken & Annahmen'), hint: T('Was könnte schiefgehen? Wovon gehen wir aus?'), sticky: C.red },
      ], { cols: 3, h: 500 });
      return b.els;
    },
  },
  {
    id: 'risk-matrix', name: T('Risikomatrix'), category: 'Projektmanagement', icon: '🎲',
    description: T('Risiken nach Eintrittswahrscheinlichkeit und Auswirkung bewerten.'),
    build: () => {
      const b = new B();
      const X = 200, Y = 200, s = 160;
      b.frame(0, 0, X + s * 5 + 760, Y + s * 5 + 160, T('Risikomatrix'));
      b.heading(60, 40, T('Risikomatrix'), T('Risiken als Notizen in die passende Zelle ziehen'), 1400);
      const col = (p, i) => (p * i >= 15 ? '#ffc9c9' : p * i >= 8 ? '#ffe8cc' : p * i >= 4 ? '#fff3bf' : '#d3f9d8');
      for (let p = 5; p >= 1; p--) {
        for (let i = 1; i <= 5; i++) b.shape(X + (i - 1) * s, Y + (5 - p) * s, s, s, { fill: col(p, i), stroke: '#ffffff', strokeWidth: 3, locked: true, text: String(p * i), textColor: '#adb5bd', fontSize: 14, align: 'right', valign: 'top' });
        b.text(X - 60, Y + (5 - p) * s + s / 2 - 14, 50, String(p), 20, { bold: true, align: 'center' });
      }
      for (let i = 1; i <= 5; i++) b.text(X + (i - 1) * s, Y + 5 * s + 10, s, String(i), 20, { bold: true, align: 'center' });
      b.text(X, Y + 5 * s + 50, s * 5, T('Auswirkung →'), 18, { bold: true, align: 'center', color: '#444' });
      b.text(40, Y - 50, 260, T('Wahrscheinlichkeit ↑'), 18, { bold: true, color: '#444' });
      b.sticky(X + 3 * s + 10, Y + s + 10, T('Schlüsselperson fällt aus'), C.red, 140, 140);
      b.text(X + s * 5 + 60, Y, 600, T('Risikoliste'), 22, { bold: true });
      b.table(X + s * 5 + 60, Y + 44, 640, 400, [[T('Risiko'), 'W', 'A', T('Maßnahme'), T('Verantwortlich')], ['', '', '', '', ''], ['', '', '', '', ''], ['', '', '', '', ''], ['', '', '', '', '']], { fontSize: 13 });
      return b.els;
    },
  },
  {
    id: 'raid', name: T('RAID-Log'), category: 'Projektmanagement', icon: '📋',
    description: T('Risiken, Annahmen, Probleme und Abhängigkeiten an einem Ort.'),
    build: () => columnsTemplate(T('RAID-Log'), T('Regelmäßig im Projektmeeting durchgehen · Verantwortliche und Termine auf Karten pflegen'), [
      { title: T('Risiken'), emoji: '⚠️', color: '#ffc9c9', light: LIGHT.red, hint: T('Was könnte eintreten?'), sticky: C.red },
      { title: T('Annahmen'), emoji: '💭', color: '#d0ebff', light: LIGHT.blue, hint: T('Wovon gehen wir aus?'), sticky: C.blue },
      { title: T('Probleme'), emoji: '🔥', color: '#ffd8a8', light: LIGHT.orange, hint: T('Was ist bereits eingetreten?'), sticky: C.orange },
      { title: T('Abhängigkeiten'), emoji: '🔗', color: '#e5dbff', light: LIGHT.violet, hint: T('Worauf warten wir – wer wartet auf uns?'), sticky: C.violet },
    ], { stickies: 2 }),
  },
  {
    id: 'status-report', name: T('Projektstatus'), category: 'Projektmanagement', icon: '🚦',
    description: T('Ampelstatus für Zeit, Budget, Umfang und Qualität mit nächsten Schritten.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1900, 1180, T('Projektstatus'));
      b.heading(60, 40, T('Projektstatus'), T('Berichtszeitraum: … · Gesamtstatus: 🟢 / 🟡 / 🔴'), 1400);
      [[T('Zeit'), '#40c057'], [T('Budget'), '#fab005'], [T('Umfang'), '#40c057'], [T('Qualität'), '#40c057']].forEach(([t, c], i) => {
        const x = 60 + i * 450;
        b.shape(x, 190, 420, 150, { shape: 'roundrect', fill: '#ffffff', stroke: '#dee2e6', strokeWidth: 1, text: '', locked: true });
        b.shape(x + 24, 220, 90, 90, { shape: 'ellipse', fill: c, stroke: 'none', strokeWidth: 0 });
        b.text(x + 140, 230, 260, t, 26, { bold: true });
        b.text(x + 140, 272, 260, T('Kurzkommentar …'), 15, { color: '#6b6b6b' });
      });
      blocks(b, 60, 380, 1780, [
        { title: T('✅ Erreicht'), hint: T('Seit dem letzten Bericht'), sticky: C.green },
        { title: T('➡️ Nächste Schritte'), hint: T('Bis zum nächsten Bericht'), sticky: C.blue },
        { title: T('⚠️ Risiken & Probleme'), hint: T('Mit Gegenmaßnahmen'), sticky: C.red },
        { title: T('🗳️ Entscheidungsbedarf'), hint: T('Was muss der Lenkungskreis entscheiden?'), sticky: C.violet },
      ], { cols: 4, h: 740 });
      return b.els;
    },
  },
  {
    id: 'milestones', name: T('Meilensteinplan'), category: 'Projektmanagement', icon: '🏁',
    description: T('Projektphasen und Meilensteine auf einer Zeitachse.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2200, 900, T('Meilensteinplan'));
      b.heading(60, 40, T('Meilensteinplan'), T('Phasen als Balken, Meilensteine als Rauten'), 1400);
      b.line(80, 470, 2120, 470, { strokeWidth: 4, arrowEnd: true, stroke: '#495057' });
      const phases = [[T('Initiierung'), 0, 300, '#d0ebff'], [T('Konzeption'), 300, 700, '#e5dbff'], [T('Umsetzung'), 700, 1500, '#fff3bf'], [T('Einführung'), 1500, 1960, '#d3f9d8']];
      phases.forEach(([t, a, e, c]) => b.shape(100 + a, 520, e - a - 10, 70, { shape: 'roundrect', fill: c, stroke: 'none', strokeWidth: 0, text: t, fontSize: 18, bold: true }));
      const ms = [[T('Projektauftrag'), 0, 0], [T('Konzept abgenommen'), 300, 30], [T('Go-Live'), 1500, 100], [T('Projektabschluss'), 1960, 140]];
      ms.forEach(([t, x, d]) => {
        b.shape(70 + x, 440, 60, 60, { shape: 'diamond', fill: '#e8590c', stroke: '#ffffff', strokeWidth: 2 });
        b.text(20 + x, 300, 220, `${t}\n📅 ${new Date(dayOffset(d) + 'T00:00').toLocaleDateString(LOCALE)}`, 16, { bold: true, align: 'center' });
      });
      return b.els;
    },
  },
  {
    id: 'raci', name: T('RACI-Matrix'), category: 'Projektmanagement', icon: '🧩',
    description: T('Verantwortlichkeiten klären: Responsible, Accountable, Consulted, Informed.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 1000, T('RACI-Matrix'));
      b.heading(60, 40, T('RACI-Matrix'), T('R = führt durch · A = verantwortet (genau eine Person) · C = wird gefragt · I = wird informiert'), 1600);
      b.table(60, 190, 1680, 560, [[T('Aufgabe / Ergebnis'), T('Projektleitung'), T('Fachbereich'), T('Entwicklung'), T('Betrieb'), T('Datenschutz')],
        [T('Anforderungen erheben'), 'A', 'R', 'C', 'C', 'I'], [T('Architektur festlegen'), 'A', 'I', 'R', 'C', 'C'], [T('Umsetzung'), 'A', 'C', 'R', 'I', 'I'],
        [T('Abnahme'), 'R', 'A', 'C', 'C', 'I'], [T('Betriebsübergabe'), 'A', 'I', 'C', 'R', 'I'], [T('Datenschutz-Folgenabschätzung'), 'C', 'C', 'C', 'I', 'A']], { fontSize: 16 });
      [['R', T('Responsible'), '#4262ff'], ['A', T('Accountable'), '#e03131'], ['C', T('Consulted'), '#f59f00'], ['I', T('Informed'), '#868e96']].forEach(([k, t, c], i) => {
        b.shape(60 + i * 300, 800, 60, 60, { shape: 'ellipse', fill: c, stroke: 'none', strokeWidth: 0, text: k, textColor: '#fff', bold: true, fontSize: 22 });
        b.text(130 + i * 300, 815, 200, t, 18);
      });
      return b.els;
    },
  },
  {
    id: 'team-planning', name: T('Teamübergreifende Planung'), category: 'Projektmanagement', icon: '🗺️',
    description: T('Teams × Iterationen mit Features, Meilensteinen und Abhängigkeiten.'),
    build: () => {
      const b = new B();
      const its = [T('Iteration 1'), T('Iteration 2'), T('Iteration 3'), T('Iteration 4'), T('Puffer')], teams = [T('Meilensteine'), T('Team Alpha'), T('Team Beta'), T('Team Gamma')];
      const X = 260, Y = 190, cw = 360, rh = 220;
      b.frame(0, 0, X + cw * its.length + 60, Y + 70 + rh * teams.length + 60, T('Teamübergreifende Planung'));
      b.heading(60, 40, T('Teamübergreifende Planung'), T('Features als Karten · Abhängigkeiten als rote Pfeile · Ziele je Team festhalten'), 1600);
      its.forEach((t, i) => b.shape(X + i * cw, Y, cw - 6, 60, { shape: 'roundrect', fill: '#212529', stroke: 'none', strokeWidth: 0, text: t, textColor: '#fff', bold: true, fontSize: 18, locked: true }));
      const cells = [];
      teams.forEach((t, r) => {
        const y = Y + 70 + r * rh;
        b.shape(60, y, X - 80, rh - 6, { shape: 'roundrect', fill: r ? '#eef1ff' : '#fff4e6', stroke: 'none', strokeWidth: 0, text: t, bold: true, fontSize: 18, locked: true });
        its.forEach((_, i) => cells.push(b.zone(X + i * cw, y, cw - 6, rh - 6, LIGHT.grey)));
      });
      b.shape(X + 2 * cw + 140, Y + 70 + 60, 70, 70, { shape: 'diamond', fill: '#e8590c', stroke: 'none', strokeWidth: 0 });
      b.text(X + 2 * cw + 40, Y + 70 + 140, 280, T('Release Demo'), 14, { bold: true, align: 'center' });
      const f1 = b.sticky(X + 20, Y + 70 + rh + 30, T('Feature: Login'), C.blue, 150, 150);
      const f2 = b.sticky(X + cw + 20, Y + 70 + rh * 2 + 30, T('Feature: Profil'), C.blue, 150, 150);
      b.sticky(X + cw + 190, Y + 70 + rh + 30, T('Feature: Suche'), C.blue, 150, 150);
      b.conn(f1, f2, { stroke: '#e03131', strokeWidth: 3, label: T('Abhängigkeit') });
      return b.els;
    },
  },
  {
    id: 'lessons-learned', name: T('Lessons Learned'), category: 'Projektmanagement', icon: '🎓',
    description: T('Erfahrungen aus einem Projekt sichern und in Maßnahmen übersetzen.'),
    build: () => columnsTemplate(T('Lessons Learned'), T('Projekt: … · Was nehmen wir für künftige Projekte mit?'), [
      { title: T('Was lief gut?'), emoji: '👍', color: '#d3f9d8', light: LIGHT.green, sticky: C.green },
      { title: T('Was lief nicht gut?'), emoji: '👎', color: '#ffc9c9', light: LIGHT.red, sticky: C.red },
      { title: T('Was haben wir gelernt?'), emoji: '💡', color: '#fff3bf', light: LIGHT.yellow, sticky: C.yellow },
      { title: T('Empfehlungen & Maßnahmen'), emoji: '➡️', color: '#d0ebff', light: LIGHT.blue, sticky: C.blue },
    ], { stickies: 2 }),
  },

  /* ================================================================== */
  /* IT-Service-Management                                               */
  /* ================================================================== */

  {
    id: 'postmortem', name: T('Incident-Postmortem'), category: 'IT-Service-Management', icon: '🧯',
    description: T('Schuldfreie Nachbetrachtung: Ablauf, Ursache, Auswirkung und Maßnahmen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2160, 1540, T('Incident-Postmortem'));
      b.heading(60, 40, T('Incident-Postmortem'), T('Blameless: Wir suchen Ursachen in Systemen und Abläufen, nicht bei Personen.'), 1600);
      b.table(60, 190, 980, 300, [[T('Feld'), T('Wert')], [T('Incident-ID'), T('INC-…')], [T('Schweregrad'), T('SEV 1 / 2 / 3')], [T('Beginn – Ende'), T('… – … (Dauer …)')], [T('Betroffene Services'), '…'], [T('Incident Manager'), '…']], { fontSize: 15 });
      b.block(1080, 190, 1020, 300, T('📉 Auswirkung'), T('Wer war betroffen, wie stark, wie lange? Kennzahlen, SLA-Verletzungen, Kundenkontakte.'));
      b.text(60, 530, 600, T('⏱️ Zeitleiste'), 24, { bold: true });
      b.line(60, 650, 2100, 650, { strokeWidth: 3, arrowEnd: true, stroke: '#868e96' });
      [[T('Erkannt'), '09:12', SEV[1]], [T('Eskaliert'), '09:20', SEV[2]], [T('Ursache gefunden'), '10:05', SEV[3]], [T('Behoben'), '10:40', SEV[4]], [T('Kommunikation abgeschlossen'), '11:00', '#4262ff']].forEach(([t, time, c], i) => {
        b.shape(80 + i * 400, 630, 40, 40, { shape: 'ellipse', fill: c, stroke: '#ffffff', strokeWidth: 3 });
        b.card(40 + i * 400, 690, `${time} · ${t}`, { w: 340, h: 110, color: c });
      });
      blocks(b, 60, 850, 2040, [
        { title: T('🔍 Ursachen (5 Warum)'), hint: T('Warum? → Warum? → … bis zur systemischen Ursache'), sticky: C.orange, stickies: [T('Warum 1'), T('Warum 2')] },
        { title: T('👍 Was lief gut?'), hint: T('Erkennung, Zusammenarbeit, Werkzeuge'), sticky: C.green },
        { title: T('👎 Was lief schlecht?'), hint: T('Wo haben wir Zeit verloren?'), sticky: C.red },
        { title: T('🍀 Wo hatten wir Glück?'), hint: T('Was hätte schlimmer kommen können?'), sticky: C.yellow },
      ], { cols: 4, h: 370 });
      b.text(60, 1260, 600, T('✅ Maßnahmen'), 24, { bold: true });
      [T('Monitoring-Alarm für … ergänzen'), T('Runbook aktualisieren'), T('Automatischen Failover testen')].forEach((t, i) => b.card(60 + i * 340, 1310, t, { w: 320, h: 150, assignee: '', due: dayOffset(14), status: T('Offen'), priority: i ? 'medium' : 'high', color: '#4262ff' }));
      return b.els;
    },
  },
  {
    id: 'major-incident', name: T('Major-Incident-Lagezentrum'), category: 'IT-Service-Management', icon: '🚨',
    description: T('Lagebild, Rollen, Hypothesen und Kommunikation während einer schweren Störung.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2160, 1300, T('Major Incident'));
      b.heading(60, 40, T('🚨 Major Incident: …'), T('Start: … · Schweregrad: SEV 1 · Nächstes Status-Update: … (Timer starten!)'), 1700);
      b.shape(60, 180, 2040, 110, { shape: 'roundrect', fill: '#e03131', stroke: 'none', strokeWidth: 0, textColor: '#ffffff', fontSize: 22, bold: true, align: 'left', text: T('Lagebild: Was funktioniert nicht? Wer ist betroffen? Seit wann?') });
      b.table(60, 320, 640, 330, [[T('Rolle'), T('Person')], [T('Incident Manager'), ''], [T('Technische Leitung'), ''], [T('Kommunikation'), ''], [T('Protokoll'), ''], [T('Service Owner'), '']], { fontSize: 15 });
      blocks(b, 740, 320, 1360, [
        { title: T('🧪 Hypothesen'), hint: T('Vermutung → Test → Ergebnis'), sticky: C.violet, stickies: [T('Hypothese A'), T('Hypothese B')] },
        { title: T('🛠️ Laufende Maßnahmen'), hint: T('Wer macht gerade was? (Karten mit Zuständigkeit)'), sticky: C.blue },
      ], { cols: 2, h: 330 });
      blocks(b, 60, 690, 2040, [
        { title: T('⏱️ Zeitleiste'), hint: T('Uhrzeit · Ereignis · Entscheidung'), sticky: C.grey },
        { title: T('📣 Kommunikation'), hint: T('Status-Updates an Nutzer, Management, Kunden (mit Uhrzeit)'), sticky: C.yellow },
        { title: T('🔁 Workaround & Wiederherstellung'), hint: T('Übergangslösung, Rollback, Failover'), sticky: C.green },
      ], { cols: 3, h: 560 });
      return b.els;
    },
  },
  {
    id: 'problem-analysis', name: T('Problem-Analyse (Ist / Ist nicht)'), category: 'IT-Service-Management', icon: '🔬',
    description: T('Ursachen eines wiederkehrenden Problems systematisch eingrenzen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2000, 1260, T('Problem-Analyse'));
      b.heading(60, 40, T('Problem-Analyse'), T('Problem-ID: PRB-… · Verknüpfte Incidents: …'), 1600);
      b.table(60, 190, 1880, 480, [[T('Frage'), T('Ist (beobachtet)'), T('Ist nicht (könnte, ist aber nicht)'), T('Besonderheit / Unterschied'), T('Änderung (seit wann?)')],
        [T('Was? (Objekt, Fehler)'), '', '', '', ''], [T('Wo? (Standort, System, Komponente)'), '', '', '', ''], [T('Wann? (zuerst, Muster, Zeitpunkt)'), '', '', '', ''], [T('Ausmaß? (wie viele, wie stark, Trend)'), '', '', '', '']], { fontSize: 14 });
      blocks(b, 60, 710, 1880, [
        { title: T('🔍 Mögliche Ursachen'), hint: T('Erklärt die Ursache alle Ist- und Ist-nicht-Beobachtungen?'), sticky: C.orange, stickies: [T('Ursache 1'), T('Ursache 2')] },
        { title: T('🩹 Workaround'), hint: T('Übergangslösung für den Service Desk'), sticky: C.green },
        { title: T('📚 Known Error / Lösung'), hint: T('Eintrag für die Wissensdatenbank (KEDB) · Change für die dauerhafte Lösung'), sticky: C.blue },
      ], { cols: 3, h: 480 });
      return b.els;
    },
  },
  {
    id: 'change-cab', name: T('Change-Request & CAB'), category: 'IT-Service-Management', icon: '🔄',
    description: T('Changes beantragen, bewerten und im Change Advisory Board freigeben.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2260, 1360, T('Change Management'));
      b.heading(60, 40, T('Change Management'), T('Standard-Changes sind vorab genehmigt · Normale Changes ins CAB · Notfall-Changes ins ECAB'), 1800);
      b.table(60, 190, 760, 620, [[T('Feld'), T('Angabe')], [T('Change-ID'), T('CHG-…')], [T('Typ'), T('Standard / Normal / Notfall')], [T('Beschreibung'), ''], [T('Begründung'), ''], [T('Betroffene CIs / Services'), ''],
        [T('Risiko & Auswirkung'), T('niedrig / mittel / hoch')], [T('Umsetzungsplan'), ''], [T('Rückfallplan (Rollback)'), ''], [T('Zeitfenster'), ''], [T('Genehmigt durch'), '']], { fontSize: 14 });
      lanes(b, 860, 190, [
        { title: T('Beantragt'), color: '#e9ecef', cards: [{ title: T('Datenbank-Update auf PostgreSQL 16.4'), key: 'CHG-1042', priority: 'medium', due: dayOffset(7), tags: [T('Normal')] }] },
        { title: T('Bewertung / CAB'), color: '#d0ebff', cards: [{ title: T('Firewall-Regel für Partner-VPN'), key: 'CHG-1039', priority: 'high', tags: [T('Normal')] }] },
        { title: T('Genehmigt'), color: '#d3f9d8' },
        { title: T('Umgesetzt'), color: '#e5dbff' },
        { title: T('Abgelehnt'), color: '#ffc9c9' },
      ], { colW: 260, colH: 1120 });
      return b.els;
    },
  },
  {
    id: 'service-blueprint', name: T('Service Blueprint'), category: 'IT-Service-Management', icon: '🧭',
    description: T('Kundenschritte, sichtbare und unsichtbare Abläufe sowie unterstützende Systeme.'),
    build: () => {
      const b = new B();
      const steps = [T('Problem bemerken'), T('Ticket melden'), T('Rückfrage'), T('Lösung erhalten'), T('Bewerten')];
      const rows = [[T('Physische Belege'), '#f1f3f5', C.grey], [T('Kundenaktionen'), '#fff4e6', C.orange], [T('Frontstage (sichtbar)'), '#e7f5ff', C.blue], [T('Backstage (unsichtbar)'), '#f3f0ff', C.violet], [T('Unterstützende Prozesse & Systeme'), '#ebfbee', C.green]];
      const X = 320, Y = 260, cw = 330, rh = 200;
      b.frame(0, 0, X + cw * steps.length + 60, Y + rh * rows.length + 80, T('Service Blueprint'));
      b.heading(60, 40, T('Service Blueprint'), T('Service: IT-Support · Persona: …'), 1400);
      steps.forEach((s, i) => b.shape(X + i * cw, 180, cw - 10, 60, { shape: 'pill', fill: '#212529', stroke: 'none', strokeWidth: 0, text: `${i + 1}. ${s}`, textColor: '#fff', bold: true, fontSize: 16, locked: true }));
      rows.forEach(([t, bg, st], r) => {
        const y = Y + r * rh;
        b.zone(60, y, X - 80 + cw * steps.length, rh - 10, bg);
        b.text(76, y + 16, X - 110, t, 17, { bold: true });
        steps.forEach((_, i) => r > 0 && r < 4 && i < 3 && b.sticky(X + i * cw + 10, y + 20, '', st, 150, 150));
      });
      const lines = [[T('Interaktionslinie'), Y + rh * 2 - 5], [T('Sichtbarkeitslinie'), Y + rh * 3 - 5], [T('Interne Interaktionslinie'), Y + rh * 4 - 5]];
      lines.forEach(([t, y]) => {
        b.line(60, y, X + cw * steps.length - 20, y, { dash: true, stroke: '#495057' });
        b.text(X + cw * steps.length - 300, y - 26, 280, t, 13, { italic: true, color: '#495057', align: 'right' });
      });
      return b.els;
    },
  },
  {
    id: 'sipoc', name: T('SIPOC'), category: 'IT-Service-Management', icon: '🔗',
    description: T('Prozessüberblick: Lieferanten, Eingaben, Prozess, Ergebnisse, Kunden.'),
    build: () => columnsTemplate(T('SIPOC'), T('Prozess: … · Start: … · Ende: …'), [
      { title: T('Suppliers'), emoji: '🏭', color: '#d0ebff', light: LIGHT.blue, hint: T('Wer liefert?'), sticky: C.blue },
      { title: T('Inputs'), emoji: '📥', color: '#e5dbff', light: LIGHT.violet, hint: T('Was wird benötigt?'), sticky: C.violet },
      { title: T('Process'), emoji: '⚙️', color: '#fff3bf', light: LIGHT.yellow, hint: T('4–7 Hauptschritte'), sticky: C.yellow },
      { title: T('Outputs'), emoji: '📤', color: '#d3f9d8', light: LIGHT.green, hint: T('Was entsteht?'), sticky: C.green },
      { title: T('Customers'), emoji: '🙋', color: '#ffd8a8', light: LIGHT.orange, hint: T('Wer erhält das Ergebnis?'), sticky: C.orange },
    ], { colW: 360, stickies: 2 }),
  },
  {
    id: 'value-stream', name: T('Wertstromanalyse'), category: 'IT-Service-Management', icon: '🌊',
    description: T('Durchlaufzeit, Bearbeitungszeit und Wartezeiten eines Prozesses sichtbar machen.'),
    build: () => {
      const b = new B();
      const steps = [[T('Anfrage'), T('10 min'), T('1 Tag')], [T('Freigabe'), T('15 min'), T('3 Tage')], [T('Bereitstellung'), '2 h', T('2 Tage')], [T('Test'), '1 h', T('1 Tag')], [T('Übergabe'), T('20 min'), '–']];
      b.frame(0, 0, 2160, 1000, T('Wertstrom'));
      b.heading(60, 40, T('Wertstromanalyse'), T('Beispiel: Bereitstellung eines neuen Arbeitsplatzes · Wo entsteht Wartezeit?'), 1700);
      let prev = null;
      steps.forEach(([t, pt, wt], i) => {
        const x = 60 + i * 420;
        const box = b.shape(x, 220, 320, 160, { shape: 'rect', fill: '#e7f5ff', stroke: '#1971c2', text: t, fontSize: 20, bold: true });
        b.table(x, 400, 320, 130, [[T('Bearbeitungszeit'), pt], [T('Fehlerquote'), '… %']], { header: false, fontSize: 13 });
        if (prev) b.conn(prev, box, { routing: 'straight', strokeWidth: 3 });
        prev = box;
        if (wt !== '–') {
          b.shape(x + 330, 600, 80, 70, { shape: 'triangle', fill: '#ffe066', stroke: '#e67700', text: '', strokeWidth: 2 });
          b.text(x + 300, 680, 140, `⏳ ${wt}`, 15, { bold: true, align: 'center' });
        }
      });
      b.line(60, 780, 2080, 780, { strokeWidth: 2, stroke: '#495057' });
      b.text(60, 800, 1200, T('Durchlaufzeit gesamt: ca. 7 Tage · Bearbeitungszeit: ca. 3,75 h · Flusseffizienz: ≈ 2 %'), 20, { bold: true });
      b.sticky(1700, 820, T('Wo können wir Wartezeit streichen?'), C.pink, 200, 140);
      return b.els;
    },
  },
  {
    id: 'service-catalog', name: T('Service-Katalog'), category: 'IT-Service-Management', icon: '🗂️',
    description: T('Services mit Verantwortlichen, Servicezeiten und SLA-Zielen im Überblick.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2040, 1100, T('Service-Katalog'));
      b.heading(60, 40, T('Service-Katalog'), T('Business-Services für Anwender · technische Services im Hintergrund'), 1500);
      b.text(60, 180, 800, T('Business-Services'), 24, { bold: true });
      [[T('E-Mail & Kalender'), T('Mo–Fr 7–19 Uhr · 99,5 %')], [T('Arbeitsplatz-Bereitstellung'), T('5 Arbeitstage')], [T('Kollaborations-Plattform'), '24/7 · 99,9 %'], [T('Service Desk'), T('Reaktion < 30 min')]].forEach(([t, d], i) =>
        b.card(60 + i * 490, 230, t, { w: 460, h: 160, description: d, status: T('Live'), assignee: T('Service Owner'), tags: [T('Business')], color: '#4262ff' }));
      b.text(60, 450, 800, T('Technische Services'), 24, { bold: true });
      [[T('Identitäts- & Zugriffsverwaltung'), T('Basis für alle Anmeldungen')], [T('Netzwerk & VPN'), T('Standorte und Homeoffice')], [T('Datenbank-Plattform'), T('PostgreSQL-Cluster')], [T('Backup & Wiederherstellung'), T('RPO 24 h · RTO 4 h')]].forEach(([t, d], i) =>
        b.card(60 + i * 490, 500, t, { w: 460, h: 160, description: d, status: T('Live'), tags: [T('Technisch')], color: '#12b886' }));
      b.text(60, 720, 800, T('In Planung / Auslaufend'), 24, { bold: true });
      b.card(60, 770, T('Self-Service-Portal'), { w: 460, h: 150, status: T('Geplant'), color: '#f59f00' });
      b.card(550, 770, T('Fax-Server'), { w: 460, h: 150, status: T('Auslaufend'), color: '#868e96' });
      return b.els;
    },
  },
  {
    id: 'oncall-handover', name: T('On-Call-Übergabe'), category: 'IT-Service-Management', icon: '📟',
    description: T('Bereitschaftswechsel: offene Störungen, Beobachtungen, Changes und Kontakte.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1900, 1100, T('On-Call-Übergabe'));
      b.heading(60, 40, T('On-Call-Übergabe'), T`Von: … · An: … · Zeitraum: ${new Date().toLocaleDateString(LOCALE)} – …`, 1400);
      blocks(b, 60, 190, 1780, [
        { title: T('🔴 Offene Incidents'), hint: T('Status, nächste Schritte, Ansprechpartner'), sticky: C.red },
        { title: T('👀 Beobachten'), hint: T('Auffälligkeiten ohne Störung (Last, Speicher, Zertifikate …)'), sticky: C.yellow },
        { title: T('🗓️ Geplante Changes'), hint: T('Wartungsfenster in der Bereitschaft'), sticky: C.blue },
        { title: T('📚 Bekannte Probleme & Workarounds'), hint: T('Mit Link auf Runbook'), sticky: C.violet },
        { title: T('☎️ Kontakte & Eskalation'), hint: T('Wer ist erreichbar? Dienstleister-Hotlines'), sticky: C.green },
        { title: T('📝 Notizen'), hint: T('Alles Weitere'), sticky: C.grey },
      ], { cols: 3, h: 420 });
      return b.els;
    },
  },
  {
    id: 'runbook', name: T('Runbook / Störungsbehebung'), category: 'IT-Service-Management', icon: '📖',
    description: T('Entscheidungsbaum zur Fehlerbehebung mit den passenden Befehlen.'),
    build: () => {
      const b = new B();
      b.heading(60, 40, T('Runbook: Webanwendung nicht erreichbar'), T('Schritt für Schritt – Befehle rechts kopieren'), 1100);
      const d = addDiagram(b, T`flowchart TD
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
      const cmds = T('# Status der Container\ndocker compose ps\n\n# Logs der letzten 15 Minuten\ndocker compose logs --since 15m app\n\n# Neustart\ndocker compose restart app\n\n# Erreichbarkeit prüfen\ncurl -fsS https://example.org/healthz');
      b.add({ type: 'code', x: d.w + 140, y: 190, w: 680, h: codeH(cmds), lang: 'bash', theme: 'dark', fontSize: 14, title: 'Befehle', text: cmds });
      const f = b.frame(0, 0, d.w + 900, Math.max(d.h, 560) + 280, T('Runbook'));
      b.els.splice(b.els.indexOf(f), 1);
      b.els.unshift(f);
      return b.els;
    },
  },
  {
    id: 'sla-review', name: T('SLA- / Service-Review'), category: 'IT-Service-Management', icon: '📈',
    description: T('Servicequalität gegen vereinbarte Ziele prüfen und Maßnahmen ableiten.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2000, 1180, T('Service-Review'));
      b.heading(60, 40, T('Service-Review'), T('Zeitraum: … · Teilnehmende: Service Owner, Kunde, Betrieb'), 1400);
      b.table(60, 190, 1880, 400, [[T('Service'), T('Kennzahl'), T('Ziel'), T('Ist'), T('Status'), T('Kommentar')],
        [T('E-Mail'), T('Verfügbarkeit'), '99,5 %', '99,8 %', '🟢', ''], [T('Service Desk'), T('Reaktionszeit P2'), '< 4 h', '5,2 h', '🔴', T('Personalengpass')],
        [T('Service Desk'), T('Lösungsquote 1st Level'), '70 %', '68 %', '🟡', ''], [T('Plattform'), T('Geplante Wartung angekündigt'), '100 %', '100 %', '🟢', '']], { fontSize: 15 });
      blocks(b, 60, 630, 1880, [
        { title: T('📊 Trends & Auffälligkeiten'), hint: T('Was hat sich verändert?'), sticky: C.blue },
        { title: T('🙋 Feedback der Kunden'), hint: T('Zufriedenheit, Beschwerden, Lob'), sticky: C.yellow },
        { title: T('✅ Maßnahmen'), hint: T('Als Karten mit Zuständigkeit und Termin'), sticky: C.green },
      ], { cols: 3, h: 480 });
      return b.els;
    },
  },
];
