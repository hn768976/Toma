// Scans every frame of every story for any two visible blocks whose cubes
// intersect (exact separating-axis test) while at least one is in flight, and
// for any block passing through the wallet body.
// Usage: npx tsx scripts/check-overlaps.ts
import { BLOCK, WALLET } from "../src/kit/layout";
import { boxesIntersect, cubesIntersect } from "../src/kit/math";
import { SEARCH_REPORT, blockCount, blockPose, looseCount, loosePose } from "../src/kit/timeline";
import type { Story } from "../src/versions";

let bad = 0;
for (const [story, frames, loop] of [["blocks", 300, 300], ["secure", 300, 300], ["hold", 600, 600]] as [Story, number, number][]) {
  let n = 0;
  for (let f = 0; f < frames; f++) {
    const poses = [
      ...Array.from({ length: blockCount(story) }, (_, i) => blockPose(story, i, f, loop)),
      ...Array.from({ length: looseCount(story) }, (_, i) => loosePose(i, f, loop)),
    ];
    const h = BLOCK.size / 2;
    poses.forEach((a, i) => {
      if (a.visible && boxesIntersect(a.pos, a.rot, [h, h, h], [0, 0, 0], [0, 0, 0], [WALLET.w / 2, WALLET.h / 2, WALLET.d / 2])) {
        n++;
        if (n <= 5) console.log(`  ${story} f${f}: block ${i} passes through the wallet`);
      }
    });
    for (let i = 0; i < poses.length; i++)
      for (let j = i + 1; j < poses.length; j++) {
        const a = poses[i], b = poses[j];
        if (!a.visible || !b.visible || (a.docked && b.docked)) continue;
        if (cubesIntersect(a.pos, a.rot, b.pos, b.rot, BLOCK.size, 0)) {
          n++;
          if (n <= 5) console.log(`  ${story} f${f}: blocks ${i} and ${j} intersect`);
        }
      }
  }
  console.log(`${story}: ${n} intersecting pair-frames`);
  bad += n;
}
if (SEARCH_REPORT.length) console.log(SEARCH_REPORT.join("\n"));
console.log(bad === 0 ? "OK: no block ever passes through another block or the wallet" : "FAIL");
process.exit(bad === 0 ? 0 : 1);
