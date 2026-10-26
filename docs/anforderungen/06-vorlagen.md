# 06 – Vorlagen

### REQ-TPL-001 Vorlagen-Bibliothek
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Mindestens 35 fertige Vorlagen in den Kategorien Brainstorming, Meetings & Retros, Agile & Projekte, Strategie, Design & UX und Diagramme.
- **Geändert in 3.2.0:** Mindestens 65 Vorlagen; neue Kategorien:
  - **Softwareentwicklung:** Sprint-Planung, Entwicklungs-Kanban mit WIP-Limits, Definition of Ready & Done, Architektur (C4-Kontext), Sequenzdiagramm, ER-Diagramm, Event Storming, Bug-Triage, Tech-Debt-Matrix, Release-Planung, API-Design, Architekturentscheidung (ADR).
  - **Projektmanagement:** Projekt-Kick-off, Risikomatrix, RAID-Log, Projektstatus, Meilensteinplan, RACI-Matrix, Teamübergreifende Planung, Lessons Learned.
  - **IT-Service-Management:** Incident-Postmortem, Major-Incident-Lagezentrum, Problem-Analyse (Ist / Ist nicht), Change-Request & CAB, Service Blueprint, SIPOC, Wertstromanalyse, Service-Katalog, On-Call-Übergabe, Runbook, SLA-/Service-Review.
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
  - Geschützte Marken werden nicht als Vorlagenname verwendet (z. B. „Sechs Perspektiven“ statt „Six Thinking Hats“).
