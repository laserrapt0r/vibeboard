# dlzboard

Kollaboratives Online-Whiteboard nach dem Vorbild von **Miro** und **Conceptboard** – unendliche Leinwand,
Echtzeit-Zusammenarbeit, Moderationswerkzeuge und über 35 Vorlagen. Komplett ohne externe Abhängigkeiten:
Node.js-Server mit Standardbibliothek, Frontend in reinem JavaScript/SVG.

## Schnellstart

```bash
node server.js            # oder: npm start
# → http://localhost:3000
```

Benötigt Node.js ≥ 18. Es gibt nichts zu installieren (`npm install` ist nicht nötig).

Umgebungsvariablen:

| Variable   | Standard   | Bedeutung                               |
|------------|------------|-----------------------------------------|
| `PORT`     | `3000`     | HTTP-Port                               |
| `HOST`     | `0.0.0.0`  | Bind-Adresse                            |
| `DATA_DIR` | `./data`   | Ablage der Boards (JSON) und Vorschaubilder |

### Docker

```bash
docker compose up -d --build     # → http://localhost:3000, Daten im Volume "dlzboard-data"
```

Falls `permission denied … docker.sock` erscheint, ist der Benutzer nicht in der Gruppe `docker`
(`sudo usermod -aG docker $USER`, danach neu anmelden) – oder die Befehle mit `sudo` ausführen.

## Funktionen

**Leinwand & Navigation**
- Unendliche Leinwand mit Zoom (1 %–800 %), Verschieben per Leertaste/Hand-Werkzeug/mittlere Maustaste/Trackpad, Pinch-Zoom auf Touch-Geräten
- Minimap, „Alles anzeigen“, Zoomstufen, Punktraster, Einrasten am Raster, intelligente Hilfslinien beim Verschieben
- Dunkles Design, Ansicht wird pro Board gemerkt

**Inhalte**
- Sticky Notes (16 Farben, automatische Schriftgröße, optional mit Autor)
- Text, 16 Formen (Rechteck, Ellipse, Raute, Dreieck, Sechseck, Stern, Zylinder, Dokument, Wolke, Sprechblase, Blockpfeil …) mit Füllung, Rahmen, Strichart, Textformatierung
- Verbindungslinien (gerade, gewinkelt, Kurve) mit Pfeilspitzen und Beschriftung, die an Elementen haften
- „Quick Connect“: an einem ausgewählten Element die Punkte anklicken/ziehen, um verbundene Elemente zu erzeugen
- Freihand-Stift, Textmarker, Radierer
- Frames (Bereiche/Folien, mit Formatvorlagen 16:9, A4 …) – Inhalte wandern beim Verschieben mit
- Karten/Aufgaben mit Beschreibung, Zuständigkeit, Fälligkeit, Status und Farbe
- Tabellen (Zeilen/Spalten hinzufügen, Tab springt zur nächsten Zelle)
- Mindmaps: Knoten auswählen und **Tab** (Unterknoten) bzw. **Enter** (Geschwister) drücken
- Bilder per Upload, Drag & Drop oder Einfügen aus der Zwischenablage, Sticker/Emojis
- Links an Elementen (Link-Symbol öffnet die Adresse)
- Mehrzeiligen Text einfügen → eine Sticky Note pro Zeile

**Bearbeiten**
- Mehrfachauswahl (Rahmen ziehen, Umschalt-Klick), Größe ändern, Ausrichten & Verteilen, als Raster anordnen
- Sticky Notes nach Farbe clustern
- Gruppieren, Sperren, Ebenen (Vorder-/Hintergrund), Duplizieren (auch Alt-Ziehen)
- Kopieren/Einfügen – auch zwischen Boards
- Rückgängig/Wiederholen, Kontextmenü, Suche (Strg+F), umfangreiche Tastenkürzel (`?`)

**Zusammenarbeit (Echtzeit)**
- Alle Änderungen live bei allen Teilnehmenden, inkl. Live-Cursor und Auswahl der anderen
- Teilnehmerliste, „Folgen“ einer Person, „Alle zu mir holen“
- Kommentare mit Threads, @Erwähnungen, „Erledigt“-Status und Kommentarübersicht
- Teilen-Links zum Bearbeiten oder **nur Ansehen** (`?mode=view`), Anzeige der LAN-Adressen
- Reaktionen (fliegende Emojis) und Laserpointer

**Moderation**
- Gemeinsamer Timer mit Signalton
- Abstimmungen (Stimmen pro Person, verdeckte Stimmabgabe, Ergebnisliste)
- Präsentationsmodus: Frames werden zu Folien (Vollbild, Pfeiltasten, Umgebung ausgeblendet)

**Export & Import**
- PNG (ganzes Board oder Auswahl), SVG, PDF (je Frame eine Seite über den Druckdialog), JSON-Backup
- JSON-Import (im Board oder als neues Board auf der Übersicht)

**Übersicht**
- Board-Liste mit Vorschaubildern, Suche, Sortierung, Umbenennen, Duplizieren, Löschen
- Neues Board direkt aus einer Vorlage

## Vorlagen

| Kategorie | Vorlagen |
|-----------|----------|
| Brainstorming | Brainstorming, Mindmap, Sechs Denkhüte, Crazy 8s, Pro & Contra |
| Meetings & Retros | Start·Stop·Continue, Mad·Sad·Glad, 4L, Segelboot, Daily Stand-up, Check-in/Icebreaker |
| Agile & Projekte | Kanban, Eisenhower-Matrix, Impact/Aufwand-Matrix, Projekt-Canvas, Produkt-Roadmap, Zeitstrahl, Gantt, User Story Map, Wochenplaner |
| Strategie | SWOT, Stakeholder-Map, Business Model Canvas, Lean Canvas, Value Proposition Canvas, OKR, Entscheidungsmatrix |
| Design & UX | Customer Journey Map, Empathy Map, User Persona, Moodboard, Wireframe |
| Diagramme | Flussdiagramm, Organigramm, Ishikawa (Fischgräte), 5-Why |

## Architektur

```
server.js            HTTP-Server: statische Dateien, REST-API, SSE-Echtzeitkanal, JSON-Persistenz
public/
  index.html         Board-Übersicht       → js/dashboard.js
  board.html         Board-Editor          → js/main.js
  css/app.css        Gesamtes Styling (hell/dunkel, responsiv)
  js/core.js         Zustand, Ansicht, Rendering-Schleife, Undo/Redo, Werkzeuge, Maus/Tastatur
  js/ui.js           Werkzeugleisten, Kontextleiste, Panels, Menüs, Export, Minimap
  js/collab.js       Teilnehmende, Cursor, Folgen, Timer, Abstimmung, Präsentation
  js/render.js       Elemente → SVG (wird auch für Vorschau und Export genutzt)
  js/templates.js    Vorlagen-Bibliothek
  js/sync.js         Senden (gebündelte POSTs) / Empfangen (EventSource)
  js/exporter.js     PNG/SVG/PDF-Export, Vorschaubilder
```

**Synchronisation:** Jeder Client hält eine EventSource-Verbindung (`/api/boards/:id/events`). Änderungen werden
als Operationen (`upsert`, `delete`, `timer`, `voting`, `vote`, `rename`) gebündelt per POST gesendet, vom Server
angewendet und an alle anderen verteilt (Last-Writer-Wins pro Element). Flüchtige Signale wie Cursor, Auswahl,
Laser oder Reaktionen laufen über `/signal` und werden nicht gespeichert.

**Speicherung:** Ein Board = eine JSON-Datei in `data/boards/`, verzögert und atomar geschrieben.

### REST-API

| Methode | Pfad | Zweck |
|---------|------|-------|
| GET | `/api/boards` | Liste aller Boards |
| POST | `/api/boards` | Board anlegen (`{ name, elements? }`) |
| GET / PATCH / DELETE | `/api/boards/:id` | Board lesen / umbenennen / löschen |
| POST | `/api/boards/:id/duplicate` | Board duplizieren |
| GET | `/api/boards/:id/events` | Echtzeit-Stream (SSE) |
| POST | `/api/boards/:id/ops` | Operationen anwenden |
| POST | `/api/boards/:id/signal` | Flüchtiges Signal verteilen |
| GET / PUT | `/api/boards/:id/thumb` | Vorschaubild |
| GET | `/api/info` | Version und LAN-Adressen |

## Hinweise

- Es gibt keine Benutzerkonten: Wer den Link kennt, hat Zugriff. Der Nur-Ansehen-Link schränkt die Oberfläche ein und
  der Server lehnt Änderungen dieses Clients ab, ist aber kein Ersatz für eine Authentifizierung. Für den Einsatz im
  Internet einen Reverse-Proxy mit Anmeldung (z. B. Basic Auth) davorschalten.
- Bilder werden (verkleinert) direkt im Board gespeichert.
