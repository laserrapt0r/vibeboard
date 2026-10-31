# 08 – Board-Übersicht, Teilen und Rechte

### REQ-BOARD-001 Board-Übersicht
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - „Meine Boards“ und „Mit mir geteilt“ mit Vorschaubild, Name, letzter Änderung, Anzahl Elemente, Personen online, Freigabe und Mitgliederzahl.
  - Suche, Sortierung (zuletzt bearbeitet, zuletzt erstellt, Name), Aktualisierung alle 30 Sekunden.
  - Aktionen: öffnen, teilen, umbenennen (ab Bearbeiter), duplizieren (Kopie gehört der duplizierenden Person), Link kopieren, löschen (nur Besitzer, mit Rückfrage), Board verlassen (Mitglieder, mit Rückfrage).
  - Geändert in 3.8.0: Die Startseite gliedert sich nach der Navigation links: „+ Neues Board“ (leeres Board, häufige Vorlagen, alle Vorlagen), „Start“ (einklappbare Vorlagenleiste, Hinweis auf fällige Aufgaben, zuletzt bearbeitete Boards), „Meine Aufgaben“ (eigene Seite mit Filtern), Boards, Ordner und Teams. Rechts erscheint nur die gewählte Ansicht; beim Suchen die Suchergebnisse. Die gewählte Ansicht bleibt gespeichert, `/#aufgaben` öffnet die Aufgaben.
  - Geändert in 3.7.2: Die Navigation steht als eigene Spalte links oben (beim Scrollen sichtbar), auf schmalen Bildschirmen als Leiste oben.
  - Geändert in 3.7.0: Navigation links mit „Alle Boards“, „Meine Boards“, „Mit mir geteilt“, eigenen Ordnern und Teams ([REQ-BOARD-007](#req-board-007-teams-und-ordner)); Board-Karten zeigen Team und Ordner; Glocke für Benachrichtigungen. Die zuletzt gewählte Ansicht bleibt erhalten.
  - Geändert in 3.2.0: Beim Duplizieren werden private Elemente anderer Personen nicht mitkopiert ([REQ-COLLAB-009](04-zusammenarbeit.md)). Die Übersicht zeigt zusätzlich „Meine Aufgaben“ ([REQ-PROJ-002](16-projektarbeit.md)).

### REQ-BOARD-002 Besitz und Rollen
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Rollen je Board: Besitzer, Bearbeiter, Betrachter. Administratoren haben Besitzerrechte auf allen Boards.
- **Akzeptanzkriterien:**
  - Betrachter: Board live sehen, abstimmen, Reaktionen, Laserpointer; keine Änderungen (vom Server erzwungen).
  - Bearbeiter: zusätzlich alle Inhalte ändern und umbenennen.
  - Besitzer: zusätzlich teilen, Freigabe ändern, Mitglieder verwalten, löschen.
  - Rechteänderungen wirken sofort: offene Verbindungen der betroffenen Person werden neu aufgebaut.
  - Geändert in 3.7.0 – Rolle „Kommentieren“ zwischen Betrachter und Bearbeiter: wie Betrachter, zusätzlich Kommentare schreiben, beantworten, erledigen und zuweisen sowie Rundgänge aufzeichnen. Wählbar für Mitglieder, für die Link-Freigabe und für Teams. Gilt aus mehreren Quellen eine Rolle (Mitgliedschaft, Team, Link), zählt die höchste. Im Board steht die eigene Rolle als Hinweis neben dem Namen.

### REQ-BOARD-003 Teilen mit Personen
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Einladen per Benutzername oder E-Mail mit Vorschlagsliste (nur aktive, bestätigte Konten; ohne Anzeige fremder E-Mail-Adressen).
  - Geändert in 4.0.0: Eine Suche über alle Konten gibt es nicht mehr (`/api/users/search` entfällt). Eingeladen wird
    - über die vollständige E-Mail-Adresse (genauer Abgleich, höchstens 30 Versuche je Stunde und Person; gibt es kein Konto, wird das gemeldet – seit 4.2.0 mit dem Angebot einer Einladung, [REQ-BOARD-010](#req-board-010-einladung-an-adressen-ohne-konto)) oder
    - aus der Liste der Personen, mit denen die einladende Person ein Team teilt (Name, Farbe und gemeinsame Teams; ohne E-Mail-Adressen). Der Server prüft das gemeinsame Team.
  - Geändert in 4.0.0: Die Mitgliederliste zeigt Namen; E-Mail-Adressen nur dem Besitzer (Namen sind nicht eindeutig) – außer bei Personen, die er aus einem Team kennt, in dem er nicht verwaltet (wie in der Team-Ansicht).
  - Optional Einladungs-Mail mit Link zum Board.
  - Rolle ändern und entfernen; Fehler werden angezeigt, die Auswahl springt dann zurück.

### REQ-BOARD-004 Freigabe per Link
- **Seit:** 2.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Stufen: nur eingeladene Personen, alle angemeldeten Nutzer mit dem Link dürfen ansehen, … dürfen bearbeiten.
  - Geändert in 3.7.0: zusätzlich „… dürfen kommentieren“. Gäste ([REQ-BOARD-006](#req-board-006-gastzugang-per-link)) erhalten über die Link-Freigabe keinen Zugriff.
  - Über einen Link geöffnete Boards erscheinen unter „Mit mir geteilt“, solange die Freigabe besteht.

### REQ-BOARD-005 Speicherung
- **Seit:** 1.0.0, geändert in 2.0.0 (PostgreSQL) · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Jedes Element ist ein eigener Datensatz; Änderungen werden spätestens etwa eine Sekunde nach der letzten Änderung gespeichert.
  - Beim Beenden des Servers werden ausstehende Änderungen gespeichert.
  - Ein fehlerhaftes Element verhindert nicht das Speichern der übrigen.
  - Ein gelöschtes Board kann nicht durch gleichzeitig eintreffende Änderungen wieder entstehen.

### REQ-BOARD-006 Gastzugang per Link
- **Seit:** 3.7.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Beschreibung:** Externe Personen ohne Konto sehen oder kommentieren ein einzelnes Board – befristet und widerrufbar.
- **Akzeptanzkriterien:**
  - Standardmäßig abgeschaltet; ein Admin schaltet den Gastzugang ein und legt die längste Gültigkeit fest ([REQ-ADMIN-010](10-administration.md)).
  - Der Besitzer erstellt im Teilen-Dialog Gastlinks mit Rolle („ansehen“ oder „kommentieren“), Laufzeit (1–30 Tage, höchstens bis zur Grenze der Administration) und Bezeichnung. Der Link wird nur einmal angezeigt; gespeichert wird nur sein Hash. Die Liste zeigt Rolle, Ablauf und Zahl der Gäste; „Sperren“ beendet ihn sofort.
  - Beitritt unter `/g/<Link>`: Board-Name, Rolle und Ablauf werden angezeigt; der Gast gibt einen Namen an und bestätigt den Datenschutzhinweis. Angemeldete Personen werden auf eine direkte Einladung verwiesen.
  - Gäste sehen nur dieses eine Board: keine Startseite, keine anderen Boards (auch nicht per Link-Freigabe), keine Aufgaben, Benachrichtigungen, Teams, Profil- oder Administrationsfunktionen – der Server lehnt alle anderen Schnittstellen ab. Sie erscheinen für andere als „Name (Gast)“.
  - Sperren oder Ablaufen des Links löscht die Gastzugänge samt Sitzungen; verbundene Gäste werden sofort getrennt. Abgeschaltet der Gastzugang, werden alle Links gesperrt. Beiträge der Gäste bleiben mit ihrem Namen erhalten.
  - Anmelden mit Benutzername/Kennwort ist für Gastzugänge nicht möglich; Benutzernamen „gast-…“ sind reserviert. Gäste erscheinen nicht in der Benutzerverwaltung.
  - Missbrauchsschutz: Ratenbegrenzung für Beitritt und Linkerstellung, höchstens 100 Gäste je Link. Abgelaufene Gastzugänge werden spätestens nach einer Minute entfernt und getrennt. Gastlink-Tokens erscheinen nicht im Protokoll.

### REQ-BOARD-007 Teams und Ordner
- **Seit:** 3.7.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Boards in gemeinsamen Bereichen ablegen und Rechte für ganze Teams vergeben.
- **Akzeptanzkriterien:**
  - Teams anlegen dürfen alle angemeldeten Benutzer oder – je nach Administration – nur Admins. Wer ein Team anlegt, verwaltet es.
  - Team-Verwaltende fügen Mitglieder per Benutzername oder E-Mail hinzu, ändern Rollen (Mitglied/Verwaltung), entfernen Mitglieder, benennen um und löschen das Team. Ein Team behält immer mindestens eine verwaltende Person (auch bei gleichzeitigen Änderungen); bestehende Mitglieder werden beim erneuten Hinzufügen nicht umgestuft. Mitglieder können austreten.
  - Der Besitzer ordnet ein Board im Teilen-Dialog einem eigenen Team zu und wählt die Rolle für alle Mitglieder (bearbeiten, kommentieren, ansehen). Änderungen wirken sofort; beim Austritt endet der Zugriff.
  - Ordner: persönliche Ordner (nur für die eigene Person sichtbar, für alle zugänglichen Boards) und Ordner im Team (für alle Mitglieder, nur für Boards des Teams). Je Bereich liegt ein Board in höchstens einem Ordner. Ordner lassen sich umbenennen und löschen; die Boards bleiben erhalten.
  - Startseite: Team-Ansicht mit Mitgliederverwaltung, „Ordner anlegen“ und Ordnern als Filter („Alle“, Ordner, „Ohne Ordner“); Board-Menü „In Ordner verschieben …“.
  - Wird ein Team gelöscht, bleiben die Boards beim Besitzer, sind aber nicht mehr für das Team freigegeben.
  - Geändert in 4.0.0: Mitglieder werden nicht mehr direkt hinzugefügt, sondern eingeladen und müssen annehmen ([REQ-BOARD-008](#req-board-008-einladungen-in-teams)).

### REQ-BOARD-008 Einladungen in Teams
- **Seit:** 4.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Niemand wird ohne Zustimmung Mitglied eines Teams. Ersetzt das direkte Hinzufügen aus [REQ-BOARD-007](#req-board-007-teams-und-ordner).
- **Akzeptanzkriterien:**
  - Team-Verwaltende laden über die vollständige E-Mail-Adresse ein und wählen die Rolle (Mitglied/Verwaltung). Ratenbegrenzung gegen das Ausprobieren von Adressen.
  - Geändert in 4.2.0: Auch Adressen ohne Konto lassen sich einladen ([REQ-BOARD-010](#req-board-010-einladung-an-adressen-ohne-konto)).
  - Die eingeladene Person erhält eine Benachrichtigung (Glocke, live und – sofern nicht abgeschaltet – per E-Mail) und sieht die Einladung auf der Startseite mit „Annehmen“ und „Ablehnen“; in der Navigation zählt ein Eintrag „Einladungen“ die offenen Einladungen.
  - Erst mit der Annahme wird die Person Mitglied mit der eingeladenen Rolle; Ablehnen entfernt die Einladung. Die zugehörige Benachrichtigung gilt danach als gelesen.
  - Team-Verwaltende sehen offene Einladungen (Name, E-Mail-Adresse, Rolle, Zeitpunkt) und können sie zurückziehen; die Benachrichtigung der eingeladenen Person verschwindet dann. Doppelte Einladungen und Einladungen bereits vorhandener Mitglieder werden abgelehnt.
  - Mitglieder sehen die E-Mail-Adressen anderer Mitglieder nicht, Team-Verwaltende schon (zur Unterscheidung gleichnamiger Personen).
  - Wird ein Team oder ein Konto gelöscht, verschwinden auch die Einladungen.

### REQ-BOARD-009 Papierkorb
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Löschen legt ein Board in den Papierkorb: Es ist sofort für alle unzugänglich (offene Verbindungen werden getrennt) und erscheint in keiner Liste mehr.
  - Der Besitzer sieht seine gelöschten Boards unter „Papierkorb“ mit Restlaufzeit, kann sie wiederherstellen (auch per „Rückgängig“ direkt nach dem Löschen) oder endgültig löschen.
  - Nach Ablauf der Frist (Standard 30 Tage, einstellbar 1–365) werden sie automatisch endgültig gelöscht.
  - Löschen, Wiederherstellen und endgültiges Löschen erscheinen im Sicherheitsprotokoll.
  - Geändert in 4.3.0: Der Papierkorb zeigt das Vorschaubild des Boards; nur für Besitzer und Administration abrufbar.

### REQ-BOARD-010 Einladung an Adressen ohne Konto
- **Seit:** 4.2.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Boards und Teams lassen sich auch mit Personen teilen, die noch kein Konto haben.
- **Akzeptanzkriterien:**
  - Gibt es zur eingegebenen Adresse kein Konto, erscheint zuerst ein Hinweis mit der Frage, ob eine Einladung verschickt werden soll. Ohne Bestätigung geht keine E-Mail hinaus.
  - Die Einladungsmail nennt, wer das Board „xy“ teilen möchte (bzw. in welches Team eingeladen wird), und führt über einen Link zur Registrierung; Sprache: die der einladenden Person. Die Einladung gilt 30 Tage.
  - Die Registrierung über den Link zeigt die Einladung, füllt die Adresse vor und braucht keine zweite Bestätigung (der Link beweist den Zugriff auf das Postfach). Danach ist die Person angemeldet und das Board mit der gewählten Rolle geteilt bzw. sie ist Mitglied des Teams. Nur der Link gilt als Annahme einer Team-Einladung.
  - Registriert sich die Person ohne den Link oder wird die Adresse später bestätigt (auch bei geänderter Adresse oder vom Admin angelegtem Konto, spätestens bei der Anmeldung), wird die Einladung ebenfalls eingelöst: Boards sind geteilt, Teams erscheinen als normale Einladung zum Annehmen.
  - Die Regeln der Registrierung gelten: Keine Einladung, wenn sie geschlossen ist oder der Mailversand fehlt; gesperrte und Wegwerf-Adressen werden abgelehnt; bei „mit Freigabe“ muss ein Admin das Konto danach freischalten.
  - Besitzer bzw. Team-Verwaltende sehen offene Einladungen und können sie zurückziehen. Erneutes Einladen erzeugt einen neuen Link. Grenzen: 20 Einladungen je Stunde und Person, 5 je Tag und Adresse.
