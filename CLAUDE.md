# Hinweise für Claude Code

vibeboard ist ein selbst gehostetes, kollaboratives Whiteboard (Node.js, PostgreSQL, Frontend ohne Build-Schritt).
Überblick: [README.md](README.md). Anforderungen: [docs/anforderungen/](docs/anforderungen/README.md).

## Verbindliche Regeln bei jeder neuen oder geänderten Funktion

@CONTRIBUTING.md

Kurz: Anforderung in `docs/anforderungen/` ergänzen → Version in `package.json` erhöhen → CHANGELOG → Schemaänderungen
nur als neue Migration (+ Seed in `scripts/test-upgrade.js`, Test muss bestehen) → README/Datenschutz-Vorlage
aktualisieren → testen.

## Technische Eckpunkte

- Server: `server.js`, Module in `lib/`, REST-Routen in `lib/routes/`. Keine Frameworks.
- Datenbank-Migrationen: `MIGRATIONS` in `lib/db.js` (nur anhängen). Upgrade-Ablauf: `lib/version.js`.
- Echtzeit: Server-Sent Events mit Long-Polling-Rückfall (`lib/boards.js`, `public/js/sync.js`).
- Ändernde API-Aufrufe brauchen den Header `X-Vibeboard: 1`; im Frontend immer `api()` aus `public/js/util.js` verwenden.
- Formeln in Tabellen: `public/js/table-formula.js` (eigener Parser, nur beim Anzeigen gerechnet; `npm run test:formula`).
- Abgleich gleichzeitiger Änderungen: `public/js/merge.js` (`npm run test:sync`).
- Board-Elemente werden in `lib/sanitize.js` (Server) und `safeEl()` in `public/js/render.js` (Darstellung) geprüft.
- Uploads (Bilder als Data-URL) laufen durch `lib/uploads.js` (Dateityp + ClamAV).
- Content-Security-Policy erlaubt keine Inline-Skripte und keine fremden Quellen.
- Texte: Quellsprache Deutsch, im Browser mit `T` aus `public/js/i18n.js` markiert, Wörterbücher in `public/i18n/`
  (`npm run check:i18n`). Server und E-Mails übersetzen beim Ausgeben über `lib/i18n.js`.
