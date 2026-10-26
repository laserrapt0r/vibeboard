# dlzboard

Kollaboratives Online-Whiteboard nach dem Vorbild von **Miro** und **Conceptboard**: unendliche Leinwand,
Echtzeit-Zusammenarbeit, Moderationswerkzeuge und über 35 Vorlagen. Dazu kommen Benutzerkonten, Freigaben pro Board
und eine Administrationsoberfläche. Die Daten liegen in PostgreSQL.

## Schnellstart mit Docker (empfohlen)

```bash
cp .env.example .env          # Datenbank-Kennwort anpassen
docker compose up -d --build  # startet PostgreSQL und dlzboard
# → http://localhost:3000
```

Beim ersten Aufruf landet man auf der Registrierung. **Das erste Konto wird automatisch Administrator.**
Alternativ legt `ADMIN_USERNAME`/`ADMIN_PASSWORD` in der `.env` den Administrator beim Start an.

- Die Datenbank liegt im Docker-Volume `pgdata`. Ein Backup erzeugt
  `docker compose exec db pg_dump -U dlzboard dlzboard > backup.sql`.
- Test-Mailserver ohne echtes Postfach: `docker compose --profile mailtest up -d`. Danach in der Administration
  den SMTP-Server `mailpit`, Port `1025`, Verschlüsselung „keine“ eintragen. Die Mails erscheinen unter
  http://localhost:8025.
- Alte Boards aus der dateibasierten Version 1 (`data/boards/*.json`) werden beim ersten Start einmalig übernommen
  und gehören dann dem ersten Administrator.

Falls `permission denied … docker.sock` erscheint, ist der Benutzer nicht in der Gruppe `docker`
(`sudo usermod -aG docker $USER`, danach neu anmelden). Alternativ die Befehle mit `sudo` ausführen.

## Ohne Docker

Voraussetzungen: Node.js ≥ 20 und ein PostgreSQL-Server (ab Version 13).

```bash
npm ci
DATABASE_URL=postgres://dlzboard:kennwort@localhost:5432/dlzboard node server.js
```

Die Tabellen werden beim Start automatisch angelegt bzw. migriert.

| Variable | Standard | Bedeutung |
|----------|----------|-----------|
| `PORT` | `3000` | HTTP-Port |
| `HOST` | `0.0.0.0` | Bind-Adresse |
| `DATABASE_URL` | `postgres://dlzboard:dlzboard@localhost:5432/dlzboard` | Datenbankverbindung (alternativ `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT`) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` | – | Legt diesen Administrator an, falls es ihn noch nicht gibt |
| `DATA_DIR` | `./data` | Ordner mit alten JSON-Boards für den einmaligen Import |
| `TRUST_PROXY` | `0` | `1` hinter einem Reverse-Proxy (wertet `X-Forwarded-For` aus) |
| `PUBLIC_URL` | – | Öffentliche Adresse für Links in E-Mails (alternativ in der Administration) |

## Benutzer und Rechte

- **Registrierung** mit Benutzername und Kennwort. E-Mail-Adresse und Anzeigename sind optional; die Adresse lässt sich
  als Pflichtfeld einstellen.
- **Registrierungsmodus** (Administration → Allgemein):
  - *offen*: Jede Person kann sich registrieren.
  - *mit Freigabe*: Neue Konten warten, bis ein Admin sie freischaltet. Admins werden per Mail informiert, die Person
    bekommt nach der Freigabe eine Mail.
  - *geschlossen*: Nur Admins legen Konten an.
- **Kennwort vergessen** per E-Mail-Link (eine Stunde gültig). Ohne Mailserver erzeugt ein Admin einen Link zum
  Weitergeben (24 Stunden gültig).
- **Profil**: Anzeigename, E-Mail, Farbe für Cursor und Avatar, Kennwort ändern. Beim Ändern des Kennworts werden
  andere Geräte abgemeldet.
- **Boards** gehören der Person, die sie anlegt. Die Besitzerin oder der Besitzer kann
  - Personen einladen, als *Bearbeiter* oder *Betrachter* (mit optionaler Einladungs-Mail),
  - den Link für alle angemeldeten Nutzer zum *Ansehen* oder *Bearbeiten* freigeben,
  - das Board umbenennen, löschen und Mitglieder entfernen.
- Betrachter sehen das Board live, dürfen aber nur Laserpointer, Reaktionen und Abstimmungen nutzen. Rechteänderungen
  wirken sofort, offene Boards laden sich dafür neu.
- **Administratoren** haben Zugriff auf alle Boards.

## Administration (`/admin`)

- **Übersicht**: Benutzer, Boards, Elemente, aktive Verbindungen, Datenbankgröße. Hinweis auf wartende Freigaben und
  fehlenden Mailserver.
- **Benutzer**: anlegen, bearbeiten, freischalten, deaktivieren, zum Admin machen, Kennwort-Link erzeugen, löschen.
  Beim Löschen werden die Boards übertragen oder ebenfalls gelöscht. Der letzte Admin ist geschützt.
- **Boards**: alle Boards mit Besitzer und Freigabe; Besitzer ändern, löschen.
- **Allgemein**: Name der Anwendung, öffentliche Adresse für Links in E-Mails, Registrierungsmodus.
- **Mailserver**: SMTP-Host, Port, STARTTLS/SSL/ohne, Anmeldung, Absender, Zertifikatsprüfung und eine Testmail
  (funktioniert auch vor dem Speichern). Das SMTP-Kennwort wird nie an den Browser zurückgegeben.

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
- Teilen-Dialog mit Mitgliedern, Rollen und Link-Freigabe, Anzeige der LAN-Adressen
- Reaktionen (fliegende Emojis) und Laserpointer

**Moderation**
- Gemeinsamer Timer mit Signalton
- Abstimmungen (Stimmen pro Person, verdeckte Stimmabgabe, Ergebnisliste)
- Präsentationsmodus: Frames werden zu Folien (Vollbild, Pfeiltasten, Umgebung ausgeblendet)

**Export & Import**
- PNG (ganzes Board oder Auswahl), SVG, PDF (je Frame eine Seite über den Druckdialog), JSON-Backup
- JSON-Import (im Board oder als neues Board auf der Übersicht)

**Übersicht**
- Eigene und geteilte Boards mit Vorschaubildern, Suche, Sortierung, Teilen, Umbenennen, Duplizieren, Löschen
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
server.js              HTTP-Server, Seiten-Routing (Anmeldung erforderlich), CSRF-Schutz
lib/
  db.js                PostgreSQL-Pool, Schema-Migrationen
  auth.js              scrypt-Kennwort-Hashes, Sessions (HttpOnly-Cookie), Einmal-Tokens, Rate-Limits
  boards.js            Zugriffsrechte, Board-Cache im Speicher, verzögertes Speichern, Echtzeit-Räume
  settings.js          Systemeinstellungen (Tabelle settings)
  mail.js              E-Mail-Versand (nodemailer) mit HTML-/Text-Vorlage
  setup.js             Admin aus Umgebungsvariablen, Import alter JSON-Boards, Aufräumen
  routes/auth.js       Registrierung, Anmeldung, Profil, Kennwort vergessen, Benutzersuche
  routes/boards.js     Boards, Mitglieder, Vorschaubilder, SSE-Kanal, Operationen
  routes/admin.js      Administration
public/
  auth.html            Anmelden / Registrieren / Kennwort  → js/auth.js
  index.html           Board-Übersicht                      → js/dashboard.js
  board.html           Board-Editor                         → js/main.js (core, ui, collab, …)
  admin.html           Administration                       → js/admin.js
```

### Datenmodell

| Tabelle | Inhalt |
|---------|--------|
| `users` | Konten mit Rolle (`admin`/`user`), Status (`active`/`pending`/`disabled`) und scrypt-Hash |
| `sessions` | Anmeldesitzungen (nur SHA-256 des Tokens wird gespeichert), 30 Tage gültig |
| `tokens` | Einmal-Links zum Zurücksetzen des Kennworts |
| `settings` | Einstellungen als JSON (`general`, `smtp`) |
| `boards` | Name, Besitzer, Link-Freigabe, Timer/Abstimmung, Vorschaubild |
| `board_members` | Freigaben pro Person (`editor`/`viewer`) |
| `board_visits` | Zuletzt geöffnete Boards (für „Mit mir geteilt“ bei Link-Freigaben) |
| `elements` | Ein Datensatz pro Board-Element (JSONB) |

**Synchronisation:** Jeder Client hält eine EventSource-Verbindung (`/api/boards/:id/events`). Die Rolle prüft der
Server beim Verbindungsaufbau. Änderungen gehen als gebündelte Operationen per POST an den Server. Er wendet sie auf
die Kopie im Arbeitsspeicher an, verteilt sie sofort an alle anderen und schreibt geänderte Elemente nach etwa einer
Sekunde gesammelt in die Datenbank. Gleichzeitige Änderungen am selben Element lösen sich nach „Last-Writer-Wins“
auf. Beim Beenden (SIGTERM/SIGINT) werden offene Änderungen gespeichert.

### Sicherheit

- Kennwörter mit scrypt (N=16384) und Salt; Vergleich in konstanter Zeit, auch bei unbekannten Benutzernamen.
- Session-Cookie `HttpOnly`, `SameSite=Lax`, bei HTTPS `Secure`. In der Datenbank steht nur der Hash des Tokens.
- CSRF-Schutz: Alle ändernden API-Aufrufe müssen den Header `X-DLZ: 1` tragen.
- Rate-Limits für Anmeldung, Registrierung und „Kennwort vergessen“.
- Links in E-Mails (Kennwort-Reset, Einladungen) entstehen nur aus der konfigurierten öffentlichen Adresse. Ohne
  Konfiguration wird die Adresse der Anfrage nur übernommen, wenn sie auf diesen Rechner zeigt (localhost, eigener
  Hostname oder eigene IP). Das verhindert, dass ein gefälschter `Host`-Header Reset-Links auf fremde Seiten umlenkt.
- Board-Elemente werden auf dem Server und beim Darstellen geprüft: Farben nur aus einer Whitelist, Koordinaten nur
  als Zahlen. So lässt sich kein Markup oder Skript in das SVG einschleusen.
- Für den Betrieb im Internet HTTPS über einen Reverse-Proxy (Caddy, nginx, Traefik) und `TRUST_PROXY=1` setzen.

## Hinweise

- Bilder werden verkleinert direkt im Board gespeichert (als Element in der Datenbank).
- Gleichzeitige Bearbeitung desselben Elements: Die letzte Änderung gewinnt. Es gibt keine Versionshistorie.
