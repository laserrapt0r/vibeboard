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
  - Geändert in 4.16.0: Die exakten Werte stehen im Menü „Mehr“ der Kontextleiste unter „Position und Größe …“ statt hinter „B×H“.

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
  - Notizen lassen sich nach Farbe in Gruppen clustern.
  - Geändert in 3.4.0:
    - Gleiche Breite, gleiche Höhe oder gleiche Größe; Referenz ist das zuerst ausgewählte Element.
    - Lückenlos oder mit festem Abstand aneinanderreihen (Reihenfolge nach Lage).
    - Position und Größe am Raster ausrichten.
    - Größe kopieren und auf andere Elemente übernehmen (auch nur Breite oder Höhe).
    - Strg+D wiederholt den Versatz, um den die letzte Kopie verschoben wurde (z. B. für Reihen gleicher Balken).
  - Geändert in 4.11.3: Gruppen werden als Einheit behandelt, Frames nehmen ihren Inhalt mit, Kommentare und Linien bleiben unberührt.

### REQ-EDIT-005 Gruppieren, Sperren, Ebenen
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Gruppieren (Strg+G) und Aufheben (Strg+Umschalt+G); ein Klick wählt die ganze Gruppe.
  - Geändert in 3.4.0:
    - Eine Gruppe bewegt sich immer vollständig: beim Ziehen an jedem Element (auch an einer Verbindungslinie der Gruppe), mit Pfeiltasten, beim Kopieren und wenn ein Frame verschoben wird, der nur einen Teil der Gruppe enthält.
    - Ein erneuter Klick auf ein Element der bereits ausgewählten Gruppe wählt nur dieses Element. Es lässt sich dann einzeln bearbeiten (Farbe, Größe, Position, Biegen einer Linie), ohne die Gruppe aufzulösen; ein Klick daneben wählt wieder die ganze Gruppe.
  - Geändert in 4.8.0: Neben der Sperre gibt es die Fixierung ([REQ-EDIT-010](#req-edit-010-position-fixieren)); gesperrte Teile wandern mit ihrem Frame mit.
  - Geändert in 4.11.3: Die Sperre gilt für alle Wege: Entf, Strg+X, Kontextmenü, Papierkorb, Radierer, Farben bei gemischter Auswahl. Ausdrücklich ausgenommen ist „Frame samt Inhalt löschen“.
  - Sperren (Strg+L) verhindert Verschieben, Größenänderung, Bearbeiten und Löschen. Geändert in 3.3.0: Ein Doppelklick auf ein gesperrtes Element erklärt, wie es sich entsperren lässt.
  - In den Vorder-/Hintergrund (Strg+] / Strg+[).
  - Geändert in 4.15.0: Sperren ändert die Ebene nicht, gesperrte Elemente bleiben auch bei Strg+] und Strg+[ liegen. Unter den Inhalten liegen nur Flächen aus Vorlagen; wer eine davon nach dem Entsperren nach vorn holt, macht sie zum normalen Element. Alle sehen dieselbe Reihenfolge.

### REQ-EDIT-006 Kopieren, Einfügen, Duplizieren
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Strg+C/X/V über die System-Zwischenablage, auch zwischen Boards; Strg+D dupliziert.
  - Verbindungen zwischen kopierten Elementen bleiben erhalten; Frames werden mit Inhalt kopiert.
  - Mehrzeiliger Text erzeugt eine Notiz pro Zeile; eine einzelne URL wird als Link-Text eingefügt.
  - Geändert in 4.15.0: Einfügen und Enter mit Werkzeug legen nichts deckungsgleich ab, sondern versetzen um ein Rastermaß. Ein Verbinder, dessen eines Ende nicht mitkopiert wurde, bekommt beim Kopieren ein freies Ende an derselben Stelle und kommt so auch in anderen Boards an.

### REQ-EDIT-007 Rückgängig und Wiederholen
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Strg+Z / Strg+Y bzw. Strg+Umschalt+Z; bis zu 300 Schritte; eine Zieh- oder Tippaktion ist ein Schritt.
  - Die Historie bleibt auch dann intakt, wenn ein gerade bearbeitetes Element von anderen gelöscht wird oder während des Ziehens eine Zwei-Finger-Geste beginnt.
  - Während eines laufenden Ziehvorgangs wird Rückgängig ignoriert.
  - Geändert in 4.11.3: Rückgängig und Wiederholen setzen nur die Felder zurück, die dieser Schritt geändert hat. In Tabellen gilt das je Zelle. Hat man selbst Zeilen oder Spalten geändert und andere haben inzwischen geschrieben, bleibt die Struktur stehen und ein Hinweis erklärt das.
  - Geändert in 4.11.5: Ein neu angelegtes Element samt eingetipptem Text verschwindet mit einem Rückgängig.

### REQ-EDIT-008 Kontextleiste, Kontextmenü, Suche, Tastenkürzel
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Über der Auswahl erscheint eine Leiste mit den zur Auswahl passenden Einstellungen.
  - Rechtsklick öffnet ein Kontextmenü (Auswahl bzw. freie Fläche).
  - Strg+F durchsucht Texte, Titel, Beschreibungen, Beschriftungen, Kommentare und Tabellenzellen; Treffer werden hervorgehoben und angesprungen.
  - Eine Übersicht aller Tastenkürzel öffnet sich mit `?`.
  - Geändert in 4.11.0: Das Kontextmenü fügt Fotos und Dateien (PDF, Office, Text) an der Klickstelle ein, auch im Frame und auf Elementen, und bietet Format übertragen, kopieren und einfügen.
  - Geändert in 4.11.5: Die Suche findet auch Dateinamen und Ergebnisse von Tabellenformeln. Das Kontextmenü kopiert einen Link zum Element.
  - Geändert in 4.15.0: Die Tastenkürzel-Übersicht führt „Ganz nach vorn / ganz nach hinten“ als einen Eintrag, ihre Spalten überlappen nicht mehr. In der Befehlspalette stehen nur echte Kürzel in der Kürzelspalte. Meldungen stehen über dem Abstimmungsbanner.
  - Geändert in 4.15.0: Suche und Elementliste folgen dem Board, auch bei Änderungen anderer, ohne die Ansicht zu bewegen. Ein inzwischen gelöschtes Element in der Elementliste wird gemeldet und nicht ausgewählt.
  - Geändert in 4.15.0: Das Kontextmenü ist ein vollwertiges Menü: Rollen, Pfeiltasten, Pos1, Ende, Esc, Symbole und Trenner; die Tasten wirken nicht auf die Auswahl dahinter. Menütaste und Umschalt+F10 öffnen es. Neu ist „Text bearbeiten“, die Einträge sind gruppiert: Bearbeiten, Zwischenablage, Anordnen, Sperren, Zusammenarbeit, Löschen.
  - Geändert in 4.15.0: „Frame samt Inhalt löschen“ meldet die Menge mit dem Knopf „Rückgängig“.
  - Geändert in 4.16.0: Die Leiste zeigt nur Farbe, Text, Link, Kommentar, Sperren, Mehr und Löschen, siehe [REQ-EDIT-017](#req-edit-017-kontextleiste-und-menü-mehr). Das Kontextmenü folgt denselben Gruppen.
  - Geändert in 4.16.0: Die Tastenkürzel-Übersicht führt B für die Tabelle und D für den Code-Block. Die Taste H heißt „Ansicht verschieben“.
  - Geändert in 4.16.0: Die Übersicht liegt in der Hilfe, hat ein Suchfeld und zeigt Häufiges zuerst, siehe [REQ-EDIT-021](#req-edit-021-hilfe). `?` öffnet sie weiterhin direkt.
  - Geändert in 4.16.0: Strg+Umschalt+Pfeil hoch und runter legen die Auswahl ganz nach vorn und ganz nach hinten, auch auf deutscher Tastatur.
  - Geändert in 4.16.0: Die Kontextleiste bleibt beim Tippen sichtbar, siehe [REQ-EDIT-020](#req-edit-020-formatieren-beim-tippen).

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
  - Geändert in 4.15.0: In Frames und Spalten geht es von der eigenen Zeile nach rechts, dann zeilenweise darunter von links weiter, danach in frei gebliebene Plätze weiter oben. Erst wenn der Bereich voll ist, läuft er unten über. Ohne Rahmen bricht die Reihe nach fünf Objekten um.

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
  - Geändert in 4.10.0: Gemerkte Ansichten und „Aktuelle Ansicht merken“ erscheinen immer, Überschriften ab zwei Zeichen.
  - Zuletzt verwendete Befehle stehen oben. Die Suche ignoriert Groß- und Kleinschreibung und Akzente; alle Wörter müssen vorkommen.
  - Strg+K wirkt auch während der Eingabe auf dem Board. In Eingabefeldern von Dialogen und im Namen des Boards bleibt die Taste dem Browser überlassen.
  - Vollständig per Tastatur und mit Bildschirmleser bedienbar: Pfeiltasten wählen, Enter führt aus, Esc schließt. Der Fokus kehrt danach zurück.
  - Geändert in 4.11.5: Die Palette bietet keine Vorlagen an, die die Administration ausgeblendet hat.
  - Geändert in 4.15.0: Die Suche kennt Synonyme je Befehl und sucht in Gruppennamen. Export-Formate, Import, Retro-Einträge und „Personen einladen“ sind eigene Befehle, was die Rolle nicht darf, erscheint nicht. Filter und Retro sind auch in schmalen Fenstern zu finden.
  - Geändert in 4.16.0: Die Palette findet auch, was in Menüs oder hinter „Mehr“ liegt: Boardmenü, Moderieren, Importieren und die Einträge für die Auswahl. Untermenüs werden ab zwei Zeichen durchsucht, doppelte Einträge erscheinen einmal.

### REQ-EDIT-014 Format übertragen
- **Seit:** 4.9.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Der Pinsel in der Kontextleiste nimmt das Format des ausgewählten Elements auf, der nächste Klick überträgt es. Ein Klick ins Leere beendet ihn. Doppelklick auf den Pinsel hält ihn für mehrere Ziele, bis Esc ihn beendet.
  - Über die Tastatur: Strg+Alt+C kopiert das Format, Strg+Alt+V wendet es auf die Auswahl an. Beides steht auch im Menü „Mehr“ und im Kontextmenü, dort auch „Format übertragen“.
  - Übertragen wird nach Bedeutung, auch zwischen Elementarten: Fläche (bei Karten die Farbe), Linie, Textfarbe, Schrift und Ausrichtung, zwischen Formen auch die Form, bei Verbindern auch Linienverlauf und Enden. Haben zwei Elementarten nicht alles gemeinsam, zum Beispiel eine Notiz ohne Rahmen, weist ein Hinweis darauf hin. Text, Größe und Lage bleiben. Tabellen übertragen ihr Gesamtformat, nicht das einzelner Zellen.
  - Hat das Ausgangselement keine eigene Fläche oder Linie, behält das Ziel seine. Die automatische Schriftfarbe wird dagegen mit übertragen; nur Textelemente behalten ihre feste Farbe. Notizen haben dafür auch eine Schaltfläche für die Textfarbe. Gesperrte und fixierte Elemente bleiben unverändert. Das Übertragen lässt sich rückgängig machen.
  - Geändert in 4.16.0: Format übertragen steht im Menü „Mehr“ und im Kontextmenü, „Format mehrfach übertragen“ ersetzt den Doppelklick. Solange der Pinsel läuft, zeigt die Leiste einen Knopf zum Beenden.

### REQ-EDIT-015 Einstieg
- **Seit:** 4.10.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Neue Personen sehen auf einem leeren Board, womit sie anfangen können.
- **Akzeptanzkriterien:**
  - Ein leeres Board bietet Personen mit Bearbeitungsrecht an: Notiz schreiben, Vorlage wählen und für Besitzer Personen einladen. Das Angebot lässt sich schließen und verschwindet mit dem ersten Element, auch wenn es jemand anderes anlegt, sowie solange ein Werkzeug gewählt ist. Beim Hereinziehen einer Datei schließt es sich, damit sie auf der Zeichenfläche landet.
  - Beim ersten Bearbeiten einer Notiz, einer Tabellenzelle und eines Mindmap-Knotens erscheint je einmal ein kurzer Hinweis. Betrachter sehen nichts davon.

### REQ-EDIT-016 Kopfzeile und Boardmenü
- **Seit:** 4.16.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Die Kopfzeile des Boards ist nach Aufgaben geordnet statt einer Reihe unbeschrifteter Symbole.
- **Akzeptanzkriterien:**
  - Das Boardmenü neben dem Namen enthält Exportieren, Importieren, Als Vorlage speichern, Verlauf, Aktivität, Elementliste sowie Board duplizieren, In Ordner verschieben und Board löschen.
  - „Moderieren“ ist ein beschrifteter Knopf mit Timer, Abstimmung, Retro, Privater Modus, Moderation, Schätzrunde, Umfrage, Zufallsauswahl, Redereihenfolge und Aufzeichnung. Läuft etwas davon, ist der Knopf hervorgehoben.
  - „Teilen“ und „Präsentieren“ sind beschriftet und bei jeder Fensterbreite sichtbar. Gäste sehen „Teilen“ nicht.
  - Was nicht mehr passt, wandert ins Menü „Mehr“; keine Leiste scrollt oder lässt Funktionen ersatzlos verschwinden. Auf dem Handy liegen dort auch Moderieren und Einstellungen.
  - Der eigene Avatar öffnet überall das Kontomenü, auch für Gäste. Das Zahnrad enthält nur Ansicht und Bearbeitung.
  - Es erscheint nur, was die Rolle kann: Betrachter sehen weder Importieren noch Verlauf noch Löschen, Gäste keine Funktionen, die ein Konto brauchen. Der Server prüft die Rechte weiterhin selbst.
  - Es gibt keine leeren Menüs und keine Gruppen ohne Einträge. Untermenüs öffnen an derselben Stelle, mit „Zurück“, Pfeil rechts und Pfeil links.

### REQ-EDIT-017 Kontextleiste und Menü „Mehr“
- **Seit:** 4.16.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Die Kontextleiste zeigt das Häufige, alles Übrige steht geordnet im Menü „Mehr“.
- **Akzeptanzkriterien:**
  - Sichtbar sind je nach Elementart nur Farbe, Text, Link, Kommentar, Sperren, Mehr und Löschen. Gibt es mehrere Regler für Farbe oder Text, öffnet der Knopf eine Zusatzzeile, die nach Änderungen offen bleibt.
  - Retro-Knöpfe stehen nur bei laufender Retro in der Leiste, sonst im Menü „Mehr“. Die Symbole folgen dem Stil der übrigen Knöpfe, ohne Farb-Emojis.
  - „Mehr“ gliedert sich in Bearbeiten (Kopieren, Ausschneiden, Duplizieren), Aktionen der Elementart, Anordnen, Format, Größe (mit „Position und Größe …“), Sperren, Zusammenarbeit und Exportieren. Das Kontextmenü verwendet denselben Aufbau.

### REQ-EDIT-018 Werkzeugleiste
- **Seit:** 4.16.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Vorlagen stehen oben, darunter die Gruppen Auswählen und Ansicht verschieben; Notiz, Text, Form, Linie, Bild oder Datei einfügen; Stift, Marker, Radierer; Frame, Karte, Tabelle, Mindmap, Code, Diagramm, Sticker; Kommentar, Laser.
  - Reicht Höhe oder (auf dem Handy) Breite nicht, wandert Seltenes hinter „Mehr“. Ein Werkzeug von dort bleibt am Knopf als aktiv erkennbar.
  - Taste B wählt die Tabelle, Taste D den Code-Block.

### REQ-EDIT-019 Tooltips und Farbnamen
- **Seit:** 4.16.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Knöpfe in Kopfzeile und Werkzeugleiste zeigen nach kurzer Verzögerung einen eigenen Tooltip mit Name und Kürzel, auch bei Tastaturfokus.
  - Geändert in 4.16.0: Der Tooltip verschwindet auch, wenn der Knopf ersetzt wird oder der Zeiger das Fenster verlässt.
  - Farbfelder nennen einen Farbnamen statt eines Hexwerts, auch für Farben aus dem Design (nächstliegender Name).

### REQ-EDIT-020 Formatieren beim Tippen
- **Seit:** 4.16.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Strg+B, Strg+I und Strg+U schalten fett, kursiv und unterstrichen. Während der Eingabe gelten sie für das ganze Element, in einer Tabellenzelle für die Zelle, außerhalb für die Auswahl. Einzelne Wörter lassen sich nicht formatieren.
  - Die Kontextleiste bleibt beim Tippen sichtbar und verdeckt den Editor nicht, solange neben dem Element Platz ist; sonst steht sie am Fensterrand gegenüber dem Text.
  - Format, Farbe, Größe, Ausrichtung und Link lassen sich dort ändern, ohne den Editor zu schließen. Der Fokus und die Einfügestelle bleiben, der Editor zeigt die Änderung sofort.
  - Knöpfe, die nicht den Text betreffen (Kommentar, Sperren, Mehr, Löschen, Retro), beenden die Eingabe zuerst.
  - Gemeinsames Tippen und fremde Cursor laufen dabei weiter.

### REQ-EDIT-021 Hilfe
- **Seit:** 4.16.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Ein Fragezeichen unten links öffnet die Hilfe mit „Erste Schritte“ (Verbinden, Teilen, Präsentieren, Bewegen auf der Fläche), „Kurzanleitung“ und „Tastenkürzel“. Was die Rolle nicht kann, steht dort nicht.
  - Die Tastenkürzel haben ein Suchfeld, „Häufig“ steht zuerst. Die Befehlssuche findet „Hilfe“.
  - Beim ersten Zoomen oder Ziehen auf leerer Fläche erklärt ein einmaliger Tipp das Bewegen auf der Fläche (nicht auf Touch-Geräten).

### REQ-EDIT-022 Mehrfachauswahl auf Touch-Geräten
- **Seit:** 4.16.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Ohne Umschalttaste braucht Touch einen eigenen Weg zur Mehrfachauswahl.
- **Akzeptanzkriterien:**
  - Auf Geräten mit Touch als Hauptzeiger steht neben den Auswahlwerkzeugen „Mehrere auswählen“. Auf Geräten mit Maus gibt es den Schalter nicht.
  - Im Modus nimmt Tippen Elemente in die Auswahl auf oder heraus, Ziehen auf leerer Fläche erweitert sie um einen Rahmen. Flächen, Frames und Gesperrtes zählen dabei als leere Fläche.
  - Zwei schnelle Tipps öffnen im Modus keinen Editor. Wer das Werkzeug wechselt, verlässt den Modus.
  - Im Retro-Schritt „Gruppieren“ bietet die Retro-Leiste den Modus an, „Themengruppe bilden“ ist danach erreichbar.
