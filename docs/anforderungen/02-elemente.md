# 02 – Board-Elemente

### REQ-ELEM-001 Sticky Notes
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Farbige Notizzettel mit Text.
- **Akzeptanzkriterien:**
  - 16 Farben; die Textfarbe passt sich automatisch für ausreichenden Kontrast an.
  - Geändert in 3.5.0: Text in Notizen, Formen und Textfeldern kann zusätzlich unterstrichen und durchgestrichen werden; Notizen und Formen haben eine senkrechte Ausrichtung (oben/Mitte/unten).
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
  - Geändert in 3.6.0 – weitere Formen in sieben Gruppen:
    - Flussdiagramm: mehrere Dokumente, manuelle Eingabe, manuelle Tätigkeit, Anzeige, interner Speicher, Verweis auf andere Seite.
    - UML: Klasse (Abschnitte für Name, Attribute und Operationen werden durch eine Zeile „--“ getrennt; der Name steht fett und mittig, Stereotypen wie «interface» darüber), Knoten (Verteilung), Start- und Endzustand, Gabelung/Vereinigung, Signal senden und empfangen.
    - BPMN: Start-, Zwischen- und Endereignis, exklusives, paralleles und inklusives Gateway.
    - Netzwerk & Rechenzentrum: Router, Switch, Load Balancer, WLAN-Access-Point, Internet, Serverschrank, Speichersystem, Arbeitsplatz-PC, Smartphone/Tablet, Benutzergruppe.
    - Software & IT: zusätzlich Dienst/Konfiguration und Sicherheit/Zugriffsschutz.
    - Container-Plattform (z. B. Kubernetes): Pod, Deployment/ReplicaSet, Service, Ingress, Knoten (Node), ConfigMap, Secret, Volume.
    - Symbole (Router, Pod, …) behalten ihr Seitenverhältnis; die Beschriftung steht darunter. Bei kleinen Formen (Ereignisse, Gateways, Start/Ende, Gabelung) steht sie unter der Form.
    - Neue Formen erhalten eine passende Standardgröße. Legt man eine Form mit Beschriftung außerhalb im dunklen Design an, ist die Beschriftung hell.
    - Alle Symbole sind eigene, allgemeine Zeichnungen. Herstellersymbole (z. B. von Cisco), Logos und die Gestaltung fremder Symbolsätze (z. B. das Siebeneck der Kubernetes-Symbole) werden nicht verwendet.

### REQ-ELEM-004 Verbindungen
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Linien und Pfeile zwischen Elementen oder freien Punkten.
- **Akzeptanzkriterien:**
  - Verlauf gerade, gewinkelt oder als Kurve; Pfeilspitzen an Anfang und/oder Ende; Farbe, Stärke, Strichart, Beschriftung.
  - Mit Elementen verbundene Enden folgen den Elementen beim Verschieben.
  - Endpunkte lassen sich an andere Elemente umhängen.
  - Werden verbundene Elemente gelöscht (auch per Rückgängig), werden die Verbindungen mit entfernt; verwaiste Verbindungen werden nicht dargestellt.
  - Geändert in 3.3.0 – Andocken:
    - Ein Ende lässt sich an jeder Stelle des Umrisses andocken, auch bei Ellipsen und Rauten (der Punkt liegt auf dem tatsächlichen Umriss).
    - Nahe einer Seitenmitte rastet es dort ein. Wird es im Inneren einer Form losgelassen, dockt es automatisch an der jeweils günstigsten Seite an.
    - Beim Ziehen zeigen Markierungen, wo das Ende andocken wird.
    - Feste Andockpunkte bleiben beim Verschieben und Vergrößern relativ zur Form erhalten.
  - Geändert in 3.3.0 – Verlauf:
    - Eine angedockte Linie anfassen und ziehen biegt sie (Knickpunkt). An jedem Abschnitt der ausgewählten Linie fügt ein Griff weitere Knickpunkte ein.
    - Knickpunkte lassen sich verschieben (mit Einrasten waagerecht/senkrecht zu den Nachbarpunkten) und per Doppelklick entfernen. Das gilt für Kurven, gewinkelte und gerade Linien.
    - Knickpunkte wandern mit, wenn beide verbundenen Elemente gemeinsam verschoben werden.
  - Geändert in 3.3.0 – Beschriftung, Linienenden, Menü:
    - Die Beschriftung lässt sich entlang der Linie verschieben.
    - Linienenden sind getrennt für Anfang und Ende wählbar: ohne, Pfeil, Pfeil offen, Dreieck hohl, Raute, Raute gefüllt, Kreis, Querstrich, Krähenfuß (z. B. für ER-Diagramme).
    - Das Menü „Verlauf & Andocken“ bietet: Knickpunkte entfernen, Beschriftung mittig, Richtung umkehren, beide Enden automatisch andocken.

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
  - Geändert in 3.5.0 – Zellauswahl:
    - Ein Klick in die ausgewählte Tabelle wählt eine Zelle; Umschalt-Klick oder Umschalt+Pfeil wählt einen Bereich.
    - Die Kontextleiste zeigt die Auswahl an („Zelle B2“, „A1:C3“, „Ganze Tabelle“).
    - Pfeiltasten bewegen die Auswahl; Enter oder F2 bearbeitet, Tippen überschreibt die Zelle, Entf leert, Esc hebt die Zellauswahl auf.
  - Geändert in 3.5.0 – Formatierung je Zelle: fett, kursiv, unterstrichen, durchgestrichen, Ausrichtung waagerecht (links/Mitte/rechts) und senkrecht (oben/Mitte/unten), Schriftgröße, Textfarbe, Zellenfarbe. Ohne Zellauswahl gilt sie für die ganze Tabelle. Der Editor zeigt die Formatierung der bearbeiteten Zelle.
  - Geändert in 3.5.0 – Zeilen, Spalten, Linien:
    - Zeilen und Spalten lassen sich an der Auswahl einfügen (oberhalb/unterhalb, links/rechts) und löschen, auch mehrere; Inhalte und Formate der übrigen Zellen bleiben erhalten.
    - Inhalt leeren, Formatierung entfernen, Spaltenbreiten bzw. Zeilenhöhen angleichen.
    - Farben von Kopfzeile und Linien sind wählbar.
    - Spaltenbreiten und Zeilenhöhen lassen sich durch Ziehen an den inneren Linien ändern; beim Vergrößern der Tabelle bleiben die Verhältnisse erhalten.
  - Formate, Breiten und Höhen werden auf dem Server geprüft (nur bekannte Werte, gültige Farben).
  - Geändert in 3.5.0 – gemeinsames Bearbeiten:
    - Zellinhalte und -formate werden zellgenau übertragen. Bearbeiten oder formatieren zwei Personen gleichzeitig verschiedene Zellen, bleiben beide Änderungen erhalten, und alle sehen denselben Stand.
    - Fügt jemand Zeilen oder Spalten ein oder löscht sie, während eine andere Person eine Zelle bearbeitet oder ausgewählt hat, wandern Bearbeitung und Auswahl mit der Zelle mit. Wurde die Zelle gelöscht, endet die Bearbeitung.
    - Rückgängig nimmt nur die eigenen Zelländerungen zurück, nicht die anderer Personen.

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
  - Geändert in 3.7.0 – Kommentare im Team:
    - Kommentieren dürfen alle ab der Rolle „Kommentieren“ ([REQ-BOARD-002](08-boards-teilen.md)), auch Gäste mit dieser Rolle.
    - Schreiben, Antworten, Erledigen, Zuweisen und Löschen laufen über eigene Operationen: Autor (Benutzer-ID und Name) und Zeitpunkt legt der Server fest. Ein Verschieben des Kommentars kann den Thread nicht überschreiben; neue Kommentare oder die Umwandlung anderer Elemente in Kommentare über normale Änderungen lehnt der Server ab. Rückgängig nach dem Löschen stellt den gespeicherten Kommentar wieder her.
    - Geändert in 3.7.1: Beim Kopieren, Duplizieren und JSON-Import in ein bestehendes Board werden Kommentare nicht übernommen (wie beim Export); ein Hinweis nennt die Anzahl. Ein neues Board aus einem Import übernimmt Kommentare, aber ohne Benutzerkennungen der Beiträge, ohne Zuweisungen und ohne Moderationssperren. Tasten im Kommentarfenster wirken nie als Board-Kürzel; ein angefangener Kommentar übersteht das Wiederverbinden.
    - Ein Thread fasst höchstens 500 Beiträge; Kommentare sind je Person auf 120 pro Minute begrenzt. Von der Moderation gesperrte Kommentare ändern nur Moderierende.
    - Beim Tippen von „@“ schlägt das Eingabefeld Personen mit Bezug zum Board vor (Besitzer, Mitglieder, Team, aktive Gäste, bei Link-Freigabe auch Besucher); Pfeiltasten wählen, Enter oder Tab übernimmt. Erwähnungen der eigenen Person sind hervorgehoben. Die Personenliste erhalten nur Personen ab der Rolle „Kommentieren“; Gäste sehen dabei keine Anmeldenamen (sie erwähnen über den Anzeigenamen).
    - Geändert in 4.0.0: Erwähnt wird über den Namen (`@Vorname Nachname`). Da Namen nicht eindeutig sind, schickt das Eingabefeld die IDs der ausgewählten Personen mit; maßgeblich sind diese, solange „@Name“ im Text steht. Von Hand getippte Namen zählen nur, wenn sie unter den Personen des Boards eindeutig sind. Der Kommentar speichert die erwähnten Personen; hervorgehoben wird danach (die eigene Person anhand der ID).
    - Löschen dürfen Bearbeitende jeden Kommentar, alle anderen nur eigene Threads ohne Antworten anderer.
    - Ein neuer Kommentar entsteht erst mit dem ersten Beitrag; ein leerer Entwurf verschwindet beim Schließen, ohne gespeichert zu werden.
    - Das Kommentar-Panel filtert nach „Offen“, „Mir zugewiesen“ und „Alle“.

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

### REQ-ELEM-017 Dateianhänge
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Hochladen über das Werkzeug „Bild oder Datei hochladen“, das Menü „Exportieren & Importieren“ oder per Ablegen auf dem Board. Erlaubt: PDF, Word, Excel, PowerPoint (auch ältere Formate), OpenDocument, Text, Markdown, CSV, JSON.
  - Der Server erkennt den Typ am Inhalt (passend zur Endung), prüft Größe (Standard 20 MB, einstellbar) und Virenscan; höchstens 200 Dateien je Board. Hochladen dürfen Bearbeitende.
  - Das Element zeigt Dateityp, Name und Größe, bei PDFs die erste Seite als Vorschau.
  - Doppelklick öffnet den Betrachter – auch für Betrachter und Gäste: PDF-Seiten (bis 50), Text direkt, Office-Dateien mit Hinweis; jederzeit Download.
  - Kopien eines Boards und Versionskopien übernehmen die Dateien. Dateien ohne Verweis aus Elementen oder Versionen werden nach sieben Tagen entfernt; mit dem Board werden sie gelöscht.

### REQ-ELEM-018 Diagramme aus Tabellen
- **Seit:** 4.4.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Aus einer Tabelle entsteht ein Balken-, Linien- oder Tortendiagramm. Erste Zeile: Reihen, erste Spalte: Beschriftung.
  - Das Diagramm folgt Änderungen der Tabelle sofort. Zahlen dürfen Tausendertrenner, Dezimalkomma, Prozent- und Währungszeichen enthalten.
  - Diagrammart und Titel sind änderbar; Kopien behalten die Verbindung zur mitkopierten Tabelle. Ohne Zahlen erscheint ein Hinweis.

### REQ-ELEM-019 Bilder zuschneiden
- **Seit:** 4.4.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Zuschneiden per Griffen oder Zahlenfeldern, jederzeit umkehrbar; das Original bleibt erhalten.

### REQ-ELEM-020 Stift und Skizzen
- **Seit:** 4.4.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Druckempfindliche Stifte erzeugen Linien, deren Breite dem Druck folgt; Maus und Finger bleiben gleichmäßig.
  - Ausgewählte Freihandlinien lassen sich in Linie, Kreis, Rechteck, Dreieck oder Raute umwandeln. Ohne eindeutiges Ergebnis bleibt die Linie unverändert.
