# 06 – Vorlagen

### REQ-TPL-001 Vorlagen-Bibliothek
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Mindestens 35 fertige Vorlagen in den Kategorien Brainstorming, Meetings & Retros, Agile & Projekte, Strategie, Design & UX und Diagramme.
- **Geändert in 3.2.0:** Mindestens 65 Vorlagen; neue Kategorien:
  - **Softwareentwicklung:** Sprint-Planung, Entwicklungs-Kanban mit WIP-Limits, Definition of Ready & Done, Architektur (C4-Kontext), Sequenzdiagramm, ER-Diagramm, Event Storming, Bug-Triage, Tech-Debt-Matrix, Release-Planung, API-Design, Architekturentscheidung (ADR).
  - **Projektmanagement:** Projekt-Kick-off, Risikomatrix, RAID-Log, Projektstatus, Meilensteinplan, RACI-Matrix, Teamübergreifende Planung, Lessons Learned.
  - **IT-Service-Management:** Incident-Postmortem, Major-Incident-Lagezentrum, Problem-Analyse (Ist / Ist nicht), Change-Request & CAB, Service Blueprint, SIPOC, Wertstromanalyse, Service-Katalog, On-Call-Übergabe, Runbook, SLA-/Service-Review.
- **Geändert in 3.6.0:** Mindestens 75 Vorlagen; neue Kategorien:
  - **UML:** Klassendiagramm, Anwendungsfalldiagramm, Aktivitätsdiagramm (mit Verantwortungsbereichen), Zustandsdiagramm, Komponentendiagramm, Verteilungsdiagramm; das Sequenzdiagramm wechselt in diese Kategorie.
  - **IT-Infrastruktur:** Netzwerkplan, Rack-Belegung, Container-Plattform (Cluster).
  - **IT-Service-Management:** zusätzlich Prozessmodell (BPMN): Störung.
- **Akzeptanzkriterien:**
  - Jede Vorlage liegt in einem benannten Frame und besteht aus normalen, bearbeitbaren Elementen.
  - Hintergrundflächen von Vorlagen sind gesperrt, damit Inhalte darauf abgelegt werden können.
  - Enthaltene Verbindungen verweisen nur auf Elemente derselben Vorlage.

### REQ-TPL-002 Vorlagen-Galerie
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Vorschaubild, Name und Beschreibung je Vorlage; Filter nach Kategorie; Suche in Name und Beschreibung.
  - Geändert in 3.1.0: Bei vielen Vorlagen (Kategorie „Alle“) scrollt die Galerie; alle Karten werden in voller Höhe dargestellt – auf Desktop und Smartphone.

### REQ-TPL-003 Vorlage einfügen bzw. Board aus Vorlage
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - In der Übersicht entsteht ein neues Board aus einer Vorlage; im Board wird die Vorlage eingefügt.
  - Eingefügte Vorlagen überlappen bestehende Inhalte nicht (Platzierung rechts daneben oder darunter) und die Ansicht springt dorthin.

### REQ-TPL-004 Rechte Dritter
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Vorlagen nach Werken unter freien Lizenzen enthalten die erforderliche Namensnennung auf dem Board (Business Model Canvas, Lean Canvas: CC BY-SA 3.0).
  - Geschützte Marken werden nicht als Vorlagenname verwendet.
  - Geändert in 4.2.0: Die Vorlage „Angebot & Kundenprofil“ ist entfernt (Nachbildung eines geschützten Canvas ohne Erlaubnis). „Offene Themenrunde“ ersetzt einen möglicherweise geschützten Namen; „Sechs Perspektiven“ hat eine eigene Reihenfolge und eigene Farben. Hinweise der CC-Vorlagen nennen Quelle, Lizenz und Lizenzadresse gut lesbar.

### REQ-TPL-005 Weitere Retro-Vorlagen
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Neu: Seestern, DAKI, Zeitstrahl, Heißluftballon, Speedcar, Offene Themenrunde, Team-Radar (Kategorie „Meetings & Retros“).

### REQ-TPL-007 Zuletzt verwendete Vorlagen zuerst
- **Seit:** 4.3.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Alle Vorlagen-Auswahlen (Galerie im Board und auf der Startseite, Schnellauswahl, „+ Neues Board“) zeigen zuletzt verwendete Vorlagen zuerst, die jüngste vorn.
  - Auch eigene Vorlagen zählen; „Leeres Board“ bleibt an erster Stelle und zählt nicht.
  - Die Reihenfolge gehört zum Konto und gilt auf allen Geräten. Die Schnellauswahl behält ihre Länge.
  - In der Galerie sind zuletzt verwendete Vorlagen gekennzeichnet; gelöschte Vorlagen werden übersprungen.

### REQ-TPL-006 Eigene Vorlagen
- **Seit:** 4.1.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Ein Board oder die Auswahl lässt sich als persönliche Vorlage oder als Vorlage eines eigenen Teams speichern (Name, Symbol, Beschreibung).
  - Nicht übernommen werden Kommentare, Dateianhänge, Reaktionen, Autorennamen, Zuweisungen, Moderationssperren und private Inhalte. Geändert in 4.8.0: Klargestellt, dass eigene Sperren und Fixierungen erhalten bleiben; sie gehören zum Aufbau einer Vorlage. Bilder werden geprüft. Höchstens 10 MB und 100 Vorlagen je Person bzw. Team.
  - Die Galerie (Startseite und Board) zeigt sie unter „Eigene Vorlagen“ mit Vorschau. Team-Vorlagen sehen alle Mitglieder.
  - Löschen dürfen, wer sie angelegt hat, und bei Team-Vorlagen die Team-Verwaltung.

### REQ-TPL-008 Zentrale Vorlagen
- **Seit:** 4.4.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Administratoren speichern Vorlagen für die ganze Installation; sie erscheinen bei allen unter „Unsere Vorlagen“. Nur die Administration legt sie an und löscht sie (serverseitig geprüft).
  - Auf Wunsch werden nur zentrale und eigene Vorlagen angeboten.

### REQ-TPL-009 Sperren in Vorlagen
- **Seit:** 4.8.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Hintergründe von Vorlagen sind gesperrt. Beschriftungen sind nur fixiert ([REQ-EDIT-010](03-bearbeiten.md)): Ihr Text lässt sich direkt ändern.
  - Bestehende Boards und eigene Vorlagen bleiben unverändert.

### REQ-TPL-010 Angebote zur Vorlage
- **Seit:** 4.8.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Nach dem Einfügen oder beim ersten Öffnen eines Boards aus der Vorlage erscheint ein Hinweis mit Schaltfläche: Retro-Vorlagen bieten den geführten Ablauf an, Brainstorming 10 Minuten Timer mit Privatmodus, Crazy 8s 8 Minuten Timer.
  - Nichts startet ohne Klick. Das Angebot sehen nur Personen, die steuern dürfen, und nicht, wenn bereits ein Retro-Ablauf oder Timer läuft. Läuft beim Klick inzwischen einer, bleibt er unverändert.

### REQ-TPL-011 Kanban auf dem Board
- **Seit:** 4.8.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Zieht man Karten auf dem Board in eine andere Kanban-Spalte der Vorlagen „Kanban-Board“ und „Entwicklungs-Kanban“, erhalten sie deren Überschrift als Status, ohne führendes Emoji und ohne Zusatz nach „·“ (z. B. WIP-Limit). Das lässt sich zusammen mit dem Verschieben rückgängig machen. Liegende Karten behalten nach dem Umbenennen einer Spalte ihren Status bis zum nächsten Wechsel.
  - Züge innerhalb einer Spalte und Karten außerhalb einer Spalte ändern den Status nicht. Karten aus Jira oder Azure DevOps bleiben ausgenommen: Ihr Status kommt aus dem Ticket. Eine Statusänderung in der Kanban-Ansicht verschiebt die Karte auf dem Board nicht.
  - Gantt-Diagramm und Zeitstrahl bestehen aus Karten mit Terminen. Die Lage auf dem Board ändert die Termine nicht.
