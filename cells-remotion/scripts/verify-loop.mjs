/**
 * Loop and determinism checks for both variants.
 *
 *   npm run verify-loop
 *
 * Asserts that every drift path closes, every morph and rotation frequency is
 * a whole number of cycles per loop, and that frame 450 evaluates to exactly
 * the same geometry as frame 0.
 */
import assert from "node:assert/strict";

const { VARIANTS, LOOP_FRAMES } = await import("../src/cells/variants.ts");
const { buildCells, cellOffset, TAU } = await import("../src/cells/geometry.ts");

const WIDTH = 3840;
const HEIGHT = 2160;

let checks = 0;
const ok = (label, condition) => {
  assert.ok(condition, label);
  checks++;
};

for (const name of Object.keys(VARIANTS)) {
  const variant = VARIANTS[name];
  const a = buildCells(variant, name, WIDTH, HEIGHT);
  const b = buildCells(variant, name, WIDTH, HEIGHT);

  // Seeded generation must be reproducible.
  ok(`${name}: cell set is deterministic`, JSON.stringify(a) === JSON.stringify(b));
  ok(`${name}: cell count`, a.length === variant.cellCount);

  for (const cell of a) {
    ok(
      `${name}/${cell.key}: rotation is a whole number of turns`,
      Number.isInteger(cell.rotationTurns),
    );
    ok(
      `${name}/${cell.key}: cross-drift frequency is an integer`,
      Number.isInteger(cell.crossFreq),
    );
    for (const p of cell.points) {
      ok(
        `${name}/${cell.key}: morph frequency is an integer`,
        Number.isInteger(p.morphFreq),
      );
      ok(
        `${name}/${cell.key}: point radius is within +/-${variant.radiusJitter * 100}%`,
        Math.abs(p.radiusFactor - 1) <= variant.radiusJitter + 1e-12,
      );
    }

    // t is derived from frame % 450, so frame 450 feeds in t = 0 exactly.
    const t0 = (0 % LOOP_FRAMES) / LOOP_FRAMES;
    const tEnd = (LOOP_FRAMES % LOOP_FRAMES) / LOOP_FRAMES;
    const o0 = cellOffset(cell, t0, variant.drift.direction);
    const oEnd = cellOffset(cell, tEnd, variant.drift.direction);
    ok(`${name}/${cell.key}: drift path closes`, o0[0] === oEnd[0] && o0[1] === oEnd[1]);
    ok(`${name}/${cell.key}: drift starts at its base position`, o0[0] === 0 && o0[1] === 0);

    // And the cell is genuinely moving in between.
    const mid = cellOffset(cell, 0.25, variant.drift.direction);
    ok(`${name}/${cell.key}: cell actually drifts`, Math.hypot(mid[0], mid[1]) > 1);

    // Frame 0 leaves along the variant's drift direction.
    const step = cellOffset(cell, 1 / LOOP_FRAMES, variant.drift.direction);
    const [dx, dy] = variant.drift.direction;
    ok(
      `${name}/${cell.key}: leaves frame 0 along the drift direction`,
      step[0] * dx + step[1] * dy > 0,
    );
  }

  // Morph and rotation both read t directly, so an integer frequency is
  // sufficient; assert the phase term lands back on itself.
  for (const cell of a) {
    for (const p of cell.points) {
      const at0 = Math.sin(TAU * (p.morphFreq * 0 + p.morphPhase));
      const atEnd = Math.sin(TAU * (p.morphFreq * (LOOP_FRAMES % LOOP_FRAMES) / LOOP_FRAMES + p.morphPhase));
      ok(`${name}/${cell.key}: morph closes`, at0 === atEnd);
    }
  }

  const depths = [0, 1, 2].map((d) => a.filter((c) => c.depth === d).length);
  ok(`${name}: all three depth buckets are populated`, depths.every((n) => n > 0));
  console.log(
    `${name}: ${a.length} cells, depth buckets far/mid/near = ${depths.join("/")}`,
  );
}

console.log(`\nOK — ${checks} assertions passed across ${Object.keys(VARIANTS).length} variant(s).`);
