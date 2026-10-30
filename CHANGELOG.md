# Änderungsprotokoll

Alle nennenswerten Änderungen an vibeboard. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/) (siehe
[REQ-OPS-001](docs/anforderungen/14-betrieb-versionierung.md)).

## [4.0.1] – 2026-10-30

### Behoben
- Anmeldung (REQ-AUTH-005): Wer sich wie früher mit dem Benutzernamen anmeldet, erhielt nur „Benutzername oder
  Kennwort ist falsch“. Jetzt erklärt die Meldung, dass die E-Mail-Adresse gilt; das Anmeldeformular weist ebenfalls
  darauf hin. Die Meldung hängt nur von der Eingabe ab (mit oder ohne „@“) und verrät nicht, ob ein Konto existiert.

## [4.0.0] – 2026-10-30

Inkompatible Änderungen: Anmeldung nur noch per E-Mail-Adresse, Teams nur noch per Einladung, keine Personensuche
mehr. Schemaversion 6.

### Hinzugefügt
- **Speicherstatus** in der Kopfzeile des Boards (REQ-COLLAB-013): „Gespeichert“ erst, wenn alle eigenen Änderungen in
  der Datenbank angekommen sind; außerdem „Wird gespeichert …“, „Offline – n ausstehend“, „Speichern verzögert“.
  Warnung vor dem Verlassen der Seite, solange Änderungen offline feststecken.
- **Ladeanzeigen** (REQ-COLLAB-014): Ladeanzeige beim Öffnen eines Boards (verzögert, mit Proxy-Hinweis nach 4 s),
  Platzhalter auf der Startseite, Fortschrittsbalken für längere Anfragen.
- **Einladungen in Teams** (REQ-BOARD-008): Team-Verwaltende laden per E-Mail-Adresse ein; Mitglied wird man erst
  durch Annehmen (Startseite, Glocke, E-Mail). Offene Einladungen lassen sich zurückziehen.
- Teilen aus der Liste der Personen, mit denen man ein Team teilt (REQ-BOARD-003).
- `TRUST_PROXY` akzeptiert die Anzahl der Proxys oder eine Liste von Proxy-Adressen/Netzen; Hinweis in der
  Administration, wenn Anfragen mit einer Docker-Gateway-Adresse ankommen (REQ-SEC-008). README-Abschnitt
  „Echte IP-Adressen im Protokoll“.
- `ADMIN_NAME` für den beim Start angelegten Administrator.

### Geändert
- **Anmeldung nur mit E-Mail-Adresse** (REQ-AUTH-005). Der bisherige Benutzername ist jetzt ein frei wählbarer,
  nicht eindeutiger Anzeigename (REQ-AUTH-001, REQ-AUTH-008); vorhandene Konten behalten ihren Namen. Konten ohne
  E-Mail-Adresse können sich übergangsweise mit ihrem (eindeutigen) Namen anmelden und werden gebeten, eine Adresse zu
  ergänzen. Registrierung, Profil und Administration fragen „Name“ und E-Mail-Adresse ab.
- **@Erwähnungen** über den Namen; ausgewählte Personen werden per ID mitgeschickt, damit gleichnamige Personen
  unterscheidbar bleiben.
- Boards teilen nur noch per vollständiger E-Mail-Adresse oder aus den eigenen Teams; die Mitgliederliste zeigt
  E-Mail-Adressen nur dem Besitzer.
- Echtzeit-Verbindung hinter puffernden Proxys (REQ-COLLAB-002): 2 KB Füllzeichen und Startnachricht am Anfang des
  Streams (noch vor dem Laden des Boards), Wechsel auf Long-Polling nach 4 statt 8 Sekunden; bleibt der Stream
  stumm, merkt sich der Browser den Wechsel 7 Tage lang (kurze Störungen wie ein Server-Neustart zählen nicht).
- Der beim Start angelegte Administrator braucht `ADMIN_EMAIL` (ohne Adresse wird keiner angelegt) und wird nur noch
  angelegt, solange es keinen aktiven Administrator gibt – so entsteht nach einer Adressänderung kein zweiter Admin.
- Ungültige Einträge in `TRUST_PROXY` werden mit Warnung übersprungen.

### Behoben
- Boards aus Vorlagen, Importen und Kopien bekamen erst nach der ersten Änderung ein Vorschaubild (REQ-IO-004).
- Schriftgrößen-Auswahl von Sticky Notes ohne gesetzte Größe zeigte „undefined“ statt „Auto“.

### Entfernt
- Personensuche `/api/users/search` und direktes Hinzufügen zu Teams (`POST /api/teams/:id/members`).

### Sicherheit
- Keine Suche mehr, über die sich die Konten einer Installation abfragen lassen; Einladungen per E-Mail-Adresse sind
  ratenbegrenzt.
- Die Mitgliederliste eines Boards zeigt E-Mail-Adressen von Personen aus gemeinsamen Teams nur, wenn man das Team
  verwaltet (wie die Team-Ansicht).
- `X-Forwarded-For` wird von rechts ausgewertet; bei einer Liste vertrauenswürdiger Proxys nur, wenn die Anfrage
  wirklich von einem davon kommt.

## [3.8.1] – 2026-10-27

### Geändert
- Virenscan (REQ-UPL-005): Jedes Prüfergebnis wird protokolliert – sauber, aus dem Zwischenspeicher, Fund,
  falscher Dateityp, ohne Scanner abgelehnt bzw. angenommen, Scannerausfall – mit Dateiart, Größe, Kurz-Hash, Dauer und
  Benutzer-ID. Bisher erschienen nur Funde und Ausfälle.
- Sicherheitsprotokoll: abgelehnte Dateitypen und bei Scannerausfall ungeprüft angenommene Dateien werden erfasst;
  Bezeichnungen für Gastlink-Ereignisse ergänzt. Die Administration zeigt ungeprüft angenommene Uploads (30 Tage).

## [3.8.0] – 2026-10-27

### Geändert
- Startseite neu gegliedert (REQ-BOARD-001): Die linke Spalte ist die zentrale Navigation, rechts erscheint nur die
  gewählte Ansicht.
  - Oben links „+ Neues Board“ mit leerem Board, häufigen Vorlagen und „Alle Vorlagen …“ – von jeder Ansicht aus.
  - **Start:** einklappbare, einzeilige Vorlagenleiste, Hinweis auf überfällige bzw. bald fällige Aufgaben und die
    zuletzt bearbeiteten Boards.
  - **Meine Aufgaben** als eigene Seite mit Filtern (offen, überfällig, erledigt, alle); die Zahl offener bzw.
    überfälliger Aufgaben steht in der Navigation.
  - Boards, Ordner und Teams zeigen nur noch ihre Board-Liste. Beim Suchen erscheinen immer die Suchergebnisse.

## [3.7.2] – 2026-10-27

### Geändert
- Startseite: Die Navigation (Alle, Meine, Geteilt, Ordner, Teams) steht als eigene Spalte links oben und bleibt beim
  Scrollen sichtbar, statt erst unter Vorlagen und Aufgaben zu erscheinen. Nach einer Auswahl scrollt die Seite zur
  Board-Liste, falls sie nicht im Blick ist. Auf schmalen Bildschirmen ist sie eine Leiste oben.

## [3.7.1] – 2026-10-27

### Behoben
Gefunden von vier Prüf-Agenten (Board-Oberfläche, Startseite und Verwaltung, Server-Logik, Regressionen):
- **Kommentare:**
  - Antwortete jemand, verlor das eigene Kommentarfeld den Fokus. Weitere Tasten wirkten als Board-Kürzel; die
    Rücktaste konnte den ganzen Thread löschen. Gleiches galt für die Personenauswahl beim Zuweisen.
  - Gleichzeitiges Zuweisen und Antworten konnte Antworten verlieren oder gelöschte Kommentare zurückbringen.
  - „Kommentar hier“ im Kontextmenü legte keinen Kommentar an.
  - Strg+L sperrte Kommentare nur lokal.
  - Ein angefangener Kommentar ging beim Wiederverbinden verloren.
  - Löschen über das Kommentarfenster entfernte keine Stimmen und ließ sich nicht rückgängig machen.
  - Ein Fehler beim Benachrichtigen meldete den bereits gespeicherten Beitrag als gescheitert.
- **Kopieren und Importieren:**
  - Beim Kopieren, Duplizieren (Strg+D) und JSON-Import ins Board verschwanden Kommentare ohne Hinweis. Sie werden
    jetzt bewusst nicht übernommen, wie beim Export, und das wird angezeigt.
  - Board duplizieren und „Version als Board“ übernahmen Zuweisungen und Moderationssperren.
- **Aktivitätsverlauf:**
  - „Ältere laden“ übersprang Einträge und wurde nach 15 Sekunden zurückgesetzt.
  - Mehrere Beiträge und Aufzeichnungen wurden falsch zusammengefasst.
  - Beim Beenden des Servers ging der Puffer verloren.
  - „Letzter Besuch“ ist jetzt das Ende des Besuchs.
- **Moderation:** Bei gesperrtem Bearbeiten ließen sich Timer, Abstimmung und privater Modus weiter bedienen und liefen
  nur lokal.
- **Startseite und Teilen:**
  - Die Startseite übernahm Änderungen aus dem Teilen-Dialog erst nach 30 Sekunden.
  - Ein gelöschter Team-Ordner hinterließ eine leere Ansicht.
  - Teams, in denen man nicht Mitglied ist, erschienen als Abzeichen.
  - „Aus meiner Liste entfernen“ fehlte bei manchen Boards.
  - Nach dem Herabstufen der eigenen Rolle im Team blieben Verwaltungsknöpfe stehen.
  - Sehr lange Namen sprengten das Layout.
- **Gäste:**
  - In der Board-Kopfzeile stand „nullnull“.
  - Die Laufzeiten für Gastlinks ignorierten die Grenze der Administration.
  - Ein erneuter Aufruf des Links legte ein zweites Gastkonto an.
  - Beim Wechsel des Gastlinks blieb das alte Gastkonto bestehen.
  - Die Beitrittsseite enthielt einen Grammatikfehler.
- **Profil:**
  - Konten ohne E-Mail-Adresse konnten ihr Profil nicht speichern.
  - Ein Mailfehler hinterließ einen halb gespeicherten Zustand.
- **Benutzer löschen:** Teams ohne verwaltende Person werden an das dienstälteste Mitglied übergeben, leere Teams
  entfernt.
- **Darstellung:**
  - Ein ausgeblendeter Hinweis mit Knopf fing Klicks auf der Leinwand ab.
  - Auf schmalen Bildschirmen passte der Player nicht ins Fenster, und das Moderationsbanner verdeckte Knöpfe.
  - Lange Hinweistexte brachen nicht um.
- **Sonstiges:**
  - Aufzeichnungen sind auf 100 je Board begrenzt.
  - Gäste erhalten keine gespeicherten Benachrichtigungen mehr, die sie nie lesen könnten.

## [3.7.0] – 2026-10-27

### Hinzugefügt
- **Benachrichtigungen** (REQ-COLLAB-010): Glocke auf der Startseite und im Board für @Erwähnungen, Antworten in
  eigenen Threads und zugewiesene Kommentare – live im Board, optional per E-Mail (höchstens eine je Board alle zehn
  Minuten, nur wenn man gerade nicht im Board ist, im Profil abschaltbar).
- **Aktivitätsverlauf** (REQ-COLLAB-011): wer hat wann was geändert, zusammengefasst je Person und Element; Hinweis und
  Markierung der Änderungen anderer seit dem letzten Besuch.
- **Rolle „Kommentieren“** (REQ-BOARD-002) für Mitglieder, Link-Freigabe und Teams.
- **Moderationsrechte** (REQ-MOD-005): Bearbeiten für Teilnehmende sperren, Timer/Abstimmung/Schätzrunde/privaten Modus
  den Moderierenden vorbehalten, Elemente für Teilnehmende sperren, weitere Moderierende ernennen.
- **Kommentar als Aufgabe** (REQ-PROJ-004) mit Zuständigkeit und Fälligkeit; erscheint im Aufgaben-Panel und unter
  „Meine Aufgaben“.
- **Gastzugang per Link** (REQ-BOARD-006): befristet, nur ansehen oder kommentieren, sperrbar; standardmäßig
  abgeschaltet.
- **Teams und Ordner** (REQ-BOARD-007): Boards für ganze Teams freigeben, persönliche Ordner und Ordner im Team,
  neue Navigation auf der Startseite.
- **Rundgänge aufzeichnen** (REQ-COLLAB-012): Ansicht, Zeiger und Laserpointer, optional mit Ton; Abspielen mit
  Folgen, Pause und Vorspulen.
- Administration: Bereich „Zusammenarbeit“ (REQ-ADMIN-010); Übersicht zählt Teams und Gäste.
- Datenschutz-Vorlage: Aktivitätsverlauf, Benachrichtigungen, Teams, Aufzeichnungen, Gastzugang.

### Geändert
- Kommentare werden über eigene Server-Operationen geschrieben, beantwortet, erledigt, zugewiesen und gelöscht. Der
  Server legt Autor und Zeitpunkt fest; ein gleichzeitiges Verschieben kann keine Antworten mehr überschreiben. Beim
  Tippen von „@“ erscheint eine Vorschlagsliste.
- Ein neuer Kommentar wird erst mit dem ersten Beitrag gespeichert.
- Sicherheits-Header: `media-src 'self' blob:` und `microphone=(self)` für Rundgänge mit Ton.
- Datenbank-Migration 5 (neue Tabellen, Rollen „commenter“ und „guest“). Bestehende Daten bleiben unverändert.

### Sicherheit
- Unabhängiger Review der neuen Rechte vor der Veröffentlichung; dabei geschlossen:
  - Kommentare lassen sich nicht mehr per normaler Änderung anlegen, fälschen oder umschreiben.
  - Moderationssperren gelten auch für das Wiederherstellen von Versionen, das Umbenennen über die Übersicht und
    für gesperrte Kommentare.
  - Die letzte Team-Verwaltung kann sich nicht versehentlich herabstufen.
  - Gäste erhalten keine Anmeldenamen anderer Personen; die Personenliste gibt es erst ab der Rolle „Kommentieren“.
  - Kommentar-Threads sind begrenzt, Kommentare ratenbegrenzt; Gastlink-Tokens werden im Protokoll maskiert.
- Abstimmungen: Element-IDs wie `toString` können keine Eigenschaften des Objekt-Prototyps mehr verändern.

## [3.6.0] – 2026-10-27

### Hinzugefügt
- Über 30 neue Formen (REQ-ELEM-003), alle als eigene Zeichnungen:
  - Flussdiagramm: mehrere Dokumente, manuelle Eingabe und Tätigkeit, Anzeige, interner Speicher, Seitenverweis.
  - UML: Klasse mit Abschnitten (Trennzeile „--“), Knoten, Start- und Endzustand, Gabelung/Vereinigung, Signale.
  - BPMN: Start-, Zwischen- und Endereignis, exklusives, paralleles und inklusives Gateway.
  - Netzwerk & Rechenzentrum: Router, Switch, Load Balancer, WLAN-Access-Point, Internet, Serverschrank, Speichersystem,
    Arbeitsplatz-PC, Smartphone/Tablet, Benutzergruppe; dazu Dienst/Konfiguration und Sicherheit.
  - Container-Plattform (z. B. Kubernetes): Pod, Deployment, Service, Ingress, Node, ConfigMap, Secret, Volume.
  - Herstellersymbole und Logos (etwa von Cisco oder Kubernetes) werden bewusst nicht nachgebildet.
- Neue Vorlagen (REQ-TPL-001):
  - Kategorie UML: Klassen-, Anwendungsfall-, Aktivitäts-, Zustands-, Komponenten- und Verteilungsdiagramm.
  - Kategorie IT-Infrastruktur: Netzwerkplan, Rack-Belegung, Container-Plattform (Cluster).
  - IT-Service-Management: Prozessmodell (BPMN) für die Störungsbearbeitung.

### Geändert
- Die Formenauswahl ist in sieben Gruppen gegliedert; neue Formen erhalten passende Standardgrößen.
- Das Sequenzdiagramm steht jetzt in der Kategorie UML.

### Entfernt
- Neon-Design (eingeführt in 3.5.0). Wer es gewählt hatte, erhält automatisch das dunkle Design.

## [3.5.0] – 2026-10-26

### Hinzugefügt
- Tabellen (REQ-ELEM-009):
  - Zellen und Bereiche auswählen.
  - Formatierung je Zelle: fett, kursiv, unterstrichen, durchgestrichen, Ausrichtung, Schriftgröße, Text- und
    Zellenfarbe.
  - Zeilen und Spalten an der Auswahl einfügen und löschen.
  - Spaltenbreiten und Zeilenhöhen ziehen oder angleichen.
  - Farben für Kopfzeile und Linien.
  - Tastaturbedienung (Pfeile, Enter, Tippen, Entf).
- Unterstrichen und durchgestrichen für Notizen, Formen und Texte; senkrechte Ausrichtung für Notizen und Formen.
- Neon-Design als drittes Design neben hell und dunkel (REQ-CANVAS-006).

### Geändert
- Tabellen werden beim gemeinsamen Bearbeiten zellgenau abgeglichen (neue Operationen `tpatch` und `tstruct`).
  Bisher ersetzte jede Änderung die ganze Tabelle; dadurch konnten gleichzeitige Eingaben verloren gehen und die
  Ansichten auseinanderlaufen. Fügt jemand eine Zeile oder Spalte ein, schreibt eine Person, die gerade eine Zelle
  bearbeitet, in derselben Zelle weiter. Rückgängig nimmt nur die eigenen Zelländerungen zurück.

### Behoben
- Einrasten an Tabellen berücksichtigt individuelle Spaltenbreiten und Zeilenhöhen.
- Spaltenbreiten können beim Ziehen nicht mehr negativ werden.
- Veraltete Zellauswahl nach dem Löschen von Zeilen oder Spalten durch andere wird verworfen.
- Der Zelleditor übernimmt eine geänderte Formatierung sofort und ist im Neon-Design gut lesbar.

## [3.4.0] – 2026-10-26

### Hinzugefügt
- Ausrichten und Größe ändern (REQ-EDIT-002, REQ-EDIT-004, REQ-CANVAS-005):
  - Einrasten an Tabellenlinien, an gleicher Breite/Höhe und an gleichen Abständen, mit Abstandsmarken.
  - Größen- und Positionsanzeige beim Ziehen.
  - Umschalt beschränkt das Verschieben auf eine Achse; Alt ändert die Größe von der Mitte aus.
  - Exakte Werte (X, Y, Breite, Höhe) über die Kontextleiste, auch für mehrere Elemente.
  - Gleiche Breite/Höhe/Größe, lückenlos oder mit festem Abstand aneinanderreihen, am Raster ausrichten.
  - Größe kopieren/übernehmen.
  - Wählbare Rastergröße.
  - Strg+D wiederholt den Versatz der letzten Kopie.

### Behoben
- **Freihandlinien verloren seit 3.2.0 beim Speichern ihre Punkte.** Sie waren nach dem Neuladen bzw. bei anderen
  Teilnehmenden unsichtbar. Ursache war die Prüfung der neuen Story Points auf Karten, die das Feld `points` aller
  Elemente in Text umwandelte. Bereits betroffene Linien lassen sich nicht wiederherstellen.
- Umschalt-/Strg-Ziehen an einem ausgewählten Element wählte es ab, statt es zu verschieben.
- Text: Eckgriffe (Schriftgröße) fehlten bei kleiner Darstellung; wirkungslose Griffe oben/unten entfernt.
- Exakte Werte und „Aneinanderreihen“ verschieben Frames samt Inhalt; „Größe übernehmen“ skaliert Freihandlinien.
- Bei flachen oder schmalen Elementen (z. B. Gantt-Balken) fehlten die Seitengriffe; Breite und Höhe ließen sich nur
  gemeinsam ändern.
- Gantt-Vorlage: Balken liegen genau auf den Wochenlinien.
- Gruppen:
  - Ziehen an einer Verbindungslinie innerhalb einer Gruppe bog die Linie, statt die Gruppe zu verschieben.
  - Beim Verschieben, Kopieren oder Bewegen per Pfeiltaste eines Frames, der nur einen Teil einer Gruppe enthält, fiel
    die Gruppe auseinander.
- Neu: Ein zweiter Klick in eine ausgewählte Gruppe wählt das einzelne Element zum Bearbeiten (z. B. Farbe ändern),
  ohne die Gruppe aufzulösen.

## [3.3.0] – 2026-10-26

### Hinzugefügt
- Verbinder (REQ-ELEM-004):
  - Andocken an beliebiger Stelle des Umrisses, mit Vorschau beim Ziehen.
  - Biegen durch Ziehen an der Linie; Knickpunkte einfügen, verschieben (mit Einrasten) und entfernen.
  - Beschriftung entlang der Linie verschiebbar.
  - 9 Linienenden für Anfang und Ende getrennt.
  - Menü „Verlauf & Andocken“ mit Richtung umkehren und Pfad zurücksetzen.
- Hinweis beim Doppelklick auf gesperrte Elemente.
- Administration: Systemmetriken in der Übersicht (CPU, Arbeitsspeicher inkl. Container-Limit, Ereignisschleife,
  Speicherplatz, Datenbankverbindungen, Laufzeit) mit Verlauf und Warnhinweisen (REQ-ADMIN-002).
- Screenshots in der README.
- Protokollierung mit Stufen (trace bis fatal), Text- oder JSON-Format, Request-ID, Schwärzung von Geheimnissen und
  Laufzeit-Einstellung in der Administration; neue Umgebungsvariablen `LOG_LEVEL` und `LOG_FORMAT` (REQ-OPS-011).

### Geändert
- Ein Klick ohne Ziehen auf ein Element einer Mehrfachauswahl wählt nur dieses Element aus. Bisher blieb nach dem
  Einfügen eines Diagramms alles ausgewählt, und einzelne Elemente ließen sich kaum bearbeiten.

### Behoben
- „Rechtliches“ zeigte beim Öffnen ein leeres Impressum; ein erneutes Speichern hätte es gelöscht.
- Lange Wörter auf Sticky Notes wurden bis zur Unlesbarkeit verkleinert; sie werden jetzt am Bindestrich bzw. notfalls
  im Wort umbrochen.
- Beim Umhängen eines Verbinders ging der gewählte Andockpunkt verloren; das Ende hing immer am automatisch gewählten
  Punkt.
- Verbinder:
  - Bei übereinanderliegenden Linien (z. B. Organigramm) wählt ein erneuter Klick die nächste Linie, statt immer die
    oberste zu treffen.
  - Andocken an Dreiecken, Sechsecken, Parallelogrammen, Sternen usw. erfolgt an der sichtbaren Kante statt am
    umgebenden Rechteck.
  - Pfeiltasten verschieben Knickpunkte mit, wie das Ziehen.
  - „Richtung umkehren“ spiegelt die Lage der Beschriftung.
- Sequenzdiagramme:
  - Blöcke (alt, loop …) verdecken die Lebenslinien nicht mehr.
  - Pfeil und Text einer Nachricht sind gruppiert; Doppelklick auf den Pfeil bearbeitet den Text.
- Beim Duplizieren wurde ein internes Hilfsfeld mitgespeichert.

## [3.2.1] – 2026-10-26

### Behoben
- Verschieben mit der mittleren Maustaste legte unter Linux zusätzlich eine Sticky Note mit dem zuletzt markierten Text
  an (Einfügen der „Primary Selection“).

## [3.2.0] – 2026-10-26

### Hinzugefügt
- Zusammenarbeit:
  - Cursor-Chat (Taste `/`), Namen an der Auswahl anderer und Anzeige „… schreibt“.
  - Randpfeile für Personen außerhalb der Ansicht, Abwesenheitsstatus, Ansichten der anderen in der Minimap.
  - Mauszeiger anderer ausblendbar, „Alle folgen mir“ (REQ-COLLAB-004, -005, -008).
- Privater Modus: verdeckt sammeln, gemeinsam aufdecken; die Inhalte werden auf dem Server geschützt (REQ-COLLAB-009).
- Schätzrunde mit verdeckten Karten mit Fibonacci-, T-Shirt- und Stunden-Deck (REQ-MOD-004).
- Code-Blöcke mit Syntaxhervorhebung (REQ-ELEM-015).
- Diagramm aus Text (Mermaid-Schreibweise) für Fluss- und Sequenzdiagramme (REQ-ELEM-016).
- 12 neue Formen für Flussdiagramme, UML und IT-Architektur (REQ-ELEM-003).
- Karten: Priorität, Story Points, Ticketnummer und Labels (REQ-ELEM-008).
- Aufgaben-Panel im Board, „Meine Aufgaben“ auf der Startseite, Direktlinks auf Elemente (REQ-PROJ-001, -002).
- Versionsverlauf: Versionen sichern, automatisch alle 30 Minuten, wiederherstellen, als Kopie öffnen (REQ-PROJ-003).
  Neue Datenbank-Migration 4.
- Kartenimport aus CSV, Excel, Jira oder Azure DevOps (REQ-IO-005).
- 31 neue Vorlagen in den Kategorien Softwareentwicklung, Projektmanagement und IT-Service-Management (REQ-TPL-001).

### Geändert
- Duplizieren übernimmt keine privaten Elemente anderer Personen.
- Datenschutz-Vorlage um Versionen und Cursor-Chat ergänzt. Bereits veröffentlichte Datenschutzerklärungen bitte in
  der Administration prüfen und anpassen.

## [3.1.0] – 2026-10-26

### Hinzugefügt
- Virenscan aller hochgeladenen Dateien mit ClamAV; Signaturen aktualisieren sich automatisch, Status in der
  Administration, Sperre von Uploads ohne Scanner, Prüfung des Dateityps (REQ-UPL-001 bis 004).
- Versionierung und automatische Upgrades: Versionshistorie in der Datenbank, Sicherung per `pg_dump` vor Migrationen,
  Datenbanksperre während des Upgrades, Downgrade-Schutz, Hinweis „neue Version“ in offenen Boards (REQ-OPS-001 bis 006).
- Upgrade-Test für Datenbank-Migrationen (`npm run test:upgrade`).
- Impressum und Datenschutzerklärung: Pflege in der Administration mit Vorlagen, öffentliche Seiten und Verlinkung
  (REQ-LEGAL-001).
- Anforderungsdokumentation für alle Funktionen (`docs/anforderungen/`), Beitragsregeln (`CONTRIBUTING.md`).

### Behoben
- Vorlagen-Galerie: Bei „Alle“ wurden die Karten in die Fensterhöhe gestaucht und abgeschnitten; die Galerie scrollt
  jetzt.
- Übersicht auf Smartphones: Kopfzeile war breiter als der Bildschirm.

## [3.0.0] – 2026-10-26

### Hinzugefügt
- E-Mail-Bestätigung bei der Registrierung, Bestätigung geänderter E-Mail-Adressen.
- Sperre von Wegwerf-E-Mail-Adressen, eigene Sperr- und Erlaubnislisten.
- Kennwortrichtlinie nach NIST SP 800-63B mit Stärkeanzeige, optional Abgleich mit Pwned Passwords.
- Zwei-Faktor-Anmeldung (TOTP) mit Wiederherstellungscodes, optional Pflicht für Administratoren.
- Geräteübersicht, Sicherheitsprotokoll, Sicherheitsbenachrichtigungen per E-Mail.
- Erweiterte Benutzerverwaltung (Einladungen, Filter, Sitzungen beenden, 2FA zurücksetzen).
- Long-Polling als automatischer Rückfall, wenn Server-Sent Events blockiert werden.

### Geändert
- Umbenennung in **vibeboard** (Cookie, CSRF-Header `X-Vibeboard`, Speicherschlüssel; alle Nutzer werden einmal abgemeldet).
- Stärkere Kennwort-Hashes (scrypt N=2¹⁷) mit automatischer Umstellung beim Login.
- Strenge Content-Security-Policy und weitere Sicherheits-Header; gehärtete Docker-Container;
  Datenbank-Kennwort im Docker-Setup verpflichtend.

## [2.0.0] – 2026-10-26

### Hinzugefügt
- Benutzerkonten mit Registrierung, Anmeldung, Profil und „Kennwort vergessen“.
- Administration: Übersicht, Benutzer, Boards, Einstellungen, Mailserver mit Testmail.
- Boards mit Besitzer, Mitgliedern (Bearbeiter/Betrachter) und Freigabe per Link.
- Datenhaltung in PostgreSQL mit Migrationen; einmaliger Import der dateibasierten Boards.

### Behoben
- 40 Befunde aus einem Code-Review, u. a. gespeichertes XSS über Element-Attribute, Umleitung von Reset-Links über den
  Host-Header, Datenverlust durch ungültige Zeichen, beschädigte Undo-Historie.

## [1.0.0] – 2026-10-26

### Hinzugefügt
- Kollaboratives Whiteboard: unendliche Leinwand, Sticky Notes, Text, Formen, Verbindungen, Freihand, Frames, Karten,
  Tabellen, Mindmaps, Bilder, Sticker, Links, Kommentare.
- Echtzeit-Zusammenarbeit mit Live-Cursorn, Folgen-Modus, Reaktionen und Laserpointer.
- Timer, Abstimmungen, Präsentationsmodus.
- Über 35 Vorlagen, Export als PNG, SVG, PDF und JSON.
