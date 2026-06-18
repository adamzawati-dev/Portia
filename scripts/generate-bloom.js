// scripts/generate-bloom.js
// Generates a soft radial bloom sprite (white RGB, radial alpha falloff) used by
// <Background>. Rendered via <Image tintColor> so one sprite serves every glow
// color. Run: node scripts/generate-bloom.js assets/bloom.png
const fs = require('fs');
const zlib = require('zlib');

const W = 320;
const H = 320;

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const cx = (W - 1) / 2;
const cy = (H - 1) / 2;
const R = W / 2;

const raw = Buffer.alloc(H * (1 + W * 4));
let p = 0;
for (let y = 0; y < H; y++) {
  raw[p++] = 0; // filter: none
  for (let x = 0; x < W; x++) {
    const dx = (x - cx) / R;
    const dy = (y - cy) / R;
    const d2 = dx * dx + dy * dy; // 0 at center, 1 at edge
    // Gaussian falloff — soft, fully transparent by the edge.
    const a = Math.round(255 * Math.exp(-4.0 * d2));
    raw[p++] = 255;
    raw[p++] = 255;
    raw[p++] = 255;
    raw[p++] = a;
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = process.argv[2] || 'assets/bloom.png';
fs.writeFileSync(out, png);
console.log('wrote', out, png.length, 'bytes');
