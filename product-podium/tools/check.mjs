/**
 * Per-look verification.
 *
 * Every criterion in the brief that can be decided from pixels is decided
 * here rather than by eye: where the plinth top sits in frame, whether the
 * corners of look 2 are truly 0,0,0, whether the wood is warmer than the
 * wall, whether the wall is softer than the plinth.
 */
import { decode, edgesInColumn, meanRect, detail } from "./px.mjs";

const pass = (ok) => (ok ? "PASS" : "FAIL");
const fmt = (c) => c.map((v) => Math.round(v)).join(",");

/**
 * Find the plinth's top surface in a vertical scan: the first strong edge
 * below `searchTop` is its back edge, and the next strong edge going down
 * is where the top face gives way to the rim.
 */
const topSurfaceBand = (img, xFrac, searchTop = 0.25, searchBottom = 0.75, threshold = 7) => {
  const edges = edgesInColumn(img, xFrac, threshold).filter(
    (e) => e.yFrac > searchTop && e.yFrac < searchBottom,
  );
  if (edges.length < 2) return null;
  return { top: edges[0].yFrac, bottom: edges[edges.length - 1].yFrac };
};

/**
 * Is there a shadow pattern across this region? Rather than guessing where
 * a leaf happens to fall, tile the region and compare its darkest block
 * with its brightest: a gobo puts a real spread of tone across a surface
 * that would otherwise be flat.
 */
const patternSpread = (img, x0, y0, x1, y1, cols = 8, rows = 4) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bx0 = x0 + ((x1 - x0) * c) / cols;
      const bx1 = x0 + ((x1 - x0) * (c + 1)) / cols;
      const by0 = y0 + ((y1 - y0) * r) / rows;
      const by1 = y0 + ((y1 - y0) * (r + 1)) / rows;
      const m = meanRect(img, bx0, by0, bx1, by1);
      const v = (m[0] + m[1] + m[2]) / 3;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  return { lo, hi, spread: hi - lo };
};

/** Bright runs down a column, with near-touching runs merged. */
const brightRuns = (img, xFrac, from, to, threshold, mergeGap = 0.012) => {
  const x = Math.round(xFrac * img.width);
  const runs = [];
  let start = null;
  for (let y = Math.round(from * img.height); y < Math.round(to * img.height); y++) {
    const bright = img.lum(x, y) > threshold;
    if (bright && start === null) start = y / img.height;
    if (!bright && start !== null) {
      runs.push([start, y / img.height]);
      start = null;
    }
  }
  if (start !== null) runs.push([start, to]);
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] < mergeGap) last[1] = r[1];
    else merged.push([...r]);
  }
  return merged;
};

const checks = {
  "DuotoneGlass-PodiumMagentaCyan": (img, out) => {
    const band = topSurfaceBand(img, 0.5, 0.3, 0.56, 10);
    out.push(["plinth top 40-50%", band && band.top >= 0.4 && band.top <= 0.5, band && `${(band.top * 100).toFixed(1)}%`]);
    const l = meanRect(img, 0.3, 0.55, 0.37, 0.64);
    const c = meanRect(img, 0.46, 0.55, 0.54, 0.64);
    const r = meanRect(img, 0.63, 0.55, 0.7, 0.64);
    // A blended band means the centre sits between the two ends on both the
    // red and the blue axis, rather than jumping from one to the other.
    const blended = c[0] < l[0] && c[0] > r[0] && c[2] > l[2] * 0.6 && c[2] < r[2];
    out.push(["colours mix across middle", blended, `L=${fmt(l)} C=${fmt(c)} R=${fmt(r)}`]);
    const poolL = meanRect(img, 0.1, 0.82, 0.26, 0.95);
    const poolR = meanRect(img, 0.74, 0.82, 0.9, 0.95);
    const dark = meanRect(img, 0.46, 0.1, 0.54, 0.18);
    out.push([
      "light pools on floor in both colours",
      poolL[0] > poolL[2] * 0.9 && poolL[0] > dark[0] + 25 && poolR[2] > poolR[0] + 25,
      `L=${fmt(poolL)} R=${fmt(poolR)} field=${fmt(dark)}`,
    ]);
    // Compare the floor immediately outside the disc's base with floor at
    // the same depth but away from it — a contact shadow is a local
    // darkening, so it has to be measured against its own neighbourhood.
    const contact = meanRect(img, 0.44, 0.755, 0.56, 0.785);
    const beside = meanRect(img, 0.2, 0.755, 0.3, 0.785);
    const sum = (c) => c[0] + c[1] + c[2];
    out.push(["contact shadow at base", sum(contact) < sum(beside), `contact=${fmt(contact)} beside=${fmt(beside)}`]);
  },

  "NeonRing-PodiumBlue": (img, out) => {
    // Search below the top ring's glow: the surface itself starts where the
    // ring's bright core ends.
    const band = topSurfaceBand(img, 0.5, 0.42, 0.56, 14);
    out.push(["plinth top 40-50%", band && band.top >= 0.4 && band.top <= 0.5, band && `${(band.top * 100).toFixed(1)}%`]);
    // Two rings, not one thick band: down the centre of frame the top ring
    // is crossed twice — behind the top face and in front of it — and the
    // bottom ring once. What has to be true is that the bottom ring is a
    // separate structure, with unlit disc between it and the top ring.
    const runs = brightRuns(img, 0.5, 0.3, 0.85, 120);
    const gap = runs.length >= 2 ? runs[runs.length - 1][0] - runs[runs.length - 2][1] : 0;
    out.push([
      "two separate rings",
      runs.length >= 2 && gap > 0.03,
      `runs ${runs.map((r) => `${(r[0] * 100).toFixed(1)}-${(r[1] * 100).toFixed(1)}%`).join(" | ")}; dark gap ${(gap * 100).toFixed(1)}%`,
    ]);
    const top = meanRect(img, 0.45, 0.44, 0.55, 0.49);
    out.push(["disc top faintly visible (not 0,0,0)", top[0] + top[1] + top[2] > 6, fmt(top)]);
    // The all-looks contact-shadow criterion does not apply here and is
    // reported as such rather than fudged: this look's own spec calls for
    // pure black with no visible wall, floor or horizon, so there is no
    // ground for a contact shadow to fall on. What marks the base instead
    // is the lower ring, with the disc's unlit side between the two rings.
    const side = meanRect(img, 0.45, 0.55, 0.55, 0.6);
    const ring = meanRect(img, 0.45, 0.635, 0.55, 0.655);
    out.push([
      "n/a: no ground in this look — base marked by the lower ring",
      side[0] + side[1] + side[2] < ring[0] + ring[1] + ring[2],
      `unlit disc side=${fmt(side)} lower ring=${fmt(ring)}`,
    ]);
    for (const [name, r] of [["TL", [0.01, 0.02, 0.09, 0.12]], ["TR", [0.91, 0.02, 0.99, 0.12]], ["BL", [0.01, 0.88, 0.09, 0.98]], ["BR", [0.91, 0.88, 0.99, 0.98]]]) {
      const c = meanRect(img, ...r);
      out.push([`corner ${name} is 0,0,0`, c[0] === 0 && c[1] === 0 && c[2] === 0, fmt(c)]);
    }
  },

  "FlutedPlaster-PodiumCylinder": (img, out) => {
    const band = topSurfaceBand(img, 0.5, 0.3, 0.6, 7);
    out.push(["plinth top 40-50%", band && band.top >= 0.4 && band.top <= 0.5, band && `${(band.top * 100).toFixed(1)}%`]);
    // Flutes: a horizontal scan across the shaft should swing repeatedly.
    const y = Math.round(0.68 * img.height);
    let swings = 0;
    let prev = 0;
    let last = img.lum(Math.round(0.33 * img.width), y);
    for (let x = Math.round(0.33 * img.width); x < Math.round(0.67 * img.width); x++) {
      const v = img.lum(x, y);
      const d = v - last;
      if (Math.abs(d) > 0.6) {
        const sign = Math.sign(d);
        if (sign !== prev && prev !== 0) swings++;
        prev = sign;
        last = v;
      }
    }
    out.push(["flutes have lit and shaded sides", swings >= 6, `${swings} shading reversals across the shaft`]);
    const wallDetail = detail(img, 0.06, 0.06, 0.3, 0.26);
    const plinthDetail = detail(img, 0.36, 0.55, 0.64, 0.82);
    out.push(["wall softer than plinth", plinthDetail > wallDetail * 1.3, `wall=${wallDetail.toFixed(2)} plinth=${plinthDetail.toFixed(2)}`]);
    const wall = patternSpread(img, 0.02, 0.02, 0.98, 0.34);
    const floor = patternSpread(img, 0.02, 0.84, 0.98, 0.99);
    out.push(["gobo on wall", wall.spread > 10, `tone spread ${wall.spread.toFixed(1)} (${wall.lo.toFixed(0)}..${wall.hi.toFixed(0)})`]);
    out.push(["gobo on floor", floor.spread > 10, `tone spread ${floor.spread.toFixed(1)} (${floor.lo.toFixed(0)}..${floor.hi.toFixed(0)})`]);
    const pedges = edgesInColumn(img, 0.5, 9).filter((e) => e.yFrac > 0.82 && e.yFrac < 0.94);
    const pbase = pedges.length ? pedges[pedges.length - 1].yFrac : 0.9;
    const pcrease = meanRect(img, 0.44, pbase + 0.005, 0.56, pbase + 0.02);
    const pfurther = meanRect(img, 0.44, pbase + 0.035, 0.56, pbase + 0.055);
    const sum3 = (c) => c[0] + c[1] + c[2];
    out.push(["contact shadow at base", sum3(pcrease) < sum3(pfurther) - 12, `base at ${(pbase * 100).toFixed(1)}%, crease=${fmt(pcrease)} further=${fmt(pfurther)}`]);
  },

  "WoodLeaf-PodiumCool": (img, out) => {
    const band = topSurfaceBand(img, 0.5, 0.3, 0.6, 7);
    out.push(["plinth top 40-50%", band && band.top >= 0.4 && band.top <= 0.5, band && `${(band.top * 100).toFixed(1)}%`]);
    const plinth = meanRect(img, 0.42, 0.44, 0.58, 0.48);
    const wall = meanRect(img, 0.78, 0.2, 0.95, 0.34);
    const floor = meanRect(img, 0.3, 0.9, 0.5, 0.97);
    const warmer = plinth[0] - plinth[2] > wall[0] - wall[2] + 30 && plinth[0] - plinth[2] > floor[0] - floor[2] + 30;
    out.push(["plinth warmer than wall and floor", warmer, `plinth R-B=${(plinth[0] - plinth[2]).toFixed(0)} wall R-B=${(wall[0] - wall[2]).toFixed(0)} floor R-B=${(floor[0] - floor[2]).toFixed(0)}`]);
    const grain = detail(img, 0.42, 0.43, 0.58, 0.48);
    const flat = detail(img, 0.78, 0.2, 0.95, 0.34);
    out.push(["wood grain visible on top face", grain > flat * 2, `grain=${grain.toFixed(2)} flat wall=${flat.toFixed(2)}`]);
    const wallArea = patternSpread(img, 0.02, 0.02, 0.98, 0.36);
    const floorArea = patternSpread(img, 0.02, 0.6, 0.98, 0.99);
    out.push(["leaf shadow on wall", wallArea.spread > 10, `tone spread ${wallArea.spread.toFixed(1)} (${wallArea.lo.toFixed(0)}..${wallArea.hi.toFixed(0)})`]);
    out.push(["leaf shadow on floor", floorArea.spread > 10, `tone spread ${floorArea.spread.toFixed(1)} (${floorArea.lo.toFixed(0)}..${floorArea.hi.toFixed(0)})`]);
    // The crease immediately under the plinth against floor a little
    // further out, at the same x — so a leaf shadow crossing the area
    // affects both samples equally and cannot fake the result.
    // The camera is locked and the plinth does not move, so where the disc
    // meets the floor is a constant of the rig, not something to hunt for
    // with an edge detector that a leaf shadow can fool.
    const base = 0.585;
    const crease = meanRect(img, 0.44, base + 0.005, 0.56, base + 0.02);
    const further = meanRect(img, 0.44, base + 0.035, 0.56, base + 0.055);
    const sum2 = (c) => c[0] + c[1] + c[2];
    out.push([
      "contact shadow at base",
      sum2(crease) < sum2(further) - 12,
      `base at ${(base * 100).toFixed(1)}%, crease=${fmt(crease)} further=${fmt(further)}`,
    ]);
  },

  "FlutedPlaster-PodiumColumnPair": (img, out) => {
    const left = topSurfaceBand(img, 0.38, 0.3, 0.62, 6);
    const right = topSurfaceBand(img, 0.63, 0.3, 0.62, 6);
    out.push(["shorter column top 40-50%", left && left.top >= 0.4 && left.top <= 0.5, left && `${(left.top * 100).toFixed(1)}%`]);
    out.push(["taller column top 40-50%", right && right.top >= 0.4 && right.top <= 0.5, right && `${(right.top * 100).toFixed(1)}%`]);
    out.push(["columns at different heights", left && right && Math.abs(left.top - right.top) > 0.03, left && right && `${(left.top * 100).toFixed(1)}% vs ${(right.top * 100).toFixed(1)}%`]);
  },
};

const variantBAlias = {
  "DuotoneGlass-PodiumAmberTeal": "DuotoneGlass-PodiumMagentaCyan",
  "NeonRing-PodiumMagenta": "NeonRing-PodiumBlue",
  "WoodLeaf-PodiumWarmWalnut": "WoodLeaf-PodiumCool",
};

const [, , file, id, frame] = process.argv;
const img = decode(file, frame === undefined ? {} : { frame: Number(frame) });
const key = checks[id] ? id : variantBAlias[id];
const out = [];
if (!checks[key]) {
  console.log(`no checks defined for ${id}`);
} else {
  checks[key](img, out);
}
let failed = 0;
console.log(`  frame ${frame ?? 0}  (${img.width}x${img.height})`);
for (const [name, ok, note] of out) {
  if (!ok) failed++;
  console.log(`  ${pass(ok)}  ${name}${note ? `  [${note}]` : ""}`);
}
process.exit(failed ? 1 : 0);
