'use strict';
// Prüft Formeln in Tabellen: Rechnen, Fehler, Sonderfälle und die Anpassung der Bezüge. Aufruf: npm run test:formula
const F = require('../public/js/table-formula.js');
const TableOps = require('../public/js/table-ops.js');

let failed = 0, count = 0;
const eq = (name, got, want) => {
  count++;
  if (got === want || (Number.isNaN(got) && Number.isNaN(want))) return;
  failed++;
  console.error(`✗ ${name}: erwartet ${JSON.stringify(want)}, erhalten ${JSON.stringify(got)}`);
};

const table = (cells) => ({ type: 'table', rows: cells.length, cols: Math.max(...cells.map((r) => r.length)), cells, w: 300, h: 100 });
const calc = (cells, r = 0, c = 0, locale = 'de') => F.compute(table(cells)).text(r, c, locale);
const one = (formula, rest = []) => calc([[formula], ...rest]);

// Rechnen
eq('Punkt vor Strich', one('=1+2*3'), '7');
eq('Klammern', one('=(1+2)*3'), '9');
eq('Potenz rechts gebunden', one('=2^3^2'), '512');
eq('Vorzeichen', one('=-2^2'), '4');
eq('Prozent', one('=50%*200'), '100');
eq('Rundungsrauschen', one('=0.1+0.2'), '0,3');
eq('Englische Anzeige', calc([['=1/4']], 0, 0, 'en'), '0.25');
eq('Dezimalkomma außerhalb von Klammern', one('=1,5*2'), '3');
eq('Dezimalkomma mit Semikolon', one('=SUMME(1,5;2)'), '3,5');
eq('Komma trennt ohne Semikolon', one('=SUM(1,5)'), '6');
eq('Dezimalkomma mit deutscher Funktion', one('=SUMME(1,5+2,5)'), '4');
eq('Dezimalkomma beim Runden', one('=RUNDEN(10*1,19)'), '12');
eq('Neutrale Funktion trennt', one('=MAX(1,5)'), '5');
eq('Vergleich liefert 1', one('=2>1'), '1');
eq('Text in Anführungszeichen', one('=WENN(1>2;"ja";"nein")'), 'nein');
eq('Englisches IF mit Kommas', one('=IF(2>1,10,20)'), '10');

// Bezüge und Funktionen
const data = [['Name', 'Wert'], ['a', '10'], ['b', '20,5'], ['c', 'Text'], ['d', ''], ['Summe', '=SUMME(B2:B5)']];
eq('Summe überspringt Text und Leeres', calc(data, 5, 1), '30,5');
eq('Kleinschreibung', one('=summe(b2:b3)', [['', '1'], ['', '2']]), '3');
eq('Absolute Bezüge', one('=$B$2+B$3', [['', '1'], ['', '2']]), '3');
eq('Mittelwert', one('=MITTELWERT(B2:B3)', [['', '10'], ['', '20']]), '15');
eq('Anzahl', one('=ANZAHL(B2:B4)', [['', '1'], ['', 'x'], ['', '']]), '1');
eq('Anzahl2', one('=ANZAHL2(B2:B4)', [['', '1'], ['', 'x'], ['', '']]), '2');
eq('Min und Max', one('=MAX(B2:B3)-MIN(B2:B3)', [['', '1'], ['', '5']]), '4');
eq('Runden', one('=RUNDEN(2,345;2)'), '2,35');
eq('Runden negativ', one('=RUNDEN(-2,5;0)'), '-3');
eq('Abs', one('=ABS(-3)'), '3');
for (const [name, f] of [['Spanisch', '=SUMA(1;2)'], ['Französisch', '=SOMME(1;2)'], ['Englisch', '=SUM(1;2)']]) eq(name, one(f), '3');
eq('Bezug auf Formel', calc([['=A2*2'], ['=A3+1'], ['4']]), '10');
eq('Tausendertrenner in Zelle', one('=B2*2', [['', '1.000']]), '2000');
eq('Währung in Zelle', one('=B2+1', [['', '12 €']]), '13');
eq('Leere Zelle zählt null', one('=B2+1', [['', '']]), '1');

// Stille Rechenfehler vermeiden
eq('Leere Zelle gleich leerem Text', one('=WENN(B2="";"leer";"voll")', [['', '']]), 'leer');
eq('Gefüllte Zelle ungleich leerem Text', one('=WENN(B2="";"leer";"voll")', [['', 'x']]), 'voll');
eq('Leere Zelle gleich null', one('=B2=0', [['', '']]), '1');
eq('Prozentzelle', one('=A2*B2', [['100', '19 %']]), '19');
eq('Prozentsumme', one('=SUMME(B2:B3)', [['', '10 %'], ['', '20 %']]), '0,3');
eq('Datum ist keine Zahl', one('=B2+1', [['', '01.02.2024']]), '#VALUE!');
eq('Datum in Summe übergangen', one('=SUMME(B2:B4)', [['', '01.02.2024'], ['', '5'], ['', '2 Stück']]), '5');
eq('Datum zählt nicht', one('=ANZAHL(B2:B3)', [['', '12.10.'], ['', '5']]), '1');
eq('Version ist keine Zahl', one('=SUMME(B2:B2)', [['', '1.2.3']]), '0');
eq('Mehrfach-Tausender', one('=B2+0', [['', '1.234.567']]), '1234567');
eq('Tausender mit Dezimalen', one('=B2+0', [['', '1.234,50']]), '1234,5');
eq('Große Zahl bleibt genau', one('=1234567890123+1'), '1234567890124');
eq('Kleine Zahl bleibt sichtbar', calc([['=0.0000001']], 0, 0, 'en'), '0.0000001');
eq('Rundung ohne Zuschlag', one('=RUNDEN(1,0049999999999;2)'), '1');
eq('Halbe Werte', one('=RUNDEN(1,005;2)'), '1,01');
eq('Anzahl übergeht Fehler', calc([['=ANZAHL(A2:A3)'], ['=1/0'], ['5']]), '1');
eq('Anzahl2 zählt Fehlerzelle', calc([['=ANZAHL2(A2:A3)'], ['=1/0'], ['5']]), '2');
eq('Lange Kette ohne falschen Kreis', (() => {
  const cells = Array.from({ length: 200 }, (_, r) => ['=B' + (r + 1) + '+1', '=C' + (r + 1) + '+1', r === 199 ? '1' : `=A${r + 2}+1`]);
  return calc(cells);
})(), '600');

// Fehler
eq('Division durch null', one('=1/0'), '#DIV/0!');
eq('Mittelwert ohne Zahlen', one('=MITTELWERT(B2:B2)', [['', 'x']]), '#DIV/0!');
eq('Text beim Rechnen', one('=B2+1', [['', 'abc']]), '#VALUE!');
eq('Unbekannte Funktion', one('=FOO(1)'), '#NAME?');
eq('Bezug außerhalb', one('=Z9'), '#REF!');
eq('Selbstbezug', one('=A1'), '#CYCLE!');
eq('Kreis über zwei Zellen', calc([['=B1', '=A1']]), '#CYCLE!');
eq('Kreis im Bereich', calc([['=SUMME(A1:A2)'], ['1']]), '#CYCLE!');
eq('Fehler pflanzt sich fort', calc([['=A2+1'], ['=1/0']]), '#DIV/0!');
eq('Bereich ohne Funktion', one('=B1:B2'), '#VALUE!');
eq('Sehr große Zahl', one('=10^400'), '#NUM!');
eq('Gelöschter Bezug', one('=#REF!+1'), '#REF!');

// Bestehende Inhalte bleiben Text
for (const t of ['=', '== Titel ==', '=1+', '=(1', '=a b', 'x=1', '=SUMME(1', '= =', '=🙂']) eq(`bleibt Text: ${t}`, one(t), t);
eq('Zelle ohne Formel', calc([['Hallo']]), 'Hallo');

// Schädliche Eingaben
for (const t of ['=constructor', '=__proto__', '=process.exit(1)', '=alert(1)', '=this', '=1;2']) {
  const v = one(t);
  eq(`keine Ausführung: ${t}`, typeof v, 'string');
}
eq('Prototyp-Name als Funktion', one('=CONSTRUCTOR(1)'), '#NAME?');
eq('Sehr tiefe Klammern bleiben Text', typeof one('=' + '('.repeat(5000) + '1' + ')'.repeat(5000)), 'string');
for (const [name, f] of [['Prozent-Kette', '=1' + '%'.repeat(10000)], ['Plus-Kette', '=1' + '+1'.repeat(9000)]]) eq(`${name}: kein Absturz`, typeof one(f), 'string');
eq('Tiefe Formeln über viele Zeilen: kein Absturz', typeof calc(Array.from({ length: 200 }, (_, r) => [(r === 199 ? '=1' : `=A${r + 2}`) + '+1'.repeat(100)])), 'string');
eq('Tiefe Formeln über Funktionen: kein Absturz', typeof calc(Array.from({ length: 200 }, (_, r) => ['=' + 'ABS('.repeat(38) + (r === 199 ? '1' : `A${r + 2}`) + ')'.repeat(38)])), 'string');
{
  const rows = Array.from({ length: 200 }, (_, r) => [...Array.from({ length: 25 }, () => '1'), ...Array.from({ length: 25 }, (_, c) => `=SUMME(${F.refName(0, c).replace('1', '$1')}:${F.refName(r, c)})`)]);
  const t = table(rows), results = F.compute(t);
  let bad = 0;
  for (let r = 0; r < 200; r++) for (let c = 25; c < 50; c++) if (results.text(r, c, 'de') !== String(r + 1)) bad++;
  eq('Laufsummen in großer Tabelle', bad, 0);
}
eq('Lange Kette', (() => {
  const n = 200;
  const cells = Array.from({ length: n }, (_, r) => [r === n - 1 ? '1' : `=A${r + 2}+1`]);
  return calc(cells);
})(), '200');
{
  const cells = Array.from({ length: 200 }, () => Array(50).fill('=SUMME(A1:AX200)'));
  const started = Date.now();
  eq('Große Tabelle mit Kreisen', calc(cells), '#CYCLE!');
  eq('Große Tabelle bleibt schnell', Date.now() - started < 3000, true);
}

// Bezüge bei Strukturänderungen
const adj = (f, a, at, n = 1) => F.adjust(f, a, at, n);
eq('Zeile davor', adj('=A5+B2', 'insertRows', 2), '=A6+B2');
eq('Spalte davor', adj('=B1', 'insertCols', 0), '=C1');
eq('Bereich wächst', adj('=SUMME(A2:A5)', 'insertRows', 3), '=SUMME(A2:A6)');
eq('Bereich wandert', adj('=SUMME(A2:A5)', 'insertRows', 1), '=SUMME(A3:A6)');
eq('Einfügen nach dem Bereich', adj('=SUMME(A2:A5)', 'insertRows', 5), '=SUMME(A2:A5)');
eq('Bereich schrumpft', adj('=SUMME(A2:A5)', 'deleteRows', 2), '=SUMME(A2:A4)');
eq('Bereichsanfang gelöscht', adj('=SUMME(A2:A5)', 'deleteRows', 1), '=SUMME(A2:A4)');
eq('Bereichsende gelöscht', adj('=SUMME(A2:A5)', 'deleteRows', 4), '=SUMME(A2:A4)');
eq('Ganzer Bereich gelöscht', adj('=SUMME(A2:A3)', 'deleteRows', 1, 2), '=SUMME(#REF!)');
eq('Bezug gelöscht', adj('=A2+1', 'deleteRows', 1), '=#REF!+1');
eq('Absolute Bezüge wandern mit', adj('=$A$5', 'insertRows', 1), '=$A$6');
eq('Text bleibt', adj('=WENN(A5>1;"A5";B5)', 'insertRows', 0), '=WENN(A6>1;"A5";B6)');
eq('Funktionsname bleibt', adj('=ANZAHL2(A1)', 'insertRows', 0), '=ANZAHL2(A2)');
eq('Kein Formeltext', adj('A5', 'insertRows', 0), 'A5');
eq('Ungültige Formel bleibt Text', adj('=A1 ist wichtig', 'insertRows', 0), '=A1 ist wichtig');
eq('Überschrift bleibt Text', adj('== Kapitel B2 ==', 'insertRows', 0), '== Kapitel B2 ==');
eq('Bereich mit Leerzeichen', adj('=SUMME(A1 : A3)', 'deleteRows', 0), '=SUMME(A1:A2)');
eq('Über den Rand hinaus', adj('=A999', 'insertRows', 0), '=#REF!');
eq('Spaltenname zweistellig', F.refName(0, 27), 'AB1');

// Zusammen mit der Tabellenstruktur auf Browser und Server
{
  const t = { ...table([['Wert'], ['1'], ['2'], ['=SUMME(A2:A3)']]), rowH: [1, 1, 1, 1], colW: [1] };
  const a = TableOps.applyStruct(t, { action: 'insertRows', at: 2, count: 1 });
  eq('Struktur: Formel angepasst', a.cells[4][0], '=SUMME(A2:A4)');
  eq('Struktur: Ergebnis gleich', F.compute(a).text(4, 0, 'de'), '3');
  const b = TableOps.applyStruct(a, { action: 'deleteRows', at: 1, count: 1 });
  eq('Struktur: Löschen', b.cells[3][0], '=SUMME(A2:A3)');
  eq('Struktur: Ergebnis nach Löschen', F.compute(b).text(3, 0, 'de'), '2');
}

console.log(failed ? `${failed} von ${count} Prüfungen fehlgeschlagen` : `${count} Prüfungen bestanden`);
process.exit(failed ? 1 : 0);
