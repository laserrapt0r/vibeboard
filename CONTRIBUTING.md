# Mitarbeit an vibeboard

Diese Regeln gelten für jede Änderung – egal ob von Menschen oder mit KI-Unterstützung.

## Definition of Done für neue oder geänderte Funktionen

Eine Änderung ist erst fertig, wenn alle Punkte erfüllt sind:

1. **Anforderungen dokumentiert:** Die Funktion ist in `docs/anforderungen/` beschrieben, mit neuer, dauerhafter ID,
   „Seit“-Version, Priorität und prüfbaren Akzeptanzkriterien. Geänderte Anforderungen erhalten den Vermerk
   „Geändert in x.y.z: …“. Format und Regeln: [docs/anforderungen/README.md](docs/anforderungen/README.md).
2. **Version erhöht:** `version` in `package.json` nach Semantic Versioning (neue Funktion → MINOR, Fehlerbehebung →
   PATCH, inkompatible Änderung → MAJOR). Die Version steigt immer und wird nie wiederverwendet. Danach
   `npm install --package-lock-only`, damit `package-lock.json` passt.
3. **CHANGELOG ergänzt:** Abschnitt für die neue Version in `CHANGELOG.md` (Hinzugefügt, Geändert, Behoben, Entfernt,
   Sicherheit).
4. **Datenbank nur per Migration:** Schemaänderungen als **neue** Migration am Ende von `MIGRATIONS` in `lib/db.js`.
   - Bestehende Migrationen werden nie verändert.
   - Migrationen erhalten vorhandene Daten: neue Spalten mit Standardwert oder Befüllung, Umbenennungen mit
     Übernahme der Daten.
   - Für die neue Schemaversion Beispieldaten in `SEEDS` von `scripts/test-upgrade.js` ergänzen.
   - `npm run test:upgrade` muss gegen eine Test-Datenbank bestehen.
5. **Neue Einstellungen** mit sicherem Standardwert in `lib/settings.js`; bestehende Installationen müssen ohne Zutun
   weiterlaufen.
6. **Sicherheit:**
   - Eingaben auf dem Server prüfen, Rechte auf dem Server prüfen.
   - Keine Inline-Skripte (Content-Security-Policy).
   - Hochgeladene Dateien über `lib/uploads.js` prüfen.
   - Neue Abhängigkeiten nur, wenn nötig: auf Lizenz und `npm audit` prüfen, in `THIRD_PARTY_NOTICES.md` aufnehmen.
   - Protokollierung nur über `lib/log.js` (kein `console.*` im Server):
     - je Modul `require('./log').child('komponente')`;
     - Text kurz und fest, Werte als Felder (`log.info('Board gespeichert', { boardId })`), Fehler als `err`;
     - passende Stufe wählen: `error` für Fehler, die jemand beheben muss; `warn` für Auffälliges ohne Ausfall;
       `info` für wichtige Abläufe; `debug`/`trace` für Details zur Fehlersuche;
     - keine Kennwörter, Tokens, Inhalte von Boards, E-Mail- oder IP-Adressen protokollieren.
7. **Dokumentation:** README aktualisieren. Bei neuer Verarbeitung personenbezogener Daten zusätzlich die
   Datenschutz-Vorlage in `public/js/legal-templates.js` anpassen.
8. **Mehrsprachig:** Neue Texte der Oberfläche im Code auf Deutsch mit `T('…')` bzw. ``T`… ${wert}` `` markieren und in
   allen Wörterbüchern ergänzen (`public/i18n/en.json`, `es.json`, `fr.json`). Mehrzahl als zwei vollständige Texte
   schreiben, nicht aus Endungen zusammensetzen. Meldungen des Servers und E-Mails bleiben im Code deutsch und werden
   beim Ausgeben übersetzt (`lib/i18n.js`) – auch sie gehören in die Wörterbücher. `npm run check:i18n` muss bestehen.
9. **Getestet:** Neue Funktion im Browser und, falls betroffen, mit mehreren Personen gleichzeitig sowie im Rückfall-Transport
   (`?transport=poll`) geprüft.

## Automatische Updates

Dependabot-Pull-Requests sind von Punkt 1 bis 3 der Definition of Done ausgenommen: Sie ändern nur Abhängigkeiten und gehen mit
der nächsten Version ins CHANGELOG. Wer eine Änderung ohne Dependabot macht, befolgt die Liste vollständig.

## Zugriffsrechte

Rechte werden nicht im Einzelfall geprüft und gehofft, sondern automatisch abgesichert:

- **Sichtbarkeit von Elementen** entscheidet nur `boards.canSeeElement(b, el, uid, role)`. Elemente in `b.elements` sind ungeschwärzt.
  Das Feld `hidden` gibt es nur im Browser, im Server ist es nie gesetzt.
- **`npm run test:access`** läuft bei jedem Push: Jede Route wird automatisch aus dem Router gelesen und mit jeder Rolle aufgerufen. Neue
  Routen sind damit ohne Zutun erfasst. Eine Route, die ohne Anmeldung oder für Fremde etwas liefert, lässt den Test fehlschlagen,
  bis sie bewusst in `scripts/test-access.js` eingetragen und begründet ist. Geheime Testmarken in privaten und verborgenen Inhalten
  dürfen in keiner Antwort auftauchen.

## Upgrade-Test ausführen

```bash
# Gegen eine leere Test-Datenbank (legt Schemata vb_test_* an und entfernt sie wieder)
DATABASE_URL=postgres://benutzer:kennwort@localhost:5432/vibeboard_test npm run test:upgrade
```

## Konventionen

- Quellsprache der Oberfläche und Meldungen sowie Sprache von Kommentaren und Anforderungen: Deutsch. Die Oberfläche
  gibt es auf Englisch, Deutsch, Spanisch und Französisch; die Sprache folgt dem Browser, Standard ist Englisch.
- `README.md` ist die englische Hauptfassung; `README.de.md`, `README.es.md` und `README.fr.md` werden mitgepflegt.
- Code-Stil wie im bestehenden Code (2 Leerzeichen, einfache Anführungszeichen, Semikolons).
- Commit-Nachrichten auf Deutsch, erste Zeile als knappe Zusammenfassung.
