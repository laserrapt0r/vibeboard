# Hinweise zu Inhalten Dritter

vibeboard steht unter der MIT-Lizenz (siehe `LICENSE`). Einige Bestandteile stammen von Dritten oder basieren auf
Arbeiten Dritter. Für sie gelten die folgenden Lizenzen.

## Icons

Ein Teil der Icon-Pfade in `public/js/util.js` stammt aus den Icon-Sets **Lucide** (https://lucide.dev) bzw.
**Feather** (https://feathericons.com) oder ist an sie angelehnt.

### Lucide – ISC License

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### Feather – MIT License

```
The MIT License (MIT)

Copyright (c) 2013-2017 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Datenlisten

| Datei | Quelle | Lizenz |
|-------|--------|--------|
| `lib/data/disposable-domains.txt` | [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) – Liste bekannter Wegwerf-E-Mail-Domains | CC0 1.0 (gemeinfrei) |
| `lib/data/common-passwords.txt` | [SecLists](https://github.com/danielmiessler/SecLists), `Passwords/Common-Credentials/10k-most-common.txt` | MIT, Copyright (c) 2018 Daniel Miessler |

### SecLists – MIT License

```
MIT License

Copyright (c) 2018 Daniel Miessler

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Vorlagen

Die Vorlagen geben bekannte Arbeitsmethoden wieder (z. B. SWOT, Kanban, Eisenhower-Matrix, Ishikawa-Diagramm).
Die Methoden selbst sind frei nutzbar. Text, Gestaltung und Umsetzung der Vorlagen sind eigene Arbeit.

Zwei Vorlagen sind Adaptionen von Werken unter **Creative Commons Namensnennung – Weitergabe unter gleichen
Bedingungen 3.0** (CC BY-SA 3.0, https://creativecommons.org/licenses/by-sa/3.0/):

| Vorlage | Original | Änderungen |
|---------|----------|------------|
| Business Model Canvas | „Business Model Canvas“ von Strategyzer AG, https://www.strategyzer.com | Übersetzung ins Deutsche, eigene Leitfragen, digitales Layout |
| Lean Canvas | „Lean Canvas“ von Ash Maurya, https://leanstack.com (Abwandlung des Business Model Canvas) | Übersetzung ins Deutsche, eigene Leitfragen, digitales Layout |

Diese beiden Vorlagen (die Funktionen `bmc` und `lean` in `public/js/templates.js` und die daraus erzeugten
Board-Inhalte) stehen deshalb ebenfalls unter CC BY-SA 3.0. Die Namensnennung erscheint auch auf dem Board.

Produkt- und Methodennamen gehören ihren jeweiligen Inhabern. Ihre Nennung dient nur der Beschreibung.

## Laufzeit-Abhängigkeiten

Diese Pakete sind nicht im Repository enthalten. Sie werden bei der Installation über npm bezogen.

| Paket | Lizenz |
|-------|--------|
| [pg](https://github.com/brianc/node-postgres) (inkl. pg-pool, pg-protocol, pg-types, pg-connection-string, pgpass, postgres-array, postgres-bytea, postgres-date, postgres-interval, xtend, pg-cloudflare) | MIT |
| split2, pg-int8 | ISC |
| [nodemailer](https://nodemailer.com) | MIT-0 |
| [uqr](https://github.com/unjs/uqr) (QR-Codes für die Zwei-Faktor-Einrichtung) | MIT |
| [pdfjs-dist](https://mozilla.github.io/pdf.js/) (Mozilla pdf.js – Vorschau von PDF-Anhängen im Browser; der Server liefert die Dateien `build/pdf.min.mjs` und `build/pdf.worker.min.mjs` unverändert unter `/vendor/pdfjs/` aus, der Lizenztext liegt im Paket) | Apache-2.0 |

Die Docker-Konfiguration verwendet die öffentlichen Images `node` (Node.js, MIT), `postgres` (PostgreSQL License),
`clamav/clamav` (ClamAV, GPL-2.0) und optional `axllent/mailpit` (MIT). Das Anwendungs-Image enthält zusätzlich die
PostgreSQL-Clientprogramme (`pg_dump`, PostgreSQL License) aus den Alpine-Paketquellen. ClamAV läuft als eigenständiger
Dienst und wird über das Netzwerkprotokoll angesprochen; es ist nicht Teil des vibeboard-Codes. Für diese Images gelten
die Lizenzen ihrer Herausgeber.

## Externe Dienste

Optional (in der Administration abschaltbar, standardmäßig aus): Abgleich neuer Kennwörter mit der Datenbank von
[Have I Been Pwned](https://haveibeenpwned.com/Passwords) über die Pwned-Passwords-API. Übertragen werden nur die
ersten fünf Zeichen eines SHA-1-Hashs (k-Anonymität).

## Schriften und Emojis

vibeboard liefert keine Schriftdateien aus. Texte und Emojis werden mit den Schriften des Betriebssystems bzw.
Browsers dargestellt.

## Diagramm aus Text, Methoden und Vorlagen

- **Diagramm aus Text** versteht die Schreibweise der Diagrammsprache von [Mermaid](https://mermaid.js.org/)
  (Open-Source-Projekt, MIT-Lizenz). vibeboard enthält keinen Code von Mermaid; Parser und Layout sind eine eigene
  Umsetzung. Der Name wird nur genannt, um die unterstützte Schreibweise zu beschreiben.
- Die Vorlagen bilden allgemein bekannte Methoden nach, die keinem Schutzrecht unterliegen (z. B. Schätzrunden mit
  verdeckten Karten, RACI, SIPOC, Event Storming, C4-Kontextdiagramm, Service Blueprint, Ist/Ist-nicht-Analyse). Inhalte, Texte und
  Gestaltung sind eigene Werke. Die Begriffe der Prozesse (z. B. Incident-, Problem- und Change-Management) folgen dem
  allgemeinen Sprachgebrauch; es werden keine Inhalte aus lizenzpflichtigen Rahmenwerken übernommen.
- Die Formen (Server, Container, Firewall usw.) und Programm-Symbole sind eigene Zeichnungen. Es werden keine
  geschützten Hersteller-Symbole (z. B. von Cloud-Anbietern) verwendet.
