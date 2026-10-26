# 10 – Administration

### REQ-ADMIN-001 Zugang
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Die Administration unter `/admin` und alle Admin-Schnittstellen sind nur für Administratoren zugänglich (Prüfung auf dem Server).
  - Ist die Zwei-Faktor-Pflicht aktiv, ist sie für Administratoren ohne Zwei-Faktor-Anmeldung gesperrt; die Seite bietet die Einrichtung an.

### REQ-ADMIN-002 Übersicht
- **Seit:** 2.0.0, erweitert in 3.0.0 und 3.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Kennzahlen:
    - Benutzer nach Status, Anteil mit Zwei-Faktor-Anmeldung, unbestätigte Konten
    - fehlgeschlagene Anmeldungen (24 h)
    - Boards und Elemente, Personen online, Sitzungen
    - Datenbankgröße und PostgreSQL-Version
    - Version und Laufzeit
    - Virenscanner-Status mit Signaturstand und Anzahl blockierter Uploads (30 Tage)
  - Hinweise bei wartenden Freigaben, fehlendem Mailserver, fehlender öffentlicher Adresse, vielen Fehlanmeldungen, fehlendem, nicht erreichbarem oder veraltetem Virenscanner.
  - Versionshistorie der letzten Upgrades ([REQ-OPS-003](14-betrieb-versionierung.md)).
  - Geändert in 3.3.0 – Abschnitt „System“ mit Live-Metriken (alle 5 Sekunden, Verlauf der letzten 10 Minuten als Diagramm):
    - CPU-Auslastung von vibeboard (bezogen auf die verfügbaren Kerne bzw. das Container-Limit), CPU des Hosts, Systemlast
    - Arbeitsspeicher von vibeboard (gesamt und JavaScript-Heap) sowie Belegung des Containers (cgroup-Limit) bzw. des Hosts
    - Reaktionszeit der Ereignisschleife (Mittelwert und 99-%-Wert)
    - freier Speicherplatz für Anwendung und Sicherungsverzeichnis
    - Datenbankverbindungen, Poolgröße, Cache-Trefferquote
    - Echtzeit-Verbindungen, aktive Boards, Boards im Arbeitsspeicher
    - Laufzeit von vibeboard und Host, Node.js-Version, Betriebssystem
    - Kacheln mit Engpässen (CPU über 80 %, Speicher über 90 %, Ereignisschleife über 50 ms, weniger als 10 % freier Speicherplatz) werden rot hervorgehoben.
    - Die Metriken liefert `GET /api/admin/metrics`, nur für Administratoren.

### REQ-ADMIN-003 Benutzerverwaltung
- **Seit:** 2.0.0, erweitert in 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Liste mit Name, E-Mail (bestätigt/unbestätigt, ausstehende Änderung), Rolle, Status, Zwei-Faktor, Anzahl Boards, letzte Anmeldung.
  - Suche und Filter (wartend, unbestätigt, deaktiviert, Administratoren, ohne Zwei-Faktor).
  - Benutzer anlegen – bevorzugt per Einladungs-Mail (72 h gültiger Link zum Festlegen des Kennworts), alternativ mit Kennwort.
  - Bearbeiten (Anzeigename, E-Mail, Rolle, Status, neues Kennwort), freischalten, deaktivieren/aktivieren, Adminrechte vergeben/entziehen.
  - Bestätigungsmail erneut senden oder E-Mail manuell bestätigen.
  - Link zum Kennwort-Zurücksetzen (24 h, per Mail oder zum Weitergeben).
  - Zwei-Faktor-Anmeldung zurücksetzen, alle Sitzungen beenden.
  - Löschen mit Wahl, ob die Boards übertragen oder mitgelöscht werden.
  - Der letzte aktive Administrator kann weder herabgestuft, deaktiviert noch gelöscht werden – auch bei gleichzeitigen Änderungen.
  - Administratoren können eigene Rolle und eigenen Status nicht über den Dialog ändern.

### REQ-ADMIN-004 Allgemeine Einstellungen
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Name der Instanz, öffentliche Adresse (für Links in E-Mails), Registrierungsmodus, Benachrichtigung der Admins über wartende Registrierungen.

### REQ-ADMIN-005 Sicherheitseinstellungen
- **Seit:** 3.0.0, erweitert in 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Kennwort-Mindestlänge, Pwned-Passwords-Abgleich, Wegwerf-Domains sperren, eigene Sperr- und Erlaubnislisten für Domains.
  - Zwei-Faktor-Pflicht für Administratoren (nur aktivierbar, wenn das eigene Konto sie nutzt).
  - Virenscan: Status, „Uploads ohne Virenscanner sperren“, „bei nicht erreichbarem Scanner trotzdem annehmen“.

### REQ-ADMIN-006 Mailserver
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - SMTP-Host, Port, Verschlüsselung (STARTTLS, SSL/TLS, keine), Benutzer, Kennwort, Absender, Zertifikatsprüfung.
  - Testmail mit den Formularwerten auch vor dem Speichern; das gespeicherte Kennwort wird nur an den gespeicherten Server gesendet.
  - Das gespeicherte Kennwort wird nie an den Browser zurückgegeben.

### REQ-ADMIN-007 Boards
- **Seit:** 2.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Alle Boards mit Besitzer, Elementen, Mitgliedern, Freigabe, Personen online und letzter Änderung.
  - Besitzer ändern (offene Verbindungen erhalten sofort die neuen Rechte) und löschen.

### REQ-ADMIN-008 Sicherheitsprotokoll
- **Seit:** 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Protokolliert:
    - Anmeldungen, Fehlanmeldungen und falsche Zwei-Faktor-Codes
    - Abmeldungen und Registrierungen
    - E-Mail-Bestätigung, Kennwort- und E-Mail-Änderungen
    - Zwei-Faktor an/aus und Verwendung von Wiederherstellungscodes
    - beendete Sitzungen und Admin-Aktionen
    - abgelehnte Uploads und Upgrades der Anwendung
  - Je Eintrag: Zeitpunkt, Ereignis, betroffene Person, handelnde Person, IP-Adresse, Browser, Details – nie Kennwörter oder Tokens.
  - Suche nach Benutzer oder IP, Filter nach Ereignis, Nachladen älterer Einträge.
  - Aufbewahrung 12 Monate.

### REQ-ADMIN-009 Rechtstexte
- **Seit:** 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Siehe [REQ-LEGAL-001](13-datenschutz-rechtliches.md).
