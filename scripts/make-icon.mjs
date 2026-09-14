// Generate the application's small code-defined N monogram without image dependencies.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const size = 64,
  raw = Buffer.alloc(size * (size * 4 + 1));
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    const i = y * (size * 4 + 1) + 1 + x * 4;
    const white =
      y >= 15 &&
      y <= 48 &&
      ((x >= 16 && x <= 22) ||
        (x >= 41 && x <= 47) ||
        Math.abs(x - (19 + ((y - 15) * 25) / 33)) < 4);
    raw.set(white ? [245, 247, 250, 255] : [101, 119, 230, 255], i);
  }
function crc(buffer) {
  let c = 0xffffffff;
  for (const b of buffer) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type),
    body = Buffer.concat([name, data]),
    out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length);
  body.copy(out, 4);
  out.writeUInt32BE(crc(body), out.length - 4);
  return out;
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico[6] = size;
ico[7] = size;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
const dir = fileURLToPath(new URL("../src-tauri/icons/", import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(dir + "icon.png", png);
writeFileSync(dir + "icon.ico", Buffer.concat([ico, png]));
