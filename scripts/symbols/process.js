'use strict';
/*
 * Verfahrenstechnik: Fließbilder und R&I-Fließbilder.
 * Apparate, Maschinen und Armaturen in Anlehnung an DIN EN ISO 10628-2:2013 (grafische Symbole),
 * PLT-Stellen (Kreise) nach DIN EN 62424:2017 / ANSI/ISA-5.1-2009.
 * Alle Symbole selbst aus der Normgeometrie gezeichnet, keine fremden Bibliotheken als Vorlage.
 * Armaturen liegen waagerecht, ihre Rohranschlüsse enden auf dem linken und rechten Rand.
 */

const L = (de, en, es, fr) => ({ de, en, es, fr });

// Armaturenkörper (zwei Dreiecke, Spitzen in der Mitte) mit Rohrstummeln bis zum Rand, Mitte bei (32, cy), Breite 64
const bow = (cy) => [
  ['path', { d: `M0 ${cy}H8M56 ${cy}H64` }],
  ['polygon', { points: `8,${cy - 12} 32,${cy} 8,${cy + 12}` }],
  ['polygon', { points: `56,${cy - 12} 32,${cy} 56,${cy + 12}` }],
];
// Kreis der Pumpen und Verdichter
const casing = ['circle', { cx: 24, cy: 24, r: 22 }];
// Liegender Behälter mit gewölbten Böden, 96 × 48
const hVessel = ['path', { d: 'M12 4H84A10 20 0 0 1 84 44H12A10 20 0 0 1 12 4Z' }];
const flame = (y) => ['path', { d: `M32 ${y}C22 ${y - 8} 26 ${y - 20} 32 ${y - 28}C38 ${y - 20} 42 ${y - 8} 32 ${y}Z` }];
const motorText = (x, y, s) => ['text', { x, y, 'font-size': s, 'text-anchor': 'middle', fill: 'currentColor', stroke: 'none' }, 'M'];
const label = (x, y, s, t) => ['text', { x, y, 'font-size': s, 'text-anchor': 'middle', fill: 'currentColor', stroke: 'none' }, t];
const dash = { 'stroke-dasharray': '4 3' };

module.exports = {
  groups: [
    ['pumps', L('Pumpen und Verdichter', 'Pumps and compressors', 'Bombas y compresores', 'Pompes et compresseurs')],
    ['vessels', L('Apparate und Behälter', 'Vessels and apparatus', 'Recipientes y aparatos', 'Appareils et réservoirs')],
    ['heat', L('Wärmeübertragung', 'Heat transfer', 'Transferencia de calor', 'Transfert de chaleur')],
    ['separation', L('Trennen und Fördern', 'Separation and conveying', 'Separación y transporte', 'Séparation et convoyage')],
    ['valves', L('Armaturen', 'Valves', 'Válvulas', 'Robinetterie')],
    ['piping', L('Rohrleitung und Sonstiges', 'Piping and miscellaneous', 'Tuberías y varios', 'Tuyauterie et divers')],
    ['instruments', L('PLT-Stellen', 'Instrumentation', 'Instrumentación', 'Instrumentation')],
  ],
  symbols: [
    /* ---------------- Pumpen und Verdichter ---------------- */
    {
      id: 'pump-centrifugal', group: 'pumps',
      names: L('Kreiselpumpe', 'Centrifugal pump', 'Bomba centrífuga', 'Pompe centrifuge'),
      tags: L('pumpe flüssigkeitspumpe kreisel', 'pump liquid', 'bomba líquido', 'pompe liquide'),
      vb: [48, 48],
      body: [casing, ['path', { d: 'M24 2L46 24L24 46' }]],
    },
    {
      id: 'pump-piston', group: 'pumps',
      names: L('Kolbenpumpe', 'Piston pump', 'Bomba de pistón', 'Pompe à piston'),
      tags: L('pumpe verdrängerpumpe hubkolben', 'pump reciprocating positive displacement', 'bomba alternativa desplazamiento positivo', 'pompe alternative volumétrique'),
      vb: [48, 48],
      body: [casing, ['rect', { x: 18, y: 14, width: 12, height: 20 }], ['path', { d: 'M6 24H18' }]],
    },
    {
      id: 'pump-gear', group: 'pumps',
      names: L('Zahnradpumpe', 'Gear pump', 'Bomba de engranajes', 'Pompe à engrenages'),
      tags: L('pumpe verdrängerpumpe zahnrad', 'pump positive displacement rotary', 'bomba desplazamiento positivo rotativa', 'pompe volumétrique rotative'),
      vb: [48, 48],
      body: [casing, ['circle', { cx: 24, cy: 15, r: 8 }], ['circle', { cx: 24, cy: 33, r: 8 }]],
    },
    {
      id: 'pump-screw', group: 'pumps',
      names: L('Schraubenpumpe', 'Screw pump', 'Bomba de tornillo', 'Pompe à vis'),
      tags: L('pumpe verdrängerpumpe exzenterschnecke spindel', 'pump positive displacement progressive cavity', 'bomba desplazamiento positivo husillo', 'pompe volumétrique vis excentrée'),
      vb: [48, 48],
      body: [casing, ['path', { d: 'M6 24Q10.5 14 15 24T24 24T33 24T42 24' }]],
    },
    {
      id: 'pump-diaphragm', group: 'pumps',
      names: L('Membranpumpe', 'Diaphragm pump', 'Bomba de membrana', 'Pompe à membrane'),
      tags: L('pumpe verdrängerpumpe dosierpumpe membran', 'pump positive displacement metering membrane', 'bomba dosificadora diafragma', 'pompe doseuse volumétrique'),
      vb: [48, 48],
      body: [casing, ['path', { d: 'M24 6Q34 24 24 42' }], ['path', { d: 'M6 24H29' }]],
    },
    {
      id: 'pump-vacuum', group: 'pumps',
      names: L('Vakuumpumpe', 'Vacuum pump', 'Bomba de vacío', 'Pompe à vide'),
      tags: L('pumpe vakuum drehschieber unterdruck', 'pump vacuum rotary vane', 'bomba vacío paletas', 'pompe vide palettes'),
      vb: [48, 48],
      body: [casing, ['circle', { cx: 24, cy: 30, r: 14 }], ['path', { d: 'M24 16V2M2.8 30H10M38 30H45.2' }]],
    },
    {
      id: 'compressor', group: 'pumps',
      names: L('Verdichter allgemein', 'Compressor, general', 'Compresor, general', 'Compresseur, général'),
      tags: L('verdichter kompressor turboverdichter gas', 'compressor gas', 'compresor gas', 'compresseur gaz'),
      vb: [48, 48],
      body: [casing, ['path', { d: 'M7.1 9.9L45.3 18.3M7.1 38.1L45.3 29.7' }]],
    },
    {
      id: 'compressor-piston', group: 'pumps',
      names: L('Kolbenverdichter', 'Piston compressor', 'Compresor de pistón', 'Compresseur à piston'),
      tags: L('verdichter kompressor hubkolben', 'compressor reciprocating', 'compresor alternativo', 'compresseur alternatif'),
      vb: [48, 48],
      body: [casing, ['path', { d: 'M7.1 9.9L45.3 18.3M7.1 38.1L45.3 29.7' }], ['rect', { x: 22, y: 19, width: 8, height: 10 }], ['path', { d: 'M12 24H22' }]],
    },
    {
      id: 'fan', group: 'pumps',
      names: L('Ventilator, Gebläse', 'Fan, blower', 'Ventilador, soplante', 'Ventilateur, soufflante'),
      tags: L('ventilator gebläse lüfter luft', 'fan blower air', 'ventilador soplante aire', 'ventilateur soufflante air'),
      vb: [48, 48],
      body: [casing, ['path', { d: 'M24 24C18 16 20 6 24 6C28 6 30 16 24 24ZM24 24C30 32 28 42 24 42C20 42 18 32 24 24Z' }]],
    },
    {
      id: 'turbine', group: 'pumps',
      names: L('Turbine', 'Turbine', 'Turbina', 'Turbine'),
      tags: L('turbine dampfturbine gasturbine entspannung', 'turbine steam gas expander', 'turbina vapor gas expansor', 'turbine vapeur gaz détendeur'),
      vb: [48, 48],
      body: [['polygon', { points: '2,16 46,2 46,46 2,32' }]],
    },

    /* ---------------- Apparate und Behälter ---------------- */
    {
      id: 'vessel-vertical', group: 'vessels',
      names: L('Behälter stehend', 'Vessel, vertical', 'Recipiente vertical', 'Réservoir vertical'),
      tags: L('behälter apparat stehend', 'vessel drum vertical', 'recipiente depósito vertical', 'réservoir ballon vertical'),
      vb: [48, 96],
      body: [['rect', { x: 4, y: 2, width: 40, height: 92, rx: 8 }]],
    },
    {
      id: 'vessel-horizontal', group: 'vessels',
      names: L('Behälter liegend', 'Vessel, horizontal', 'Recipiente horizontal', 'Réservoir horizontal'),
      tags: L('behälter apparat liegend trommel', 'vessel drum horizontal', 'recipiente depósito horizontal', 'réservoir ballon horizontal'),
      vb: [96, 48],
      body: [hVessel],
    },
    {
      id: 'pressure-vessel', group: 'vessels',
      names: L('Druckbehälter mit gewölbten Böden', 'Pressure vessel with dished ends', 'Recipiente a presión con fondos', 'Réservoir sous pression à fonds bombés'),
      tags: L('behälter druck klöpperboden korbbogen', 'vessel pressure dished heads', 'recipiente presión', 'réservoir pression'),
      vb: [48, 112],
      body: [['path', { d: 'M4 14V98A20 12 0 0 0 44 98V14A20 12 0 0 0 4 14Z' }], ['path', { d: 'M4 14H44M4 98H44' }]],
    },
    {
      id: 'tank-fixed-roof', group: 'vessels',
      names: L('Tank mit Festdach', 'Tank with fixed roof', 'Tanque de techo fijo', 'Bac à toit fixe'),
      tags: L('tank lagertank festdach', 'tank storage fixed roof', 'tanque almacenamiento', 'bac stockage'),
      vb: [96, 80],
      body: [['path', { d: 'M4 78V24L48 8L92 24V78Z' }]],
    },
    {
      id: 'basin-open', group: 'vessels',
      names: L('Offenes Becken', 'Open basin', 'Balsa abierta', 'Bassin ouvert'),
      tags: L('becken grube wanne offen', 'basin pit open tank', 'balsa foso', 'bassin fosse'),
      vb: [96, 48],
      body: [['path', { d: 'M2 4V46H94V4' }]],
    },
    {
      id: 'vessel-sphere', group: 'vessels',
      names: L('Kugelbehälter', 'Spherical vessel', 'Esfera de almacenamiento', 'Sphère de stockage'),
      tags: L('kugel behälter flüssiggas', 'sphere vessel lpg', 'esfera depósito', 'sphère réservoir'),
      vb: [80, 80],
      body: [['circle', { cx: 40, cy: 34, r: 30 }], ['path', { d: 'M19.6 56V78M60.4 56V78' }]],
    },
    {
      id: 'silo', group: 'vessels',
      names: L('Silo mit Trichter', 'Silo with hopper', 'Silo con tolva', 'Silo à trémie'),
      tags: L('silo bunker trichter schüttgut', 'silo bin hopper bulk', 'silo tolva granel', 'silo trémie vrac'),
      vb: [64, 96],
      body: [['path', { d: 'M28 96V82L4 56V2H60V56L36 82V96' }]],
    },
    {
      id: 'column-trays', group: 'vessels',
      names: L('Kolonne mit Böden', 'Column with trays', 'Columna de platos', 'Colonne à plateaux'),
      tags: L('kolonne destillation rektifikation boden', 'column tower distillation trays', 'columna torre destilación', 'colonne distillation plateaux'),
      vb: [48, 160],
      body: [
        ['path', { d: 'M4 12V148A20 10 0 0 0 44 148V12A20 10 0 0 0 4 12Z' }],
        ['path', { d: 'M4 32H36M12 52H44M4 72H36M12 92H44M4 112H36M12 132H44' }],
      ],
    },
    {
      id: 'column-packed', group: 'vessels',
      names: L('Kolonne mit Packung', 'Packed column', 'Columna de relleno', 'Colonne à garnissage'),
      tags: L('kolonne füllkörper packung absorption', 'column tower packing absorber', 'columna torre relleno', 'colonne garnissage absorbeur'),
      vb: [48, 160],
      body: [
        ['path', { d: 'M4 12V148A20 10 0 0 0 44 148V12A20 10 0 0 0 4 12Z' }],
        ['path', { d: 'M4 40H44M4 120H44M4 40L44 120M44 40L4 120' }],
      ],
    },
    {
      id: 'reactor-stirred', group: 'vessels',
      names: L('Rührbehälter, Reaktor', 'Stirred tank reactor', 'Reactor agitado', 'Réacteur agité'),
      tags: L('reaktor rührkessel rührwerk motor', 'reactor stirred tank agitator cstr', 'reactor tanque agitador', 'réacteur cuve agitateur'),
      vb: [64, 120],
      body: [
        ['circle', { cx: 32, cy: 12, r: 10 }], motorText(32, 17, 14),
        ['path', { d: 'M8 38V102A24 12 0 0 0 56 102V38A24 12 0 0 0 8 38Z' }],
        ['path', { d: 'M32 22V92' }],
        ['polygon', { points: '32,92 20,86 20,98' }], ['polygon', { points: '32,92 44,86 44,98' }],
      ],
    },
    {
      id: 'agitator', group: 'vessels',
      names: L('Rührwerk allgemein', 'Agitator, general', 'Agitador, general', 'Agitateur, général'),
      tags: L('rührwerk rührer mischer', 'agitator stirrer mixer', 'agitador mezclador', 'agitateur mélangeur'),
      vb: [32, 64],
      body: [['path', { d: 'M16 2V50' }], ['polygon', { points: '16,50 4,44 4,56' }], ['polygon', { points: '16,50 28,44 28,56' }]],
    },

    /* ---------------- Wärmeübertragung ---------------- */
    {
      id: 'heat-exchanger', group: 'heat',
      names: L('Wärmeübertrager allgemein', 'Heat exchanger, general', 'Intercambiador de calor', 'Échangeur de chaleur'),
      tags: L('wärmetauscher wärmeübertrager wt', 'heat exchanger hx', 'intercambiador calor', 'échangeur chaleur'),
      vb: [64, 64],
      body: [['circle', { cx: 32, cy: 32, r: 26 }], ['path', { d: 'M0 32H12L20 20L28 44L36 20L44 44L52 32H64' }]],
    },
    {
      id: 'hx-shell-tube', group: 'heat',
      names: L('Rohrbündel-Wärmeübertrager', 'Shell and tube heat exchanger', 'Intercambiador de carcasa y tubos', 'Échangeur tubulaire'),
      tags: L('wärmetauscher rohrbündel mantel', 'heat exchanger shell tube bundle', 'intercambiador carcasa tubos', 'échangeur calandre faisceau'),
      vb: [128, 48],
      body: [
        ['path', { d: 'M20 6H108A12 18 0 0 1 108 42H20A12 18 0 0 1 20 6Z' }],
        ['path', { d: 'M20 6V42M108 6V42M20 16H108M20 24H108M20 32H108' }],
      ],
    },
    {
      id: 'hx-plate', group: 'heat',
      names: L('Plattenwärmeübertrager', 'Plate heat exchanger', 'Intercambiador de placas', 'Échangeur à plaques'),
      tags: L('wärmetauscher platten', 'heat exchanger plate', 'intercambiador placas', 'échangeur plaques'),
      vb: [64, 64],
      body: [['rect', { x: 6, y: 4, width: 52, height: 56 }], ['path', { d: 'M14 8V56M20 8V56M26 8V56M32 8V56M38 8V56M44 8V56M50 8V56' }]],
    },
    {
      id: 'hx-double-pipe', group: 'heat',
      names: L('Doppelrohr-Wärmeübertrager', 'Double pipe heat exchanger', 'Intercambiador de doble tubo', 'Échangeur double tube'),
      tags: L('wärmetauscher doppelrohr mantelrohr', 'heat exchanger double pipe hairpin', 'intercambiador doble tubo', 'échangeur double tube'),
      vb: [128, 48],
      body: [['rect', { x: 16, y: 14, width: 96, height: 20 }], ['path', { d: 'M0 24H128M28 14V0M100 34V48' }]],
    },
    {
      id: 'cooler', group: 'heat',
      names: L('Kühler', 'Cooler', 'Enfriador', 'Refroidisseur'),
      tags: L('kühler kühlen wärmeübertrager', 'cooler cooling heat exchanger', 'enfriador refrigeración', 'refroidisseur refroidissement'),
      vb: [64, 84],
      body: [
        ['circle', { cx: 32, cy: 56, r: 26 }], ['path', { d: 'M0 56H12L20 44L28 68L36 44L44 68L52 56H64' }],
        ['path', { d: 'M32 30V10' }], ['polygon', { points: '32,2 26,12 38,12', fill: 'currentColor' }],
      ],
    },
    {
      id: 'heater', group: 'heat',
      names: L('Erhitzer', 'Heater', 'Calentador', 'Réchauffeur'),
      tags: L('erhitzer heizen vorwärmer wärmeübertrager', 'heater heating preheater', 'calentador precalentador', 'réchauffeur préchauffeur'),
      vb: [64, 84],
      body: [
        ['circle', { cx: 32, cy: 56, r: 26 }], ['path', { d: 'M0 56H12L20 44L28 68L36 44L44 68L52 56H64' }],
        ['path', { d: 'M32 2V20' }], ['polygon', { points: '32,29 26,19 38,19', fill: 'currentColor' }],
      ],
    },
    {
      id: 'evaporator', group: 'heat',
      names: L('Verdampfer', 'Evaporator', 'Evaporador', 'Évaporateur'),
      tags: L('verdampfer heizschlange brüden', 'evaporator heating coil vapour', 'evaporador serpentín', 'évaporateur serpentin'),
      vb: [64, 96],
      body: [
        ['path', { d: 'M8 22V78A24 10 0 0 0 56 78V22A24 10 0 0 0 8 22Z' }],
        ['path', { d: 'M32 12V0' }],
        ['path', { d: 'M8 46H56', ...dash }],
        ['path', { d: 'M0 66H12L18 56L24 76L30 56L36 76L42 56L48 76L52 66H64' }],
      ],
    },
    {
      id: 'condenser', group: 'heat',
      names: L('Kondensator', 'Condenser', 'Condensador', 'Condenseur'),
      tags: L('kondensator verflüssiger kühlschlange', 'condenser cooling coil', 'condensador serpentín', 'condenseur serpentin'),
      vb: [96, 48],
      body: [hVessel, ['path', { d: 'M0 24H16L24 12L32 36L40 12L48 36L56 12L64 36L72 12L80 24H96' }]],
    },
    {
      id: 'cooling-tower', group: 'heat',
      names: L('Kühlturm', 'Cooling tower', 'Torre de refrigeración', 'Tour de refroidissement'),
      tags: L('kühlturm rückkühlung', 'cooling tower', 'torre refrigeración', 'tour aéroréfrigérant'),
      vb: [64, 96],
      body: [['path', { d: 'M6 94Q24 46 14 4H50Q40 46 58 94Z' }]],
    },
    {
      id: 'furnace', group: 'heat',
      names: L('Ofen, Feuerung', 'Furnace, fired heater', 'Horno', 'Four'),
      tags: L('ofen feuerung brenner röhrenofen', 'furnace fired heater burner', 'horno quemador', 'four brûleur'),
      vb: [64, 88],
      body: [['path', { d: 'M4 86V36L20 16V2H44V16L60 36V86Z' }], flame(78)],
    },
    {
      id: 'steam-generator', group: 'heat',
      names: L('Dampferzeuger', 'Steam generator', 'Generador de vapor', 'Générateur de vapeur'),
      tags: L('dampferzeuger kessel dampfkessel trommel', 'steam generator boiler drum', 'caldera vapor', 'chaudière vapeur'),
      vb: [64, 88],
      body: [
        ['rect', { x: 10, y: 2, width: 44, height: 16, rx: 8 }],
        ['path', { d: 'M24 18V30M40 18V30' }],
        ['rect', { x: 4, y: 30, width: 56, height: 56 }], flame(78),
      ],
    },

    /* ---------------- Trennen und Fördern ---------------- */
    {
      id: 'filter', group: 'separation',
      names: L('Filter allgemein', 'Filter, general', 'Filtro, general', 'Filtre, général'),
      tags: L('filter filtration', 'filter filtration', 'filtro filtración', 'filtre filtration'),
      vb: [80, 48],
      body: [['path', { d: 'M0 24H12M68 24H80' }], ['rect', { x: 12, y: 4, width: 56, height: 40 }], ['path', { d: 'M40 4V44', ...dash }]],
    },
    {
      id: 'strainer', group: 'separation',
      names: L('Schmutzfänger, Sieb', 'Strainer', 'Filtro colador', 'Filtre à tamis'),
      tags: L('schmutzfänger sieb siebfilter', 'strainer sieve screen', 'colador tamiz', 'tamis crépine'),
      vb: [64, 48],
      body: [['path', { d: 'M0 24H16M48 24H64' }], ['rect', { x: 16, y: 8, width: 32, height: 32 }], ['path', { d: 'M16 40L48 8', ...dash }]],
    },
    {
      id: 'cyclone', group: 'separation',
      names: L('Zyklon', 'Cyclone', 'Ciclón', 'Cyclone'),
      tags: L('zyklon fliehkraftabscheider staub', 'cyclone separator dust', 'ciclón separador polvo', 'cyclone séparateur poussière'),
      vb: [48, 96],
      body: [['path', { d: 'M20 96V82L4 36V2H44V36L28 82V96' }], ['path', { d: 'M20 0V22M28 0V22M0 10H4' }]],
    },
    {
      id: 'centrifuge', group: 'separation',
      names: L('Zentrifuge', 'Centrifuge', 'Centrífuga', 'Centrifugeuse'),
      tags: L('zentrifuge schleuder trommel', 'centrifuge basket', 'centrífuga cesta', 'centrifugeuse panier'),
      vb: [64, 64],
      body: [['rect', { x: 4, y: 4, width: 56, height: 46, rx: 4 }], ['path', { d: 'M14 12V42H50V12', ...dash }], ['path', { d: 'M32 42V62' }]],
    },
    {
      id: 'dryer', group: 'separation',
      names: L('Trockner (Trommel)', 'Dryer (rotary drum)', 'Secador (tambor)', 'Sécheur (tambour)'),
      tags: L('trockner trommeltrockner drehrohr', 'dryer drier rotary drum kiln', 'secador tambor rotatorio', 'sécheur tambour rotatif'),
      vb: [96, 48],
      body: [['rect', { x: 6, y: 12, width: 84, height: 24 }], ['rect', { x: 24, y: 6, width: 6, height: 36 }], ['rect', { x: 66, y: 6, width: 6, height: 36 }]],
    },
    {
      id: 'separator', group: 'separation',
      names: L('Abscheider', 'Separator', 'Separador', 'Séparateur'),
      tags: L('abscheider wehr phasentrennung flüssigkeit', 'separator settler weir decanter', 'separador decantador', 'séparateur décanteur'),
      vb: [96, 48],
      body: [hVessel, ['path', { d: 'M64 44V20' }], ['path', { d: 'M3 30H64', ...dash }]],
    },
    {
      id: 'mixer-static', group: 'separation',
      names: L('Mischer (statisch)', 'Static mixer', 'Mezclador estático', 'Mélangeur statique'),
      tags: L('mischer statisch inline', 'mixer static inline', 'mezclador estático', 'mélangeur statique'),
      vb: [96, 48],
      body: [['path', { d: 'M0 24H16M80 24H96' }], ['rect', { x: 16, y: 10, width: 64, height: 28 }], ['polyline', { points: '16,10 32,38 48,10 64,38 80,10' }]],
    },
    {
      id: 'crusher', group: 'separation',
      names: L('Brecher, Mühle', 'Crusher, mill', 'Trituradora, molino', 'Concasseur, broyeur'),
      tags: L('brecher walzenbrecher mühle zerkleinern', 'crusher roller mill grinding', 'trituradora molino rodillos', 'concasseur broyeur cylindres'),
      vb: [64, 64],
      body: [['path', { d: 'M4 2L18 24M60 2L46 24' }], ['circle', { cx: 20, cy: 40, r: 11 }], ['circle', { cx: 44, cy: 40, r: 11 }]],
    },
    {
      id: 'belt-conveyor', group: 'separation',
      names: L('Förderband', 'Belt conveyor', 'Cinta transportadora', 'Convoyeur à bande'),
      tags: L('förderband gurtförderer band', 'belt conveyor', 'cinta transportadora', 'convoyeur bande'),
      vb: [128, 40],
      body: [['circle', { cx: 16, cy: 20, r: 10 }], ['circle', { cx: 112, cy: 20, r: 10 }], ['path', { d: 'M16 10H112M16 30H112' }]],
    },
    {
      id: 'screw-conveyor', group: 'separation',
      names: L('Schneckenförderer', 'Screw conveyor', 'Transportador de tornillo', 'Convoyeur à vis'),
      tags: L('schnecke schneckenförderer förderschnecke', 'screw auger conveyor', 'tornillo sinfín', 'vis sans fin'),
      vb: [128, 40],
      body: [
        ['rect', { x: 4, y: 8, width: 120, height: 24 }],
        ['path', { d: 'M14 30L22 10M26 30L34 10M38 30L46 10M50 30L58 10M62 30L70 10M74 30L82 10M86 30L94 10M98 30L106 10M110 30L118 10' }],
      ],
    },
    {
      id: 'scale', group: 'separation',
      names: L('Waage', 'Weighing scale', 'Báscula', 'Balance, bascule'),
      tags: L('waage wiegen plattformwaage', 'scale weighing', 'báscula pesaje', 'bascule pesage'),
      vb: [64, 48],
      body: [['rect', { x: 6, y: 12, width: 52, height: 6 }], ['polygon', { points: '32,18 20,44 44,44' }], ['path', { d: 'M4 44H60' }]],
    },

    /* ---------------- Armaturen ---------------- */
    {
      id: 'valve-gate', group: 'valves',
      names: L('Absperrarmatur allgemein, Schieber', 'Shut-off valve, gate valve', 'Válvula de cierre, compuerta', 'Robinet d’arrêt, vanne'),
      tags: L('armatur absperrschieber schieber absperrung', 'valve gate shut off isolation', 'válvula compuerta cierre', 'vanne robinet arrêt'),
      vb: [64, 32],
      body: bow(16),
    },
    {
      id: 'valve-globe', group: 'valves',
      names: L('Ventil (Durchgangsventil)', 'Globe valve', 'Válvula de asiento', 'Robinet à soupape'),
      tags: L('ventil absperrventil durchgang', 'valve globe stop', 'válvula globo asiento', 'robinet soupape'),
      vb: [64, 32],
      body: [...bow(16), ['circle', { cx: 32, cy: 16, r: 3.5, fill: 'currentColor' }]],
    },
    {
      id: 'valve-ball', group: 'valves',
      names: L('Kugelhahn', 'Ball valve', 'Válvula de bola', 'Robinet à boisseau sphérique'),
      tags: L('hahn kugelhahn', 'valve ball cock', 'válvula bola', 'robinet boisseau sphérique'),
      vb: [64, 32],
      body: [
        ['path', { d: 'M0 16H8M56 16H64' }],
        ['polygon', { points: '8,4 25,16 8,28' }], ['polygon', { points: '56,4 39,16 56,28' }],
        ['circle', { cx: 32, cy: 16, r: 7 }],
      ],
    },
    {
      id: 'valve-butterfly', group: 'valves',
      names: L('Klappe (Absperrklappe)', 'Butterfly valve', 'Válvula de mariposa', 'Vanne papillon'),
      tags: L('klappe absperrklappe drosselklappe', 'valve butterfly damper', 'válvula mariposa', 'vanne papillon'),
      vb: [64, 32],
      body: [
        ['path', { d: 'M0 16H24M40 16H64M24 4V28M40 4V28M27 25L37 7' }],
        ['circle', { cx: 32, cy: 16, r: 2, fill: 'currentColor', stroke: 'none' }],
      ],
    },
    {
      id: 'valve-check', group: 'valves',
      names: L('Rückschlagventil, -klappe', 'Check valve', 'Válvula antirretorno', 'Clapet anti-retour'),
      tags: L('rückschlag rückflussverhinderer rückschlagklappe', 'valve check non return', 'válvula retención antirretorno', 'clapet anti retour'),
      vb: [64, 32],
      body: [
        ['path', { d: 'M0 16H8M56 16H64M32 4V28' }],
        ['polygon', { points: '8,4 32,16 8,28', fill: 'currentColor' }],
        ['polygon', { points: '56,4 32,16 56,28' }],
      ],
    },
    {
      id: 'valve-3way', group: 'valves',
      names: L('Dreiwegeventil', 'Three-way valve', 'Válvula de tres vías', 'Vanne trois voies'),
      tags: L('dreiwege ventil mischventil verteilventil', 'valve three way 3 way mixing diverting', 'válvula tres vías', 'vanne trois voies'),
      vb: [64, 64],
      body: [...bow(32), ['polygon', { points: '20,56 32,32 44,56' }], ['path', { d: 'M32 56V64' }]],
    },
    {
      id: 'valve-needle', group: 'valves',
      names: L('Nadelventil', 'Needle valve', 'Válvula de aguja', 'Robinet à pointeau'),
      tags: L('nadelventil feinregulierung', 'valve needle', 'válvula aguja', 'robinet pointeau'),
      vb: [64, 32],
      body: [...bow(16), ['polygon', { points: '29,1.5 35,1.5 32,14', fill: 'currentColor' }]],
    },
    {
      id: 'valve-control', group: 'valves',
      names: L('Regelventil mit Membranantrieb', 'Control valve, diaphragm actuator', 'Válvula de control neumática', 'Vanne de régulation pneumatique'),
      tags: L('regelventil stellventil membranantrieb pneumatisch stellglied', 'valve control diaphragm actuator pneumatic', 'válvula control actuador diafragma', 'vanne régulation actionneur membrane'),
      vb: [64, 64],
      body: [...bow(48), ['path', { d: 'M32 20V48' }], ['path', { d: 'M18 20A14 14 0 0 1 46 20Z' }]],
    },
    {
      id: 'valve-motor', group: 'valves',
      names: L('Ventil mit Motorantrieb', 'Motor-operated valve', 'Válvula motorizada', 'Vanne motorisée'),
      tags: L('motorventil stellantrieb elektrisch', 'valve motor operated electric actuator mov', 'válvula motorizada eléctrica', 'vanne motorisée électrique'),
      vb: [64, 64],
      body: [...bow(48), ['path', { d: 'M32 25V48' }], ['circle', { cx: 32, cy: 14, r: 11 }], motorText(32, 19, 14)],
    },
    {
      id: 'valve-solenoid', group: 'valves',
      names: L('Magnetventil', 'Solenoid valve', 'Electroválvula', 'Électrovanne'),
      tags: L('magnetventil magnetantrieb elektromagnet', 'valve solenoid', 'electroválvula solenoide', 'électrovanne solénoïde'),
      vb: [64, 64],
      body: [...bow(48), ['path', { d: 'M32 24V48' }], ['rect', { x: 22, y: 6, width: 20, height: 18 }], ['path', { d: 'M22 24L42 6' }]],
    },
    {
      id: 'valve-safety', group: 'valves',
      names: L('Sicherheitsventil', 'Safety relief valve', 'Válvula de seguridad', 'Soupape de sûreté'),
      tags: L('sicherheitsventil überdruck federbelastet psv', 'valve safety relief pressure psv prv', 'válvula seguridad alivio', 'soupape sûreté décharge'),
      vb: [64, 64],
      body: [
        ['path', { d: 'M56 36H64M32 60V64' }],
        ['polygon', { points: '56,24 32,36 56,48' }], ['polygon', { points: '20,60 32,36 44,60' }],
        ['path', { d: 'M32 36V30L24 27L40 21L24 15L40 9L32 6V2' }],
      ],
    },
    {
      id: 'pressure-reducer', group: 'valves',
      names: L('Druckminderer', 'Pressure reducing valve', 'Válvula reductora de presión', 'Détendeur'),
      tags: L('druckminderer druckregler druckreduzierventil', 'valve pressure reducing regulator', 'válvula reductora presión regulador', 'détendeur régulateur pression'),
      vb: [64, 64],
      body: [...bow(48), ['path', { d: 'M32 20V48' }], ['path', { d: 'M18 20A14 14 0 0 1 46 20Z' }], ['path', { d: 'M46 14H60V48', ...dash }]],
    },
    {
      id: 'rupture-disc', group: 'valves',
      names: L('Berstscheibe', 'Rupture disc', 'Disco de ruptura', 'Disque de rupture'),
      tags: L('berstscheibe berstsicherung überdruck', 'rupture disc burst disk', 'disco ruptura', 'disque rupture'),
      vb: [64, 32],
      body: [['path', { d: 'M0 16H26M38 16H64M26 4V28M38 4V28' }], ['path', { d: 'M29 5Q39 16 29 27' }]],
    },
    {
      id: 'steam-trap', group: 'valves',
      names: L('Kondensatableiter', 'Steam trap', 'Purgador de vapor', 'Purgeur de vapeur'),
      tags: L('kondensatableiter kondensat dampf', 'steam trap condensate', 'purgador vapor condensado', 'purgeur vapeur condensat'),
      vb: [64, 32],
      body: [
        ['path', { d: 'M0 16H18M46 16H64' }],
        ['polygon', { points: '32,2 46,16 32,30 18,16' }],
        ['circle', { cx: 32, cy: 16, r: 3.5, fill: 'currentColor' }],
      ],
    },
    {
      id: 'sight-glass', group: 'valves',
      names: L('Schauglas', 'Sight glass', 'Mirilla', 'Voyant'),
      tags: L('schauglas sichtglas', 'sight glass flow indicator', 'mirilla visor', 'voyant regard'),
      vb: [64, 32],
      body: [['path', { d: 'M0 16H20M44 16H64' }], ['circle', { cx: 32, cy: 16, r: 12 }], ['circle', { cx: 32, cy: 16, r: 6 }]],
    },

    /* ---------------- Rohrleitung und Sonstiges ---------------- */
    {
      id: 'reducer', group: 'piping',
      names: L('Reduzierung', 'Reducer', 'Reducción', 'Réduction'),
      tags: L('reduzierung reduzierstück übergang', 'reducer concentric pipe', 'reducción tubería', 'réduction tuyau'),
      vb: [48, 32],
      body: [['path', { d: 'M0 16H12M36 16H48' }], ['polygon', { points: '12,4 36,10 36,22 12,28' }]],
    },
    {
      id: 'flange', group: 'piping',
      names: L('Flanschverbindung', 'Flange connection', 'Unión con bridas', 'Raccord à brides'),
      tags: L('flansch flanschverbindung', 'flange joint', 'brida unión', 'bride raccord'),
      vb: [48, 32],
      body: [['path', { d: 'M0 16H20M28 16H48M20 4V28M28 4V28' }]],
    },
    {
      id: 'spectacle-blind', group: 'piping',
      names: L('Steckscheibe', 'Line blind', 'Disco ciego', 'Joint plein'),
      tags: L('steckscheibe blindscheibe absperrung', 'blind spade spectacle', 'disco ciego', 'joint plein lunette'),
      vb: [48, 32],
      body: [['path', { d: 'M0 16H20M28 16H48M20 4V28M28 4V28' }], ['rect', { x: 21.5, y: 6, width: 5, height: 20, fill: 'currentColor', stroke: 'none' }]],
    },
    {
      id: 'blind-flange', group: 'piping',
      names: L('Blindflansch', 'Blind flange', 'Brida ciega', 'Bride pleine'),
      tags: L('blindflansch rohrende verschluss', 'blind flange end cap', 'brida ciega', 'bride pleine'),
      vb: [32, 32],
      body: [['path', { d: 'M0 16H16M16 4V28' }], ['rect', { x: 19, y: 4, width: 6, height: 24, fill: 'currentColor', stroke: 'none' }]],
    },
    {
      id: 'hose', group: 'piping',
      names: L('Schlauch', 'Hose', 'Manguera', 'Flexible'),
      tags: L('schlauch flexibel schlauchleitung', 'hose flexible', 'manguera flexible', 'flexible tuyau'),
      vb: [64, 32],
      body: [['path', { d: 'M0 16Q8 6 16 16T32 16T48 16T64 16' }]],
    },
    {
      id: 'nozzle', group: 'piping',
      names: L('Düse', 'Nozzle', 'Boquilla', 'Buse'),
      tags: L('düse sprühdüse zerstäuber', 'nozzle spray', 'boquilla pulverizador', 'buse pulvérisation'),
      vb: [64, 32],
      body: [['path', { d: 'M0 16H28' }], ['polygon', { points: '28,8 44,13 44,19 28,24' }], ['path', { d: 'M48 16H62M48 12L60 6M48 20L60 26' }]],
    },
    {
      id: 'flare', group: 'piping',
      names: L('Fackel', 'Flare stack', 'Antorcha', 'Torchère'),
      tags: L('fackel abfackeln', 'flare stack', 'antorcha quemador', 'torchère'),
      vb: [32, 96],
      body: [['path', { d: 'M12 96V32H20V96' }], ['path', { d: 'M16 28C8 20 10 10 16 2C22 10 24 20 16 28Z' }]],
    },
    {
      id: 'chimney', group: 'piping',
      names: L('Kamin, Schornstein', 'Chimney, stack', 'Chimenea', 'Cheminée'),
      tags: L('kamin schornstein abgas', 'chimney stack flue', 'chimenea gases', 'cheminée fumées'),
      vb: [32, 96],
      body: [['path', { d: 'M6 94L12 2H20L26 94Z' }]],
    },
    {
      id: 'orifice', group: 'piping',
      names: L('Messblende', 'Orifice plate', 'Placa de orificio', 'Diaphragme de mesure'),
      tags: L('messblende blende durchfluss wirkdruck', 'orifice plate flow', 'placa orificio caudal', 'diaphragme débit'),
      vb: [64, 32],
      body: [['path', { d: 'M0 16H64M26 6V26M38 6V26' }], ['path', { d: 'M32 3V12M32 20V29', 'stroke-width': 3 }]],
    },
    {
      id: 'flowmeter-venturi', group: 'piping',
      names: L('Durchflussmesser (Venturi)', 'Flowmeter (Venturi)', 'Caudalímetro (Venturi)', 'Débitmètre (Venturi)'),
      tags: L('durchfluss durchflussmesser venturi', 'flowmeter flow venturi', 'caudalímetro venturi', 'débitmètre venturi'),
      vb: [64, 32],
      body: [['path', { d: 'M0 16H10M54 16H64' }], ['polygon', { points: '10,6 26,12 38,12 54,6 54,26 38,20 26,20 10,26' }]],
    },
    {
      id: 'pipe-tee', group: 'piping',
      names: L('Rohrleitungsabzweig', 'Pipe branch (tee)', 'Derivación (te)', 'Piquage (té)'),
      tags: L('abzweig tstück t stück verbindung', 'tee branch junction', 'te derivación', 'té piquage'),
      vb: [48, 48],
      body: [['path', { d: 'M0 24H48M24 24V48' }], ['circle', { cx: 24, cy: 24, r: 3, fill: 'currentColor', stroke: 'none' }]],
    },
    {
      id: 'pipe-crossing', group: 'piping',
      names: L('Rohrkreuzung ohne Verbindung', 'Pipe crossing, not connected', 'Cruce sin conexión', 'Croisement sans raccordement'),
      tags: L('kreuzung bogen ohne verbindung', 'crossing jump not connected', 'cruce salto', 'croisement saut'),
      vb: [48, 48],
      body: [['path', { d: 'M0 24H18A6 6 0 0 1 30 24H48M24 0V48' }]],
    },

    /* ---------------- PLT-Stellen ---------------- */
    {
      id: 'instr-local', group: 'instruments',
      names: L('PLT-Stelle örtlich', 'Instrument, field mounted', 'Instrumento en campo', 'Instrument local'),
      tags: L('plt messstelle kreis örtlich feld', 'instrument bubble field local', 'instrumento campo', 'instrument terrain'),
      vb: [48, 48],
      body: [['circle', { cx: 24, cy: 24, r: 22 }]],
    },
    {
      id: 'instr-control-room', group: 'instruments',
      names: L('PLT-Stelle in der Messwarte', 'Instrument, control room', 'Instrumento en sala de control', 'Instrument en salle de commande'),
      tags: L('plt messstelle kreis warte leitwarte', 'instrument bubble control room panel', 'instrumento sala control', 'instrument salle commande'),
      vb: [48, 48],
      body: [['circle', { cx: 24, cy: 24, r: 22 }], ['path', { d: 'M2 24H46' }]],
    },
    {
      id: 'instr-local-panel', group: 'instruments',
      names: L('PLT-Stelle im örtlichen Leitstand', 'Instrument, local panel', 'Instrumento en panel local', 'Instrument sur tableau local'),
      tags: L('plt messstelle kreis örtlicher leitstand', 'instrument bubble local panel', 'instrumento panel local', 'instrument tableau local'),
      vb: [48, 48],
      body: [['circle', { cx: 24, cy: 24, r: 22 }], ['path', { d: 'M2.1 22H45.9M2.1 26H45.9' }]],
    },
    {
      id: 'instr-ti', group: 'instruments',
      names: L('Temperaturanzeige örtlich (TI)', 'Temperature indicator, field (TI)', 'Indicador de temperatura (TI)', 'Indicateur de température (TI)'),
      tags: L('plt ti temperatur anzeige thermometer', 'instrument ti temperature indicator', 'instrumento ti temperatura', 'instrument ti température'),
      vb: [48, 48],
      body: [['circle', { cx: 24, cy: 24, r: 22 }], label(24, 29.5, 15, 'TI')],
    },
    {
      id: 'instr-fic', group: 'instruments',
      names: L('Durchflussregelung in der Warte (FIC)', 'Flow controller, control room (FIC)', 'Controlador de caudal (FIC)', 'Régulateur de débit (FIC)'),
      tags: L('plt fic durchfluss regler regelung', 'instrument fic flow controller', 'instrumento fic caudal controlador', 'instrument fic débit régulateur'),
      vb: [48, 48],
      body: [['circle', { cx: 24, cy: 24, r: 22 }], ['path', { d: 'M2 24H46' }], label(24, 19.5, 12, 'FIC')],
    },
    {
      id: 'instr-dcs', group: 'instruments',
      names: L('Funktion im Prozessleitsystem', 'Function in control system (DCS)', 'Función en sistema de control (DCS)', 'Fonction dans le SNCC'),
      tags: L('pls prozessleitsystem dcs leitsystem kreis quadrat', 'dcs shared display control system', 'dcs sistema control distribuido', 'sncc système contrôle commande'),
      vb: [48, 48],
      body: [['rect', { x: 2, y: 2, width: 44, height: 44 }], ['circle', { cx: 24, cy: 24, r: 22 }], ['path', { d: 'M2 24H46' }]],
    },
  ],
};
