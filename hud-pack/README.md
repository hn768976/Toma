# Hazard Glitch · Brain Board · Phone Hologram · Map Panels · HUD Flythrough

One Remotion project, 5 looks, 8 compositions. Everything is built in code: shaders, three.js
geometry, and canvas textures drawn at load time. There are no image or video assets, logos or
brands. The only data files are the OFL fonts and Natural Earth land.

| Composition id (Remotion) | Output name | Look | Engine | Length |
|---|---|---|---|---|
| `HazardGlitch-Radiation` | `HazardGlitch_Radiation` | Hazard Glitch, radiation trefoil | full-screen fragment shader | 600 f · 20 s loop |
| `HazardGlitch-Biohazard` | `HazardGlitch_Biohazard` | Hazard Glitch, biohazard symbol | full-screen fragment shader | 600 f · 20 s loop |
| `BrainBoard-Blue` | `BrainBoard_Blue` | Brain Board | three.js | 600 f · 20 s loop |
| `PhoneHologram-Blue` | `PhoneHologram_Blue` | Phone Hologram | three.js | 300 f · 10 s story |
| `PhoneHologram-Violet` | `PhoneHologram_Violet` | Phone Hologram | three.js | 300 f · 10 s story |
| `MapPanels-Blue` | `MapPanels_Blue` | Map Panels | three.js | 600 f · 20 s loop |
| `HUDFlythrough-Violet` | `HUDFlythrough_Violet` | HUD Flythrough | three.js | 600 f · 20 s loop |
| `HUDFlythrough-Cyan` | `HUDFlythrough_Cyan` | HUD Flythrough | three.js | 600 f · 20 s loop |

Remotion composition ids may not contain `_`, so the ids use `-`. Output file names keep `_`.
All compositions are 3840×2160 at 30 fps, rendered with `@remotion/three` on **WebGL2**.

## Setup

```bash
npm install
npx remotion studio          # preview
```

**Chromium GL flag:** `--gl=angle`. It is already set in `remotion.config.ts`
(`Config.setChromiumOpenGlRenderer("angle")`). Pass it explicitly when you use the Node APIs:
`chromiumOptions: { gl: "angle" }`. On a machine with a GPU, ANGLE uses it. In a headless
container with no GPU, Chromium falls back to SwiftShader (software GL), which was used for the
timings below.

## 4K render commands

`remotion.config.ts` already sets PNG frames into the encoder, H.264, CRF 16, yuv420p and the
GL flag. The explicit flags below are repeated so each command is self-contained.

```bash
npx remotion render src/index.ts HazardGlitch-Radiation out/HazardGlitch_Radiation.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts HazardGlitch-Biohazard out/HazardGlitch_Biohazard.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts BrainBoard-Blue        out/BrainBoard_Blue.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts PhoneHologram-Blue     out/PhoneHologram_Blue.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts PhoneHologram-Violet   out/PhoneHologram_Violet.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts MapPanels-Blue         out/MapPanels_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts HUDFlythrough-Violet   out/HUDFlythrough_Violet.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render src/index.ts HUDFlythrough-Cyan     out/HUDFlythrough_Cyan.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
```

`--muted` drops the silent audio track Remotion would otherwise add.

## Stills (6000×3375)

6000 / 3840 = 1.5625, so a still at `--scale=1.5625` comes out at 6000×3375.

```bash
npx remotion still src/index.ts HazardGlitch-Radiation out/HazardGlitch_Radiation_6k.png --frame=300 --scale=1.5625 --gl=angle --image-format=png
```

Swap the id and the frame for the other compositions. Use frame 270 for the Phone Hologram
stories (the hold).

## 720p previews (how the delivered previews were made)

`scripts/render-previews.sh` runs these two steps for each composition:

1. `npx remotion render <id> <dir> --sequence --image-format=png --scale=0.3333333333333333 --concurrency=2`
   renders lossless PNG frames. With this scale the frames come out at exactly 1280×720.
2. `ffmpeg -framerate 30 -i <dir>/%03d.png -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30 -an`
   encodes them to the mp4.

The PNG sequence is kept so the determinism check can compare frames against it byte for byte.

## Adding a colourway (one data row)

Every version is one row in `src/versions.ts`, and `src/Root.tsx` registers every row. To add a
colourway:

1. Copy a row of the look you want.
2. Give it a new `id`, such as `MapPanels_Green`. Its composition id becomes `MapPanels-Green`.
3. Change the colours and, optionally, the `seed`. The seed sets the layout, the glitch
   schedule and the flicker.

For example:

```ts
{ look: "hud", id: "HUDFlythrough_Amber", seed: 79,
  widget: "#FFE8C8", streak_a: "#FF9A3A", streak_b: "#FF5A3A", bg: "#1A0E06", accent: "#FFC07A" },
```

## Project layout

```
src/
  Root.tsx              registers one <Composition> per data row
  versions.ts           the 8 data rows (+ hex -> linear helpers)
  lib/post.tsx          shared post: half-float MSAA target, depth-of-field, bloom,
                        filmic curve, grain + dither (all driven by the frame index)
  lib/stage.tsx         <ThreeCanvas> wrapper (dpr = Remotion scale) + posed camera
  lib/random.ts         mulberry32 (module-level seeds), stateless hash of frame numbers
  lib/assets.tsx        OFL font + Natural Earth loader, gated with delayRender/continueRender
  lib/readout.ts        ticking numeric readouts (glyph atlas + shader, no per-frame redraw)
  hazard/               Look 1: full-screen fragment shader (SDF symbols, LED glyph grid)
  brain/                Look 2: brains, circuit board, links, pulses, beams
  phone/                Look 3: generic phone, hologram layers, pictogram icons
  map/                  Look 4: Natural Earth map, glass panels, glints, readouts
  hud/                  Look 5: widget atlas, periodic flythrough, streaks
public/fonts/           JetBrains Mono + Inter (OFL) with licence texts
public/data/            Natural Earth 1:110m land (public domain) + note
scripts/                preview renderer, loop/determinism checker, banding checker
```

## Determinism

- No `Math.random()`, `Date.now()` or clock. Every visual value comes from `useCurrentFrame()`.
  - The loops wrap the frame first (`frame % 600`), so frame N and frame N+600 are identical.
  - Layouts come from `mulberry32` seeded at module level or once per version.
  - Flicker, glitches and ticking values come from integer hashes of the frame number.
- R3F's `useFrame` appears in exactly one place: the post-processing pass registers at priority 1
  to take over rendering. It never reads R3F's clock or delta.
- Scene mutation happens in `useLayoutEffect`, which runs before `<ThreeCanvas>` advances the frame.
- There is no TAA, no accumulation buffer, and no state carried between frames.
- `AssetGate` holds the first frame with `delayRender` until the fonts (and the land data for
  Map Panels) are loaded, so canvas textures are always drawn with the real fonts.
- Grain and dither in the final pass are a PCG hash of (pixel x, pixel y, frame mod length).

## Hazard symbols

Both symbols are drawn as exact geometry in the shader:

- **Radiation trefoil:** the standard proportions. A centre disc of radius R, and three 60°
  blades from 1.5R to 5R, centred at 30°, 150° and 270°.
- **Biohazard:** the standard construction in units of A (Baldwin, 1967).
  - Horn circles of diameter 30, set 11 from the centre.
  - Inner cuts of diameter 21, set 15 from the centre.
  - A centre hole of diameter 6.
  - A ring from radius 11 to 14.5, with 1-unit gaps where it crosses the horns.
  - 1-unit slits joining the hole to each horn, and a 2-unit opening at each horn tip.

Each symbol is then quantised to the LED cell grid, about 88 cells across the ring diameter.
Each cell takes the area coverage of 6 samples.

## Measured render times

These were measured in a cloud container with **no GPU**. ANGLE fell back to SwiftShader (software
WebGL2) on 4 CPU cores. On any machine with a GPU, expect these numbers to drop a lot.

### 720p (scale 1/3 → 1280×720)

Full PNG-sequence renders, `--concurrency=2`. The figure is total wall time ÷ frames, so it
includes about 15 s of bundling.

| Composition | Frames | s / frame |
|---|---:|---:|
| HazardGlitch_Radiation | 600 | 0.91 |
| HazardGlitch_Biohazard | 600 | 0.94 |
| BrainBoard_Blue | 600 | 1.62 |
| PhoneHologram_Blue | 300 | 0.70 |
| PhoneHologram_Violet | 300 | 0.69 |
| MapPanels_Blue | 600 | 0.79 |
| HUDFlythrough_Violet | 600 | 0.87 |
| HUDFlythrough_Cyan | 600 | 0.84 |

On this 4-core box, concurrency 1 and 2 were about the same speed (80 s vs 78 s for 40 frames)
and concurrency 4 was slower (108 s), because software GL already uses every core.

### Two real 4K frames (3840×2160, `--scale=1`)

Each was rendered as a standalone still, frames 300 and 301:

| Composition | Frame 300 | Frame 301 |
|---|---:|---:|
| BrainBoard_Blue (3) | 16.9 s | 17.5 s |
| HUDFlythrough_Violet (7) | 15.7 s | 15.7 s |

### 4K estimates for this software-GL box

Brain Board and the HUD looks use the measured 4K frames. The other looks scale their 720p time by
the measured 4K/720p ratio, which is about 10–18×. Shader-only and light scenes sit at the low end.

| Composition | Estimated s / frame | Estimated total |
|---|---:|---:|
| HazardGlitch_* | ~10–12 | ~1.7–2.0 h each |
| BrainBoard_Blue | ~17 | ~2.9 h |
| PhoneHologram_* | ~8–10 | ~40–50 min each |
| MapPanels_Blue | ~9–12 | ~1.5–2.0 h |
| HUDFlythrough_* | ~15.5 | ~2.6 h each |

All 8 together come to roughly 15–17 hours on this CPU. A desktop GPU through ANGLE should take
well under a second per 4K frame (not measured here).

## Banding check

The check runs on the **encoded mp4s**, using `scripts/banding-check.py` and a second probe that
finds the smoothest wide gradient in each file.

- The final pass renders into **half-float targets**. It adds a triangular **±1/255 dither** and
  **1.5 % grain**. The grain is a fixed hash of pixel and frame index (frame mod length), and it
  fades to zero below about 3 % luminance.
- Result: the glow falloffs change smoothly. The longest flat run of a single 8-bit value inside
  a dark gradient is 5–14 px, against tens of px for real banding. There are no staircase steps.
- Example: the Biohazard glow profile, sampled every 5 px, reads
  `124 118 118 117 110 115 106 93 81 71 65 61 56 52 49 45 42 39 37 36 35 33 31 29 …`.

## Completion checklist (verify loop)

| # | Check | Result |
|---|---|---|
| 1 | ffprobe: 1280×720, 30/1, h264, yuv420p, no audio; 20.0 s / 10.0 s | ✅ all 8 |
| 2 | Loop: 601-frame variant, frames 0 and 600 pixel-identical | ✅ all 6 loops. The 599→0 step also lies inside the normal step distribution (27th–95th percentile, never above the max). |
| 3 | Middle frame from a cold start vs the full render, byte for byte | ✅ all 8 (md5 match) |
| 4 | Banding read from the encoded mp4 | ✅ all 8 |
| 5 | Contact sheets: symbols correct, brains/board/pulses/scan/DoF, phone story, panels over map, HUD widgets + generic "$" coin, no logos | ✅ |
| 6 | Motion: stories in full, 2 s around frame 300 of each loop | ✅ after fixes (see below) |
| 7 | Side-by-side with the references | ✅ |
| 8 | Fresh-sub-agent visual comparison, 3 rounds for looks 1, 3, 4, 6, 7 | ✅ 3 rounds done (remaining differences listed in the delivery notes) |

Fixes made because of step 6:
- **Depth-of-field proxies are now masked by content.** HUD widgets and phone hologram layers
  had been leaving hard sharp rectangles in the blur.
- **The Map Panels glass stripes fade out near pixel size**, so they no longer shimmer.
- **The readout glyphs are inset in their atlas cells**, so the neighbouring glyph no longer
  bleeds in as a sliver.

Scripts: `scripts/render-previews.sh`, `scripts/loop-check.mjs loop|cold <ids>`,
`scripts/seam-stats.py`, `scripts/banding-check.py`, `scripts/sheet.mjs` (dev contact sheets).

