#!/usr/bin/env node
/**
 * Generates the two onboarding hero strips as ordered-dither PNGs.
 *
 * The compact onboarding window opens with a dark band that the Murmur mark
 * sits on and that dissolves downward into the page surface. A smooth gradient
 * would band on 6-bit panels and read as the same soft wash every app ships, so
 * the fade is an 8x8 Bayer dither: hard pixels, no interpolation, visibly
 * constructed. It is the one textured surface in the app.
 *
 * The strip is 32x192 and drawn 1:1 (the hero is h-48 = 192px, tiled on x with
 * image-rendering: pixelated), so no resampling ever softens the pattern.
 *
 * Deliberately tonal, not branded: the accent is reserved for live audio, so
 * this fades black-to-surface and carries only the faintest green bias in the
 * neutral. Regenerate with: npm run dither
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const W = 32;
const H = 192;

/** Standard 8x8 Bayer threshold matrix, normalised to 0..1 at use. */
const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** PNG chunk: length, type, data, CRC32. */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * top and bottom are hex strings. The alpha ramps rather than the colour: the
 * strip has to sit over whatever the surface token currently is, so it fades to
 * transparent instead of to a second baked colour.
 */
function strip(top) {
  const [r, g, b] = hex(top);
  const raw = Buffer.alloc(H * (1 + W * 4));

  for (let y = 0; y < H; y++) {
    const rowStart = y * (1 + W * 4);
    raw[rowStart] = 0; // filter type: none

    // The band stays fully solid down to 55% of its height and only then
    // dissolves. That is not an aesthetic preference: the Murmur mark is drawn
    // over this strip in white, and its ink spans roughly 41-71% of the height.
    // A fade that begins at the top would leave the caret sitting on bare
    // surface with nothing to read against in light mode.
    const t = y / (H - 1);
    const u = Math.min(1, Math.max(0, (t - 0.55) / 0.45));
    const coverage = 1 - Math.pow(u, 1.35);

    for (let x = 0; x < W; x++) {
      const threshold = (BAYER[y % 8][x % 8] + 0.5) / 64;
      const on = coverage > threshold;
      const px = rowStart + 1 + x * 4;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = on ? 255 : 0;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const ASSETS = path.join(__dirname, "..", "src", "assets");
for (const [file, colour] of [
  // Light: the app's ink, so the band reads as the same black the mark is cut from.
  ["onboarding-hero-dither.png", "#10150F"],
  // Dark: one step below the dark surface rather than above it — on a dark
  // window the band has to recede, not glow.
  ["onboarding-hero-dither-dark.png", "#05080600".slice(0, 7)],
]) {
  fs.writeFileSync(path.join(ASSETS, file), strip(colour));
  console.log(`  ${file.padEnd(34)} ${W}x${H}  ${colour}`);
}
