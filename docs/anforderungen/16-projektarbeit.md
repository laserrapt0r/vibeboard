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
  - Aus einer Sticky Note, einem Text oder einer Themengruppe wird per „Als Maßnahme festhalten“ eine Karte (grün, Schlagwort „Maßnahme“) mit Titel, verantwortlicher Person (Auswahl aus dem Board oder freier Name) und Fälligkeit.
  - Karten speichern die verantwortliche Person auch als ID; „Meine Aufgaben“ zeigt sie dann genau dieser Person (sonst wie bisher per Name). Der Karten-Dialog bietet dieselbe Auswahl.
  - Panel „Maßnahmen“: alle Maßnahmen des Boards mit Abhaken, Bearbeiten und Sprung zur Karte.
  - „Nächste Retro anlegen“ erzeugt ein neues Board mit der Struktur dieses Boards (ohne Beiträge, Karten, Kommentare, Dateien, Themengruppen) und verknüpft es als Serie. Besitzer übernehmen dabei Team, Freigabe und Mitglieder.
  - Im Rückblick zeigt das Panel die Maßnahmen der vorherigen Retro: abhaken (mit Bearbeitungsrecht dort) oder als offene Maßnahme übernehmen.

### REQ-PROJ-006 Retro-Zusammenfassung
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Zusammenfassung aus Stimmung (Umfragen), Themen mit Stimmen und Beiträgen, Maßnahmen und den Maßnahmen der letzten Retro – als Markdown zum Kopieren, Herunterladen oder Drucken (PDF).
  - Moderierende verschicken sie per E-Mail an die Beteiligten des Boards (höchstens 5-mal je Stunde und Board) oder an den Team-Webhook (REQ-COLLAB-017).
