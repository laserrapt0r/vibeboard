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
  - Geändert in 4.0.0: Anlegen und Bearbeiten mit Name und E-Mail-Adresse (beide Pflicht, der Name muss nicht eindeutig sein; eine vorhandene Adresse kann nicht entfernt werden). Die Übersicht zeigt die Zahl der Konten ohne E-Mail-Adresse und einen Hinweis bei vermutlich falsch erkannten IP-Adressen ([REQ-SEC-008](11-sicherheit.md)).
  - Der letzte aktive Administrator kann weder herabgestuft, deaktiviert noch gelöscht werden – auch bei gleichzeitigen Änderungen.
  - Administratoren können eigene Rolle und eigenen Status nicht über den Dialog ändern.
  - Geändert in 4.15.0: Ohne Mailserver bietet „Benutzer anlegen“ keine Einladung per E-Mail an, das Kennwort ist vorgewählt.

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

### REQ-ADMIN-010 Zusammenarbeit
- **Seit:** 3.7.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Bereich „Zusammenarbeit“: E-Mails bei Erwähnungen/Antworten/Zuweisungen (Standard: an), Gastzugang (Standard: aus) mit längster Gültigkeit (Standard 30 Tage), wer Teams anlegen darf (Standard: alle), Aufzeichnungen erlauben (Standard: an) mit Höchstdauer (Standard 10 Minuten, höchstens 30).
  - Geändert in 4.1.0: zusätzlich Dateianhänge erlauben (Standard: an) mit größter Datei (Standard 20 MB, höchstens 100), Aufbewahrung im Papierkorb (Standard 30 Tage), Webhooks erlauben (Standard: aus) und interne Webhook-Ziele zulassen (Standard: aus).
  - Abschalten des Gastzugangs erfordert eine Bestätigung und beendet sofort alle Gastzugänge.
  - Geändert in 4.16.0: Dazu kommen die Gaststufe „Beiträge“ (Standard: aus) und die Höchstzahl eigener Notizen je Gast (Standard 50, höchstens 500), siehe [REQ-BOARD-011](08-boards-teilen.md).
  - Die Übersicht zeigt die Zahl der Teams und aktiven Gastzugänge; Gäste zählen nicht als Benutzer.

### REQ-ADMIN-011 Anmeldung
- **Seit:** 4.3.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Der Bereich „Anmeldung“ konfiguriert lokale Anmeldung, Umgang mit neuen Konten, Sitzungsdauer, Direktweiterleitung, Keycloak, LDAP und Kerberos.
  - Geheimnisse werden nie ausgeliefert; ein leeres Feld behält den gespeicherten Wert.
  - Je Methode prüft ein Test die gespeicherten Einstellungen; bei LDAP zeigt er die Zuordnung für eine Beispielperson.
  - Die Benutzerverwaltung zeigt verknüpfte Methoden, gibt Admin-Konten für die Verknüpfung frei und löst Verknüpfungen, sofern ein Kennwort besteht.

### REQ-ADMIN-012 Designvorgaben
- **Seit:** 4.4.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Akzentfarbe sowie die Farben für Formen, Text und Notizen sind einstellbar; die Auswahl zeigt dann nur diese Farben. Bestehende Elemente bleiben unverändert.
  - Schrift auf der Akzentfarbe und Links passen sich an, damit der Kontrast nach REQ-NFR-009 erhalten bleibt.
  - Geändert in 4.18.0: Unter „Formenpakete“ legt die Administration fest, welche Pakete verfügbar sind. Standard: alle eingebauten. Die Grundformen lassen sich nicht abschalten. Abgeschaltete Pakete verschwinden aus Menü, Panel und persönlicher Verwaltung, vorhandene Elemente bleiben unverändert. Das gilt auch für das Paket „Allgemeine Symbole“.
  - Geändert in 4.19.0: Die Liste umfasst auch Kubernetes, IT und Technik, Elektrotechnik und Verfahrenstechnik (REQ-ELEM-024). Eigene Pakete verwaltet REQ-ADMIN-014.

### REQ-ADMIN-013 Anbindungen
- **Seit:** 4.4.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Die Administration verwaltet Verbindungen zu Jira und Azure DevOps mit Test. Tokens werden nie ausgeliefert.

### REQ-ADMIN-014 Eigene Formenpakete
- **Seit:** 4.19.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Die Administration legt eigene Symbolpakete für alle an, etwa aus den offiziellen Symbol-Downloads von AWS, Azure oder Google Cloud. vibeboard liefert diese Symbole nicht mit, ihre Nutzung richtet sich nach den Bedingungen des Herstellers.
- **Akzeptanzkriterien:**
  - Unter „Design & Vorlagen“ → „Eigene Formenpakete“ lassen sich ein ZIP-Archiv oder beliebig viele SVG-Dateien importieren. Das Archiv wird im Browser gelesen, auch mit mehreren Tausend Einträgen. Nur SVG-Dateien gehen weiter.
  - Der Import erkennt den Aufbau der Archive von AWS, Azure und Google Cloud, übernimmt Gruppen und lesbare Namen und nimmt je Symbol eine Größe (bevorzugt 64, helle statt dunkle Fassung). Andere Archive gruppieren nach Ordnern.
  - Vor dem Hochladen zeigt der Dialog Anzahl, Gruppen und den erkannten Aufbau. Name und „Herkunft und Lizenz“ sind vorbelegt und änderbar. Das Ergebnis nennt die übernommenen Symbole und jede abgelehnte Datei mit Grund.
  - Der Server bereinigt jede Datei (`lib/svg-clean.js`): Erlaubt sind nur Formen, Gruppen, Verläufe, Beschneidungen, Masken und Text mit geprüften Werten. Skripte, Ereignisse, Links, Bilder, eingebettetes HTML, Animationen, Filter, externe Verweise und XML-Entitäten fallen weg oder führen zur Ablehnung. Verweise gelten nur innerhalb der Datei, ihre Kennungen bekommen ein Präfix. Gespeichert und ausgeliefert wird nur die bereinigte Baumstruktur, nie die Datei. `npm run test:svg` prüft das mit Angriffsmustern.
  - Grenzen: 512 KB je Datei, 4000 Elemente je Zeichnung, 3000 Symbole und 24 MB je Paket, 50 Pakete. Hochgeladen wird in Portionen zu höchstens 100 Dateien.
  - Pakete lassen sich umbenennen, ergänzen und löschen. Anlegen und Ändern ist der Administration vorbehalten und steht im Sicherheitsprotokoll. Lesen dürfen alle Angemeldeten einschließlich Gästen, da Boards die Symbole jedem zeigen, der sie sehen darf.
  - Eigene Pakete erscheinen im Panel nach den eingebauten, mit Suche, Gruppen und Herkunft. Jede Person kann sie unter „Formen verwalten“ abwählen. Die Symbole behalten ihre Farben.
  - Ein gelöschtes Paket hinterlässt auf Boards Platzhalter mit „Symbol fehlt“, ohne Fehler. Eine Änderung am Paket gilt nach dem nächsten Laden.
  - Ein Element trägt nur den Namen `cu-<Paket>-<Nummer>`. Der Server entfernt mitgeschickte Zeichnungen.
