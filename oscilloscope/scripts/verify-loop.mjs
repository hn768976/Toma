/**
 * Proves the 14s loop is seamless without rendering a frame.
 *
 * Frame 420 is the frame that would come after the last one, so it must be
 * pixel-identical to frame 0. Because every trace is a pure function of the
 * frame number, comparing the generated path data is a stronger check than
 * eyeballing the encoded video: it catches a wavelength that does not divide
 * the loop distance even when the drift is a fraction of a pixel per cycle.
 *
 *   node scripts/verify-loop.mjs
 */
import { build } from "esbuild";

// esbuild is already a dependency of the Remotion CLI; using it here keeps the
// check dependency-free and means it reads exactly the same source the render
// does, rather than a copy that can fall out of step.
const bundle = await build({
  stdin: {
    contents: `export * from "./src/constants";\nexport * from "./src/traces";`,
    resolveDir: ".",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  write: false,
  platform: "neutral",
});
const {
  buildTraces,
  DURATION_IN_FRAMES,
  GRID_MAJOR,
  GRID_MINOR,
  LABEL_SPACING,
  LOOP_DISTANCE,
  NOISE_BOTTOM_OCTAVES,
  NOISE_TOP_OCTAVES,
  SCROLL_PER_FRAME,
  SINE_MAIN_WAVELENGTH,
  SINE_SECOND_WAVELENGTH,
  SQUARE_WAVELENGTH,
  SWEEP_CROSSINGS,
  AM_CYCLES_PER_LOOP,
} = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const failures = [];
const check = (label, ok, detail) => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

console.log("Spatial periods must divide the loop distance:");
const divides = (n) => Number.isInteger(LOOP_DISTANCE / n);
for (const [label, period] of [
  ["grid minor", GRID_MINOR],
  ["grid major", GRID_MAJOR],
  ["label pitch", LABEL_SPACING],
  ["main sine", SINE_MAIN_WAVELENGTH],
  ["secondary sine", SINE_SECOND_WAVELENGTH],
  ["square wave", SQUARE_WAVELENGTH],
  ...NOISE_TOP_OCTAVES.map(([s], i) => [`top noise octave ${i}`, s]),
  ...NOISE_BOTTOM_OCTAVES.map(([s], i) => [`bottom noise octave ${i}`, s]),
]) {
  check(label, divides(period), `${LOOP_DISTANCE} / ${period} = ${LOOP_DISTANCE / period}`);
}

console.log("\nTemporal cycles must be whole numbers over the loop:");
check("sweep crossings", Number.isInteger(SWEEP_CROSSINGS), String(SWEEP_CROSSINGS));
check("amplitude modulation", Number.isInteger(AM_CYCLES_PER_LOOP), String(AM_CYCLES_PER_LOOP));
check(
  "scroll is a whole number of pixels per frame at 4K and 1080p",
  Number.isInteger(SCROLL_PER_FRAME) && SCROLL_PER_FRAME % 2 === 0,
  `${SCROLL_PER_FRAME} px at 4K, ${SCROLL_PER_FRAME / 2} px at 1080p`,
);

console.log("\nGenerated geometry at the loop point:");
const first = buildTraces(0);
const wrapped = buildTraces(DURATION_IN_FRAMES);
for (let i = 0; i < first.length; i++) {
  check(
    `${first[i].key}: frame 0 === frame ${DURATION_IN_FRAMES}`,
    first[i].d === wrapped[i].d,
    `${first[i].d.length} chars`,
  );
}

console.log(
  failures.length === 0
    ? "\nLoop verified: frame 420 is identical to frame 0."
    : `\n${failures.length} check(s) failed.`,
);
process.exit(failures.length === 0 ? 0 : 1);
