# 11 – Sicherheit

Die Anwendung soll dem Stand der Technik entsprechen. Orientierung: OWASP ASVS, OWASP Cheat Sheets, NIST SP 800-63B,
BSI IT-Grundschutz.

### REQ-SEC-001 Speicherung von Kennwörtern
- **Seit:** 2.0.0, verschärft in 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - scrypt mit N=2¹⁷, r=8, p=1, 16 Byte Salt, 64 Byte Schlüssel; Vergleich in konstanter Zeit.
  - Hashes mit schwächeren Parametern werden beim nächsten erfolgreichen Login erneuert.
  - Höchstens zwei Hash-Berechnungen gleichzeitig (Schutz vor Überlastung).
  - Für unbekannte Benutzernamen wird ebenfalls ein Hash berechnet (keine Ausforschung über Antwortzeiten).

### REQ-SEC-002 Sitzungen
- **Seit:** 2.0.0, verschärft in 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Zufälliges 256-Bit-Token im Cookie mit `HttpOnly`, `SameSite=Lax`, unter HTTPS `Secure` und `__Host-`-Präfix.
  - In der Datenbank wird nur der SHA-256-Hash gespeichert; bei jeder Anmeldung entsteht ein neues Token.

### REQ-SEC-003 Einmal-Links
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Bestätigungs-, Reset- und Einladungslinks: 256-Bit-Zufall, nur als Hash gespeichert, zeitlich begrenzt, einmal verwendbar.
  - Links in E-Mails werden nur aus der konfigurierten öffentlichen Adresse oder aus Adressen dieses Servers gebildet; ein gefälschter `Host`-Header kann sie nicht umlenken.

### REQ-SEC-004 Schutz vor Ausforschung und Brute Force
- **Seit:** 2.0.0, erweitert in 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Rate-Limits:
    - Anmeldung: 30 pro IP in 10 min, 10 pro Konto in 15 min
    - Registrierung: 10 pro IP in 30 min
    - Kennwort vergessen und Bestätigungsmail: 5 pro IP in 15 min
    - Zwei-Faktor-Codes: 30 pro IP in 10 min, 5 pro Anmeldeversuch
  - Kennwort vergessen, Bestätigungsmail erneut senden und Registrierung mit vorhandener E-Mail-Adresse geben keine Auskunft über bestehende Konten.

### REQ-SEC-005 CSRF-Schutz
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Alle ändernden API-Aufrufe erfordern den Header `X-Vibeboard: 1`; ohne ihn antwortet der Server mit 403.

### REQ-SEC-006 Sicherheits-Header
- **Seit:** 2.0.0, verschärft in 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Content-Security-Policy: nur eigene Skripte, keine Inline-Skripte, Bilder nur von der eigenen Seite bzw. `data:`/`blob:`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`.
  - Weitere Header:
    - `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: same-origin`
    - `Cross-Origin-Opener-Policy` und `Cross-Origin-Resource-Policy`: `same-origin`
    - `Permissions-Policy` ohne Kamera, Mikrofon, Standort und Zahlung
    - HSTS unter HTTPS
  - Kein Bestandteil der Anwendung verstößt gegen die Policy.
  - Geändert in 3.7.0: Für Aufzeichnungen erlaubt die Policy Medien von der eigenen Seite und `blob:` (`media-src 'self' blob:`), die `Permissions-Policy` das Mikrofon nur für die eigene Seite (`microphone=(self)`). Der Browser fragt vor jeder Tonaufnahme nach Erlaubnis.

### REQ-SEC-007 Autorisierung
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Jede Schnittstelle prüft Anmeldung und Rolle auf dem Server, auch der Echtzeitkanal und das Long-Polling.
  - Operationen werden nur von der eigenen, aktiven Verbindung des angemeldeten Benutzers angenommen; fremde Verbindungskennungen werden abgelehnt.
  - `/api/info` (Netzwerkadressen) nur für angemeldete Nutzer.
  - Geändert in 3.7.0: Gastzugänge ([REQ-BOARD-006](08-boards-teilen.md)) werden von jeder Schnittstelle abgelehnt, die sie nicht ausdrücklich zulässt (nur das eigene Board: Inhalte, Echtzeitkanal, Kommentare, Personen, Aktivität, Aufzeichnungen). Kommentar-, Moderations- und Teamrechte prüft ausschließlich der Server.

### REQ-SEC-008 Header hinter Proxys
- **Seit:** 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - `X-Forwarded-For` und `X-Forwarded-Proto` werden nur ausgewertet, wenn `TRUST_PROXY=1` gesetzt ist.
  - Geändert in 4.0.0:
    - `TRUST_PROXY` akzeptiert die Anzahl der Proxys (`1`, `2` …) oder eine Liste vertrauenswürdiger Adressen/Netze (z. B. `127.0.0.1, 172.16.0.0/12`). Ausgewertet wird nur, wenn die Anfrage tatsächlich von einem vertrauenswürdigen Proxy kommt.
    - `X-Forwarded-For` wird von rechts gelesen (der linke Teil ist vom Aufrufer fälschbar); bei `X-Forwarded-Proto` zählt der letzte Eintrag.
    - Die Administration weist darauf hin, wenn Anfragen mit einer Docker-Gateway-Adresse oder mit `X-Forwarded-For` ohne `TRUST_PROXY` ankommen (im Protokoll stünden sonst nicht die echten Adressen).

### REQ-SEC-009 Robustheit des Servers
- **Seit:** 2.0.0, erweitert in 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Größenlimits für Anfragen (40 MB, Vorschaubilder 2 MB), Timeouts gegen langsame Verbindungen (Kopfzeilen 20 s, Anfrage 60 s).
  - Fehlerhafte Eingaben (ungültige Cookies, URLs, IDs) führen zu 400/404, nie zu einem Absturz; unbehandelte Fehler werden protokolliert.
  - Fehlermeldungen an den Client enthalten keine internen Details.

### REQ-SEC-010 Prüfung von Board-Inhalten
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Elemente werden auf dem Server bereinigt:
    - Farben nur aus einer Whitelist, Koordinaten und Größen nur als Zahlen
    - IDs nach festem Muster, reservierte Namen wie `__proto__` werden abgelehnt
    - Bilder nur eingebettet
    - Zeichen, die die Datenbank ablehnt, werden entfernt
  - Beim Darstellen wird jedes Element erneut geprüft (Schutz auch für Altdaten); Benutzertexte werden immer maskiert.
  - Rechtstexte werden ohne HTML dargestellt; Links nur http(s), mailto, tel.

### REQ-SEC-011 Betrieb im Container
- **Seit:** 3.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Anwendung als nicht privilegierter Benutzer, schreibgeschütztes Dateisystem (außer Sicherungsverzeichnis und `/tmp`), keine Linux-Capabilities, `no-new-privileges`.
  - docker-compose startet nicht ohne gesetztes Datenbank-Kennwort.
  - Abhängigkeiten ohne bekannte Sicherheitslücken (`npm audit`).

### REQ-SEC-012 Schutz bei ausgehenden Webhooks (SSRF)
- **Seit:** 4.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Nur https; http nur, wenn interne Ziele erlaubt sind. Keine Zugangsdaten in der Adresse.
  - Die Zieladresse wird aufgelöst; Loopback, private Netze, Link-Local, CGNAT, Multicast, reservierte und IPv4-gemappte IPv6-Adressen sind gesperrt, solange die Administration interne Ziele nicht freigibt.
  - Die Verbindung geht genau an die geprüfte IP (kein erneutes Auflösen, kein DNS-Rebinding); keine Weiterleitungen, 5 s Zeitlimit, die Antwort wird verworfen.
  - Protokolliert werden nur Hostname, Ereignis und Ergebnis.

### REQ-SEC-013 Auslieferung von Dateianhängen
- **Seit:** 4.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Dateien werden immer als Download (Content-Disposition: attachment, RFC 6266) mit `Content-Security-Policy: sandbox` ausgeliefert, nie im Kontext der Anwendung angezeigt.
  - Vorschauen (PDF) rendert der Browser mit pdf.js (ohne eval) und lädt sie als PNG hoch; sie werden wie Bilder geprüft.

### REQ-SEC-014 Automatische Prüfung der Zugriffsrechte
- **Seit:** 4.5.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Bei jedem Push wird jede Route aus dem Router gelesen und ohne Anmeldung, als fremde Person, Gast, Ansehen, Kommentieren und Bearbeiten aufgerufen. Neue Routen sind ohne Zutun erfasst.
  - Öffentliche Routen stehen mit Begründung in einer Liste; alles andere muss ohne Anmeldung scheitern. Die Administration ist nur für Administratoren erreichbar.
  - Testmarken in privaten Elementen, verborgenen Bereichen, Dateien und Geheimnissen dürfen in keiner Antwort an Unberechtigte stehen. Gegenproben stellen sicher, dass Berechtigte sie sehen.
  - Sichtbarkeit von Elementen entscheidet allein `boards.canSeeElement`; Prüfungen auf das im Server nie gesetzte Feld `hidden` lassen den Test fehlschlagen.
  - Grenze: Der Test prüft HTTP-Antworten. Regeln innerhalb einzelner Board-Operationen brauchen eigene Prüfungen.
