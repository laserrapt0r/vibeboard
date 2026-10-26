# Änderungsprotokoll

Alle nennenswerten Änderungen an vibeboard. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/) (siehe
[REQ-OPS-001](docs/anforderungen/14-betrieb-versionierung.md)).

## [3.2.0] – 2026-10-26

### Hinzugefügt
- Zusammenarbeit:
  - Cursor-Chat (Taste `/`), Namen an der Auswahl anderer und Anzeige „… schreibt“.
  - Randpfeile für Personen außerhalb der Ansicht, Abwesenheitsstatus, Ansichten der anderen in der Minimap.
  - Mauszeiger anderer ausblendbar, „Alle folgen mir“ (REQ-COLLAB-004, -005, -008).
- Privater Modus: verdeckt sammeln, gemeinsam aufdecken; die Inhalte werden auf dem Server geschützt (REQ-COLLAB-009).
- Schätzrunde mit verdeckten Karten mit Fibonacci-, T-Shirt- und Stunden-Deck (REQ-MOD-004).
- Code-Blöcke mit Syntaxhervorhebung (REQ-ELEM-015).
- Diagramm aus Text (Mermaid-Schreibweise) für Fluss- und Sequenzdiagramme (REQ-ELEM-016).
- 12 neue Formen für Flussdiagramme, UML und IT-Architektur (REQ-ELEM-003).
- Karten: Priorität, Story Points, Ticketnummer und Labels (REQ-ELEM-008).
- Aufgaben-Panel im Board, „Meine Aufgaben“ auf der Startseite, Direktlinks auf Elemente (REQ-PROJ-001, -002).
- Versionsverlauf: Versionen sichern, automatisch alle 30 Minuten, wiederherstellen, als Kopie öffnen (REQ-PROJ-003).
  Neue Datenbank-Migration 4.
- Kartenimport aus CSV, Excel, Jira oder Azure DevOps (REQ-IO-005).
- 31 neue Vorlagen in den Kategorien Softwareentwicklung, Projektmanagement und IT-Service-Management (REQ-TPL-001).

### Geändert
- Duplizieren übernimmt keine privaten Elemente anderer Personen.
- Datenschutz-Vorlage um Versionen und Cursor-Chat ergänzt. Bereits veröffentlichte Datenschutzerklärungen bitte in
  der Administration prüfen und anpassen.

## [3.1.0] – 2026-10-26

### Hinzugefügt
- Virenscan aller hochgeladenen Dateien mit ClamAV; Signaturen aktualisieren sich automatisch, Status in der
  Administration, Sperre von Uploads ohne Scanner, Prüfung des Dateityps (REQ-UPL-001 bis 004).
- Versionierung und automatische Upgrades: Versionshistorie in der Datenbank, Sicherung per `pg_dump` vor Migrationen,
  Datenbanksperre während des Upgrades, Downgrade-Schutz, Hinweis „neue Version“ in offenen Boards (REQ-OPS-001 bis 006).
- Upgrade-Test für Datenbank-Migrationen (`npm run test:upgrade`).
- Impressum und Datenschutzerklärung: Pflege in der Administration mit Vorlagen, öffentliche Seiten und Verlinkung
  (REQ-LEGAL-001).
- Anforderungsdokumentation für alle Funktionen (`docs/anforderungen/`), Beitragsregeln (`CONTRIBUTING.md`).

### Behoben
- Vorlagen-Galerie: Bei „Alle“ wurden die Karten in die Fensterhöhe gestaucht und abgeschnitten; die Galerie scrollt
  jetzt.
- Übersicht auf Smartphones: Kopfzeile war breiter als der Bildschirm.

## [3.0.0] – 2026-10-26

### Hinzugefügt
- E-Mail-Bestätigung bei der Registrierung, Bestätigung geänderter E-Mail-Adressen.
- Sperre von Wegwerf-E-Mail-Adressen, eigene Sperr- und Erlaubnislisten.
- Kennwortrichtlinie nach NIST SP 800-63B mit Stärkeanzeige, optional Abgleich mit Pwned Passwords.
- Zwei-Faktor-Anmeldung (TOTP) mit Wiederherstellungscodes, optional Pflicht für Administratoren.
- Geräteübersicht, Sicherheitsprotokoll, Sicherheitsbenachrichtigungen per E-Mail.
- Erweiterte Benutzerverwaltung (Einladungen, Filter, Sitzungen beenden, 2FA zurücksetzen).
- Long-Polling als automatischer Rückfall, wenn Server-Sent Events blockiert werden.

### Geändert
- Umbenennung in **vibeboard** (Cookie, CSRF-Header `X-Vibeboard`, Speicherschlüssel; alle Nutzer werden einmal abgemeldet).
- Stärkere Kennwort-Hashes (scrypt N=2¹⁷) mit automatischer Umstellung beim Login.
- Strenge Content-Security-Policy und weitere Sicherheits-Header; gehärtete Docker-Container;
  Datenbank-Kennwort im Docker-Setup verpflichtend.

## [2.0.0] – 2026-10-26

### Hinzugefügt
- Benutzerkonten mit Registrierung, Anmeldung, Profil und „Kennwort vergessen“.
- Administration: Übersicht, Benutzer, Boards, Einstellungen, Mailserver mit Testmail.
- Boards mit Besitzer, Mitgliedern (Bearbeiter/Betrachter) und Freigabe per Link.
- Datenhaltung in PostgreSQL mit Migrationen; einmaliger Import der dateibasierten Boards.

### Behoben
- 40 Befunde aus einem Code-Review, u. a. gespeichertes XSS über Element-Attribute, Umleitung von Reset-Links über den
  Host-Header, Datenverlust durch ungültige Zeichen, beschädigte Undo-Historie.

## [1.0.0] – 2026-10-26

### Hinzugefügt
- Kollaboratives Whiteboard: unendliche Leinwand, Sticky Notes, Text, Formen, Verbindungen, Freihand, Frames, Karten,
  Tabellen, Mindmaps, Bilder, Sticker, Links, Kommentare.
- Echtzeit-Zusammenarbeit mit Live-Cursorn, Folgen-Modus, Reaktionen und Laserpointer.
- Timer, Abstimmungen, Präsentationsmodus.
- Über 35 Vorlagen, Export als PNG, SVG, PDF und JSON.
