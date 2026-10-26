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
