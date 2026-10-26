# 02 – Board-Elemente

### REQ-ELEM-001 Sticky Notes
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Farbige Notizzettel mit Text.
- **Akzeptanzkriterien:**
  - 16 Farben; die Textfarbe passt sich automatisch für ausreichenden Kontrast an.
  - Die Schriftgröße passt sich automatisch an (ohne Wörter zu zerteilen, sofern möglich) oder wird fest eingestellt.
  - Optional wird der Name der Person angezeigt, die die Notiz erstellt hat.
  - Anlegen per Werkzeug (N), Doppelklick auf eine freie Fläche oder Kontextmenü.

### REQ-ELEM-002 Text
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Freie Textfelder mit Formatierung.
- **Akzeptanzkriterien:**
  - Schriftgröße, Farbe, fett, kursiv, Ausrichtung und Hintergrundfarbe sind einstellbar.
  - Die Höhe passt sich dem Text an; leere Textfelder werden beim Verlassen entfernt.

### REQ-ELEM-003 Formen
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Geometrische Formen mit optionalem Text.
- **Akzeptanzkriterien:**
  - Verfügbar: Rechteck, abgerundet, Ellipse, Raute, Dreieck, Sechseck, Parallelogramm, Trapez, Stern, Pille, Zylinder, Blockpfeil, Sprechblase, Kreuz, Dokument, Wolke.
  - Füllung, Rahmenfarbe, Rahmenstärke, Strichart (durchgezogen, gestrichelt, gepunktet), Textfarbe, Schriftgröße, fett und Ausrichtung sind einstellbar.
  - Die Form kann nachträglich gewechselt werden.
  - Geändert in 3.2.0: zusätzliche Formen für Flussdiagramme, UML und IT-Architektur – Unterprozess, Verzögerung, Notiz, Paket, Komponente, Akteur, Server, Warteschlange, Container, Browser/UI, Endgerät, Firewall. Die Formenauswahl ist in die Gruppen „Grundformen“, „Flussdiagramm & UML“ und „Software & IT“ gegliedert. Alle Formen sind eigene Zeichnungen (keine Symbole Dritter).

### REQ-ELEM-004 Verbindungen
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Linien und Pfeile zwischen Elementen oder freien Punkten.
- **Akzeptanzkriterien:**
  - Verlauf gerade, gewinkelt oder als Kurve; Pfeilspitzen an Anfang und/oder Ende; Farbe, Stärke, Strichart, Beschriftung.
  - Mit Elementen verbundene Enden folgen den Elementen beim Verschieben.
  - Endpunkte lassen sich an andere Elemente umhängen.
  - Werden verbundene Elemente gelöscht (auch per Rückgängig), werden die Verbindungen mit entfernt; verwaiste Verbindungen werden nicht dargestellt.

### REQ-ELEM-005 Quick Connect
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** An einem ausgewählten Element erscheinen vier Punkte, mit denen sich schnell verbundene Elemente erzeugen lassen.
- **Akzeptanzkriterien:**
  - Klick auf einen Punkt erzeugt eine Kopie in dieser Richtung inklusive Verbindung und startet die Texteingabe.
  - Ziehen auf ein anderes Element verbindet die beiden; Ziehen auf eine freie Fläche erzeugt dort ein neues verbundenes Element.

### REQ-ELEM-006 Freihandzeichnen
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Stift, Textmarker und Radierer.
- **Akzeptanzkriterien:**
  - Stift mit 8 Farben und 5 Stärken; Textmarker halbtransparent; Radierer entfernt Freihandstriche.
  - Striche werden geglättet dargestellt.

### REQ-ELEM-007 Frames
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Benannte Bereiche, die Inhalte gruppieren und als Präsentationsfolien dienen.
- **Akzeptanzkriterien:**
  - Formatvorlagen 16:9, 4:3, A4 hoch/quer, Quadrat, Smartphone.
  - Beim Verschieben eines Frames wandern die darin liegenden Elemente mit.
  - Ein Frame wird über seinen Titel ausgewählt; Ziehen in einer leeren Frame-Fläche erzeugt einen Auswahlrahmen.
  - Reihenfolge und Navigation über das Frames-Panel.

### REQ-ELEM-008 Karten (Aufgaben)
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Aufgabenkarten mit strukturierten Angaben.
- **Akzeptanzkriterien:**
  - Titel, Beschreibung, Zuständigkeit (mit Vorschlägen aus bekannten Namen), Fälligkeitsdatum, Status und Farbe.
  - Überfällige Termine werden rot dargestellt.
  - Geändert in 3.2.0: zusätzlich Schlüssel/Ticketnummer (z. B. „VB-42“), Priorität (Kritisch, Hoch, Mittel, Niedrig – auch über die Kontextleiste), Story Points und bis zu 8 Labels. Alle Angaben erscheinen auf der Karte, ohne sich zu überlappen.
  - Karten bilden die Aufgaben des Boards (Aufgaben-Panel, „Meine Aufgaben“, siehe [16](16-projektarbeit.md)).

### REQ-ELEM-009 Tabellen
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Einfache Tabellen mit bearbeitbaren Zellen.
- **Akzeptanzkriterien:**
  - Zeilen und Spalten hinzufügen und entfernen, Kopfzeile ein/aus, Schriftgröße.
  - Doppelklick bearbeitet eine Zelle; Tab/Umschalt+Tab springt zur nächsten/vorigen Zelle.
  - Entfernt jemand anderes die gerade bearbeitete Zeile, endet die Bearbeitung ohne Fehler.

### REQ-ELEM-010 Mindmaps
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Hierarchische Knoten mit automatischer Platzierung und Verbindung.
- **Akzeptanzkriterien:**
  - Tab erzeugt einen Unterknoten, Enter (beim Tippen) bzw. Umschalt+Enter einen Geschwisterknoten.
  - Hauptäste erhalten unterschiedliche Farben; Unterknoten werden ohne Überlappung untereinander angeordnet.

### REQ-ELEM-011 Bilder
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Bilder auf dem Board.
- **Akzeptanzkriterien:**
  - Einfügen per Upload-Dialog, Drag & Drop oder Zwischenablage.
  - Bilder über 1800 px oder 1,5 MB werden vor dem Hochladen verkleinert.
  - Seitenverhältnis bleibt beim Skalieren erhalten. Alle Uploads werden geprüft (siehe [12](12-uploads-virenschutz.md)).

### REQ-ELEM-012 Sticker
- **Seit:** 1.0.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Beschreibung:** Emojis als frei platzier- und skalierbare Elemente (32 Auswahlmöglichkeiten).

### REQ-ELEM-013 Links an Elementen
- **Seit:** 1.0.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Beschreibung:** Notizen, Formen, Texte, Karten, Bilder, Sticker und Frames können eine Web-Adresse tragen.
- **Akzeptanzkriterien:**
  - Ein Link-Symbol am Element öffnet die Adresse in einem neuen Tab (ohne Zugriff auf das Ursprungsfenster).
  - Erlaubt sind nur http(s)- und mailto-Adressen; Adressen ohne Schema werden als https ergänzt.

### REQ-ELEM-014 Kommentare
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Diskussionen an beliebigen Stellen des Boards.
- **Akzeptanzkriterien:**
  - Kommentar-Threads mit Antworten, Autor und Zeitpunkt; @Erwähnungen werden hervorgehoben.
  - Kommentare lassen sich als erledigt markieren und ausblenden; ein Panel listet alle Kommentare.
  - Ein Kommentar ohne Text wird beim Schließen verworfen.
  - Kommentar-Symbole behalten in jeder Zoomstufe ihre Größe.

### REQ-ELEM-015 Code-Blöcke
- **Seit:** 3.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Quelltext, Konfigurationen und Befehle lesbar auf dem Board zeigen (z. B. für API-Entwürfe, Code-Reviews, Runbooks).
- **Akzeptanzkriterien:**
  - Eigenes Werkzeug „Code-Block“; Bearbeiten per Doppelklick oder Enter in Festbreitenschrift, Tab rückt ein, Esc beendet.
  - Syntaxhervorhebung (Kommentare, Zeichenketten, Zahlen, Schlüsselwörter) für JavaScript/TypeScript, Python, Java/Kotlin, C#, Go, PHP, SQL, Shell, JSON, YAML, HTML/XML, CSS, Dockerfile sowie reinen Text.
  - Dunkles oder helles Farbschema, Schriftgröße, Zeilennummern ein/aus, optionaler Titel; „Code kopieren“ legt den Text in die Zwischenablage.
  - Die Höhe passt sich der Zeilenzahl an; zu lange Zeilen werden am Rand des Blocks abgeschnitten.
  - Code-Blöcke werden mit exportiert und sind über die Suche auffindbar.

### REQ-ELEM-016 Diagramm aus Text
- **Seit:** 3.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Fluss- und Sequenzdiagramme aus einer Textbeschreibung in der verbreiteten Mermaid-Schreibweise erzeugen („Diagrams as Code“).
- **Akzeptanzkriterien:**
  - Dialog „Diagramm aus Text“ (Werkzeugleiste und Export-/Importmenü) mit Live-Vorschau, Beispielen und Kurzreferenz; Fehler werden verständlich auf Deutsch gemeldet.
  - Flussdiagramme (`flowchart`/`graph` mit TD, LR, BT, RL): Knotenformen Rechteck, abgerundet, Raute, Kreis, Start/Ende, Datenbank, Unterprozess, Sechseck, Parallelogramm, Trapez; Kanten mit/ohne Pfeil, gestrichelt, dick, beidseitig, mit Beschriftung; `A & B --> C`; Gruppen (`subgraph … end`); Kommentare `%%`. Die Anordnung erfolgt automatisch in Ebenen, auch bei Zyklen.
  - Sequenzdiagramme (`sequenceDiagram`): Teilnehmer und Akteure (mit `as`-Namen), synchrone/asynchrone Nachrichten, Antworten, Selbstnachrichten, Notizen, `autonumber`, Blöcke `alt/else`, `loop`, `opt`, `par`, `critical`, `break`.
  - Ergebnis sind normale, frei bearbeitbare Formen, Verbindungen und Texte; sie werden ohne Überlappung mit bestehenden Inhalten eingefügt und ausgewählt.
  - Eigene Umsetzung ohne fremde Bibliothek.
