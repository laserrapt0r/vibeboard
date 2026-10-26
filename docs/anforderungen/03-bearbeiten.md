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

### REQ-EDIT-005 Gruppieren, Sperren, Ebenen
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Gruppieren (Strg+G) und Aufheben (Strg+Umschalt+G); ein Klick wählt die ganze Gruppe.
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
