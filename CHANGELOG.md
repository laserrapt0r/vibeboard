# Änderungsprotokoll

Alle nennenswerten Änderungen an vibeboard. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/) (siehe
[REQ-OPS-001](docs/anforderungen/14-betrieb-versionierung.md)).

## [4.18.0] – 2026-11-02

### Hinzugefügt
- Formenkatalog auf 146 Formen erweitert: mehr Grundformen, Flussdiagramm nach ISO 5807, BPMN mit Ereignisarten, Aufgabentypen, Pool und Lane, UML mit Lebenslinie, Aktivierung und Fragment, dazu ERD, Data Flow, Value Stream und Bausteine für Architekturdiagramme.
- Panel „Alle Formen“ links, erreichbar aus dem Formen-Menü und der Befehlssuche: Suche mit Synonymen und Tippfehlertoleranz, klappbare Gruppen, „Zuletzt verwendet“, Ablegen per Ziehen, Tastatur und Handy.
- „Formen verwalten“: Pakete je Person ein- und ausblenden, im Konto gespeichert (Migration 16). Die Administration legt unter „Design & Vorlagen“ fest, welche Pakete verfügbar sind.
- Allgemeine Symbole: 4711 Liniensymbole aus Tabler Icons (MIT, Version 3.50.0) als Paket im Panel, in 14 Untergruppen und seitenweise angezeigt. Die Suche findet Formen und Symbole zusammen, mit einer gepflegten deutschen Liste für über 600 Motive, englisch über die Stichwörter des Satzes, häufige Motive auch auf Spanisch und Französisch. Die Symboldatei (1,2 MB, gepackt 0,27 MB) kommt erst beim Öffnen des Panels oder mit dem ersten Symbol auf dem Board.
- Symbole auf dem Board: Linienfarbe, Linienstärke, Beschriftung unter dem Symbol, Andockpunkte, Vorlagen, Kopien und Format übertragen. SVG, PNG, PDF und PPTX warten auf die Daten und zeigen die Symbole richtig.
- `npm run build:icons` erzeugt die Symboldatei neu, wenn `@tabler/icons` aktualisiert wird. Im Betrieb läuft dieser Schritt nicht.

### Geändert
- Das Formen-Menü zeigt nur noch zuletzt verwendete Formen, Grundformen und „Alle Formen“. „Form ändern“ gliedert die übrigen Pakete in Untermenüs.
- PowerPoint-Export: Mehr Formen bleiben bearbeitbar. Eine Beschriftung unter einer Form, die als Bild exportiert wird, wird nicht mehr abgeschnitten.
- draw.io-Import: Flussdiagramm-Formen und weitere Formen werden abgebildet; `step` wird zum Chevron statt zur Pille.
- Der Server begrenzt Formnamen auf Buchstaben, Ziffern, `_` und `-`. Unbekannte, harmlose Namen bleiben erhalten und erscheinen als Rechteck.
- Die Befehlssuche findet „Alle Formen“ auch über das Wort „Symbole“. Einzelne Symbole stehen dort bewusst nicht.

### Behoben
- Fremde Cursor in gedrehtem Text (Pool, Lane) standen falsch: Sie lagen längs der Zeile statt quer dazu und waren kaum zu sehen.

## [4.17.0] – 2026-11-02

### Hinzugefügt
- Ansicht verschieben mit gedrückter rechter Maustaste, auch über Elementen. Rechtsklick und mittlere Maustaste funktionieren wie bisher.
- Webhooks für Prüfungen: Angefordert, genehmigt und abgelehnt lassen sich im eigenen Webhook abonnieren.

### Geändert
- Das Mausrad zoomt immer, das Wischen auf dem Trackpad verschiebt weiter. Die Einstellung lässt sich umkehren.
- Grenzen für Workshops: SSO-Anmeldungen 600 je Adresse in 10 Minuten, Team-Einladungen 150 je Stunde.

### Behoben
- Ein Schreibfehler auf einer abgerissenen Verbindung konnte den ganzen Server beenden, ohne vorher zu speichern. Solche Fehler treffen jetzt nur noch diese Verbindung. Bei jedem anderen schweren Fehler speichert der Server zuerst.
- Tooltips ohne Tastenkürzel zeigten „null“. Dasselbe konnte im Timer für Betrachter, auf der Gastseite, im Einstieg und im Teilen-Dialog auftreten. `npm run check:dom` verhindert das jetzt dauerhaft.
- Rückgängig einer gelöschten anonymen Notiz nach einem Neustart zeigte einen Namen. Der Server merkt sich anonyme Löschungen jetzt dauerhaft (Migration 15).

## [4.16.0] – 2026-11-01

Überarbeitete Bedienung nach der Prüfung von Abläufen und Auffindbarkeit.

### Geändert
- Die Kontextleiste bleibt beim Tippen sichtbar und verdeckt den Editor nicht. Format, Farbe, Größe, Ausrichtung und Link lassen sich ändern, ohne die Eingabe zu beenden; Fokus und Einfügestelle bleiben. Kommentar, Sperren, Mehr und Löschen beenden die Eingabe zuerst.
- Die Tastenkürzel-Übersicht liegt jetzt in der Hilfe, hat ein Suchfeld und zeigt Häufiges zuerst.
- Kopfzeile neu geordnet: Boardmenü neben dem Namen (Exportieren, Importieren, Als Vorlage speichern, Verlauf, Aktivität, Elementliste, Board duplizieren, In Ordner verschieben, Board löschen), Knopf „Moderieren“ für Timer, Abstimmung, Retro, Privater Modus, Moderation, Schätzrunde, Umfrage, Zufallsauswahl, Redereihenfolge und Aufzeichnung, beschriftete Knöpfe „Teilen“ und „Präsentieren“. „Vorlagen“ steht nur noch in der Werkzeugleiste.
- Was in Kopfzeile oder Werkzeugleiste nicht passt, wandert ins Menü „Mehr“. Keine Leiste scrollt mehr oder blendet Funktionen ersatzlos aus, Retro und Filter sind nicht mehr im Zahnrad versteckt.
- Der eigene Avatar ist überall das Kontomenü, auch für Gäste. Das Zahnrad enthält nur noch Ansicht und Bearbeitung; Tastenkürzel, Impressum und Datenschutz stehen im Kontomenü.
- Was eine Rolle nicht kann, erscheint nicht mehr, auch nicht ausgegraut.
- Einheitliche Begriffe in allen vier Sprachen: „Prüfung“ statt „Freigabe“ im Sinn von Genehmigung (mit „Genehmigen“ und „Genehmigt“), „Notiz“ statt Sticky Note und Haftnotiz, „Zeitleiste“ statt Zeitstrahl, „Bild oder Datei einfügen“, Taste H „Ansicht verschieben“, „Linie“, „Marker“, „Laser“. Der Teilen-Dialog meldet „Zugriff geändert“, die Administration zeigt die Spalte „Zugriff“.
- Kontextleiste verschlankt: sichtbar sind nur Farbe, Text, Link, Kommentar, Sperren, Mehr und Löschen. Mehrere Regler öffnen eine Zusatzzeile, Retro-Knöpfe stehen nur bei laufender Retro in der Leiste, „B×H“ heißt „Position und Größe“ und steht im Menü „Mehr“. Farb-Emojis sind durch Symbole ersetzt.
- „Mehr“ und Rechtsklickmenü sind gleich gegliedert: Bearbeiten, Aktionen, Anordnen, Format, Größe, Sperren, Zusammenarbeit, Exportieren. Menüs können jetzt Untermenüs haben.
- Werkzeugleiste nach Häufigkeit geordnet, Vorlagen ganz oben.
- Exportieren und Importieren sind getrennt. „Als PDF“ heißt „PDF drucken (Text markierbar)“, „Datei importieren“ heißt „Inhalte aus Datei importieren“, „Datei anhängen“ heißt „Datei als Anhang einfügen“.
- Wer ein Board selbst löscht, landet ohne zusätzliche Meldung auf der Startseite.

### Hinzugefügt
- Auswahlmodus für Touch: „Mehrere auswählen“ neben den Auswahlwerkzeugen, Tippen nimmt Elemente auf oder heraus, Ziehen auf leerer Fläche zieht einen Rahmen auf. Der Retro-Schritt „Gruppieren“ lässt sich damit am Handy erledigen. Auf Geräten mit Maus gibt es den Schalter nicht.
- Handy: Retro-Leiste, Abstimmung, privater Modus und Moderationsbanner lassen sich einklappen und sind für Teilnehmende zunächst eingeklappt. Sie stapeln sich ohne Überlappung, Meldungen stehen oben statt über den Leisten.
- PDF-Datei ohne Druckdialog: je Frame eine Seite in Reihenfolge und Größe des Frames, Folientitel als Lesezeichen, ohne Frames das ganze Board auf einer Seite. Die Seiten sind Bilder, deshalb bleibt „PDF drucken (Text markierbar)“ als zweiter Eintrag.
- Schätzrunde mit Warteschlange: mehrere Karten oder „Alle ohne Schätzung“, Fortschritt für alle, „Nächste Karte“, und nach dem Übernehmen geht es von selbst weiter.
- „Blockiert durch“ im Kartendialog, angezeigt in Kanban und Zeitleiste, dort mit Pfeilen. Der Server verhindert Selbstbezüge und Kreise.
- Schnelleingabe für Karten: Der Titel entsteht direkt auf der Karte, auch beim gemeinsamen Tippen. In der Kanban-Ansicht hat jede Spalte ein „+“ mit Titelfeld und im Kopf die Summe der Story Points.
- Gaststufe „Beiträge“ für Gastlinks: Gäste legen eigene Notizen an, ändern und löschen nur diese, kommentieren und stimmen ab. Abschaltbar, Standard aus, mit einer Höchstzahl je Gast (Standard 50). Der Server prüft jede Operation und führt das Eigentum selbst.
- „Meine Aufgaben“ zeigt im Bereich „Zu prüfen“ offene Prüfungen mit Direktsprung ins Panel.
- Jede Runde einer Prüfung bleibt mit Begründungen erhalten. „Erneut vorlegen“ nimmt einen Hinweis an, das Panel zeigt die früheren Runden.
- Präsentieren für alle: Beim Start fragt ein Dialog, ob alle mitkommen sollen. Das Publikum folgt den Folien automatisch in einer reduzierten Ansicht, wer später kommt, wird mitgenommen, und „Selbst umsehen“ und „Wieder folgen“ geben die Wahl. Offene Eingaben, Dialoge und laufendes Ziehen gehen vor. Die Präsentation endet für alle, wenn sie beendet wird oder die präsentierende Person geht.
- Strg+B, Strg+I und Strg+U: beim Tippen für das ganze Element oder die Zelle, sonst für die Auswahl. Einzelne Wörter lassen sich weiterhin nicht formatieren.
- Hilfe-Knopf unten links mit „Erste Schritte“, Kurzanleitung und Tastenkürzeln, auch über die Befehlssuche. Ein einmaliger Tipp erklärt beim ersten Zoomen oder Ziehen auf leerer Fläche das Bewegen.
- Strg+Umschalt+Pfeil hoch und runter für ganz nach vorn und ganz nach hinten, das geht auch auf deutscher Tastatur.
- Taste B für die Tabelle und Taste D für den Code-Block, beide in der Kürzelübersicht.
- Eigene Tooltips mit Name und Kürzel in Kopfzeile und Werkzeugleiste, nach kurzer Verzögerung und auch bei Tastaturfokus.
- Farbfelder nennen Farbnamen statt Hexwerten.
- „Als Vorlage speichern“ auch im Vorlagen-Dialog. „Format mehrfach übertragen“ im Menü „Mehr“.
- Schätzrunde ohne ausgewählte Karte: Das Menü fragt nach der Karte.
- Die Befehlssuche findet auch, was in Menüs oder hinter „Mehr“ liegt.

### Behoben
- PowerPoint: Der Frame-Titel steht als echtes Titelfeld auf der Folie.
- „PDF drucken“ erzeugte Bilder der Seiten, jetzt bleibt der Text markierbar.
- Wer ein Board selbst löscht, landete manchmal wieder auf der gelöschten Seite, weil die abgebrochene Verbindung ein Neuladen auslöste.
- SVG- und JSON-Export melden das Ergebnis, ein leeres Board meldet „Nichts zu exportieren“. PNG meldet auch den Abschluss.
- Benachrichtigungen zu Prüfungen öffnen das Panel beim richtigen Element und nennen Ergebnis und Name. Die leere Glocke erwähnt Prüfungen.
- Meldungen zu Prüfungen erscheinen nicht mehr, wenn das Board im Papierkorb liegt oder das Element nicht mehr sichtbar ist.
- Ein Kartentitel aus dem Dialog erreicht den Server auch bei offener Schnelleingabe.
- Rückgängig von „Karte und Blockierer gelöscht“ verliert den Bezug nicht mehr, wenn die Karte zuerst ankommt.
- „PDF drucken“ schreibt je Seite nur deren Bilder ins Dokument und wartet wirklich, bis sie geladen sind.
- Die Glocke lädt für Meldungen zu Prüfungen nur noch Boards mit verborgenem Bereich.
- Die Leiste des Publikums wird nur noch bei einer Änderung neu gebaut, ein Klick auf „Selbst umsehen“ geht beim Warten nicht verloren.
- Tooltips bleiben nicht mehr stehen, wenn der Knopf ersetzt wird oder der Zeiger das Fenster verlässt.
- Esc im Titelfeld der Kanban-Spalte schließt nur das Feld.
- Keine Meldung „Schätzrunde gestartet“ mehr, wenn die erste Karte einer Warteschlange gelöscht wird.
- Das Menü der Schätzrunde und „Alle ohne Schätzung“ ordnen Karten in Leserichtung, statt in der Folge, die die Datenbank liefert.
- Gast der Stufe „Beiträge“ ist nicht mehr als zuständig für Kommentare wählbar, weil er sie nicht erledigen darf.

### Sicherheit
- Schriftgröße für alle Elemente auf 1 bis 128 begrenzt, die Darstellung fängt Ausreißer aus älteren Daten ab. Text wächst beim Ziehen an der Ecke höchstens bis 128.
- Wer nicht bearbeiten darf, kann neue Notizen und Kommentare nur unter eigenen, vom Server geprüften Kennungen anlegen. Gelöschte Kennungen anderer samt Verbindern, Ankern und Prüfungen lassen sich so nicht übernehmen, auch nicht nach einem Neustart. Neue Tabelle `server_secrets`.
- Prüfungen eines nachträglich verborgenen Frames sind für Teilnehmende nicht mehr sichtbar, entscheidbar oder neu vorlegbar.
- Gäste bekommen Eingabeschritte nur noch für eigene Notizen, Änderungen an eigenen Notizen sind gedrosselt.
- Ablehnungen fremder privater Notizen erreichen den Browser des Gastes.

## [4.15.0] – 2026-11-01

Korrekturen aus der Prüfung des Zusammenspiels, der Bedienung und der Lesbarkeit, dazu ein Lasttest.

### Sicherheit
- Wird der Link eines Boards eingeschränkt, verlieren auch Mitglieder sofort das höhere Recht, das sie nur über den Link hatten. Bisher behielten offene Verbindungen ihre Schreibrechte.
- Der Verlauf zeigt keine Beschriftungen von Verbindern aus verborgenen Bereichen mehr.
- Tabellen lassen sich nicht mehr in verborgene Bereiche schieben. Kommentare an verborgenen Elementen sind mit verborgen.
- Gastlinks von Boards im Papierkorb gelten nicht mehr.
- Der zweite Faktor hat eine eigene Grenze je Konto, weil die Anmeldung nur noch Fehlversuche zählt. Rollen in der Personenliste sehen nur Bearbeitende. Die Meldung „Board geteilt“ ist je Person begrenzt.
- Wer im privaten Modus eine bisher leere Notiz beschreibt, schreibt privat. Bisher machte das Text und Namen sofort sichtbar; auch der erste Buchstabe erreicht nun niemanden. Das gilt ebenso für leere Texte, Formen, Code-Blöcke und Karten, die Retro-Vorlagen legen solche an.
- Eine Boardkopie oder Versionskopie enthält keine Verbinder zu fremden privaten oder verborgenen Elementen mehr, deren Beschriftung sonst mitkam.
- Eine laufende Retro und eine laufende Abstimmung steuert der Server nur noch für die startende Person, Besitzer und Moderierende. Bisher konnten alle Bearbeitenden sie für alle weiterschalten oder beenden. Sind alle Leitenden gegangen, dürfen Bearbeitende übernehmen.

### Behoben
- Rückgängig nimmt keine fremden Änderungen mehr mit, die während der eigenen Geste eintrafen.
- Offline getippter Text geht nicht mehr verloren, wenn das Element inzwischen gelöscht wurde.
- „Bleiben“ im Rückfragedialog beim Neuladen hinterlässt keinen toten Tab mehr.
- Führt die Moderation die Ansicht, springt ein gerade gezogenes Element nicht mehr weg.
- Rückgängig einer fremden Löschung behält Autorschaft und Reaktionen.
- Am anonymen Beitrag steht kein Name mehr, auch wenn der Modus beim Tippen wechselt. Eine wiederhergestellte Version bleibt anonym.
- Widerrufene Gäste landen auf der Erklärseite statt bei der Anmeldung.
- Dunkles Design: Automatischer Text auf hellen Formen, Notizen, Karten und Tabellen ist lesbar, die Farbe folgt der obersten Fläche darunter. Das gilt auch für Formen ohne Füllung. Frame-Titel erreichen 4,5:1.
- Sperren ändert die Ebene nicht mehr, und alle sehen sofort dieselbe Reihenfolge. Unter den Inhalten liegen nur noch Flächen aus Vorlagen.
- Strg+] und Strg+[ verschieben keine gesperrten Elemente mehr.
- Neue Frames rutschen in Vorlagen-Boards nicht mehr an Stelle 1. Titel-Nummern sind eindeutig, eine Frame-Kopie steht direkt hinter dem Original. „+ Frame“ im Panel legt Frames nicht mehr aufeinander.
- Einpassen und „Alles anzeigen“ lassen die festen Leisten frei.
- Handy: Die Kontextleiste überdeckt das Seitenpanel nicht mehr. Der Fokusring im Suchfeld des Vorlagendialogs ist vollständig sichtbar.
- Meldungen liegen nicht mehr über dem Abstimmungsbanner.
- Tastenkürzel: Spalten überlappen nicht mehr, doppelte Einträge sind zusammengelegt.
- Mindmap: Neue Knoten überlappen keine Nachbaräste mehr. Tiefer liegende Äste rücken nach unten, nur so weit wie nötig, ein leer verworfener Knoten stellt die alten Lagen wieder her.
- Kanban: Eine volle Spalte wächst nach unten, ihr Frame mit, statt Karten aufeinanderzustapeln. Die Ansicht zeigt die Spalten in der Reihenfolge des Boards, fremde Status dahinter. „Neue Spalte“ legt auf Boards mit Spalten eine echte Spalte an, sonst steht sie als vorläufig da.
- Karten: Neue Karten übernehmen den Status ihrer Spalte, der Titel ist beim Öffnen markiert, eine unverändert abgebrochene neue Karte verschwindet ohne Eintrag im Verlauf. Der Status im Dialog bietet die Spalten an, gleicht die Schreibweise an und nimmt die Karte auf dem Board mit.
- Tab: Notizen füllen Spalten und Frames zeilenweise und verlassen sie erst, wenn wirklich kein Platz ist. Ohne Rahmen bricht die Reihe nach fünf Notizen um.
- Griffpunkte: Esc auf einer leeren neuen Notiz entfernt sie samt Linie, die Ansicht folgt der neuen Notiz.
- Bilder und Dateien ohne gewählten Zielpunkt suchen freien Platz, wie Vorlagen. Enter mit Werkzeug und Einfügen legen nichts mehr deckungsgleich ab.
- Ein Verbinder, von dem nur ein Ende mitkopiert wurde, kommt auch in einem anderen Board an, das andere Ende ist frei.
- Verschiebt jemand einen Frame, wandern fremde private Beiträge darin mit, ohne dass etwas von ihnen sichtbar wird.
- Suche und Elementliste folgen dem Board, auch bei fremden Änderungen. Ein inzwischen gelöschtes Element wird gemeldet statt ausgewählt.
- Wird ein Kommentar gelöscht, während man antwortet, zeigt das Fenster einen Hinweis und behält den Entwurf zum Kopieren.
- Helles Design: Automatischer Text auf dunklen Formen ist lesbar, die Farbe folgt wie im dunklen Design der obersten Fläche.
- „1 Folie exportiert“ und „1 Stimme“ stehen in der Einzahl. In der Befehlssuche stehen Klammerzusätze nicht mehr in der Kürzelspalte.
- Long-Polling: „reload“ und „deleted“ gehen nicht mehr verloren, wenn der Kanal zwischen zwei Abfragen endet.
- Verborgene Bereiche: Wandert ein Element über die Grenze, folgen seine Verbinder sofort, nicht erst nach dem Neuladen.
- Touch: Eine Stimme lässt sich über das Minus an der eigenen Stimme zurücknehmen, langes Drücken zählt nicht mehr als weitere Stimme.
- Das Kontextmenü lässt sich mit der Tastatur bedienen, Pfeiltasten verschieben nicht mehr das Element dahinter. Menütaste und Umschalt+F10 öffnen es.
- Im anonymen Sammeln stehen keine Namen mehr an den Mauszeigern.

### Geändert
- Automatische Textfarbe auf Füllungen: Es gewinnt die Farbe mit dem höheren Kontrast, auch im PowerPoint-Export. Mindmap-Äste geben keine weiße Schrift mehr vor.
- Präsentationsleiste: Voll sichtbar beim Start und nach Aktivität, tritt erst nach 3 Sekunden Ruhe zurück, nicht bei Fokus und nicht auf Touch-Geräten. Zurück und Weiter sind an den Enden deaktiviert.
- Grenzwerte für Workshops: Bei der Anmeldung zählen nur Fehlversuche (je Konto und je Adresse), der Gastbeitritt zählt je Gastlink (300 in 10 Minuten) und je Adresse nur Fehlversuche, Einladungen sind auf 150 je Stunde angehoben. Die Meldung nennt die Wartezeit in Minuten.
- Einladungen erscheinen immer in der Glocke („hat ein Board mit dir geteilt“). Ohne Mailserver entfällt das E-Mail-Häkchen, und die Meldung sagt, dass der Link selbst weitergegeben werden muss. Neue Migration für die Benachrichtigungsart.
- Freigabedialog: Rollen stehen dabei, wer nur ansehen darf, ist nicht wählbar, die Fehlermeldung nennt den Namen.
- „Per E-Mail an Beteiligte“ erscheint nur mit Mailserver, „An Team-Kanal“ nur mit Team. „Benutzer anlegen“ wählt ohne Mailserver das Kennwort vor.
- Kontextmenü: neu „Text bearbeiten“, Einträge sind nach Bearbeiten, Zwischenablage, Anordnen, Sperren, Zusammenarbeit und Löschen geordnet.
- „Frame samt Inhalt löschen“ meldet die Menge mit dem Knopf „Rückgängig“.
- Befehlssuche: Synonyme je Befehl, Gruppennamen, Export-Formate, Import, Retro und „Personen einladen“ als eigene Befehle, Filter und Retro auch bei schmalem Fenster. Was die Rolle nicht darf, erscheint nicht.
- Präsentieren ohne Frames öffnet einen Dialog mit „Frame anlegen“ und „Ganzes Board zeigen“.
- Wer nicht bearbeiten darf, bekommt bei Doppelklick oder Werkzeugtaste einmalig einen Hinweis, was die Rolle kann.
- „Pausieren“ in der Abstimmung heißt jetzt „Für mich pausieren“: Es wirkt nur im eigenen Browser.
- Große Workshops: Zeiger und Cursor werden je Raum im Takt gebündelt, Nachrichten nur einmal serialisiert. Im Lasttest bleiben 50 tippende Personen flüssig, vorher brach der Server dort ein.

### Entwicklung
- Browsertests liegen in `scripts/browser/` und laufen in der CI, `npm run test:load` misst gemeinsames Arbeiten.

## [4.14.0] – 2026-11-01

### Hinzugefügt
- Fremde Cursor: Wer in einem Text schreibt, ist für alle als farbiger Cursor mit Namen zu sehen, markierter Text wird farbig hinterlegt. Gilt für alle Elemente, die gemeinsames Tippen kennen. Anonyme Beiträge zeigen keinen Cursor.

### Behoben
- Ein Zellbezug, der gerade in eine Formel kommt, verrutscht nicht mehr, wenn jemand gleichzeitig in derselben Zelle schreibt.
- Im Long-Polling verschwinden Weggegangene jetzt zuverlässig nach rund 4 Sekunden. Die Abmeldung beim Schließen aus 4.12.0 kam nicht immer an; der Server erkennt das Gehen nun selbst.
- Zelländerungen, die während einer Änderung der Tabellenstruktur unterwegs sind, landen nicht mehr in der Nachbarzelle. Der Server rechnet sie um, Formeln passen sich an.

## [4.13.0] – 2026-11-01

### Hinzugefügt
- Gemeinsam tippen: Mehrere Personen schreiben gleichzeitig in Notizen, Formen, Mindmap-Knoten, Textelementen, Code, Frame-Titeln, Linienbeschriftungen und Tabellenzellen, ohne dass Zeichen verloren gehen. Der eigene Cursor bleibt an seiner Stelle, Rückgängig nimmt nur die eigene Eingabe zurück.

### Geändert
- Kartendialoge führen Titel und Beschreibung beim Speichern mit inzwischen geänderten Fassungen zusammen.

### Behoben
- Papierkorb: Die Knöpfe liefen rechts aus der Karte.

## [4.12.0] – 2026-11-01

Offene Punkte aus der Fehlersuche geschlossen, die sich im Betrieb als Fehlverhalten zeigten.

### Hinzugefügt
- Kommentare hängen am Element: Sie folgen ihm bei jeder Bewegung, auch beim Skalieren und bei den anderen im Board.
- Zellen kopieren, ausschneiden und einfügen, auch mit Excel und Co. Formeln wandern innerhalb von vibeboard mit.
- Langes Drücken öffnet das Kontextmenü auch auf iOS.
- Papierkorb: Boards auswählen, alle auswählen, gemeinsam wiederherstellen oder endgültig löschen.

### Geändert
- Mindmap: Ein gezogener Knoten nimmt seine Unterknoten mit.
- Passt Text nicht in Notiz oder Form, wird er kleiner, statt herauszulaufen. Auch im PowerPoint-Export.
- Abgeschaltete Dateianhänge werden nicht mehr angeboten.
- Dürfen nur Administratoren Teams anlegen, sehen andere kein „+“ mehr.
- Die Auswahl für Aufgaben enthält nur Personen, die den Kommentar erledigen dürfen.
- Erneutes Einladen meldet „bereits Mitglied“ oder „Rolle geändert“, ohne zweite E-Mail und ohne Hinauswurf aus dem Board.

### Behoben
- Ein vom Server abgelehntes Löschen oder Ändern eines Kommentars blieb bis zum Neuladen falsch angezeigt.
- Im Long-Polling blieben Weggegangene über eine Minute sichtbar.

## [4.11.5] – 2026-11-01

Korrekturen aus der Fehlersuche, dritter Teil: Hinweise, Rollen und Sackgassen.

### Geändert
- Hinweise in leeren Panels richten sich nach der Rolle: Wer nur ansehen darf, bekommt keine Anleitung für Werkzeuge, die fehlen.
- Moderationsknöpfe der Retro erscheinen nur mit Bearbeitungsrechten.
- Ein neu angelegtes Element samt Text verschwindet mit einem Rückgängig statt mit zweien.
- Die Suche findet Dateinamen und Ergebnisse von Tabellenformeln.
- Die Befehlspalette zeigt keine Vorlagen, die die Administration ausgeblendet hat; ist die Galerie leer, sagt sie das.
- Tasten-Tipps entfallen auf Touch-Geräten.

### Hinzugefügt
- Seite „Seite nicht gefunden“ für unbekannte Adressen.
- Kontextmenü: Link zu diesem Element kopieren. Kürzelübersicht: Präsentation, Ebenen, `?`.

### Behoben
- Unter der Bearbeitungssperre ließ sich der Boardname scheinbar ändern, Rückgängig und Vorlagen blieben stumm, Gruppieren meldete Erfolg.
- Tasten legten während der Präsentation Elemente an oder wechselten das Werkzeug; ein Doppelklick beim Abstimmen öffnete den Editor.
- Abgeschnittene Gastlinks zeigten nur „Nicht gefunden“, beendete Gastzugänge führten zur Anmeldung.
- „Failed to fetch“ erscheint nicht mehr als Fehlermeldung. Die Offline-Seite erholt sich selbst und führt zur ursprünglichen Adresse zurück.
- „Kennwort vergessen“ meldete eine E-Mail, auch wenn keine verschickt werden konnte.
- Das Eingabemuster für den Zwei-Faktor-Code war in aktuellen Browsern ungültig und wurde ignoriert.
- Diagramme ohne Tabelle nennen den wahren Grund. Der Freigabedialog nennt den richtigen Ort für den Gastzugang. Die Meldung nach „Vorlage speichern“ nennt die richtige Rubrik.
- Fehlende Übersetzungen im Protokoll der Administration und bei den Rechtstexten; Abstimmungsergebnisse zeigen keine internen Typnamen; fehlende Beschriftungen für Bildschirmleser.

### Betrieb
- Ursache der zeitweise fehlschlagenden Signaturprüfung belegt: Einzelne CDN-Knoten der npm-Registry liefern für ein Paket nur eine von zwei Attestierungen. Die Prüfung bleibt streng; ein neuer Lauf auf einem anderen Knoten besteht.

## [4.11.4] – 2026-11-01

Korrekturen aus der Fehlersuche, zweiter Teil: Unerreichbares und sichtbar Falsches.

### Geändert
- Standardfarben von Text, Linien und Stift folgen dem Untergrund: Inhalte bleiben im hellen und dunklen Design lesbar, auch für andere Personen und in bestehenden Boards. Exporte zeigen immer Schwarz auf Weiß.
- Enter in einer Tabellenzelle übernimmt und geht eine Zeile tiefer, Umschalt+Enter macht einen Zeilenumbruch.
- Eine Statusänderung in der Kanban-Ansicht verschiebt die Karte auf dem Board in die passende Spalte; Spalten bleiben auch leer erhalten.

### Hinzugefügt
- Enter legt mit gewähltem Werkzeug ein Element in der Mitte der Ansicht an, auch ohne Maus.
- Kontextmenü mit Ausschneiden und Einfügen. Panels schließen mit Esc.
- Format übertragen wirkt bei Tabellen auch auf das Zellenformat.

### Behoben
- Bei wenig Fensterhöhe schnitt die Werkzeugleiste Werkzeuge ohne jeden Hinweis ab; die Kontextleiste lief aus dem Fenster.
- Auf dem Handy fehlten Timer, Abstimmung, Moderation und Co.
- Klicks neben Dialog oder Kommentar verwerfen keine Eingaben mehr. Wird ein Element oder eine Karte beim Bearbeiten gelöscht, sagt das ein Hinweis, und weiter Getipptes schaltet keine Werkzeuge um. Beim Wiederherstellen oder Rollenwechsel erklärt ein Hinweis das Neuladen, offener Text bleibt kopierbar.
- Timer, Abstimmung und Name gingen bei einer Verbindungsstörung für die handelnde Person verloren.
- PowerPoint-Export: Textfarbe, kursiv, unterstrichen, durchgestrichen, Frames und Kopfzeilenfarbe stimmen. Der Tabellenexport zeigt lange Zellen gekürzt, statt sie über die Nachbarzeilen laufen zu lassen.
- Betrachter sehen keine Timer-Knöpfe mehr, „Zur Moderation hinzufügen“ fehlt bei Rollen ohne Bearbeitungsrecht, „Reagieren“ nur bei Elementen, die das können. Banner überdecken einander nicht mehr.
- Die Mindmap-Beschreibung nennt die richtige Taste.

## [4.11.3] – 2026-11-01

Korrekturen aus einer gezielten Fehlersuche, erster Teil: Datenverlust und Blocker.

### Behoben
- Rückgängig löscht keine fremde Arbeit mehr: Es setzt nur die Felder zurück, die man selbst geändert hat. In Tabellen bleiben fremde Zeilen und Zellen erhalten; hat man selbst Zeilen geändert und andere haben inzwischen geschrieben, bleibt die Struktur stehen, und ein Hinweis erklärt das.
- Ausrichten, Verteilen und Rasteranordnung zerstörten mit einem Kommentar in der Auswahl alle Positionen. Gruppen bleiben dabei zusammen, Frames nehmen ihren Inhalt mit.
- Gesperrtes und Fixiertes ließ sich über Strg+X, Rechtsklick und Papierkorb löschen. Das Kontextmenü bietet bei Gesperrtem weder Löschen noch Duplizieren noch Ebenen an, Farben treffen bei gemischter Auswahl nur Freies, der Radierer verschont gesperrte Striche, ein gesperrter Frame lässt seinen Inhalt nicht wandern.
- Strg+X auf einen Frame verdoppelte den Inhalt beim Einfügen.
- Eine eigene Vorlage überschrieb beim Einfügen das Original auf demselben Board; Knickpunkte von Linien wandern jetzt mit.
- In ein anderes Board kopierte Dateien waren kaputt, Diagramme ohne Tabelle blieben unerklärt: Beides meldet jetzt einen Hinweis. Angedockte Linien lassen sich kopieren. Kopien übernehmen keine Reaktionen.
- Beim Neuladen gingen große Änderungen ohne Rückfrage verloren.
- Nach Ablauf der Sitzung leitete die Seite weiter und verwarf offene Änderungen. Jetzt bleibt sie stehen und bittet um Anmeldung in einem neuen Tab.
- Verließen alle Moderierenden oder der Starter des Privatmodus das Board, blieb es für alle anderen gesperrt: Bearbeitende können beides jetzt beenden, das Banner nennt, wer gestartet hat.
- Zoomen und Verschieben mit zwei Fingern funktionierte auf Touch-Geräten nicht.
- Rechtsklick ins Leere zeigt auch bei bestehender Auswahl das Menü der freien Fläche.

## [4.11.2] – 2026-11-01

### Behoben
- Das Panel „Freigaben“ verwies aufs Kontextmenü, dort fehlte der Eintrag aber. Freigaben lassen sich jetzt per Rechtsklick auf Frames und Dateien anfordern.

## [4.11.1] – 2026-10-31

### Behoben
- Format übertragen nimmt zwischen Formen auch die Form mit und überträgt die Schriftfarbe auch auf Notizen und von Quellen mit automatischer Farbe. Haben zwei Elementarten nicht alles gemeinsam, weist ein Hinweis darauf hin.
- Notizen haben eine Schaltfläche für die Textfarbe.

## [4.11.0] – 2026-10-31

### Hinzugefügt
- Das Kontextmenü fügt Fotos, PDF- und Office-Dateien an der Klickstelle ein und bietet Format übertragen, kopieren und einfügen (REQ-EDIT-008).

## [4.10.1] – 2026-10-31

### Behoben
- Ein Tab blieb dauerhaft „offline“, wenn die Live-Verbindung eine HTTP-Fehlerantwort bekam, etwa 502 eines Proxys während eines Neustarts. Änderungen warteten dann, bis jemand von Hand neu verband. Der Browser verbindet sich jetzt selbst neu, auch nach einer erneuten Anmeldung.

## [4.10.0] – 2026-10-31

### Hinzugefügt
- **Einstieg** (REQ-EDIT-015): Ein leeres Board bietet Notiz, Vorlage und Einladen an. Beim ersten Benutzen erklären kurze Hinweise Tab bei Notizen und Formeln in Tabellen.
- **Orientierung** (REQ-CANVAS-008): Das Frames-Panel zeigt Überschriften als Gliederung und gemerkte Ansichten, erreichbar über Alt+1 bis Alt+9 und die Befehlspalette.
- Der Filter kennt den Status von Karten (REQ-COLLAB-016).

### Geändert
- Große Boards laufen ruhiger (REQ-NFR-010): Ab 300 Elementen zeichnet der Browser nur noch, was in der Nähe der Ansicht liegt.

### Behoben
- CI: Die Paketprüfung wiederholt jetzt ohne npm-Cache und protokolliert beim Scheitern, was die Registry geliefert hat. Eine zwischengespeicherte Antwort ist die vermutete Ursache des zeitweiligen Fehlers EMISSINGSIGNATUREKEY; bestätigt ist das nicht.

## [4.9.0] – 2026-10-31

### Hinzugefügt
- **Befehlspalette** (REQ-EDIT-013): Strg+K sucht in Befehlen, Einstellungen, Frames, Vorlagen und Board-Inhalten.
- **Format übertragen** (REQ-EDIT-014): Pinsel in der Kontextleiste, Doppelklick für mehrere Ziele, Strg+Alt+C und Strg+Alt+V über die Tastatur.
- **Formeln in Tabellen** (REQ-ELEM-021): Eine Zelle mit „=“ rechnet, etwa `=SUMME(B2:B5)` oder `=B2*C2`. Beim Tippen zeigt die Tabelle Spalten- und Zeilennamen, ein Klick fügt den Bezug ein. Die Schaltfläche Σ erzeugt Summe, Mittelwert und mehr aus der Zellauswahl.
- `npm run test:formula` prüft die Formeln (auch im CI).

### Geändert
- Beim Einfügen und Löschen von Zeilen und Spalten passen sich Bezüge in Formeln an. Diagramme und der PowerPoint-Export verwenden die berechneten Werte.

## [4.8.0] – 2026-10-31

### Hinzugefügt
- **Position fixieren** (REQ-EDIT-010): Fixierte Elemente lassen sich nicht einzeln verschieben oder per Entf löschen, ihr Text bleibt bearbeitbar. Im Kontextmenü.
- **Frame samt Inhalt löschen** im Kontextmenü, auch mit gesperrten Teilen; rückgängig machbar.
- **Tab beim Tippen** legt die nächste Notiz oder Form gleicher Art daneben an und bleibt dabei in Spalte oder Frame (REQ-EDIT-011).
- **Werkzeug aktiv halten:** Doppelklick aufs Werkzeug oder Umschalt+Taste, Esc beendet (REQ-EDIT-012).
- Das Formen-Menü zeigt die zuletzt verwendeten Formen.
- **Angebote zur Vorlage** (REQ-TPL-010): Retro-Vorlagen bieten den geführten Ablauf an, Brainstorming und Crazy 8s den Timer. Nichts startet von selbst.
- **Kanban auf dem Board** (REQ-TPL-011): Eine Karte in eine andere Spalte zu ziehen setzt ihren Status. Karten aus Jira oder Azure DevOps bleiben davon ausgenommen.

### Geändert
- Vorlagen fixieren Beschriftungen nur noch; Spalten lassen sich direkt umbenennen (REQ-TPL-009). Hintergründe bleiben gesperrt.
- Gantt-Diagramm und Zeitstrahl bestehen aus Karten und erscheinen damit in der Zeitleiste.
- Wer einen Frame verschiebt, nimmt gesperrte und fixierte Teile darin mit; von der Moderation Gesperrtes bleibt stehen.

### Behoben
- Leere neue Mindmap-Knoten bleiben beim Beenden nicht mehr stehen.
- Vorlagen fielen beim Verschieben des Frames auseinander, weil gesperrte Hintergründe stehen blieben.

## [4.7.0] – 2026-10-31

### Hinzugefügt
- **Hinweise, woran andere gerade arbeiten** (REQ-COLLAB-004): Beim Verschieben, beim Ändern der Größe und im Kartendialog steht der Name am Element. Wer dieselbe Karte öffnet, sieht das im Dialog. Die Hinweise sperren nichts.

## [4.6.0] – 2026-10-31

### Hinzugefügt
- **Gleichzeitige Änderungen am selben Element** (REQ-COLLAB-019): Der Server legt die Reihenfolge fest, alle haben danach denselben Stand. Änderungen gehen als einzelne Felder, sodass sich Änderungen an verschiedenen Feldern nicht mehr überschreiben.
- `npm run test:sync` prüft den Abgleich mit zufälligen Abläufen (auch im CI).

### Behoben
- Scheiterten mehrere Pakete nacheinander, konnte beim erneuten Senden eine ältere Änderung eine neuere verdrängen, sogar eine Löschung.
- Ging die Antwort auf eine Tabellenänderung verloren, wurde sie beim erneuten Senden doppelt ausgeführt, eine Zelle dabei womöglich in der falschen Zeile.
- Zellen- und Zeilenänderungen im selben Paket kamen bei anderen vertauscht an.
- Scheiterte ein Paket, das nächste aber nicht, überschrieb das ältere beim erneuten Senden die neuere Änderung.
- Bei abgelaufener Sitzung oder Drosselung gehen Änderungen nicht mehr verloren, sie werden erneut gesendet.
- Abgelehnte Änderungen an einem vorhandenen Element löschen es beim Absender nicht mehr bis zum Neuladen, und der zurückgegebene Stand enthält das ganze Paket.

## [4.5.0] – 2026-10-31

### Hinzugefügt
- **Helm-Chart** (REQ-OPS-013) unter `deploy/helm/vibeboard`.
- **Automatischer Rechte-Test** (REQ-SEC-014): `npm run test:access` liest alle Routen aus dem Router und ruft sie mit echten Gegenständen und den Rollen ohne Anmeldung, fremd, Ansehen, Kommentieren und Gast auf; läuft bei Pushes auf `main` und Pull Requests.

### Sicherheit
- Dateien in verborgenen Bereichen und privaten Elementen sind nicht mehr über ihre Kennung abrufbar (Datei, Vorschau, Name, PDF), auch nicht über eine Kopie des Boards oder einer Version.
- Der Name an Elementen kommt vom Server; „anonym“ lässt sich nicht mehr selbst setzen.
- Die Moderationssperre gilt auch für das Löschen eigener Kommentare.
- Sichtbarkeit wird für neuen Code zentral in `boards.canSeeElement` entschieden.

### Geändert
- Privaten Modus beendet, wer ihn gestartet hat, der Besitzer oder die Moderation.

### Behoben
- Azure DevOps: Die Fälligkeit geht ans Work Item, Typen ohne Datumsfeld ergeben einen Hinweis statt eines Fehlers.
- Kopien eines Boards sind nicht mehr mit denselben Tickets verbunden.
- Kopfleiste verdeckt auf schmaleren Bildschirmen keine Knöpfe mehr, sie lässt sich bei Bedarf scrollen.
- Freigaben: Alle Änderungen an Verbindungen zählen, Rechenungenauigkeiten beim Ziehen entwerten nichts mehr.
- Dokumentseiten gehen auch mit, wenn der Frame per Tastatur oder in einer Mehrfachauswahl bewegt wird.
- Der Kartendialog überschreibt nur noch, was tatsächlich geändert wurde.
- PowerPoint-Import: Farben aus Formatvorlagen und aufgehellte Designfarben.
- Diagramme: „1e3“ gilt als Text, Klammern als negativ.
- Kanban und Zeitleiste: Fokus bleibt erhalten, Datumsfelder übernehmen erst beim Verlassen.

## [4.4.1] – 2026-10-31

### Behoben
- SAML: Gruppen, die als mehrere Attribute gleichen Namens kommen (Standard bei Keycloak), werden vollständig ausgewertet. Vorher griffen nötige Gruppe und Adminrechte in diesem Fall nicht.

## [4.4.0] – 2026-10-31

Schemaversion 10.

### Hinzugefügt
- **Dokumente auf dem Board prüfen** (REQ-UPL-006): Alle Seiten einer PDF-Datei als Bilder in einem Frame; Office-Dateien mit dem optionalen Dienst Gotenberg.
- **Freigaben** (REQ-COLLAB-018): Frames und Dateien vorlegen, entscheiden, Status am Element. Änderungen entwerten eine Freigabe.
- **Jira und Azure DevOps** (REQ-PROJ-008, REQ-ADMIN-013): Abgleich der Karten in beide Richtungen.
- **Automatisches Layout und Swimlanes** (REQ-EDIT-009).
- **Kanban und Zeitleiste** (REQ-PROJ-007) als Ansichten derselben Karten, mit Beginn-Datum.
- **Diagramme aus Tabellen** (REQ-ELEM-018): Balken, Linien, Torte.
- **Bilder zuschneiden, Stiftdruck, Skizzen zu Formen** (REQ-ELEM-019, REQ-ELEM-020).
- **Import aus draw.io und PowerPoint, Export nach PowerPoint** (REQ-IO).
- **SAML und SCIM** (REQ-AUTH-014, REQ-AUTH-015).
- **Designvorgaben und zentrale Vorlagen** (REQ-ADMIN-012, REQ-TPL-008).

### Geändert
- Neue Abhängigkeit `@node-saml/node-saml`.
- Große Änderungen werden in mehreren Paketen gesendet; Dialogschaltflächen und Kontextleiste reagieren auf Eingabe und Leertaste.

### Sicherheit
- Lange Adressen beim Teilen und Einladen können den Server nicht mehr blockieren (Fehler bestand schon vorher).
- Private und verborgene Inhalte bleiben aus Freigaben, Tickets und dem PowerPoint-Export heraus.
- SCIM ändert die Adresse lokaler Administratoren nicht.
- Entpacken von Office-Dateien ist auch bei gefälschten Größenangaben begrenzt.

## [4.3.2] – 2026-10-31

### Hinzugefügt
- **Automatische Updates über GitHub** (REQ-OPS-012): Dependabot für npm, GitHub Actions und das Basis-Image. Sicherheitsupdates
  kommen sofort, normale Updates erst nach sieben Tagen. Patch- und Minor-Updates werden nach grüner Prüfung automatisch übernommen.
- **Automatische Prüfung** bei jedem Push und Pull Request: Paketherkunft, Syntax, Wörterbücher, Upgrade-Test und Docker-Image.

### Sicherheit
- Basis-Image und GitHub Actions sind fest über ihren Hash eingebunden.

## [4.3.1] – 2026-10-31

### Behoben
- Chat-Anbindung: Unter dem Dialog stand „null“, solange Webhooks abgeschaltet sind.

### Geändert
- Sind Webhooks abgeschaltet, ist der Menüpunkt „Chat-Anbindung“ deaktiviert, auch in der Team-Verwaltung (REQ-COLLAB-017).

## [4.3.0] – 2026-10-31

Schemaversion 9.

### Hinzugefügt
- **Anmeldung über Keycloak** (REQ-AUTH-010): OpenID Connect mit PKCE, geprüftem ID-Token, Rollen und Gruppen für Zugang
  und Adminrechte sowie Abmeldung beim Dienst.
- **Anmeldung über LDAP und Active Directory** (REQ-AUTH-011): Felder sind für Active Directory vorbelegt, verschlüsselte
  Verbindung ist Pflicht, Gruppen steuern Zugang und Adminrechte.
- **Einmalanmeldung per Kerberos** (REQ-AUTH-012): SPNEGO direkt in der Anwendung, mit Keytab; mit LDAP kommen Adresse,
  Name und Gruppen aus dem Verzeichnis.
- **Mehrere Anmeldemethoden gleichzeitig** (REQ-AUTH-013, REQ-ADMIN-011): Bereich „Anmeldung“ in der Administration mit
  Verbindungstests. Lokale Administrator-Konten behalten immer einen Notzugang.
- **Zuletzt verwendete Vorlagen zuerst** (REQ-TPL-007) in allen Auswahlen, je Konto gespeichert.
- **Barrierefreiheit** (REQ-NFR-009): Dialoge mit Fokusführung, Menüs mit Pfeiltasten, sichtbarer Tastaturfokus,
  Sprunglinks, angesagte Meldungen und Auswahl, Elementliste als Textfassung des Boards, Kontraste nach WCAG 2.2 AA in
  hellem und dunklem Design, reduzierte Bewegung.
- **Kubernetes-Manifeste** (REQ-OPS-011) unter `deploy/kubernetes/`.

### Geändert
- Papierkorb zeigt Vorschaubilder (REQ-BOARD-009).
- Docker-Image: Abhängigkeiten werden in einer eigenen Stufe gebaut, die Kerberos-Anbindung wird für Alpine kompiliert.
- Anfragekopf bis 64 KB, weil Kerberos-Tickets aus Active Directory groß werden können.

### Sicherheit
- LDAP-Filterwerte werden maskiert, Anmeldungen ohne Kennwort abgelehnt und Fehlversuche je Verzeichniseintrag begrenzt.
- Admin-Konten werden nie automatisch mit einer externen Identität verknüpft; unbestätigte Adressen aus Keycloak übernehmen
  weder Konten noch Einladungen.
- Verknüpfte unbestätigte Konten verlieren ihr Kennwort (Schutz vor vorab angelegten Konten); ein eingerichteter zweiter Faktor gilt bei jeder Anmeldemethode; das letzte lokale Admin-Konto bleibt erhalten.
- Anmeldeseite: Zieladressen der Form `/.//host` führen nicht mehr auf fremde Seiten (Fehler bestand schon vorher).
- Die Rolle folgt nur bei rein externen Konten dem Verzeichnis, damit ein Notzugang nicht durch einen Gruppenabgleich verloren geht.

## [4.2.0] – 2026-10-30

Schemaversion 8.

### Hinzugefügt
- **Einladung an Adressen ohne Konto** (REQ-BOARD-010): Beim Teilen eines Boards oder Einladen ins Team fragt vibeboard
  bei unbekannten Adressen nach und verschickt auf Wunsch eine Einladungsmail. Nach der Registrierung über den Link ist
  das Board geteilt bzw. die Person im Team. Offene Einladungen lassen sich zurückziehen.
- **Mehrsprachigkeit** (REQ-NFR-008): Oberfläche, Vorlagen, Meldungen und E-Mails auf Englisch, Deutsch, Spanisch und
  Französisch. Die Sprache folgt dem Browser, Standard ist Englisch; Datum und Zahlen folgen der Browsersprache.
  `npm run check:i18n` prüft die Wörterbücher.
- CSV-Import erkennt auch spanische und französische Spaltennamen.

### Geändert
- `README.md` ist jetzt englisch; Fassungen auf Deutsch, Spanisch und Französisch liegen daneben.
- Vorlage „Sechs Perspektiven“: eigene Reihenfolge und Farben.
- Vorlage „Lean Coffee“ heißt jetzt „Offene Themenrunde“.
- Hinweise der Vorlagen Business Model Canvas und Lean Canvas: gut lesbar, mit Quelle und Lizenzadresse.
- Lizenzangabe: `(MIT AND CC-BY-SA-3.0)`, Copyright-Zeile in `LICENSE`; `LICENSE` und `THIRD_PARTY_NOTICES.md` liegen im
  Docker-Image.

### Entfernt
- Vorlage „Angebot & Kundenprofil“: Sie bildete ein Werk nach, dessen Nutzung in Software eine Erlaubnis braucht.
  Bestehende Boards bleiben unverändert.

## [4.1.0] – 2026-10-30

Schemaversion 7. Neue Abhängigkeit: pdfjs-dist (Apache-2.0).

### Hinzugefügt
- **Retro-Ablauf** (REQ-MOD-006): geführte Schritte von Check-in bis Abschluss; je Schritt stellt vibeboard die Werkzeuge
  ein (verdecktes Sammeln, Timer, Abstimmung, Besprechung, Umfragen).
- **Themengruppen und Besprechungsmodus** (REQ-MOD-007): Abstimmung über Themen, Themen der Reihe nach besprechen, Timer
  je Thema, Lean-Coffee-Abfrage „Weiter diskutieren?“.
- **Schnellumfragen** (REQ-MOD-008): Stimmungsbarometer, Fist of Five, ROTI, Team-Health-Check, eigene Frage – anonym,
  mit Verlauf über Retro-Serien.
- **Zufallsauswahl und Redereihenfolge** (REQ-MOD-009).
- **Verborgene Bereiche** (REQ-MOD-010): Frames, deren Inhalt der Server bis zum Aufdecken nur Moderierenden gibt.
- **Maßnahmen und Retro-Serien** (REQ-PROJ-005): Beitrag → Maßnahme mit Person und Fälligkeit, „Nächste Retro anlegen“,
  Rückblick auf offene Maßnahmen.
- **Retro-Zusammenfassung** (REQ-PROJ-006): Markdown, Druck/PDF, E-Mail an Beteiligte, Team-Kanal.
- **Reaktionen** auf Elemente (REQ-COLLAB-015), **Schlagwörter und Filteransicht** (REQ-COLLAB-016).
- **Chat-Anbindung per Webhook** (REQ-COLLAB-017): Microsoft Teams, Slack, Matrix, JSON; standardmäßig aus.
- **Dateianhänge** mit PDF-Vorschau und Betrachter (REQ-ELEM-017).
- **Papierkorb** für Boards (REQ-BOARD-009), **eigene Vorlagen** (REQ-TPL-006).
- Sieben Retro-Vorlagen: Seestern, DAKI, Zeitstrahl, Heißluftballon, Speedcar, Lean Coffee, Team-Radar (REQ-TPL-005).
- **Installierbare App (PWA)** mit Offline-Seite (REQ-NFR-007).

### Geändert
- Privater Modus: optional anonym – keine Namen, auch nicht nach dem Aufdecken (REQ-COLLAB-009).
- Karten speichern die zuständige Person auch als ID; „Meine Aufgaben“ unterscheidet so gleichnamige Personen.
- Löschen legt Boards in den Papierkorb, statt sie sofort zu entfernen.
- Das Werkzeug „Bild hochladen“ nimmt jetzt auch Dokumente an.
- Fehlerhafte JSON-Eingaben wie `null` liefern 400 statt 500.

### Behoben
- Private Beiträge, die während des Sammelns gelöscht und per Rückgängig wiederhergestellt wurden, wurden öffentlich.
- Schriftgrößen- und Kontextleiste auf schmalen Bildschirmen: Alle Knöpfe bleiben erreichbar (seitlich scrollbar).

### Sicherheit
- Webhooks: nur https, Sperre interner Ziele (auch in IPv6 eingebettete IPv4-Adressen), Verbindung nur an die geprüfte IP,
  keine Weiterleitungen, Adressen werden nicht protokolliert (REQ-SEC-012).
- Dateianhänge: Typprüfung am Inhalt, Virenscan, Auslieferung nur als Download mit Sandbox-CSP (REQ-SEC-013).

## [4.0.2] – 2026-10-30

### Behoben
- Vorschaubilder für Boards aus Vorlagen (REQ-IO-004): Sie entstanden erst vier Sekunden nach dem Öffnen des Boards –
  wer sofort zur Übersicht zurückging, sah keine Vorschau. Jetzt erzeugt die Startseite das Vorschaubild schon beim
  Anlegen; Boards ohne Vorschau (z. B. Importe) erzeugen es direkt nach dem Laden.

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
