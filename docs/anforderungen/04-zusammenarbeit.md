# 04 – Zusammenarbeit in Echtzeit

### REQ-COLLAB-001 Gleichzeitiges Bearbeiten
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Mehrere Personen bearbeiten ein Board gleichzeitig; Änderungen erscheinen bei allen ohne Neuladen.
- **Akzeptanzkriterien:**
  - Änderungen sind bei anderen Teilnehmenden im lokalen Netz in der Regel innerhalb einer Sekunde sichtbar.
  - Konflikte am selben Element werden nach „die letzte Änderung gewinnt“ aufgelöst.
  - Geändert in 3.7.0: Kommentare werden nicht mehr als ganzes Element überschrieben, sondern über eigene Operationen geändert ([REQ-ELEM-014](02-elemente.md)).
  - Geändert in 3.5.0: Bei Tabellen gilt das je Zelle. Änderungen an verschiedenen Zellen gehen nicht verloren, und eingefügte oder gelöschte Zeilen und Spalten verschieben die Zellen anderer Personen korrekt (REQ-ELEM-009).
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

### REQ-COLLAB-010 Benachrichtigungen
- **Seit:** 3.7.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Wer in einem Kommentar erwähnt wird, eine Antwort erhält oder einen Kommentar zugewiesen bekommt, erfährt davon – auch wenn er das Board gerade nicht geöffnet hat.
- **Akzeptanzkriterien:**
  - Auslöser: @Erwähnung, neue Antwort in einem Thread, in dem man geschrieben hat oder zuständig ist, Zuweisung eines Kommentars. Die handelnde Person selbst wird nie benachrichtigt; benachrichtigt werden nur Personen mit Zugriff auf das Board.
  - Eine Glocke mit Zähler ungelesener Hinweise steht auf der Startseite und im Board. Die Liste zeigt Person, Art, Ausschnitt, Board und Zeitpunkt; ein Klick springt zum Kommentar (im selben Board ohne Neuladen) und markiert den Hinweis als gelesen; „Alle als gelesen markieren“.
  - Ist die Person gerade verbunden, erscheint der Hinweis sofort (auch über den Long-Polling-Rückfall) mit „Öffnen“.
  - Öffnen eines Kommentars markiert alle Hinweise zu ihm als gelesen.
  - E-Mail: nur wenn in der Administration erlaubt, im eigenen Profil nicht abgeschaltet, ein Mailserver eingerichtet ist und die Person gerade nicht im Board ist; höchstens eine E-Mail je Person und Board in zehn Minuten.
  - Gäste erhalten keine Benachrichtigungen. Hinweise werden nach 90 Tagen gelöscht.

### REQ-COLLAB-011 Aktivitätsverlauf
- **Seit:** 3.7.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Nachvollziehen, wer was geändert hat – besonders bei asynchroner Zusammenarbeit.
- **Akzeptanzkriterien:**
  - Erfasst werden Erstellen, Ändern und Löschen von Elementen, Kommentieren, Erledigen und Wiedereröffnen, Zuweisen, Umbenennen des Boards, Aufdecken des privaten Modus, Wiederherstellen einer Version und Aufzeichnungen – mit Person, Zeitpunkt, Art des Elements und kurzem Textausschnitt.
  - Mehrere Änderungen derselben Person am selben Element innerhalb von fünf Minuten werden zu einem Eintrag mit Zähler zusammengefasst.
  - Private Elemente erscheinen erst nach dem Aufdecken (als ein Eintrag „hat aufgedeckt“).
  - Panel „Aktivität“ (für alle mit Zugriff, auch Gäste): neueste zuerst, „Ältere laden“, ein Klick springt zum Element bzw. öffnet den Kommentar; gelöschte Elemente melden einen Hinweis.
  - Seit dem letzten Besuch (ein erneutes Verbinden innerhalb von 30 Minuten zählt nicht als neuer Besuch): Beim Öffnen zeigt ein Hinweis, wie viele Elemente andere geändert haben; „Anzeigen“ öffnet das Panel, markiert die Elemente auf der Leinwand und springt zu ihnen. Im Panel sind neue Einträge markiert, der letzte Besuch ist als Trenner sichtbar.
  - Einträge werden nach 90 Tagen gelöscht, höchstens 2000 je Board.

### REQ-COLLAB-012 Geführte Aufzeichnungen (Rundgänge)
- **Seit:** 3.7.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Beschreibung:** Ein Board ohne Termin erklären: Ansicht, Mauszeiger und Laserpointer werden aufgezeichnet, auf Wunsch mit Ton.
- **Akzeptanzkriterien:**
  - Aufzeichnen dürfen alle ab der Rolle „Kommentieren“; vor dem Start Titel und Wahl „mit Ton“. Ohne Mikrofonzugriff wird ohne Ton aufgezeichnet.
  - Während der Aufnahme: Leiste mit Laufzeit, „Beenden & speichern“ und „Verwerfen“. Nach der in der Administration festgelegten Höchstdauer (Standard 10 Minuten) endet die Aufnahme automatisch.
  - Der Server nimmt nur bekannte Ereignisarten mit Zahlenwerten an, prüft Dauer und Größe, das Tonformat (WebM, Ogg, MP4 anhand der Dateikennung) und scannt die Tonspur auf Schadsoftware.
  - Abspielen (für alle mit Zugriff, auch Gäste): Ansicht folgt der Aufzeichnung, der Zeiger erscheint mit Namen, Laserspuren werden gezeichnet, Ton läuft synchron. Pause, Vorspulen per Regler, „Ansicht folgen“ (eigenes Verschieben beendet das Folgen), Esc schließt.
  - Löschen dürfen die aufzeichnende Person und der Besitzer. Andere Teilnehmende sehen neue oder gelöschte Aufzeichnungen sofort in der Liste.
