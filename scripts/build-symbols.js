#!/usr/bin/env node
'use strict';
/*
 * Erzeugt die mitgelieferten Fachsymbolsätze unter public/vendor/symbols/ und die Liste der Dateien in public/js/symbol-files.js.
 * Das Ergebnis liegt im Repo, im Betrieb läuft dieses Skript nicht.
 *
 *   node scripts/build-symbols.js --carbon <Ordner> --kubernetes <Ordner>
 *
 * Quellen (nur zum Bauen, nicht im Repo):
 *   --carbon      entpacktes npm-Paket @carbon/icons (npm pack @carbon/icons; tar xzf …), Apache-2.0
 *   --kubernetes  Ordner icons/ aus https://github.com/kubernetes/community, Apache-2.0 oder CC-BY-4.0
 * Ohne Angabe bleibt die vorhandene Datei des Satzes stehen. Elektro- und Verfahrenstechnik (scripts/symbols/) sind selbst gezeichnet.
 *
 * Aufbau einer Datei: { set, version, mode, groups: [[Kennung, {de, en, es, fr}] …], icons: [[Name, Gruppe, Bezeichnung, Stichwörter, viewBox, Knoten] …] }
 * Bezeichnung: {de, en, es, fr} oder ein englischer Text. Knoten: siehe lib/svg-clean.js.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cleanSvg } = require('../lib/svg-clean');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'vendor', 'symbols');
const CLIENT = path.join(ROOT, 'public', 'js', 'symbol-files.js');
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/; // Gleiche Prüfung in lib/sanitize.js, höchstens 37 Zeichen nach dem Präfix

const arg = (name) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? path.resolve(process.argv[i + 1]) : null;
};

const L = (de, en, es, fr) => ({ de, en, es, fr });

/* ---------------- IBM Carbon ---------------- */

// Unterkategorien des Satzes, die zu IT und Technik gehören. Der Rest (Wetter, Reisen, Medizin, Formatierung) steckt schon in den Allgemeinen Symbolen.
const CARBON_GROUPS = [
  ['ai', L('KI und maschinelles Lernen', 'AI and machine learning', 'IA y aprendizaje automático', 'IA et apprentissage automatique'), ['AI']],
  ['cloud', L('Cloud und Infrastruktur', 'Cloud and infrastructure', 'Nube e infraestructura', 'Cloud et infrastructure'), ['App catalogue', 'Systems']],
  ['data', L('Daten und Analyse', 'Data and analytics', 'Datos y análisis', 'Données et analyse'), ['Data']],
  ['security', L('Sicherheit', 'Security', 'Seguridad', 'Sécurité'), []],
  ['dev', L('Entwicklung und Betrieb', 'Development and operations', 'Desarrollo y operaciones', 'Développement et exploitation'), ['Operations']],
  ['devices', L('Geräte und Technik', 'Devices and technology', 'Dispositivos y tecnología', 'Appareils et technologie'), ['Technology', 'Instruments']],
  ['files', L('Dateien und Ordner', 'Files and folders', 'Archivos y carpetas', 'Fichiers et dossiers'), ['File']],
  ['business', L('Finanzen und Business', 'Finance and business', 'Finanzas y negocios', 'Finance et affaires'), ['Commerce']],
  ['ui', L('Bedienelemente', 'User interface and controls', 'Interfaz y controles', 'Interface et commandes'), ['Controls', 'Toggle', 'Navigation']],
  ['status', L('Status und Hinweise', 'Status and alerts', 'Estado y avisos', 'État et alertes'), ['Status']],
  ['people', L('Personen und Rollen', 'People and roles', 'Personas y roles', 'Personnes et rôles'), ['User']],
];
const SECURITY = /(^|-)(security|secure|lock|locked|unlocked|password|encrypt|encryption|encrypted|decrypt|firewall|shield|fingerprint|identity|key|keys|certificate|vulnerability|threat|bastion|privacy|vpn|data-diode|code-signing|policy|access|credentials|hsm|virus|malware|spy|hacker|incognito|two-factor|2fa|token|cyber)(-|$)/;
// Produkte und Marken: IBM, Partner, Datenbanken mit Herstellernamen, Großrechner-Begriffe, Logos
const CARBON_OUT = /(^|-)(ibm|watson|watsonx|logo|carbon|red-hat|redhat|openshift|cics|cicsplex|db2|zos|z|ims|cobol|qiskit|maximo|instana|turbonomic|aspera|cloudant|datastage|datastax|enterprisedb|enterprise-db2|mongodb|postgresql|redis|rabbit|etcd|elastic|airplay|bluetooth|kubernetes|cloud-foundry|cloud-satellite|sap|java|spss|cognos|power-vs|bsam|qsam|zedc|granite|mq|elo|sterling|webmethods|streamsets|databand|bluemix|softlayer|apple|android|windows|linux|ubuntu|python|github|gitlab|slack|twitter|youtube|z-system|zsystems|sysplex|coupling-facility|dfsort|wazi|launchpad|lpar|vsam|jcl)(-|$)/i;

function carbonName(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildCarbon(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  if (pkg.name !== '@carbon/icons' || pkg.license !== 'Apache-2.0') throw new Error(`Carbon: Paket ${pkg.name} mit Lizenz ${pkg.license}, erwartet @carbon/icons mit Apache-2.0`);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'), 'utf8'));
  const subOf = new Map();
  for (const c of meta.categories) for (const s of c.subcategories) for (const m of s.members) if (!subOf.has(m)) subOf.set(m, s.name);
  const groupOf = new Map(CARBON_GROUPS.flatMap(([id, , subs]) => subs.map((s) => [s, id])));
  const ids = CARBON_GROUPS.map(([id]) => id);
  const icons = [], seen = new Set();
  for (const ic of meta.icons) {
    if (ic.deprecated || CARBON_OUT.test(ic.name) || CARBON_OUT.test(ic.friendlyName || '')) continue;
    const sub = subOf.get(ic.name);
    const name = carbonName(ic.name);
    let group = SECURITY.test(name) ? 'security' : groupOf.get(sub);
    if (!group || seen.has(name) || !NAME_RE.test(name) || name.length > 37) continue;
    const asset = ic.assets.find((a) => a.size === 32) || ic.assets[ic.assets.length - 1];
    const file = path.join(dir, 'svg', asset.filepath);
    if (!fs.existsSync(file)) continue;
    const svg = cleanSvg(fs.readFileSync(file, 'utf8'), 'cb-' + name);
    // Unsichtbare Hilfsflächen (transparentes Rechteck, ausgesparte Innenflächen) fallen weg
    svg.nodes = dropInvisible(svg.nodes);
    if (!svg.nodes.length) continue;
    seen.add(name);
    const words = [...new Set((ic.aliases || []).join(' ').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w && !name.split('-').includes(w)))].join(' ');
    icons.push([name, ids.indexOf(group), ic.friendlyName || name, words, svg.vb, stripIds(svg.nodes)]);
  }
  icons.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { set: 'cb', version: pkg.version, mode: 'fill', groups: CARBON_GROUPS.map(([id, names]) => [id, names]), icons };
}

function dropInvisible(nodes) {
  return nodes.filter((n) => typeof n === 'string' || !(n[1].fill === 'none' && !n[1].stroke)).map((n) => (typeof n === 'string' ? n : [n[0], n[1], ...dropInvisible(n.slice(2))]))
    .filter((n) => typeof n === 'string' || n[0] !== 'g' || n.length > 2);
}

// Kennungen ohne Verweis darauf sind nur Ballast
function stripIds(nodes) {
  const used = new Set(JSON.stringify(nodes).match(/#[a-z0-9-]+/g) || []);
  const walk = (list) => list.map((n) => {
    if (typeof n === 'string') return n;
    const [tag, attrs, ...kids] = n;
    if (attrs.id && !used.has('#' + attrs.id)) delete attrs.id;
    return [tag, attrs, ...walk(kids)];
  });
  return walk(nodes);
}

/* ---------------- Kubernetes ---------------- */

const K8S = [
  // Datei, Kennung, Bezeichnung (de), Bezeichnung (en), Gruppe, Stichwörter
  ['control_plane_components/labeled/api', 'api-server', 'API-Server', 'API server', 'control', 'kube apiserver steuerung'],
  ['control_plane_components/labeled/c-c-m', 'cloud-controller-manager', 'Cloud Controller Manager', 'Cloud controller manager', 'control', 'ccm'],
  ['control_plane_components/labeled/c-m', 'controller-manager', 'Controller Manager', 'Controller manager', 'control', 'kube controller cm'],
  ['control_plane_components/labeled/k-proxy', 'kube-proxy', 'kube-proxy', 'kube-proxy', 'control', 'proxy netzwerk network'],
  ['control_plane_components/labeled/kubelet', 'kubelet', 'Kubelet', 'Kubelet', 'control', 'agent knoten node'],
  ['control_plane_components/labeled/sched', 'scheduler', 'Scheduler', 'Scheduler', 'control', 'planer kube'],
  ['infrastructure_components/unlabeled/control-plane', 'control-plane', 'Control Plane', 'Control plane', 'infra', 'master steuerungsebene'],
  ['infrastructure_components/unlabeled/node', 'node', 'Node', 'Node', 'infra', 'knoten worker'],
  ['infrastructure_components/unlabeled/etcd', 'etcd', 'etcd', 'etcd', 'infra', 'schlüssel wert speicher key value store'],
  ['resources/unlabeled/pod', 'pod', 'Pod', 'Pod', 'workload', 'container'],
  ['resources/unlabeled/deploy', 'deployment', 'Deployment', 'Deployment', 'workload', 'deploy bereitstellung'],
  ['resources/unlabeled/rs', 'replicaset', 'ReplicaSet', 'ReplicaSet', 'workload', 'rs replikat'],
  ['resources/unlabeled/sts', 'statefulset', 'StatefulSet', 'StatefulSet', 'workload', 'sts zustand'],
  ['resources/unlabeled/ds', 'daemonset', 'DaemonSet', 'DaemonSet', 'workload', 'ds dienst jeder knoten'],
  ['resources/unlabeled/job', 'job', 'Job', 'Job', 'workload', 'auftrag'],
  ['resources/unlabeled/cronjob', 'cronjob', 'CronJob', 'CronJob', 'workload', 'zeitplan cron'],
  ['resources/unlabeled/hpa', 'hpa', 'Horizontal Pod Autoscaler', 'Horizontal pod autoscaler', 'workload', 'hpa skalierung autoscaling'],
  ['resources/unlabeled/svc', 'service', 'Service', 'Service', 'network', 'svc dienst'],
  ['resources/unlabeled/ing', 'ingress', 'Ingress', 'Ingress', 'network', 'ing eingang'],
  ['resources/unlabeled/ep', 'endpoints', 'Endpoints', 'Endpoints', 'network', 'ep endpunkte'],
  ['resources/unlabeled/netpol', 'network-policy', 'Network Policy', 'Network policy', 'network', 'netpol netzwerkrichtlinie'],
  ['resources/unlabeled/vol', 'volume', 'Volume', 'Volume', 'storage', 'vol speicher'],
  ['resources/unlabeled/pv', 'persistent-volume', 'Persistent Volume', 'Persistent volume', 'storage', 'pv speicher'],
  ['resources/unlabeled/pvc', 'persistent-volume-claim', 'Persistent Volume Claim', 'Persistent volume claim', 'storage', 'pvc speicher'],
  ['resources/unlabeled/sc', 'storage-class', 'Storage Class', 'Storage class', 'storage', 'sc speicherklasse'],
  ['resources/unlabeled/cm', 'configmap', 'ConfigMap', 'ConfigMap', 'config', 'cm konfiguration'],
  ['resources/unlabeled/secret', 'secret', 'Secret', 'Secret', 'config', 'geheimnis kennwort'],
  ['resources/unlabeled/ns', 'namespace', 'Namespace', 'Namespace', 'config', 'ns namensraum'],
  ['resources/unlabeled/quota', 'resource-quota', 'Resource Quota', 'Resource quota', 'config', 'quota kontingent'],
  ['resources/unlabeled/limits', 'limit-range', 'Limit Range', 'Limit range', 'config', 'limits grenzen'],
  ['resources/unlabeled/crd', 'custom-resource-definition', 'Custom Resource Definition', 'Custom resource definition', 'config', 'crd erweiterung'],
  ['resources/unlabeled/user', 'user', 'User', 'User', 'access', 'benutzer person'],
  ['resources/unlabeled/group', 'group', 'Group', 'Group', 'access', 'gruppe'],
  ['resources/unlabeled/sa', 'service-account', 'Service Account', 'Service account', 'access', 'sa dienstkonto'],
  ['resources/unlabeled/role', 'role', 'Role', 'Role', 'access', 'rolle rbac'],
  ['resources/unlabeled/c-role', 'cluster-role', 'ClusterRole', 'ClusterRole', 'access', 'clusterrolle rbac'],
  ['resources/unlabeled/rb', 'role-binding', 'RoleBinding', 'RoleBinding', 'access', 'rb rollenbindung rbac'],
  ['resources/unlabeled/crb', 'cluster-role-binding', 'ClusterRoleBinding', 'ClusterRoleBinding', 'access', 'crb rbac'],
  ['resources/unlabeled/psp', 'pod-security-policy', 'Pod Security Policy', 'Pod security policy', 'access', 'psp sicherheit'],
];
const K8S_GROUPS = [
  ['control', L('Steuerungsebene', 'Control plane', 'Plano de control', 'Plan de contrôle')],
  ['infra', L('Infrastruktur', 'Infrastructure', 'Infraestructura', 'Infrastructure')],
  ['workload', L('Workloads', 'Workloads', 'Cargas de trabajo', 'Charges de travail')],
  ['network', L('Netzwerk', 'Networking', 'Red', 'Réseau')],
  ['storage', L('Speicher', 'Storage', 'Almacenamiento', 'Stockage')],
  ['config', L('Konfiguration', 'Configuration', 'Configuración', 'Configuration')],
  ['access', L('Zugriff und Rechte', 'Access control', 'Control de acceso', 'Contrôle d’accès')],
];

function buildKubernetes(dir) {
  const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  if (!/licensed under a choice of either Apache-2\.0\s+or CC-BY-4\.0/.test(readme)) throw new Error('Kubernetes: Lizenzhinweis im README nicht gefunden');
  const ids = K8S_GROUPS.map(([id]) => id);
  const icons = K8S.map(([file, name, de, en, group, words]) => {
    const svg = cleanSvg(fs.readFileSync(path.join(dir, 'svg', file + '.svg'), 'utf8'), 'kc-' + name);
    return [name, ids.indexOf(group), L(de, en, en, en), words, svg.vb, stripIds(svg.nodes)];
  });
  return { set: 'kc', version: '', mode: 'color', groups: K8S_GROUPS, icons };
}

/* ---------------- Eigene Sätze ---------------- */

function buildOwn(set, file) {
  const src = require(file);
  const ids = src.groups.map(([id]) => id);
  const icons = src.symbols.map((s) => {
    if (!NAME_RE.test(s.id) || s.id.length > 37) throw new Error(`${set}: ungültige Kennung ${s.id}`);
    if (!ids.includes(s.group)) throw new Error(`${set}: unbekannte Gruppe bei ${s.id}`);
    // Auch die eigenen Zeichnungen laufen durch die Prüfung: Was dort nicht durchkommt, wäre ein Fehler in der Datei
    const markup = toSvg(s.vb, s.body);
    const clean = cleanSvg(markup, `${set}-${s.id}`);
    const tags = [...new Set(Object.values(s.tags || {}).join(' ').toLowerCase().split(/\s+/).filter(Boolean))].join(' ');
    return [s.id, ids.indexOf(s.group), s.names, tags, clean.vb, clean.nodes];
  });
  return { set, version: '', mode: 'stroke', groups: src.groups, icons };
}

const escAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function toSvg(vb, body) {
  const node = ([tag, attrs, ...kids]) => `<${tag}${Object.entries(attrs || {}).map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('')}>${kids.map((k) => (typeof k === 'string' ? escAttr(k) : node(k))).join('')}</${tag}>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb[0]} ${vb[1]}">${body.map(node).join('')}</svg>`;
}

/* ---------------- Schreiben ---------------- */

function write(data) {
  const body = JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 8);
  const base = { cb: 'carbon', kc: 'kubernetes', el: 'electrical', pi: 'process' }[data.set];
  for (const f of fs.readdirSync(OUT_DIR)) if (f.startsWith(base + '-') && f.endsWith('.json')) fs.unlinkSync(path.join(OUT_DIR, f));
  const file = `${base}-${hash}.json`;
  fs.writeFileSync(path.join(OUT_DIR, file), body);
  const gz = require('zlib').gzipSync(body, { level: 9 }).length;
  process.stdout.write(`${base}: ${data.icons.length} Symbole, ${(body.length / 1e6).toFixed(2)} MB, gepackt ${(gz / 1e6).toFixed(2)} MB\n`);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const carbon = arg('carbon'), k8s = arg('kubernetes');
  if (carbon) {
    write(buildCarbon(carbon));
    fs.copyFileSync(path.join(carbon, 'LICENSE'), path.join(OUT_DIR, 'LICENSE-APACHE-2.0'));
  }
  if (k8s) write(buildKubernetes(k8s));
  for (const [set, name] of [['el', 'electrical'], ['pi', 'process']]) {
    const file = path.join(__dirname, 'symbols', name + '.js');
    if (fs.existsSync(file)) write(buildOwn(set, file));
  }
  // Dateinamen für den Browser. Sie enthalten einen Prüfwert, damit Browser die Dateien dauerhaft behalten dürfen.
  const files = {};
  for (const f of fs.readdirSync(OUT_DIR).sort()) {
    const m = /^(carbon|kubernetes|electrical|process)-[0-9a-f]{8}\.json$/.exec(f);
    if (m) files[{ carbon: 'cb', kubernetes: 'kc', electrical: 'el', process: 'pi' }[m[1]]] = '/vendor/symbols/' + f;
  }
  fs.writeFileSync(CLIENT, `// Erzeugt von scripts/build-symbols.js – nicht von Hand ändern\nexport const SYMBOL_FILES = ${JSON.stringify(files, null, 2).replace(/"/g, "'")};\n`);
}

main();
