/**
 * Reports how tightly each variant's surface is packed: how many sprite
 * elements the placement pass could not fit clear of the others, and how far
 * the worst one had to overlap. Run after changing any population count.
 *
 *   node_modules/.bin/esbuild tools/check-layout.ts --bundle --platform=node --format=cjs --outfile=/tmp/check.cjs && node /tmp/check.cjs
 */
import { buildPlanes } from "../src/geometry";
import { buildLayout } from "../src/layout";
import { VARIANTS, type VariantName } from "../src/variants";

const names: VariantName[] = ["teal", "amber", "green"];
let failures = 0;

for (const name of names) {
  const config = VARIANTS[name];
  const planes = buildPlanes(
    config.structure,
    config.planes,
    config.planeMirror,
  );
  const layout = buildLayout(name, config, planes);

  type Box = { u: number; v: number; hw: number; hh: number; what: string };
  const boxes: Box[] = [];
  for (const g of layout.glyphs) {
    boxes.push({
      u: g.u,
      v: g.v,
      hw: g.size * 1.4,
      hh: g.size * 1.4,
      what: `glyph ${g.id}`,
    });
  }
  for (const b of layout.blocks) {
    const e = b.extent;
    boxes.push({
      u: b.u,
      v: b.v,
      hw: e.hw,
      hh: e.hh,
      what: `${b.kind} ${b.id}`,
    });
  }

  const plane = planes[0];
  const wrapDelta = (d: number, period: number) => {
    let x = ((d % period) + period) % period;
    if (x > period / 2) x -= period;
    return x;
  };

  let overlaps = 0;
  let worst = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const sep = Math.max(
        Math.abs(wrapDelta(a.u - b.u, plane.tileU)) - a.hw - b.hw,
        Math.abs(wrapDelta(a.v - b.v, plane.tileV)) - a.hh - b.hh,
      );
      if (sep < 0) {
        overlaps++;
        worst = Math.min(worst, sep);
      }
    }
  }

  const area = boxes.reduce((acc, b) => acc + b.hw * 2 * b.hh * 2, 0);
  const tile = plane.tileU * plane.tileV;
  console.log(
    `${name.padEnd(6)} elements=${String(boxes.length).padStart(3)} ` +
      `coverage=${((area / tile) * 100).toFixed(0)}% ` +
      `overlapping pairs=${overlaps} worst=${Math.round(-worst)}px`,
  );
  if (overlaps > 0) failures++;
}

process.exit(failures === 0 ? 0 : 1);
