#!/usr/bin/env bash
# Writes the variant-specific README.md into $2 for variant $1 (blue|amber).
set -euo pipefail
variant="$1"
dest="$2"

if [ "$variant" = "blue" ]; then
  comp="HudDashBlue"
  out="huddash-blue"
  title="Symmetrical HUD Dashboard — v1 \"blue\""
  centre='**`concentricDial`** — a dashed outer ring counter-rotating against a
rotating broken-arc ring, two thin solid rings between them, and a deliberately
**empty** centre.'
  rail='**`ticked`** — full-width rails of evenly spaced vertical ticks (every
fifth one longer) with small filled triangles pointing inward.'
  dense='3 panels in the left column, a 3 x 8 data table and a 5-bar row on the right.'
else
  comp="HudDashAmber"
  out="huddash-amber"
  title="Symmetrical HUD Dashboard — v2 \"amber\""
  centre='**`hexCore`** — two counter-rotating hexagons interlocking into a
twelve-pointed star, the same broken-arc ring rotating against both (three
rotation rates), an **occupied** centre (a small filled hexagon carrying a live
value) and six connectors running out to label plates.'
  rail='**`segmented`** — full-width rails of short filled blocks at varied
widths, grouped with gaps.'
  dense='4 panels in the left column, a 4 x 11 data table and an 8-bar row on the
right, with all panel text reduced ~15%.'
fi

cat > "$dest/README.md" <<EOF
# ${title}

A flat, frontal, left-right symmetrical HUD dashboard built in Remotion.
Everything is drawn to 2D \`<canvas>\` — no 3D, no Three.js, no camera move.

## The composition

| | |
|---|---|
| **Composition id** | \`${comp}\` |
| **Resolution** | **4K — 3840 x 2160** |
| **Duration** | 390 frames |
| **Frame rate** | 30 fps |
| **Length** | 13.0 seconds |
| **Loops** | **Yes — seamlessly.** Frame 0 and frame 390 are pixel-identical. |

## Render at 4K

\`\`\`bash
npm install
npx remotion render ${comp} out/${out}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

A 1080p preview (half scale) is much quicker:

\`\`\`bash
npx remotion render ${comp} out/${out}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

Open the studio to scrub it:

\`\`\`bash
npx remotion studio
\`\`\`

> \`--concurrency=8\` needs at least 8 CPU cores; lower it to your core count if
> Remotion refuses to start.

## What is on screen

* **Top and bottom** — full-width rails carrying a marker that slides whole
  traversals across the loop.
* **Centre** — the hero form, ~46% of the frame height.
* **Flanking the centre** — a ring gauge on each side: mirrored in position,
  never in content. Their values and arc positions differ.
* **Beneath the centre** — three pie charts with percentage labels and short
  waveform strips between them.
* **Left column** — filled area chart, pie indicators, vertical bar chart.
* **Right column** — paired ring indicators, a horizontal bar row, a numeric
  data table, a line chart with a spike.
* **Corners** — paired circular indicators above each column.

The two columns occupy exactly mirrored rectangles, but no panel's content is
mirrored: the symmetry is compositional, so it reads as a dashboard rather than
as a reflection.

### This version

* **Centre form:** ${centre}
* **Rail style:** ${rail}
* **Panel density:** ${dense}

## How it is put together

\`\`\`
src/
  index.ts            registerRoot
  Root.tsx            <Composition> registration for both variants
  HudDash.tsx         the composed frame
  variants.ts         VARIANTS — palette, centre form, panel content, rail style
  layout.ts           the fixed 3840x2160 symmetrical layout
  constants.ts        WIDTH / HEIGHT / FPS / LOOP
  lib/                colour, font loading, canvas primitives, loop-safe motion
  components/         CentreDial, SidePanel, RingGauge, BarRow, DataTable,
                      TickRail, MiniChart, PieRow, CornerPods, Backdrop, Finish
public/fonts/         Barlow Condensed woff2 (latin, 400/500/600/700)
\`\`\`

\`src/variants.ts\` exports a single \`VARIANTS\` object keyed \`"blue" | "amber"\`.
It is the only file in the project containing a colour literal, and it is what
selects the centre form, the rail style and the panel content. Both variants are
registered in \`Root.tsx\`, so \`HudDashBlue\` and \`HudDashAmber\` can both be
rendered from this project.

## Determinism

Every value on screen is a pure function of \`useCurrentFrame()\`. There is no
\`Date.now()\`, no \`requestAnimationFrame\`, no CSS animation and no component
state; all randomness goes through Remotion's \`random()\` with stable string
seeds. Canvases are painted synchronously once per React render, so
\`npx remotion render\` is reproducible frame for frame.

Every periodic quantity completes a whole number of periods in 390 frames —
rotations, chart scrolling, rail markers, and the spring cycles that drive the
gauges, bars and pies — which is what makes frame 0 and frame 390 identical.

## Fonts

The readouts use Barlow Condensed. The woff2 files ship in \`public/fonts\` and
are registered through the \`FontFace\` API behind
\`delayRender()\`/\`continueRender()\`, so a render needs no network access. Set
\`USE_GOOGLE_FONTS_CDN = true\` in \`src/lib/font.ts\` to pull the identical family
through \`@remotion/google-fonts\` instead. Numeric readouts are laid out on a
fixed digit advance in \`src/lib/draw.ts\`, giving true tabular figures so values
never jitter as they change.

No logos, no watermark, no audio.
EOF
