# 16 – Projektarbeit: Aufgaben und Versionen

### REQ-PROJ-001 Aufgaben-Panel im Board
- **Seit:** 3.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Alle Karten eines Boards als Aufgabenliste – unabhängig davon, wo sie auf der Leinwand liegen.
- **Akzeptanzkriterien:**
  - Filter „Offen“, „Mir zugewiesen“, „Überfällig“, „Alle“; Gruppierung nach Status mit Anzahl und Summe der Story Points; sortiert nach Fälligkeit.
  - Als erledigt gelten die Status Fertig, Erledigt, Done, Geschlossen, Closed, Abgeschlossen, Resolved und Gelöst (Groß-/Kleinschreibung egal).
  - Je Aufgabe: Farbe, Schlüssel, Titel, Priorität, Fälligkeit (überfällig rot), Story Points, Labels, Zuständigkeit. Ein Klick wählt die Karte aus und zeigt sie.
  - Die Liste aktualisiert sich bei Änderungen anderer; verdeckte private Karten anderer erscheinen nicht.

### REQ-PROJ-002 Meine Aufgaben über alle Boards
- **Seit:** 3.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Die Board-Übersicht zeigt alle Karten aus zugänglichen Boards, deren Zuständigkeit dem eigenen Anzeigenamen oder Benutzernamen entspricht (Groß-/Kleinschreibung egal) – offene zuerst nach Fälligkeit, erledigte optional.
  - Zugänglich sind eigene Boards, Boards mit Mitgliedschaft und besuchte Boards mit Link-Freigabe – dieselbe Regel wie in der Board-Übersicht ([REQ-BOARD-001](08-boards-teilen.md)). Private Elemente anderer Personen erscheinen nie.
  - Geändert in 3.8.0: „Meine Aufgaben“ ist eine eigene Ansicht der Startseite mit Filtern „Offen“, „Überfällig“, „Erledigt“, „Alle“; die Navigation zeigt die Zahl offener (bzw. rot die überfälligen) Aufgaben, die Startansicht einen Hinweis auf überfällige und in den nächsten sieben Tagen fällige Aufgaben.
  - Geändert in 3.7.0: Auch Boards eigener Teams zählen als zugänglich; zugewiesene Kommentare erscheinen ebenfalls ([REQ-PROJ-004](#req-proj-004-kommentar-als-aufgabe)).
  - Ein Klick öffnet das Board und springt zur Karte (Direktlink `/board/<id>#el=<elementId>`; gilt für jedes Element). Gibt es das Element nicht mehr, erscheint ein Hinweis.
  - Geändert in 4.16.0: Der Bereich „Zu prüfen“ zeigt offene Prüfungen, die auf die Person warten, mit Direktsprung ins Panel ([REQ-COLLAB-018](04-zusammenarbeit.md)). Es erscheint nur, was sie sehen und entscheiden darf: keine privaten Elemente, keine verborgenen Bereiche, keine Boards im Papierkorb, keine Boards, auf denen sie nur ansehen darf. Nach einer Ablehnung wartet die Runde nicht mehr auf die übrigen Prüfenden.

### REQ-PROJ-003 Versionsverlauf
- **Seit:** 3.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Frühere Stände eines Boards sichern, ansehen und wiederherstellen.
- **Akzeptanzkriterien:**
  - Bearbeitende (nicht Betrachter) sehen im Versions-Panel alle Versionen mit Name, Art, Zeitpunkt, Person und Elementanzahl.
  - „Aktuellen Stand sichern“ legt eine benannte Version an. Während das Board bearbeitet wird, entsteht höchstens alle 30 Minuten automatisch eine Version.
  - Je Board bleiben die letzten 20 automatischen, 30 gesicherten und 5 Wiederherstellungs-Versionen erhalten; Boards über 20 MB werden nicht versioniert.
  - „Wiederherstellen“ (mit Rückfrage) sichert zuerst den aktuellen Stand als Version, setzt dann das Board für alle zurück; alle Verbundenen laden neu. Gelingt die Sicherung nicht (z. B. Board zu groß), wird nicht wiederhergestellt. Während des Wiederherstellens werden keine Änderungen angenommen; laufende Abstimmungen und Schätzrunden werden beendet. Der Vorgang steht im Sicherheitsprotokoll.
  - Enthält die Version noch nicht aufgedeckte private Elemente, bleiben diese privat und der private Modus wird wieder aktiviert, damit sie nur gemeinsam aufgedeckt werden.
  - „Als Kopie öffnen“ legt aus einer Version ein neues Board der aufrufenden Person an, ohne private Elemente anderer.
  - Versionen gehören zum Board und werden mit ihm gelöscht. Die Rechte prüft der Server; eine Version lässt sich nur über ihr eigenes Board abrufen.

### REQ-PROJ-004 Kommentar als Aufgabe
- **Seit:** 3.7.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Einen Kommentar einer Person zuweisen, optional mit Fälligkeit – für Feedback, das jemand erledigen soll.
- **Akzeptanzkriterien:**
  - Im Kommentar: „Als Aufgabe zuweisen“ mit Auswahl einer Person mit Bezug zum Board und optionalem Fälligkeitsdatum; ändern und entfernen möglich. Zuweisen dürfen alle ab der Rolle „Kommentieren“.
  - Zuständig sein kann nur, wer mindestens kommentieren darf (sonst Fehlermeldung); der Server prüft das.
  - Die zuständige Person wird benachrichtigt ([REQ-COLLAB-010](04-zusammenarbeit.md)).
  - Erledigt ist die Aufgabe, wenn der Kommentar erledigt ist.
  - Zugewiesene Kommentare tragen am Kommentar-Symbol einen orangefarbenen Punkt, erscheinen im Aufgaben-Panel des Boards und unter „Meine Aufgaben“ auf der Startseite (mit Board, Fälligkeit und Person, die zugewiesen hat). Ein Klick öffnet den Kommentar.

### REQ-PROJ-005 Maßnahmen und Retro-Serien
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Aus einer Notiz, einem Text oder einer Themengruppe wird per „Als Maßnahme festhalten“ eine Karte (grün, Schlagwort „Maßnahme“) mit Titel, verantwortlicher Person (Auswahl aus dem Board oder freier Name) und Fälligkeit.
  - Karten speichern die verantwortliche Person auch als ID; „Meine Aufgaben“ zeigt sie dann genau dieser Person (sonst wie bisher per Name). Der Karten-Dialog bietet dieselbe Auswahl.
  - Panel „Maßnahmen“: alle Maßnahmen des Boards mit Abhaken, Bearbeiten und Sprung zur Karte.
  - „Nächste Retro anlegen“ erzeugt ein neues Board mit der Struktur dieses Boards (ohne Beiträge, Karten, Kommentare, Dateien, Themengruppen) und verknüpft es als Serie. Besitzer übernehmen dabei Team, Freigabe und Mitglieder.
  - Im Rückblick zeigt das Panel die Maßnahmen der vorherigen Retro: abhaken (mit Bearbeitungsrecht dort) oder als offene Maßnahme übernehmen.

### REQ-PROJ-006 Retro-Zusammenfassung
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Zusammenfassung aus Stimmung (Umfragen), Themen mit Stimmen und Beiträgen, Maßnahmen und den Maßnahmen der letzten Retro – als Markdown zum Kopieren, Herunterladen oder Drucken (PDF).
  - Moderierende verschicken sie per E-Mail an die Beteiligten des Boards (höchstens 5-mal je Stunde und Board) oder an den Team-Webhook (REQ-COLLAB-017).

### REQ-PROJ-007 Kanban und Zeitleiste
- **Seit:** 4.4.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Kanban und Zeitleiste zeigen dieselben Karten wie das Board. Änderungen wirken sofort am Element und erscheinen bei allen.
  - Kanban: Spalten nach Status, Verschieben per Ziehen oder Auswahlfeld, neue Spalten. Zeitleiste: Balken von Beginn bis Fälligkeit, Verschieben per Ziehen oder Datumsfeld.
  - Beide Ansichten sind ohne Maus bedienbar.
  - Geändert in 4.15.0: Die Spalten stehen in der Reihenfolge des Boards, Status ohne Spalte dahinter. „Neue Spalte“ legt auf Boards mit Spalten eine echte Spalte rechts neben der letzten an (rückgängig machbar, der Frame wächst mit). Boards ohne Spalten kennen nur Status: Dort ist die neue Spalte als vorläufig gekennzeichnet und bleibt nur mit einer Karte erhalten.
  - Geändert in 4.16.0: Jede Kanban-Spalte hat ein „+“ mit Titelfeld. Enter legt die Karte in der Spalte an und das Feld bleibt für die nächste. Der Spaltenkopf zeigt die Summe der Story Points, soweit sie Zahlen sind. Gäste der Stufe „Beiträge“ sehen das „+“ nicht.
  - Geändert in 4.16.0: Esc im Titelfeld schließt nur das Feld, nicht die Ansicht.

### REQ-PROJ-008 Abgleich mit Jira und Azure DevOps
- **Seit:** 4.4.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Ein Board wird mit einer Abfrage (JQL oder WIQL) verbunden; der Abgleich läuft alle fünf Minuten und auf Knopfdruck.
  - Treffer werden zu Karten. Titel, Beschreibung, Status, Fälligkeit, Priorität und Schlagwörter gehen in beide Richtungen, zuständige Personen nur vom Ticket zur Karte.
  - Ändern sich Karte und Ticket gleichzeitig, gewinnt das Ticket; der Abgleich meldet die Anzahl. Statuswechsel laufen in Jira über erlaubte Übergänge, nicht erreichbare Status werden gemeldet.
  - Karten lassen sich als Ticket anlegen. Kopien sind nicht verbunden. Solange ein Ticket zur Abfrage passt, kehrt eine gelöschte Karte zurück.

### REQ-PROJ-009 Abhängigkeiten zwischen Karten
- **Seit:** 4.16.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Eine Karte nennt, welche Karten ihr im Weg stehen.
- **Akzeptanzkriterien:**
  - „Blockiert durch“ im Kartendialog bietet die sichtbaren Karten des Boards an, weder die Karte selbst noch Karten, die einen Kreis schlössen, auch über mehrere Stufen.
  - Geändert in 4.16.0: Beim Rückgängigmachen bleibt der Bezug einer gelöschten Karte erhalten, auch wenn sie vor ihrem Blockierer ankommt. Der Server merkt sich das bis zum Neustart.
  - Kanban nennt die blockierenden Karten, offene hervorgehoben. Die Zeitleiste zeichnet Pfeile vom Ende der blockierenden zum Beginn der blockierten Karte, rot bei zu frühem Beginn, und nennt die Abhängigkeit auch ohne Pfeil in der Zeile.
  - Der Server prüft das Feld: nur Kennungen sichtbarer Karten, kein Bezug auf sich selbst, keine Kreise, höchstens 50 Einträge. Wer gleichzeitig die Gegenrichtung einträgt, bekommt den geprüften Stand zurück.
  - Gelöschte Karten verschwinden aus Liste und Anzeige. Kommen sie per Rückgängig zurück, gilt der Bezug wieder.
  - Kopien mit Blockierer hängen an dessen Kopie. Im JSON-Backup bleibt das Feld erhalten, beim Import werden die Kennungen umgesetzt.
