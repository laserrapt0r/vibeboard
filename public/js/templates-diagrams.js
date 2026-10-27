// Vorlagen für UML, BPMN und IT-Infrastruktur (Netzwerkplan, Rack, Container-Plattform)
import { B, LIGHT } from './template-kit.js';

const INK = '#1a1a1a';
const LINE = '#495057';

// Verbindungsenden: Seite ('top' …) oder Ankerpunkt [ax, ay] auf dem Umriss (−1 … 1)
const end = (el, at) => (Array.isArray(at) ? { id: el.id, ax: at[0], ay: at[1] } : { id: el.id, side: at });
function edge(b, a, c, o = {}) {
  const { from, to, ...rest } = o;
  return b.conn(a, c, { routing: 'straight', arrowEnd: 'none', stroke: INK, ...rest, from: end(a, from), to: end(c, to) });
}

// UML-Klasse: Abschnitte mit „--“ getrennt
const cls = (b, x, y, w, h, text, o = {}) => b.shape(x, y, w, h, { shape: 'umlclass', text, fontSize: 14, align: 'left', valign: 'top', fill: '#ffffff', stroke: INK, ...o });
const note = (b, x, y, w, h, text) => b.shape(x, y, w, h, { shape: 'note', text, fontSize: 13, fill: '#fff9b1', stroke: '#c9a800', strokeWidth: 1.5, align: 'left' });
const legend = (b, x, y, w, text) => b.shape(x, y, w, 70, { shape: 'roundrect', fill: '#f8f9fa', stroke: '#ced4da', strokeWidth: 1, align: 'left', fontSize: 14, locked: true, text });
// Bereich mit Überschrift oben links (Systemgrenze, Zone, Namespace …)
const area = (b, x, y, w, h, text, o = {}) => b.shape(x, y, w, h, { shape: 'rect', fill: '#fafbff', stroke: '#868e96', strokeWidth: 1.5, text, fontSize: 16, bold: true, align: 'left', valign: 'top', textColor: '#495057', locked: true, ...o });
const icon = (b, kind, x, y, text, o = {}) => b.shape(x, y, 120, 150, { shape: kind, text, fontSize: 14, valign: 'top', fill: '#ffffff', stroke: INK, ...o });

export const DIAGRAM_TEMPLATES = [
  /* ---------------- UML ---------------- */
  {
    id: 'uml-class', name: 'Klassendiagramm', category: 'UML', icon: '🧩',
    description: 'Klassen mit Attributen und Operationen, Vererbung, Schnittstellen, Assoziation, Aggregation und Komposition.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1960, 1220, 'Klassendiagramm');
      b.heading(60, 40, 'Klassendiagramm', 'Abschnitte einer Klasse (Name, Attribute, Operationen) werden durch eine Zeile „--“ getrennt.', 1500);
      const kunde = cls(b, 80, 220, 320, 170, 'Kunde\n--\n- id: Long\n- name: String\n- email: String\n--\n+ bestellen(): Bestellung');
      const gk = cls(b, 80, 620, 320, 130, 'Geschäftskunde\n--\n- ustId: String\n--\n+ rechnungAnfordern(): void');
      const adr = cls(b, 500, 620, 280, 150, 'Adresse\n--\n- straße: String\n- plz: String\n- ort: String');
      const best = cls(b, 900, 220, 340, 190, 'Bestellung\n--\n- nummer: String\n- datum: Date\n- status: Status\n--\n+ summe(): Decimal\n+ abschließen(): void');
      const pos = cls(b, 900, 620, 300, 130, 'Position\n--\n- menge: int\n--\n+ betrag(): Decimal');
      const art = cls(b, 1420, 640, 320, 150, 'Artikel\n--\n- nr: String\n- bezeichnung: String\n- preis: Decimal');
      const zahl = cls(b, 1420, 200, 360, 120, '«interface»\nZahlungsart\n--\n--\n+ bezahlen(betrag: Decimal): boolean');
      const kk = cls(b, 1340, 420, 230, 110, 'Kreditkarte\n--\n- nummer: String');
      const re = cls(b, 1630, 420, 230, 110, 'Rechnung\n--\n- zahlungsziel: int');
      const stat = cls(b, 1420, 880, 280, 160, '«enumeration»\nStatus\n--\nOFFEN\nBEZAHLT\nVERSANDT');
      edge(b, gk, kunde, { from: 'top', to: 'bottom', arrowEnd: 'triangle', label: 'erbt von' });
      edge(b, kunde, best, { from: 'right', to: 'left', arrowEnd: 'open', label: '1        bestellt        0..*' });
      edge(b, kunde, adr, { from: [0.6, 1], to: 'top', routing: 'elbow', arrowStart: 'diamond', label: '1..*' });
      edge(b, best, pos, { from: 'bottom', to: 'top', arrowStart: 'diamondFilled', label: '1..*' });
      edge(b, pos, art, { from: 'right', to: 'left', arrowEnd: 'open', label: '0..*   1' });
      edge(b, best, zahl, { from: 'right', to: 'left', arrowEnd: 'open', dash: true, label: '«use»' });
      edge(b, kk, zahl, { from: 'top', to: [-0.45, 1], arrowEnd: 'triangle', dash: true });
      edge(b, re, zahl, { from: 'top', to: [0.45, 1], arrowEnd: 'triangle', dash: true });
      edge(b, best, stat, { from: [0.95, 1], to: 'left', routing: 'elbow', arrowEnd: 'open' });
      legend(b, 80, 1100, 1000, 'Pfeile: ▷ durchgezogen = Vererbung · ▷ gestrichelt = Realisierung · ◆ Komposition · ◇ Aggregation · gestrichelt mit Spitze = Abhängigkeit');
      return b.els;
    },
  },
  {
    id: 'uml-usecase', name: 'Anwendungsfalldiagramm', category: 'UML', icon: '🎭',
    description: 'Akteure, Systemgrenze und Anwendungsfälle mit «include» und «extend».',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1760, 1120, 'Anwendungsfalldiagramm');
      b.heading(60, 40, 'Anwendungsfalldiagramm', 'Wer nutzt das System wofür? Akteure stehen außerhalb der Systemgrenze.', 1400);
      area(b, 460, 190, 840, 840, 'Onlineshop');
      const kunde = b.shape(170, 280, 110, 170, { shape: 'actor', text: 'Kunde', fontSize: 15, bold: true });
      const ma = b.shape(170, 720, 110, 170, { shape: 'actor', text: 'Mitarbeiter/in', fontSize: 15, bold: true });
      const pay = b.shape(1460, 470, 110, 170, { shape: 'actor', text: '«system»\nZahlungsdienst', fontSize: 15, bold: true });
      const uc = (x, y, t) => b.shape(x, y, 280, 100, { shape: 'ellipse', text: t, fontSize: 16 });
      const suchen = uc(540, 250, 'Artikel suchen');
      const bestellen = uc(540, 420, 'Bestellung aufgeben');
      const anmelden = uc(960, 260, 'Anmelden');
      const bezahlen = uc(960, 500, 'Bezahlen');
      const gutschein = uc(960, 680, 'Gutschein einlösen');
      const verwalten = uc(540, 760, 'Bestellungen verwalten');
      const storno = uc(540, 900, 'Bestellung stornieren');
      edge(b, kunde, suchen);
      edge(b, kunde, bestellen);
      edge(b, ma, verwalten);
      edge(b, ma, storno);
      edge(b, bezahlen, pay);
      edge(b, bestellen, anmelden, { arrowEnd: 'open', dash: true, label: '«include»' });
      edge(b, bestellen, bezahlen, { arrowEnd: 'open', dash: true, label: '«include»' });
      edge(b, gutschein, bezahlen, { from: 'top', to: 'bottom', arrowEnd: 'open', dash: true, label: '«extend»' });
      legend(b, 460, 1040, 840, 'Linie = Akteur nimmt teil · «include» = wird immer mit ausgeführt · «extend» = optionale Erweiterung');
      return b.els;
    },
  },
  {
    id: 'uml-activity', name: 'Aktivitätsdiagramm', category: 'UML', icon: '🔀',
    description: 'Ablauf mit Verantwortungsbereichen (Swimlanes), Entscheidung, paralleler Verarbeitung, Start und Ende.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1660, 1400, 'Aktivitätsdiagramm');
      b.heading(60, 40, 'Aktivitätsdiagramm: Bestellung abwickeln', 'Jede Spalte ist ein Verantwortungsbereich. Balken = Aufteilen bzw. Zusammenführen paralleler Abläufe.', 1500);
      ['Kunde', 'Shop', 'Lager'].forEach((t, i) => area(b, 60 + i * 520, 180, 520, 1160, t, { fill: i % 2 ? '#ffffff' : '#f8f9fa', align: 'center' }));
      const act = (x, y, t) => b.shape(x, y, 240, 80, { shape: 'roundrect', text: t, fontSize: 16, fill: '#eef1ff', stroke: '#4262ff' });
      const start = b.shape(302, 250, 36, 36, { shape: 'initial', fill: INK });
      const aufgeben = act(200, 330, 'Bestellung aufgeben');
      const pruefen = act(720, 330, 'Bestellung prüfen');
      const dec = b.shape(804, 480, 72, 72, { shape: 'diamond', text: '', fill: '#ffffff' });
      b.text(890, 494, 200, 'verfügbar?', 15, { color: '#495057' });
      const absage = act(200, 476, 'Absage erhalten');
      const end1 = b.shape(300, 610, 40, 40, { shape: 'final' });
      const fork = b.shape(700, 640, 820, 10, { shape: 'forkbar', fill: INK });
      const rechnung = act(720, 720, 'Rechnung erstellen');
      const pick = act(1240, 720, 'Ware kommissionieren');
      const join = b.shape(700, 880, 820, 10, { shape: 'forkbar', fill: INK });
      const versand = act(1240, 960, 'Ware versenden');
      const empfang = act(200, 960, 'Ware empfangen');
      const end2 = b.shape(300, 1110, 40, 40, { shape: 'final' });
      const flow = (a, c, o = {}) => edge(b, a, c, { arrowEnd: 'open', routing: 'elbow', ...o });
      flow(start, aufgeben, { from: 'bottom', to: 'top' });
      flow(aufgeben, pruefen, { from: 'right', to: 'left' });
      flow(pruefen, dec, { from: 'bottom', to: 'top' });
      flow(dec, absage, { from: 'left', to: 'right', label: '[nein]' });
      flow(absage, end1, { from: 'bottom', to: 'top' });
      flow(dec, fork, { from: 'bottom', to: [-0.66, -1], label: '[ja]' });
      flow(fork, rechnung, { from: [-0.66, 1], to: 'top' });
      flow(fork, pick, { from: [0.61, 1], to: 'top' });
      flow(rechnung, join, { from: 'bottom', to: [-0.66, -1] });
      flow(pick, join, { from: 'bottom', to: [0.61, -1] });
      flow(join, versand, { from: [0.61, 1], to: 'top' });
      flow(versand, empfang, { from: 'left', to: 'right' });
      flow(empfang, end2, { from: 'bottom', to: 'top' });
      return b.els;
    },
  },
  {
    id: 'uml-state', name: 'Zustandsdiagramm', category: 'UML', icon: '🚦',
    description: 'Lebenszyklus eines Tickets: Zustände, Übergänge mit Ereignis [Bedingung] / Aktion, Start und Ende.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2040, 900, 'Zustandsdiagramm');
      b.heading(60, 40, 'Zustandsdiagramm: Ticket', 'Übergänge beschriften als „Ereignis [Bedingung] / Aktion“.', 1400);
      const st = (x, y, t) => b.shape(x, y, 260, 100, { shape: 'roundrect', text: t, fontSize: 16, fill: '#ffffff', stroke: INK });
      const start = b.shape(80, 342, 36, 36, { shape: 'initial', fill: INK });
      const neu = st(190, 310, 'Neu\nentry / Eingang bestätigen');
      const arbeit = st(660, 310, 'In Bearbeitung\ndo / analysieren');
      const wartet = st(660, 620, 'Wartet auf Rückmeldung');
      const geloest = st(1130, 310, 'Gelöst\nentry / Lösung mitteilen');
      const zu = st(1600, 310, 'Geschlossen');
      const end1 = b.shape(1940, 340, 40, 40, { shape: 'final' });
      const tr = (a, c, o) => edge(b, a, c, { arrowEnd: 'open', ...o });
      tr(start, neu, { from: 'right', to: 'left' });
      tr(neu, arbeit, { from: 'right', to: 'left', label: 'zuweisen' });
      tr(arbeit, wartet, { from: [-0.5, 1], to: [-0.5, -1], label: 'Rückfrage stellen', labelPos: 0.35 });
      tr(wartet, arbeit, { from: [0.5, -1], to: [0.5, 1], label: 'Antwort eingegangen', labelPos: 0.35 });
      tr(arbeit, geloest, { from: 'right', to: 'left', label: 'Lösung bereitgestellt' });
      tr(geloest, arbeit, { from: [0, -1], to: [0, -1], routing: 'elbow', label: 'abgelehnt / wieder öffnen' });
      tr(geloest, zu, { from: 'right', to: 'left', label: 'bestätigt\n[oder nach 5 Tagen]' });
      tr(zu, end1, { from: 'right', to: 'left' });
      return b.els;
    },
  },
  {
    id: 'uml-component', name: 'Komponentendiagramm', category: 'UML', icon: '🧱',
    description: 'Komponenten mit angebotenen und benötigten Schnittstellen, Abhängigkeiten und Infrastruktur.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1900, 880, 'Komponentendiagramm');
      b.heading(60, 40, 'Komponentendiagramm', 'Kreis = angebotene Schnittstelle · gestrichelter Pfeil = benötigt / hängt ab von', 1500);
      const comp = (x, y, t) => b.shape(x, y, 280, 120, { shape: 'component', text: t, fontSize: 16, fill: '#ffffff', stroke: INK });
      const iface = (x, y, t) => {
        const c = b.shape(x, y, 26, 26, { shape: 'ellipse', fill: '#ffffff', stroke: INK });
        b.text(x - 60, y + 30, 150, t, 13, { color: '#495057', align: 'center' });
        return c;
      };
      const web = comp(80, 260, 'Web-Frontend');
      area(b, 520, 180, 1300, 620, '«subsystem» Shop-Backend', { strokeWidth: 1.5, dash: true });
      const bestell = comp(760, 260, 'Bestellservice');
      const zahlung = comp(1400, 260, 'Zahlungsservice');
      const benach = comp(1400, 560, 'Benachrichtigung');
      const iBest = iface(600, 307, 'REST /bestellungen');
      const iZahl = iface(1250, 307, 'IZahlung');
      const broker = b.shape(760, 560, 280, 110, { shape: 'queue', text: 'Message Broker', fontSize: 16, fill: '#fff4e6', stroke: '#e8590c' });
      const db = b.shape(570, 580, 170, 150, { shape: 'cylinder', text: 'Bestell-DB', fontSize: 16, fill: '#e6fcf5', stroke: '#0ca678' });
      edge(b, bestell, iBest, { from: 'left', to: 'right' });
      edge(b, web, iBest, { from: 'right', to: 'left', arrowEnd: 'open', dash: true, label: 'nutzt' });
      edge(b, zahlung, iZahl, { from: 'left', to: 'right' });
      edge(b, bestell, iZahl, { from: 'right', to: 'left', arrowEnd: 'open', dash: true });
      edge(b, bestell, broker, { from: 'bottom', to: 'top', arrowEnd: 'open', dash: true, label: 'Ereignis „bestellt“' });
      edge(b, benach, broker, { from: 'left', to: 'right', arrowEnd: 'open', dash: true, label: 'abonniert' });
      edge(b, bestell, db, { from: [-0.6, 1], to: 'top', routing: 'elbow', arrowEnd: 'open', dash: true, label: 'SQL' });
      return b.els;
    },
  },
  {
    id: 'uml-deployment', name: 'Verteilungsdiagramm', category: 'UML', icon: '🖥️',
    description: 'Knoten (Geräte, Laufzeitumgebungen), darauf verteilte Artefakte und Kommunikationswege.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1960, 900, 'Verteilungsdiagramm');
      b.heading(60, 40, 'Verteilungsdiagramm', 'Welche Software läuft wo, und wie sind die Knoten verbunden?', 1400);
      const node = (x, y, w, h, t, o = {}) => b.shape(x, y, w, h, { shape: 'umlnode', text: t, fontSize: 15, bold: true, valign: 'top', fill: '#ffffff', stroke: INK, ...o });
      const artifact = (x, y, t) => b.shape(x, y, 220, 80, { shape: 'note', text: t, fontSize: 14, fill: '#ffffff', stroke: INK });
      const client = node(80, 260, 360, 320, '«device»\nArbeitsplatz-PC');
      node(110, 360, 290, 190, '«executionEnvironment»\nWebbrowser', { fill: '#f8f9fa', bold: false, locked: true });
      artifact(145, 450, '«artifact»\nfrontend.js');
      const app = node(640, 220, 600, 420, '«device»\nAnwendungsserver (Linux)');
      node(670, 320, 530, 300, '«executionEnvironment»\nContainer-Laufzeit', { fill: '#f8f9fa', bold: false, locked: true });
      artifact(700, 410, '«artifact»\nshop-api.jar');
      artifact(950, 410, '«artifact»\nfrontend.zip');
      artifact(700, 515, '«artifact»\nreverse-proxy.conf');
      const dbs = node(1440, 260, 440, 320, '«device»\nDatenbankserver');
      node(1470, 360, 370, 190, '«executionEnvironment»\nPostgreSQL 16', { fill: '#f8f9fa', bold: false, locked: true });
      artifact(1510, 450, '«artifact»\nshop (Schema)');
      edge(b, client, app, { from: 'right', to: [-1, 0.07], label: '«HTTPS»' });
      edge(b, app, dbs, { from: [1, 0.07], to: 'left', label: '«TCP/IP» 5432' });
      legend(b, 640, 720, 1240, 'Quader = Knoten · «device» = Hardware/VM · «executionEnvironment» = Laufzeitumgebung · Dokument = Artefakt');
      return b.els;
    },
  },

  /* ---------------- BPMN ---------------- */
  {
    id: 'bpmn-incident', name: 'Prozessmodell (BPMN): Störung', category: 'IT-Service-Management', icon: '🧭',
    description: 'Incident-Prozess mit Bahnen je Rolle, Aufgaben, Gateways und Ereignissen in BPMN-Notation.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1980, 1080, 'Prozessmodell');
      b.heading(60, 40, 'Störungsbearbeitung (BPMN)', 'Kreis dünn = Start · Kreis dick = Ende · Raute mit × = Entweder-oder · Pfeile = Reihenfolge', 1500);
      const lanes = ['Anwender/in', 'Service Desk', '2nd Level'];
      lanes.forEach((t, i) => {
        b.shape(60, 190 + i * 260, 140, 260, { shape: 'rect', text: t, fontSize: 16, bold: true, fill: '#f1f3f5', stroke: LINE, strokeWidth: 1.5, locked: true });
        b.shape(200, 190 + i * 260, 1720, 260, { shape: 'rect', fill: i % 2 ? '#ffffff' : '#fcfcfd', stroke: LINE, strokeWidth: 1.5, locked: true });
      });
      const task = (x, y, t) => b.shape(x, y, 200, 90, { shape: 'roundrect', text: t, fontSize: 15, fill: '#ffffff', stroke: INK });
      const ev = (kind, x, y, t) => b.shape(x, y, 56, 56, { shape: kind, text: t, fontSize: 13, fill: '#ffffff', stroke: INK });
      const gw = (kind, x, y, t) => b.shape(x, y, 72, 72, { shape: kind, text: t, fontSize: 13, fill: '#ffffff', stroke: INK });
      const start = ev('event', 250, 292, 'Störung bemerkt');
      const melden = task(370, 275, 'Störung melden');
      const erfassen = task(370, 535, 'Ticket erfassen und klassifizieren');
      const bekannt = gw('gatewayx', 664, 544, '');
      b.text(610, 500, 180, 'Lösung bekannt?', 13, { align: 'center', color: '#495057' });
      const anwenden = task(820, 535, 'Bekannte Lösung anwenden');
      const analyse = task(820, 795, 'Analysieren und beheben');
      const merge = gw('gatewayx', 1104, 544, '');
      const info = task(1240, 535, 'Anwender/in informieren');
      const pruefen = task(1240, 275, 'Lösung prüfen');
      const ok = gw('gatewayx', 1540, 284, '');
      b.text(1486, 240, 180, 'Behoben?', 13, { align: 'center', color: '#495057' });
      const fertig = ev('eventend', 1760, 292, 'Störung behoben');
      const flow = (a, c, o = {}) => edge(b, a, c, { arrowEnd: 'arrow', routing: 'elbow', ...o });
      flow(start, melden, { from: 'right', to: 'left' });
      flow(melden, erfassen, { from: 'bottom', to: 'top' });
      flow(erfassen, bekannt, { from: 'right', to: 'left' });
      flow(bekannt, anwenden, { from: 'right', to: 'left', label: 'ja' });
      flow(bekannt, analyse, { from: 'bottom', to: 'left', label: 'nein' });
      flow(anwenden, merge, { from: 'right', to: 'left' });
      flow(analyse, merge, { from: 'right', to: 'bottom' });
      flow(merge, info, { from: 'right', to: 'left' });
      flow(info, pruefen, { from: 'top', to: 'bottom' });
      flow(pruefen, ok, { from: 'right', to: 'left' });
      flow(ok, fertig, { from: 'right', to: 'left', label: 'ja' });
      flow(ok, erfassen, { from: 'bottom', to: [0.5, -1], label: 'nein, wieder öffnen' });
      return b.els;
    },
  },

  /* ---------------- IT-Infrastruktur ---------------- */
  {
    id: 'network-plan', name: 'Netzwerkplan', category: 'IT-Infrastruktur', icon: '🌐',
    description: 'Internetanbindung, Firewall, DMZ, Serverraum und LAN mit Switches, Arbeitsplätzen und WLAN.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 2000, 1720, 'Netzwerkplan');
      b.heading(60, 40, 'Netzwerkplan', 'Geräte über die Formenauswahl → „Netzwerk & Rechenzentrum“ ergänzen. Verbindungen mit Bandbreite oder VLAN beschriften.', 1600);
      const net = (a, c, o = {}) => edge(b, a, c, { stroke: LINE, strokeWidth: 2, ...o });
      const dev = (kind, x, y, w, h, t, o = {}) => b.shape(x, y, w, h, { shape: kind, text: t, fontSize: 14, fill: '#ffffff', stroke: INK, ...o });
      const inet = icon(b, 'internet', 940, 180, 'Internet');
      const router = icon(b, 'router', 940, 380, 'Edge-Router');
      const fw = dev('firewall', 900, 580, 200, 120, 'Firewall');
      area(b, 80, 540, 660, 430, 'DMZ · VLAN 30', { fill: LIGHT.red, stroke: '#e03131', dash: true });
      const dmzSw = dev('switch', 280, 610, 260, 80, 'DMZ-Switch');
      const web = dev('server', 130, 780, 220, 130, 'Webserver');
      const mail = dev('server', 470, 780, 220, 130, 'Mail-Relay');
      area(b, 1260, 540, 660, 430, 'Serverraum · VLAN 10', { fill: LIGHT.green, stroke: '#2f9e44', dash: true });
      const srvSw = dev('switch', 1460, 610, 260, 80, 'Server-Switch');
      const app = dev('server', 1300, 780, 220, 130, 'Anwendungsserver');
      const nas = dev('storage', 1620, 790, 260, 110, 'NAS (Backup)');
      area(b, 80, 1040, 1840, 620, 'LAN · VLAN 20 (Clients) · VLAN 40 (WLAN)', { fill: LIGHT.blue, stroke: '#1c7ed6', dash: true });
      const core = dev('switch', 870, 1090, 260, 80, 'Core-Switch');
      const accA = dev('switch', 200, 1240, 260, 80, 'Access-Switch EG');
      const accB = dev('switch', 760, 1240, 260, 80, 'Access-Switch OG');
      const pcs = [[150, 'PC Empfang'], [330, 'PC Buchhaltung'], [710, 'PC Vertrieb'], [890, 'PC Technik']].map(([x, t]) => dev('desktop', x, 1420, 150, 125, t, { fontSize: 13 }));
      const ap = icon(b, 'accesspoint', 1420, 1210, 'WLAN-Access-Point');
      const lap = dev('laptop', 1300, 1460, 170, 110, 'Notebook');
      const phone = dev('mobile', 1560, 1440, 80, 140, 'Telefon', { fontSize: 12 });
      net(inet, router, { from: 'bottom', to: 'top', label: 'Glasfaser 1 Gbit/s' });
      net(router, fw, { from: 'bottom', to: 'top' });
      net(fw, dmzSw, { from: 'left', to: 'right', label: 'DMZ' });
      net(fw, srvSw, { from: 'right', to: 'left', label: 'Server' });
      net(fw, core, { from: 'bottom', to: 'top', label: 'LAN' });
      net(dmzSw, web, { from: 'bottom', to: 'top' });
      net(dmzSw, mail, { from: 'bottom', to: 'top' });
      net(srvSw, app, { from: 'bottom', to: 'top' });
      net(srvSw, nas, { from: 'bottom', to: 'top' });
      net(core, accA, { from: 'bottom', to: 'top', routing: 'elbow' });
      net(core, accB, { from: [-0.6, 1], to: 'top', routing: 'elbow' });
      net(core, ap, { from: 'right', to: 'top', routing: 'elbow' });
      pcs.forEach((pc, i) => net(i < 2 ? accA : accB, pc, { from: 'bottom', to: 'top' }));
      net(ap, lap, { dash: true });
      net(ap, phone, { dash: true });
      return b.els;
    },
  },
  {
    id: 'rack-plan', name: 'Rack-Belegung', category: 'IT-Infrastruktur', icon: '🗄️',
    description: 'Zwei Serverschränke mit 42 Höheneinheiten, Belegung nach Gerätetyp und Legende.',
    build: () => {
      const b = new B();
      const U = 18, units = 42, rackW = 320;
      const head = 40, base = 12, rackH = head + units * U + base;
      b.frame(0, 0, 1500, rackH + 330, 'Rack-Belegung');
      b.heading(60, 40, 'Rack-Belegung', 'Geräte als Rechtecke in Höheneinheiten (1 HE = 18 px) – zum Umbauen einfach verschieben.', 1300);
      const COLORS = { net: ['#d0ebff', '#1c7ed6'], srv: ['#e9ecef', '#495057'], sto: ['#d3f9d8', '#2f9e44'], pwr: ['#ffe8cc', '#e8590c'], pp: ['#f8f9fa', '#adb5bd'] };
      const rack = (x, name, devices) => {
        const y = 200;
        b.shape(x, y, rackW, rackH, { shape: 'rack', text: name, fontSize: 16, bold: true, fill: '#ffffff', stroke: INK, locked: true });
        const rw = 16;
        for (let u = 1; u <= units; u++) b.text(x - 34, y + head + (units - u) * U - 1, 30, String(u), 10, { color: '#868e96', align: 'right' });
        for (const [top, size, label, kind] of devices) {
          const [fill, stroke] = COLORS[kind];
          b.shape(x + rw + 2, y + head + (units - top) * U + 1, rackW - 2 * rw - 4, size * U - 2, { shape: 'rect', text: label, fontSize: size > 1 ? 13 : 11, fill, stroke, strokeWidth: 1 });
        }
      };
      rack(140, 'Rack A01 · Netzwerk', [
        [42, 1, 'Patchfeld 1 (24 Ports)', 'pp'], [41, 1, 'Patchfeld 2 (24 Ports)', 'pp'], [40, 1, 'Core-Switch 48 Ports', 'net'],
        [39, 1, 'Access-Switch EG', 'net'], [38, 1, 'Access-Switch OG', 'net'], [36, 1, 'Firewall', 'net'], [35, 1, 'Router', 'net'],
        [4, 3, 'USV 3 kVA', 'pwr'],
      ]);
      rack(620, 'Rack A02 · Server', [
        [42, 1, 'Patchfeld (24 Ports)', 'pp'], [41, 1, 'Server-Switch', 'net'], [38, 2, 'Virtualisierungshost 1', 'srv'],
        [36, 2, 'Virtualisierungshost 2', 'srv'], [34, 2, 'Virtualisierungshost 3', 'srv'], [31, 2, 'Backup-Server', 'srv'],
        [28, 4, 'Speichersystem (SAN)', 'sto'], [4, 3, 'USV 3 kVA', 'pwr'],
      ]);
      const ly = 220;
      b.text(1040, ly, 400, 'Legende', 20, { bold: true });
      [['net', 'Netzwerk'], ['srv', 'Server'], ['sto', 'Speicher'], ['pwr', 'Stromversorgung'], ['pp', 'Patchfeld / Kabelführung']].forEach(([k, t], i) => {
        const [fill, stroke] = COLORS[k];
        b.shape(1040, ly + 50 + i * 44, 40, 28, { shape: 'rect', fill, stroke, strokeWidth: 1, locked: true });
        b.text(1094, ly + 50 + i * 44, 320, t, 16);
      });
      b.text(1040, ly + 300, 420, 'Freie Höheneinheiten bleiben leer.\nGewicht und Leistung je Rack im Blick behalten.', 15, { color: '#6b6b6b' });
      return b.els;
    },
  },
  {
    id: 'container-cluster', name: 'Container-Plattform (Cluster)', category: 'IT-Infrastruktur', icon: '☸️',
    description: 'Cluster-Übersicht, z. B. für Kubernetes: Ingress, Services, Deployments, Pods, ConfigMap, Secret, Volume und Nodes.',
    build: () => {
      const b = new B();
      b.frame(0, 0, 1960, 1360, 'Container-Plattform');
      b.heading(60, 40, 'Container-Plattform: Cluster-Übersicht', 'Symbole unter Formen → „Container-Plattform“. Pfeile zeigen den Weg der Anfragen.', 1600);
      const users = icon(b, 'users', 80, 520, 'Nutzer/innen');
      area(b, 300, 180, 1600, 1130, 'Cluster', { fill: '#f8f9fa' });
      const ingress = icon(b, 'ingress', 380, 520, 'Ingress\nshop.example.org');
      area(b, 600, 230, 1260, 760, 'Namespace: shop', { fill: '#ffffff', dash: true });
      const row = (y, name, workload = 'Deployment') => {
        const svc = icon(b, 'k8sservice', 660, y, `Service\n${name}`);
        const dep = icon(b, 'deployment', 880, y, `${workload}\n${name}`);
        const pods = [0, 1].map((i) => icon(b, 'pod', 1100 + i * 160, y, `Pod\n${name}-${i + 1}`));
        edge(b, svc, dep, { from: [1, -0.25], to: [-1, -0.25], arrowEnd: 'open', dash: true, label: 'wählt Pods' });
        pods.forEach((p) => edge(b, dep, p, { from: [1, -0.25], to: [-1, -0.25], arrowEnd: 'open' }));
        return { svc, dep, pods };
      };
      const web = row(270, 'web');
      const api = row(510, 'api');
      const db = row(750, 'db', 'StatefulSet');
      const cfg = icon(b, 'configmap', 1560, 270, 'ConfigMap\nweb-config');
      const sec = icon(b, 'secret', 1560, 510, 'Secret\ndb-zugang');
      const vol = icon(b, 'volume', 1560, 750, 'Volume\ndaten (10 GiB)');
      edge(b, cfg, web.pods[1], { from: [-1, -0.25], to: [1, -0.25], dash: true });
      edge(b, sec, api.pods[1], { from: [-1, -0.25], to: [1, -0.25], dash: true });
      edge(b, vol, db.pods[1], { from: [-1, -0.25], to: [1, -0.25], dash: true, label: 'eingehängt' });
      edge(b, users, ingress, { from: [1, -0.25], to: [-1, -0.25], arrowEnd: 'arrow', label: 'HTTPS' });
      edge(b, ingress, web.svc, { from: [1, -0.25], to: [-1, -0.25], routing: 'elbow', arrowEnd: 'arrow', label: '/' });
      edge(b, ingress, api.svc, { from: [1, -0.25], to: [-1, -0.25], routing: 'elbow', arrowEnd: 'arrow', label: '/api' });
      [0, 1, 2].forEach((i) => icon(b, 'k8snode', 700 + i * 360, 1060, `Node ${i + 1}`));
      b.text(1760, 1110, 120, 'Pods werden auf die Nodes verteilt.', 14, { color: '#6b6b6b' });
      return b.els;
    },
  },
];
