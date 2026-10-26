// Vorlagen-Bibliothek mit gängigen Moderations-, Agile- und Strategiemethoden
import { B, C, LIGHT, dayOffset, columnsTemplate, quadrantTemplate } from './template-kit.js';
import { TECH_TEMPLATES } from './templates-tech.js';

/* ---------------- Vorlagen ---------------- */

export const CATEGORIES = ['Alle', 'Brainstorming', 'Meetings & Retros', 'Agile & Projekte', 'Softwareentwicklung', 'Projektmanagement', 'IT-Service-Management', 'Strategie', 'Design & UX', 'Diagramme'];

export const TEMPLATES = [
  {
    id: 'blank', name: 'Leeres Board', category: 'Alle', icon: '⬜',
    description: 'Unendliche Leinwand ohne Vorgaben.',
    build: () => [],
  },
  {
    id: 'brainstorm', name: 'Brainstorming', category: 'Brainstorming', icon: '💡',
    description: 'Ideen sammeln, clustern und abstimmen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 1120, 'Brainstorming');
      b.heading(60, 40, 'Brainstorming', 'Ideen sammeln · clustern · bewerten', 1000);
      b.shape(650, 190, 500, 120, { shape: 'pill', fill: '#4262ff', stroke: 'none', strokeWidth: 0, text: 'Wie können wir …?', fontSize: 28, bold: true });
      b.shape(1260, 40, 480, 270, { shape: 'roundrect', fill: '#f4f4f5', stroke: 'none', strokeWidth: 0, locked: true, align: 'left', valign: 'top', fontSize: 16,
        text: 'So geht\'s\n\n1. Jede:r notiert Ideen auf Sticky Notes (10 Min.)\n2. Ideen kurz vorstellen\n3. Ähnliche Ideen in Cluster ziehen\n4. Abstimmen – 3 Stimmen pro Person\n5. Nächste Schritte festlegen' });
      const zones = [[60, 360, 'Cluster A', C.yellow], [940, 360, 'Cluster B', C.blue], [60, 740, 'Cluster C', C.green], [940, 740, 'Cluster D', C.pink]];
      for (const [x, y, t, col] of zones) {
        b.shape(x, y, 800, 340, { shape: 'roundrect', fill: 'transparent', stroke: '#b5b5b5', strokeWidth: 2, dash: true, locked: true, text: t, fontSize: 18, bold: true, align: 'left', valign: 'top', textColor: '#8a8a8a' });
        b.sticky(x + 30, y + 60, 'Idee', col);
        b.sticky(x + 200, y + 60, '', col);
      }
      return b.els;
    },
  },
  {
    id: 'mindmap', name: 'Mindmap', category: 'Brainstorming', icon: '🧠',
    description: 'Gedanken hierarchisch um ein zentrales Thema anordnen. Tipp: Knoten auswählen und Tab (Kind) oder Enter (Geschwister) drücken.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1700, 1000, 'Mindmap');
      const root = b.shape(700, 450, 300, 100, { shape: 'pill', fill: '#1a1a1a', stroke: 'none', strokeWidth: 0, text: 'Zentrales Thema', textColor: '#ffffff', fontSize: 26, bold: true, mind: true });
      const branches = [
        [1110, 230, 'Thema 1', '#4262ff', 1], [1110, 670, 'Thema 2', '#12b886', 1],
        [370, 230, 'Thema 3', '#f59f00', -1], [370, 670, 'Thema 4', '#e64980', -1],
      ];
      for (const [x, y, t, col, dir] of branches) {
        const n = b.shape(x, y, 220, 70, { shape: 'roundrect', fill: col, stroke: 'none', strokeWidth: 0, text: t, textColor: '#ffffff', fontSize: 20, bold: true, mind: true });
        b.conn(root, n, { stroke: col, strokeWidth: 4, arrowEnd: false, mind: true });
        [-55, 65].forEach((dy, i) => {
          const cx = dir > 0 ? x + 300 : x - 260;
          const c = b.shape(cx, y + dy, 180, 50, { shape: 'pill', fill: '#ffffff', stroke: col, strokeWidth: 2, text: `Unterpunkt ${i + 1}`, fontSize: 16, mind: true });
          b.conn(n, c, { stroke: col, strokeWidth: 2, arrowEnd: false, mind: true });
        });
      }
      return b.els;
    },
  },
  {
    id: 'kanban', name: 'Kanban-Board', category: 'Agile & Projekte', icon: '📋',
    description: 'Aufgaben in Spalten durch den Workflow bewegen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1640, 1080, 'Kanban-Board');
      b.heading(60, 40, 'Kanban-Board', 'Team · Sprint · Ziel', 1000);
      const cols = [['📥  Backlog', '#9e9e9e'], ['📝  Zu erledigen', '#4262ff'], ['⚙️  In Arbeit', '#f59f00'], ['✅  Erledigt', '#12b886']];
      cols.forEach(([t, col], i) => {
        const x = 60 + i * 390;
        b.zone(x, 190, 360, 840, '#f1f2f5');
        b.shape(x, 190, 360, 64, { shape: 'roundrect', fill: '#ffffff', stroke: col, strokeWidth: 3, text: t, fontSize: 20, bold: true, locked: true });
      });
      b.card(90, 280, 'Ideen für Q3 sammeln', { color: '#9e9e9e', description: 'Input aus dem Workshop einarbeiten' });
      b.card(480, 280, 'Anforderungen dokumentieren', { color: '#4262ff', assignee: 'Anna Muster', due: dayOffset(5), status: 'Hoch' });
      b.card(480, 440, 'Wireframes erstellen', { color: '#4262ff', assignee: 'Ben Beispiel', due: dayOffset(9) });
      b.card(870, 280, 'API-Schnittstelle entwickeln', { color: '#f59f00', assignee: 'Chris Code', due: dayOffset(2), status: 'In Arbeit', description: 'REST-Endpunkte für Benutzerverwaltung' });
      b.card(1260, 280, 'Projekt-Setup', { color: '#12b886', assignee: 'Anna Muster', status: 'Fertig' });
      return b.els;
    },
  },
  {
    id: 'retro-ssc', name: 'Retro: Start · Stop · Continue', category: 'Meetings & Retros', icon: '🔄',
    description: 'Was sollten wir beginnen, lassen, beibehalten?',
    build: () => columnsTemplate('Retrospektive: Start · Stop · Continue', 'Sprint · Datum · Team', [
      { title: 'Start', emoji: '🚀', color: C.green, light: LIGHT.green, hint: 'Was sollten wir neu ausprobieren?', sticky: C.green },
      { title: 'Stop', emoji: '🛑', color: C.red, light: LIGHT.red, hint: 'Was sollten wir nicht mehr tun?', sticky: C.red },
      { title: 'Continue', emoji: '👍', color: C.blue, light: LIGHT.blue, hint: 'Was läuft gut und soll bleiben?', sticky: C.blue },
    ]),
  },
  {
    id: 'retro-msg', name: 'Retro: Mad · Sad · Glad', category: 'Meetings & Retros', icon: '😊',
    description: 'Emotionen im Team sichtbar machen.',
    build: () => columnsTemplate('Retrospektive: Mad · Sad · Glad', 'Sprint · Datum · Team', [
      { title: 'Mad', emoji: '😠', color: C.red, light: LIGHT.red, hint: 'Was hat mich geärgert?', sticky: C.red },
      { title: 'Sad', emoji: '😢', color: C.blue, light: LIGHT.blue, hint: 'Was hat mich enttäuscht?', sticky: C.blue },
      { title: 'Glad', emoji: '😄', color: C.green, light: LIGHT.green, hint: 'Was hat mich gefreut?', sticky: C.green },
    ]),
  },
  {
    id: 'retro-4l', name: 'Retro: 4L', category: 'Meetings & Retros', icon: '4️⃣',
    description: 'Liked, Learned, Lacked, Longed for.',
    build: () => columnsTemplate('Retrospektive: 4L', 'Liked · Learned · Lacked · Longed for', [
      { title: 'Liked', emoji: '❤️', color: C.pink, light: LIGHT.pink, hint: 'Was hat uns gefallen?' },
      { title: 'Learned', emoji: '📚', color: C.blue, light: LIGHT.blue, hint: 'Was haben wir gelernt?' },
      { title: 'Lacked', emoji: '🕳️', color: C.orange, light: LIGHT.orange, hint: 'Was hat gefehlt?' },
      { title: 'Longed for', emoji: '✨', color: C.violet, light: LIGHT.violet, hint: 'Was wünschen wir uns?' },
    ], { colW: 340 }),
  },
  {
    id: 'retro-sailboat', name: 'Retro: Segelboot', category: 'Meetings & Retros', icon: '⛵',
    description: 'Wind, Anker, Felsen und Insel – bildhafte Retrospektive.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 1100, 'Retrospektive: Segelboot');
      b.heading(60, 40, 'Retrospektive: Segelboot', 'Was treibt uns an, was hält uns auf?', 1000);
      b.shape(0, 620, 1800, 480, { fill: '#d6ecff', stroke: 'none', strokeWidth: 0, locked: true });
      b.emoji(780, 420, '⛵', 240);
      b.emoji(1450, 470, '🏝️', 200);
      b.emoji(860, 860, '⚓', 120);
      b.emoji(1580, 900, '🪨', 120);
      b.emoji(260, 300, '💨', 140);
      b.shape(60, 200, 520, 380, { shape: 'roundrect', fill: 'transparent', stroke: '#8bb8e8', strokeWidth: 2, dash: true, locked: true, text: '💨 Wind – Was treibt uns an?', fontSize: 20, bold: true, align: 'left', valign: 'top' });
      b.shape(1240, 200, 500, 280, { shape: 'roundrect', fill: 'transparent', stroke: '#93d275', strokeWidth: 2, dash: true, locked: true, text: '🏝️ Insel – Was ist unser Ziel?', fontSize: 20, bold: true, align: 'left', valign: 'top' });
      b.shape(60, 680, 640, 380, { shape: 'roundrect', fill: 'transparent', stroke: '#6b7f99', strokeWidth: 2, dash: true, locked: true, text: '⚓ Anker – Was bremst uns?', fontSize: 20, bold: true, align: 'left', valign: 'top' });
      b.shape(1040, 680, 700, 380, { shape: 'roundrect', fill: 'transparent', stroke: '#e8590c', strokeWidth: 2, dash: true, locked: true, text: '🪨 Felsen – Welche Risiken sehen wir?', fontSize: 20, bold: true, align: 'left', valign: 'top' });
      b.sticky(100, 270, '', C.blue);
      b.sticky(1280, 270, '', C.green);
      b.sticky(100, 750, '', C.grey);
      b.sticky(1080, 750, '', C.orange);
      return b.els;
    },
  },
  {
    id: 'standup', name: 'Daily Stand-up', category: 'Meetings & Retros', icon: '☕',
    description: 'Gestern · Heute · Hindernisse – kurz und knackig.',
    build: () => columnsTemplate('Daily Stand-up', new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }), [
      { title: 'Gestern erledigt', emoji: '✅', color: C.green, light: LIGHT.green },
      { title: 'Heute geplant', emoji: '🎯', color: C.blue, light: LIGHT.blue },
      { title: 'Hindernisse', emoji: '🚧', color: C.red, light: LIGHT.red },
    ], { colH: 600 }),
  },
  {
    id: 'checkin', name: 'Check-in / Icebreaker', category: 'Meetings & Retros', icon: '👋',
    description: 'Stimmungsbarometer und Vorstellungsrunde zum Meeting-Start.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1600, 980, 'Check-in');
      b.heading(60, 40, 'Check-in', 'Wie ist deine Stimmung heute? Setze einen Punkt (Emoji) unter dein Wetter.', 1400);
      const weather = [['☀️', 'Sonnig'], ['⛅', 'Heiter'], ['☁️', 'Bewölkt'], ['🌧️', 'Regnerisch'], ['⛈️', 'Gewitter']];
      weather.forEach(([e, t], i) => {
        const x = 60 + i * 300;
        b.zone(x, 190, 280, 380, LIGHT.blue);
        b.emoji(x + 90, 210, e, 100);
        b.text(x, 320, 280, t, 22, { bold: true, align: 'center' });
      });
      b.shape(60, 610, 1480, 320, { shape: 'roundrect', fill: LIGHT.yellow, stroke: 'none', strokeWidth: 0, locked: true, text: '🙋 Vorstellungsrunde: Name · Rolle · ein Fun Fact', fontSize: 22, bold: true, align: 'left', valign: 'top' });
      b.sticky(90, 690, 'Name\nRolle\nFun Fact', C.yellow, 200, 200);
      return b.els;
    },
  },
  {
    id: 'swot', name: 'SWOT-Analyse', category: 'Strategie', icon: '🧭',
    description: 'Stärken, Schwächen, Chancen und Risiken bewerten.',
    build: () => quadrantTemplate('SWOT-Analyse', 'Interne und externe Faktoren strategisch bewerten', [
      { title: 'Stärken', emoji: '💪', color: C.green, light: LIGHT.green, hint: 'Was können wir besonders gut? Welche Ressourcen haben wir?', sticky: C.green },
      { title: 'Schwächen', emoji: '⚠️', color: C.orange, light: LIGHT.orange, hint: 'Wo haben wir Defizite? Was sollten wir verbessern?', sticky: C.orange },
      { title: 'Chancen', emoji: '🌱', color: C.blue, light: LIGHT.blue, hint: 'Welche Trends und Möglichkeiten können wir nutzen?', sticky: C.blue },
      { title: 'Risiken', emoji: '⛈️', color: C.red, light: LIGHT.red, hint: 'Welche externen Gefahren bedrohen uns?', sticky: C.red },
    ]),
  },
  {
    id: 'eisenhower', name: 'Eisenhower-Matrix', category: 'Agile & Projekte', icon: '⏱️',
    description: 'Aufgaben nach Dringlichkeit und Wichtigkeit priorisieren.',
    build: () => quadrantTemplate('Eisenhower-Matrix', 'Wichtig vs. dringend', [
      { title: 'Sofort erledigen', emoji: '🔥', color: C.red, light: LIGHT.red, hint: 'Wichtig & dringend' },
      { title: 'Einplanen', emoji: '📅', color: C.blue, light: LIGHT.blue, hint: 'Wichtig & nicht dringend' },
      { title: 'Delegieren', emoji: '🤝', color: C.yellow, light: LIGHT.yellow, hint: 'Nicht wichtig & dringend' },
      { title: 'Eliminieren', emoji: '🗑️', color: C.grey, light: LIGHT.grey, hint: 'Nicht wichtig & nicht dringend' },
    ], { xAxis: 'Dringlichkeit ➜ (links: dringend)', yAxis: '↑ Wichtigkeit' }),
  },
  {
    id: 'impact-effort', name: 'Impact/Aufwand-Matrix', category: 'Agile & Projekte', icon: '🎯',
    description: 'Ideen nach Nutzen und Aufwand priorisieren.',
    build: () => quadrantTemplate('Impact/Aufwand-Matrix', 'Wo erzielen wir mit wenig Aufwand viel Wirkung?', [
      { title: 'Quick Wins', emoji: '⚡', color: C.green, light: LIGHT.green, hint: 'Hoher Impact, geringer Aufwand' },
      { title: 'Große Projekte', emoji: '🏔️', color: C.blue, light: LIGHT.blue, hint: 'Hoher Impact, hoher Aufwand' },
      { title: 'Lückenfüller', emoji: '🧩', color: C.yellow, light: LIGHT.yellow, hint: 'Geringer Impact, geringer Aufwand' },
      { title: 'Zeitfresser', emoji: '🕳️', color: C.red, light: LIGHT.red, hint: 'Geringer Impact, hoher Aufwand' },
    ], { xAxis: 'Aufwand ➜', yAxis: '↑ Impact' }),
  },
  {
    id: 'stakeholder', name: 'Stakeholder-Map', category: 'Strategie', icon: '👥',
    description: 'Stakeholder nach Einfluss und Interesse einordnen.',
    build: () => quadrantTemplate('Stakeholder-Map', 'Einfluss vs. Interesse', [
      { title: 'Zufriedenstellen', emoji: '🙂', color: C.yellow, light: LIGHT.yellow, hint: 'Hoher Einfluss, geringes Interesse' },
      { title: 'Eng einbinden', emoji: '🤝', color: C.green, light: LIGHT.green, hint: 'Hoher Einfluss, hohes Interesse' },
      { title: 'Beobachten', emoji: '👀', color: C.grey, light: LIGHT.grey, hint: 'Geringer Einfluss, geringes Interesse' },
      { title: 'Informieren', emoji: '📣', color: C.blue, light: LIGHT.blue, hint: 'Geringer Einfluss, hohes Interesse' },
    ], { xAxis: 'Interesse ➜', yAxis: '↑ Einfluss' }),
  },
  {
    id: 'bmc', name: 'Business Model Canvas', category: 'Strategie', icon: '🏢',
    description: 'Geschäftsmodell auf einer Seite. Business Model Canvas von Strategyzer AG, CC BY-SA 3.0.',
    build: () => {
      const b = new B();
      const X = 60, Y = 190, cw = 330, th = 700, bh = 330;
      b.frame(0, 0, X * 2 + cw * 5, Y + th + bh + 60, 'Business Model Canvas');
      b.heading(60, 40, 'Business Model Canvas', 'Entworfen für: …   ·   Entworfen von: …   ·   Datum: …', 1500);
      b.block(X, Y, cw, th, '🤝 Schlüsselpartner', 'Wer sind unsere wichtigsten Partner und Lieferanten? Welche Ressourcen beziehen wir von ihnen?');
      b.block(X + cw, Y, cw, th / 2, '⚙️ Schlüsselaktivitäten', 'Welche Aktivitäten erfordert unser Wertangebot?');
      b.block(X + cw, Y + th / 2, cw, th / 2, '🧱 Schlüsselressourcen', 'Welche Ressourcen erfordert unser Wertangebot?');
      b.block(X + cw * 2, Y, cw, th, '🎁 Wertangebote', 'Welchen Wert liefern wir? Welche Probleme lösen wir? Welche Bedürfnisse erfüllen wir?', LIGHT.yellow);
      b.block(X + cw * 3, Y, cw, th / 2, '💬 Kundenbeziehungen', 'Welche Art von Beziehung erwarten unsere Kundensegmente?');
      b.block(X + cw * 3, Y + th / 2, cw, th / 2, '🚚 Kanäle', 'Über welche Kanäle erreichen wir unsere Kunden?');
      b.block(X + cw * 4, Y, cw, th, '👥 Kundensegmente', 'Für wen schaffen wir Wert? Wer sind unsere wichtigsten Kunden?');
      b.block(X, Y + th, cw * 2.5, bh, '💸 Kostenstruktur', 'Welches sind die wichtigsten Kosten? Welche Ressourcen und Aktivitäten sind am teuersten?');
      b.block(X + cw * 2.5, Y + th, cw * 2.5, bh, '💰 Einnahmequellen', 'Wofür sind Kunden bereit zu zahlen? Wie würden sie am liebsten bezahlen?');
      b.sticky(X + cw * 2 + 30, Y + 140, 'Unser Wertversprechen', C.yellow);
      b.text(X, Y + th + bh + 12, 1600, 'Deutsche Adaption des „Business Model Canvas“ von Strategyzer AG (strategyzer.com), lizenziert unter CC BY-SA 3.0 (creativecommons.org/licenses/by-sa/3.0).', 12, { color: '#8a8a8a' });
      return b.els;
    },
  },
  {
    id: 'lean', name: 'Lean Canvas', category: 'Strategie', icon: '🚀',
    description: 'Geschäftsidee für Startups schnell validieren. Lean Canvas von Ash Maurya, CC BY-SA 3.0.',
    build: () => {
      const b = new B();
      const X = 60, Y = 190, cw = 330, th = 700, bh = 300;
      b.frame(0, 0, X * 2 + cw * 5, Y + th + bh + 60, 'Lean Canvas');
      b.heading(60, 40, 'Lean Canvas', 'Produkt: …   ·   Version: …   ·   Datum: …', 1500);
      b.block(X, Y, cw, th, '❗ Problem', 'Top 3 Probleme deiner Kunden.\n\nBestehende Alternativen: Wie lösen Kunden das Problem heute?');
      b.block(X + cw, Y, cw, th / 2, '💡 Lösung', 'Top 3 Features, die das Problem lösen.');
      b.block(X + cw, Y + th / 2, cw, th / 2, '📊 Schlüsselkennzahlen', 'Welche Kennzahlen zeigen, wie es läuft?');
      b.block(X + cw * 2, Y, cw, th, '⭐ Alleinstellungsmerkmal', 'Eine klare, überzeugende Botschaft, warum du anders und kaufenswert bist.\n\nHigh-Level-Konzept: „X für Y“', LIGHT.yellow);
      b.block(X + cw * 3, Y, cw, th / 2, '🛡️ Unfairer Vorteil', 'Was lässt sich nicht einfach kopieren oder kaufen?');
      b.block(X + cw * 3, Y + th / 2, cw, th / 2, '📣 Kanäle', 'Wege zu deinen Kunden.');
      b.block(X + cw * 4, Y, cw, th, '🎯 Kundensegmente', 'Zielkunden und Nutzer.\n\nEarly Adopters: Wer sind die ersten Kunden?');
      b.block(X, Y + th, cw * 2.5, bh, '💸 Kostenstruktur', 'Akquisekosten, Vertriebskosten, Hosting, Personal …');
      b.block(X + cw * 2.5, Y + th, cw * 2.5, bh, '💰 Einnahmequellen', 'Erlösmodell, Customer Lifetime Value, Umsatz, Marge');
      b.text(X, Y + th + bh + 12, 1600, 'Deutsche Adaption des „Lean Canvas“ von Ash Maurya (leanstack.com), eine Abwandlung des Business Model Canvas, lizenziert unter CC BY-SA 3.0.', 12, { color: '#8a8a8a' });
      return b.els;
    },
  },
  {
    id: 'vpc', name: 'Angebot & Kundenprofil', category: 'Strategie', icon: '💎',
    description: 'Prüfen, ob das eigene Angebot zu Aufgaben, Problemen und Wünschen der Kunden passt.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1720, 1000, 'Angebot & Kundenprofil');
      b.heading(60, 40, 'Angebot & Kundenprofil', 'Passt unser Angebot zu den Bedürfnissen der Kunden?', 1200);
      const sx = 80, sy = 220, s = 700;
      b.shape(sx, sy, s, s, { fill: LIGHT.blue, stroke: '#1a1a1a', strokeWidth: 2, locked: true });
      b.line(sx, sy + s / 2, sx + s / 2, sy + s / 2);
      b.line(sx + s / 2, sy, sx + s / 2, sy + s);
      b.text(sx + 20, sy + 20, 320, '🎁 Produkte & Services', 20, { bold: true });
      b.text(sx + s / 2 + 20, sy + 20, 320, '📈 Nutzen schaffen', 20, { bold: true });
      b.text(sx + s / 2 + 20, sy + s / 2 + 20, 320, '💊 Probleme lösen', 20, { bold: true });
      b.text(sx + 20, sy + s - 60, 320, 'Wertangebot', 26, { bold: true, color: '#4262ff' });
      const cx = 940, cy = 220;
      b.shape(cx, cy, s, s, { shape: 'ellipse', fill: LIGHT.yellow, stroke: '#1a1a1a', strokeWidth: 2, locked: true });
      b.line(cx + s / 2, cy + s / 2, cx + s / 2 - s * 0.354, cy + s / 2 - s * 0.354);
      b.line(cx + s / 2, cy + s / 2, cx + s / 2 - s * 0.354, cy + s / 2 + s * 0.354);
      b.line(cx + s / 2, cy + s / 2, cx + s, cy + s / 2);
      b.text(cx + 400, cy + 180, 260, '😊 Wünsche', 20, { bold: true });
      b.text(cx + 400, cy + 480, 260, '😣 Probleme', 20, { bold: true });
      b.text(cx + 60, cy + 330, 220, '🧰 Aufgaben', 20, { bold: true });
      b.text(cx + s - 220, cy + s - 40, 260, 'Kundenprofil', 26, { bold: true, color: '#e8590c' });
      b.line(sx + s + 20, sy + s / 2 - 30, cx - 20, sy + s / 2 - 30, { arrowEnd: true, arrowStart: true, strokeWidth: 3, dash: true });
      b.text(sx + s + 30, sy + s / 2 - 80, 140, 'Fit?', 24, { bold: true, align: 'center' });
      return b.els;
    },
  },
  {
    id: 'okr', name: 'OKR-Planung', category: 'Strategie', icon: '🏁',
    description: 'Objectives & Key Results mit Initiativen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1620, 1000, 'OKR-Planung');
      b.heading(60, 40, 'OKR-Planung', 'Quartal: …   ·   Team: …', 1200);
      const o = b.shape(60, 200, 1500, 110, { shape: 'roundrect', fill: '#4262ff', stroke: 'none', strokeWidth: 0, text: '🎯 Objective: Qualitatives, inspirierendes Ziel formulieren', textColor: '#fff', fontSize: 26, bold: true });
      for (let i = 0; i < 3; i++) {
        const x = 60 + i * 510;
        const kr = b.shape(x, 380, 480, 140, { shape: 'roundrect', fill: LIGHT.blue, stroke: '#4262ff', strokeWidth: 2, text: `Key Result ${i + 1}\nMessbares Ergebnis (von X auf Y)`, fontSize: 18 });
        b.conn(o, kr, { routing: 'elbow', stroke: '#4262ff', fromSide: 'bottom', toSide: 'top' });
        b.zone(x, 560, 480, 380, LIGHT.grey, { text: 'Initiativen', fontSize: 18, bold: true, align: 'left', valign: 'top' });
        b.sticky(x + 20, 620, 'Maßnahme', C.yellow);
        b.text(x + 200, 640, 260, 'Fortschritt: 0 %\nVerantwortlich: …', 16, { color: '#555' });
      }
      return b.els;
    },
  },
  {
    id: 'project-canvas', name: 'Projekt-Canvas', category: 'Agile & Projekte', icon: '🗂️',
    description: 'Projektauftrag und Kick-off auf einen Blick.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1720, 1160, 'Projekt-Canvas');
      b.heading(60, 40, 'Projekt-Canvas', 'Projektname · Auftraggeber · Projektleitung', 1200);
      const X = 60, Y = 190, w = 400, hh = 300;
      const blocks = [
        ['🎯 Ziele', 'Was wollen wir erreichen (SMART)?'], ['📖 Hintergrund', 'Warum machen wir das Projekt?'],
        ['📦 Ergebnisse', 'Was liefern wir konkret?'], ['✅ Erfolgskriterien', 'Woran messen wir den Erfolg?'],
        ['👥 Team & Rollen', 'Wer ist beteiligt, wer entscheidet?'], ['🧑‍💼 Stakeholder', 'Wen betrifft das Projekt?'],
        ['🗓️ Meilensteine', 'Wichtige Termine und Phasen'], ['⚠️ Risiken', 'Was kann schiefgehen?'],
        ['💶 Budget & Ressourcen', 'Was steht zur Verfügung?'], ['🚫 Nicht im Umfang', 'Was gehört bewusst nicht dazu?'],
        ['🔗 Abhängigkeiten', 'Wovon hängen wir ab?'], ['❓ Offene Fragen', 'Was müssen wir noch klären?'],
      ];
      blocks.forEach(([t, hint], i) => b.block(X + (i % 4) * w, Y + Math.floor(i / 4) * hh, w, hh, t, hint, i === 0 ? LIGHT.yellow : '#ffffff'));
      return b.els;
    },
  },
  {
    id: 'roadmap', name: 'Produkt-Roadmap', category: 'Agile & Projekte', icon: '🛣️',
    description: 'Initiativen über Quartale und Themenbereiche planen.',
    build: () => {
      const b = new B();
      const lanes = [['🧩 Produkt', '#4262ff'], ['📣 Marketing', '#e64980'], ['🛠️ Technik', '#12b886'], ['🎧 Support', '#f59f00']];
      const qs = ['Q1', 'Q2', 'Q3', 'Q4'];
      const X = 260, Y = 200, qw = 360, lh = 190;
      b.frame(0, 0, X + qw * 4 + 60, Y + 70 + lh * lanes.length + 60, 'Produkt-Roadmap');
      b.heading(60, 40, 'Produkt-Roadmap ' + new Date().getFullYear(), 'Themen und Initiativen pro Quartal', 1200);
      qs.forEach((q, i) => b.shape(X + i * qw, Y, qw - 10, 60, { shape: 'roundrect', fill: '#1a1a1a', stroke: 'none', strokeWidth: 0, text: q, textColor: '#fff', fontSize: 22, bold: true, locked: true }));
      lanes.forEach(([t, col], i) => {
        const y = Y + 70 + i * lh;
        b.zone(60, y, X - 70 + qw * 4, lh - 10, i % 2 ? '#fafafa' : '#f3f4f6');
        b.text(76, y + 20, 170, t, 20, { bold: true, color: col });
      });
      const bar = (lane, q0, q1, text) => b.shape(X + q0 * qw + 10, Y + 70 + lane * lh + 40, (q1 - q0) * qw - 30, 70, { shape: 'roundrect', fill: lanes[lane][1], stroke: 'none', strokeWidth: 0, text, textColor: '#fff', fontSize: 18, bold: true });
      bar(0, 0, 2, 'MVP-Launch');
      bar(0, 2, 4, 'Mobile App');
      bar(1, 1, 2, 'Kampagne');
      bar(2, 0, 1, 'Cloud-Migration');
      bar(2, 2, 3, 'Performance');
      bar(3, 1, 4, 'Self-Service-Portal');
      return b.els;
    },
  },
  {
    id: 'timeline', name: 'Zeitstrahl', category: 'Agile & Projekte', icon: '📍',
    description: 'Meilensteine auf einer Zeitachse darstellen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 760, 'Zeitstrahl');
      b.heading(60, 40, 'Zeitstrahl', 'Projektverlauf und Meilensteine', 1200);
      b.line(80, 420, 1720, 420, { strokeWidth: 6, stroke: '#4d4d4d', arrowEnd: true });
      const ms = ['Kick-off', 'Konzept', 'Design', 'Entwicklung', 'Test', 'Go-live'];
      const cols = ['#4262ff', '#7048e8', '#e64980', '#f59f00', '#12b886', '#1098ad'];
      ms.forEach((m, i) => {
        const x = 160 + i * 280;
        const up = i % 2 === 0;
        b.shape(x - 18, 402, 36, 36, { shape: 'ellipse', fill: cols[i], stroke: '#ffffff', strokeWidth: 4 });
        b.line(x, up ? 400 : 440, x, up ? 330 : 510, { stroke: cols[i], strokeWidth: 2 });
        b.shape(x - 110, up ? 210 : 510, 220, 120, { shape: 'roundrect', fill: '#ffffff', stroke: cols[i], strokeWidth: 3, text: `${m}\nKW ${10 + i * 4}`, fontSize: 18, bold: true });
      });
      return b.els;
    },
  },
  {
    id: 'gantt', name: 'Gantt-Diagramm', category: 'Agile & Projekte', icon: '📊',
    description: 'Einfacher Projektzeitplan mit Arbeitspaketen und Wochen.',
    build: () => {
      const b = new B();
      const weeks = 8, rows = 6, X = 60, Y = 190, cw0 = 260, cw = 140, rh = 64;
      const W = cw0 + cw * weeks;
      b.frame(0, 0, W + 120, Y + rh * (rows + 1) + 60, 'Gantt-Diagramm');
      b.heading(60, 40, 'Gantt-Diagramm', 'Projektzeitplan', 1000);
      const tasks = ['Analyse', 'Konzeption', 'Design', 'Entwicklung', 'Test', 'Rollout'];
      const cells = [['Arbeitspaket', ...Array.from({ length: weeks }, (_, i) => `KW ${i + 1}`)], ...tasks.map((t) => [t, ...Array(weeks).fill('')])];
      // Tabelle mit gleich breiten Spalten -> erste Spalte über eine eigene Tabelle
      b.table(X, Y, cw0, rh * (rows + 1), cells.map((r) => [r[0]]));
      b.table(X + cw0, Y, cw * weeks, rh * (rows + 1), cells.map((r) => r.slice(1)), { fontSize: 13 });
      const spans = [[0, 2], [1, 3], [2, 4], [3, 7], [5, 7], [7, 8]];
      const cols = ['#4262ff', '#7048e8', '#e64980', '#f59f00', '#12b886', '#1098ad'];
      spans.forEach(([s, e], i) => b.shape(X + cw0 + s * cw + 6, Y + rh * (i + 1) + 14, (e - s) * cw - 12, rh - 28, { shape: 'pill', fill: cols[i], stroke: 'none', strokeWidth: 0 }));
      return b.els;
    },
  },
  {
    id: 'storymap', name: 'User Story Map', category: 'Agile & Projekte', icon: '🗺️',
    description: 'Nutzeraktivitäten, Aufgaben und Stories in Releases schneiden.',
    build: () => {
      const b = new B();
      const acts = ['Registrieren', 'Produkt finden', 'Bestellen', 'Bezahlen'];
      const X = 260, cw = 360;
      b.frame(0, 0, X + cw * acts.length + 60, 1240, 'User Story Map');
      b.heading(60, 40, 'User Story Map', 'Persona: …   ·   Ziel: …', 1200);
      b.text(60, 220, 180, 'Aktivitäten', 18, { bold: true, color: '#e8590c' });
      b.text(60, 400, 180, 'Aufgaben', 18, { bold: true, color: '#1971c2' });
      acts.forEach((a, i) => {
        const x = X + i * cw;
        b.sticky(x, 190, a, C.orange, 160, 140);
        b.sticky(x, 370, 'Aufgabe', C.blue, 160, 140);
        b.sticky(x + 175, 370, 'Aufgabe', C.blue, 160, 140);
      });
      [['Release 1 (MVP)', 560], ['Release 2', 860]].forEach(([t, y]) => {
        b.line(60, y, X + cw * acts.length, y, { dash: true, stroke: '#868e96' });
        b.text(60, y + 20, 180, t, 18, { bold: true });
        acts.forEach((a, i) => b.sticky(X + i * cw, y + 20, 'User Story', C.yellow, 160, 120));
      });
      return b.els;
    },
  },
  {
    id: 'weekly', name: 'Wochenplaner', category: 'Agile & Projekte', icon: '🗓️',
    description: 'Aufgaben und Termine über die Woche verteilen.',
    build: () => columnsTemplate('Wochenplaner', 'KW … · Ziele der Woche: …', ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Wochenende'].map((d, i) => ({
      title: d, color: i === 5 ? C.violet : C.blue, light: i === 5 ? LIGHT.violet : LIGHT.blue,
    })), { colW: 240, colH: 640, stickies: 0 }),
  },
  {
    id: 'six-hats', name: 'Sechs Perspektiven', category: 'Brainstorming', icon: '🎨',
    description: 'Ein Thema nacheinander aus sechs Blickwinkeln betrachten.',
    build: () => columnsTemplate('Sechs Perspektiven', 'Thema: …', [
      { title: 'Fakten', emoji: '📊', color: '#f1f3f5', light: LIGHT.grey, hint: 'Was wissen wir? Welche Informationen fehlen?' },
      { title: 'Gefühle', emoji: '❤️', color: '#ffa8a8', light: LIGHT.red, hint: 'Was sagt das Bauchgefühl?' },
      { title: 'Risiken', emoji: '⚠️', color: '#adb5bd', light: LIGHT.grey, hint: 'Was könnte schiefgehen?' },
      { title: 'Chancen', emoji: '☀️', color: '#ffe066', light: LIGHT.yellow, hint: 'Welche Vorteile bietet es?' },
      { title: 'Ideen', emoji: '💡', color: '#8ce99a', light: LIGHT.green, hint: 'Welche neuen Ansätze gibt es?' },
      { title: 'Vorgehen', emoji: '🧭', color: '#74c0fc', light: LIGHT.blue, hint: 'Was ist der nächste Schritt?' },
    ], { colW: 260, colH: 640 }),
  },
  {
    id: 'crazy8', name: 'Crazy 8s', category: 'Brainstorming', icon: '✏️',
    description: '8 Skizzen in 8 Minuten – schnelle Ideenfindung.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1720, 1060, 'Crazy 8s');
      b.heading(60, 40, 'Crazy 8s', '8 Ideen in 8 Minuten skizzieren – eine Minute pro Feld (Timer starten!)', 1500);
      for (let i = 0; i < 8; i++) {
        const x = 60 + (i % 4) * 405, y = 190 + Math.floor(i / 4) * 420;
        b.shape(x, y, 385, 400, { fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 2, locked: true, text: String(i + 1), fontSize: 20, bold: true, align: 'left', valign: 'top' });
      }
      return b.els;
    },
  },
  {
    id: 'pros-cons', name: 'Pro & Contra', category: 'Brainstorming', icon: '⚖️',
    description: 'Argumente für eine Entscheidung abwägen.',
    build: () => columnsTemplate('Pro & Contra', 'Entscheidung: …', [
      { title: 'Pro', emoji: '👍', color: C.green, light: LIGHT.green, sticky: C.green },
      { title: 'Contra', emoji: '👎', color: C.red, light: LIGHT.red, sticky: C.red },
    ], { colW: 600, colH: 640 }),
  },
  {
    id: 'decision-matrix', name: 'Entscheidungsmatrix', category: 'Strategie', icon: '🧮',
    description: 'Optionen anhand gewichteter Kriterien vergleichen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1400, 860, 'Entscheidungsmatrix');
      b.heading(60, 40, 'Entscheidungsmatrix', 'Kriterien gewichten (1–5), Optionen bewerten (1–10), Summe bilden', 1300);
      b.table(60, 200, 1280, 560, [
        ['Kriterium', 'Gewichtung', 'Option A', 'Option B', 'Option C'],
        ['Kosten', '5', '', '', ''],
        ['Nutzen', '4', '', '', ''],
        ['Aufwand', '3', '', '', ''],
        ['Risiko', '3', '', '', ''],
        ['Zeit bis Umsetzung', '2', '', '', ''],
        ['Summe (gewichtet)', '', '', '', ''],
      ], { fontSize: 16 });
      return b.els;
    },
  },
  {
    id: 'five-whys', name: '5-Why-Methode', category: 'Diagramme', icon: '❓',
    description: 'Ursachen durch fünfmaliges Nachfragen ergründen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1900, 620, '5-Why-Methode');
      b.heading(60, 40, '5-Why-Methode', 'Problem beschreiben und fünfmal „Warum?“ fragen', 1200);
      let prev = b.shape(60, 260, 230, 180, { shape: 'roundrect', fill: '#ffc9c9', stroke: '#e03131', strokeWidth: 2, text: 'Problem:\n…', fontSize: 18, bold: true });
      for (let i = 1; i <= 5; i++) {
        const n = b.sticky(340 + (i - 1) * 250, 275, `Warum ${i}?\n…`, i === 5 ? C.orange : C.yellow, 150, 150);
        b.conn(prev, n, { routing: 'straight' });
        prev = n;
      }
      const root = b.shape(1600, 260, 230, 180, { shape: 'roundrect', fill: '#b2f2bb', stroke: '#2f9e44', strokeWidth: 2, text: 'Grundursache:\n…', fontSize: 18, bold: true });
      b.conn(prev, root, { routing: 'straight' });
      return b.els;
    },
  },
  {
    id: 'fishbone', name: 'Ishikawa (Fischgräte)', category: 'Diagramme', icon: '🐟',
    description: 'Ursache-Wirkungs-Diagramm nach den 6 M.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1800, 940, 'Ishikawa-Diagramm');
      b.heading(60, 40, 'Ishikawa-Diagramm', 'Ursachen nach Kategorien sammeln', 1200);
      const sy = 560;
      b.line(80, sy, 1440, sy, { strokeWidth: 5, arrowEnd: true });
      b.shape(1450, sy - 90, 290, 180, { shape: 'roundrect', fill: '#ffc9c9', stroke: '#e03131', strokeWidth: 3, text: 'Wirkung / Problem', fontSize: 22, bold: true });
      const cats = ['Mensch', 'Maschine', 'Methode', 'Material', 'Messung', 'Mitwelt'];
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
    id: 'flowchart', name: 'Flussdiagramm', category: 'Diagramme', icon: '🔀',
    description: 'Prozesse mit Start, Schritten und Entscheidungen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1500, 1200, 'Flussdiagramm');
      b.heading(60, 40, 'Flussdiagramm', 'Prozess: …', 1000);
      const start = b.shape(560, 180, 220, 80, { shape: 'pill', fill: '#b2f2bb', stroke: '#2f9e44', text: 'Start', bold: true, fontSize: 18 });
      const s1 = b.shape(540, 330, 260, 110, { fill: '#d0ebff', stroke: '#1971c2', text: 'Antrag einreichen', fontSize: 18 });
      const d = b.shape(545, 510, 250, 170, { shape: 'diamond', fill: '#fff3bf', stroke: '#f08c00', text: 'Vollständig?', fontSize: 18 });
      const s2 = b.shape(540, 750, 260, 110, { fill: '#d0ebff', stroke: '#1971c2', text: 'Antrag prüfen', fontSize: 18 });
      const fix = b.shape(980, 540, 260, 110, { fill: '#ffe3e3', stroke: '#e03131', text: 'Unterlagen nachfordern', fontSize: 18 });
      const doc = b.shape(150, 750, 240, 120, { shape: 'document', fill: '#f3f0ff', stroke: '#7048e8', text: 'Bescheid', fontSize: 18 });
      const end = b.shape(560, 950, 220, 80, { shape: 'pill', fill: '#ffc9c9', stroke: '#e03131', text: 'Ende', bold: true, fontSize: 18 });
      b.conn(start, s1, { routing: 'elbow' });
      b.conn(s1, d, { routing: 'elbow' });
      b.conn(d, s2, { routing: 'elbow', label: 'Ja' });
      b.conn(d, fix, { routing: 'elbow', label: 'Nein', fromSide: 'right', toSide: 'left' });
      b.conn(fix, s1, { routing: 'elbow', fromSide: 'top', toSide: 'right' });
      b.conn(s2, doc, { routing: 'elbow', dash: true });
      b.conn(s2, end, { routing: 'elbow' });
      return b.els;
    },
  },
  {
    id: 'orgchart', name: 'Organigramm', category: 'Diagramme', icon: '🏛️',
    description: 'Hierarchien und Verantwortlichkeiten darstellen.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1640, 860, 'Organigramm');
      b.heading(60, 40, 'Organigramm', 'Organisation · Stand ' + new Date().toLocaleDateString('de-DE'), 1000);
      const box = (x, y, t, col) => b.shape(x, y, 240, 90, { shape: 'roundrect', fill: col, stroke: 'none', strokeWidth: 0, text: t, fontSize: 17, bold: true, textColor: '#fff' });
      const ceo = box(700, 190, 'Geschäftsführung\nName', '#1a1a1a');
      const heads = [['Vertrieb\nName', '#4262ff'], ['Produkt\nName', '#7048e8'], ['Technik\nName', '#12b886'], ['Finanzen\nName', '#f59f00']];
      heads.forEach(([t, col], i) => {
        const hx = 100 + i * 390;
        const hd = box(hx, 380, t, col);
        b.conn(ceo, hd, { routing: 'elbow', arrowEnd: false, fromSide: 'bottom', toSide: 'top' });
        for (let j = 0; j < 2; j++) {
          const m = b.shape(hx + 20, 540 + j * 120, 200, 80, { shape: 'roundrect', fill: '#ffffff', stroke: col, strokeWidth: 2, text: `Team ${j + 1}\nName`, fontSize: 15 });
          b.conn(hd, m, { routing: 'elbow', arrowEnd: false, stroke: col, fromSide: 'left', toSide: 'left' });
        }
      });
      return b.els;
    },
  },
  {
    id: 'journey', name: 'Customer Journey Map', category: 'Design & UX', icon: '🧳',
    description: 'Kundenerlebnis entlang aller Phasen und Touchpoints.',
    build: () => {
      const b = new B();
      const phases = ['Aufmerksamkeit', 'Recherche', 'Kauf', 'Nutzung', 'Bindung'];
      const rows = [['🎯 Ziele', LIGHT.grey], ['📱 Touchpoints', LIGHT.blue], ['🏃 Aktivitäten', LIGHT.grey], ['💭 Gedanken', LIGHT.violet], ['😊 Emotionen', LIGHT.yellow], ['⚡ Pain Points', LIGHT.red], ['💡 Chancen', LIGHT.green]];
      const X = 60, Y = 200, hw = 230, cw = 300, rh = 160;
      b.frame(0, 0, X + hw + cw * phases.length + 60, Y + 80 + rows.length * rh + 40, 'Customer Journey Map');
      b.heading(60, 40, 'Customer Journey Map', 'Persona: …   ·   Szenario: …', 1400);
      phases.forEach((p, i) => b.shape(X + hw + i * cw, Y, cw - 10, 70, { shape: 'arrow', fill: '#4262ff', stroke: 'none', strokeWidth: 0, text: p, textColor: '#fff', fontSize: 18, bold: true, locked: true }));
      rows.forEach(([t, fill], r) => {
        const y = Y + 80 + r * rh;
        b.zone(X, y, hw - 10, rh - 10, '#1a1a1a', { text: t, textColor: '#fff', fontSize: 18, bold: true });
        for (let i = 0; i < phases.length; i++) b.zone(X + hw + i * cw, y, cw - 10, rh - 10, fill);
      });
      const ey = Y + 80 + 4 * rh;
      ['😐', '🤔', '😀', '😍', '🙂'].forEach((e, i) => b.emoji(X + hw + i * cw + 115, ey + 30 + [40, 60, 10, 0, 20][i], e, 60));
      b.sticky(X + hw + 15, Y + 95, 'Kunde möchte …', C.yellow, 130, 130);
      return b.els;
    },
  },
  {
    id: 'empathy', name: 'Empathy Map', category: 'Design & UX', icon: '❤️',
    description: 'Was sagt, denkt, tut und fühlt die Zielgruppe?',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1400, 1300, 'Empathy Map');
      b.heading(60, 40, 'Empathy Map', 'Für wen? …', 1000);
      const X = 60, Y = 190, S = 640;
      const q = [['💬 Sagt', 'Was sagt die Person? Zitate & Aussagen', LIGHT.blue], ['🧠 Denkt', 'Was geht ihr durch den Kopf?', LIGHT.violet], ['🏃 Tut', 'Was tut sie? Verhalten & Handlungen', LIGHT.green], ['❤️ Fühlt', 'Welche Gefühle bewegen sie?', LIGHT.pink]];
      q.forEach(([t, hint, fill], i) => {
        const x = X + (i % 2) * (S + 0), y = Y + Math.floor(i / 2) * (S * 0.75);
        b.block(x, y, S, S * 0.75, t, hint, fill, i % 2 ? 'right' : 'left');
      });
      b.shape(X + S - 110, Y + S * 0.75 - 110, 220, 220, { shape: 'ellipse', fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 3, text: '👤\nPersona', fontSize: 22, bold: true });
      const by = Y + S * 1.5 + 20;
      b.block(X, by, S, 180, '😣 Pains', 'Ängste, Frustrationen, Hindernisse', LIGHT.red);
      b.block(X + S, by, S, 180, '🌟 Gains', 'Wünsche, Bedürfnisse, Erfolgsmaßstäbe', LIGHT.yellow);
      return b.els;
    },
  },
  {
    id: 'persona', name: 'User Persona', category: 'Design & UX', icon: '🧑',
    description: 'Steckbrief einer typischen Zielperson.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1500, 980, 'User Persona');
      b.heading(60, 40, 'User Persona', 'Basierend auf Interviews und Daten', 1000);
      b.shape(60, 190, 260, 260, { shape: 'ellipse', fill: LIGHT.blue, stroke: '#4262ff', strokeWidth: 3, text: '👤', fontSize: 110 });
      b.text(360, 200, 500, 'Name Nachname', 36, { bold: true });
      b.text(360, 260, 500, 'Alter: …\nBeruf: …\nWohnort: …\nFamilienstand: …', 18, { color: '#444' });
      b.block(900, 190, 540, 260, '💬 Zitat', '„Ein typischer Satz, der die Persona beschreibt.“', LIGHT.yellow);
      b.block(60, 480, 450, 440, '🎯 Ziele', 'Was möchte die Persona erreichen?', LIGHT.green);
      b.block(525, 480, 450, 440, '😤 Frustrationen', 'Was hält sie davon ab?', LIGHT.red);
      b.block(990, 480, 450, 210, '⚡ Motivation', 'Was treibt sie an?', LIGHT.violet);
      b.block(990, 710, 450, 210, '📱 Kanäle & Tools', 'Welche Medien und Tools nutzt sie?', LIGHT.blue);
      return b.els;
    },
  },
  {
    id: 'moodboard', name: 'Moodboard', category: 'Design & UX', icon: '🎨',
    description: 'Bilder, Farben und Stimmungen sammeln.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1600, 1000, 'Moodboard', '#fafafa');
      b.heading(60, 40, 'Moodboard', 'Bilder per Drag & Drop hineinziehen', 1000);
      const ph = [[60, 190, 500, 360], [580, 190, 360, 360], [960, 190, 580, 240], [60, 570, 360, 380], [440, 570, 500, 380]];
      ph.forEach(([x, y, w, hh]) => b.shape(x, y, w, hh, { fill: '#e9ecef', stroke: '#ced4da', strokeWidth: 2, dash: true, text: '🖼️ Bild hier ablegen', textColor: '#868e96', fontSize: 18 }));
      b.text(960, 450, 400, 'Farbpalette', 22, { bold: true });
      ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'].forEach((c, i) => b.shape(960 + i * 115, 500, 100, 100, { shape: 'ellipse', fill: c, stroke: 'none', strokeWidth: 0 }));
      b.text(960, 640, 560, 'Schlüsselwörter', 22, { bold: true });
      ['modern', 'warm', 'natürlich', 'verspielt'].forEach((k, i) => b.shape(960 + (i % 2) * 290, 690 + Math.floor(i / 2) * 90, 270, 70, { shape: 'pill', fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 2, text: k, fontSize: 20 }));
      return b.els;
    },
  },
  {
    id: 'wireframe', name: 'Wireframe (Web)', category: 'Design & UX', icon: '🖥️',
    description: 'Grobes Layout einer Webseite skizzieren.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1400, 1100, 'Wireframe – Startseite', '#ffffff');
      const g = { fill: '#f1f3f5', stroke: '#adb5bd', strokeWidth: 2, textColor: '#495057', fontSize: 18 };
      b.shape(60, 60, 1280, 80, { ...g, text: 'Logo        Navigation   ·   Produkte   ·   Über uns   ·   Kontakt', align: 'left' });
      b.shape(60, 170, 1280, 380, { ...g, text: 'Hero-Bild / Headline\n\n[ Call-to-Action ]', fontSize: 28 });
      for (let i = 0; i < 3; i++) b.shape(60 + i * 435, 590, 410, 280, { ...g, text: `Feature ${i + 1}\nKurzbeschreibung` });
      b.shape(60, 900, 1280, 140, { ...g, text: 'Footer · Impressum · Datenschutz · Social Media' });
      return b.els;
    },
  },
];

TEMPLATES.push(...TECH_TEMPLATES);

export function templateById(id) {
  return TEMPLATES.find((t) => t.id === id);
}
