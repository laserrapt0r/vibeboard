// Vorlagen-Bibliothek mit gängigen Moderations-, Agile- und Strategiemethoden
import { T, LOCALE } from './i18n.js';
import { B, C, LIGHT, dayOffset, columnsTemplate, quadrantTemplate } from './template-kit.js';
import { TECH_TEMPLATES } from './templates-tech.js';
import { DIAGRAM_TEMPLATES } from './templates-diagrams.js';

/* ---------------- Vorlagen ---------------- */

export const CATEGORIES = ['Alle', 'Brainstorming', 'Meetings & Retros', 'Agile & Projekte', 'Softwareentwicklung', 'UML', 'Projektmanagement', 'IT-Service-Management', 'IT-Infrastruktur', 'Strategie', 'Design & UX', 'Diagramme'];

export const TEMPLATES = [
  {
    id: 'blank', name: T('Leeres Board'), category: 'Alle', icon: '⬜',
    description: T('Unendliche Leinwand ohne Vorgaben.'),
    build: () => [],
  },
  {
    id: 'brainstorm', name: T('Brainstorming'), category: 'Brainstorming', icon: '💡',
    description: T('Ideen sammeln, clustern und abstimmen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 1120, T('Brainstorming'));
      b.heading(60, 40, T('Brainstorming'), T('Ideen sammeln · clustern · bewerten'), 1000);
      b.shape(650, 190, 500, 120, { shape: 'pill', fill: '#4262ff', stroke: 'none', strokeWidth: 0, text: T('Wie können wir …?'), fontSize: 28, bold: true });
      b.shape(1260, 40, 480, 270, { shape: 'roundrect', fill: '#f4f4f5', stroke: 'none', strokeWidth: 0, locked: true, align: 'left', valign: 'top', fontSize: 16,
        text: T('So geht\'s\n\n1. Jede:r notiert Ideen auf Sticky Notes (10 Min.)\n2. Ideen kurz vorstellen\n3. Ähnliche Ideen in Cluster ziehen\n4. Abstimmen – 3 Stimmen pro Person\n5. Nächste Schritte festlegen') });
      const zones = [[60, 360, T('Cluster A'), C.yellow], [940, 360, T('Cluster B'), C.blue], [60, 740, T('Cluster C'), C.green], [940, 740, T('Cluster D'), C.pink]];
      for (const [x, y, t, col] of zones) {
        b.shape(x, y, 800, 340, { shape: 'roundrect', fill: 'transparent', stroke: '#b5b5b5', strokeWidth: 2, dash: true, locked: true, text: t, fontSize: 18, bold: true, align: 'left', valign: 'top', textColor: '#8a8a8a' });
        b.sticky(x + 30, y + 60, T('Idee'), col);
        b.sticky(x + 200, y + 60, '', col);
      }
      return b.els;
    },
  },
  {
    id: 'mindmap', name: T('Mindmap'), category: 'Brainstorming', icon: '🧠',
    description: T('Gedanken hierarchisch um ein zentrales Thema anordnen. Tipp: Knoten auswählen und Tab (Kind) oder Enter (Geschwister) drücken.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1700, 1000, T('Mindmap'));
      const root = b.shape(700, 450, 300, 100, { shape: 'pill', fill: '#1a1a1a', stroke: 'none', strokeWidth: 0, text: T('Zentrales Thema'), textColor: '#ffffff', fontSize: 26, bold: true, mind: true });
      const branches = [
        [1110, 230, T('Thema 1'), '#4262ff', 1], [1110, 670, T('Thema 2'), '#12b886', 1],
        [370, 230, T('Thema 3'), '#f59f00', -1], [370, 670, T('Thema 4'), '#e64980', -1],
      ];
      for (const [x, y, t, col, dir] of branches) {
        const n = b.shape(x, y, 220, 70, { shape: 'roundrect', fill: col, stroke: 'none', strokeWidth: 0, text: t, textColor: '#ffffff', fontSize: 20, bold: true, mind: true });
        b.conn(root, n, { stroke: col, strokeWidth: 4, arrowEnd: false, mind: true });
        [-55, 65].forEach((dy, i) => {
          const cx = dir > 0 ? x + 300 : x - 260;
          const c = b.shape(cx, y + dy, 180, 50, { shape: 'pill', fill: '#ffffff', stroke: col, strokeWidth: 2, text: T`Unterpunkt ${i + 1}`, fontSize: 16, mind: true });
          b.conn(n, c, { stroke: col, strokeWidth: 2, arrowEnd: false, mind: true });
        });
      }
      return b.els;
    },
  },
  {
    id: 'kanban', name: T('Kanban-Board'), category: 'Agile & Projekte', icon: '📋',
    description: T('Aufgaben in Spalten durch den Workflow bewegen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1640, 1080, T('Kanban-Board'));
      b.heading(60, 40, T('Kanban-Board'), T('Team · Sprint · Ziel'), 1000);
      const cols = [[T('📥  Backlog'), '#9e9e9e'], [T('📝  Zu erledigen'), '#4262ff'], [T('⚙️  In Arbeit'), '#f59f00'], [T('✅  Erledigt'), '#12b886']];
      cols.forEach(([t, col], i) => {
        const x = 60 + i * 390;
        b.zone(x, 190, 360, 840, '#f1f2f5');
        b.shape(x, 190, 360, 64, { shape: 'roundrect', fill: '#ffffff', stroke: col, strokeWidth: 3, text: t, fontSize: 20, bold: true, locked: true });
      });
      b.card(90, 280, T('Ideen für Q3 sammeln'), { color: '#9e9e9e', description: T('Input aus dem Workshop einarbeiten') });
      b.card(480, 280, T('Anforderungen dokumentieren'), { color: '#4262ff', assignee: T('Anna Muster'), due: dayOffset(5), status: T('Hoch') });
      b.card(480, 440, T('Wireframes erstellen'), { color: '#4262ff', assignee: T('Ben Beispiel'), due: dayOffset(9) });
      b.card(870, 280, T('API-Schnittstelle entwickeln'), { color: '#f59f00', assignee: T('Chris Code'), due: dayOffset(2), status: T('In Arbeit'), description: T('REST-Endpunkte für Benutzerverwaltung') });
      b.card(1260, 280, T('Projekt-Setup'), { color: '#12b886', assignee: T('Anna Muster'), status: T('Fertig') });
      return b.els;
    },
  },
  {
    id: 'retro-ssc', name: T('Retro: Start · Stop · Continue'), category: 'Meetings & Retros', icon: '🔄',
    description: T('Was sollten wir beginnen, lassen, beibehalten?'),
    build: () => columnsTemplate(T('Retrospektive: Start · Stop · Continue'), T('Sprint · Datum · Team'), [
      { title: T('Start'), emoji: '🚀', color: C.green, light: LIGHT.green, hint: T('Was sollten wir neu ausprobieren?'), sticky: C.green },
      { title: T('Stop'), emoji: '🛑', color: C.red, light: LIGHT.red, hint: T('Was sollten wir nicht mehr tun?'), sticky: C.red },
      { title: T('Continue'), emoji: '👍', color: C.blue, light: LIGHT.blue, hint: T('Was läuft gut und soll bleiben?'), sticky: C.blue },
    ]),
  },
  {
    id: 'retro-msg', name: T('Retro: Mad · Sad · Glad'), category: 'Meetings & Retros', icon: '😊',
    description: T('Emotionen im Team sichtbar machen.'),
    build: () => columnsTemplate(T('Retrospektive: Mad · Sad · Glad'), T('Sprint · Datum · Team'), [
      { title: T('Mad'), emoji: '😠', color: C.red, light: LIGHT.red, hint: T('Was hat mich geärgert?'), sticky: C.red },
      { title: T('Sad'), emoji: '😢', color: C.blue, light: LIGHT.blue, hint: T('Was hat mich enttäuscht?'), sticky: C.blue },
      { title: T('Glad'), emoji: '😄', color: C.green, light: LIGHT.green, hint: T('Was hat mich gefreut?'), sticky: C.green },
    ]),
  },
  {
    id: 'retro-4l', name: T('Retro: 4L'), category: 'Meetings & Retros', icon: '4️⃣',
    description: T('Liked, Learned, Lacked, Longed for.'),
    build: () => columnsTemplate(T('Retrospektive: 4L'), T('Liked · Learned · Lacked · Longed for'), [
      { title: T('Liked'), emoji: '❤️', color: C.pink, light: LIGHT.pink, hint: T('Was hat uns gefallen?') },
      { title: T('Learned'), emoji: '📚', color: C.blue, light: LIGHT.blue, hint: T('Was haben wir gelernt?') },
      { title: T('Lacked'), emoji: '🕳️', color: C.orange, light: LIGHT.orange, hint: T('Was hat gefehlt?') },
      { title: T('Longed for'), emoji: '✨', color: C.violet, light: LIGHT.violet, hint: T('Was wünschen wir uns?') },
    ], { colW: 340 }),
  },
  {
    id: 'retro-sailboat', name: T('Retro: Segelboot'), category: 'Meetings & Retros', icon: '⛵',
    description: T('Wind, Anker, Felsen und Insel – bildhafte Retrospektive.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 1100, T('Retrospektive: Segelboot'));
      b.heading(60, 40, T('Retrospektive: Segelboot'), T('Was treibt uns an, was hält uns auf?'), 1000);
      b.shape(0, 620, 1800, 480, { fill: '#d6ecff', stroke: 'none', strokeWidth: 0, locked: true });
      b.emoji(780, 420, '⛵', 240);
      b.emoji(1450, 470, '🏝️', 200);
      b.emoji(860, 860, '⚓', 120);
      b.emoji(1580, 900, '🪨', 120);
      b.emoji(260, 300, '💨', 140);
      b.shape(60, 200, 520, 380, { shape: 'roundrect', fill: 'transparent', stroke: '#8bb8e8', strokeWidth: 2, dash: true, locked: true, text: T('💨 Wind – Was treibt uns an?'), fontSize: 20, bold: true, align: 'left', valign: 'top' });
      b.shape(1240, 200, 500, 280, { shape: 'roundrect', fill: 'transparent', stroke: '#93d275', strokeWidth: 2, dash: true, locked: true, text: T('🏝️ Insel – Was ist unser Ziel?'), fontSize: 20, bold: true, align: 'left', valign: 'top' });
      b.shape(60, 680, 640, 380, { shape: 'roundrect', fill: 'transparent', stroke: '#6b7f99', strokeWidth: 2, dash: true, locked: true, text: T('⚓ Anker – Was bremst uns?'), fontSize: 20, bold: true, align: 'left', valign: 'top' });
      b.shape(1040, 680, 700, 380, { shape: 'roundrect', fill: 'transparent', stroke: '#e8590c', strokeWidth: 2, dash: true, locked: true, text: T('🪨 Felsen – Welche Risiken sehen wir?'), fontSize: 20, bold: true, align: 'left', valign: 'top' });
      b.sticky(100, 270, '', C.blue);
      b.sticky(1280, 270, '', C.green);
      b.sticky(100, 750, '', C.grey);
      b.sticky(1080, 750, '', C.orange);
      return b.els;
    },
  },
  {
    id: 'retro-starfish', name: T('Retro: Seestern'), category: 'Meetings & Retros', icon: '⭐',
    description: T('Mehr, weniger, beibehalten, beginnen, aufhören – feiner als Start · Stop · Continue.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 1300, T('Retrospektive: Seestern'));
      b.heading(60, 40, T('Retrospektive: Seestern'), T('Was sollten wir mehr, weniger, weiter, neu oder nicht mehr tun?'), 1100);
      b.emoji(810, 590, '⭐', 180);
      const arms = [
        [660, 190, T('Weiter so'), '👍', C.blue, LIGHT.blue, T('Was läuft gut?')],
        [1180, 470, T('Mehr davon'), '⬆️', C.green, LIGHT.green, T('Was sollten wir verstärken?')],
        [980, 900, T('Weniger davon'), '⬇️', C.orange, LIGHT.orange, T('Was sollten wir reduzieren?')],
        [340, 900, T('Aufhören'), '🛑', C.red, LIGHT.red, T('Was sollten wir lassen?')],
        [140, 470, T('Anfangen'), '🚀', C.violet, LIGHT.violet, T('Was sollten wir ausprobieren?')],
      ];
      for (const [x, y, t, e, col, light, hint] of arms) {
        b.zone(x, y, 480, 340, light);
        b.shape(x, y, 480, 64, { shape: 'roundrect', fill: col, stroke: 'none', strokeWidth: 0, text: `${e}  ${t}`, fontSize: 20, bold: true, locked: true });
        b.text(x + 16, y + 74, 448, hint, 14, { color: '#6b6b6b' });
        b.sticky(x + 20, y + 140, '', col);
      }
      return b.els;
    },
  },
  {
    id: 'retro-daki', name: T('Retro: DAKI'), category: 'Meetings & Retros', icon: '🧹',
    description: T('Drop · Add · Keep · Improve – aufräumen und verbessern.'),
    build: () => columnsTemplate(T('Retrospektive: DAKI'), T('Drop · Add · Keep · Improve'), [
      { title: T('Drop'), emoji: '🗑️', color: C.red, light: LIGHT.red, hint: T('Was lassen wir weg?'), sticky: C.red },
      { title: T('Add'), emoji: '➕', color: C.green, light: LIGHT.green, hint: T('Was nehmen wir neu auf?'), sticky: C.green },
      { title: T('Keep'), emoji: '✅', color: C.blue, light: LIGHT.blue, hint: T('Was behalten wir bei?'), sticky: C.blue },
      { title: T('Improve'), emoji: '🔧', color: C.orange, light: LIGHT.orange, hint: T('Was machen wir besser?'), sticky: C.orange },
    ], { colW: 340 }),
  },
  {
    id: 'retro-timeline', name: T('Retro: Zeitstrahl'), category: 'Meetings & Retros', icon: '📈',
    description: T('Hochs und Tiefs des Sprints entlang der Zeit – gut nach längeren Phasen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 2000, 1100, T('Retrospektive: Zeitstrahl'));
      b.heading(60, 40, T('Retrospektive: Zeitstrahl'), T('Was ist wann passiert? Hochs oberhalb, Tiefs unterhalb der Linie.'), 1300);
      b.zone(60, 190, 1880, 380, LIGHT.green, { text: T('😄 Hochs'), fontSize: 20, bold: true, align: 'left', valign: 'top', textColor: '#2f9e44' });
      b.zone(60, 610, 1880, 380, LIGHT.red, { text: T('😞 Tiefs'), fontSize: 20, bold: true, align: 'left', valign: 'bottom', textColor: '#e03131' });
      b.line(60, 590, 1940, 590, { arrowEnd: true, strokeWidth: 4 });
      [T('Woche 1'), T('Woche 2'), T('Woche 3'), T('Woche 4')].forEach((w, i) => {
        const x = 300 + i * 420;
        b.line(x, 575, x, 605, { strokeWidth: 3 });
        b.text(x - 60, 545, 120, w, 14, { bold: true, align: 'center', color: '#495057' });
      });
      b.sticky(330, 300, '', C.green);
      b.sticky(750, 680, '', C.red);
      return b.els;
    },
  },
  {
    id: 'retro-balloon', name: T('Retro: Heißluftballon'), category: 'Meetings & Retros', icon: '🎈',
    description: T('Was trägt uns nach oben, was zieht uns runter, welches Wetter droht?'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 1100, T('Retrospektive: Heißluftballon'));
      b.heading(60, 40, T('Retrospektive: Heißluftballon'), T('Heiße Luft · Sandsäcke · Gewitter · Sonnenschein'), 1100);
      b.zone(0, 160, 1800, 940, '#eef6ff');
      b.emoji(770, 300, '🎈', 260);
      b.emoji(130, 230, '☀️', 120);
      b.emoji(1490, 220, '⛈️', 130);
      const areas = [
        [60, 380, 520, 300, T('🔥 Heiße Luft – Was bringt uns voran?'), '#e8590c'],
        [1220, 380, 520, 300, T('⛈️ Gewitter – Welche Risiken sehen wir?'), '#495057'],
        [60, 740, 680, 320, T('🪨 Sandsäcke – Was hält uns zurück?'), '#6b7f99'],
        [1060, 740, 680, 320, T('☀️ Sonnenschein – Was gibt uns Rückenwind?'), '#f08c00'],
      ];
      for (const [x, y, w, hh, t, col] of areas) {
        b.shape(x, y, w, hh, { shape: 'roundrect', fill: 'transparent', stroke: col, strokeWidth: 2, dash: true, locked: true, text: t, fontSize: 20, bold: true, align: 'left', valign: 'top' });
        b.sticky(x + 30, y + 70, '', C.yellow);
      }
      return b.els;
    },
  },
  {
    id: 'retro-speedcar', name: T('Retro: Speedcar'), category: 'Meetings & Retros', icon: '🏎️',
    description: T('Motor, Fallschirm, Abgrund und Brücke – was treibt, was bremst, was droht?'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 1100, T('Retrospektive: Speedcar'));
      b.heading(60, 40, T('Retrospektive: Speedcar'), T('Motor · Fallschirm · Abgrund · Brücke'), 1100);
      b.shape(0, 640, 1150, 460, { fill: '#d8c3a5', stroke: 'none', strokeWidth: 0, locked: true });
      b.shape(1450, 640, 350, 460, { fill: '#d8c3a5', stroke: 'none', strokeWidth: 0, locked: true });
      b.shape(1100, 600, 400, 40, { fill: '#8d6e63', stroke: 'none', strokeWidth: 0, locked: true, text: T('Brücke'), fontSize: 16, bold: true, textColor: '#fff' });
      b.emoji(620, 470, '🏎️', 180);
      b.emoji(260, 450, '🪂', 140);
      b.emoji(1240, 700, '🕳️', 120);
      const areas = [
        [700, 190, 520, 250, T('⚙️ Motor – Was treibt uns an?'), '#2f9e44'],
        [60, 190, 560, 250, T('🪂 Fallschirm – Was bremst uns?'), '#1971c2'],
        [1240, 190, 500, 250, T('🕳️ Abgrund – Welche Gefahren liegen vor uns?'), '#e03131'],
        [1160, 840, 600, 240, T('🌉 Brücke – Wie kommen wir sicher hinüber?'), '#8d6e63'],
      ];
      for (const [x, y, w, hh, t, col] of areas) {
        b.shape(x, y, w, hh, { shape: 'roundrect', fill: '#ffffff', stroke: col, strokeWidth: 2, dash: true, locked: true, text: t, fontSize: 18, bold: true, align: 'left', valign: 'top' });
        b.sticky(x + 24, y + 60, '', C.yellow, 150, 150);
      }
      return b.els;
    },
  },
  {
    id: 'open-topics', name: T('Offene Themenrunde'), category: 'Meetings & Retros', icon: '☕',
    description: T('Themen sammeln, abstimmen, im Zeitfenster besprechen – mit Daumen-Abfrage zum Weitermachen.'),
    build: () => {
      const els = columnsTemplate(T('Offene Themenrunde'), T('Themen sammeln · abstimmen · im Zeitfenster besprechen'), [
        { title: T('Zu besprechen'), emoji: '📝', color: C.blue, light: LIGHT.blue, hint: T('Ein Thema pro Sticky Note. Danach: Abstimmung mit 2–3 Stimmen pro Person.'), sticky: C.yellow },
        { title: T('Im Gespräch'), emoji: '💬', color: C.orange, light: LIGHT.orange, hint: T('Das Thema mit den meisten Stimmen. Timer z. B. 5 Minuten, danach Daumen: weiter oder nächstes Thema?') },
        { title: T('Besprochen'), emoji: '✅', color: C.green, light: LIGHT.green, hint: T('Erkenntnisse und Maßnahmen notieren.') },
      ], { colH: 700 });
      return els;
    },
  },
  {
    id: 'team-radar', name: T('Team-Radar'), category: 'Meetings & Retros', icon: '🎯',
    description: T('Jede Person setzt je Thema einen Punkt von 1 (innen) bis 5 (außen) – Stärken und Baustellen auf einen Blick.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1700, 1300, T('Team-Radar'));
      b.heading(60, 40, T('Team-Radar'), T('Pro Thema einen Punkt setzen: innen = 1 (schwach), außen = 5 (stark)'), 1100);
      const cx = 850, cy = 720;
      for (let r = 5; r >= 1; r--) {
        const rad = r * 90;
        b.shape(cx - rad, cy - rad, rad * 2, rad * 2, { shape: 'ellipse', fill: r % 2 ? '#f8f9fa' : '#ffffff', stroke: '#ced4da', strokeWidth: 1, locked: true });
        b.text(cx + 4, cy - rad + 2, 30, String(r), 12, { color: '#868e96' });
      }
      const topics = [T('Zusammenarbeit'), T('Kommunikation'), T('Qualität'), T('Tempo'), T('Spaß'), T('Lernen')];
      topics.forEach((t, i) => {
        const a = (Math.PI * 2 * i) / topics.length - Math.PI / 2;
        const ex = cx + Math.cos(a) * 460, ey = cy + Math.sin(a) * 460;
        b.line(cx, cy, ex, ey, { stroke: '#adb5bd', strokeWidth: 1.5, locked: true });
        b.text(cx + Math.cos(a) * 520 - 90, cy + Math.sin(a) * 520 - 14, 180, t, 18, { bold: true, align: 'center' });
      });
      b.emoji(60, 1150, '🔴', 40);
      b.text(110, 1156, 500, T('← Punkte (Sticker) auf die Achsen ziehen'), 16, { color: '#6b6b6b' });
      return b.els;
    },
  },
  {
    id: 'standup', name: T('Daily Stand-up'), category: 'Meetings & Retros', icon: '☕',
    description: T('Gestern · Heute · Hindernisse – kurz und knackig.'),
    build: () => columnsTemplate(T('Daily Stand-up'), new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }), [
      { title: T('Gestern erledigt'), emoji: '✅', color: C.green, light: LIGHT.green },
      { title: T('Heute geplant'), emoji: '🎯', color: C.blue, light: LIGHT.blue },
      { title: T('Hindernisse'), emoji: '🚧', color: C.red, light: LIGHT.red },
    ], { colH: 600 }),
  },
  {
    id: 'checkin', name: T('Check-in / Icebreaker'), category: 'Meetings & Retros', icon: '👋',
    description: T('Stimmungsbarometer und Vorstellungsrunde zum Meeting-Start.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1600, 980, T('Check-in'));
      b.heading(60, 40, T('Check-in'), T('Wie ist deine Stimmung heute? Setze einen Punkt (Emoji) unter dein Wetter.'), 1400);
      const weather = [['☀️', T('Sonnig')], ['⛅', T('Heiter')], ['☁️', T('Bewölkt')], ['🌧️', T('Regnerisch')], ['⛈️', T('Gewitter')]];
      weather.forEach(([e, t], i) => {
        const x = 60 + i * 300;
        b.zone(x, 190, 280, 380, LIGHT.blue);
        b.emoji(x + 90, 210, e, 100);
        b.text(x, 320, 280, t, 22, { bold: true, align: 'center' });
      });
      b.shape(60, 610, 1480, 320, { shape: 'roundrect', fill: LIGHT.yellow, stroke: 'none', strokeWidth: 0, locked: true, text: T('🙋 Vorstellungsrunde: Name · Rolle · ein Fun Fact'), fontSize: 22, bold: true, align: 'left', valign: 'top' });
      b.sticky(90, 690, T('Name\nRolle\nFun Fact'), C.yellow, 200, 200);
      return b.els;
    },
  },
  {
    id: 'swot', name: T('SWOT-Analyse'), category: 'Strategie', icon: '🧭',
    description: T('Stärken, Schwächen, Chancen und Risiken bewerten.'),
    build: () => quadrantTemplate(T('SWOT-Analyse'), T('Interne und externe Faktoren strategisch bewerten'), [
      { title: T('Stärken'), emoji: '💪', color: C.green, light: LIGHT.green, hint: T('Was können wir besonders gut? Welche Ressourcen haben wir?'), sticky: C.green },
      { title: T('Schwächen'), emoji: '⚠️', color: C.orange, light: LIGHT.orange, hint: T('Wo haben wir Defizite? Was sollten wir verbessern?'), sticky: C.orange },
      { title: T('Chancen'), emoji: '🌱', color: C.blue, light: LIGHT.blue, hint: T('Welche Trends und Möglichkeiten können wir nutzen?'), sticky: C.blue },
      { title: T('Risiken'), emoji: '⛈️', color: C.red, light: LIGHT.red, hint: T('Welche externen Gefahren bedrohen uns?'), sticky: C.red },
    ]),
  },
  {
    id: 'eisenhower', name: T('Eisenhower-Matrix'), category: 'Agile & Projekte', icon: '⏱️',
    description: T('Aufgaben nach Dringlichkeit und Wichtigkeit priorisieren.'),
    build: () => quadrantTemplate(T('Eisenhower-Matrix'), T('Wichtig vs. dringend'), [
      { title: T('Sofort erledigen'), emoji: '🔥', color: C.red, light: LIGHT.red, hint: T('Wichtig & dringend') },
      { title: T('Einplanen'), emoji: '📅', color: C.blue, light: LIGHT.blue, hint: T('Wichtig & nicht dringend') },
      { title: T('Delegieren'), emoji: '🤝', color: C.yellow, light: LIGHT.yellow, hint: T('Nicht wichtig & dringend') },
      { title: T('Eliminieren'), emoji: '🗑️', color: C.grey, light: LIGHT.grey, hint: T('Nicht wichtig & nicht dringend') },
    ], { xAxis: T('Dringlichkeit ➜ (links: dringend)'), yAxis: T('↑ Wichtigkeit') }),
  },
  {
    id: 'impact-effort', name: T('Impact/Aufwand-Matrix'), category: 'Agile & Projekte', icon: '🎯',
    description: T('Ideen nach Nutzen und Aufwand priorisieren.'),
    build: () => quadrantTemplate(T('Impact/Aufwand-Matrix'), T('Wo erzielen wir mit wenig Aufwand viel Wirkung?'), [
      { title: T('Quick Wins'), emoji: '⚡', color: C.green, light: LIGHT.green, hint: T('Hoher Impact, geringer Aufwand') },
      { title: T('Große Projekte'), emoji: '🏔️', color: C.blue, light: LIGHT.blue, hint: T('Hoher Impact, hoher Aufwand') },
      { title: T('Lückenfüller'), emoji: '🧩', color: C.yellow, light: LIGHT.yellow, hint: T('Geringer Impact, geringer Aufwand') },
      { title: T('Zeitfresser'), emoji: '🕳️', color: C.red, light: LIGHT.red, hint: T('Geringer Impact, hoher Aufwand') },
    ], { xAxis: T('Aufwand ➜'), yAxis: T('↑ Impact') }),
  },
  {
    id: 'stakeholder', name: T('Stakeholder-Map'), category: 'Strategie', icon: '👥',
    description: T('Stakeholder nach Einfluss und Interesse einordnen.'),
    build: () => quadrantTemplate(T('Stakeholder-Map'), T('Einfluss vs. Interesse'), [
      { title: T('Zufriedenstellen'), emoji: '🙂', color: C.yellow, light: LIGHT.yellow, hint: T('Hoher Einfluss, geringes Interesse') },
      { title: T('Eng einbinden'), emoji: '🤝', color: C.green, light: LIGHT.green, hint: T('Hoher Einfluss, hohes Interesse') },
      { title: T('Beobachten'), emoji: '👀', color: C.grey, light: LIGHT.grey, hint: T('Geringer Einfluss, geringes Interesse') },
      { title: T('Informieren'), emoji: '📣', color: C.blue, light: LIGHT.blue, hint: T('Geringer Einfluss, hohes Interesse') },
    ], { xAxis: T('Interesse ➜'), yAxis: T('↑ Einfluss') }),
  },
  {
    id: 'bmc', name: T('Business Model Canvas'), category: 'Strategie', icon: '🏢',
    description: T('Geschäftsmodell auf einer Seite. Business Model Canvas von Strategyzer AG, CC BY-SA 3.0.'),
    build: () => {
      const b = new B();
      const X = 60, Y = 190, cw = 330, th = 700, bh = 330;
      b.frame(0, 0, X * 2 + cw * 5, Y + th + bh + 60, T('Business Model Canvas'));
      b.heading(60, 40, T('Business Model Canvas'), T('Entworfen für: …   ·   Entworfen von: …   ·   Datum: …'), 1500);
      b.block(X, Y, cw, th, T('🤝 Schlüsselpartner'), T('Wer sind unsere wichtigsten Partner und Lieferanten? Welche Ressourcen beziehen wir von ihnen?'));
      b.block(X + cw, Y, cw, th / 2, T('⚙️ Schlüsselaktivitäten'), T('Welche Aktivitäten erfordert unser Wertangebot?'));
      b.block(X + cw, Y + th / 2, cw, th / 2, T('🧱 Schlüsselressourcen'), T('Welche Ressourcen erfordert unser Wertangebot?'));
      b.block(X + cw * 2, Y, cw, th, T('🎁 Wertangebote'), T('Welchen Wert liefern wir? Welche Probleme lösen wir? Welche Bedürfnisse erfüllen wir?'), LIGHT.yellow);
      b.block(X + cw * 3, Y, cw, th / 2, T('💬 Kundenbeziehungen'), T('Welche Art von Beziehung erwarten unsere Kundensegmente?'));
      b.block(X + cw * 3, Y + th / 2, cw, th / 2, T('🚚 Kanäle'), T('Über welche Kanäle erreichen wir unsere Kunden?'));
      b.block(X + cw * 4, Y, cw, th, T('👥 Kundensegmente'), T('Für wen schaffen wir Wert? Wer sind unsere wichtigsten Kunden?'));
      b.block(X, Y + th, cw * 2.5, bh, T('💸 Kostenstruktur'), T('Welches sind die wichtigsten Kosten? Welche Ressourcen und Aktivitäten sind am teuersten?'));
      b.block(X + cw * 2.5, Y + th, cw * 2.5, bh, T('💰 Einnahmequellen'), T('Wofür sind Kunden bereit zu zahlen? Wie würden sie am liebsten bezahlen?'));
      b.sticky(X + cw * 2 + 30, Y + 140, T('Unser Wertversprechen'), C.yellow);
      b.text(X, Y + th + bh + 12, 1600, T('Designed by: Strategyzer AG (strategyzer.com). Übersetzte Adaption des „Business Model Canvas“, lizenziert unter CC BY-SA 3.0 Unported (creativecommons.org/licenses/by-sa/3.0).'), 15, { color: '#495057' });
      return b.els;
    },
  },
  {
    id: 'lean', name: T('Lean Canvas'), category: 'Strategie', icon: '🚀',
    description: T('Geschäftsidee für Startups schnell validieren. Lean Canvas von Ash Maurya, CC BY-SA 3.0.'),
    build: () => {
      const b = new B();
      const X = 60, Y = 190, cw = 330, th = 700, bh = 300;
      b.frame(0, 0, X * 2 + cw * 5, Y + th + bh + 60, T('Lean Canvas'));
      b.heading(60, 40, T('Lean Canvas'), T('Produkt: …   ·   Version: …   ·   Datum: …'), 1500);
      b.block(X, Y, cw, th, T('❗ Problem'), T('Top 3 Probleme deiner Kunden.\n\nBestehende Alternativen: Wie lösen Kunden das Problem heute?'));
      b.block(X + cw, Y, cw, th / 2, T('💡 Lösung'), T('Top 3 Features, die das Problem lösen.'));
      b.block(X + cw, Y + th / 2, cw, th / 2, T('📊 Schlüsselkennzahlen'), T('Welche Kennzahlen zeigen, wie es läuft?'));
      b.block(X + cw * 2, Y, cw, th, T('⭐ Alleinstellungsmerkmal'), T('Eine klare, überzeugende Botschaft, warum du anders und kaufenswert bist.\n\nHigh-Level-Konzept: „X für Y“'), LIGHT.yellow);
      b.block(X + cw * 3, Y, cw, th / 2, T('🛡️ Unfairer Vorteil'), T('Was lässt sich nicht einfach kopieren oder kaufen?'));
      b.block(X + cw * 3, Y + th / 2, cw, th / 2, T('📣 Kanäle'), T('Wege zu deinen Kunden.'));
      b.block(X + cw * 4, Y, cw, th, T('🎯 Kundensegmente'), T('Zielkunden und Nutzer.\n\nEarly Adopters: Wer sind die ersten Kunden?'));
      b.block(X, Y + th, cw * 2.5, bh, T('💸 Kostenstruktur'), T('Akquisekosten, Vertriebskosten, Hosting, Personal …'));
      b.block(X + cw * 2.5, Y + th, cw * 2.5, bh, T('💰 Einnahmequellen'), T('Erlösmodell, Customer Lifetime Value, Umsatz, Marge'));
      b.text(X, Y + th + bh + 12, 1600, T('Übersetzte Adaption des „Lean Canvas“ von Ash Maurya (leanstack.com), basierend auf dem Business Model Canvas von Strategyzer AG (strategyzer.com), lizenziert unter CC BY-SA 3.0 Unported (creativecommons.org/licenses/by-sa/3.0).'), 15, { color: '#495057' });
      return b.els;
    },
  },
  {
    id: 'okr', name: T('OKR-Planung'), category: 'Strategie', icon: '🏁',
    description: T('Objectives & Key Results mit Initiativen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1620, 1000, T('OKR-Planung'));
      b.heading(60, 40, T('OKR-Planung'), T('Quartal: …   ·   Team: …'), 1200);
      const o = b.shape(60, 200, 1500, 110, { shape: 'roundrect', fill: '#4262ff', stroke: 'none', strokeWidth: 0, text: T('🎯 Objective: Qualitatives, inspirierendes Ziel formulieren'), textColor: '#fff', fontSize: 26, bold: true });
      for (let i = 0; i < 3; i++) {
        const x = 60 + i * 510;
        const kr = b.shape(x, 380, 480, 140, { shape: 'roundrect', fill: LIGHT.blue, stroke: '#4262ff', strokeWidth: 2, text: T`Key Result ${i + 1}\nMessbares Ergebnis (von X auf Y)`, fontSize: 18 });
        b.conn(o, kr, { routing: 'elbow', stroke: '#4262ff', fromSide: 'bottom', toSide: 'top' });
        b.zone(x, 560, 480, 380, LIGHT.grey, { text: T('Initiativen'), fontSize: 18, bold: true, align: 'left', valign: 'top' });
        b.sticky(x + 20, 620, T('Maßnahme'), C.yellow);
        b.text(x + 200, 640, 260, T('Fortschritt: 0 %\nVerantwortlich: …'), 16, { color: '#555' });
      }
      return b.els;
    },
  },
  {
    id: 'project-canvas', name: T('Projekt-Canvas'), category: 'Agile & Projekte', icon: '🗂️',
    description: T('Projektauftrag und Kick-off auf einen Blick.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1720, 1160, T('Projekt-Canvas'));
      b.heading(60, 40, T('Projekt-Canvas'), T('Projektname · Auftraggeber · Projektleitung'), 1200);
      const X = 60, Y = 190, w = 400, hh = 300;
      const blocks = [
        [T('🎯 Ziele'), T('Was wollen wir erreichen (SMART)?')], [T('📖 Hintergrund'), T('Warum machen wir das Projekt?')],
        [T('📦 Ergebnisse'), T('Was liefern wir konkret?')], [T('✅ Erfolgskriterien'), T('Woran messen wir den Erfolg?')],
        [T('👥 Team & Rollen'), T('Wer ist beteiligt, wer entscheidet?')], [T('🧑‍💼 Stakeholder'), T('Wen betrifft das Projekt?')],
        [T('🗓️ Meilensteine'), T('Wichtige Termine und Phasen')], [T('⚠️ Risiken'), T('Was kann schiefgehen?')],
        [T('💶 Budget & Ressourcen'), T('Was steht zur Verfügung?')], [T('🚫 Nicht im Umfang'), T('Was gehört bewusst nicht dazu?')],
        [T('🔗 Abhängigkeiten'), T('Wovon hängen wir ab?')], [T('❓ Offene Fragen'), T('Was müssen wir noch klären?')],
      ];
      blocks.forEach(([t, hint], i) => b.block(X + (i % 4) * w, Y + Math.floor(i / 4) * hh, w, hh, t, hint, i === 0 ? LIGHT.yellow : '#ffffff'));
      return b.els;
    },
  },
  {
    id: 'roadmap', name: T('Produkt-Roadmap'), category: 'Agile & Projekte', icon: '🛣️',
    description: T('Initiativen über Quartale und Themenbereiche planen.'),
    build: () => {
      const b = new B();
      const lanes = [[T('🧩 Produkt'), '#4262ff'], [T('📣 Marketing'), '#e64980'], [T('🛠️ Technik'), '#12b886'], [T('🎧 Support'), '#f59f00']];
      const qs = ['Q1', 'Q2', 'Q3', 'Q4'];
      const X = 260, Y = 200, qw = 360, lh = 190;
      b.frame(0, 0, X + qw * 4 + 60, Y + 70 + lh * lanes.length + 60, T('Produkt-Roadmap'));
      b.heading(60, 40, T('Produkt-Roadmap ') + new Date().getFullYear(), T('Themen und Initiativen pro Quartal'), 1200);
      qs.forEach((q, i) => b.shape(X + i * qw, Y, qw - 10, 60, { shape: 'roundrect', fill: '#1a1a1a', stroke: 'none', strokeWidth: 0, text: q, textColor: '#fff', fontSize: 22, bold: true, locked: true }));
      lanes.forEach(([t, col], i) => {
        const y = Y + 70 + i * lh;
        b.zone(60, y, X - 70 + qw * 4, lh - 10, i % 2 ? '#fafafa' : '#f3f4f6');
        b.text(76, y + 20, 170, t, 20, { bold: true, color: col });
      });
      const bar = (lane, q0, q1, text) => b.shape(X + q0 * qw + 10, Y + 70 + lane * lh + 40, (q1 - q0) * qw - 30, 70, { shape: 'roundrect', fill: lanes[lane][1], stroke: 'none', strokeWidth: 0, text, textColor: '#fff', fontSize: 18, bold: true });
      bar(0, 0, 2, T('MVP-Launch'));
      bar(0, 2, 4, T('Mobile App'));
      bar(1, 1, 2, T('Kampagne'));
      bar(2, 0, 1, T('Cloud-Migration'));
      bar(2, 2, 3, T('Performance'));
      bar(3, 1, 4, T('Self-Service-Portal'));
      return b.els;
    },
  },
  {
    id: 'timeline', name: T('Zeitstrahl'), category: 'Agile & Projekte', icon: '📍',
    description: T('Meilensteine auf einer Zeitachse darstellen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 760, T('Zeitstrahl'));
      b.heading(60, 40, T('Zeitstrahl'), T('Projektverlauf und Meilensteine'), 1200);
      b.line(80, 420, 1720, 420, { strokeWidth: 6, stroke: '#4d4d4d', arrowEnd: true });
      const ms = [T('Kick-off'), T('Konzept'), T('Design'), T('Entwicklung'), T('Test'), T('Go-live')];
      const cols = ['#4262ff', '#7048e8', '#e64980', '#f59f00', '#12b886', '#1098ad'];
      ms.forEach((m, i) => {
        const x = 160 + i * 280;
        const up = i % 2 === 0;
        b.shape(x - 18, 402, 36, 36, { shape: 'ellipse', fill: cols[i], stroke: '#ffffff', strokeWidth: 4 });
        b.line(x, up ? 400 : 440, x, up ? 330 : 510, { stroke: cols[i], strokeWidth: 2 });
        b.shape(x - 110, up ? 210 : 510, 220, 120, { shape: 'roundrect', fill: '#ffffff', stroke: cols[i], strokeWidth: 3, text: T`${m}\nKW ${10 + i * 4}`, fontSize: 18, bold: true });
      });
      return b.els;
    },
  },
  {
    id: 'gantt', name: T('Gantt-Diagramm'), category: 'Agile & Projekte', icon: '📊',
    description: T('Einfacher Projektzeitplan mit Arbeitspaketen und Wochen.'),
    build: () => {
      const b = new B();
      const weeks = 8, rows = 6, X = 60, Y = 190, cw0 = 260, cw = 140, rh = 64;
      const W = cw0 + cw * weeks;
      b.frame(0, 0, W + 120, Y + rh * (rows + 1) + 60, T('Gantt-Diagramm'));
      b.heading(60, 40, T('Gantt-Diagramm'), T('Projektzeitplan'), 1000);
      const tasks = [T('Analyse'), T('Konzeption'), T('Design'), T('Entwicklung'), T('Test'), T('Rollout')];
      const cells = [[T('Arbeitspaket'), ...Array.from({ length: weeks }, (_, i) => T`KW ${i + 1}`)], ...tasks.map((t) => [t, ...Array(weeks).fill('')])];
      // Tabelle mit gleich breiten Spalten -> erste Spalte über eine eigene Tabelle
      b.table(X, Y, cw0, rh * (rows + 1), cells.map((r) => [r[0]]));
      b.table(X + cw0, Y, cw * weeks, rh * (rows + 1), cells.map((r) => r.slice(1)), { fontSize: 13 });
      const spans = [[0, 2], [1, 3], [2, 4], [3, 7], [5, 7], [7, 8]];
      const cols = ['#4262ff', '#7048e8', '#e64980', '#f59f00', '#12b886', '#1098ad'];
      // Balken liegen genau auf den Wochenlinien – so rasten gezogene oder neue Balken passend ein
      spans.forEach(([s, e], i) => b.shape(X + cw0 + s * cw, Y + rh * (i + 1) + 14, (e - s) * cw, rh - 28, { shape: 'roundrect', fill: cols[i], stroke: 'none', strokeWidth: 0 }));
      return b.els;
    },
  },
  {
    id: 'storymap', name: T('User Story Map'), category: 'Agile & Projekte', icon: '🗺️',
    description: T('Nutzeraktivitäten, Aufgaben und Stories in Releases schneiden.'),
    build: () => {
      const b = new B();
      const acts = [T('Registrieren'), T('Produkt finden'), T('Bestellen'), T('Bezahlen')];
      const X = 260, cw = 360;
      b.frame(0, 0, X + cw * acts.length + 60, 1240, T('User Story Map'));
      b.heading(60, 40, T('User Story Map'), T('Persona: …   ·   Ziel: …'), 1200);
      b.text(60, 220, 180, T('Aktivitäten'), 18, { bold: true, color: '#e8590c' });
      b.text(60, 400, 180, T('Aufgaben'), 18, { bold: true, color: '#1971c2' });
      acts.forEach((a, i) => {
        const x = X + i * cw;
        b.sticky(x, 190, a, C.orange, 160, 140);
        b.sticky(x, 370, T('Aufgabe'), C.blue, 160, 140);
        b.sticky(x + 175, 370, T('Aufgabe'), C.blue, 160, 140);
      });
      [[T('Release 1 (MVP)'), 560], [T('Release 2'), 860]].forEach(([t, y]) => {
        b.line(60, y, X + cw * acts.length, y, { dash: true, stroke: '#868e96' });
        b.text(60, y + 20, 180, t, 18, { bold: true });
        acts.forEach((a, i) => b.sticky(X + i * cw, y + 20, T('User Story'), C.yellow, 160, 120));
      });
      return b.els;
    },
  },
  {
    id: 'weekly', name: T('Wochenplaner'), category: 'Agile & Projekte', icon: '🗓️',
    description: T('Aufgaben und Termine über die Woche verteilen.'),
    build: () => columnsTemplate(T('Wochenplaner'), T('KW … · Ziele der Woche: …'), [T('Montag'), T('Dienstag'), T('Mittwoch'), T('Donnerstag'), T('Freitag'), T('Wochenende')].map((d, i) => ({
      title: d, color: i === 5 ? C.violet : C.blue, light: i === 5 ? LIGHT.violet : LIGHT.blue,
    })), { colW: 240, colH: 640, stickies: 0 }),
  },
  {
    id: 'perspectives', name: T('Sechs Perspektiven'), category: 'Brainstorming', icon: '🎨',
    description: T('Ein Thema nacheinander aus sechs Blickwinkeln betrachten.'),
    build: () => columnsTemplate(T('Sechs Perspektiven'), T('Thema: …'), [
      { title: T('Ideen'), emoji: '💡', color: C.violet, light: LIGHT.violet, hint: T('Welche neuen Ansätze gibt es?') },
      { title: T('Fakten'), emoji: '📊', color: C.blue, light: LIGHT.blue, hint: T('Was wissen wir? Welche Informationen fehlen?') },
      { title: T('Chancen'), emoji: '☀️', color: C.teal, light: LIGHT.teal, hint: T('Welche Vorteile bietet es?') },
      { title: T('Risiken'), emoji: '⚠️', color: C.orange, light: LIGHT.orange, hint: T('Was könnte schiefgehen?') },
      { title: T('Gefühle'), emoji: '❤️', color: C.pink, light: LIGHT.pink, hint: T('Was sagt das Bauchgefühl?') },
      { title: T('Vorgehen'), emoji: '🧭', color: C.grey, light: LIGHT.grey, hint: T('Was ist der nächste Schritt?') },
    ], { colW: 260, colH: 640 }),
  },
  {
    id: 'crazy8', name: T('Crazy 8s'), category: 'Brainstorming', icon: '✏️',
    description: T('8 Skizzen in 8 Minuten – schnelle Ideenfindung.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1720, 1060, T('Crazy 8s'));
      b.heading(60, 40, T('Crazy 8s'), T('8 Ideen in 8 Minuten skizzieren – eine Minute pro Feld (Timer starten!)'), 1500);
      for (let i = 0; i < 8; i++) {
        const x = 60 + (i % 4) * 405, y = 190 + Math.floor(i / 4) * 420;
        b.shape(x, y, 385, 400, { fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 2, locked: true, text: String(i + 1), fontSize: 20, bold: true, align: 'left', valign: 'top' });
      }
      return b.els;
    },
  },
  {
    id: 'pros-cons', name: T('Pro & Contra'), category: 'Brainstorming', icon: '⚖️',
    description: T('Argumente für eine Entscheidung abwägen.'),
    build: () => columnsTemplate(T('Pro & Contra'), T('Entscheidung: …'), [
      { title: T('Pro'), emoji: '👍', color: C.green, light: LIGHT.green, sticky: C.green },
      { title: T('Contra'), emoji: '👎', color: C.red, light: LIGHT.red, sticky: C.red },
    ], { colW: 600, colH: 640 }),
  },
  {
    id: 'decision-matrix', name: T('Entscheidungsmatrix'), category: 'Strategie', icon: '🧮',
    description: T('Optionen anhand gewichteter Kriterien vergleichen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1400, 860, T('Entscheidungsmatrix'));
      b.heading(60, 40, T('Entscheidungsmatrix'), T('Kriterien gewichten (1–5), Optionen bewerten (1–10), Summe bilden'), 1300);
      b.table(60, 200, 1280, 560, [
        [T('Kriterium'), T('Gewichtung'), T('Option A'), T('Option B'), T('Option C')],
        [T('Kosten'), '5', '', '', ''],
        [T('Nutzen'), '4', '', '', ''],
        [T('Aufwand'), '3', '', '', ''],
        [T('Risiko'), '3', '', '', ''],
        [T('Zeit bis Umsetzung'), '2', '', '', ''],
        [T('Summe (gewichtet)'), '', '', '', ''],
      ], { fontSize: 16 });
      return b.els;
    },
  },
  {
    id: 'five-whys', name: '5-Why-Methode', category: 'Diagramme', icon: '❓',
    description: T('Ursachen durch fünfmaliges Nachfragen ergründen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1900, 620, '5-Why-Methode');
      b.heading(60, 40, '5-Why-Methode', T('Problem beschreiben und fünfmal „Warum?“ fragen'), 1200);
      let prev = b.shape(60, 260, 230, 180, { shape: 'roundrect', fill: '#ffc9c9', stroke: '#e03131', strokeWidth: 2, text: T('Problem:\n…'), fontSize: 18, bold: true });
      for (let i = 1; i <= 5; i++) {
        const n = b.sticky(340 + (i - 1) * 250, 275, T`Warum ${i}?\n…`, i === 5 ? C.orange : C.yellow, 150, 150);
        b.conn(prev, n, { routing: 'straight' });
        prev = n;
      }
      const root = b.shape(1600, 260, 230, 180, { shape: 'roundrect', fill: '#b2f2bb', stroke: '#2f9e44', strokeWidth: 2, text: T('Grundursache:\n…'), fontSize: 18, bold: true });
      b.conn(prev, root, { routing: 'straight' });
      return b.els;
    },
  },
  {
    id: 'fishbone', name: T('Ishikawa (Fischgräte)'), category: 'Diagramme', icon: '🐟',
    description: T('Ursache-Wirkungs-Diagramm nach den 6 M.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 940, T('Ishikawa-Diagramm'));
      b.heading(60, 40, T('Ishikawa-Diagramm'), T('Ursachen nach Kategorien sammeln'), 1200);
      const sy = 560;
      b.line(80, sy, 1440, sy, { strokeWidth: 5, arrowEnd: true });
      b.shape(1450, sy - 90, 290, 180, { shape: 'roundrect', fill: '#ffc9c9', stroke: '#e03131', strokeWidth: 3, text: T('Wirkung / Problem'), fontSize: 22, bold: true });
      const cats = [T('Mensch'), T('Maschine'), T('Methode'), T('Material'), T('Messung'), T('Mitwelt')];
      cats.forEach((c, i) => {
        const top = i < 3;
        const x = 280 + (i % 3) * 400;
        const y2 = top ? 240 : 880;
        b.line(x - 150, y2, x + 60, sy, { strokeWidth: 3 });
        b.shape(x - 250, top ? y2 - 60 : y2 - 10, 200, 56, { shape: 'roundrect', fill: '#1a1a1a', stroke: 'none', strokeWidth: 0, text: c, textColor: '#fff', fontSize: 20, bold: true });
        b.sticky(x - 20, top ? 300 : 650, '', C.yellow, 120, 120);
      });
      return b.els;
    },
  },
  {
    id: 'flowchart', name: T('Flussdiagramm'), category: 'Diagramme', icon: '🔀',
    description: T('Prozesse mit Start, Schritten und Entscheidungen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1500, 1200, T('Flussdiagramm'));
      b.heading(60, 40, T('Flussdiagramm'), T('Prozess: …'), 1000);
      const start = b.shape(560, 180, 220, 80, { shape: 'pill', fill: '#b2f2bb', stroke: '#2f9e44', text: T('Start'), bold: true, fontSize: 18 });
      const s1 = b.shape(540, 330, 260, 110, { fill: '#d0ebff', stroke: '#1971c2', text: T('Antrag einreichen'), fontSize: 18 });
      const d = b.shape(545, 510, 250, 170, { shape: 'diamond', fill: '#fff3bf', stroke: '#f08c00', text: T('Vollständig?'), fontSize: 18 });
      const s2 = b.shape(540, 750, 260, 110, { fill: '#d0ebff', stroke: '#1971c2', text: T('Antrag prüfen'), fontSize: 18 });
      const fix = b.shape(980, 540, 260, 110, { fill: '#ffe3e3', stroke: '#e03131', text: T('Unterlagen nachfordern'), fontSize: 18 });
      const doc = b.shape(150, 750, 240, 120, { shape: 'document', fill: '#f3f0ff', stroke: '#7048e8', text: T('Bescheid'), fontSize: 18 });
      const end = b.shape(560, 950, 220, 80, { shape: 'pill', fill: '#ffc9c9', stroke: '#e03131', text: T('Ende'), bold: true, fontSize: 18 });
      b.conn(start, s1, { routing: 'elbow' });
      b.conn(s1, d, { routing: 'elbow' });
      b.conn(d, s2, { routing: 'elbow', label: T('Ja') });
      b.conn(d, fix, { routing: 'elbow', label: T('Nein'), fromSide: 'right', toSide: 'left' });
      b.conn(fix, s1, { routing: 'elbow', fromSide: 'top', toSide: 'right' });
      b.conn(s2, doc, { routing: 'elbow', dash: true });
      b.conn(s2, end, { routing: 'elbow' });
      return b.els;
    },
  },
  {
    id: 'orgchart', name: T('Organigramm'), category: 'Diagramme', icon: '🏛️',
    description: T('Hierarchien und Verantwortlichkeiten darstellen.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1640, 860, T('Organigramm'));
      b.heading(60, 40, T('Organigramm'), T('Organisation · Stand ') + new Date().toLocaleDateString(LOCALE), 1000);
      const box = (x, y, t, col) => b.shape(x, y, 240, 90, { shape: 'roundrect', fill: col, stroke: 'none', strokeWidth: 0, text: t, fontSize: 17, bold: true, textColor: '#fff' });
      const ceo = box(700, 190, T('Geschäftsführung\nName'), '#1a1a1a');
      const heads = [[T('Vertrieb\nName'), '#4262ff'], [T('Produkt\nName'), '#7048e8'], [T('Technik\nName'), '#12b886'], [T('Finanzen\nName'), '#f59f00']];
      heads.forEach(([t, col], i) => {
        const hx = 100 + i * 390;
        const hd = box(hx, 380, t, col);
        b.conn(ceo, hd, { routing: 'elbow', arrowEnd: false, fromSide: 'bottom', toSide: 'top' });
        for (let j = 0; j < 2; j++) {
          const m = b.shape(hx + 20, 540 + j * 120, 200, 80, { shape: 'roundrect', fill: '#ffffff', stroke: col, strokeWidth: 2, text: T`Team ${j + 1}\nName`, fontSize: 15 });
          b.conn(hd, m, { routing: 'elbow', arrowEnd: false, stroke: col, fromSide: 'left', toSide: 'left' });
        }
      });
      return b.els;
    },
  },
  {
    id: 'journey', name: T('Customer Journey Map'), category: 'Design & UX', icon: '🧳',
    description: T('Kundenerlebnis entlang aller Phasen und Touchpoints.'),
    build: () => {
      const b = new B();
      const phases = [T('Aufmerksamkeit'), T('Recherche'), T('Kauf'), T('Nutzung'), T('Bindung')];
      const rows = [[T('🎯 Ziele'), LIGHT.grey], [T('📱 Touchpoints'), LIGHT.blue], [T('🏃 Aktivitäten'), LIGHT.grey], [T('💭 Gedanken'), LIGHT.violet], [T('😊 Emotionen'), LIGHT.yellow], [T('⚡ Pain Points'), LIGHT.red], [T('💡 Chancen'), LIGHT.green]];
      const X = 60, Y = 200, hw = 230, cw = 300, rh = 160;
      b.frame(0, 0, X + hw + cw * phases.length + 60, Y + 80 + rows.length * rh + 40, T('Customer Journey Map'));
      b.heading(60, 40, T('Customer Journey Map'), T('Persona: …   ·   Szenario: …'), 1400);
      phases.forEach((p, i) => b.shape(X + hw + i * cw, Y, cw - 10, 70, { shape: 'arrow', fill: '#4262ff', stroke: 'none', strokeWidth: 0, text: p, textColor: '#fff', fontSize: 18, bold: true, locked: true }));
      rows.forEach(([t, fill], r) => {
        const y = Y + 80 + r * rh;
        b.zone(X, y, hw - 10, rh - 10, '#1a1a1a', { text: t, textColor: '#fff', fontSize: 18, bold: true });
        for (let i = 0; i < phases.length; i++) b.zone(X + hw + i * cw, y, cw - 10, rh - 10, fill);
      });
      const ey = Y + 80 + 4 * rh;
      ['😐', '🤔', '😀', '😍', '🙂'].forEach((e, i) => b.emoji(X + hw + i * cw + 115, ey + 30 + [40, 60, 10, 0, 20][i], e, 60));
      b.sticky(X + hw + 15, Y + 95, T('Kunde möchte …'), C.yellow, 130, 130);
      return b.els;
    },
  },
  {
    id: 'empathy', name: T('Empathy Map'), category: 'Design & UX', icon: '❤️',
    description: T('Was sagt, denkt, tut und fühlt die Zielgruppe?'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1400, 1300, T('Empathy Map'));
      b.heading(60, 40, T('Empathy Map'), T('Für wen? …'), 1000);
      const X = 60, Y = 190, S = 640;
      const q = [[T('💬 Sagt'), T('Was sagt die Person? Zitate & Aussagen'), LIGHT.blue], [T('🧠 Denkt'), T('Was geht ihr durch den Kopf?'), LIGHT.violet], [T('🏃 Tut'), T('Was tut sie? Verhalten & Handlungen'), LIGHT.green], [T('❤️ Fühlt'), T('Welche Gefühle bewegen sie?'), LIGHT.pink]];
      q.forEach(([t, hint, fill], i) => {
        const x = X + (i % 2) * (S + 0), y = Y + Math.floor(i / 2) * (S * 0.75);
        b.block(x, y, S, S * 0.75, t, hint, fill, i % 2 ? 'right' : 'left');
      });
      b.shape(X + S - 110, Y + S * 0.75 - 110, 220, 220, { shape: 'ellipse', fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 3, text: T('👤\nPersona'), fontSize: 22, bold: true });
      const by = Y + S * 1.5 + 20;
      b.block(X, by, S, 180, T('😣 Pains'), T('Ängste, Frustrationen, Hindernisse'), LIGHT.red);
      b.block(X + S, by, S, 180, T('🌟 Gains'), T('Wünsche, Bedürfnisse, Erfolgsmaßstäbe'), LIGHT.yellow);
      return b.els;
    },
  },
  {
    id: 'persona', name: T('User Persona'), category: 'Design & UX', icon: '🧑',
    description: T('Steckbrief einer typischen Zielperson.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1500, 980, T('User Persona'));
      b.heading(60, 40, T('User Persona'), T('Basierend auf Interviews und Daten'), 1000);
      b.shape(60, 190, 260, 260, { shape: 'ellipse', fill: LIGHT.blue, stroke: '#4262ff', strokeWidth: 3, text: '👤', fontSize: 110 });
      b.text(360, 200, 500, T('Name Nachname'), 36, { bold: true });
      b.text(360, 260, 500, T('Alter: …\nBeruf: …\nWohnort: …\nFamilienstand: …'), 18, { color: '#444' });
      b.block(900, 190, 540, 260, T('💬 Zitat'), T('„Ein typischer Satz, der die Persona beschreibt.“'), LIGHT.yellow);
      b.block(60, 480, 450, 440, T('🎯 Ziele'), T('Was möchte die Persona erreichen?'), LIGHT.green);
      b.block(525, 480, 450, 440, T('😤 Frustrationen'), T('Was hält sie davon ab?'), LIGHT.red);
      b.block(990, 480, 450, 210, T('⚡ Motivation'), T('Was treibt sie an?'), LIGHT.violet);
      b.block(990, 710, 450, 210, T('📱 Kanäle & Tools'), T('Welche Medien und Tools nutzt sie?'), LIGHT.blue);
      return b.els;
    },
  },
  {
    id: 'moodboard', name: T('Moodboard'), category: 'Design & UX', icon: '🎨',
    description: T('Bilder, Farben und Stimmungen sammeln.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1600, 1000, T('Moodboard'), '#fafafa');
      b.heading(60, 40, T('Moodboard'), T('Bilder per Drag & Drop hineinziehen'), 1000);
      const ph = [[60, 190, 500, 360], [580, 190, 360, 360], [960, 190, 580, 240], [60, 570, 360, 380], [440, 570, 500, 380]];
      ph.forEach(([x, y, w, hh]) => b.shape(x, y, w, hh, { fill: '#e9ecef', stroke: '#ced4da', strokeWidth: 2, dash: true, text: T('🖼️ Bild hier ablegen'), textColor: '#868e96', fontSize: 18 }));
      b.text(960, 450, 400, T('Farbpalette'), 22, { bold: true });
      ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'].forEach((c, i) => b.shape(960 + i * 115, 500, 100, 100, { shape: 'ellipse', fill: c, stroke: 'none', strokeWidth: 0 }));
      b.text(960, 640, 560, T('Schlüsselwörter'), 22, { bold: true });
      ['modern', 'warm', T('natürlich'), 'verspielt'].forEach((k, i) => b.shape(960 + (i % 2) * 290, 690 + Math.floor(i / 2) * 90, 270, 70, { shape: 'pill', fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 2, text: k, fontSize: 20 }));
      return b.els;
    },
  },
  {
    id: 'wireframe', name: T('Wireframe (Web)'), category: 'Design & UX', icon: '🖥️',
    description: T('Grobes Layout einer Webseite skizzieren.'),
    build: () => {
      const b = new B();
      b.frame(0, 0, 1400, 1100, T('Wireframe – Startseite'), '#ffffff');
      const g = { fill: '#f1f3f5', stroke: '#adb5bd', strokeWidth: 2, textColor: '#495057', fontSize: 18 };
      b.shape(60, 60, 1280, 80, { ...g, text: T('Logo        Navigation   ·   Produkte   ·   Über uns   ·   Kontakt'), align: 'left' });
      b.shape(60, 170, 1280, 380, { ...g, text: T('Hero-Bild / Headline\n\n[ Call-to-Action ]'), fontSize: 28 });
      for (let i = 0; i < 3; i++) b.shape(60 + i * 435, 590, 410, 280, { ...g, text: T`Feature ${i + 1}\nKurzbeschreibung` });
      b.shape(60, 900, 1280, 140, { ...g, text: T('Footer · Impressum · Datenschutz · Social Media') });
      return b.els;
    },
  },
];

TEMPLATES.push(...TECH_TEMPLATES, ...DIAGRAM_TEMPLATES);

export function templateById(id) {
  return TEMPLATES.find((t) => t.id === id);
}
