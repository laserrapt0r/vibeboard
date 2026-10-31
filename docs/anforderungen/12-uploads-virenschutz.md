# 12 – Datei-Uploads und Virenschutz

### REQ-UPL-001 Virenscan aller hochgeladenen Dateien
- **Seit:** 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Jede hochgeladene Datei wird vor dem Speichern und Verteilen auf Schadsoftware geprüft.
- **Akzeptanzkriterien:**
  - Geprüft werden:
    - Bilder, die per Upload, Drag & Drop oder Zwischenablage in ein Board gelangen
    - Bilder in importierten Boards (JSON) und beim einmaligen Import alter Daten
    - Vorschaubilder
    - Geändert in 4.1.0: Dateianhänge (PDF, Office, Text), deren PDF-Vorschauen und Bilder in eigenen Vorlagen
  - Die Prüfung erfolgt mit ClamAV über das clamd-Protokoll (INSTREAM).
  - Infizierte Dateien werden abgelehnt:
    - Das Element wird nicht gespeichert und nicht an andere verteilt.
    - Bei der hochladenden Person wird es wieder entfernt; sie sieht eine Meldung mit dem Namen des Funds.
    - Der Vorgang erscheint im Sicherheitsprotokoll.
  - Bereits geprüfte, saubere Dateien werden anhand ihres Hashs nicht erneut geprüft (z. B. beim Verschieben eines Bildes).

### REQ-UPL-002 Automatisch aktualisierte Virensignaturen
- **Seit:** 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Im Standard-Setup (docker compose) läuft ClamAV als eigener Dienst; `freshclam` aktualisiert die Signaturen selbstständig mehrmals täglich, die Signaturen liegen in einem eigenen Volume.
  - Die Administration zeigt Version und Datum der Signaturen und warnt, wenn sie älter als drei Tage sind.

### REQ-UPL-003 Verhalten ohne Scanner
- **Seit:** 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Ist kein Scanner eingerichtet, werden Uploads standardmäßig abgelehnt (abschaltbar: „Uploads ohne Virenscanner sperren“).
  - Ist der Scanner vorübergehend nicht erreichbar, werden Uploads standardmäßig abgelehnt (fail-closed), mit der Bitte, es später erneut zu versuchen; optional abschaltbar.
  - Beim einmaligen Import alter Daten beim Start werden Bilder nur bei nachgewiesener Schadsoftware verworfen.

### REQ-UPL-004 Prüfung des Dateityps
- **Seit:** 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Erlaubt sind PNG, JPEG, GIF, WebP und SVG als eingebettete Data-URL.
  - Der Inhalt muss zum angegebenen Typ passen (Signaturbytes bzw. `<svg`), sonst wird die Datei abgelehnt.
  - Externe Bildadressen werden nicht übernommen.

### REQ-UPL-005 Protokollierung der Prüfergebnisse
- **Seit:** 3.8.1 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Jede Prüfung einer hochgeladenen Datei ist nachvollziehbar.
- **Akzeptanzkriterien:**
  - Für jede Prüfung entsteht ein Eintrag im Anwendungsprotokoll (Komponente `uploads`) mit Ergebnis (`clean`, `cached`, `infected`, `type_rejected`, `no_scanner`, `unscanned`, `error`, `error_accepted`), Art der Datei (Bild, Import, Vorschaubild, Tonspur), Größe, den ersten 16 Zeichen des SHA-256-Hashs, Dauer und Benutzer-ID – nie den Dateiinhalt.
  - Stufen: sauber = `info`, aus dem Zwischenspeicher = `debug`, abgelehnt oder ohne Scanner angenommen = `warn`, Ausfall des Scanners = `error`.
  - Im Sicherheitsprotokoll stehen zusätzlich Funde und abgelehnte Dateitypen („Upload abgelehnt“) sowie Dateien, die bei nicht erreichbarem Scanner ungeprüft angenommen wurden („Upload ungeprüft angenommen“, nur wenn die Administration das erlaubt).
  - Die Übersicht der Administration nennt neben blockierten auch ungeprüft angenommene Uploads der letzten 30 Tage.

### REQ-UPL-006 Dokumente auf dem Board prüfen
- **Seit:** 4.4.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Bei PDF-Dateien lassen sich alle Seiten (höchstens 50) als gesperrte Bilder in einem Frame auf das Board legen; darauf lässt sich kommentieren und zeichnen, der Frame kann zur Freigabe.
  - Office-Dateien funktionieren genauso, wenn der optionale Umwandlungsdienst eingerichtet ist (`OFFICE_CONVERTER_URL`). Sonst erscheint die Funktion nicht.
  - Die Seiten laufen wie alle Bilder durch die Upload-Prüfung.
