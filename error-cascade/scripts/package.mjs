/**
 * Builds the two shippable bundles: one self-contained, independently
 * runnable project per variant.
 *
 *   node scripts/package.mjs
 *     -> dist/error-cascade-light/  + error-cascade-light.zip
 *     -> dist/error-cascade-dark/   + error-cascade-dark.zip
 *
 * Both bundles come from this one source tree. Everything variant-specific in
 * src/config.ts and src/Root.tsx is fenced with `>>> tag:name` / `<<< tag:name`
 * comments; building the light bundle drops every `:dark` fence and vice
 * versa, then strips the surviving fence comments so the shipped code reads as
 * if it had only ever had one variant.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const VARIANTS = {
  light: {
    compositionId: "ErrorCascadeLight",
    outName: "error-cascade-light",
    title: 'Error Dialog Cascade — v1 "light"',
    blurb:
      "Pale dialogs on pure black. One dialog alone at the centre, then a leak " +
      "that accelerates into a flood until the frame is completely buried.",
    curve: [
      "`0-60`     one dialog, alone at the centre — the hold that makes the rest land",
      "`60-180`   slow, roughly one every 20 frames",
      "`180-330`  quickening, one every 8 frames",
      "`330-480`  fast, one every 3 frames",
      "`480-570`  a flood, ramping from 2 to 13 per frame",
      "`570-600`  hold — the frame is covered and nothing moves",
    ],
  },
  dark: {
    compositionId: "ErrorCascadeDark",
    outName: "error-cascade-dark",
    title: 'Error Dialog Cascade — v2 "dark"',
    blurb:
      "Dark dialogs with a red-orange title bar and an amber error icon, on a " +
      "near-black field. Arrives in waves rather than as a ramp: each burst " +
      "lands as its own cluster, and the silences between them are the point.",
    curve: [
      "`0-45`     empty",
      "`45-75`    burst — 40 dialogs, then silence",
      "`75-140`   nothing; the pile just sits there",
      "`140-175`  burst — 70 dialogs",
      "`175-230`  nothing",
      "`230-265`  burst — 130 dialogs",
      "`265-300`  nothing",
      "`300-420`  bursts every ~20 frames, each larger, the gaps shortening",
      "`420-560`  continuous flood, no gaps",
      "`560-600`  hold — the frame is covered",
    ],
  },
};

const COPY = ["src", "public", "tsconfig.json", "remotion.config.ts"];

/** Files carrying variant fences, and the fence tags each bundle drops. */
const FENCED = ["src/config.ts", "src/Root.tsx", "src/dialogs.ts"];
const DROPPED = { light: ["dark", "clustered"], dark: ["light", "radial"] };

/** Drop every fenced region tagged with one of `drop`, then strip all fences. */
const stripVariant = (source, drop) => {
  const tagged = (line, marker) => drop.some((tag) => line.includes(marker) && line.includes(`:${tag}`));
  const kept = [];
  let skipping = false;
  for (const line of source.split("\n")) {
    if (!skipping && tagged(line, ">>>")) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (tagged(line, "<<<")) {
        skipping = false;
      }
      continue;
    }
    if (line.includes(">>>") || line.includes("<<<")) {
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
};

const readme = (name, variant) => `# ${variant.title}

${variant.blurb}

## The composition

| | |
| --- | --- |
| Composition id | \`${variant.compositionId}\` |
| Resolution | 3840 x 2160 (4K UHD) |
| Duration | 600 frames @ 30 fps = 20.0 s |
| Loops? | **No.** Frame 0 and frame 599 differ entirely by design — dialogs accumulate and nothing ever closes or fades. |
| Audio | None. |

## Render

Install once, then render:

\`\`\`bash
npm install
npx remotion render ${variant.compositionId} out/${variant.outName}.mp4 --codec=h264 --crf=14 --concurrency=8
\`\`\`

That is the full 4K render. \`--concurrency\` must not exceed the machine's CPU
core count; lower it if Remotion refuses to start.

A quick 1080p check, which renders in a fraction of the time:

\`\`\`bash
npx remotion render ${variant.compositionId} out/${name}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

Or open the editor:

\`\`\`bash
npm run dev
\`\`\`

## The spawn curve

${variant.curve.map((l) => `- ${l}`).join("\n")}

The curve is data, not code: \`src/config.ts\` describes it as a list of
segments and \`src/spawn-curve.ts\` resolves it into \`spawnsAtFrame(frame)\`.
Reshaping the piece means editing the segment list and nothing else.

## Layout

\`\`\`
src/
  index.ts          registerRoot
  Root.tsx          the composition registration
  ErrorCascade.tsx  the composition component
  config.ts         VARIANTS — palette, dialog style, spawn curve, messages.
                    The only file in the project containing a colour literal.
  spawn-curve.ts    segments -> per-frame spawn counts -> the dialog schedule
  dialogs.ts        seeded placement and rotation for every dialog
  fonts.ts          the UI sans, gated with delayRender()/continueRender()
  grain.ts          the ~2% grain overlay
  components/
    SpawnLayer.tsx  the canvas, and the per-frame blit loop
    Dialog.tsx      the dialog sprite, drawn once into an offscreen canvas
    TitleBar.tsx    title bar, label and close glyph
    ErrorIcon.tsx   the round error icon
public/fonts/       the UI sans, vendored so a render never needs the network
\`\`\`

## Notes

- **Deterministic.** Every value on screen is a pure function of
  \`useCurrentFrame()\`. All randomness goes through Remotion's \`random()\` with
  stable string seeds — no \`Math.random()\`, no \`Date.now()\`, no
  \`requestAnimationFrame\`, no CSS animation, no component state. Seeking
  straight to frame 437 produces the same image as playing up to it, byte for
  byte, so \`npx remotion render\` is reproducible.
- **One sprite, many blits.** The dialog is drawn once into a small offscreen
  canvas and \`drawImage\`d per instance under a translate/rotate/scale.
  Redrawing the border, title bar, icon and text for hundreds of dialogs per
  frame at 4K would not render in reasonable time.
- **Generic dialog.** Square corners, a thin flat border, a flat solid title
  bar, a bare close glyph and an invented error icon. It is deliberately not a
  reproduction of any real operating system's window chrome.
- **The font is vendored.** \`public/fonts/\` holds the UI sans and
  \`src/fonts.ts\` registers it through the FontFace API behind
  \`delayRender()\`. Fetching it from a font CDN at render time would make the
  render fail behind a proxy or on a machine with no egress.
`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

for (const [name, variant] of Object.entries(VARIANTS)) {
  const target = join(dist, variant.outName);
  mkdirSync(target, { recursive: true });

  for (const entry of COPY) {
    cpSync(join(root, entry), join(target, entry), { recursive: true });
  }

  for (const file of FENCED) {
    const path = join(target, file);
    writeFileSync(path, stripVariant(readFileSync(path, "utf8"), DROPPED[name]));
  }

  writeFileSync(
    join(target, "package.json"),
    `${JSON.stringify(
      {
        ...pkg,
        name: variant.outName,
        description: `${variant.title} — a 4K Remotion animation`,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(target, ".gitignore"), "node_modules\nout\n.env\n");
  writeFileSync(join(target, "README.md"), readme(name, variant));

  const zip = join(dist, `${variant.outName}.zip`);
  if (existsSync(zip)) {
    rmSync(zip);
  }
  execFileSync(
    "zip",
    ["-r", "-q", zip, variant.outName, "-x", "*/node_modules/*", "*/out/*", "*/.git/*"],
    { cwd: dist },
  );
  console.log(`built ${zip}`);
}
