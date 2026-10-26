'use strict';
// Systemmetriken für die Administration: CPU, Arbeitsspeicher, Ereignisschleife, Speicherplatz, Verlauf
const os = require('os');
const fs = require('fs');
const { monitorEventLoopDelay } = require('perf_hooks');

const INTERVAL = 5000;
const HISTORY = 120; // 10 Minuten bei 5 s

// Gemessen wird der Abstand zwischen Zeitgeber-Aufrufen; die Auflösung selbst ist keine Verzögerung
const RES = 10;
const loop = monitorEventLoopDelay({ resolution: RES });
loop.enable();

const history = [];
let lastCpu = process.cpuUsage();
let lastAt = process.hrtime.bigint();
let lastSystem = systemCpuTimes();

function systemCpuTimes() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) {
    for (const v of Object.values(c.times)) total += v;
    idle += c.times.idle;
  }
  return { idle, total };
}

// Im Container gelten Grenzen der cgroup (v2, ersatzweise v1) statt der Werte des Hosts
function readNumber(file) {
  try {
    const v = fs.readFileSync(file, 'utf8').trim();
    if (v === 'max') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n < 2 ** 60 ? n : null;
  } catch {
    return null;
  }
}

function cgroupMemory() {
  const limit = readNumber('/sys/fs/cgroup/memory.max') ?? readNumber('/sys/fs/cgroup/memory/memory.limit_in_bytes');
  const used = readNumber('/sys/fs/cgroup/memory.current') ?? readNumber('/sys/fs/cgroup/memory/memory.usage_in_bytes');
  return limit || used ? { limit, used } : null;
}

function cgroupCpus() {
  try {
    const [quota, period] = fs.readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim().split(/\s+/);
    if (quota !== 'max') return Number(quota) / Number(period);
  } catch {}
  return null;
}

const cores = () => cgroupCpus() || (os.availableParallelism ? os.availableParallelism() : os.cpus().length);

function sample() {
  const now = process.hrtime.bigint();
  const elapsedUs = Number(now - lastAt) / 1000;
  const cpu = process.cpuUsage(lastCpu);
  const sys = systemCpuTimes();
  const sysTotal = sys.total - lastSystem.total, sysIdle = sys.idle - lastSystem.idle;
  lastCpu = process.cpuUsage();
  lastAt = now;
  lastSystem = sys;
  const mem = process.memoryUsage();
  history.push({
    t: Date.now(),
    // Anteil an der verfügbaren Rechenleistung (100 % = alle Kerne ausgelastet)
    cpu: Math.min(100, ((cpu.user + cpu.system) / elapsedUs / cores()) * 100),
    hostCpu: sysTotal > 0 ? Math.max(0, Math.min(100, 100 - (sysIdle / sysTotal) * 100)) : 0,
    rss: mem.rss,
    lag: Math.max(0, loop.mean / 1e6 - RES),
    lagP99: Math.max(0, loop.percentile(99) / 1e6 - RES),
  });
  if (history.length > HISTORY) history.shift();
  loop.reset();
}

setInterval(sample, INTERVAL).unref();
setTimeout(sample, 1000).unref();

function disk(path) {
  try {
    const s = fs.statfsSync(path);
    return { path, total: s.blocks * s.bsize, free: s.bavail * s.bsize };
  } catch {
    return null;
  }
}

function snapshot() {
  const last = history[history.length - 1] || {};
  const mem = process.memoryUsage();
  const cg = cgroupMemory();
  const disks = [disk(process.cwd()), process.env.BACKUP_DIR ? disk(process.env.BACKUP_DIR) : null].filter(Boolean);
  return {
    cpu: {
      process: last.cpu ?? null,
      host: last.hostCpu ?? null,
      cores: Math.round(cores() * 100) / 100,
      model: (os.cpus()[0] || {}).model || '',
      load: os.loadavg(),
    },
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      hostTotal: os.totalmem(),
      hostFree: os.freemem(),
      containerLimit: cg && cg.limit,
      containerUsed: cg && cg.used,
    },
    eventLoopLagMs: last.lag ?? null,
    eventLoopLagP99Ms: last.lagP99 ?? null,
    disks,
    uptime: { process: Math.round(process.uptime()), host: Math.round(os.uptime()) },
    node: process.version,
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    history: history.map((h) => ({ t: h.t, cpu: Math.round(h.cpu * 10) / 10, rss: h.rss, lag: Math.round(h.lag * 10) / 10 })),
  };
}

module.exports = { snapshot };
