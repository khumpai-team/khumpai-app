/**
 * One-time asset prep: remove the cream background from the official Khumpi
 * mascot PNGs (assets/khumpi-*.png) and write transparent cutouts to
 * src/assets/khumpi/. Uses a corner flood-fill — Khumpi's darker outline blocks
 * the fill, so his light-but-cool interior is preserved while the warm cream is
 * cleared. A light halo pass removes the anti-aliased fringe.
 *
 * Run: node scripts/cutout.mjs
 */
import Jimp from 'jimp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SRC = path.join(root, 'assets');
const OUT = path.join(root, 'src', 'assets', 'khumpi');

const TOL = 62; // flood tolerance from the cream seed color
const HALO = 48; // fringe cleanup tolerance

await fs.mkdir(OUT, { recursive: true });

for (let n = 1; n <= 5; n++) {
  const img = await Jimp.read(path.join(SRC, `khumpi-${n}.png`));
  const { data, width, height } = img.bitmap;
  const at = (p) => p * 4;
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];

  // Seed = average of the four corners (the cream).
  let sr = 0, sg = 0, sb = 0;
  for (const p of corners) {
    sr += data[at(p)];
    sg += data[at(p) + 1];
    sb += data[at(p) + 2];
  }
  sr /= 4; sg /= 4; sb /= 4;
  const dist = (p, r, g, b) => Math.hypot(data[at(p)] - r, data[at(p) + 1] - g, data[at(p) + 2] - b);

  // Flood-fill the cream from every corner.
  const visited = new Uint8Array(width * height);
  const q = [...corners];
  while (q.length) {
    const p = q.pop();
    if (visited[p]) continue;
    visited[p] = 1;
    if (dist(p, sr, sg, sb) > TOL) continue; // hit Khumpi's outline → stop
    data[at(p) + 3] = 0;
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) q.push(p - 1);
    if (x < width - 1) q.push(p + 1);
    if (y > 0) q.push(p - width);
    if (y < height - 1) q.push(p + width);
  }

  // Halo cleanup: near-cream pixels touching transparency get cleared too.
  const isTrans = (p) => data[at(p) + 3] === 0;
  for (let p = 0; p < width * height; p++) {
    if (data[at(p) + 3] === 0) continue;
    if (dist(p, sr, sg, sb) > HALO) continue;
    const x = p % width;
    const y = (p / width) | 0;
    const ns = [];
    if (x > 0) ns.push(p - 1);
    if (x < width - 1) ns.push(p + 1);
    if (y > 0) ns.push(p - width);
    if (y < height - 1) ns.push(p + width);
    if (ns.some(isTrans)) data[at(p) + 3] = 0;
  }

  // Downscale for the web — these render at ≤150px, so 480px is plenty.
  if (img.bitmap.width > 480) img.resize(480, Jimp.AUTO);
  await img.writeAsync(path.join(OUT, `khumpi-${n}.png`));
  console.log(`khumpi-${n}.png → cutout (${width}x${height}, seed ${Math.round(sr)},${Math.round(sg)},${Math.round(sb)})`);
}
