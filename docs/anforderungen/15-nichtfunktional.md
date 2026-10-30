# 15 – Nicht-funktionale Anforderungen

### REQ-NFR-001 Sprache
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Oberfläche, E-Mails, Fehlermeldungen und Dokumentation sind auf Deutsch, in verständlicher Sprache ohne Fachjargon, wo möglich.
  - Geändert in 4.2.0: siehe [REQ-NFR-008](#req-nfr-008-mehrsprachigkeit).

### REQ-NFR-002 Browser und Geräte
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Aktuelle Versionen von Chrome/Edge, Firefox und Safari.
  - Bedienbar mit Maus, Trackpad und Touch; auf Smartphones ohne waagerechtes Scrollen der Seiten (Werkzeugleiste unten, angepasste Panels).

### REQ-NFR-003 Leistung
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Boards mit über 1.000 Elementen bleiben flüssig bedienbar (Rendering gebündelt pro Bildaufbau, nur geänderte Elemente werden neu gezeichnet).
  - Änderungen beim Ziehen werden gebündelt (40 ms) und pro Element zusammengefasst übertragen.
  - Aktive Boards werden im Arbeitsspeicher gehalten und nach 5 Minuten ohne Nutzung freigegeben.

### REQ-NFR-004 Wenige Abhängigkeiten, kein Build-Schritt
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Frontend ohne Framework und ohne Build-Schritt (ES-Module).
  - Laufzeit-Abhängigkeiten auf das Nötigste beschränkt (derzeit `pg`, `nodemailer`, `uqr`) und ohne bekannte Sicherheitslücken.

### REQ-NFR-005 Barrierearmut
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** teilweise umgesetzt
- **Akzeptanzkriterien:**
  - Alle Schaltflächen haben eine Beschriftung oder einen Tooltip; Formulare haben zugeordnete Beschriftungen; Fehlermeldungen werden als `role="alert"` ausgegeben.
  - Tastatursteuerung für alle wichtigen Board-Funktionen.
  - Offen: vollständige Bedienbarkeit des Boards mit Screenreadern.

### REQ-NFR-006 Testbarkeit
- **Seit:** 3.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - `npm run test:upgrade` prüft die Datenbank-Migrationen ([REQ-OPS-004](14-betrieb-versionierung.md)).
  - `?transport=poll` erzwingt den Rückfall-Transport für Tests.

### REQ-NFR-007 Installierbare App (PWA)
- **Seit:** 4.1.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Web-App-Manifest mit Symbolen (auch „maskable“) und Designfarbe; die App lässt sich über den Browser installieren (Kontomenü „App installieren“, sobald der Browser es anbietet) und läuft im eigenen Fenster.
  - Ein Service Worker hält nur statische Dateien (Oberfläche, Skripte, Symbole) für den Offline-Fall vor – immer „Netz zuerst“, damit Updates sofort gelten. Schnittstellen, Echtzeitkanal, Dateien und Seiten mit Anmeldestatus werden nie zwischengespeichert; ohne Verbindung erscheint eine Offline-Seite.

### REQ-NFR-008 Mehrsprachigkeit
- **Seit:** 4.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Die Anwendung gibt es auf Englisch, Deutsch, Spanisch und Französisch.
- **Akzeptanzkriterien:**
  - Die Sprache folgt den Spracheinstellungen des Browsers (erste unterstützte Sprache). Wird keine unterstützt, gilt Englisch. Datum und Zahlen folgen der Browsersprache.
  - Übersetzt sind Oberfläche, Administration, Vorlagen, Fehlermeldungen und E-Mails.
  - E-Mails gehen in der Sprache der empfangenden Person (zuletzt beim Anmelden verwendet); bei Einladungen an Adressen ohne Konto in der Sprache der einladenden Person.
  - Inhalte der Boards werden nicht übersetzt; Vorlagen entstehen in der Sprache der Person, die sie einfügt.
  - Die Vorlagen für Impressum und Datenschutzerklärung bleiben deutsch: Sie beziehen sich auf deutsches Recht und werden vom Betreiber verantwortet.
  - Wörterbücher: `public/i18n/*.json`, Quellsprache Deutsch; `npm run check:i18n` prüft Vollständigkeit und Platzhalter.
