// Per-frame height change of visible canyon columns (cubes per frame).
// Run: npx tsx scripts/motion-stats.ts
import { canyonHeightAt, GRID_X, GRID_Z, columnX, columnZ } from "../src/lib/fields";
import { inFrameCore } from "../src/lib/frameArea";
const steps: number[] = [];
let moving = 0, total = 0;
for (let f = 0; f < 600; f += 15) {
  for (let j = 0; j < GRID_Z; j++)
    for (let i = 0; i < GRID_X; i++) {
      if (!inFrameCore(columnX(i), columnZ(j))) continue;
      const a = canyonHeightAt(i, j, f);
      const b = canyonHeightAt(i, j, f + 1);
      if (Math.max(a, b) < Number(process.env.MIN_H ?? -14)) continue; // deep in the void: not visible
      const d = Math.abs(b - a);
      steps.push(d);
      total++;
      if (d > 0.01) moving++;
    }
}
steps.sort((x, y) => x - y);
const q = (p: number) => steps[Math.floor(p * (steps.length - 1))].toFixed(3);
console.log(`cubes/frame  p50 ${q(0.5)}  p90 ${q(0.9)}  p99 ${q(0.99)}  max ${q(1)}   share moving ${(100 * moving / total).toFixed(0)}%`);
