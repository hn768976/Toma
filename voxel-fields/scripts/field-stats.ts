// Prints the height-field distribution, ASCII maps and a loop-seam check.
// Run: npx tsx scripts/field-stats.ts
import {
  canyonNoiseAt,
  canyonHeightFromNoise,
  GRID_X,
  GRID_Z,
  waveHeightAt,
  floatingCubes,
  CANYON,
} from "../src/lib/fields";

const vals: number[] = [];
for (let f = 0; f < 600; f += 60)
  for (let j = 0; j < GRID_Z; j += 2)
    for (let i = 0; i < GRID_X; i += 2) vals.push(canyonNoiseAt(i, j, f / 600));
vals.sort((a, b) => a - b);
const q = (p: number) => vals[Math.floor(p * (vals.length - 1))].toFixed(3);
console.log(
  "canyon noise quantiles",
  [0.01, 0.03, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9, 0.99].map((p) => `${p}:${q(p)}`).join(" "),
);
const hs = vals.map(canyonHeightFromNoise);
const frac = (fn: (h: number) => boolean) => (hs.filter(fn).length / hs.length).toFixed(3);
console.log(
  "plateau", frac((h) => h >= -0.5 && h <= 0.5),
  "above", frac((h) => h > 0.5),
  "canyon", frac((h) => h < -0.5 && h > CANYON.voidTop),
  "void", frac((h) => h <= CANYON.voidTop),
);

const ascii = (fn: (i: number, j: number) => string) => {
  let s = "";
  for (let j = 10; j < 80; j += 2) {
    for (let i = 20; i < 120; i++) s += fn(i, j);
    s += "\n";
  }
  return s;
};
for (const f of [0, 300]) {
  console.log(`canyon frame ${f}  (space=void .=deep :=mid o=plateau O=+1 #=+2)`);
  console.log(
    ascii((i, j) => {
      const h = canyonHeightFromNoise(canyonNoiseAt(i, j, f / 600));
      return h <= CANYON.voidTop ? " " : h < -4 ? "." : h < -1 ? ":" : h < 0.5 ? "o" : h < 1.5 ? "O" : "#";
    }),
  );
}
console.log("wave frame 0");
console.log(ascii((i, j) => " .:oO#@"[Math.min(6, Math.round(waveHeightAt(i, j, 0)))]));
console.log("floating cubes", floatingCubes.length);

// Seam: the jump across the loop point should be no bigger than a normal step.
for (const [name, fn] of [
  ["canyon", (i: number, j: number, t: number) => canyonHeightFromNoise(canyonNoiseAt(i, j, t))],
  ["wave", waveHeightAt],
] as const) {
  let seam = 0;
  let step = 0;
  for (let j = 0; j < GRID_Z; j++)
    for (let i = 0; i < GRID_X; i++) {
      const a = fn(i, j, 599 / 600);
      const b = fn(i, j, 0);
      const c = fn(i, j, 1 / 600);
      const d = fn(i, j, 1); // raw t = 1, no modulo
      seam = Math.max(seam, Math.abs(a - b), Math.abs(d - b));
      step = Math.max(step, Math.abs(c - b));
    }
  console.log(`${name}: max |h(599)-h(0)|,|h(t=1)-h(0)| = ${seam.toFixed(4)}   max |h(1)-h(0)| = ${step.toFixed(4)}`);
}

// Holes in frame: share of in-frame columns that are in the void, per frame.
import { columnX, columnZ } from "../src/lib/fields";
import { inFrameCore } from "../src/lib/frameArea";
const per: string[] = [];
let minShare = 1;
for (let f = 0; f < 600; f += 20) {
  let n = 0;
  let v = 0;
  for (let j = 0; j < GRID_Z; j++)
    for (let i = 0; i < GRID_X; i++) {
      if (!inFrameCore(columnX(i), columnZ(j))) continue;
      n++;
      if (canyonHeightFromNoise(canyonNoiseAt(i, j, f / 600)) <= CANYON.voidTop) v++;
    }
  minShare = Math.min(minShare, v / n);
  per.push(`${f}:${((100 * v) / n).toFixed(1)}%`);
}
console.log("void share in frame core:", per.join(" "));
console.log("min void share", (100 * minShare).toFixed(1) + "%");
{
  // Canyon share (below plateau) in frame core.
  const out: string[] = [];
  for (let f = 0; f < 600; f += 60) {
    let n = 0, c = 0;
    for (let j = 0; j < GRID_Z; j++)
      for (let i = 0; i < GRID_X; i++) {
        if (!inFrameCore(columnX(i), columnZ(j))) continue;
        n++;
        if (canyonHeightFromNoise(canyonNoiseAt(i, j, f / 600)) < -0.5) c++;
      }
    out.push(`${f}:${((100 * c) / n).toFixed(0)}%`);
  }
  console.log("below-plateau share in frame core:", out.join(" "));
}
