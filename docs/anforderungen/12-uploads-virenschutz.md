# 12 – Datei-Uploads und Virenschutz

### REQ-UPL-001 Virenscan aller hochgeladenen Dateien
- **Seit:** 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Jede hochgeladene Datei wird vor dem Speichern und Verteilen auf Schadsoftware geprüft.
- **Akzeptanzkriterien:**
  - Geprüft werden:
    - Bilder, die per Upload, Drag & Drop oder Zwischenablage in ein Board gelangen
    - Bilder in importierten Boards (JSON) und beim einmaligen Import alter Daten
    - Vorschaubilder
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
