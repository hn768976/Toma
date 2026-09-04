/**
 * Authors the "Ai" chip icon asset.
 *
 * Writes two files from one source of truth:
 *   public/ai-chip.svg   — the icon artwork, black-on-white, 1024x1024
 *   src/lib/aiChipPins.ts — terminal-dot centres in 0..1 UV space, so the
 *                           renderer can pulse the pins without re-parsing
 *                           the SVG.
 *
 * Run with: node scripts/generate-ai-chip.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const S = 1024;
const C = S / 2; // 512

// ---------------------------------------------------------------- chip body
const BODY = { x0: 332, y0: 332, x1: 692, y1: 692, r: 46 };
const INNER = { x0: 374, y0: 374, x1: 650, y1: 650, r: 26 };

const W_BODY = 22;
const W_INNER = 9;
const W_LEG = 13;
const W_TERM = 15;
const R_TERM = 34;

// ------------------------------------------------------------------- pins
const PIN_XS = [0, 1, 2, 3, 4, 5, 6].map((i) => C + (i - 3) * 48);
const PIN_W = 20;
const PIN_TIP = 300; // where the leg starts, above the body edge
const PIN_ROOT = 340; // tucked under the body stroke

/**
 * Fan-out tables. `dx` is the lateral shift, `v1` the rise before the dogleg,
 * `v2` the rise after it. Outer pins turn earlier and travel further, which is
 * what keeps the routes from crossing.
 */
const TABLE_A = [
  { dx: -70, v1: 50, v2: 140 },
  { dx: 0, v1: 0, v2: 200 },
  { dx: 0, v1: 0, v2: 120 },
  { dx: 0, v1: 0, v2: 245 },
  { dx: 0, v1: 0, v2: 155 },
  { dx: 0, v1: 0, v2: 225 },
  { dx: 80, v1: 60, v2: 125 },
];
const TABLE_B = [
  { dx: -140, v1: 45, v2: 115 },
  { dx: -70, v1: 90, v2: 95 },
  { dx: 0, v1: 0, v2: 190 },
  { dx: 0, v1: 0, v2: 130 },
  { dx: 0, v1: 0, v2: 230 },
  { dx: 0, v1: 0, v2: 150 },
  { dx: 0, v1: 0, v2: 235 },
];

const fmt = (n) => Math.round(n * 100) / 100;

/** Polyline with rounded corners, emitted as an SVG path. */
const roundedPath = (pts, r) => {
  let d = `M ${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l0 = Math.hypot(x - px, y - py);
    const l1 = Math.hypot(nx - x, ny - y);
    const rr = Math.min(r, l0 / 2, l1 / 2);
    const a = [x + ((px - x) / l0) * rr, y + ((py - y) / l0) * rr];
    const b = [x + ((nx - x) / l1) * rr, y + ((ny - y) / l1) * rr];
    d += ` L ${fmt(a[0])} ${fmt(a[1])} Q ${fmt(x)} ${fmt(y)} ${fmt(b[0])} ${fmt(b[1])}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${fmt(last[0])} ${fmt(last[1])}`;
  return d;
};

/** One side's worth of pin stubs, legs and terminal dots, in canonical (top) space. */
const buildSide = (table) => {
  const parts = [];
  const terminals = [];
  table.forEach((route, i) => {
    const px = PIN_XS[i];
    parts.push(
      `<rect x="${fmt(px - PIN_W / 2)}" y="${PIN_TIP}" width="${PIN_W}" height="${PIN_ROOT - PIN_TIP}" rx="4" fill="#000"/>`,
    );

    const tx = px + route.dx;
    const ty = PIN_TIP - route.v1 - route.v2;
    const pts = [[px, PIN_TIP]];
    if (route.dx !== 0) {
      pts.push([px, PIN_TIP - route.v1]);
      pts.push([tx, PIN_TIP - route.v1]);
    }
    // Stop at the rim of the terminal dot so no line shows inside the ring.
    pts.push([tx, ty + R_TERM]);

    parts.push(
      `<path d="${roundedPath(pts, 26)}" fill="none" stroke="#000" stroke-width="${W_LEG}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
    parts.push(
      `<circle cx="${tx}" cy="${ty}" r="${R_TERM}" fill="none" stroke="#000" stroke-width="${W_TERM}"/>`,
    );
    terminals.push([tx, ty]);
  });
  return { markup: parts.join("\n    "), terminals };
};

/** Rotate a point about the canvas centre by `deg`. */
const rot = ([x, y], deg) => {
  const a = (deg * Math.PI) / 180;
  const dx = x - C;
  const dy = y - C;
  return [C + dx * Math.cos(a) - dy * Math.sin(a), C + dx * Math.sin(a) + dy * Math.cos(a)];
};

const sides = [
  { table: TABLE_A, deg: 0 },
  { table: TABLE_B, deg: 90 },
  { table: TABLE_A, deg: 180 },
  { table: TABLE_B, deg: 270 },
];

const sideMarkup = [];
const pinUvs = [];
for (const { table, deg } of sides) {
  const { markup, terminals } = buildSide(table);
  sideMarkup.push(`  <g transform="rotate(${deg} ${C} ${C})">\n    ${markup}\n  </g>`);
  for (const t of terminals) {
    const [x, y] = rot(t, deg);
    pinUvs.push([fmt(x / S), fmt(y / S)]);
  }
}

// ------------------------------------------------------------- "Ai" letters
// Drawn as explicit outlines rather than text, so the artwork rasterises
// identically on any machine regardless of installed fonts.
const TEXT_DX = 25;
const A_OUTER = [
  [392, 604],
  [444, 420],
  [470, 420],
  [522, 604],
  [488, 604],
  [471, 560],
  [443, 560],
  [426, 604],
];
const A_COUNTER = [
  [457, 470],
  [467, 528],
  [447, 528],
];
const poly = (pts) =>
  pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${fmt(x + TEXT_DX)} ${fmt(y)}`).join(" ") + " Z";

const letters = [
  `<path d="${poly(A_OUTER)} ${poly(A_COUNTER)}" fill="#000" fill-rule="evenodd"/>`,
  `<rect x="${546 + TEXT_DX}" y="470" width="36" height="134" rx="4" fill="#000"/>`,
  `<circle cx="${564 + TEXT_DX}" cy="436" r="22" fill="#000"/>`,
].join("\n  ");

// ------------------------------------------------------------------ assemble
const rrect = (b, w) =>
  `<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" rx="${b.r}" fill="none" stroke="#000" stroke-width="${w}"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="#fff"/>
${sideMarkup.join("\n")}
  ${rrect(BODY, W_BODY)}
  ${rrect(INNER, W_INNER)}
  ${letters}
</svg>
`;

mkdirSync(resolve(root, "public"), { recursive: true });
writeFileSync(resolve(root, "public/ai-chip.svg"), svg);

const ts = `/**
 * GENERATED by scripts/generate-ai-chip.mjs — do not edit by hand.
 *
 * Centres of the "Ai" chip's terminal dots, in 0..1 UV space of
 * public/ai-chip.svg (origin top-left). The renderer uses these to pulse the
 * pins in sequence without re-parsing the artwork.
 */
export const AI_CHIP_PINS: readonly (readonly [number, number])[] = [
${pinUvs.map(([x, y]) => `  [${x}, ${y}],`).join("\n")}
];
`;
writeFileSync(resolve(root, "src/lib/aiChipPins.ts"), ts);

console.log(`wrote public/ai-chip.svg (${svg.length} bytes) and ${pinUvs.length} pin positions`);
