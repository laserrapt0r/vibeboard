# 04 – Zusammenarbeit in Echtzeit

### REQ-COLLAB-001 Gleichzeitiges Bearbeiten
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Mehrere Personen bearbeiten ein Board gleichzeitig; Änderungen erscheinen bei allen ohne Neuladen.
- **Akzeptanzkriterien:**
  - Änderungen sind bei anderen Teilnehmenden im lokalen Netz in der Regel innerhalb einer Sekunde sichtbar.
  - Konflikte am selben Element werden nach „die letzte Änderung gewinnt“ aufgelöst.
  - Geändert in 4.6.0: Das gilt je Feld, die Reihenfolge legt der Server fest. Siehe [REQ-COLLAB-019](#req-collab-019-gleichzeitige-änderungen-am-selben-element).
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
  - Geändert in 4.0.0:
    - Der Server schickt am Anfang des Streams 2 KB Füllzeichen und sofort eine kurze Startnachricht. Kommt diese nicht innerhalb von 4 Sekunden an, wechselt der Client auf Long-Polling; kommt sie an, wartet er ohne Zeitlimit auf die (bei großen Boards evtl. lange) Begrüßung.
    - Ein Wechsel wegen Zeitüberschreitung wird im Browser 7 Tage lang gemerkt (nicht bei kurzen Verbindungsfehlern); danach wird es erneut mit Server-Sent Events versucht. Kopf, Polster und Startnachricht schickt der Server noch vor dem Laden des Boards. `?transport=sse` erzwingt Server-Sent Events.
  - Polling-Teilnehmende, die eine Minute lang nicht abholen, werden entfernt.

### REQ-COLLAB-003 Wiederverbinden ohne Datenverlust
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Nach einem Verbindungsabbruch verbindet sich der Client automatisch neu und lädt den aktuellen Stand.
  - Noch nicht bestätigte eigene Änderungen (auch Timer, Abstimmung, Umbenennen) werden erneut gesendet und lokal beibehalten.
  - Beim Schließen des Tabs werden ausstehende Änderungen sofort gesendet.
  - Geändert in 4.0.0: Hängen beim Schließen noch Änderungen fest, weil keine Verbindung besteht oder der Server nicht speichern kann, fragt der Browser vor dem Verlassen der Seite nach.

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
  - Geändert in 4.5.0: Beenden und Aufdecken darf nur, wer den Modus gestartet hat, der Besitzer oder die Moderation.
  - Geändert in 4.1.0 – anonymes Sammeln: Beim Start lässt sich „anonym“ wählen (Retro-Ablauf: Standard).
    - Der Platzhalter zeigt dann nur „🔒 Privat“ ohne Namen; der Server speichert zu den Beiträgen keinen Autornamen – auch nach dem Aufdecken und bei späteren Änderungen nicht (Kennzeichen „anonym“).
    - Im Aktivitätsverlauf erscheinen Änderungen an anonymen Beiträgen als „Anonym“.
    - Der eigene Browser meldet bei anonymen Beiträgen weder „… schreibt“ noch die Auswahl an andere.
    - Verdeckte Platzhalter enthalten keine Benutzer-ID, Änderungen im Echtzeitkanal keinen Absender.

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
  - Seit dem letzten Besuch (gemeint ist das Ende des Besuchs; ein erneutes Verbinden innerhalb von 30 Minuten zählt nicht als neuer Besuch): Beim Öffnen zeigt ein Hinweis, wie viele Elemente andere geändert haben; „Anzeigen“ öffnet das Panel, markiert die Elemente auf der Leinwand und springt zu ihnen. Im Panel sind neue Einträge markiert, der letzte Besuch ist als Trenner sichtbar.
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

### REQ-COLLAB-013 Speicherstatus
- **Seit:** 4.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Jederzeit erkennbar, ob alle eigenen Änderungen auf dem Server gespeichert sind.
- **Akzeptanzkriterien:**
  - Anzeige in der Kopfzeile neben dem Board-Namen: „Verbinde …“, „Wird gespeichert …“, „Gespeichert“ (Tooltip mit Uhrzeit), „Offline – n ausstehend“, „Speichern verzögert“; Betrachter sehen „Verbunden“.
  - „Gespeichert“ bedeutet: in der Datenbank angekommen, nicht nur beim Server. Der Server zählt Änderungen je Board (Folgenummer) und meldet nach jedem Schreibvorgang allen Verbundenen den gespeicherten Stand; die Antwort auf eigene Änderungen nennt die Folgenummer, die erreicht sein muss. Lädt der Server das Board neu, beginnt die Zählung erkennbar von vorn (Kennung je Ladevorgang).
  - Schlägt das Schreiben in die Datenbank oder das Senden an den Server fehl, zeigt die Anzeige „Speichern verzögert“, bis ein erneuter Versuch gelingt.
  - „Wird gespeichert …“ erscheint erst nach 400 ms (kein Flackern). Bildschirmleser bekommen nur Störungen und deren Ende angesagt; Animationen entfallen bei „Bewegung reduzieren“. Auf schmalen Bildschirmen bleibt nur der farbige Punkt, außer bei Störungen.

### REQ-COLLAB-014 Ladeanzeigen
- **Seit:** 4.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Board: Die Ladeanzeige steht bereits im HTML (sichtbar, bevor Skripte geladen sind), erscheint aber erst nach 250 ms; nach 4 s ergänzt sie einen Hinweis auf einen möglichen Proxy. Sie verschwindet, sobald der Stand des Boards da ist. Die Leinwand trägt bis dahin `aria-busy`, die Anzeige `role="status"`.
  - Startseite: Platzhalterkarten, bis die Boards geladen sind.
  - Anfragen über `api()`, die länger als 400 ms dauern, zeigen einen schmalen Fortschrittsbalken am oberen Rand; regelmäßige Hintergrundabfragen nicht.

### REQ-COLLAB-015 Reaktionen auf Elemente
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Leichtgewichtige Rückmeldung zu einzelnen Beiträgen, ohne eine formelle Abstimmung zu starten.
- **Akzeptanzkriterien:**
  - Auf Sticky Notes, Karten, Formen, Texten, Bildern, Dateien, Code-Blöcken und Tabellen lassen sich Emojis vergeben (👍 ❤️ 😂 🎉 👏 🤔 🔥 😮 ➕ ✅): über die Kontextleiste, per Rechtsklick (auch als Betrachter) oder durch Klick auf eine vorhandene Reaktion (an/aus).
  - Unter dem Element erscheint je Emoji die Anzahl; der Tooltip nennt die Namen; eigene Reaktionen sind hervorgehoben.
  - Reaktionen ändert nur die eigene Reaktions-Operation auf dem Server (keine Änderung per Element-Update, keine fremden Namen); nur bekannte Emojis, höchstens 200 Personen je Emoji, Ratenbegrenzung.
  - Kopien, Vorlagen und die nächste Retro übernehmen keine Reaktionen.

### REQ-COLLAB-016 Schlagwörter und Filteransicht
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Sticky Notes, Karten und Formen erhalten bis zu acht Schlagwörter (Kontextleiste, Etikett-Symbol; Vorschläge aus dem Board). Auf Sticky Notes erscheinen sie oben links.
  - Der Filter (Trichter-Symbol) blendet nicht passende Elemente ab – nur in der eigenen Ansicht: nach Schlagwort, Farbe, Person (nicht bei anonymen Beiträgen), „nur mit Reaktionen“, „nur Maßnahmen“. Innerhalb einer Gruppe genügt ein Treffer, zwischen Gruppen müssen alle passen.
  - Ein Hinweis zeigt, wie viele Elemente passen, und hebt den Filter mit einem Klick auf.

### REQ-COLLAB-017 Chat-Anbindung per Webhook
- **Seit:** 4.1.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Standardmäßig aus; die Administration schaltet Webhooks ein (und optional interne Ziele).
  - Personen richten im Kontomenü eigene Webhooks für Erwähnungen, Antworten, Zuweisungen und Team-Einladungen ein; Team-Verwaltende für „Board für das Team freigegeben“ und Retro-Zusammenfassungen. Höchstens zehn je Person bzw. Team.
  - Formate: Microsoft Teams (Text und Adaptive Card), Slack/Mattermost/Rocket.Chat, Matrix (Hookshot), allgemeines JSON.
  - Die Adresse wird nach dem Speichern nur gekürzt (Host) angezeigt und nie protokolliert. „Testen“ schickt eine Testnachricht. Nach 20 Fehlern in Folge pausiert ein Webhook, bis ein Test gelingt.
  - Sicherheit: [REQ-SEC-012](11-sicherheit.md).
  - Geändert in 4.3.1: Sind Webhooks abgeschaltet, sind die Menüpunkte für Person und Team deaktiviert.

### REQ-COLLAB-018 Freigaben
- **Seit:** 4.4.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Frames und Dateien lassen sich ausgewählten Personen mit Zugriff auf das Board vorlegen, mit Hinweis und Termin. Gäste, private Inhalte und verborgene Bereiche sind ausgeschlossen.
  - Prüfende brauchen mindestens das Recht zu kommentieren, die Rolle Ansehen reicht nicht; eine Ablehnung braucht eine Begründung. Der Server prüft, wer entscheiden darf.
  - Status: in Prüfung, freigegeben, abgelehnt, geändert nach Freigabe. Eine Freigabe gilt für den geprüften Stand: Ändert sich der Inhalt, auch an Verbindungen, verfällt sie. Kommentare und das Verschieben des Frames ändern den Stand nicht.
  - Prüfende und Anfordernde werden benachrichtigt; Status erscheint live am Element und im Panel „Freigaben“; das Protokoll hält die Entscheidungen fest.
  - Wer angefordert hat und der Besitzer können erneut vorlegen oder entfernen.

### REQ-COLLAB-019 Gleichzeitige Änderungen am selben Element
- **Seit:** 4.6.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Ändern mehrere Personen dasselbe Element fast gleichzeitig, haben danach alle denselben Stand, ohne Neuladen und ohne Sperren.
- **Akzeptanzkriterien:**
  - Der Server legt die Reihenfolge fest und nummeriert jedes Paket. Eigene Änderungen erscheinen sofort; bis zur Bestätigung liegen sie auf dem letzten Stand des Servers auf.
  - Änderungen gehen als einzelne Felder: Ändert eine Person die Farbe und eine andere den Text, bleibt beides erhalten. Am selben Feld gewinnt, was zuletzt beim Server ankommt.
  - Die Reihenfolge, in der Bestätigung und Live-Stream eintreffen, hat keinen Einfluss auf das Ergebnis. Das gilt auch für den Rückfall-Transport.
  - Löschen geht vor gleichzeitiges Bearbeiten. Wer während einer Verbindungsstörung ein Element bearbeitet hat und von der Löschung nichts mitbekommen hat, verliert die Arbeit nicht: Das Element kommt mit diesem Stand zurück. War die Löschung sichtbar, bleibt das Element gelöscht.
  - Scheitern mehrere Pakete nacheinander, setzt sich beim erneuten Senden die jeweils neuere Änderung durch. Eine wiederholte Tabellenänderung wird nur einmal ausgeführt.
  - Bei abgelaufener Sitzung oder Drosselung bleiben eigene Änderungen erhalten und werden erneut gesendet. Lehnt der Server eine Änderung ab, kehrt die Anzeige zum Stand des Servers zurück.
  - Vom Server abgelehnte Änderungen (Sperre, fremde private Elemente, Virenscan) kehren beim Absender zum Stand des Servers zurück.
  - Rechte und Prüfungen gelten für Feldänderungen wie für vollständige Elemente.
  - `npm run test:sync` prüft das mit zufälligen Abläufen und läuft bei jedem Push auf `main` und jedem Pull Request.
