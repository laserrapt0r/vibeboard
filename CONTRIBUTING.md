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
7. **Dokumentation:** README aktualisieren. Bei neuer Verarbeitung personenbezogener Daten zusätzlich die
   Datenschutz-Vorlage in `public/js/legal-templates.js` anpassen.
8. **Getestet:** Neue Funktion im Browser und, falls betroffen, mit mehreren Personen gleichzeitig sowie im Rückfall-Transport
   (`?transport=poll`) geprüft.

## Upgrade-Test ausführen

```bash
# Gegen eine leere Test-Datenbank (legt Schemata vb_test_* an und entfernt sie wieder)
DATABASE_URL=postgres://benutzer:kennwort@localhost:5432/vibeboard_test npm run test:upgrade
```

## Konventionen

- Sprache der Oberfläche, Meldungen, Kommentare und Dokumentation: Deutsch.
- Code-Stil wie im bestehenden Code (2 Leerzeichen, einfache Anführungszeichen, Semikolons).
- Commit-Nachrichten auf Deutsch, erste Zeile als knappe Zusammenfassung.
