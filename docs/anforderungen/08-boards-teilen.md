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
