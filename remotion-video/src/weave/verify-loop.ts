/**
 * Asserts the properties that make the woven-texture films loop.
 *
 * Run with: npm run verify:loop
 *
 * These are cheap to check and easy to break -- changing a hold or a state
 * count by one silently turns a seamless loop into a clip that jumps when it
 * repeats -- so they are checked rather than trusted.
 */
import { DURATION_IN_FRAMES } from "./constants";
import { getBoilState } from "./boil";
import { weaveVariants } from "./presets";

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  if (ok) {
    console.log(`  ok   ${name} -- ${detail}`);
  } else {
    console.error(`  FAIL ${name} -- ${detail}`);
    failures++;
  }
};

for (const [name, variant] of Object.entries(weaveVariants)) {
  console.log(`\n${name}`);
  const { holdInFrames, states } = variant;
  const steps = DURATION_IN_FRAMES / holdInFrames;

  check(
    "cadence divides the clip",
    Number.isInteger(steps) && steps % states === 0,
    `${DURATION_IN_FRAMES} frames / ${holdInFrames}-frame hold = ${steps} steps = ${steps / states} whole cycles of ${states} states`,
  );

  // Every frame's state must be a pure function of the state index, and the
  // wrap from the last frame back to the first must be an ordinary cut.
  const first = getBoilState(0, variant);
  const wrapped = getBoilState(DURATION_IN_FRAMES, variant);
  check(
    "frame 0 and frame N are the same state",
    JSON.stringify(first) === JSON.stringify(wrapped),
    `state ${first.stateIndex} at both ends`,
  );

  // Each hold must be exactly holdInFrames long, including across the wrap.
  const runs: number[] = [];
  let run = 1;
  for (let f = 1; f <= DURATION_IN_FRAMES; f++) {
    const prev = getBoilState(f - 1, variant).stateIndex;
    const cur = getBoilState(f, variant).stateIndex;
    if (cur === prev) {
      run++;
    } else {
      runs.push(run);
      run = 1;
    }
  }
  const uniform = runs.every((r) => r === holdInFrames);
  check(
    "every hold is the same length",
    uniform,
    uniform ? `all ${runs.length} holds are ${holdInFrames} frames` : `got holds ${[...new Set(runs)].join(", ")}`,
  );

  // Each state should appear the same number of times, so no still is favoured.
  const counts = new Map<number, number>();
  for (let f = 0; f < DURATION_IN_FRAMES; f++) {
    const s = getBoilState(f, variant).stateIndex;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const values = [...counts.values()];
  check(
    "states are evenly used",
    counts.size === states && new Set(values).size === 1,
    `${counts.size} states, ${values[0]} frames each`,
  );

  // The stills must actually differ, or the "boil" would be a freeze frame.
  const seeds = new Set<number>();
  for (let s = 0; s < states; s++) seeds.add(getBoilState(s * holdInFrames, variant).seed);
  check("every state is distinct", seeds.size === states, `${seeds.size} distinct seeds`);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll loop checks passed.");
