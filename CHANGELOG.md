# Änderungsprotokoll

Alle nennenswerten Änderungen an vibeboard. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/) (siehe
[REQ-OPS-001](docs/anforderungen/14-betrieb-versionierung.md)).

## [3.3.0] – 2026-10-26

### Hinzugefügt
- Verbinder (REQ-ELEM-004):
  - Andocken an beliebiger Stelle des Umrisses, mit Vorschau beim Ziehen.
  - Biegen durch Ziehen an der Linie; Knickpunkte einfügen, verschieben (mit Einrasten) und entfernen.
  - Beschriftung entlang der Linie verschiebbar.
  - 9 Linienenden für Anfang und Ende getrennt.
  - Menü „Verlauf & Andocken“ mit Richtung umkehren und Pfad zurücksetzen.
- Hinweis beim Doppelklick auf gesperrte Elemente.
- Administration: Systemmetriken in der Übersicht (CPU, Arbeitsspeicher inkl. Container-Limit, Ereignisschleife,
  Speicherplatz, Datenbankverbindungen, Laufzeit) mit Verlauf und Warnhinweisen (REQ-ADMIN-002).
- Screenshots in der README.
- Protokollierung mit Stufen (trace bis fatal), Text- oder JSON-Format, Request-ID, Schwärzung von Geheimnissen und
  Laufzeit-Einstellung in der Administration; neue Umgebungsvariablen `LOG_LEVEL` und `LOG_FORMAT` (REQ-OPS-011).

### Geändert
- Ein Klick ohne Ziehen auf ein Element einer Mehrfachauswahl wählt nur dieses Element aus. Bisher blieb nach dem
  Einfügen eines Diagramms alles ausgewählt, und einzelne Elemente ließen sich kaum bearbeiten.

### Behoben
- „Rechtliches“ zeigte beim Öffnen ein leeres Impressum; ein erneutes Speichern hätte es gelöscht.
- Lange Wörter auf Sticky Notes wurden bis zur Unlesbarkeit verkleinert; sie werden jetzt am Bindestrich bzw. notfalls
  im Wort umbrochen.
- Beim Umhängen eines Verbinders ging der gewählte Andockpunkt verloren; das Ende hing immer am automatisch gewählten
  Punkt.
- Verbinder:
  - Bei übereinanderliegenden Linien (z. B. Organigramm) wählt ein erneuter Klick die nächste Linie, statt immer die
    oberste zu treffen.
  - Andocken an Dreiecken, Sechsecken, Parallelogrammen, Sternen usw. erfolgt an der sichtbaren Kante statt am
    umgebenden Rechteck.
  - Pfeiltasten verschieben Knickpunkte mit, wie das Ziehen.
  - „Richtung umkehren“ spiegelt die Lage der Beschriftung.
- Sequenzdiagramme:
  - Blöcke (alt, loop …) verdecken die Lebenslinien nicht mehr.
  - Pfeil und Text einer Nachricht sind gruppiert; Doppelklick auf den Pfeil bearbeitet den Text.
- Beim Duplizieren wurde ein internes Hilfsfeld mitgespeichert.

## [3.2.1] – 2026-10-26

### Behoben
- Verschieben mit der mittleren Maustaste legte unter Linux zusätzlich eine Sticky Note mit dem zuletzt markierten Text
  an (Einfügen der „Primary Selection“).

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
