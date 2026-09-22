// Renders every deliverable: the six 1080p previews, and the stills harvest.
//
// Compositions are defined at 3840x2160; the previews render at --scale=0.5,
// which is exactly 1920x1080. The 4K render commands are in README.md.
//
// Usage: node tools/render-all.mjs previews|stills|previews-4k [--only=<id>]
//                                  [--skip-existing]
//
// --skip-existing passes over compositions whose output is already there,
// which is what you want when resuming a long batch.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

const SINGLE = [
  { id: "SinglePill-CapsuleGrey", file: "SinglePill_CapsuleGrey", stills: [42, 148, 246] },
  { id: "SinglePill-TabletBlue", file: "SinglePill_TabletBlue", stills: [36, 155, 262] },
  { id: "SinglePill-BlackMatte", file: "SinglePill_BlackMatte", stills: [55, 140, 265] },
];
const FALLING = [
  { id: "FallingPills-MixedWhite", file: "FallingPills_MixedWhite", stills: [30, 190, 355] },
  { id: "FallingPills-BlueCapsule", file: "FallingPills_BlueCapsule", stills: [30, 190, 355] },
  { id: "FallingPills-RedCapsule", file: "FallingPills_RedCapsule", stills: [30, 190, 355] },
];
const ALL = [...SINGLE, ...FALLING];

const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith("--")) ?? "previews";
const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const skipExisting = args.includes("--skip-existing");
const rows = only ? ALL.filter((r) => r.id === only) : ALL;
if (!rows.length) {
  console.error(`No composition matches "${only}"`);
  process.exit(1);
}

const run = (args) => {
  const started = Date.now();
  execFileSync("npx", ["remotion", ...args], { stdio: ["ignore", "ignore", "inherit"] });
  return (Date.now() - started) / 1000;
};

mkdirSync("out/stills", { recursive: true });

for (const row of rows) {
  if (mode === "previews" || mode === "previews-4k") {
    const is4k = mode === "previews-4k";
    const out = `out/${row.file}${is4k ? "_4K" : ""}.mp4`;
    if (skipExisting && existsSync(out)) {
      console.log(`${out}  (already rendered, skipped)`);
      continue;
    }
    const seconds = run([
      "render", row.id, out,
      ...(is4k ? [] : ["--scale=0.5"]),
      "--codec=h264", "--crf=16", "--pixel-format=yuv420p",
      // --muted: no silent audio track. See remotion.config.ts.
      "--muted",
      "--image-format=png", "--timeout=300000", "--concurrency=4", "--log=error",
    ]);
    console.log(`${out}  ${seconds.toFixed(0)}s`);
  } else if (mode === "stills") {
    // 1080p still for the delivery, then the 6000x3375 harvest.
    run([
      "still", row.id, `out/stills/${row.file}.png`,
      `--frame=${row.stills[0]}`, "--scale=0.5", "--timeout=300000", "--log=error",
    ]);
    console.log(`out/stills/${row.file}.png (1920x1080, frame ${row.stills[0]})`);
    for (const frame of row.stills) {
      const out = `out/stills/${row.file}_6000_f${frame}.png`;
      try {
        // 6000/3840 = 1.5625
        run(["still", row.id, out, `--frame=${frame}`, "--scale=1.5625", "--timeout=600000", "--log=error"]);
        console.log(`${out} (6000x3375, frame ${frame})`);
      } catch {
        console.error(`  could not render ${out} at 6000x3375 — see README, stills harvest`);
      }
    }
  } else {
    console.error(`unknown mode "${mode}"`);
    process.exit(1);
  }
}
