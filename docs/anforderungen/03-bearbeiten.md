# 03 – Bearbeiten

### REQ-EDIT-001 Auswahl
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Einzelauswahl per Klick, Mehrfachauswahl per Umschalt-/Strg-Klick oder Auswahlrahmen, alles per Strg+A.
  - Geändert in 3.3.0: Ein Klick ohne Ziehen auf ein Element innerhalb einer Mehrfachauswahl (z. B. direkt nach dem Einfügen eines Diagramms) wählt nur dieses Element aus; Ziehen verschiebt weiterhin die ganze Auswahl.
  - Frames werden vom Auswahlrahmen nur erfasst, wenn sie vollständig innerhalb liegen.
  - Gesperrte Elemente werden per Klick ausgewählt, Ziehen auf ihnen erzeugt einen Auswahlrahmen.

### REQ-EDIT-002 Verschieben und Größe ändern
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Verschieben per Maus, Touch oder Pfeiltasten (1 px, mit Umschalt 10 px); Alt-Ziehen verschiebt eine Kopie.
  - Größe über 8 Griffe; Umschalt oder Eckgriffe bei Mehrfachauswahl, Bildern und Stickern erhalten das Seitenverhältnis.
  - Eckgriffe skalieren bei Textfeldern auch die Schrift.
  - Gleichzeitige Änderungen anderer Personen (z. B. am Text) werden beim Ziehen nicht überschrieben; während des Ziehens gelöschte Elemente erscheinen nicht wieder.
  - Geändert in 3.4.0 – Griffe:
    - Seitengriffe ändern nur die Breite bzw. nur die Höhe.
    - Bei flachen oder schmalen Elementen (unter 30 px auf dem Bildschirm, z. B. Gantt-Balken) bleiben die Seitengriffe erhalten und die Eckgriffe entfallen; bei sehr kleinen Elementen gibt es nur Eckgriffe.
    - Griffe haben eine größere, unsichtbare Greiffläche.
  - Geändert in 3.4.0 – Größe ändern:
    - Die bewegte Kante rastet an Kanten, Mitten und Tabellenlinien anderer Elemente ein oder an der gleichen Breite/Höhe eines anderen Elements (Anzeige „= Breite“); der nähere Treffer gewinnt.
    - Während des Ziehens wird die Größe angezeigt.
    - Umschalt behält das Seitenverhältnis (bei Bildern, Stickern und Mehrfachauswahl umgekehrt), Alt ändert die Größe von der Mitte aus, Strg schaltet das Einrasten vorübergehend ab.
  - Geändert in 3.4.0 – Verschieben:
    - Umschalt beschränkt das Verschieben auf waagerecht oder senkrecht.
    - Elemente rasten auch an Tabellenlinien ein (z. B. Wochen im Gantt-Diagramm) und an gleichen Abständen zu Nachbarn in derselben Reihe oder Spalte (Abstandsmarken mit Zahl). Die Position wird angezeigt.
    - Mit eingeschaltetem Raster bewegen die Pfeiltasten um eine Rasterweite.
  - Geändert in 3.4.0 – Exakte Werte: Über „B×H“ in der Kontextleiste lassen sich X, Y, Breite und Höhe eingeben, optional mit festem Seitenverhältnis. Bei Mehrfachauswahl verschieben X/Y die Auswahl, Breite/Höhe gelten für jedes Element.

### REQ-EDIT-003 Texteingabe direkt auf dem Board
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Doppelklick oder Enter startet die Bearbeitung; Esc oder Strg+Enter beendet sie.
  - Die Eingabe ist für andere Teilnehmende live sichtbar.
  - Ändert jemand anderes den Text, bevor man selbst getippt hat, wird dessen Text übernommen.

### REQ-EDIT-004 Ausrichten, Verteilen, Anordnen
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Links, horizontal mittig, rechts, oben, vertikal mittig, unten; horizontal/vertikal gleichmäßig verteilen; als Raster anordnen.
  - Sticky Notes lassen sich nach Farbe in Gruppen clustern.
  - Geändert in 3.4.0:
    - Gleiche Breite, gleiche Höhe oder gleiche Größe; Referenz ist das zuerst ausgewählte Element.
    - Lückenlos oder mit festem Abstand aneinanderreihen (Reihenfolge nach Lage).
    - Position und Größe am Raster ausrichten.
    - Größe kopieren und auf andere Elemente übernehmen (auch nur Breite oder Höhe).
    - Strg+D wiederholt den Versatz, um den die letzte Kopie verschoben wurde (z. B. für Reihen gleicher Balken).

### REQ-EDIT-005 Gruppieren, Sperren, Ebenen
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Gruppieren (Strg+G) und Aufheben (Strg+Umschalt+G); ein Klick wählt die ganze Gruppe.
  - Geändert in 3.4.0:
    - Eine Gruppe bewegt sich immer vollständig: beim Ziehen an jedem Element (auch an einer Verbindungslinie der Gruppe), mit Pfeiltasten, beim Kopieren und wenn ein Frame verschoben wird, der nur einen Teil der Gruppe enthält.
    - Ein erneuter Klick auf ein Element der bereits ausgewählten Gruppe wählt nur dieses Element. Es lässt sich dann einzeln bearbeiten (Farbe, Größe, Position, Biegen einer Linie), ohne die Gruppe aufzulösen; ein Klick daneben wählt wieder die ganze Gruppe.
  - Geändert in 4.8.0: Neben der Sperre gibt es die Fixierung ([REQ-EDIT-010](#req-edit-010-position-fixieren)); gesperrte Teile wandern mit ihrem Frame mit.
  - Sperren (Strg+L) verhindert Verschieben, Größenänderung, Bearbeiten und Löschen. Geändert in 3.3.0: Ein Doppelklick auf ein gesperrtes Element erklärt, wie es sich entsperren lässt.
  - In den Vorder-/Hintergrund (Strg+] / Strg+[).

### REQ-EDIT-006 Kopieren, Einfügen, Duplizieren
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Strg+C/X/V über die System-Zwischenablage, auch zwischen Boards; Strg+D dupliziert.
  - Verbindungen zwischen kopierten Elementen bleiben erhalten; Frames werden mit Inhalt kopiert.
  - Mehrzeiliger Text erzeugt eine Sticky Note pro Zeile; eine einzelne URL wird als Link-Text eingefügt.

### REQ-EDIT-007 Rückgängig und Wiederholen
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Strg+Z / Strg+Y bzw. Strg+Umschalt+Z; bis zu 300 Schritte; eine Zieh- oder Tippaktion ist ein Schritt.
  - Die Historie bleibt auch dann intakt, wenn ein gerade bearbeitetes Element von anderen gelöscht wird oder während des Ziehens eine Zwei-Finger-Geste beginnt.
  - Während eines laufenden Ziehvorgangs wird Rückgängig ignoriert.

### REQ-EDIT-008 Kontextleiste, Kontextmenü, Suche, Tastenkürzel
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Über der Auswahl erscheint eine Leiste mit den zur Auswahl passenden Einstellungen.
  - Rechtsklick öffnet ein Kontextmenü (Auswahl bzw. freie Fläche).
  - Strg+F durchsucht Texte, Titel, Beschreibungen, Beschriftungen, Kommentare und Tabellenzellen; Treffer werden hervorgehoben und angesprungen.
  - Eine Übersicht aller Tastenkürzel öffnet sich mit `?`.

### REQ-EDIT-009 Automatisches Layout und Swimlanes
- **Seit:** 4.4.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Verbundene oder ausgewählte Elemente lassen sich von links nach rechts, von oben nach unten oder als Mindmap anordnen. Zyklen stören nicht, gesperrte Elemente bleiben stehen.
  - Frames lassen sich in benannte Bahnen teilen. „In den Bahnen anordnen“ ordnet Spalten nach der Abfolge, jedes Element bleibt in seiner Bahn, der Frame wächst bei Bedarf.

### REQ-EDIT-010 Position fixieren
- **Seit:** 4.8.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Neben der vollen Sperre gibt es eine Fixierung: Lage und Aussehen stehen fest, der Text bleibt bearbeitbar.
- **Akzeptanzkriterien:**
  - Im Kontextmenü „Position fixieren“ und „Fixierung lösen“; Strg+L entsperrt auch Fixiertes.
  - Fixierte Elemente lassen sich nicht einzeln verschieben, skalieren oder per Entf löschen, auch nicht durch Leeren des Textes. Tab legt in ihnen kein neues Objekt an.
  - Fixierte und gesperrte Elemente wandern mit ihrem Frame mit; von der Moderation Gesperrtes bleibt stehen. Karten lassen sich fixieren, verhalten sich dann aber wie gesperrte Karten.
  - Die Sperre der Moderation geht vor: Dann ist auch der Text gesperrt.
  - „Frame samt Inhalt löschen“ entfernt auch gesperrte und fixierte Teile, nicht aber von der Moderation gesperrte Elemente und Kommentare. Es lässt sich rückgängig machen.

### REQ-EDIT-011 Nächstes Objekt per Tab
- **Seit:** 4.8.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Tab beim Tippen in einer Notiz oder Form legt das nächste Objekt gleicher Art und Gestaltung auf freiem Platz daneben an und startet die Eingabe.
  - Liegt das Objekt in einer Spalte oder einem Frame, bleibt das neue darin. Ist die Spalte voll, läuft es unten über, nie in die Nachbarspalte. Enter bleibt der Zeilenumbruch.
  - Aus einem leeren Objekt heraus entsteht kein weiteres; ein per Tab angelegtes, leer gebliebenes Objekt verschwindet beim Beenden.

### REQ-EDIT-012 Werkzeug aktiv halten
- **Seit:** 4.8.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Doppelklick aufs Werkzeug hält Notiz, Form, Text, Frame, Karte, Tabelle, Code und Mindmap aktiv, sichtbar am Rahmen der Schaltfläche. Werkzeuge mit Taste gehen auch mit Umschalt+Taste. Esc oder ein anderes Werkzeug beendet das.
  - Das Formen-Menü zeigt bis zu sechs zuletzt verwendete Formen; die Auswahl bleibt im Browser gespeichert.

### REQ-EDIT-013 Befehlspalette
- **Seit:** 4.9.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Strg+K (oder die Schaltfläche in der Kopfleiste) öffnet eine Suche über alles, was gerade erreichbar ist.
- **Akzeptanzkriterien:**
  - Gefunden werden die sichtbaren Werkzeuge und Schaltflächen, Aktionen für die Auswahl, Einstellungen, Frames und, ab zwei Zeichen, Vorlagen und Inhalte auf dem Board. Was jemand nicht darf oder was gerade deaktiviert ist, erscheint nicht, auch keine Aktionen für eine vollständig gesperrte Auswahl.
  - Neue Schaltflächen erscheinen ohne Zutun, da die Palette sie zur Laufzeit einsammelt.
  - Zuletzt verwendete Befehle stehen oben. Die Suche ignoriert Groß- und Kleinschreibung und Akzente; alle Wörter müssen vorkommen.
  - Strg+K wirkt auch während der Eingabe auf dem Board. In Eingabefeldern von Dialogen und im Namen des Boards bleibt die Taste dem Browser überlassen.
  - Vollständig per Tastatur und mit Bildschirmleser bedienbar: Pfeiltasten wählen, Enter führt aus, Esc schließt. Der Fokus kehrt danach zurück.

### REQ-EDIT-014 Format übertragen
- **Seit:** 4.9.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Der Pinsel in der Kontextleiste nimmt das Format des ausgewählten Elements auf, der nächste Klick überträgt es. Ein Klick ins Leere beendet ihn. Doppelklick auf den Pinsel hält ihn für mehrere Ziele, bis Esc ihn beendet.
  - Über die Tastatur: Strg+Alt+C kopiert das Format, Strg+Alt+V wendet es auf die Auswahl an. Beides steht auch im Menü „Mehr“.
  - Übertragen wird nach Bedeutung, auch zwischen Elementarten: Fläche (bei Karten die Farbe), Linie, Textfarbe, Schrift und Ausrichtung, bei Verbindern auch Linienverlauf und Enden. Text, Größe und Lage bleiben. Tabellen übertragen ihr Gesamtformat, nicht das einzelner Zellen.
  - Hat das Ausgangselement keine eigene Farbe, behält das Ziel seine. Gesperrte und fixierte Elemente bleiben unverändert. Das Übertragen lässt sich rückgängig machen.
