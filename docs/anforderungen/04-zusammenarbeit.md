# 04 – Zusammenarbeit in Echtzeit

### REQ-COLLAB-001 Gleichzeitiges Bearbeiten
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Mehrere Personen bearbeiten ein Board gleichzeitig; Änderungen erscheinen bei allen ohne Neuladen.
- **Akzeptanzkriterien:**
  - Änderungen sind bei anderen Teilnehmenden im lokalen Netz in der Regel innerhalb einer Sekunde sichtbar.
  - Konflikte am selben Element werden nach „die letzte Änderung gewinnt“ aufgelöst.
  - Nur angemeldete Personen mit mindestens Leserecht erhalten den Echtzeitkanal; Änderungen erfordern Schreibrecht (Prüfung auf dem Server).

### REQ-COLLAB-002 Echtzeit ohne WebSockets, mit Rückfalloption
- **Seit:** 1.0.0 (Server-Sent Events), 3.0.0 (Long-Polling-Rückfall) · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Die Echtzeit-Übertragung darf keine WebSockets voraussetzen und muss auch in Netzen funktionieren, in denen Streams blockiert oder gepuffert werden.
- **Akzeptanzkriterien:**
  - Standard: Server-Sent Events für Server→Client, gebündelte HTTP-POSTs für Client→Server.
  - Erhält der Client innerhalb von 8 Sekunden keine Begrüßung oder scheitert der Stream zweimal ohne Verbindung, wechselt er automatisch auf Long-Polling (`/api/boards/:id/poll`, Antwort spätestens nach 25 s).
  - `?transport=poll` erzwingt Long-Polling (Test).
  - Polling-Teilnehmende, die eine Minute lang nicht abholen, werden entfernt.

### REQ-COLLAB-003 Wiederverbinden ohne Datenverlust
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Nach einem Verbindungsabbruch verbindet sich der Client automatisch neu und lädt den aktuellen Stand.
  - Noch nicht bestätigte eigene Änderungen (auch Timer, Abstimmung, Umbenennen) werden erneut gesendet und lokal beibehalten.
  - Beim Schließen des Tabs werden ausstehende Änderungen sofort gesendet.

### REQ-COLLAB-004 Präsenz
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Avatare aller Teilnehmenden; Mauszeiger anderer mit Namen in deren Farbe (inaktive verblassen nach 8 s).
  - Die Auswahl anderer wird in deren Farbe umrandet.
  - Hinweis beim Betreten und Verlassen eines Boards.
  - Geändert in 3.2.0:
    - An der Auswahl anderer steht deren Name; bearbeitet jemand gerade einen Text, steht dort „✎ Name schreibt …“.
    - Liegt der Mauszeiger einer Person außerhalb der eigenen Ansicht, zeigt ein Pfeil mit Namen am Bildschirmrand die Richtung; ein Klick springt dorthin.
    - Wechselt jemand in einen anderen Tab, gilt die Person als abwesend: Avatar verblasst, Zeiger und Auswahl werden ausgeblendet.
    - Die Ansichten der anderen erscheinen als farbige Rahmen in der Minimap.
    - „Mauszeiger anderer ausblenden“ (Einstellungen) blendet fremde Zeiger für die eigene Ansicht aus; die Einstellung bleibt gespeichert.

### REQ-COLLAB-005 Folgen und Zusammenholen
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - „Folgen“ übernimmt fortlaufend die Ansicht einer anderen Person; eigenes Verschieben oder Zoomen beendet das Folgen.
  - „Alle zu mir holen“ setzt die Ansicht aller Teilnehmenden einmalig auf die eigene.
  - Geändert in 3.2.0: „Alle folgen mir“ lässt alle Teilnehmenden fortlaufend der eigenen Ansicht folgen (z. B. für Moderation), bis sie selbst verschieben oder zoomen.

### REQ-COLLAB-006 Reaktionen und Laserpointer
- **Seit:** 1.0.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - 8 Emoji-Reaktionen, die bei allen kurz aufsteigend angezeigt werden.
  - Laserpointer mit verblassender Spur, für alle sichtbar; auch für Betrachter verfügbar.

### REQ-COLLAB-007 Hinweis auf neue Version
- **Seit:** 3.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Wird der Server während einer offenen Sitzung aktualisiert, erhält die Sitzung einen Hinweis.
- **Akzeptanzkriterien:**
  - Nach dem Wiederverbinden mit einer anderen Serverversion erscheint „vibeboard wurde auf Version x aktualisiert – Neu laden“.

### REQ-COLLAB-008 Cursor-Chat
- **Seit:** 3.2.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Beschreibung:** Kurze, flüchtige Nachrichten direkt am eigenen Mauszeiger – ohne Kommentar anzulegen.
- **Akzeptanzkriterien:**
  - Die Taste `/` öffnet ein Eingabefeld am Mauszeiger; der Text (höchstens 120 Zeichen) erscheint während des Tippens bei allen anderen in einer Sprechblase an diesem Zeiger.
  - Enter sendet und schließt das Feld; die Nachricht verschwindet nach etwa 6 Sekunden. Esc schließt das Feld und entfernt die Nachricht sofort.
  - Nachrichten werden nicht gespeichert und immer als reiner Text dargestellt.
  - Auch Betrachter können den Cursor-Chat verwenden. Signale anderer Teilnehmender (Zeiger, Auswahl, Chat usw.) werden vor der Anzeige auf gültige Werte geprüft; „Alle zu mir holen“ und „Alle folgen mir“ dürfen nur Bearbeitende auslösen.

### REQ-COLLAB-009 Privater Modus
- **Seit:** 3.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Ideen zunächst unabhängig voneinander sammeln, ohne sich gegenseitig zu beeinflussen – und dann gemeinsam aufdecken.
- **Akzeptanzkriterien:**
  - Bearbeitende starten und beenden den Modus für alle (Augen-Symbol oben rechts); ein Hinweisbalken zeigt, wer ihn gestartet hat und wie viele eigene bzw. verdeckte Elemente es gibt.
  - Während der Modus aktiv ist, sind neu angelegte Notizen, Texte, Karten, Formen, Code-Blöcke, Tabellen und Bilder nur für die erstellende Person lesbar. Alle anderen sehen an derselben Stelle einen verdeckten Platzhalter mit „🔒 Privat · Name“.
  - Der Server gibt Inhalte privater Elemente an niemanden sonst heraus – weder im Echtzeitkanal noch über Aufgabenlisten, Duplikate, Versionskopien oder Vorschaubilder.
  - Fremde private Elemente lassen sich weder auswählen noch verschieben, bearbeiten, kopieren oder löschen – auch nicht beim Verschieben eines Frames oder über Rückgängig (Prüfung auf dem Server; abgelehnte Änderungen werden beim Absender zurückgenommen).
  - Per Rückgängig wiederhergestellte, zuvor öffentliche Elemente werden nicht privat.
  - Solange der Modus aktiv ist, werden keine Vorschaubilder hochgeladen. Startet jemand eine Schätzrunde für eine private Karte, bleibt deren Titel für andere verborgen.
  - „Aufdecken & beenden“ macht alle privaten Elemente sofort für alle sichtbar.
