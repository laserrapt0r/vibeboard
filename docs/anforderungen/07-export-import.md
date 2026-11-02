# 07 – Export und Import

### REQ-IO-001 Bild-Export
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - PNG des ganzen Boards (doppelte Auflösung, max. 8000 px) oder der Auswahl; SVG des ganzen Boards.
  - Der Export enthält keine Kommentare und keine verwaisten Verbindungen.
  - Geändert in 4.16.0: SVG und JSON melden das Ergebnis wie PNG. Ein leeres Board meldet „Nichts zu exportieren“.

### REQ-IO-002 PDF-Export
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Jeder Frame wird zu einer Seite im Querformat; ohne Frames wird das ganze Board eine Seite.
  - Die Erzeugung läuft über den Druckdialog des Browsers und verletzt die Content-Security-Policy nicht.
  - Geändert in 4.16.0: Der Menüpunkt heißt „PDF drucken (Text markierbar)“. Die Seiten gehen als Vektorgrafik in den Druck, so bleibt der Text im Ergebnis markierbar. Die PDF-Datei ohne Druckdialog beschreibt [REQ-IO-009](#req-io-009-pdf-datei).
  - Geändert in 4.16.0: Eine Druckseite enthält nur die Bilder, die auf ihr liegen. Der Druckdialog öffnet sich, wenn die Bilder geladen sind, spätestens nach 30 Sekunden.

### REQ-IO-003 JSON-Backup und Import
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Export aller Elemente als JSON-Datei.
  - Import in ein bestehendes Board (an der Ansichtsmitte) oder als neues Board über die Übersicht; Dateien früherer Versionen (`*.dlzboard.json`) werden akzeptiert.
  - Importierte Inhalte werden geprüft wie alle anderen Eingaben ([REQ-SEC-010](11-sicherheit.md), [REQ-UPL-001](12-uploads-virenschutz.md)).
  - Betrachter können nicht importieren.
  - Geändert in 4.16.0: Exportieren und Importieren sind im Boardmenü getrennt. „Inhalte aus Datei importieren“ erzeugt bearbeitbare Elemente, „Datei als Anhang einfügen“ legt die Datei selbst ab. Betrachter sehen „Importieren“ nicht.

### REQ-IO-004 Vorschaubilder
- **Seit:** 1.0.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Einige Sekunden nach einer Änderung erzeugt der Browser ein Vorschaubild für die Board-Übersicht und lädt es hoch (Prüfung wie ein Upload).
  - Geändert in 4.0.0: Hat ein Board Inhalt, aber noch kein Vorschaubild (z. B. aus einer Vorlage erstellt, importiert oder kopiert), erzeugt es der Browser einer bearbeitenden Person einige Sekunden nach dem Öffnen – ohne dass erst etwas geändert werden muss.
  - Geändert in 4.0.2: Boards aus Vorlagen erhalten ihr Vorschaubild bereits beim Anlegen auf der Startseite; andere Boards ohne Vorschaubild erzeugen es direkt nach dem Laden (nicht erst nach der Wartezeit für Änderungen).

### REQ-IO-005 Karten aus CSV importieren
- **Seit:** 3.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Aufgaben aus Tabellen oder Ticketsystemen (z. B. Excel, Jira, Azure DevOps) als Karten auf das Board holen.
- **Akzeptanzkriterien:**
  - Eingabe als CSV-Datei oder eingefügter Text; Trennzeichen Komma, Semikolon oder Tab werden erkannt; Felder in Anführungszeichen dürfen Trennzeichen und Zeilenumbrüche enthalten.
  - Spalten werden über deutsche und englische Namen zugeordnet: Titel/Summary, Beschreibung, Zuständig/Assignee, Status, Fällig/Due Date, Story Points, Priorität, Schlüssel/Issue Key, Labels (auch mehrere Label-Spalten). Ohne erkennbare Kopfzeile wird jede Zeile zu einer Karte.
  - Datumsangaben im Format JJJJ-MM-TT, TT.MM.JJJJ und im Jira-Format werden übernommen; Prioritätsnamen (z. B. Highest, Blocker, Hoch, Low) werden auf die vier Prioritäten abgebildet.
  - Vorschau der erkannten Anzahl; optional Anordnung nach Status in Spalten (Kanban). Höchstens 500 Karten je Import.

### REQ-IO-006 Import aus draw.io
- **Seit:** 4.4.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - `.drawio`-Dateien, auch komprimiert und mit mehreren Seiten, werden zu bearbeitbaren Formen, Texten, Frames und angedockten Verbindungen. Beschriftungen kommen als reiner Text.

### REQ-IO-007 Import aus PowerPoint
- **Seit:** 4.4.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - `.pptx`-Dateien: Jede Folie wird ein Frame; Texte, Formen, Bilder, Linien, Tabellen und Gruppen bleiben bearbeitbar. Nicht Übernommenes wird gezählt. Das alte Format `.ppt` wird nicht unterstützt.
  - Möglich im Board und auf der Startseite (neues Board). Die Datei wird im Browser gelesen, beschädigte Dateien ergeben eine klare Meldung.

### REQ-IO-008 Export nach PowerPoint
- **Seit:** 4.4.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Jeder Frame wird eine Folie (16:9), ohne Frames das ganze Board. Notizen, Text, Formen, Linien, Bilder und Tabellen bleiben bearbeitbar, alles andere kommt als Bild. Private Inhalte und verborgene Bereiche fehlen.
  - Geändert in 4.16.0: Der Frame-Titel steht im Titelfeld der Folie (Platzhalter `title`, sichtbar in der Gliederung von PowerPoint), die Inhalte rücken darunter. Folien ohne Titel und der Export ohne Frames nutzen die ganze Fläche.

### REQ-IO-009 PDF-Datei
- **Seit:** 4.16.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Das Board als PDF-Datei laden, ohne Druckdialog und ohne nachgeladene Bibliothek.
- **Akzeptanzkriterien:**
  - „Als PDF-Datei“ lädt eine Datei mit einer Seite je Frame, in der Reihenfolge der Frames und in der Größe des Frames. Ohne Frames steht das ganze Board auf einer Seite.
  - Frame-Titel sind Lesezeichen der Datei, Titel ohne Namen heißen „Folie n“. Der Boardname ist der Dokumenttitel.
  - Jede Seite ist ein Bild der vorhandenen Darstellung (JPEG). Text lässt sich darin nicht markieren, dafür gibt es „PDF drucken (Text markierbar)“.
  - Die Datei entsteht im Browser. Es kommt keine Abhängigkeit hinzu, die Content-Security-Policy bleibt unverändert.
  - Große Boards: Höchstens 2400 Pixel je Seite, ab 31 Seiten 1600. Die Seiten werden nacheinander gerendert. Über 300 MB bricht der Export mit einem Hinweis ab.
  - Private Inhalte, verborgene Bereiche und Kommentare fehlen wie beim Export nach PowerPoint.
