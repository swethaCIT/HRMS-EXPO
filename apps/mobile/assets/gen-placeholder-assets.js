// One-off generator for placeholder Expo brand assets (solid-color PNGs).
// Run: node gen-placeholder-assets.js
// Replace the generated PNGs with real branded artwork before shipping.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function solidPng(width, height, [r, g, b, a]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = width * 4;
  const raw = Buffer.alloc((rowLen + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowLen + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const off = rowStart + 1 + x * 4;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = a;
    }
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// HRMS brand indigo (#4F46E5), transparent for the notification icon mask.
const INDIGO = [79, 70, 229, 255];
const TRANSPARENT_WHITE = [255, 255, 255, 0];

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, 'icon.png'), solidPng(1024, 1024, INDIGO));
fs.writeFileSync(path.join(outDir, 'adaptive-icon.png'), solidPng(1024, 1024, INDIGO));
fs.writeFileSync(path.join(outDir, 'splash.png'), solidPng(1200, 1200, INDIGO));
fs.writeFileSync(path.join(outDir, 'favicon.png'), solidPng(48, 48, INDIGO));
fs.writeFileSync(path.join(outDir, 'notification-icon.png'), solidPng(96, 96, TRANSPARENT_WHITE));
console.log('Generated placeholder assets in', outDir);
