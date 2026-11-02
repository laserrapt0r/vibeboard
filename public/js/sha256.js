// SHA-256 ohne Warten: crypto.subtle ist asynchron und fehlt ohne HTTPS, Kennungen entstehen aber mitten in der Eingabe (siehe uid in util.js)
const K = [];
for (let n = 2, i = 0; i < 64; n++) {
  let prime = true;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) prime = false;
  if (prime) K[i++] = (Math.cbrt(n) % 1) * 2 ** 32 | 0;
}
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

export function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const data = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(data.length - 8, Math.floor(bytes.length / 2 ** 29));
  view.setUint32(data.length - 4, bytes.length << 3);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Int32Array(64);
  for (let off = 0; off < data.length; off += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getInt32(off + t * 4);
    for (let t = 16; t < 64; t++) {
      const a = w[t - 15], b = w[t - 2];
      w[t] = (w[t - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + w[t - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => (h[i] = (h[i] + v) | 0));
  }
  return h.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}
