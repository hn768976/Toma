/**
 * Proves the clip loops and that a frame is a pure function of its frame
 * number. Both are load-bearing: Remotion renders frames out of order across
 * threads, so any state that leaked between frames would show up as flicker,
 * and any drift over the 450 frames would show up as a seam at the loop point.
 *
 *   npm run verify-loop
 */
import { buildFrame, createTrailBuffers } from "../src/flow-field/build-frame";
import { createField } from "../src/flow-field/field";
import { createParticles } from "../src/flow-field/particles";
import { buildRampLut, PALETTES } from "../src/flow-field/palette";
import { DURATION_IN_FRAMES, BASE_HEIGHT } from "../src/flow-field/constants";

const run = (frame: number) => {
  const particles = createParticles(20260904 + 991);
  const field = createField(20260904);
  const buffers = createTrailBuffers(Math.ceil(particles.maxSegments * 1.3));
  const t0 = Date.now();
  const quads = buildFrame({
    frame,
    durationInFrames: DURATION_IN_FRAMES,
    compHeight: BASE_HEIGHT,
    sigmaFloor: 0.72 / 0.5,
    field,
    particles,
    rampLut: buildRampLut(PALETTES.blue),
    buffers,
  });
  return { quads, buffers, ms: Date.now() - t0 };
};

const a = run(0);
const b = run(DURATION_IN_FRAMES);
const c = run(7);
const d = run(7 + DURATION_IN_FRAMES);
let failed = false;

const cmp = (x: typeof a, y: typeof a, label: string) => {
  if (x.quads !== y.quads) {
    console.log(`${label}: FAIL — quad counts differ, ${x.quads} vs ${y.quads}`);
    failed = true;
    return;
  }
  let maxDiff = 0;
  const n = x.quads * 12;
  for (let i = 0; i < n; i++) {
    const dp = Math.abs(x.buffers.position[i] - y.buffers.position[i]);
    const dc = Math.abs(x.buffers.color[i] - y.buffers.color[i]);
    if (dp > maxDiff) maxDiff = dp;
    if (dc > maxDiff) maxDiff = dc;
  }
  if (maxDiff !== 0) failed = true;
  console.log(
    `${label}: ${maxDiff === 0 ? "identical" : "FAIL"} (quads=${x.quads}, maxAbsDiff=${maxDiff})`,
  );
};

cmp(a, b, "frame 0 vs 450");
cmp(c, d, "frame 7 vs 457");
console.log(`capacity=${a.buffers.quadCapacity} used=${a.quads} (${((a.quads / a.buffers.quadCapacity) * 100).toFixed(1)}%)`);
console.log(`buildFrame CPU: f0=${a.ms}ms f7=${c.ms}ms`);
process.exit(failed ? 1 : 0);
