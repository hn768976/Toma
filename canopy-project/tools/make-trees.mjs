/**
 * Generates the bare-tree silhouette source assets as black-on-white PNGs.
 *
 * The brief supplies these as ready-made PNGs; this script stands in for them
 * by drawing the same three archetypes procedurally, at a resolution high
 * enough that the near tier still holds up at 4K. Drop the real files into
 * public/trees/ under the same names and nothing else has to change — the
 * runtime luminance key in src/keying.ts consumes either one identically.
 *
 * Usage: node tools/make-trees.mjs
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "trees");
const tmpDir = join(here, ".build");

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const UP = -Math.PI / 2;
const lerp = (a, b, t) => a + (b - a) * t;

// Everything is drawn in a space 1000 units tall, so each archetype's numbers
// read as fractions of the tree's own height rather than as pixels.
const H = 1000;

/**
 * A tree is a trunk plus a set of primary limbs hung off it, each of which
 * subdivides recursively. Building it in those two stages — rather than as one
 * uniform recursion from the root — is what keeps the overall silhouette under
 * control: trunk length, crown width and crown height are set directly instead
 * of emerging from whatever a geometric series happens to converge to.
 */
const growTree = (cfg) => {
  const rnd = mulberry32(cfg.seed);
  const strokes = [];
  const range = (lo, hi) => lo + rnd() * (hi - lo);

  const limb = (x, y, ang, len, w0, w1, curve) => {
    const steps = 10;
    let cx = x;
    let cy = y;
    let a = ang;
    for (let i = 0; i < steps; i++) {
      const px = cx;
      const py = cy;
      a += curve / steps;
      cx += (Math.cos(a) * len) / steps;
      cy += (Math.sin(a) * len) / steps;
      const t = (i + 0.5) / steps;
      strokes.push({ x1: px, y1: py, x2: cx, y2: cy, w: w0 + (w1 - w0) * t });
    }
    return { x: cx, y: cy, a };
  };

  const spur = (from, len, w) => {
    const side = rnd() < 0.5 ? -1 : 1;
    limb(
      from.x,
      from.y,
      from.a + side * range(0.6, 1.5),
      len * range(0.2, 0.45),
      Math.min(w * 0.4, cfg.minWidth * 4),
      cfg.minWidth * 0.6,
      (rnd() - 0.5) * 0.8,
    );
  };

  /** Recursive crown subdivision, one dominant leader plus thinner side limbs. */
  const crown = (x, y, ang, len, w, depth) => {
    if (depth <= 0 || len < cfg.minLen || w < cfg.minWidth) return;

    const curve = (rnd() - 0.5) * cfg.curve;
    const wEnd = w * cfg.widthDecay;
    const tip = limb(x, y, ang, len, w, wEnd, curve);

    // A few limbs simply stop — snapped-off ends read as winter deadwood.
    if (depth < cfg.depth && rnd() < cfg.snapChance) return;

    const base = tip.a + (rnd() - 0.5) * cfg.jitter;

    // Leader: near the parent heading, keeps most of the width.
    crown(
      tip.x,
      tip.y,
      lerp(base + (rnd() - 0.5) * cfg.spread * 0.5, UP, cfg.upright * range(0.3, 1)),
      len * cfg.lenDecay * range(0.9, 1.06),
      wEnd * range(0.82, 0.93),
      depth - 1,
    );

    // One or two side limbs at much wider angles, shorter and thinner.
    let side = rnd() < 0.5 ? -1 : 1;
    const sides = rnd() < cfg.tripleChance ? 2 : 1;
    for (let i = 0; i < sides; i++) {
      crown(
        tip.x,
        tip.y,
        lerp(
          base + side * cfg.spread * range(0.7, 1.4),
          UP,
          cfg.upright * range(0, 0.7),
        ),
        len * cfg.lenDecay * range(0.55, 0.88),
        wEnd * range(0.5, 0.72),
        depth - 1,
      );
      side = -side;
    }

    if (rnd() < cfg.spurChance) spur(tip, len, wEnd);
    if (rnd() < cfg.spurChance * 0.5) spur(tip, len * 0.6, wEnd);
  };

  // --- Trunk -------------------------------------------------------------
  const trunkH = H * cfg.trunkFrac;
  const trunkW = H * cfg.trunkWidth;
  const steps = 7;
  const bend = (rnd() < 0.5 ? -1 : 1) * cfg.trunkBend;
  const nodes = [];
  let x = 0;
  let y = 0;
  let a = UP;
  for (let i = 0; i < steps; i++) {
    const w0 = lerp(trunkW, trunkW * cfg.trunkTaper, i / steps);
    const w1 = lerp(trunkW, trunkW * cfg.trunkTaper, (i + 1) / steps);
    // A gentle, consistent lean plus a little wander — dead-straight trunks
    // read as drawn rather than grown.
    const tip = limb(x, y, a, trunkH / steps, w0, w1, bend / steps + (rnd() - 0.5) * 0.05);
    x = tip.x;
    y = tip.y;
    a = tip.a;
    nodes.push({ x, y, a, t: (i + 1) / steps });
  }

  // --- Low limbs ---------------------------------------------------------
  // Small branches partway up the bare stem, well below the crown.
  for (const n of nodes) {
    if (n.t > 0.75 || rnd() > cfg.lowLimbChance) continue;
    const side = rnd() < 0.5 ? -1 : 1;
    crown(
      n.x,
      n.y,
      n.a + side * range(0.75, 1.3),
      H * cfg.crownFrac * range(0.16, 0.3),
      trunkW * cfg.trunkTaper * range(0.2, 0.32),
      Math.max(3, cfg.depth - 3),
    );
  }

  // --- Primary limbs -----------------------------------------------------
  const crownLen = H * cfg.crownFrac;
  const topW = trunkW * cfg.trunkTaper;
  for (let i = 0; i < cfg.primaries; i++) {
    // Fan the primaries across the spread, alternating sides so the crown
    // opens out evenly, and hang them from progressively higher trunk nodes.
    const u = cfg.primaries === 1 ? 0 : i / (cfg.primaries - 1);
    const signed = (u - 0.5) * 2;
    const ang = UP + signed * cfg.primarySpread + (rnd() - 0.5) * 0.28;
    const node = nodes[Math.min(nodes.length - 1, steps - 1 - (i % cfg.forkDepth))];
    // Limbs nearer the outside of the fan are shorter, which rounds the crown.
    const shorten = 1 - Math.abs(signed) * cfg.fanShorten;
    crown(
      node.x,
      node.y,
      ang,
      crownLen * cfg.primaryLen * shorten * range(0.85, 1.15),
      topW * range(0.55, 0.85),
      cfg.depth,
    );
  }

  // The trunk's own continuation into the crown.
  const top = nodes[nodes.length - 1];
  crown(top.x, top.y, top.a, crownLen * cfg.primaryLen * range(0.9, 1.1), topW * 0.9, cfg.depth);

  return { strokes, trunkW };
};

const toSvg = (cfg, { strokes, trunkW }) => {
  // Fit the viewBox to what was actually drawn, so nothing clips and there is
  // no dead margin to throw the layout transforms off.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  for (const s of strokes) {
    const r = Math.max(s.w, 1) / 2;
    minX = Math.min(minX, s.x1 - r, s.x2 - r);
    maxX = Math.max(maxX, s.x1 + r, s.x2 + r);
    minY = Math.min(minY, s.y1 - r, s.y2 - r);
  }

  const footW = trunkW * 1.75;
  minX = Math.min(minX, -footW / 2);
  maxX = Math.max(maxX, footW / 2);
  const maxY = 0; // the foot sits exactly on the bottom edge of the image

  const pad = trunkW * 0.3;
  const vw = maxX - minX + pad * 2;
  const vh = maxY - minY + pad;
  const ox = -minX + pad;
  const oy = -minY + pad;

  const body = strokes
    .map(
      (s) =>
        `<line x1="${(s.x1 + ox).toFixed(2)}" y1="${(s.y1 + oy).toFixed(2)}" ` +
        `x2="${(s.x2 + ox).toFixed(2)}" y2="${(s.y2 + oy).toFixed(2)}" ` +
        `stroke-width="${Math.max(s.w, 1).toFixed(2)}"/>`,
    )
    .join("");

  // Flared foot, so the trunk meets the frame edge with some weight.
  const flare = trunkW * 1.1;
  const foot =
    `<path d="M ${ox - footW / 2} ${oy + 2} ` +
    `C ${ox - trunkW * 0.54} ${oy - flare * 0.55} ` +
    `${ox - trunkW * 0.52} ${oy - flare * 0.8} ` +
    `${ox - trunkW * 0.5} ${oy - flare * 1.2} ` +
    `L ${ox + trunkW * 0.5} ${oy - flare * 1.2} ` +
    `C ${ox + trunkW * 0.52} ${oy - flare * 0.8} ` +
    `${ox + trunkW * 0.54} ${oy - flare * 0.55} ` +
    `${ox + footW / 2} ${oy + 2} Z" fill="#000"/>`;

  const h = cfg.renderHeight;
  const w = Math.round((vw / vh) * h);

  return {
    w,
    h,
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
      `viewBox="0 0 ${vw.toFixed(2)} ${vh.toFixed(2)}">` +
      `<rect width="${vw.toFixed(2)}" height="${vh.toFixed(2)}" fill="#fff"/>` +
      `<g stroke="#000" stroke-linecap="round" fill="none">${body}</g>` +
      foot +
      `</svg>`,
  };
};

const TREES = [
  {
    // Slim bare tree, long clean trunk — the workhorse of the radial layout.
    name: "Untitled_design__4_",
    renderHeight: 2900,
    seed: 20260904,
    trunkFrac: 0.64,
    crownFrac: 0.36,
    trunkWidth: 0.046,
    trunkTaper: 0.5,
    trunkBend: 0.16,
    primaries: 4,
    primarySpread: 0.52,
    primaryLen: 0.46,
    fanShorten: 0.2,
    forkDepth: 3,
    depth: 7,
    lenDecay: 0.72,
    widthDecay: 0.86,
    spread: 0.62,
    jitter: 0.3,
    upright: 0.26,
    curve: 0.36,
    tripleChance: 0.22,
    snapChance: 0.06,
    spurChance: 0.3,
    lowLimbChance: 0.3,
    minWidth: 0.35,
    minLen: 5,
  },
  {
    // Dense bare oak: short trunk, crown-heavy, a great many fine twigs.
    name: "Untitled_design__2_",
    renderHeight: 2600,
    seed: 771103,
    trunkFrac: 0.3,
    crownFrac: 0.7,
    trunkWidth: 0.062,
    trunkTaper: 0.58,
    trunkBend: 0.1,
    primaries: 7,
    primarySpread: 1.0,
    primaryLen: 0.52,
    fanShorten: 0.26,
    forkDepth: 4,
    depth: 9,
    lenDecay: 0.73,
    widthDecay: 0.86,
    spread: 0.8,
    jitter: 0.44,
    upright: 0.2,
    curve: 0.5,
    tripleChance: 0.5,
    snapChance: 0.05,
    spurChance: 0.44,
    lowLimbChance: 0.35,
    minWidth: 0.3,
    minLen: 3.5,
  },
  {
    // Wide spreading dead tree — nearly all horizontal reach, barely any trunk.
    name: "Untitled_design__3_",
    renderHeight: 2000,
    seed: 400817,
    trunkFrac: 0.3,
    crownFrac: 0.7,
    trunkWidth: 0.07,
    trunkTaper: 0.6,
    trunkBend: 0.08,
    primaries: 6,
    primarySpread: 1.34,
    primaryLen: 0.62,
    fanShorten: 0.05,
    forkDepth: 3,
    depth: 8,
    lenDecay: 0.78,
    widthDecay: 0.87,
    spread: 1.0,
    jitter: 0.5,
    upright: 0.05,
    curve: 0.5,
    tripleChance: 0.42,
    snapChance: 0.12,
    spurChance: 0.4,
    lowLimbChance: 0.3,
    minWidth: 0.3,
    minLen: 4,
  },
];

const CHROME_CANDIDATES = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
];

mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) throw new Error("No Chromium binary found for rasterising the SVGs");

for (const cfg of TREES) {
  const { w, h, svg } = toSvg(cfg, growTree(cfg));
  const svgPath = join(tmpDir, `${cfg.name}.svg`);
  writeFileSync(svgPath, svg);

  const png = join(outDir, `${cfg.name}.png`);
  execFileSync(
    chrome,
    [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${w},${h}`,
      `--screenshot=${png}`,
      `file://${svgPath}`,
    ],
    { stdio: "ignore" },
  );
  console.log(`wrote ${png}  (${w}x${h})`);
}

rmSync(tmpDir, { recursive: true, force: true });
