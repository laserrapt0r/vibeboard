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

### REQ-IO-005 Karten aus CSV importieren
- **Seit:** 3.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Aufgaben aus Tabellen oder Ticketsystemen (z. B. Excel, Jira, Azure DevOps) als Karten auf das Board holen.
- **Akzeptanzkriterien:**
  - Eingabe als CSV-Datei oder eingefügter Text; Trennzeichen Komma, Semikolon oder Tab werden erkannt; Felder in Anführungszeichen dürfen Trennzeichen und Zeilenumbrüche enthalten.
  - Spalten werden über deutsche und englische Namen zugeordnet: Titel/Summary, Beschreibung, Zuständig/Assignee, Status, Fällig/Due Date, Story Points, Priorität, Schlüssel/Issue Key, Labels (auch mehrere Label-Spalten). Ohne erkennbare Kopfzeile wird jede Zeile zu einer Karte.
  - Datumsangaben im Format JJJJ-MM-TT, TT.MM.JJJJ und im Jira-Format werden übernommen; Prioritätsnamen (z. B. Highest, Blocker, Hoch, Low) werden auf die vier Prioritäten abgebildet.
  - Vorschau der erkannten Anzahl; optional Anordnung nach Status in Spalten (Kanban). Höchstens 500 Karten je Import.
