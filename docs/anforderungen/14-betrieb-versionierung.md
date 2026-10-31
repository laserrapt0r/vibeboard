# 14 – Betrieb, Versionierung und Upgrades

### REQ-OPS-001 Versionsnummern
- **Seit:** 1.0.0, verbindlich seit 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Jede Auslieferung trägt eine eindeutige, stets steigende Versionsnummer nach [Semantic Versioning](https://semver.org/lang/de/).
- **Akzeptanzkriterien:**
  - Einzige Quelle ist das Feld `version` in `package.json`. Format `MAJOR.MINOR.PATCH`.
  - Eine Version wird nie wiederverwendet und nie verringert.
  - MAJOR steigt bei inkompatiblen Änderungen (z. B. geänderte Schnittstellen, Pflicht-Konfiguration), MINOR bei neuen Funktionen, PATCH bei Fehlerbehebungen.
  - Jede Version hat einen Eintrag im `CHANGELOG.md`.
  - Die laufende Version ist in der Administration sichtbar und wird mit `/api/config` ausgeliefert.

### REQ-OPS-002 Automatisches Upgrade beim Start
- **Seit:** 2.0.0, erweitert in 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Startet eine neue Version auf einer bestehenden Datenbank, aktualisiert sie diese selbstständig – ohne manuelle Schritte und ohne Datenverlust.
- **Akzeptanzkriterien:**
  - Beim Start werden alle ausstehenden Migrationen in fester Reihenfolge angewendet, jede in einer eigenen Transaktion. Schlägt eine fehl, wird sie vollständig zurückgerollt und der Start abgebrochen; die Datenbank bleibt im letzten konsistenten Zustand.
  - Eine Datenbanksperre (Advisory Lock) verhindert, dass mehrere gleichzeitig startende Instanzen dieselben Migrationen ausführen.
  - Ein Upgrade über mehrere Versionen hinweg (z. B. 2.0.0 → 3.1.0) ist in einem Schritt möglich.
  - Auch ältere Datenhaltungen werden übernommen (Import der dateibasierten Boards aus Version 1).

### REQ-OPS-003 Sicherung vor dem Upgrade und Versionshistorie
- **Seit:** 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Stehen Migrationen an und enthält die Datenbank bereits Daten, wird vorher automatisch eine Sicherung mit `pg_dump` erstellt (im Docker-Setup unter `/backups`, die letzten 10 bleiben erhalten).
  - Schlägt die Sicherung fehl, wird das Upgrade nicht durchgeführt (bewusst abschaltbar mit `BACKUP_BEFORE_UPGRADE=0`).
  - Jeder Start mit einer neuen Version wird in `app_versions` festgehalten (Version, Vorgänger, Schemaversion, Sicherungsdatei) und im Sicherheitsprotokoll vermerkt.

### REQ-OPS-004 Regeln für Migrationen
- **Seit:** 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Schemaänderungen erfolgen ausschließlich über neue Migrationen am Ende der Liste in `lib/db.js`; bestehende Migrationen werden nach der Auslieferung nie verändert.
  - Migrationen sind vorwärtsgerichtet und erhalten vorhandene Daten (neue Spalten mit Standardwert oder nachträglichem Befüllen; kein Löschen von Daten ohne Übernahme).
  - Der Upgrade-Test `npm run test:upgrade` prüft, dass ein schrittweises Upgrade über alle Schemaversionen – mit Beispieldaten nach jedem Schritt – zur selben Struktur führt wie eine Neuinstallation, dass die Daten erhalten bleiben und ein erneuter Lauf nichts ändert. Er muss vor jeder Auslieferung bestehen.

### REQ-OPS-005 Schutz vor Downgrades
- **Seit:** 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Kennt die gestartete Version eine in der Datenbank vorhandene Schemaversion nicht, bricht der Start mit verständlicher Meldung ab.
  - Wurde die Datenbank zuletzt mit einer neueren Version betrieben, bricht der Start ab (überschreibbar mit `ALLOW_DOWNGRADE=1`).

### REQ-OPS-006 Hinweis an offene Sitzungen
- **Seit:** 3.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Siehe [REQ-COLLAB-007](04-zusammenarbeit.md).

### REQ-OPS-007 Bereitstellung mit Docker
- **Seit:** 1.0.0, erweitert in 2.0.0, 3.0.0 und 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - `docker compose up -d --build` startet PostgreSQL, ClamAV und vibeboard; Daten, Sicherungen und Signaturen liegen in Volumes.
  - Healthchecks für Datenbank und Anwendung (`/healthz`); die Anwendung startet erst, wenn die Datenbank bereit ist.
  - Optionaler Test-Mailserver über das Profil `mailtest`.
  - Konfiguration über `.env` (Vorlage `.env.example`).

### REQ-OPS-008 Betrieb ohne Docker
- **Seit:** 2.0.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Node.js ≥ 20 und PostgreSQL ≥ 13; Verbindung über `DATABASE_URL` oder `PG*`-Variablen; Virenscanner über `CLAMAV_HOST`/`CLAMAV_PORT`; Sicherungen über `BACKUP_DIR`.

### REQ-OPS-009 Geordnetes Beenden
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Bei SIGTERM/SIGINT werden Verbindungen geschlossen und ausstehende Änderungen gespeichert, bevor der Prozess endet.

### REQ-OPS-011 Protokollierung
- **Seit:** 3.3.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Nachvollziehbares, datensparsames Server-Protokoll mit üblichen Stufen.
- **Akzeptanzkriterien:**
  - Stufen `trace`, `debug`, `info`, `warn`, `error`, `fatal` sowie `silent`.
    - Die Vorgabe kommt aus `LOG_LEVEL` (Standard `info`).
    - Administratoren können die Stufe zur Laufzeit ohne Neustart ändern; die Einstellung bleibt erhalten, und die Änderung wird protokolliert.
  - Format `text` (Zeitstempel ISO 8601 in UTC, Stufe, Komponente, Meldung, Felder) oder `json` (eine Zeile je Eintrag); `warn` und höher nach stderr, sonst nach stdout.
  - Jede HTTP-Anfrage erhält eine Request-ID:
    - Sie wird als `X-Request-Id` zurückgegeben und automatisch an alle Einträge dieser Anfrage gehängt.
    - Eine gültige ID eines vorgeschalteten Proxys wird übernommen.
    - Antworten auf Serverfehler enthalten die ID.
  - Zugriffsprotokoll auf `debug` (Methode, Pfad ohne Query, Status, Dauer). Erwartete Fehler (4xx) auf `debug`; unerwartete Fehler (5xx) auf `error` mit Stacktrace. Anfragen über 2 s – außer Echtzeit-Verbindungen – auf `warn`.
  - Felder mit Kennwörtern, Tokens, Cookies, Sitzungen oder Schlüsseln werden geschwärzt. IP- und E-Mail-Adressen, Query-Parameter und Board-Inhalte werden nicht protokolliert.
  - Unbehandelte Ausnahmen werden als `fatal` protokolliert und beenden den Prozess (der Container startet neu). Unbehandelte Promise-Ablehnungen werden als `error` protokolliert.
  - Im Servercode wird ausschließlich der zentrale Logger verwendet.

### REQ-OPS-010 Dokumentation
- **Seit:** 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Jede neue oder geänderte Funktion wird in diesen Anforderungsdokumenten ergänzt (Vorgehen siehe [README](README.md#pflege-bei-neuen-funktionen)), zusammen mit Versionsnummer, CHANGELOG und README.

### REQ-OPS-011 Betrieb auf Kubernetes
- **Seit:** 4.3.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - `deploy/kubernetes/` enthält mit Kustomize anwendbare Manifeste für Anwendung, PostgreSQL, ClamAV, Ingress und NetworkPolicies, optional HTTPRoute und Kerberos.
  - Genau eine Instanz der Anwendung (Strategie `Recreate`), weil der Live-Zustand im Speicher liegt.
  - Anwendung und Datenbank laufen ohne Root-Rechte mit schreibgeschütztem Dateisystem; Kennwörter liegen nicht im Repository.
  - Die Manifeste bestehen `kustomize build` und die Schemaprüfung mit `kubeconform`.
