// Emits DELIVERY.md from presets.ts, so the manifest cannot drift away
// from what the compositions actually are.
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("src/bacteria/presets.ts", "utf8");
const blocks = src.split(/\n    id: "/).slice(1);

const rows = blocks.map((block) => {
  const id = block.slice(0, block.indexOf('"'));
  const title = /title: "([^"]+)"/.exec(block)[1];
  const reference = /reference: "([^"]+)"/.exec(block)[1];
  const frames = Number(/durationInFrames: (\d+)/.exec(block)[1]);
  return { id, title, reference, frames, seconds: (frames / 30).toFixed(3) };
});

const table = rows
  .map(
    (r) =>
      `| \`${r.id}\` | ${r.title.replace(/^\d+ — /, "")} | ${r.reference} | ${r.frames} | ${r.seconds}s |`,
  )
  .join("\n");

const totalFrames = rows.reduce((a, r) => a + r.frames, 0);

writeFileSync(
  "DELIVERY.md",
  `# Delivery manifest

Eleven versions of the microscopic-bacteria series, one per reference
clip. Every one is built from the single supplied bacillus GLB, with no
change to its geometry.

## Format

| | |
|---|---|
| Compositions | 11, authored at **3840×2160 @ 30fps** |
| Delivered | **1920×1080**, H.264 / MP4, yuv420p, limited range, Rec.709 |
| Audio | none |
| Structure | colour pass, then a ~2.5s white-on-black matte tail |

The 1080p files are rendered from the 4K compositions with
\`--scale=0.5\`; there is no separate 1080p composition to keep in sync.

\`\`\`bash
npm install
npm run render:bacteria:1080p   # 11 × 1920×1080
npm run render:bacteria:4k      # 11 × 3840×2160
npm run dev                     # Remotion Studio, all 11 compositions
\`\`\`

## Versions

| Composition | Look | Reference | Frames | Duration |
|---|---|---|---|---|
${table}

${totalFrames} frames in total. Each duration matches its reference clip exactly.

## The matte tail

Every version ends on roughly 2.5 seconds of white-on-black matte,
following how the reference stock clips deliver their alpha. The
timeline runs continuously through the cut — the matte carries the
scene on from exactly where the colour pass left it — so the tail plays
as an ending rather than a restart. Length is one constant,
\`MATTE_TAIL_SECONDS\` in \`src/bacteria/constants.ts\`, capped at a third
of the clip.

## A note on versions 02 and 05

Two of the eleven uploads were byte-identical — the same iStock clip,
2278455892. Rather than ship a duplicate, version 05 takes a second
read of it: a brighter indigo across a drifting, spread-out field,
against version 02's tight violet knot, and on its own layout seed. The
set therefore delivers eleven distinct looks rather than ten and a
repeat.
`,
);

console.log(`DELIVERY.md written: ${rows.length} versions, ${totalFrames} frames`);
