/**
 * Proves the scene has no overlapping elements.
 *
 * Run with: npm run verify
 *
 * Two things are checked:
 *  1. Every layer's radial band is disjoint from every other layer's, with at
 *     least BAND_GAP of clearance. This is what makes independent rotation
 *     safe — elements in different bands can never reach each other.
 *  2. No two elements that share a band overlap, in radius and angle together.
 *     Bands rotate as a unit, so a build-time check holds for every frame.
 *
 * The radial lines are the one deliberate crossing: they run through the
 * broken outer circle's gaps and share its rotation group, so they are checked
 * against that circle's arcs explicitly.
 */
import {
  ANGULAR_MARGIN,
  BAND_GAP,
  RADIAL_MARGIN,
  R,
  angularOverlap,
  buildLayout,
  dataBlockFootprint,
  halfAngle,
} from "./layout";

type Band = { name: string; r0: number; r1: number };
type Item = { label: string; r0: number; r1: number; a0: number; a1: number };

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);

const layout = buildLayout(20240917, 16 / 9);

// ---------------------------------------------------------------- 1. bands

const bands: Band[] = [
  { name: "dashed circle", r0: R.dashed - R.dashedWidth / 2, r1: R.dashed + R.dashedWidth / 2 },
  {
    name: "segment ring",
    r0: R.segments - R.segmentH / 2 - R.segmentStroke / 2,
    r1: R.segments + R.segmentH / 2 + R.segmentStroke / 2,
  },
  { name: "lane 0", r0: R.lanes[0][0], r1: R.lanes[0][1] },
  { name: "block ring", r0: R.blockInner, r1: R.blockOuter },
  { name: "arc 0", r0: R.arc[0] - R.arcWidth[0] / 2, r1: R.arc[0] + R.arcWidth[0] / 2 },
  { name: "lane 1", r0: R.lanes[1][0], r1: R.lanes[1][1] },
  { name: "arc 1", r0: R.arc[1] - R.arcWidth[1] / 2, r1: R.arc[1] + R.arcWidth[1] / 2 },
  { name: "arc 2", r0: R.arc[2] - R.arcWidth[2] / 2, r1: R.arc[2] + R.arcWidth[2] / 2 },
  { name: "tick ring", r0: R.tickInner, r1: R.tickMajorOuter },
  { name: "lane 2", r0: R.lanes[2][0], r1: R.lanes[2][1] },
  {
    name: "outer faint circle",
    r0: R.outerFaint - R.outerFaintWidth / 2,
    r1: R.outerFaint + R.outerFaintWidth / 2,
  },
  { name: "radials", r0: R.radialInner, r1: R.radialOuter },
];

const sorted = [...bands].sort((a, b) => a.r0 - b.r0);
for (let i = 1; i < sorted.length; i++) {
  const prev = sorted[i - 1];
  const cur = sorted[i];
  const gap = cur.r0 - prev.r1;
  if (gap < BAND_GAP) {
    fail(`band gap too small: ${prev.name} -> ${cur.name} = ${gap.toFixed(5)} (need ${BAND_GAP})`);
  }
}

// The broken outer circle sits inside the radial band on purpose.
const brokenBand = {
  r0: R.outerBroken - R.outerBrokenWidth / 2,
  r1: R.outerBroken + R.outerBrokenWidth / 2,
};
if (brokenBand.r0 < R.radialInner || brokenBand.r1 > R.radialOuter) {
  fail("broken outer circle is expected to sit inside the radial band");
}

// ------------------------------------------------------- 2. within a band

const checkGroup = (name: string, items: Item[]) => {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const radialHit = a.r0 - RADIAL_MARGIN < b.r1 && b.r0 < a.r1 + RADIAL_MARGIN;
      if (!radialHit) continue;
      if (angularOverlap(a.a0, a.a1, b.a0, b.a1, ANGULAR_MARGIN)) {
        fail(`${name}: ${a.label} overlaps ${b.label}`);
      }
    }
  }
};

checkGroup(
  "dashes",
  layout.dashes.map((d, i) => ({
    label: `dash ${i}`,
    r0: d.r - R.dashedWidth / 2,
    r1: d.r + R.dashedWidth / 2,
    a0: d.a0,
    a1: d.a1,
  })),
);

checkGroup(
  "segments",
  layout.segments.map((s, i) => {
    const ha = halfAngle(s.w + R.segmentStroke, s.r);
    return {
      label: `segment ${i}`,
      r0: s.r - s.h / 2,
      r1: s.r + s.h / 2,
      a0: s.angle - ha,
      a1: s.angle + ha,
    };
  }),
);

checkGroup(
  "blocks",
  layout.blocks.map((b, i) => {
    // Checked at peak pop-in scale, which is the widest they ever get.
    const w = b.w * R.blockOvershoot;
    const ha = halfAngle(w, b.r);
    const h = (b.h * R.blockOvershoot) / 2;
    return { label: `block ${i}`, r0: b.r - h, r1: b.r + h, a0: b.angle - ha, a1: b.angle + ha };
  }),
);

checkGroup(
  "arcs",
  layout.arcs.map((a, i) => ({
    label: `arc ${i} (ring ${a.group})`,
    r0: a.r - a.width / 2,
    r1: a.r + a.width / 2,
    a0: a.a0,
    a1: a.a1,
  })),
);

checkGroup(
  "ticks",
  layout.ticks.map((t, i) => {
    const ha = halfAngle(t.width, t.r1);
    return { label: `tick ${i}`, r0: t.r0, r1: t.r1, a0: t.angle - ha, a1: t.angle + ha };
  }),
);

checkGroup(
  "data blocks",
  layout.dataBlocks.map((b, i) => ({
    label: `data block ${i}`,
    ...dataBlockFootprint(b),
  })),
);

// Outer arcs and radials share one rotation group, so they are checked together.
checkGroup("outer frame", [
  ...layout.outerArcs.map((a, i) => ({
    label: `outer arc ${i} (r=${a.r})`,
    r0: a.r - a.width / 2,
    r1: a.r + a.width / 2,
    a0: a.a0,
    a1: a.a1,
  })),
  ...layout.radials.map((r, i) => {
    const ha = halfAngle(r.width, R.outerBroken);
    return { label: `radial ${i}`, r0: r.r0, r1: r.r1, a0: r.angle - ha, a1: r.angle + ha };
  }),
]);

// ------------------------------------------------- 3. corner marks and reach

const marks = layout.cornerMarks;
for (let i = 0; i < marks.length; i++) {
  const m = marks[i];
  const reach = Math.hypot(Math.abs(m.x) + m.w / 2, Math.abs(m.y) + m.h / 2);
  if (reach < R.clear) {
    fail(`corner mark ${i} reaches r=${reach.toFixed(4)}, inside the assembly (${R.clear})`);
  }
  for (let j = i + 1; j < marks.length; j++) {
    const n = marks[j];
    if (
      Math.abs(m.x - n.x) < (m.w + n.w) / 2 &&
      Math.abs(m.y - n.y) < (m.h + n.h) / 2
    ) {
      fail(`corner mark ${i} overlaps corner mark ${j}`);
    }
  }
}

const outermost = Math.max(R.radialOuter, R.outerBroken + R.outerBrokenWidth / 2);
if (outermost * 2 > 0.86) {
  fail(`assembly spans ${(outermost * 2 * 100).toFixed(1)}% of frame height, too wide`);
}

// ------------------------------------------------------------------ report

const counts = {
  dashes: layout.dashes.length,
  segments: layout.segments.length,
  blocks: layout.blocks.length,
  arcs: layout.arcs.length,
  ticks: layout.ticks.length,
  dataBlocks: layout.dataBlocks.length,
  outerArcs: layout.outerArcs.length,
  radials: layout.radials.length,
  cornerMarks: layout.cornerMarks.length,
};
const total = Object.values(counts).reduce((a, b) => a + b, 0);

console.log("elements:", counts, "total", total);
console.log(`assembly spans ${(outermost * 2 * 100).toFixed(1)}% of frame height`);
sorted.forEach((b, i) => {
  const gap = i === 0 ? null : b.r0 - sorted[i - 1].r1;
  console.log(
    `  ${b.r0.toFixed(4)} - ${b.r1.toFixed(4)}  ${b.name}${gap === null ? "" : `   (gap ${gap.toFixed(4)})`}`,
  );
});

if (failures.length) {
  console.error(`\nFAILED — ${failures.length} overlap problem(s):`);
  failures.slice(0, 40).forEach((f) => console.error("  " + f));
  process.exit(1);
}
console.log("\nOK — no overlapping elements.");
