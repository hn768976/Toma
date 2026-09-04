// Generates black-on-white conifer silhouette PNGs matching the supplied asset style.
// Seeded (mulberry32) so output is reproducible.
import { writeFileSync } from "node:fs";

const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const f1 = (n) => n.toFixed(1);

// One drooping frond. dir = +1 right, -1 left. Returns a closed path.
function frond(cx, y, len, thick, droop, dir, rnd) {
  const tipX = cx + dir * len;
  const tipY = y + droop;
  // Top edge: leaves the trunk slightly above y, arcs out and sags to the tip.
  const c1x = cx + dir * len * 0.35,
    c1y = y - thick * 0.5;
  const c2x = cx + dir * len * 0.78,
    c2y = tipY - thick * 0.42;
  let d = `M ${f1(cx)} ${f1(y - thick * 0.5)} C ${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(tipX)} ${f1(tipY)} `;
  // Bottom edge: back to the trunk as a run of needle spikes.
  const teeth = Math.max(4, Math.round(len / (thick * 0.5)));
  for (let i = 1; i <= teeth; i++) {
    const t = i / teeth;
    const bx = tipX + (cx - tipX) * t;
    // underside sags below the tip near the outer end, rises toward the trunk
    const baseY = tipY + (y + thick * 0.62 - tipY) * Math.pow(t, 0.8);
    const grow = 0.3 + t * 0.85;
    const spike = thick * (0.34 + rnd() * 0.5) * grow;
    const notch = thick * (0.02 + rnd() * 0.16) * grow;
    const step = (len / teeth) * (0.4 + rnd() * 0.3);
    d += `L ${f1(bx + dir * step)} ${f1(baseY + spike)} L ${f1(bx)} ${f1(baseY - notch)} `;
  }
  return d + "Z";
}

// A whole conifer. Returns an array of path `d` strings (drawn as separate
// <path> elements so overlapping fronds union instead of cancelling).
function conifer({ cx, topY, baseY, halfWidth, seed, trunk = true }) {
  const rnd = mulberry32(seed);
  const h = baseY - topY;
  const tiers = 20 + Math.floor(rnd() * 5);
  const parts = [];

  // Trunk first, so fronds overlay it. Tapered, visible at the base.
  if (trunk) {
    const tw = halfWidth * 0.052;
    parts.push(
      `M ${f1(cx - tw * 0.3)} ${f1(topY + h * 0.02)} L ${f1(cx + tw * 0.3)} ${f1(topY + h * 0.02)} ` +
        `L ${f1(cx + tw * 1.35)} ${f1(baseY - h * 0.01)} C ${f1(cx + tw * 2.4)} ${f1(baseY)} ${f1(cx - tw * 2.4)} ${f1(baseY)} ${f1(cx - tw * 1.35)} ${f1(baseY - h * 0.01)} Z`,
    );
  }

  // Slow-varying profile wobble so the outline isn't a perfect cone.
  const wob = [rnd(), rnd(), rnd()];
  let y = topY + h * 0.055;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    // convex-ish profile, flaring toward the base then tucking in at the very bottom
    const profile = Math.pow(t, 0.82) * (1 - 0.14 * Math.pow(t, 7));
    const wobble =
      1 +
      0.09 * Math.sin(t * 7.1 + wob[0] * 6.3) +
      0.05 * Math.sin(t * 13.7 + wob[1] * 6.3);
    const len = halfWidth * profile * wobble;
    const thick = h * 0.045 * (0.72 + t * 0.95) * (0.88 + rnd() * 0.24);
    const droop = thick * (0.35 + t * 1.25);
    if (len > halfWidth * 0.035) {
      parts.push(frond(cx, y, len * (0.9 + rnd() * 0.2), thick, droop, 1, rnd));
      parts.push(
        frond(cx, y, len * (0.9 + rnd() * 0.2), thick, droop, -1, rnd),
      );
    }
    y += ((h * 0.9) / tiers) * (0.82 + rnd() * 0.36);
    if (y > baseY - h * 0.04) break;
  }

  // Leader: a slim tapered spike above the top tier.
  const lw = halfWidth * 0.05;
  const ly = topY + h * 0.085;
  parts.push(
    `M ${f1(cx)} ${f1(topY)} L ${f1(cx + lw * 0.5)} ${f1(topY + h * 0.02)} L ${f1(cx + lw * 1.5)} ${f1(ly)} ` +
      `L ${f1(cx + lw * 0.35)} ${f1(ly - h * 0.012)} L ${f1(cx - lw * 0.35)} ${f1(ly - h * 0.012)} ` +
      `L ${f1(cx - lw * 1.5)} ${f1(ly)} L ${f1(cx - lw * 0.5)} ${f1(topY + h * 0.02)} Z`,
  );
  return parts;
}

// Slim bare deciduous tree, for occasional variety in the treeline.
function bareTree({ cx, topY, baseY, halfWidth, seed }) {
  const rnd = mulberry32(seed);
  const h = baseY - topY;
  const parts = [];
  const branch = (x, y, ang, len, w, depth) => {
    const nx = x + Math.sin(ang) * len;
    const ny = y - Math.cos(ang) * len;
    const w2 = w * 0.66;
    const px = Math.cos(ang) * w,
      py = Math.sin(ang) * w;
    const px2 = Math.cos(ang) * w2,
      py2 = Math.sin(ang) * w2;
    parts.push(
      `M ${f1(x + px)} ${f1(y + py)} L ${f1(nx + px2)} ${f1(ny + py2)} L ${f1(nx - px2)} ${f1(ny - py2)} L ${f1(x - px)} ${f1(y - py)} Z`,
    );
    if (depth <= 0 || len < h * 0.014) return;
    const spread = 0.32 + rnd() * 0.32;
    branch(
      nx,
      ny,
      ang - spread * (0.7 + rnd() * 0.6),
      len * (0.66 + rnd() * 0.16),
      w2,
      depth - 1,
    );
    branch(
      nx,
      ny,
      ang + spread * (0.7 + rnd() * 0.6),
      len * (0.66 + rnd() * 0.16),
      w2,
      depth - 1,
    );
    if (rnd() > 0.6)
      branch(
        nx,
        ny,
        ang + (rnd() - 0.5) * 0.4,
        len * 0.5,
        w2 * 0.75,
        depth - 1,
      );
  };
  branch(cx, baseY, 0, h * 0.28, halfWidth * 0.07, 7);
  return parts;
}

const S = 1920;
const paths = (list) =>
  list.map((d) => `<path fill="#000000" d="${d}"/>`).join("");
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
  `<rect width="${S}" height="${S}" fill="#ffffff"/>${body}</svg>`;

const out = process.argv[2];

// Single conifer.
writeFileSync(
  `${out}/conifer-single.svg`,
  svg(
    paths(
      conifer({
        cx: S * 0.5,
        topY: S * 0.07,
        baseY: S * 0.94,
        halfWidth: S * 0.225,
        seed: 20260904,
      }),
    ),
  ),
);

// Group of three conifers of differing height, overlapping.
writeFileSync(
  `${out}/conifer-group.svg`,
  svg(
    paths([
      ...conifer({
        cx: S * 0.205,
        topY: S * 0.44,
        baseY: S * 0.895,
        halfWidth: S * 0.145,
        seed: 771,
      }),
      ...conifer({
        cx: S * 0.745,
        topY: S * 0.24,
        baseY: S * 0.895,
        halfWidth: S * 0.185,
        seed: 4412,
      }),
      ...conifer({
        cx: S * 0.46,
        topY: S * 0.135,
        baseY: S * 0.895,
        halfWidth: S * 0.225,
        seed: 9083,
      }),
    ]),
  ),
);

// Slim bare tree.
// Horizontally compressed about the trunk so it reads slim, like the reference.
writeFileSync(
  `${out}/bare-tree.svg`,
  svg(
    `<g transform="translate(${S * 0.5} 0) scale(0.46 1) translate(${-S * 0.5} 0)">` +
      paths(
        bareTree({
          cx: S * 0.5,
          topY: S * 0.08,
          baseY: S * 0.95,
          halfWidth: S * 0.34,
          seed: 5150,
        }),
      ) +
      `</g>`,
  ),
);

console.log("wrote 3 svgs to", out);
