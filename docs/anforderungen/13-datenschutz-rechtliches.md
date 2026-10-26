# 13 – Datenschutz und Rechtstexte

### REQ-LEGAL-001 Impressum und Datenschutzerklärung
- **Seit:** 3.1.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Beide Texte werden in der Administration („Rechtliches“) gepflegt, mit einfacher Formatierung (Überschriften, Absätze, Listen, fett, kursiv, Links) und Live-Vorschau.
  - Vorlagen zum Einfügen:
    - Impressum nach § 5 DDG
    - Datenschutzerklärung passend zur tatsächlichen Datenverarbeitung von vibeboard
    - Platzhalter in [eckigen Klammern], mit Hinweis, dass die Vorlagen keine Rechtsberatung ersetzen
  - Veröffentlichung unter `/impressum` und `/datenschutz`, ohne Anmeldung erreichbar, mit Stand-Datum.
  - Links auf der Anmelde- und Registrierungsseite, in der Übersicht, im Board-Menü und in der Administration – nur wenn ein Text hinterlegt ist.
  - Bei der Registrierung wird auf die Datenschutzerklärung hingewiesen.
  - Nur Administratoren können die Texte ändern.

### REQ-LEGAL-002 Datensparsamkeit
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Keine Tracking- oder Analysedienste, keine Ressourcen von Drittanbietern (Schriften, Skripte, CDNs).
  - Ausgehende Verbindungen nur zum konfigurierten Mailserver, zum Virenscanner und – falls aktiviert – zur Pwned-Passwords-API (nur 5 Zeichen eines Hashs).
  - Im Browser werden nur Ansichtseinstellungen im `localStorage` gespeichert; einziges Cookie ist das technisch notwendige Sitzungs-Cookie.

### REQ-LEGAL-003 Speicherfristen
- **Seit:** 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Sicherheitsprotokoll: 12 Monate. Abgelaufene Sitzungen und Einmal-Links: werden stündlich gelöscht.
  - Nie bestätigte Registrierungen: 14 Tage.
  - Sicherungen vor Upgrades: die letzten 10 (einstellbar).

### REQ-LEGAL-004 Rechte Dritter
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Lizenzen aller enthaltenen Inhalte Dritter (Icons, Datenlisten, Vorlagen-Adaptionen) sind in `THIRD_PARTY_NOTICES.md` dokumentiert.
  - Keine fremden Marken als Produkt- oder Vorlagenname.
