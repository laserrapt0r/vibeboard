# Anforderungen an vibeboard

Dieses Verzeichnis beschreibt **alle Funktionen von vibeboard als Anforderungen**. Es ist die verbindliche Grundlage
für Weiterentwicklung, Tests und Abnahme und wird **bei jeder neuen oder geänderten Funktion ergänzt** (siehe
[Pflege](#pflege-bei-neuen-funktionen)).

## Dokumente

| Nr. | Dokument | Bereich (ID-Präfix) |
|-----|----------|---------------------|
| 01 | [Leinwand und Navigation](01-leinwand-navigation.md) | `CANVAS` |
| 02 | [Board-Elemente](02-elemente.md) | `ELEM` |
| 03 | [Bearbeiten](03-bearbeiten.md) | `EDIT` |
| 04 | [Zusammenarbeit in Echtzeit](04-zusammenarbeit.md) | `COLLAB` |
| 05 | [Moderation und Präsentation](05-moderation.md) | `MOD` |
| 06 | [Vorlagen](06-vorlagen.md) | `TPL` |
| 07 | [Export und Import](07-export-import.md) | `IO` |
| 08 | [Board-Übersicht, Teilen und Rechte](08-boards-teilen.md) | `BOARD` |
| 09 | [Konten und Anmeldung](09-konten-anmeldung.md) | `AUTH` |
| 10 | [Administration](10-administration.md) | `ADMIN` |
| 11 | [Sicherheit](11-sicherheit.md) | `SEC` |
| 12 | [Datei-Uploads und Virenschutz](12-uploads-virenschutz.md) | `UPL` |
| 13 | [Datenschutz und Rechtstexte](13-datenschutz-rechtliches.md) | `LEGAL` |
| 14 | [Betrieb, Versionierung und Upgrades](14-betrieb-versionierung.md) | `OPS` |
| 15 | [Nicht-funktionale Anforderungen](15-nichtfunktional.md) | `NFR` |
| 16 | [Projektarbeit: Aufgaben und Versionen](16-projektarbeit.md) | `PROJ` |

## Aufbau einer Anforderung

```markdown
### REQ-BEREICH-NNN Kurzer Titel
- **Seit:** 3.1.0 · **Priorität:** Muss | Soll | Kann · **Status:** umgesetzt | geplant | entfallen
- **Beschreibung:** Was das System leisten muss und warum.
- **Akzeptanzkriterien:**
  - überprüfbare Aussage 1
  - überprüfbare Aussage 2
```

Regeln:
- **IDs sind dauerhaft.** Eine ID wird nie neu vergeben und nie umnummeriert. Entfällt eine Anforderung, bleibt sie mit
  Status `entfallen` und Begründung stehen.
- **„Seit“** nennt die Version, in der die Anforderung erstmals umgesetzt wurde. Wesentliche Änderungen werden
  zusätzlich mit „Geändert in x.y.z: …“ vermerkt.
- **Priorität:** *Muss* = für den Betrieb unverzichtbar, *Soll* = wichtig, *Kann* = Komfort.
- **Akzeptanzkriterien** sind so formuliert, dass sie sich im Browser, per API oder per Test prüfen lassen.

## Pflege bei neuen Funktionen

Eine neue oder geänderte Funktion gilt erst als fertig, wenn:

1. die Anforderung im passenden Dokument ergänzt bzw. angepasst ist (neue ID, „Seit“ = neue Version);
2. die **Versionsnummer** in `package.json` nach [REQ-OPS-001](14-betrieb-versionierung.md) erhöht ist;
3. ein Eintrag im [CHANGELOG](../../CHANGELOG.md) steht;
4. Änderungen am Datenbankschema als **neue Migration** angelegt sind (bestehende Migrationen werden nie verändert,
   siehe [REQ-OPS-004](14-betrieb-versionierung.md)) und der Upgrade-Test `npm run test:upgrade` besteht;
5. README und – falls betroffen – die Datenschutz-Vorlage aktualisiert sind.

Neue Bereiche erhalten ein eigenes Dokument mit der nächsten freien Nummer und einem neuen ID-Präfix. Sie werden in die
Tabelle oben aufgenommen.
