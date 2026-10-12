// Rasterise Natural Earth 1:110m land into an equirectangular land mask
// (1440 x 720, cell centres) and extract coastline polylines.
// Output: src/data/world.json  { w, h, mask (base64 bits, row-major from
// north), coasts: [[lon, lat, lon, lat, ...], ...] }
import { readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync(new URL("../data/natural-earth/ne_110m_land.geojson", import.meta.url)));
const W = 1440;
const H = 720;
const rings = [];
for (const f of src.features) {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const p of polys) for (const r of p) rings.push(r);
}
const bits = new Uint8Array((W * H) / 8);
for (let row = 0; row < H; row++) {
  const lat = 90 - (row + 0.5) * (180 / H);
  const xs = [];
  for (const r of rings) {
    for (let i = 0; i < r.length - 1; i++) {
      const [x0, y0] = r[i];
      const [x1, y1] = r[i + 1];
      if ((y0 > lat) !== (y1 > lat)) xs.push(x0 + ((lat - y0) * (x1 - x0)) / (y1 - y0));
    }
  }
  xs.sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const c0 = Math.max(0, Math.ceil((xs[k] + 180) / (360 / W) - 0.5));
    const c1 = Math.min(W - 1, Math.floor((xs[k + 1] + 180) / (360 / W) - 0.5));
    for (let c = c0; c <= c1; c++) {
      const idx = row * W + c;
      bits[idx >> 3] |= 1 << (idx & 7);
    }
  }
}
const coasts = rings
  .filter((r) => r.length > 4)
  .map((r) => r.flatMap(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]));
let land = 0;
for (let i = 0; i < W * H; i++) if (bits[i >> 3] & (1 << (i & 7))) land++;
writeFileSync(
  new URL("../src/data/world.json", import.meta.url),
  JSON.stringify({ w: W, h: H, mask: Buffer.from(bits).toString("base64"), coasts }),
);
console.log(`land cells ${land} / ${W * H} (${((100 * land) / (W * H)).toFixed(1)}%), rings ${coasts.length}`);
