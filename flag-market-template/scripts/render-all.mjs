// Batch-render all 20 compositions at full 4K (3840x2160) to out/.
// Usage: npm run render:all            (all 20)
//        npm run render:all -- China   (only ids containing "China")
// Codec/CRF/pixel format/mute come from remotion.config.ts (h264, CRF 16, yuv420p, no audio).
import { execFileSync } from "node:child_process";

const countries = ["USA", "China", "Japan", "Germany", "UK", "India", "France", "Canada", "SouthKorea", "Australia"];
const dirs = ["Up", "Down"];
const filter = process.argv[2] ?? "";

for (const c of countries) {
  for (const d of dirs) {
    const id = `FlagMarket-${c}-${d}`;
    if (!id.includes(filter)) continue;
    const out = `out/FlagMarket_${c}_${d}.mp4`;
    console.log(`\n▶ ${id} → ${out}`);
    execFileSync("npx", ["remotion", "render", "src/index.ts", id, out], { stdio: "inherit" });
  }
}
