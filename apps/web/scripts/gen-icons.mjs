// Generates solid-green PNG icons with a cream house glyph (no image dependencies).
// Run from apps/web: node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

function png(size, scale) {
  const green = [0x1b, 0x5e, 0x20];
  const cream = [0xff, 0xf8, 0xee];
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const u = (x / size - 0.5) / scale;
      const v = (y / size - 0.5) / scale;
      const roof = v >= -0.3 && v < 0 && Math.abs(u) <= (v + 0.3) * 1.2 + 0.02;
      const body = v >= 0 && v <= 0.28 && Math.abs(u) <= 0.26;
      const door = v >= 0.08 && v <= 0.28 && Math.abs(u) <= 0.06;
      row.set((roof || body) && !door ? cream : green, 1 + x * 3);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/192.png", png(192, 1));
writeFileSync("public/icons/512.png", png(512, 1));
writeFileSync("public/icons/maskable.png", png(512, 0.7)); // glyph inside the safe zone
