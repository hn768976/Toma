/**
 * Layout guard, run outside the renderer.
 *
 * Checks the two rules that make the set commercially usable:
 *   1. every composition keeps its open centre genuinely clear;
 *   2. enough motifs are cropped by the frame edge that the images read as
 *      decorative borders rather than as scattered patterns.
 *
 * Run with: npm run check:layout
 */
import { WIDTH, HEIGHT } from "../src/constants";
import { COMPOSITIONS, COMPOSITION_NAMES } from "../src/compositions";
import { clearance, openCentreRect, resolveMotifs } from "../src/render/motif";

let failures = 0;

for (const name of COMPOSITION_NAMES) {
  const composition = COMPOSITIONS[name];
  const rect = openCentreRect(composition, WIDTH, HEIGHT);
  const instances = resolveMotifs(composition, WIDTH, HEIGHT);

  let worst = Number.POSITIVE_INFINITY;
  let worstIndex = -1;
  let cropped = 0;

  for (const instance of instances) {
    const gap = clearance(instance, rect);
    if (gap < worst) {
      worst = gap;
      worstIndex = instance.index;
    }
    const outside =
      instance.cx - instance.halfW < 0 ||
      instance.cy - instance.halfH < 0 ||
      instance.cx + instance.halfW > WIDTH ||
      instance.cy + instance.halfH > HEIGHT;
    if (outside) cropped += 1;
  }

  const croppedShare = cropped / instances.length;
  const ok = worst >= 0 && croppedShare >= 0.5;
  if (!ok) failures += 1;

  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}  motifs=${String(instances.length).padStart(2)}` +
      `  cropped=${cropped}/${instances.length} (${Math.round(croppedShare * 100)}%)` +
      `  min clearance=${worst.toFixed(0)}px` +
      (worst < 0 ? `  <- motif #${worstIndex} intrudes` : ""),
  );
}

if (failures > 0) {
  console.error(`\n${failures} composition(s) violate the layout rule.`);
  process.exit(1);
}
console.log("\nAll compositions keep the centre open and crop at the edges.");
