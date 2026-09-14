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
      `| \`${r.id}\` | \`${r.id}Matte\` | ${r.title.replace(/^\d+ — /, "")} | ${r.reference} | ${r.frames} | ${r.seconds}s |`,
  )
  .join("\n");

const totalFrames = rows.reduce((a, r) => a + r.frames, 0);

writeFileSync(
  "DELIVERY.md",
  `# Delivery manifest

Eleven versions of the microscopic-bacteria series, one per reference
clip, each delivered as a colour clip and a matching matte clip — 22
files. Every one is built from the single supplied bacillus GLB, with
no change to its geometry.

## Format

| | |
|---|---|
| Compositions | 22, authored at **3840×2160 @ 30fps** |
| Delivered | **1920×1080**, H.264 / MP4, yuv420p, limited range, Rec.709 |
| Audio | none |
| Pairing | \`<Version>.mp4\` is the picture, \`<Version>Matte.mp4\` is its key |

Both passes of a version share a duration, a seed and a timeline, so
frame *n* of the matte is exactly the alpha of frame *n* of the colour,
over the full length of the clip.

The 1080p files are rendered from the 4K compositions with
\`--scale=0.5\`; there is no separate 1080p composition to keep in sync.

\`\`\`bash
npm install
npm run render:bacteria:1080p   # 22 × 1920×1080
npm run render:bacteria:4k      # 22 × 3840×2160
npm run dev                     # Remotion Studio: Bacteria-Colour and Bacteria-Matte folders
\`\`\`

## Versions

| Colour | Matte | Look | Reference | Frames | Duration |
|---|---|---|---|---|---|
${table}

${totalFrames} frames per pass, ${totalFrames * 2} in total. Each duration
matches its reference clip exactly.

## Mattes

Each version's matte ships as its own clip, the same length as the
colour and keyed to it frame for frame — a full-length key, so you can
pull any part of the clip rather than a sample of it. The matte is flat
white on black: no backdrop, no defocus, no grade, no grain.

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
