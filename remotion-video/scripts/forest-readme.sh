#!/usr/bin/env bash
# Emits the README for one packaged forest deliverable.
# Usage: forest-readme.sh <out> <compId> <title> <name> <subtitle> <particles> <ground>
set -euo pipefail
OUT="$1"; COMP="$2"; TITLE="$3"; NAME="$4"; SUB="$5"; PARTICLES="$6"; GROUND="$7"

cat > "$OUT" <<EOF
# $TITLE

A 4K seamless loop built with [Remotion](https://remotion.dev). $SUB

## The composition

| | |
|---|---|
| **Composition id** | \`$COMP\` |
| **Resolution** | 3840 × 2160 (4K UHD) |
| **Duration** | 240 frames |
| **Frame rate** | 30 fps |
| **Length** | 8.0 seconds |
| **Loops** | Yes — seamlessly. Frame 240 is byte-identical to frame 0. |
| **Audio** | None |

## Rendering

Install once:

\`\`\`sh
npm install
\`\`\`

Full 4K master:

\`\`\`sh
npx remotion render $COMP out/$NAME.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

1080p preview — much faster, and the canvas still renders internally at 4K:

\`\`\`sh
npx remotion render $COMP out/$NAME-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

Interactive:

\`\`\`sh
npx remotion studio
\`\`\`

Lower \`--concurrency\` if the machine has fewer than 8 cores; Remotion refuses
a value above the core count.

## Verifying the loop

A second composition, \`ForestLoopCheck\`, is registered one frame longer than
the loop while the layers stay driven by the 240-frame cycle. That makes frame
240 renderable and directly comparable with frame 0:

\`\`\`sh
npx remotion still ForestLoopCheck out/f0.png   --frame=0   --scale=0.5
npx remotion still ForestLoopCheck out/f240.png --frame=240 --scale=0.5
cmp out/f0.png out/f240.png
\`\`\`

The two files are byte-identical. Everything periodic in the scene is on a
whole cycle count and is reduced through \`loopSin\`/\`loopCos\` before the trig
call, and the film grain is seeded on \`frame % 240\` rather than on the raw
frame number.

## The asset

\`public/tree.svg\` — a single bare-branched tree silhouette, vector-traced
from the raster reference supplied with this brief. It is the only art asset:
every tree in the frame is this one shape, placed ~84 times per frame with a
seeded flip, scale (0.45–1.5), shear (±5°), rotation, vertical squash and
depth tint.

**Licence: not established.** The source raster came from the project owner and
appears to originate from a stock library — the accompanying upload was named
\`istockphoto2218590375640_adpp_is.mp4\`. Confirm that the original licence
permits redistribution and derivative vector works before publishing this
project or its output. Substituting a differently-licensed silhouette is a
one-file change: replace \`public/tree.svg\` and nothing else, since the sprite
loader reads the aspect ratio from the SVG's \`viewBox\`.

## How it is put together

Layer order, back to front:

1. \`<SkyWash>\` — static vertical wash with a lifted horizon.
2. \`<TreeField band="far">\` — 40 trees, ~18px blur, dissolved toward the fog.
3. \`<FogLayer depth="back">\` — haze behind the mid trees, plus the light shaft.
4. \`<TreeField band="mid">\` — 26 trees, ~7px blur.
5. \`<FogLayer depth="front">\` — haze in front of the mid trees.
6. \`<TreeField band="near">\` — 14 trees, sharp, full opacity.
7. \`<GroundGlow>\` — $GROUND
8. \`<TreeField band="foreground">\` — 4 very large trees, ~26px blur, cropped by the frame edges.
9. \`<ParticleField>\` — $PARTICLES
10. \`<GrainVignettePass>\` — 26% vignette and 5% film grain.

Interleaving the fog *between* the depth bands is what creates the sense of
depth — more so than the per-band blur does. The ground glow sits in front of
the near band, because the embers (or the snow) lie on the ground and light the
near trunk bases, but it is confined tightly to the bottom ~15% of the frame:
any higher and it washes the near trunks out of silhouette.

### Things worth knowing before editing

- **\`src/forest/variants.ts\` is the only file containing a colour literal.**
  It holds one exported \`VARIANTS\` object keyed by \`"ember" | "frost"\`, with
  the palette, particle behaviour, fog settings and ground treatment for each.
  Both variants are present; this project registers \`$COMP\`.
- **Embers and snow are one particle system**, not two. The only structural
  difference is the sign of \`particles.direction\` (\`+1\` rises, \`-1\` falls);
  the rest is behaviour flags on the same code path.
- **Each depth band is blurred once**, on the way out of its own offscreen
  buffer. Blurring per tree would be 40 blur passes per frame in the far band
  alone, which is unusable at 4K.
- **The tree SVG is parsed and rasterised once**, into eight depth-tinted
  bitmaps. Every instance is then a single \`drawImage()\` with a transform.
- **Tree placement is generated once** (a seeded \`useMemo\`) and reused for
  every frame. Trees are static; the camera drift, fog and particles carry all
  the motion.
- **All randomness goes through Remotion's \`random()\`** with stable string
  seeds, so the forest is identical on every render, on every machine, in any
  frame order across any number of workers. No \`Math.random()\`, no
  \`Date.now()\`, no \`requestAnimationFrame\`, no component state — every frame
  is a pure function of the frame number.
- Instance scale comes from a golden-ratio low-discrepancy sequence over the
  band index rather than a plain random draw. A random draw regularly places
  two same-size instances side by side, and two same-size instances of one
  silhouette — one of them flipped — read immediately as a mirrored stamp.
- The far, mid and foreground bands use a half-resolution backing store and the
  fog uses one eighth. They are heavily blurred or pure gradient, so nothing is
  lost and it roughly quarters their cost. The near band, the particles and the
  finishing pass are full 3840 × 2160.

### Layout

\`\`\`
src/
  Root.tsx                    composition registration
  forest/
    variants.ts               the VARIANTS table — every colour lives here
    constants.ts              4K / 240 frames / 30fps, sprite sizing
    placement.ts              the four depth bands
    drift.ts                  per-layer parallax amplitudes
    ForestScene.tsx           layer order
    layers/                   thin bindings of VARIANTS to the library
  lib/                        vendored shared Remotion component library
\`\`\`

\`src/lib/\` is a byte-identical copy of a shared, project-agnostic library —
\`SvgSilhouetteField\`, \`FogLayer\`, \`ParticleDriftField\`,
\`GrainVignettePass\` and their seeded-random, colour, loop, bloom and
noise-edge helpers — vendored here so this project is standalone.
EOF
