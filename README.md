# dlzboard

Ein selbst gehostetes, kollaboratives Online-Whiteboard. Mehrere Personen arbeiten gleichzeitig auf einer
unendlichen Leinwand: mit Sticky Notes, Formen, Verbindungen, Mindmaps, Kommentaren, Abstimmungen und über 35
Vorlagen für Workshops, Retrospektiven und Strategiearbeit. Dazu gibt es Benutzerkonten mit Rechten pro Board und eine
Administrationsoberfläche. Die Daten liegen in PostgreSQL.

- Läuft komplett auf dem eigenen Server: keine externen Dienste, keine CDNs, kein Tracking.
- Frontend in reinem JavaScript und SVG, ohne Build-Schritt.
- Backend in Node.js mit nur zwei Abhängigkeiten (`pg`, `nodemailer`).

---

## Inhalt

- [Funktionen](#funktionen)
- [Vorlagen](#vorlagen)
- [Installation](#installation)
- [Konfiguration](#konfiguration)
- [Benutzer und Rechte](#benutzer-und-rechte)
- [Administration](#administration)
- [Datenhaltung und Datenschutz](#datenhaltung-und-datenschutz)
- [Sicherheit](#sicherheit)
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
| **Formen** | 16 Formen (Rechteck, Ellipse, Raute, Dreieck, Sechseck, Stern, Zylinder, Dokument, Wolke, Sprechblase, Blockpfeil u. a.) mit Füllung, Rahmen, Strichart und Text |
| **Verbindungen** | gerade, gewinkelt oder als Kurve; Pfeilspitzen, Beschriftung, Strichart; haften an Elementen |
| **Quick Connect** | Punkte an einem ausgewählten Element anklicken oder ziehen, um verbundene Elemente zu erzeugen |
| **Freihand** | Stift, Textmarker, Radierer |
| **Frames** | Bereiche bzw. Folien mit Formaten (16:9, 4:3, A4, Quadrat, Smartphone); der Inhalt wandert beim Verschieben mit |
| **Karten** | Aufgaben mit Beschreibung, Zuständigkeit, Fälligkeitsdatum, Status und Farbe |
| **Tabellen** | Zeilen und Spalten hinzufügen oder entfernen, Kopfzeile; Tab springt zur nächsten Zelle |
| **Mindmaps** | Knoten auswählen, dann **Tab** für einen Unterknoten und **Enter** für einen Geschwisterknoten |
| **Bilder** | per Upload, Drag & Drop oder aus der Zwischenablage; große Bilder werden automatisch verkleinert |
| **Sticker** | Emojis als frei platzierbare Elemente |
| **Links** | URL an Elemente hängen; ein Link-Symbol öffnet sie |
| **Kommentare** | Threads an beliebiger Stelle, @Erwähnungen, „Erledigt“-Status, Kommentarübersicht |

Mehrzeiligen Text in das Board einfügen erzeugt automatisch eine Sticky Note pro Zeile.

### Bearbeiten
- Mehrfachauswahl per Auswahlrahmen oder Umschalt-Klick, Größe ändern, Seitenverhältnis beibehalten
- Ausrichten (links, mittig, rechts, oben, unten), gleichmäßig verteilen, als Raster anordnen
- Sticky Notes nach Farbe clustern
- Gruppieren, Sperren, Ebenen (Vorder- und Hintergrund), Duplizieren (auch per Alt-Ziehen)
- Kopieren und Einfügen, auch zwischen Boards
- Rückgängig und Wiederholen, Kontextmenü, Suche (Strg+F)
- Umfangreiche Tastenkürzel (Übersicht mit `?`)

### Zusammenarbeit in Echtzeit
- Änderungen erscheinen sofort bei allen Teilnehmenden
- Live-Cursor mit Namen; die Auswahl der anderen ist farbig markiert
- Teilnehmerliste mit „Folgen“ (der Ansicht einer Person folgen) und „Alle zu mir holen“
- Fliegende Reaktionen (Emojis) und Laserpointer
- Automatisches Wiederverbinden; ungesendete Änderungen gehen nicht verloren

### Moderation
- **Timer** für alle Teilnehmenden, mit Pause, Verlängerung und Signalton
- **Abstimmungen** mit einstellbarer Stimmenzahl pro Person; die Stimmen bleiben bis zum Ende verdeckt, danach gibt es eine Ergebnisliste
- **Präsentationsmodus**: Frames werden zu Folien (Vollbild, Pfeil- und Leertaste, Umgebung ausgeblendet)

### Export und Import
- PNG (ganzes Board oder Auswahl) und SVG
- PDF mit einem Frame pro Seite (über den Druckdialog des Browsers)
- JSON als Backup; Import ins Board oder als neues Board

### Übersicht
- Eigene und geteilte Boards mit Vorschaubildern
- Suche, Sortierung, Teilen, Umbenennen, Duplizieren, Löschen, Board verlassen
- Neues Board direkt aus einer Vorlage

---

## Vorlagen

| Kategorie | Vorlagen |
|-----------|----------|
| Brainstorming | Brainstorming, Mindmap, Sechs Perspektiven, Crazy 8s, Pro & Contra |
| Meetings & Retros | Start · Stop · Continue, Mad · Sad · Glad, 4L, Segelboot, Daily Stand-up, Check-in / Icebreaker |
| Agile & Projekte | Kanban, Eisenhower-Matrix, Impact/Aufwand-Matrix, Projekt-Canvas, Produkt-Roadmap, Zeitstrahl, Gantt-Diagramm, User Story Map, Wochenplaner |
| Strategie | SWOT-Analyse, Stakeholder-Map, Business Model Canvas¹, Lean Canvas¹, Angebot & Kundenprofil, OKR-Planung, Entscheidungsmatrix |
| Design & UX | Customer Journey Map, Empathy Map, User Persona, Moodboard, Wireframe |
| Diagramme | Flussdiagramm, Organigramm, Ishikawa (Fischgräte), 5-Why-Methode |

¹ Adaption eines Werks unter CC BY-SA 3.0, siehe [Lizenz](#lizenz).

---

## Installation

### Mit Docker (empfohlen)

```bash
git clone https://github.com/laserrapt0r/vibeboard.git
cd vibeboard
cp .env.example .env            # mindestens POSTGRES_PASSWORD ändern
docker compose up -d --build    # startet PostgreSQL und dlzboard
```

Danach ist dlzboard unter http://localhost:3000 erreichbar. Den Port legt `PORT` in der `.env` fest.

Beim ersten Aufruf öffnet sich die Registrierung. **Das erste Konto wird automatisch Administrator.** Alternativ
legen `ADMIN_USERNAME` und `ADMIN_PASSWORD` in der `.env` den Administrator beim Start an.

Nützliche Befehle:

```bash
docker compose logs -f app                                        # Protokoll
docker compose down                                               # stoppen (Daten bleiben erhalten)
docker compose exec db pg_dump -U dlzboard dlzboard > backup.sql  # Datenbank sichern
docker compose --profile mailtest up -d                           # zusätzlich Test-Mailserver (Mailpit)
```

Mit dem Profil `mailtest` trägst du in der Administration den SMTP-Server `mailpit`, Port `1025`, Verschlüsselung
„keine“ ein. Alle Mails erscheinen dann unter http://localhost:8025.

### Ohne Docker

Voraussetzungen: Node.js ≥ 20 und PostgreSQL ≥ 13.

```bash
npm ci
DATABASE_URL=postgres://benutzer:kennwort@localhost:5432/dlzboard node server.js
```

Die Tabellen werden beim Start automatisch angelegt und migriert.

---

## Konfiguration

Umgebungsvariablen (bei Docker in der `.env`):

| Variable | Standard | Bedeutung |
|----------|----------|-----------|
| `PORT` | `3000` | HTTP-Port |
| `HOST` | `0.0.0.0` | Bind-Adresse |
| `DATABASE_URL` | `postgres://dlzboard:dlzboard@localhost:5432/dlzboard` | Datenbankverbindung (alternativ `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT`) |
| `POSTGRES_PASSWORD` | `dlzboard` | Kennwort der Datenbank im Docker-Setup – **unbedingt ändern** |
| `PUBLIC_URL` | – | Öffentliche Adresse für Links in E-Mails, z. B. `https://board.example.de` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` | – | Legt diesen Administrator an, falls es ihn noch nicht gibt |
| `TRUST_PROXY` | `0` | `1` hinter einem Reverse-Proxy (wertet `X-Forwarded-For` aus) |
| `DATA_DIR` | `./data` | Ordner mit JSON-Boards der dateibasierten Version 1 für einen einmaligen Import |

Alle weiteren Einstellungen (Name der Instanz, Registrierung, Mailserver) nimmst du in der Administration vor.

---

## Benutzer und Rechte

- **Registrierung** mit Benutzername und Kennwort. E-Mail-Adresse und Anzeigename sind optional; die E-Mail-Adresse
  lässt sich als Pflichtfeld einstellen.
- **Registrierungsmodus:**
  - *offen*: Jede Person kann sich registrieren.
  - *mit Freigabe*: Neue Konten warten, bis ein Admin sie freischaltet. Admins werden per E-Mail informiert.
  - *geschlossen*: Nur Admins legen Konten an.
- **Kennwort vergessen** per E-Mail-Link (eine Stunde gültig). Ohne Mailserver erzeugt ein Admin einen Link zum
  Weitergeben.
- **Profil:** Anzeigename, E-Mail-Adresse, Farbe für Cursor und Avatar, Kennwort ändern.
- **Boards** gehören der Person, die sie angelegt hat. Die Besitzerin oder der Besitzer kann
  - Personen als *Bearbeiter* oder *Betrachter* einladen, optional mit Einladungs-Mail,
  - den Link für alle angemeldeten Nutzer zum *Ansehen* oder *Bearbeiten* freigeben,
  - Mitglieder verwalten, das Board umbenennen und löschen.
- **Betrachter** sehen das Board live und können abstimmen, Reaktionen senden und den Laserpointer nutzen.
- Rechteänderungen wirken sofort.
- **Administratoren** haben Zugriff auf alle Boards.

## Administration

Unter `/admin`, nur für Administratoren:

- **Übersicht:** Benutzer, Boards, Elemente, aktive Verbindungen, Datenbankgröße; Hinweise auf wartende Freigaben
  und einen fehlenden Mailserver
- **Benutzer:**
  - anlegen, bearbeiten, freischalten, deaktivieren, Adminrechte vergeben
  - Kennwort-Link erzeugen
  - löschen, dabei die Boards übertragen oder mitlöschen
  - der letzte Administrator ist geschützt
- **Boards:** alle Boards mit Besitzer, Mitgliedern und Freigabe; Besitzer ändern, löschen
- **Allgemein:** Name der Instanz, öffentliche Adresse, Registrierungsmodus, E-Mail-Pflicht
- **Mailserver:** SMTP-Host, Port, Verschlüsselung (STARTTLS, SSL/TLS, keine), Anmeldung, Absender,
  Zertifikatsprüfung; Testmail auch vor dem Speichern

---

## Datenhaltung und Datenschutz

Alle Daten liegen in der eigenen PostgreSQL-Datenbank:

| Tabelle | Inhalt |
|---------|--------|
| `users` | Konten mit Rolle, Status und Kennwort-Hash (scrypt) |
| `sessions` | Anmeldesitzungen; gespeichert wird nur ein SHA-256-Hash des Tokens |
| `tokens` | Einmal-Links zum Zurücksetzen des Kennworts |
| `settings` | Einstellungen der Instanz, inklusive SMTP-Zugang |
| `boards`, `board_members`, `board_visits` | Boards, Freigaben, zuletzt geöffnete Boards |
| `elements` | Ein Datensatz pro Board-Element; Bilder werden verkleinert eingebettet |

- dlzboard ruft keine externen Dienste auf und lädt keine Ressourcen von Dritten.
- Ausgehende Verbindungen gibt es nur zum konfigurierten Mailserver.
- Im Browser speichert dlzboard nur Ansichtseinstellungen (Zoom, dunkles Design, Werkzeugoptionen) im `localStorage`.
- Das Repository enthält keine Nutzerdaten: `data/`, `.env` und Datenbankdateien sind in `.gitignore` ausgeschlossen.

## Sicherheit

- Kennwörter werden mit scrypt und Salt gehasht und in konstanter Zeit verglichen. Unbekannte Benutzernamen lassen sich
  nicht an der Antwortzeit erkennen.
- Das Session-Cookie ist `HttpOnly`, `SameSite=Lax` und bei HTTPS `Secure`.
- CSRF-Schutz: Ändernde API-Aufrufe brauchen den Header `X-DLZ: 1`.
- Rate-Limits für Anmeldung, Registrierung und „Kennwort vergessen“.
- Rechte werden auf dem Server geprüft, für die REST-API und den Echtzeitkanal.
- Board-Elemente werden auf dem Server und beim Darstellen geprüft (Farb-Whitelist, Zahlen erzwungen). So lässt sich
  kein Markup oder Skript einschleusen.
- Links in E-Mails entstehen nur aus der konfigurierten öffentlichen Adresse oder aus Adressen dieses Rechners. Ein
  gefälschter `Host`-Header kann sie nicht umlenken.

Für den Betrieb im Internet gehört ein Reverse-Proxy mit HTTPS davor (z. B. Caddy, nginx, Traefik). Setze dann
`TRUST_PROXY=1` und `PUBLIC_URL`.

---

## Architektur

```
server.js              HTTP-Server, Seiten-Routing (Anmeldung erforderlich), CSRF-Schutz
lib/
  db.js                PostgreSQL-Pool, Schema-Migrationen
  auth.js              Kennwort-Hashes, Sessions, Einmal-Tokens, Rate-Limits
  boards.js            Zugriffsrechte, Board-Cache, verzögertes Speichern, Echtzeit-Räume
  sanitize.js          Prüfung von Board-Elementen
  settings.js          Einstellungen der Instanz
  mail.js              E-Mail-Versand
  setup.js             Admin aus Umgebungsvariablen, Import alter Boards, Aufräumen
  routes/              REST-API: auth.js, boards.js, admin.js
public/
  auth.html            Anmelden, Registrieren, Kennwort        → js/auth.js
  index.html           Board-Übersicht                         → js/dashboard.js
  board.html           Board-Editor                            → js/main.js (core, ui, collab, render, sync, …)
  admin.html           Administration                          → js/admin.js
```

**Echtzeit:**
- Jeder Client empfängt Änderungen über Server-Sent Events (`/api/boards/:id/events`) und sendet eigene Änderungen
  gebündelt per POST.
- Der Server hält aktive Boards im Arbeitsspeicher und verteilt Änderungen sofort an alle anderen.
- Geänderte Elemente schreibt er etwa eine Sekunde später gesammelt in die Datenbank.
- Ändern zwei Personen gleichzeitig dasselbe Element, gewinnt die letzte Änderung.

---

## Lizenz

dlzboard steht unter der [MIT-Lizenz](LICENSE).

Ausnahmen und Inhalte Dritter, Details in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md):

- **Business Model Canvas**: Adaption des „Business Model Canvas“ von Strategyzer AG (strategyzer.com), lizenziert unter
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- **Lean Canvas**: Adaption des „Lean Canvas“ von Ash Maurya (leanstack.com), lizenziert unter CC BY-SA 3.0.
- **Icons**: teilweise aus bzw. nach [Lucide](https://lucide.dev) (ISC) und [Feather](https://feathericons.com) (MIT).

Erwähnte Produkt- und Methodennamen gehören ihren jeweiligen Inhabern und dienen nur der Beschreibung.
