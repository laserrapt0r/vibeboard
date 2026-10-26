# 07 – Export und Import

### REQ-IO-001 Bild-Export
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - PNG des ganzen Boards (doppelte Auflösung, max. 8000 px) oder der Auswahl; SVG des ganzen Boards.
  - Der Export enthält keine Kommentare und keine verwaisten Verbindungen.

### REQ-IO-002 PDF-Export
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Jeder Frame wird zu einer Seite im Querformat; ohne Frames wird das ganze Board eine Seite.
  - Die Erzeugung läuft über den Druckdialog des Browsers und verletzt die Content-Security-Policy nicht.

### REQ-IO-003 JSON-Backup und Import
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Export aller Elemente als JSON-Datei.
  - Import in ein bestehendes Board (an der Ansichtsmitte) oder als neues Board über die Übersicht; Dateien früherer Versionen (`*.dlzboard.json`) werden akzeptiert.
  - Importierte Inhalte werden geprüft wie alle anderen Eingaben ([REQ-SEC-010](11-sicherheit.md), [REQ-UPL-001](12-uploads-virenschutz.md)).
  - Betrachter können nicht importieren.

### REQ-IO-004 Vorschaubilder
- **Seit:** 1.0.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Einige Sekunden nach einer Änderung erzeugt der Browser ein Vorschaubild für die Board-Übersicht und lädt es hoch (Prüfung wie ein Upload).
