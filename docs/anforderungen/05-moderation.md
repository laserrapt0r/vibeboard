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
  - Geändert in 4.15.0: Beenden und Abbrechen einer laufenden Abstimmung sehen und dürfen nur die startende Person, Besitzer, Moderierende und die Retro-Leitung; sind sie alle weg, Bearbeitende. Der Server prüft das und setzt Name und Kennung der startenden Person selbst. „Für mich pausieren“ bleibt für alle: Es wirkt nur im eigenen Browser.
  - Geändert in 4.15.0: Eine eigene Stimme nimmt das Minus neben ihr zurück, ohne Alt oder Umschalt, also auch auf Touch. Mit dem Finger zählt eine Stimme erst beim kurzen Antippen: Langes Drücken und Wischen sind keine Stimme.

### REQ-MOD-003 Präsentationsmodus
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Frames werden in der im Frames-Panel festgelegten Reihenfolge als Folien gezeigt (Vollbild).
  - Weiter mit Pfeiltasten, Bild↓, Leertaste oder Enter; zurück mit Pfeiltasten, Bild↑ oder Rücktaste; Ende mit Esc.
  - Inhalte außerhalb der aktuellen Folie werden ausgeblendet; Bedienelemente sind verborgen.
  - Geändert in 4.11.5: Während der Präsentation wählen Buchstabentasten kein Werkzeug und legen nichts an. Ein Doppelklick beim Abstimmen öffnet keinen Editor (REQ-MOD-002).
  - Geändert in 4.15.0: Die Leiste ist beim Start und nach jeder Aktivität voll sichtbar und tritt erst nach 3 Sekunden Ruhe zurück, nicht bei Fokus und nicht auf Touch-Geräten. Auf der ersten Folie ist Zurück, auf der letzten Weiter deaktiviert.
  - Geändert in 4.15.0: Ohne Frames fragt ein Dialog nach „Frame anlegen“ (Werkzeug) oder „Ganzes Board zeigen“ (eine Ansicht). Wer nur ansehen darf, sieht nur die Ansicht.
  - Geändert in 4.16.0: Beim Start fragt ein Dialog „Für alle präsentieren?“, siehe [REQ-MOD-012](#req-mod-012-präsentieren-für-alle). Wer die Rolle dafür nicht hat, präsentiert ohne Frage nur für sich.

### REQ-MOD-004 Schätzrunde
- **Seit:** 3.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Aufwand einer Karte gemeinsam schätzen, ohne dass frühe Werte die anderen beeinflussen.
- **Akzeptanzkriterien:**
  - Start über das Menü „Mehr“ einer Karte oder Moderieren → Schätzrunde („Schätzrunde starten“) mit Kartendeck Fibonacci (0–100, ?, ☕), T-Shirt-Größen (XS–XXL) oder Stunden.
  - Alle Teilnehmenden – auch Betrachter – wählen verdeckt eine Karte und können sie ändern oder zurücknehmen. Angezeigt wird nur, wer schon geschätzt hat; die Werte der anderen gibt der Server vor dem Aufdecken nicht heraus. Nur Werte des gewählten Decks werden angenommen.
  - Nach dem Aufdecken: Werte aller Personen, Durchschnitt, Median, Spanne und ein Hinweis bei Einigkeit.
  - Bearbeitende können aufdecken, neu schätzen lassen, einen der häufigsten Werte als Story Points auf die Karte übernehmen und die Runde beenden.
  - Eine laufende Runde übersteht Neuladen und Verbindungsabbrüche. Wird die Karte gelöscht, endet die Runde.
  - „Einigkeit“ wird nur angezeigt, wenn alle denselben Zahlen- bzw. Größenwert gewählt haben (nicht bei „?“ oder „☕“).
  - Geändert in 4.16.0: Eine Runde kann mehrere Karten nacheinander behandeln: ausgewählte Karten, „Alle ohne Schätzung“ oder „Mehrere Karten wählen …“. Alle sehen den Fortschritt („Karte 2 von 5“). Nach dem Übernehmen geht es von selbst weiter, „Nächste Karte“ überspringt ohne Wert. Der Server prüft die Warteschlange beim Start: nur sichtbare Karten, keine doppelten. Gelöschte Karten verlassen sie. Ist die laufende Karte gelöscht, folgt die nächste.
  - Geändert in 4.16.0: Karten stehen im Menü und in der Warteschlange in Leserichtung (von oben nach unten, dann von links nach rechts).
  - Geändert in 4.16.0: Die Meldung „… hat eine Schätzrunde gestartet“ erscheint nur beim Start, nicht beim Weitergehen zur nächsten Karte, auch wenn die erste Karte gelöscht wurde.

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
  - Geändert in 4.11.5: Unter der Bearbeitungssperre lässt sich der Boardname nicht ändern; Rückgängig, Wiederholen und Vorlagen nennen die Sperre, Gruppieren täuscht nichts vor. Moderationsknöpfe der Retro setzen Bearbeitungsrechte voraus.

### REQ-MOD-006 Retro-Ablauf
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Eine Leiste führt alle durch die Schritte einer Retrospektive und stellt je Schritt die passenden Werkzeuge ein.
- **Akzeptanzkriterien:**
  - Schritte (wählbar): Check-in, Rückblick, Sammeln, Aufdecken, Gruppieren, Abstimmen, Besprechen, Maßnahmen, Abschluss. Optionen: anonym sammeln, Minuten fürs Sammeln und Gruppieren, Stimmen pro Person, Minuten je Thema.
  - Beim Wechsel richtet der Browser der steuernden Person ein: Check-in → Stimmungsumfrage; Sammeln → privater Modus (anonym) und Timer; Aufdecken → privater Modus aus; Gruppieren → Timer; Abstimmen → Abstimmung über Themengruppen (ohne Themen über Beiträge); Besprechen → Abstimmung beenden, Besprechung in der Reihenfolge der Stimmen; Maßnahmen/Rückblick → Maßnahmen-Panel bei allen; Abschluss → ROTI-Umfrage und Zusammenfassung.
  - Steuern darf, wer moderiert – ohne laufende Moderation, wer bearbeiten darf. Der Server prüft das; Teilnehmende sehen die Leiste ohne Steuerknöpfe.
  - Die Leiste zeigt Schritt, Fortschritt und einen Hinweis, was zu tun ist.
  - Geändert in 4.15.0: Eine laufende Retro leitet, wer sie gestartet hat. Andere sehen keine Steuerknöpfe, nur wer leitet; der Server lehnt Schritte, Besprechung, Umfragen und Zufallsauswahl von ihnen ab, außer von Besitzer und Moderierenden. Sind diese alle weg, dürfen Bearbeitende übernehmen.
  - Geändert in 4.15.0: Die Zusammenfassung bietet „Per E-Mail an Beteiligte“ nur mit Mailserver und „An Team-Kanal“ nur auf Team-Boards.

### REQ-MOD-007 Themengruppen und Besprechungsmodus
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Ausgewählte Beiträge lassen sich zu einer Themengruppe zusammenfassen (Kontextleiste bei laufender Retro, sonst „Mehr“: „Themengruppe bilden“): eine abgerundete Fläche mit Titel, die ihren Inhalt beim Verschieben mitnimmt. Themengruppen sind keine Folien.
  - Abstimmung über Themen: Ein Klick irgendwo in die Gruppe zählt für das Thema; der Server nimmt Stimmen nur für Themengruppen an.
  - Besprechung: Panel mit allen Themen (nach Stimmen), aktuelles Thema wird bei allen hervorgehoben und angezeigt, Timer je Thema, „Erledigt · nächstes“, zurück, beenden.
  - Abfrage „Weiter diskutieren?“ mit 👍 ✋ 👎 für alle (auch Betrachter), Ergebnis für alle sichtbar.

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
  - Moderierende (Besitzer, bei aktiver Moderation die Moderierenden) schalten einen Frame über „Mehr“ in der Kontextleiste auf „verborgen“.
  - Teilnehmende sehen nur eine Abdeckung mit Hinweis. Inhalte, deren Mittelpunkt im Bereich liegt (und Verbindungen dorthin), liefert der Server nicht aus – weder im Echtzeitkanal noch über Kopien, Versionskopien, Aufgabenlisten oder Vorschaubilder; im Aktivitätsverlauf erscheinen sie ohne Text.
  - Teilnehmende können den Bereich nicht verändern und nichts hineinlegen. Beim Aufdecken, Verschieben oder Löschen des Bereichs erhalten sie die passenden Änderungen sofort.
  - Ändert sich, wer moderiert, laden Teilnehmende den Stand neu.
  - Solange ein Board verborgene Bereiche hat, startet nur der Besitzer die Moderation (sonst sähe, wer sie startet, die Inhalte), und Versionen stellen nur Moderierende wieder her.
  - Kommentare in verborgenen Bereichen erreichen nur Moderierende, lösen keine Benachrichtigungen aus und erscheinen im Aktivitätsverlauf ohne Text. Schätzrunden und Besprechungen geben keine verborgenen Titel preis.
  - Geändert in 4.15.0: Überquert ein Element die Bereichsgrenze, ohne dass sich ein Frame ändert, folgen Verbinder und Kommentare daran sofort. Board- und Versionskopien lassen Verbinder zu nicht mitkopierten Elementen weg.

### REQ-MOD-011 Moderation und Privatmodus ohne Moderierende
- **Seit:** 4.11.3 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Eine Sperre darf ein Team nicht aussperren, nur weil die startende Person gegangen ist.
- **Akzeptanzkriterien:**
  - Ist keine moderierende Person und nicht der Besitzer im Board, nennt das Banner, wer gestartet hat, und Personen mit Bearbeitungsrecht können die Moderation beenden. Übernehmen oder ändern können sie sie nicht.
  - Ebenso dürfen sie den Privatmodus aufdecken, wenn weder die startende Person noch jemand Moderierendes da ist.

### REQ-MOD-012 Präsentieren für alle
- **Seit:** 4.16.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Eine Präsentation nimmt das Publikum mit, ohne dass jemand vorher folgen muss.
- **Akzeptanzkriterien:**
  - Beim Start fragt ein Dialog „Für alle präsentieren?“ mit „Für alle“ und „Nur für mich“. „Für alle“ darf, wer auch „Alle folgen mir“ darf: Bearbeitende, bei vorbehaltenen Werkzeugen nur Moderierende. Der Server prüft das. Läuft schon eine Präsentation für alle, wird sie nicht abgelöst.
  - Der Zustand liegt in der Sitzung des Boards. Alle Teilnehmenden folgen dem Folienwechsel automatisch, auch im Long-Polling, und wer später dazukommt, wird mitgenommen.
  - Das Publikum sieht eine reduzierte Ansicht ohne Werkzeugleisten, mit dem Namen der präsentierenden Person und der Folie. Die Fläche nimmt dort keine Eingaben an. „Selbst umsehen“ (auch Esc) gibt die Oberfläche frei, „Wieder folgen“ springt zur aktuellen Folie.
  - Offene Eingaben, offene Dialoge und laufendes Ziehen werden nicht unterbrochen: Das Folgen beginnt, sobald die Person damit fertig ist, ein Hinweis erklärt das.
  - Die Präsentation endet für alle, wenn sie beendet wird oder die präsentierende Person geht. Kurze Aussetzer bis 6 Sekunden und ein Neustart des Servers beenden sie nicht; bleibt das Lebenszeichen 90 Sekunden aus, endet sie. Besitzer, Moderierende und, wenn niemand davon da ist, Bearbeitende können sie über „Für alle beenden“ beenden; die präsentierende Person behält dann ihre Folien für sich.
  - Bricht die eigene Verbindung ab, verlässt das Publikum die reduzierte Ansicht nach 8 Sekunden. Beim Wiederverbinden nimmt die Sitzung es wieder mit, falls die Präsentation noch läuft.
  - Geändert in 4.16.0: Die Leiste des Publikums wird nur bei einer Änderung neu aufgebaut, ein Klick auf „Selbst umsehen“ geht beim Warten nicht verloren.
