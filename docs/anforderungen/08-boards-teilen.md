# 08 – Board-Übersicht, Teilen und Rechte

### REQ-BOARD-001 Board-Übersicht
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - „Meine Boards“ und „Mit mir geteilt“ mit Vorschaubild, Name, letzter Änderung, Anzahl Elemente, Personen online, Freigabe und Mitgliederzahl.
  - Suche, Sortierung (zuletzt bearbeitet, zuletzt erstellt, Name), Aktualisierung alle 30 Sekunden.
  - Aktionen: öffnen, teilen, umbenennen (ab Bearbeiter), duplizieren (Kopie gehört der duplizierenden Person), Link kopieren, löschen (nur Besitzer, mit Rückfrage), Board verlassen (Mitglieder, mit Rückfrage).

### REQ-BOARD-002 Besitz und Rollen
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Rollen je Board: Besitzer, Bearbeiter, Betrachter. Administratoren haben Besitzerrechte auf allen Boards.
- **Akzeptanzkriterien:**
  - Betrachter: Board live sehen, abstimmen, Reaktionen, Laserpointer; keine Änderungen (vom Server erzwungen).
  - Bearbeiter: zusätzlich alle Inhalte ändern und umbenennen.
  - Besitzer: zusätzlich teilen, Freigabe ändern, Mitglieder verwalten, löschen.
  - Rechteänderungen wirken sofort: offene Verbindungen der betroffenen Person werden neu aufgebaut.

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
  - Über einen Link geöffnete Boards erscheinen unter „Mit mir geteilt“, solange die Freigabe besteht.

### REQ-BOARD-005 Speicherung
- **Seit:** 1.0.0, geändert in 2.0.0 (PostgreSQL) · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Jedes Element ist ein eigener Datensatz; Änderungen werden spätestens etwa eine Sekunde nach der letzten Änderung gespeichert.
  - Beim Beenden des Servers werden ausstehende Änderungen gespeichert.
  - Ein fehlerhaftes Element verhindert nicht das Speichern der übrigen.
  - Ein gelöschtes Board kann nicht durch gleichzeitig eintreffende Änderungen wieder entstehen.
