# vibeboard

Ein selbst gehostetes, kollaboratives Online-Whiteboard. Mehrere Personen arbeiten gleichzeitig auf einer
unendlichen Leinwand: mit Sticky Notes, Formen, Verbindungen, Mindmaps, Kommentaren, Abstimmungen und über 75
Vorlagen für Workshops, Retrospektiven, Strategiearbeit, Softwareentwicklung, Projektmanagement und
IT-Service-Management. Für Entwicklungsteams gibt es Code-Blöcke, Diagramme aus Text (Mermaid-Schreibweise),
Schätzrunden und einen Kartenimport aus Jira- oder Excel-Exporten. Für die Arbeit im Team gibt es Benachrichtigungen
bei @Erwähnungen, einen Aktivitätsverlauf, Moderationsrechte, Teams und Ordner, befristete Gastlinks und
aufgezeichnete Rundgänge. Dazu gibt es Benutzerkonten mit E-Mail-Bestätigung und optionaler Zwei-Faktor-Anmeldung,
Rechte pro Board und eine Administrationsoberfläche. Die Daten liegen in PostgreSQL.

- Läuft komplett auf dem eigenen Server: keine CDNs, kein Tracking, keine Pflicht-Abhängigkeit von externen Diensten.
- Hochgeladene Dateien werden mit ClamAV auf Schadsoftware geprüft.
- Automatische Upgrades mit Sicherung: Neue Versionen aktualisieren die Datenbank beim Start selbst.
- Alle Funktionen sind als Anforderungen dokumentiert: [docs/anforderungen](docs/anforderungen/README.md).
- Frontend in reinem JavaScript und SVG, ohne Build-Schritt.
- Backend in Node.js mit nur drei Abhängigkeiten (`pg`, `nodemailer`, `uqr`).

![Zusammenarbeit in Echtzeit: Mauszeiger mit Namen, Auswahl einer anderen Person und Cursor-Chat](docs/screenshots/zusammenarbeit.png)

---

## Screenshots

| | |
|---|---|
| ![Board-Übersicht mit „Meine Aufgaben“](docs/screenshots/uebersicht.png) | ![Sprint-Planung mit Aufgaben-Panel und Schätzrunde](docs/screenshots/sprint-schaetzrunde.png) |
| **Übersicht:** eigene und geteilte Boards, „Meine Aufgaben“ über alle Boards | **Sprint-Planung:** Karten mit Priorität und Story Points, Aufgaben-Panel, Schätzrunde mit verdeckten Karten |
| ![Architekturdiagramm mit gebogenem Verbinder und Knickpunkten](docs/screenshots/architektur-verbinder.png) | ![Dialog „Diagramm aus Text“ mit Live-Vorschau](docs/screenshots/diagramm-aus-text.png) |
| **Verbinder:** frei andocken, biegen, Knickpunkte, Linienenden | **Diagramm aus Text:** Mermaid-Schreibweise wird zu bearbeitbaren Formen |
| ![API-Design mit Tabelle und Code-Block](docs/screenshots/api-design-code.png) | ![Vorlage Incident-Postmortem](docs/screenshots/incident-postmortem.png) |
| **Softwareentwicklung:** Tabellen und Code-Blöcke mit Syntaxhervorhebung | **IT-Service-Management:** z. B. Incident-Postmortem |
| ![Vorlagen-Galerie, Kategorie IT-Service-Management](docs/screenshots/vorlagen.png) | ![Administration mit Systemmetriken](docs/screenshots/administration.png) |
| **Über 75 Vorlagen** in 12 Kategorien | **Administration:** Übersicht mit CPU, Arbeitsspeicher, Speicherplatz und mehr |

Alle Inhalte in den Screenshots sind Beispieldaten.

---

## Inhalt

- [Screenshots](#screenshots)
- [Funktionen](#funktionen)
- [Vorlagen](#vorlagen)
- [Installation](#installation)
- [Konfiguration](#konfiguration)
- [Konten und Anmeldung](#konten-und-anmeldung)
- [Rechte auf Boards](#rechte-auf-boards)
- [Administration](#administration)
- [Virenschutz für Uploads](#virenschutz-für-uploads)
- [Versionen und Upgrades](#versionen-und-upgrades)
- [Protokollierung](#protokollierung)
- [Sicherheit](#sicherheit)
- [Datenhaltung und Datenschutz](#datenhaltung-und-datenschutz)
- [Architektur](#architektur)
- [Lizenz](#lizenz)

---

## Funktionen

### Leinwand und Navigation
- Unendliche Leinwand mit Zoom von 1 % bis 800 %
- Verschieben mit Leertaste, Hand-Werkzeug, mittlerer Maustaste oder Trackpad; Pinch-Zoom auf Touch-Geräten
- Minimap, „Alles anzeigen“, feste Zoomstufen
- Punktraster, Einrasten am Raster, intelligente Hilfslinien beim Verschieben
- Helles und dunkles Design; die Ansicht wird pro Board gemerkt

### Inhalte
| Element | Möglichkeiten |
|---------|---------------|
| **Sticky Notes** | 16 Farben, automatische Schriftgröße, optional mit Name der Autorin bzw. des Autors |
| **Text** | Schriftgröße, Farbe, fett, kursiv, Ausrichtung, Hintergrund |
| **Formen** | Über 60 Formen in sieben Gruppen: Grundformen, Flussdiagramm (Dokument, mehrere Dokumente, manuelle Eingabe, Anzeige u. a.), UML (Klasse mit Abschnitten, Akteur, Paket, Komponente, Knoten, Start/Ende, Gabelung, Signale), BPMN (Ereignisse, Gateways), Netzwerk & Rechenzentrum (Router, Switch, Firewall, Load Balancer, Access Point, Internet, Server, Serverschrank, Speichersystem, PC, Smartphone), Software & IT, Container-Plattform (Pod, Deployment, Service, Ingress, Node, ConfigMap, Secret, Volume) – alles eigene Zeichnungen, mit Füllung, Rahmen, Strichart und Text |
| **Verbindungen** | gerade, gewinkelt oder als Kurve; docken an jeder Stelle des Umrisses an (oder automatisch); Linie ziehen biegt sie, Knickpunkte einfügen, verschieben und entfernen; verschiebbare Beschriftung; 9 Linienenden (Pfeil, Raute, Kreis, Krähenfuß u. a.), Strichart |
| **Quick Connect** | Punkte an einem ausgewählten Element anklicken oder ziehen, um verbundene Elemente zu erzeugen |
| **Freihand** | Stift, Textmarker, Radierer |
| **Frames** | Bereiche bzw. Folien mit Formaten (16:9, 4:3, A4, Quadrat, Smartphone); der Inhalt wandert beim Verschieben mit |
| **Karten** | Aufgaben mit Beschreibung, Zuständigkeit, Fälligkeitsdatum, Status, Priorität, Story Points, Ticketnummer, Labels und Farbe |
| **Code-Blöcke** | Quelltext mit Syntaxhervorhebung für 13 Sprachen, Zeilennummern, hellem oder dunklem Schema, Kopieren-Knopf |
| **Diagramm aus Text** | Fluss- und Sequenzdiagramme in Mermaid-Schreibweise eingeben, mit Live-Vorschau; es entstehen normale, bearbeitbare Formen und Verbindungen |
| **Tabellen** | Zellen und Bereiche auswählen; je Zelle fett, kursiv, unterstrichen, durchgestrichen, Ausrichtung, Schriftgröße, Text- und Zellenfarbe; Zeilen/Spalten an beliebiger Stelle einfügen und löschen; Spaltenbreiten und Zeilenhöhen ziehen; Tastaturbedienung wie in einer Tabellenkalkulation |
| **Mindmaps** | Knoten auswählen, dann **Tab** für einen Unterknoten und **Enter** für einen Geschwisterknoten |
| **Bilder** | per Upload, Drag & Drop oder aus der Zwischenablage; große Bilder werden automatisch verkleinert |
| **Sticker** | Emojis als frei platzierbare Elemente |
| **Links** | URL an Elemente hängen; ein Link-Symbol öffnet sie |
| **Kommentare** | Threads an beliebiger Stelle, @Erwähnungen mit Vorschlagsliste und Benachrichtigung, „Erledigt“-Status, als Aufgabe zuweisen (mit Fälligkeit), Kommentarübersicht mit Filter „Mir zugewiesen“ |

Mehrzeiligen Text in das Board einfügen erzeugt automatisch eine Sticky Note pro Zeile.

### Bearbeiten
- Mehrfachauswahl per Auswahlrahmen oder Umschalt-Klick
- **Größe ändern:**
  - Seitengriffe ändern nur Breite oder Höhe, auch bei flachen Elementen wie Gantt-Balken.
  - Umschalt behält das Seitenverhältnis, Alt ändert von der Mitte aus.
  - Die Größe wird beim Ziehen angezeigt.
- **Einrasten:**
  - an Kanten, Mitten und Tabellenlinien anderer Elemente
  - an gleicher Breite/Höhe und an gleichen Abständen (mit Abstandsmarken)
  - am Raster (10–50 px wählbar)
  - Umschalt verschiebt nur waagerecht oder senkrecht.
- **Exakte Werte:** X, Y, Breite und Höhe eingeben, auch für mehrere Elemente gleichzeitig.
- **Mehrfachauswahl:**
  - Ausrichten (links, mittig, rechts, oben, unten), gleichmäßig verteilen, lückenlos oder mit festem Abstand
    aneinanderreihen, als Raster anordnen.
  - Gleiche Breite, Höhe oder Größe; Größe kopieren und übernehmen; am Raster ausrichten.
- **Intelligentes Duplizieren:** Strg+D wiederholt den zuletzt verwendeten Versatz.
- Sticky Notes nach Farbe clustern
- Gruppieren, Sperren, Ebenen (Vorder- und Hintergrund), Duplizieren (auch per Alt-Ziehen); ein zweiter Klick in eine
  Gruppe wählt ein einzelnes Element zum Bearbeiten
- Kopieren und Einfügen, auch zwischen Boards
- Rückgängig und Wiederholen, Kontextmenü, Suche (Strg+F)
- Umfangreiche Tastenkürzel (Übersicht mit `?`)

### Zusammenarbeit in Echtzeit
- Änderungen erscheinen sofort bei allen Teilnehmenden
- **Live-Cursor mit Namen:**
  - Die Auswahl der anderen ist farbig markiert und mit Namen beschriftet; wer gerade tippt, wird mit
    „✎ Name schreibt …“ angezeigt.
  - Personen außerhalb der eigenen Ansicht erscheinen als Pfeil am Bildschirmrand; ein Klick springt hin.
  - Abwesende (anderer Tab) werden ausgegraut; die Ansichten aller stehen als Rahmen in der Minimap.
  - Fremde Mauszeiger lassen sich in den Einstellungen ausblenden.
- **Cursor-Chat:** Mit `/` eine kurze Nachricht direkt am eigenen Mauszeiger zeigen, ohne einen Kommentar anzulegen
- Teilnehmerliste mit „Folgen“ (der Ansicht einer Person folgen), „Alle zu mir holen“ und „Alle folgen mir“
- **Privater Modus:** Alle sammeln zunächst verdeckt – neue Inhalte sieht nur, wer sie erstellt hat, bis gemeinsam
  aufgedeckt wird. Der Server gibt die Inhalte vorher an niemanden sonst heraus.
- Fliegende Reaktionen (Emojis) und Laserpointer
- Automatisches Wiederverbinden; ungesendete Änderungen gehen nicht verloren
- **Speicherstatus** in der Kopfzeile: „Gespeichert“ erst, wenn alle eigenen Änderungen in der Datenbank angekommen
  sind; sonst „Wird gespeichert …“, „Offline – n ausstehend“ oder „Speichern verzögert“. Solange Änderungen offline
  feststecken, fragt der Browser vor dem Schließen der Seite nach.
- **Ladeanzeige:** Beim Öffnen eines Boards erscheint nach kurzer Zeit eine Ladeanzeige, nach einigen Sekunden mit
  Hinweis auf einen möglichen Proxy. Die Startseite zeigt Platzhalter, längere Anfragen einen Fortschrittsbalken.
- **Funktioniert auch in restriktiven Netzen:** Es werden keine WebSockets benötigt. Die Echtzeit-Übertragung läuft über
  Server-Sent Events (normales HTTP). Werden auch diese blockiert oder von einem Proxy gepuffert, wechselt vibeboard
  nach spätestens vier Sekunden auf Long-Polling und merkt sich das im Browser sieben Tage lang – das nächste Board
  öffnet dann ohne Wartezeit. Mit `?transport=sse` bzw. `?transport=poll` lässt sich das Verfahren erzwingen.

  *Warum kann es hinter einem Forward-Proxy dauern?* Server-Sent Events sind eine HTTP-Antwort, die nie endet. Manche
  Proxys (und Virenscanner in Proxys) halten Antworten zurück, bis sie vollständig oder ein Puffer voll ist – beim
  Board kommt dann zunächst gar nichts an. vibeboard schickt deshalb am Anfang 2 KB Füllzeichen (genügt für viele
  Proxys) und erkennt einen hängenden Stream an einer fehlenden Startnachricht.

### Arbeiten im Team
- **Benachrichtigungen:** Glocke auf der Startseite und im Board für @Erwähnungen, Antworten und zugewiesene
  Kommentare – live und, wenn gewünscht, per E-Mail (höchstens eine je Board alle zehn Minuten, im Profil abschaltbar).
- **Aktivitätsverlauf:** wer hat wann was erstellt, geändert, gelöscht oder kommentiert – zusammengefasst, mit Sprung zum
  Element. Beim Öffnen zeigt ein Hinweis die Änderungen anderer seit dem letzten Besuch und markiert sie auf der Leinwand.
- **Rolle „Kommentieren“** zwischen Ansehen und Bearbeiten – für Fachbereiche, Kunden oder Reviews.
- **Teams und Ordner:** Boards für ein ganzes Team freigeben (bearbeiten, kommentieren oder ansehen), persönliche
  Ordner und Ordner im Team. Neue Mitglieder werden per E-Mail-Adresse **eingeladen** und müssen die Einladung
  annehmen (Startseite oder Glocke); Team-Verwaltende sehen offene Einladungen und können sie zurückziehen.
- **Gastlinks:** Personen ohne Konto sehen oder kommentieren ein einzelnes Board – befristet, jederzeit sperrbar,
  standardmäßig abgeschaltet.
- **Rundgänge aufzeichnen:** Ansicht, Mauszeiger und Laserpointer, auf Wunsch mit Ton; andere spielen den Rundgang ab
  und können dabei selbst navigieren.
- **Reaktionen:** Emojis direkt an Sticky Notes, Karten & Co. – mit Anzahl und Namen, auch für Betrachter (Rechtsklick).
- **Schlagwörter und Filter:** Sticky Notes, Karten und Formen verschlagworten; der Filter blendet alles andere ab
  (nach Schlagwort, Farbe, Person, Reaktionen, Maßnahmen) – nur in der eigenen Ansicht.
- **Dateianhänge:** PDF, Word, Excel, PowerPoint, OpenDocument, Text, CSV und JSON auf das Board legen; PDFs mit
  Vorschau der ersten Seite und Betrachter (pdf.js), alles mit Virenscan und als Download.
- **Chat-Anbindung (Webhooks):** Benachrichtigungen in den eigenen Chat (Microsoft Teams, Slack, Matrix oder JSON),
  Team-Kanäle für neue Team-Boards und Retro-Zusammenfassungen. Standardmäßig abgeschaltet, mit Schutz vor Aufrufen
  ins interne Netz.

### Moderation
- **Moderationsrechte:** Bearbeiten für Teilnehmende sperren, Timer/Abstimmung/Schätzrunde/privaten Modus den
  Moderierenden vorbehalten, einzelne Elemente (z. B. Vorlagen-Hintergründe) für Teilnehmende sperren. Weitere
  Moderierende lassen sich über das Avatar-Menü hinzufügen. Der Server setzt alle Sperren durch.
- **Timer** für alle Teilnehmenden, mit Pause, Verlängerung und Signalton
- **Abstimmungen** mit einstellbarer Stimmenzahl pro Person; die Stimmen bleiben bis zum Ende verdeckt, danach gibt es eine Ergebnisliste
- **Schätzrunde** mit verdeckten Karten für eine Karte: Fibonacci-, T-Shirt- oder Stunden-Deck; die Werte bleiben verdeckt,
  bis aufgedeckt wird. Danach erscheinen Durchschnitt, Median und Spanne, und das Ergebnis lässt sich als Story Points
  übernehmen.
- **Präsentationsmodus**: Frames werden zu Folien (Vollbild, Pfeil- und Leertaste, Umgebung ausgeblendet)
- **Verborgene Bereiche:** Moderierende verdecken einen Frame; Teilnehmende sehen nur eine Abdeckung, bis aufgedeckt
  wird. Der Server gibt den Inhalt vorher nicht heraus.

### Retrospektiven
- **Geführter Ablauf** (Knopf 🔁): Check-in → Rückblick → Sammeln → Aufdecken → Gruppieren → Abstimmen → Besprechen →
  Maßnahmen → Abschluss. Bei jedem Schritt stellt vibeboard die passenden Werkzeuge ein (verdecktes, auf Wunsch
  anonymes Sammeln, Timer, Abstimmung über Themen, Besprechung, Umfragen).
- **Themengruppen:** Beiträge auswählen → „Themengruppe bilden“; abgestimmt wird dann über Themen.
- **Besprechungsmodus:** Themen in der Reihenfolge der Stimmen, das aktuelle ist für alle hervorgehoben, Timer je Thema
  und Lean-Coffee-Abfrage „Weiter diskutieren? 👍 ✋ 👎“.
- **Anonyme Beiträge:** Auch nach dem Aufdecken ohne Namen – gespeichert wird keiner.
- **Schnellumfragen:** Stimmungsbarometer, Fist of Five, ROTI, Team-Health-Check, eigene Frage – anonym, mit Verlauf
  über die Retro-Serie.
- **Maßnahmen mit Nachverfolgung:** Beitrag → „Als Maßnahme festhalten“ (Person, Fälligkeit) – erscheint unter
  „Meine Aufgaben“. „Nächste Retro anlegen“ übernimmt die Struktur; dort zeigt der Rückblick die offenen Maßnahmen
  der letzten Retro zum Abhaken oder Übernehmen.
- **Zusammenfassung** als Markdown, PDF, per E-Mail an die Beteiligten oder in den Team-Kanal.
- **Glücksrad und Redereihenfolge** – alle sehen dasselbe Ergebnis.

### Projektarbeit
- **Aufgaben-Panel** je Board:
  - Alle Karten als Liste, gruppiert nach Status, mit Story-Point-Summen.
  - Filter „Offen“, „Mir zugewiesen“, „Überfällig“; ein Klick springt zur Karte.
- **Meine Aufgaben** auf der Startseite: alle mir zugewiesenen Karten aus allen meinen Boards, nach Fälligkeit sortiert.
- **Versionsverlauf:**
  - Stände sichern, automatische Versionen alle 30 Minuten während der Bearbeitung.
  - Frühere Stände wiederherstellen (der aktuelle wird vorher gesichert) oder als Kopie öffnen.
- **Karten importieren** aus CSV, Excel, Jira oder Azure DevOps:
  - Spalten wie Summary, Assignee, Status, Due Date, Story Points, Priority, Labels werden erkannt.
  - Optional werden die Karten als Kanban-Spalten nach Status angeordnet.
- **Direktlinks** auf einzelne Elemente: `/board/<id>#el=<elementId>`

### Export und Import
- PNG (ganzes Board oder Auswahl) und SVG
- PDF mit einem Frame pro Seite (über den Druckdialog des Browsers)
- JSON als Backup; Import ins Board oder als neues Board
- Karten aus CSV/Tabellen, Diagramme aus Text (siehe oben)

### Übersicht
- Navigation links: „+ Neues Board“, Start, Meine Aufgaben, alle/eigene/geteilte Boards, eigene Ordner, Teams
  (mit Ordnern als Filter); rechts erscheint nur die gewählte Ansicht
- Start: einklappbare Vorlagenleiste, Hinweis auf fällige Aufgaben, zuletzt bearbeitete Boards
- Eigene und geteilte Boards mit Vorschaubildern
- Suche, Sortierung, Teilen, Umbenennen, Duplizieren, Löschen, Board verlassen
- **Papierkorb:** Gelöschte Boards bleiben 30 Tage (einstellbar) wiederherstellbar, dann werden sie endgültig gelöscht.
- Neues Board direkt aus einer Vorlage – auch aus **eigenen Vorlagen** (Board oder Auswahl als persönliche oder
  Team-Vorlage speichern)
- **Installierbare App (PWA):** im Browser über „App installieren“ (Kontomenü) als eigenes Fenster nutzbar
- „Meine Aufgaben“ über alle Boards (Karten und zugewiesene Kommentare)
- Glocke mit Benachrichtigungen

---

## Vorlagen

| Kategorie | Vorlagen |
|-----------|----------|
| Brainstorming | Brainstorming, Mindmap, Sechs Perspektiven, Crazy 8s, Pro & Contra |
| Meetings & Retros | Start · Stop · Continue, Mad · Sad · Glad, 4L, Segelboot, Seestern, DAKI, Zeitstrahl-Retro, Heißluftballon, Speedcar, Lean Coffee, Team-Radar, Daily Stand-up, Check-in / Icebreaker |
| Agile & Projekte | Kanban, Eisenhower-Matrix, Impact/Aufwand-Matrix, Projekt-Canvas, Produkt-Roadmap, Zeitstrahl, Gantt-Diagramm, User Story Map, Wochenplaner |
| Strategie | SWOT-Analyse, Stakeholder-Map, Business Model Canvas¹, Lean Canvas¹, Angebot & Kundenprofil, OKR-Planung, Entscheidungsmatrix |
| Design & UX | Customer Journey Map, Empathy Map, User Persona, Moodboard, Wireframe |
| Softwareentwicklung | Sprint-Planung, Entwicklungs-Kanban mit WIP-Limits, Definition of Ready & Done, Architektur (C4-Kontext), ER-Diagramm, Event Storming, Bug-Triage, Tech-Debt-Matrix, Release-Planung, API-Design, Architekturentscheidung (ADR) |
| UML | Klassendiagramm, Anwendungsfalldiagramm, Aktivitätsdiagramm, Zustandsdiagramm, Komponentendiagramm, Verteilungsdiagramm, Sequenzdiagramm |
| Projektmanagement | Projekt-Kick-off, Risikomatrix, RAID-Log, Projektstatus, Meilensteinplan, RACI-Matrix, Teamübergreifende Planung, Lessons Learned |
| IT-Service-Management | Incident-Postmortem, Major-Incident-Lagezentrum, Problem-Analyse (Ist / Ist nicht), Change-Request & CAB, Service Blueprint, SIPOC, Wertstromanalyse, Service-Katalog, On-Call-Übergabe, Runbook, SLA-/Service-Review, Prozessmodell (BPMN): Störung |
| IT-Infrastruktur | Netzwerkplan, Rack-Belegung, Container-Plattform (Cluster) |
| Diagramme | Flussdiagramm, Organigramm, Ishikawa (Fischgräte), 5-Why-Methode |

¹ Adaption eines Werks unter CC BY-SA 3.0, siehe [Lizenz](#lizenz).

---

## Installation

### Mit Docker (empfohlen)

```bash
git clone https://github.com/laserrapt0r/vibeboard.git
cd vibeboard
cp .env.example .env            # POSTGRES_PASSWORD auf ein langes, zufälliges Kennwort setzen
docker compose up -d --build    # startet PostgreSQL, ClamAV und vibeboard
```

Danach ist vibeboard unter http://localhost:3000 erreichbar. Den Port legt `PORT` in der `.env` fest.

So geht es weiter:
1. Beim ersten Aufruf öffnet sich die Registrierung. **Das erste Konto wird automatisch Administrator.**
2. Unter **Administration → Mailserver** den SMTP-Zugang eintragen. Erst danach können sich weitere Personen
   registrieren, denn jede Registrierung braucht eine E-Mail-Bestätigung.
3. Unter **Administration → Allgemein** die öffentliche Adresse eintragen, wenn vibeboard über einen Domainnamen
   erreichbar ist.
4. Empfohlen: im Profil unter „Sicherheit & Geräte“ die Zwei-Faktor-Anmeldung einrichten.

Alternativ legen `ADMIN_EMAIL`, `ADMIN_PASSWORD` und optional `ADMIN_NAME` in der `.env` den Administrator beim Start
an (angemeldet wird mit der E-Mail-Adresse).

ClamAV braucht etwa 1,5 GB Arbeitsspeicher. Beim ersten Start lädt es einige Minuten lang die Virensignaturen herunter;
bis dahin werden Uploads mit einem Hinweis abgelehnt.

Nützliche Befehle:

```bash
docker compose logs -f app                                        # Protokoll
docker compose down                                               # stoppen (Daten bleiben erhalten)
docker compose exec db pg_dump -U vibeboard vibeboard > backup.sql  # Datenbank sichern
docker compose --profile mailtest up -d                           # zusätzlich Test-Mailserver (Mailpit)
```

Mit dem Profil `mailtest` trägst du in der Administration den SMTP-Server `mailpit`, Port `1025`, Verschlüsselung
„keine“ ein. Alle Mails erscheinen dann unter http://localhost:8025.

### Ohne Docker

Voraussetzungen: Node.js ≥ 20, PostgreSQL ≥ 13, für Uploads ClamAV (`clamd`) und für Sicherungen vor Upgrades `pg_dump`.

```bash
npm ci
DATABASE_URL=postgres://benutzer:kennwort@localhost:5432/vibeboard \
CLAMAV_HOST=127.0.0.1 BACKUP_DIR=/var/backups/vibeboard node server.js
```

Die Tabellen werden beim Start automatisch angelegt und migriert.

---

## Konfiguration

Umgebungsvariablen (bei Docker in der `.env`):

| Variable | Standard | Bedeutung |
|----------|----------|-----------|
| `PORT` | `3000` | HTTP-Port |
| `HOST` | `0.0.0.0` | Bind-Adresse |
| `POSTGRES_PASSWORD` | – (Pflicht) | Kennwort der Datenbank im Docker-Setup |
| `POSTGRES_DB`, `POSTGRES_USER` | `vibeboard` | Name und Benutzer der Datenbank im Docker-Setup |
| `DATABASE_URL` | `postgres://vibeboard:vibeboard@localhost:5432/vibeboard` | Datenbankverbindung ohne Docker (alternativ `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT`) |
| `PUBLIC_URL` | – | Öffentliche Adresse für Links in E-Mails, z. B. `https://board.example.de` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | – | Legt bei der Ersteinrichtung diesen Administrator an – nur, wenn es noch keinen aktiven Administrator und kein Konto mit der Adresse gibt (`ADMIN_USERNAME` wird als Name weiter akzeptiert) |
| `TRUST_PROXY` | `0` | Reverse-Proxy davor: `1` (ein Proxy), `2` … (mehrere hintereinander) oder eine Liste der Proxy-Adressen/Netze, z. B. `127.0.0.1, 172.16.0.0/12`. Wertet dann `X-Forwarded-For` und `X-Forwarded-Proto` aus – siehe „Echte IP-Adressen“ |
| `CLAMAV_HOST`, `CLAMAV_PORT` | `clamav`, `3310` (Docker) | clamd-Dienst für den Virenscan; leer = kein Scanner |
| `BACKUP_DIR` | `/backups` (Docker) | Verzeichnis für Sicherungen vor Datenbank-Upgrades; leer = keine Sicherung |
| `BACKUP_KEEP` | `10` | Anzahl aufbewahrter Sicherungen |
| `BACKUP_BEFORE_UPGRADE` | `1` | `0` überspringt die Sicherung (nicht empfohlen) |
| `ALLOW_DOWNGRADE` | `0` | `1` erlaubt den Start einer älteren Version auf einer neueren Datenbank (nicht empfohlen) |
| `LOG_LEVEL` | `info` | Protokollstufe: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`; in der Administration zur Laufzeit änderbar |
| `LOG_FORMAT` | `text` | `text` (lesbar) oder `json` (eine JSON-Zeile je Eintrag, z. B. für Loki, Elasticsearch, Graylog) |
| `DATA_DIR` | `./data` | Ordner mit JSON-Boards einer früheren dateibasierten Version für einen einmaligen Import |

Alle weiteren Einstellungen nimmst du in der Administration vor.

---

## Konten und Anmeldung

- **Anmeldung mit der E-Mail-Adresse.** Der Name ist nur ein Anzeigename: Er darf Leerzeichen enthalten, muss nicht
  eindeutig sein und lässt sich im Profil jederzeit ändern. Ältere Konten ohne E-Mail-Adresse können sich übergangsweise
  mit ihrem Namen anmelden (nur, wenn er eindeutig ist) und werden auf der Startseite gebeten, eine Adresse zu ergänzen.
- **Registrierung** mit Name, E-Mail-Adresse und Kennwort.
  - Das Konto wird erst aktiv, wenn der **Bestätigungslink** aus der E-Mail geöffnet wurde (48 Stunden gültig).
  - Die Bestätigungsmail lässt sich auf der Anmeldeseite erneut anfordern.
  - Nie bestätigte Konten werden nach 14 Tagen automatisch entfernt.
- **Wegwerf-E-Mail-Adressen** sind gesperrt: eine Liste mit rund 10.000 bekannten Anbietern, Subdomains
  eingeschlossen. Zusätzlich kann der Admin eigene Domains sperren oder nur bestimmte Domains zulassen, z. B. die
  Firmendomain.
- **Registrierungsmodus:**
  - *offen*: Nach der E-Mail-Bestätigung ist das Konto aktiv.
  - *mit Freigabe*: Nach der Bestätigung schaltet ein Admin das Konto frei. Admins werden per E-Mail informiert.
  - *geschlossen*: Nur Admins legen Konten an bzw. laden per E-Mail ein.
- **Kennwortregeln** nach NIST SP 800-63B:
  - Mindestlänge 12 Zeichen (einstellbar)
  - Abgelehnt werden die 10.000 häufigsten Kennwörter, bekannte Wörter mit angehängten Ziffern, Tastaturreihen,
    Wiederholungen und Kennwörter, die Name oder E-Mail-Adresse enthalten.
  - Optional zusätzlich der Abgleich mit „Have I Been Pwned“ (k-Anonymität).
  - Eine Stärkeanzeige hilft bei der Wahl. Erzwungene Sonderzeichen gibt es bewusst nicht.
- **Zwei-Faktor-Anmeldung (TOTP):**
  - Einrichtung per QR-Code mit jeder gängigen Authenticator-App
  - 10 Wiederherstellungscodes für den Notfall
  - Für Administratoren auf Wunsch verpflichtend
- **Kennwort vergessen** per E-Mail-Link (eine Stunde gültig).
- **Profil:**
  - Anzeigename und Farbe
  - E-Mail-Adresse; eine neue Adresse wird erst nach Bestätigung übernommen, die alte erhält einen Hinweis
  - Kennwort ändern; andere Geräte werden dabei abgemeldet
- **Sicherheit & Geräte:** Übersicht aller angemeldeten Geräte mit letzter Aktivität. Einzelne oder alle anderen
  Geräte lassen sich abmelden.
- **Benachrichtigungen** per E-Mail bei sicherheitsrelevanten Änderungen: Kennwort geändert, E-Mail-Adresse geändert,
  Zwei-Faktor-Anmeldung an oder aus, Registrierungsversuch mit einer bereits verwendeten Adresse.

## Rechte auf Boards

- Boards gehören der Person, die sie angelegt hat. Die Besitzerin oder der Besitzer kann
  - Personen als *Bearbeiter*, *Kommentierende* oder *Betrachter* einladen, optional mit Einladungs-Mail. Eingeladen
    wird über die **genaue E-Mail-Adresse** oder aus der Liste der Personen, mit denen man in einem Team ist. Eine Suche
    über alle Konten gibt es bewusst nicht – niemand kann so die Nutzenden der Installation abfragen.
  - den Link für alle angemeldeten Nutzer zum *Ansehen*, *Kommentieren* oder *Bearbeiten* freigeben,
  - das Board einem **Team** zuordnen – alle Mitglieder erhalten dann die gewählte Rolle,
  - **Gastlinks** für Personen ohne Konto erstellen (nur, wenn ein Admin den Gastzugang eingeschaltet hat),
  - Mitglieder verwalten, das Board umbenennen und löschen.
- **Betrachter** sehen das Board live und können abstimmen, schätzen, Reaktionen senden, den Cursor-Chat und den
  Laserpointer nutzen. Den Versionsverlauf sehen nur Bearbeitende.
- **Kommentierende** dürfen zusätzlich kommentieren, Kommentare zuweisen und erledigen sowie Rundgänge aufzeichnen.
- Gilt eine Rolle aus mehreren Quellen (Mitgliedschaft, Team, Link), zählt die höchste. Rechteänderungen wirken sofort.
- **Gäste** sehen ausschließlich das Board ihres Links – keine Startseite, keine anderen Boards, keine Profil- oder
  Teamfunktionen. Mit Ablauf oder Sperre des Links werden ihre Zugänge gelöscht; ihre Beiträge bleiben mit Namen
  erhalten.
- **Administratoren** haben Zugriff auf alle Boards.

## Administration

Unter `/admin`, nur für Administratoren:

- **Übersicht:**
  - Benutzer, Anteil mit Zwei-Faktor-Anmeldung, unbestätigte Konten
  - fehlgeschlagene Anmeldungen der letzten 24 Stunden
  - Boards, aktive Verbindungen, Datenbankgröße
  - Hinweise auf wartende Freigaben und fehlende Einstellungen
  - **Systemmetriken**, alle 5 Sekunden aktualisiert, mit Verlauf der letzten 10 Minuten:
    - CPU-Auslastung von vibeboard und des Hosts, Systemlast
    - Arbeitsspeicher von vibeboard und des Containers bzw. Hosts
    - Reaktionszeit der Ereignisschleife
    - freier Speicherplatz für Anwendung und Sicherungen
    - Datenbankverbindungen und Cache-Trefferquote
    - Echtzeit-Verbindungen, Laufzeit, Node.js-Version
    - Kacheln mit Engpässen werden rot hervorgehoben.
- **Benutzerverwaltung:**
  - Suche und Filter (wartend, unbestätigt, deaktiviert, Admins, ohne Zwei-Faktor)
  - Benutzer anlegen, bevorzugt per Einladungs-Mail, sodass die Person ihr Kennwort selbst festlegt
  - bearbeiten, freischalten, deaktivieren, Adminrechte vergeben
  - Bestätigungsmail erneut senden oder E-Mail manuell bestätigen
  - Kennwort-Link erzeugen, Zwei-Faktor zurücksetzen, alle Sitzungen beenden
  - löschen, dabei die Boards übertragen oder mitlöschen; der letzte Administrator ist geschützt
- **Boards:** alle Boards mit Besitzer, Mitgliedern und Freigabe; Besitzer ändern, löschen
- **Allgemein:** Name der Instanz, öffentliche Adresse, Registrierungsmodus
- **Sicherheit:** Kennwort-Mindestlänge, Abgleich mit „Have I Been Pwned“, Wegwerf-Adressen, gesperrte bzw.
  erlaubte Domains, Zwei-Faktor-Pflicht für Admins
- **Zusammenarbeit:** E-Mails bei Erwähnungen, Gastzugang (standardmäßig aus) und seine längste Gültigkeit, wer
  Teams anlegen darf, Aufzeichnungen erlauben und ihre Höchstdauer, Dateianhänge und größte Datei, Aufbewahrung im
  Papierkorb, Webhooks (standardmäßig aus) und ob interne Webhook-Ziele erlaubt sind
- **Mailserver:** SMTP-Host, Port, Verschlüsselung (STARTTLS, SSL/TLS, keine), Anmeldung, Absender,
  Zertifikatsprüfung; Testmail auch vor dem Speichern
- **Rechtliches:** Impressum und Datenschutzerklärung bearbeiten und veröffentlichen (siehe unten)
- **Protokoll:** Sicherheitsprotokoll der letzten 12 Monate mit Suche und Filter. Es enthält
  - Anmeldungen und fehlgeschlagene Versuche,
  - Kennwort-, E-Mail- und Zwei-Faktor-Änderungen,
  - Admin-Aktionen mit IP-Adresse.

### Impressum und Datenschutzerklärung

- Unter **Administration → Rechtliches** werden beide Texte gepflegt und veröffentlicht. Der Editor unterstützt
  einfache Formatierung (Überschriften, Absätze, Listen, fett, kursiv, Links) und zeigt eine Live-Vorschau.
- **Vorlagen** zum Einfügen:
  - ein Impressum nach § 5 DDG
  - eine Datenschutzerklärung, die auf die tatsächliche Datenverarbeitung von vibeboard zugeschnitten ist (Konto,
    Board-Inhalte, Sitzungs-Cookie, Sicherheitsprotokoll, E-Mails, optional Pwned Passwords, Betroffenenrechte)

  Platzhalter stehen in [eckigen Klammern]. Die Vorlagen ersetzen keine Rechtsberatung.
- Die Seiten `/impressum` und `/datenschutz` sind **ohne Anmeldung** erreichbar.
- Verlinkt sind sie auf der Anmelde- und Registrierungsseite, in der Board-Übersicht, im Einstellungsmenü der Boards
  und in der Administration.
- Leere Texte werden nicht veröffentlicht; ihre Links verschwinden dann automatisch.
- Die Texte werden ohne HTML dargestellt. Eingegebenes Markup erscheint als reiner Text, Links sind nur mit http(s),
  mailto und tel erlaubt.

---

## Virenschutz für Uploads

- **Was geprüft wird:** Jede hochgeladene Datei, bevor sie gespeichert oder an andere verteilt wird:
  - Bilder per Upload, Drag & Drop oder Zwischenablage
  - Bilder in importierten Boards
  - Vorschaubilder
- **Wie geprüft wird:**
  - Mit ClamAV über das clamd-Protokoll. Im Docker-Setup läuft ClamAV als eigener Dienst und aktualisiert seine
    Signaturen selbstständig mehrmals täglich (`freshclam`).
  - Zusätzlich muss der Dateiinhalt zum angegebenen Bildtyp passen (PNG, JPEG, GIF, WebP, SVG).
- **Bei einem Fund:**
  - Die Datei wird nicht gespeichert und bei der hochladenden Person wieder entfernt; sie sieht eine Meldung mit dem
    Namen des Funds.
  - Der Vorgang steht im Sicherheitsprotokoll.
- **Ohne Scanner:**
  - Ist kein Scanner eingerichtet oder ist er nicht erreichbar, werden Uploads standardmäßig abgelehnt. Beides ist in
    der Administration unter „Sicherheit“ einstellbar.
- **Protokoll:** Jedes Prüfergebnis steht im Anwendungsprotokoll (`[uploads]`, mit Ergebnis, Dateiart, Größe,
  Kurz-Hash, Dauer und Benutzer-ID – nie der Inhalt). Funde, abgelehnte Dateitypen und bei Scannerausfall ungeprüft
  angenommene Dateien stehen zusätzlich im Sicherheitsprotokoll.
- **In der Administration:** Status und Signaturstand stehen in der Übersicht, dazu blockierte und ungeprüft
  angenommene Uploads der letzten 30 Tage. Sind die Signaturen älter als drei Tage, erscheint eine Warnung.

## Versionen und Upgrades

- **Versionsnummern:** vibeboard folgt [Semantic Versioning](https://semver.org/lang/de/). Die Version steht in
  `package.json`, alle Änderungen im [CHANGELOG](CHANGELOG.md).
- **Automatisches Upgrade beim Start:** Wird eine neue Version gestartet, aktualisiert sie die Datenbank selbst –
  auch über mehrere Versionen hinweg:
  1. Eine Datenbanksperre verhindert parallele Upgrades mehrerer Instanzen.
  2. Stehen Migrationen an, wird zuerst eine **Sicherung** mit `pg_dump` erstellt (Docker: Volume `backups`, die
     letzten 10 bleiben erhalten). Scheitert sie, bleibt die Datenbank unverändert und der Start bricht ab.
  3. Die Migrationen laufen nacheinander, jede in einer eigenen Transaktion; ein Fehler wird vollständig
     zurückgerollt.
  4. Version, Vorgänger und Sicherung werden in der Versionshistorie festgehalten (Administration → Übersicht).
- **Downgrade-Schutz:** Eine ältere Version startet nicht auf einer Datenbank, die schon von einer neueren verwendet
  wurde.
- **Offene Boards** erhalten nach einem Update den Hinweis „Neu laden“.
- **Update im Docker-Setup:** `git pull && docker compose up -d --build`.
- **Sicherung zurückspielen:**
  `docker compose exec -T db pg_restore -U vibeboard -d vibeboard --clean < sicherung.dump`
  (vorher `docker compose stop app`).

---

## Protokollierung

- **Stufen** nach üblichem Schema:

  | Stufe | Inhalt |
  |---|---|
  | `fatal` | Fehler, die den Betrieb beenden (z. B. Start fehlgeschlagen) |
  | `error` | Fehler, die jemand beheben sollte (z. B. E-Mail-Versand, Speichern, unerwartete Serverfehler mit Stacktrace) |
  | `warn` | Auffälligkeiten ohne Ausfall (z. B. Upgrade ohne Sicherung, abgelehnte Uploads, langsame Anfragen über 2 s) |
  | `info` | wichtige Abläufe (Start, Upgrades, geänderte Protokollstufe) – **Standard** |
  | `debug` | zusätzlich jede Anfrage (Methode, Pfad, Status, Dauer) und abgelehnte Anfragen |
  | `trace` | alles |

- **Einstellen:**
  - Per `LOG_LEVEL`, oder in der Administration unter „Allgemein → Protokollierung“.
  - Die Einstellung in der Administration gilt sofort und bleibt über Neustarts erhalten.
- **Format:**
  - `LOG_FORMAT=text` erzeugt lesbare Zeilen mit Zeitstempel (UTC), Stufe, Komponente und Feldern.
  - `LOG_FORMAT=json` schreibt eine JSON-Zeile je Eintrag, für Log-Sammelsysteme.
  - Fehler und Warnungen gehen nach stderr, alles andere nach stdout.
  - Ansehen im Docker-Setup: `docker compose logs -f app`.
- **Request-ID:**
  - Jede Anfrage erhält eine ID. Sie steht im Header `X-Request-Id` und an allen Protokolleinträgen dieser Anfrage.
  - Bei Serverfehlern erhält auch der Browser die ID, damit sich ein Fehler im Protokoll wiederfinden lässt.
  - Ein vorgeschalteter Proxy kann eine eigene ID mitgeben.
- **Datensparsamkeit:**
  - Kennwörter, Tokens, Cookies und Schlüssel werden automatisch geschwärzt.
  - IP-Adressen, E-Mail-Adressen, Query-Parameter und Inhalte von Boards werden nicht protokolliert.
  - Sicherheitsrelevante Ereignisse stehen getrennt davon im Sicherheitsprotokoll der Administration.

## Sicherheit

**Konten**
- Kennwörter: scrypt mit N=2¹⁷, r=8, p=1 (OWASP-Empfehlung) und Salt; Vergleich in konstanter Zeit, auch bei
  unbekannten Benutzernamen. Ältere Hashes werden beim nächsten Login automatisch erneuert.
- Höchstens zwei Hash-Berechnungen gleichzeitig, damit massenhafte Anmeldeversuche den Server nicht überlasten.
- Rate-Limits für Anmeldung, Registrierung, Zwei-Faktor-Codes, „Kennwort vergessen“ und Bestätigungsmails.
- TOTP-Codes können nicht wiederverwendet werden; Wiederherstellungscodes werden nur gehasht gespeichert.
- Schutz gegen das Ausforschen von Konten:
  - „Kennwort vergessen“ und „Bestätigungsmail erneut senden“ antworten immer gleich.
  - Eine Registrierung mit bereits verwendeter E-Mail-Adresse sieht von außen aus wie eine normale Registrierung.
    Die Inhaberin bzw. der Inhaber der Adresse wird stattdessen per E-Mail informiert.
- Einmal-Links (Bestätigung, Reset, Einladung) sind zufällig (256 Bit), zeitlich begrenzt und nur einmal verwendbar.
  In der Datenbank steht nur ihr Hash.

**Sitzungen**
- Das Session-Cookie ist `HttpOnly`, `SameSite=Lax` und unter HTTPS `Secure` mit `__Host-`-Präfix. In der Datenbank
  steht nur ein SHA-256-Hash des Tokens.
- Sitzungen laufen nach 30 Tagen bzw. nach 14 Tagen ohne Aktivität ab.
- Kennwortwechsel, Deaktivierung und Abmeldung beenden auch offene Live-Verbindungen.

**Web**
- Strenge Content-Security-Policy: nur eigene Skripte, keine Inline-Skripte, keine fremden Quellen, kein Einbetten in
  Frames.
- Weitere Header: HSTS (unter HTTPS), `X-Frame-Options: DENY`, `X-Content-Type-Options`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Referrer-Policy`, `Permissions-Policy`
  (Mikrofon nur für die eigene Seite, für Rundgänge mit Ton; keine Kamera, kein Standort).
- CSRF-Schutz: Ändernde API-Aufrufe brauchen den Header `X-Vibeboard: 1`.
- Rechte werden auf dem Server geprüft, für die REST-API und den Echtzeitkanal – auch Kommentar-, Moderations- und
  Teamrechte. Gastzugänge lehnt jede Schnittstelle ab, die sie nicht ausdrücklich zulässt.
- Board-Elemente werden auf dem Server und beim Darstellen geprüft (Farb-Whitelist, Zahlen erzwungen, Bilder nur
  eingebettet). So lässt sich kein Markup oder Skript einschleusen.
- Links in E-Mails entstehen nur aus der konfigurierten öffentlichen Adresse oder aus Adressen dieses Rechners. Ein
  gefälschter `Host`-Header kann sie nicht umlenken.
- Timeouts gegen langsame Verbindungen (Slowloris), Größenlimits für Anfragen.

**Betrieb**
- Der Docker-Container der Anwendung läuft als normaler Benutzer mit schreibgeschütztem Dateisystem, ohne Linux-Capabilities
  und mit `no-new-privileges`.
- Ohne gesetztes Datenbank-Kennwort startet docker-compose nicht.
- Für den Betrieb im Internet gehört ein Reverse-Proxy mit HTTPS davor (z. B. Caddy, nginx, Traefik). Setze dann
  `TRUST_PROXY=1` und `PUBLIC_URL`.

### Echte IP-Adressen im Protokoll

Steht im Protokoll bei allen Zugriffen dieselbe private Adresse wie `172.20.0.1`, sieht vibeboard nicht die Adresse
der Nutzenden, sondern die des Docker-Netzes (Gateway). Das passiert, wenn

- ein **Reverse-Proxy auf dem Host** (nginx, Caddy, Apache) an `localhost:3000` weiterleitet – Docker reicht die
  Verbindung dann über seinen Hilfsprozess `docker-proxy` weiter, oder
- Nutzende per **IPv6** oder vom Server selbst zugreifen – auch das läuft über `docker-proxy`.

Abhilfe:

1. **Mit Reverse-Proxy (empfohlen):** Der Proxy muss die Kopfzeile `X-Forwarded-For` setzen (Caddy und Traefik tun das
   von selbst, bei nginx `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` und
   `proxy_set_header X-Forwarded-Proto $scheme;`). In der `.env` dann `TRUST_PROXY=1`.
   Wichtig: Der Port der Anwendung darf dann **nur für den Proxy** erreichbar sein, sonst könnten Aufrufer die
   Kopfzeile selbst setzen und eine falsche Adresse vortäuschen. Dazu in der `.env` `PORT=127.0.0.1:3000` setzen –
   docker-compose veröffentlicht den Port dann nur auf dem Host selbst.
2. **Ohne Reverse-Proxy:** Für IPv4-Zugriffe von außen sieht vibeboard die echte Adresse, wenn Docker den
   `docker-proxy` nicht benutzt: in `/etc/docker/daemon.json` `{ "userland-proxy": false }` eintragen und Docker neu
   starten. Für IPv6 muss das Docker-Netz IPv6 unterstützen, sonst bleibt nur der Reverse-Proxy.

Die Administration (Übersicht) zeigt einen Hinweis, wenn die eigene Anfrage mit einer Docker-Gateway-Adresse oder mit
`X-Forwarded-For`, aber ohne `TRUST_PROXY` ankommt.

## Datenhaltung und Datenschutz

Alle Daten liegen in der eigenen PostgreSQL-Datenbank:

| Tabelle | Inhalt |
|---------|--------|
| `users` | Konten mit Rolle, Status, Bestätigungszeitpunkt, Kennwort-Hash, Zwei-Faktor-Schlüssel, gehashten Wiederherstellungscodes |
| `sessions` | Anmeldesitzungen (Token-Hash, Gerät, IP-Adresse, letzte Aktivität) |
| `tokens` | Einmal-Links für Bestätigung, Einladung und Kennwort-Reset (nur als Hash) |
| `audit_log` | Sicherheitsprotokoll, 12 Monate aufbewahrt |
| `settings` | Einstellungen der Instanz, inklusive SMTP-Zugang |
| `boards`, `board_members`, `board_visits` | Boards, Freigaben, zuletzt geöffnete Boards (für „seit deinem letzten Besuch“) |
| `elements` | Ein Datensatz pro Board-Element; Bilder werden verkleinert eingebettet |
| `board_versions` | Gesicherte Stände von Boards |
| `notifications` | Benachrichtigungen (Erwähnung, Antwort, Zuweisung), 90 Tage aufbewahrt |
| `board_activity` | Aktivitätsverlauf, zusammengefasst, 90 Tage bzw. höchstens 2000 Einträge je Board |
| `guest_links` | Gastlinks (nur als Hash) mit Rolle und Ablauf; Gastzugänge sind Konten mit der Rolle `guest` |
| `teams`, `team_members`, `folders`, `folder_boards` | Teams, Mitgliedschaften, Ordner |
| `board_recordings` | Aufgezeichnete Rundgänge mit Zeitspur und optionaler Tonspur |
| `team_invitations` | Offene Einladungen in Teams |
| `board_files` | Dateianhänge (Inhalt, Name, Typ, Größe, PDF-Vorschau); ohne Verweis nach 7 Tagen entfernt |
| `board_polls` | Ergebnisse von Schnellumfragen (nur Anzahl je Antwort, keine Einzelstimmen) |
| `user_templates` | Eigene und Team-Vorlagen |
| `webhooks` | Chat-Anbindungen (Adresse, Format, Ereignisse, letzter Status) |

- Ausgehende Verbindungen gibt es nur zum konfigurierten Mailserver und, falls aktiviert, zur Pwned-Passwords-API und
  zu den von Nutzenden eingerichteten Webhooks.
- Im Browser speichert vibeboard nur Ansichtseinstellungen (Zoom, dunkles Design, Werkzeugoptionen) im `localStorage`;
  der Service Worker der installierbaren App hält Oberfläche und Skripte für den Offline-Fall vor (keine Board-Daten).
- Das Repository enthält keine Nutzerdaten: `data/`, `.env` und Datenbankdateien sind in `.gitignore` ausgeschlossen.

---

## Anforderungen und Mitarbeit

- [docs/anforderungen](docs/anforderungen/README.md) beschreibt alle Funktionen als Anforderungen mit dauerhaften IDs
  und Akzeptanzkriterien.
- [CONTRIBUTING.md](CONTRIBUTING.md) legt fest, was bei jeder neuen Funktion dazugehört:
  - Anforderung ergänzen
  - Version erhöhen
  - CHANGELOG ergänzen
  - Migration plus Upgrade-Test

---

## Architektur

```
server.js              HTTP-Server, Seiten-Routing, Sicherheits-Header, CSRF-Schutz, Timeouts
lib/
  db.js                PostgreSQL-Pool, Schema-Migrationen
  auth.js              Kennwort-Hashes, Sessions, Einmal-Tokens, Zwei-Faktor-Tickets, Rate-Limits
  password.js          Kennwortrichtlinie (Länge, Listen, Muster, optional HIBP)
  email.js             E-Mail-Prüfung, Wegwerf-Domains, Sperr-/Erlaubnislisten
  totp.js              Zeitbasierte Einmalcodes (RFC 6238), Wiederherstellungscodes
  audit.js             Sicherheitsprotokoll
  version.js           Versionsverwaltung, automatisches Upgrade, Sicherung, Downgrade-Schutz
  virusscan.js         ClamAV-Anbindung (clamd), Dateityp-Prüfung
  uploads.js           Prüfrichtlinie für hochgeladene Dateien
  boards.js            Zugriffsrechte, Board-Cache, verzögertes Speichern, Echtzeit-Räume, Long-Polling,
                       privater Modus, Schätzrunden, Versionen, Moderation
  comments.js          Kommentar-Operationen (Autorschaft, Erwähnungen, Zuweisung)
  notify.js            Benachrichtigungen (Glocke, live, E-Mail)
  activity.js          Aktivitätsverlauf (zusammengefasst)
  guests.js            Gastlinks und Gastzugänge
  teams.js             Teams und Ordner
  recordings.js        Aufgezeichnete Rundgänge
  sanitize.js          Prüfung von Board-Elementen
  settings.js          Einstellungen der Instanz
  mail.js              E-Mail-Versand
  setup.js             Admin aus Umgebungsvariablen, Import alter Boards, Aufräumen
  routes/              REST-API: auth.js, boards.js, collab.js, admin.js, legal.js
  data/                Liste der Wegwerf-Domains und häufigen Kennwörter
scripts/test-upgrade.js  Upgrade-Test für Datenbank-Migrationen (npm run test:upgrade)
docs/anforderungen/      Anforderungsdokumente
public/
  auth.html            Anmelden, Registrieren, Bestätigen, Kennwort  → js/auth.js
  legal.html           Impressum, Datenschutzerklärung (öffentlich)  → js/legal.js, js/markdown.js
  index.html           Board-Übersicht                               → js/dashboard.js, js/notifications.js
  guest.html           Beitritt per Gastlink                         → js/guest.js
  board.html           Board-Editor                                  → js/main.js (core, ui, collab, render, sync, …)
                       teamwork.js (privater Modus, Schätzrunde), planning.js (Aufgaben, Versionen, CSV-Import),
                       moderation.js, activity.js, recording.js, notifications.js (Arbeiten im Team),
                       diagram-parse.js / diagram-text.js (Diagramm aus Text), highlight.js (Code-Blöcke),
                       templates.js / templates-tech.js / templates-diagrams.js / template-kit.js (Vorlagen)
  admin.html           Administration                                → js/admin.js
```

**Echtzeit:**
- Jeder Client empfängt Änderungen über Server-Sent Events (`/api/boards/:id/events`) und sendet eigene Änderungen
  gebündelt per POST.
- Kommt über den Stream innerhalb von 8 Sekunden keine Begrüßung an, nutzt der Client Long-Polling
  (`/api/boards/:id/poll`). Zum Testen lässt sich das mit `?transport=poll` erzwingen.
- Der Server hält aktive Boards im Arbeitsspeicher, verteilt Änderungen sofort und schreibt sie gesammelt in die
  Datenbank.
- Ändern zwei Personen gleichzeitig dasselbe Element, gewinnt die letzte Änderung. Tabellen werden zellgenau
  abgeglichen, Kommentare über eigene Operationen (der Server ergänzt Autor und Zeitpunkt).

---

## Lizenz

vibeboard steht unter der [MIT-Lizenz](LICENSE).

Ausnahmen und Inhalte Dritter, Details in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md):

- **Business Model Canvas**: Adaption des „Business Model Canvas“ von Strategyzer AG (strategyzer.com), lizenziert unter
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- **Lean Canvas**: Adaption des „Lean Canvas“ von Ash Maurya (leanstack.com), lizenziert unter CC BY-SA 3.0.
- **Icons**: teilweise aus bzw. nach [Lucide](https://lucide.dev) (ISC) und [Feather](https://feathericons.com) (MIT).
- **Wegwerf-Domains**: [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) (CC0).
- **Häufige Kennwörter**: [SecLists](https://github.com/danielmiessler/SecLists) (MIT).

Erwähnte Produkt- und Methodennamen gehören ihren jeweiligen Inhabern und dienen nur der Beschreibung.
