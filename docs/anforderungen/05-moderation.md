# 05 – Moderation und Präsentation

### REQ-MOD-001 Gemeinsamer Timer
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Voreinstellungen 1, 2, 3, 5, 10, 15, 30 Minuten oder frei 1–180 Minuten.
  - Pause, Fortsetzen, +1 Minute und Beenden wirken bei allen Teilnehmenden.
  - Die Anzeige ist unabhängig von abweichenden Gerätezeiten synchron (Abgleich mit der Serverzeit).
  - Bei Ablauf ertönt ein Signal und die Anzeige pulsiert; die letzten 10 Sekunden sind hervorgehoben.
  - Betrachter sehen den Timer, können ihn aber nicht steuern.

### REQ-MOD-002 Abstimmungen
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Start mit optionaler Frage und 1–50 Stimmen pro Person.
  - Klick auf Notiz, Form, Karte, Bild, Text oder Sticker vergibt eine Stimme, Alt-/Umschalt-Klick nimmt sie zurück.
  - Während der Abstimmung sieht jede Person nur die eigenen Stimmen; das Stimmenlimit prüft der Server.
  - Nach dem Beenden: Ergebnisliste sortiert nach Stimmen, Zahlen an den Elementen; Ergebnisse ausblendbar oder löschbar.
  - Auch Betrachter dürfen abstimmen; Stimmen sind nur für vorhandene Elemente möglich.

### REQ-MOD-003 Präsentationsmodus
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Frames werden in der im Frames-Panel festgelegten Reihenfolge als Folien gezeigt (Vollbild).
  - Weiter mit Pfeiltasten, Bild↓, Leertaste oder Enter; zurück mit Pfeiltasten, Bild↑ oder Rücktaste; Ende mit Esc.
  - Inhalte außerhalb der aktuellen Folie werden ausgeblendet; Bedienelemente sind verborgen.

### REQ-MOD-004 Schätzrunde
- **Seit:** 3.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Aufwand einer Karte gemeinsam schätzen, ohne dass frühe Werte die anderen beeinflussen.
- **Akzeptanzkriterien:**
  - Start über die Kontextleiste einer Karte („Schätzrunde starten“) mit Kartendeck Fibonacci (0–100, ?, ☕), T-Shirt-Größen (XS–XXL) oder Stunden.
  - Alle Teilnehmenden – auch Betrachter – wählen verdeckt eine Karte und können sie ändern oder zurücknehmen. Angezeigt wird nur, wer schon geschätzt hat; die Werte der anderen gibt der Server vor dem Aufdecken nicht heraus. Nur Werte des gewählten Decks werden angenommen.
  - Nach dem Aufdecken: Werte aller Personen, Durchschnitt, Median, Spanne und ein Hinweis bei Einigkeit.
  - Bearbeitende können aufdecken, neu schätzen lassen, einen der häufigsten Werte als Story Points auf die Karte übernehmen und die Runde beenden.
  - Eine laufende Runde übersteht Neuladen und Verbindungsabbrüche. Wird die Karte gelöscht, endet die Runde.
  - „Einigkeit“ wird nur angezeigt, wenn alle denselben Zahlen- bzw. Größenwert gewählt haben (nicht bei „?“ oder „☕“).

### REQ-MOD-005 Moderationsrechte im Workshop
- **Seit:** 3.7.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Moderierende steuern, wer während eines Workshops was darf.
- **Akzeptanzkriterien:**
  - Moderation starten kann, wer bearbeiten darf; die startende Person moderiert, der Besitzer (und Admins) gelten immer als moderierend. Weitere Personen lassen sich über ihr Avatar-Menü zur Moderation hinzufügen oder daraus entfernen.
  - „Bearbeiten für Teilnehmende sperren“: Alle anderen sehen das Board wie Betrachter (Kommentieren, Abstimmen, Schätzen und Reaktionen bleiben möglich); Werkzeuge und Kontextleiste passen sich sofort an. Der Server lehnt Änderungen ab und schickt den gültigen Stand zurück.
  - „Timer, Abstimmung & Co. nur für Moderierende“ (beim Start aktiv): Timer, Abstimmung, Schätzrunde, privater Modus sowie „Alle zu mir holen“ / „Alle folgen mir“ sind Moderierenden vorbehalten; andere erhalten einen Hinweis, der Server lehnt ab.
  - „Für Teilnehmende sperren“ an ausgewählten Elementen (z. B. Hintergründe einer Vorlage): nur Moderierende können diese Elemente ändern, verschieben oder löschen, auch nach Ende der Moderation; danach nur noch der Besitzer. Nur Moderierende können die Sperre setzen oder aufheben.
  - Die Sperren gelten auch für Umbenennen über die Übersicht und für das Wiederherstellen einer Version: Während der Bearbeitungssperre lehnt der Server beides für Nicht-Moderierende ab; enthält das Board für Teilnehmende gesperrte Elemente, dürfen nur Moderierende bzw. der Besitzer eine Version wiederherstellen. Gesperrte Kommentare können nur Moderierende ändern oder löschen.
  - Ein Banner zeigt die laufende Moderation, die Moderierenden und gesperrte Bereiche; abgelehnte Aktionen werden erklärt.

### REQ-MOD-006 Retro-Ablauf
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Eine Leiste führt alle durch die Schritte einer Retrospektive und stellt je Schritt die passenden Werkzeuge ein.
- **Akzeptanzkriterien:**
  - Schritte (wählbar): Check-in, Rückblick, Sammeln, Aufdecken, Gruppieren, Abstimmen, Besprechen, Maßnahmen, Abschluss. Optionen: anonym sammeln, Minuten fürs Sammeln und Gruppieren, Stimmen pro Person, Minuten je Thema.
  - Beim Wechsel richtet der Browser der steuernden Person ein: Check-in → Stimmungsumfrage; Sammeln → privater Modus (anonym) und Timer; Aufdecken → privater Modus aus; Gruppieren → Timer; Abstimmen → Abstimmung über Themengruppen (ohne Themen über Beiträge); Besprechen → Abstimmung beenden, Besprechung in der Reihenfolge der Stimmen; Maßnahmen/Rückblick → Maßnahmen-Panel bei allen; Abschluss → ROTI-Umfrage und Zusammenfassung.
  - Steuern darf, wer moderiert – ohne laufende Moderation, wer bearbeiten darf. Der Server prüft das; Teilnehmende sehen die Leiste ohne Steuerknöpfe.
  - Die Leiste zeigt Schritt, Fortschritt und einen Hinweis, was zu tun ist.

### REQ-MOD-007 Themengruppen und Besprechungsmodus
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Ausgewählte Beiträge lassen sich zu einer Themengruppe zusammenfassen (Kontextleiste „Themengruppe bilden“): eine abgerundete Fläche mit Titel, die ihren Inhalt beim Verschieben mitnimmt. Themengruppen sind keine Folien.
  - Abstimmung über Themen: Ein Klick irgendwo in die Gruppe zählt für das Thema; der Server nimmt Stimmen nur für Themengruppen an.
  - Besprechung: Panel mit allen Themen (nach Stimmen), aktuelles Thema wird bei allen hervorgehoben und angezeigt, Timer je Thema, „Erledigt · nächstes“, zurück, beenden.
  - Lean-Coffee-Abfrage „Weiter diskutieren?“ mit 👍 ✋ 👎 für alle (auch Betrachter), Ergebnis für alle sichtbar.

### REQ-MOD-008 Schnellumfragen
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Arten: Stimmungsbarometer (1–5), Fist of Five (0–5), ROTI (1–5), Team-Health-Check (Ampel je Thema, Themen anpassbar), eigene Frage mit 2–8 Antworten.
  - Alle stimmen ab (auch Betrachter) und können die Stimme ändern oder zurücknehmen. Bis zum Auflösen sieht jede Person nur die Zahl der Teilnehmenden und die eigene Stimme.
  - Nach dem Auflösen gibt es nur das Ergebnis (Anzahl je Wert, Mittelwert); die Einzelstimmen verwirft der Server. Das Ergebnis wird je Board gespeichert.
  - Der Verlauf zeigt die Ergebnisse dieses Boards und der vorherigen Retros einer Serie (auf die die Person Zugriff hat).

### REQ-MOD-009 Zufallsauswahl und Redereihenfolge
- **Seit:** 4.1.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Glücksrad (eine Person) und Redereihenfolge (alle gemischt) aus einer Namensliste (vorbelegt mit den Anwesenden). Der Zufall entsteht auf dem Server, alle sehen dasselbe Ergebnis.
  - Bei „Bewegung reduzieren“ entfällt die Animation.

### REQ-MOD-010 Verborgene Bereiche
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Vorbereitete Inhalte (z. B. Aufgaben im Workshop) bleiben verdeckt, bis die Moderation sie aufdeckt.
- **Akzeptanzkriterien:**
  - Moderierende (Besitzer, bei aktiver Moderation die Moderierenden) schalten einen Frame per Kontextleiste auf „verborgen“.
  - Teilnehmende sehen nur eine Abdeckung mit Hinweis. Inhalte, deren Mittelpunkt im Bereich liegt (und Verbindungen dorthin), liefert der Server nicht aus – weder im Echtzeitkanal noch über Kopien, Versionskopien, Aufgabenlisten oder Vorschaubilder; im Aktivitätsverlauf erscheinen sie ohne Text.
  - Teilnehmende können den Bereich nicht verändern und nichts hineinlegen. Beim Aufdecken, Verschieben oder Löschen des Bereichs erhalten sie die passenden Änderungen sofort.
  - Ändert sich, wer moderiert, laden Teilnehmende den Stand neu.
  - Solange ein Board verborgene Bereiche hat, startet nur der Besitzer die Moderation (sonst sähe, wer sie startet, die Inhalte), und Versionen stellen nur Moderierende wieder her.
  - Kommentare in verborgenen Bereichen erreichen nur Moderierende, lösen keine Benachrichtigungen aus und erscheinen im Aktivitätsverlauf ohne Text. Schätzrunden und Besprechungen geben keine verborgenen Titel preis.
