// ZIP lesen und schreiben mit den Bordmitteln des Browsers (Office-Dateien sind ZIP-Archive)
const MAX_FILES = 5000;
const MAX_TOTAL = 400 * 1024 * 1024; // Schutz vor Archiven, die beim Entpacken explodieren

async function pipe(data, stream) {
  const out = new Blob([data]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

// Die Größenangabe im Archiv ist frei wählbar: Beim Entpacken selbst mitzählen und abbrechen
async function inflateLimited(data, budget) {
  const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > budget.left) {
      await reader.cancel();
      throw new Error('Archiv zu groß');
    }
    chunks.push(value);
  }
  budget.left -= size;
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export async function readZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('kein ZIP-Archiv');
  const count = view.getUint16(eocd + 10, true);
  if (count > MAX_FILES) throw new Error('zu viele Einträge');
  let at = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map();
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('beschädigtes Archiv');
    const method = view.getUint16(at + 10, true);
    const compSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    total += size;
    if (total > MAX_TOTAL) throw new Error('Archiv zu groß');
    entries.set(name, { method, compSize, offset });
    at += 46 + nameLen + extra + comment;
  }
  const budget = { left: MAX_TOTAL };
  const read = async (name) => {
    const e = entries.get(name);
    if (!e) return null;
    const start = e.offset + 30 + view.getUint16(e.offset + 26, true) + view.getUint16(e.offset + 28, true);
    const raw = bytes.subarray(start, start + e.compSize);
    return e.method === 0 ? raw : inflateLimited(raw, budget);
  };
  return { names: [...entries.keys()], read, text: async (name) => {
    const d = await read(name);
    return d ? decoder.decode(d) : null;
  } };
}

let crcTable = null;
function crc32(data) {
  if (!crcTable) {
    crcTable = new Uint32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// files: [{ name, data: Uint8Array | string }]
export async function writeZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const name = enc.encode(f.name);
    const comp = await pipe(data, new CompressionStream('deflate-raw'));
    const crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 0x0800, true);
    head.setUint16(8, 8, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, comp.length, true);
    head.setUint32(22, data.length, true);
    head.setUint16(26, name.length, true);
    parts.push(new Uint8Array(head.buffer), name, comp);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 8, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, comp.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + comp.length;
  }
  const size = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

export async function inflateRaw(bytes) {
  return inflateLimited(bytes, { left: 50 * 1024 * 1024 });
}
