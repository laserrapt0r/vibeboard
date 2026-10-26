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

### REQ-COLLAB-005 Folgen und Zusammenholen
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - „Folgen“ übernimmt fortlaufend die Ansicht einer anderen Person; eigenes Verschieben oder Zoomen beendet das Folgen.
  - „Alle zu mir holen“ setzt die Ansicht aller Teilnehmenden einmalig auf die eigene.

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
