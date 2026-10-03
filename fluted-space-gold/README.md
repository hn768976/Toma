# Fluted Glass · Sun to Alpha Centauri · Frosted Gold Foil

Six Remotion compositions (three looks, two versions each) built in code with
three.js through `@remotion/three`. Every look is defined at **3840×2160, 30 fps,
600 frames (20 s)**.

| Composition id | Look | Version | Loops |
|---|---|---|---|
| `FlutedGlass-Sunset` | Fluted Glass Gradient (2D shader) | 1A Sunset | yes |
| `FlutedGlass-CoolPastel` | Fluted Glass Gradient (2D shader) | 1B Cool Pastel | yes |
| `SunToAlphaCentauri-Clean` | Sun to Alpha Centauri (3D) | 2A Clean | no |
| `SunToAlphaCentauri-Labelled` | Sun to Alpha Centauri (3D) | 2B Labelled | no |
| `FrostedFoil-Gold` | Frosted Gold Foil (2D shader) | 3A Gold | yes |
| `FrostedFoil-Silver` | Frosted Gold Foil (2D shader) | 3B Silver | yes |

## Setup

```bash
npm install
npx remotion studio        # preview (the Studio caps the GL buffer at half resolution)
```

Node 18+ is required. Versions are pinned in `package.json` / `package-lock.json`.

## Chromium GL flag

three.js needs WebGL2 in headless Chromium. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the same as passing
**`--gl=angle`** on the command line. Pass it explicitly when you render through
the Node APIs (`chromiumOptions: { gl: "angle" }`). Nothing uses WebGPU.

## 4K render commands (one per composition)

```bash
npx remotion render FlutedGlass-Sunset          out/FlutedGlass_Sunset_4K.mp4          --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render FlutedGlass-CoolPastel      out/FlutedGlass_CoolPastel_4K.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render SunToAlphaCentauri-Clean    out/SunToAlphaCentauri_Clean_4K.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render SunToAlphaCentauri-Labelled out/SunToAlphaCentauri_Labelled_4K.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render FrostedFoil-Gold            out/FrostedFoil_Gold_4K.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render FrostedFoil-Silver          out/FrostedFoil_Silver_4K.mp4          --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

For a mezzanine master, use `--codec=prores --prores-profile=4444` instead.

720p previews (what was rendered for delivery):

```bash
npx remotion render <id> out/<name>.mp4 --scale=0.3333333333333333 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
# or all six plus stills:  scripts/render-previews.sh
```

`--scale=0.3333333333333333` gives exactly 1280×720 (checked with ffprobe).

## Stills (6000×3375)

```bash
npx remotion still <id> out/<id>_6K.png --frame=300 --scale=1.5625 --gl=angle --image-format=png
```

`3840 × 1.5625 = 6000`, `2160 × 1.5625 = 3375`. The shaders work from the real
drawing-buffer size, so a 6K still is sharp, not upscaled. For the space look,
`--frame=540` shows the arrival. (No 6K stills were rendered here.)

## Measured render time (720p, this machine)

Measured on this build machine: 4 vCPU, **no GPU** (Chromium falls back to
SwiftShader, which runs WebGL on the CPU), `--concurrency=2`, full 600-frame
renders at 1280×720. The figures are wall-clock time, including bundling and
H.264 encoding.

| Look | 600 frames @720p | Per frame @720p | 4K estimate, this machine (×9 pixels) | 4K estimate, any recent GPU |
|---|---|---|---|---|
| Fluted Glass (1A / 1B) | 101 s / 100 s | **0.17 s** | ~1.5 s/frame, ~15 min per comp | ~0.2–0.4 s/frame (capture + encode bound) |
| Sun to Alpha Centauri (2A / 2B) | 595 s / 601 s | **1.0 s** | ~7–9 s/frame, ~75–90 min per comp | ~0.3–0.6 s/frame |
| Frosted Foil (3A / 3B) | 248 s / 246 s | **0.41 s** | ~3.7 s/frame, ~37 min per comp | ~0.2–0.4 s/frame |

The 4K estimates scale the per-pixel shader cost by 9 (3840×2160 is 9× the pixels
of 1280×720). No 4K render was run here, so treat these as estimates. On a machine
with a GPU, WebGL runs on the GPU and the per-frame time is dominated by page
capture and encoding.

## Determinism

- Every value on screen comes from `useCurrentFrame()`. The camera path, speeds,
  body positions and the distance counter are pure functions in
  `src/space/timeline.ts`. Cumulative travel is a table integrated once at module
  load, so no value is carried from frame to frame.
- Random values come from `mulberry32` seeded at module level (`src/shared/random.ts`,
  star catalogue in `src/space/starfield.ts`). Per-pixel grain and dither use an
  integer PCG hash of (pixel, frame) inside the shaders. Nothing calls `Math.random()`.
- There is no R3F clock, no `Date.now()`, no `useState` driving visuals, and no
  TAA or temporal effects. In the space look, R3F's `useFrame` is used only as the
  hook that `ThreeCanvas.advance()` calls to run the two render passes. It never
  reads `state.clock` or `delta`.
- Inter loads through `FontFace` behind `delayRender` / `continueRender`.
- Loops: blob, wave and hot-spot motion uses noise sampled on a circle in time or
  integer harmonics of the loop phase. Grain uses `frame % 600`. The foil twinkle
  has a period of 120 frames, which divides 600. The loop phase is computed on the
  CPU as `frame % 600`, so frame 600 is exactly frame 0.
- Self-checks that were run: 
  - **Loop:** with `--props='{"loopCheck":true}'` (601 frames), frame 600 equals
    frame 0 **pixel for pixel** for all four looping comps.
  - **Same every time:** frame 300 rendered alone in a fresh process
    (`npx remotion still … --frame=300`) is **byte-identical** to frame 300 of a
    multi-threaded (`--concurrency=4`, frames rendered out of order) image-sequence
    render, for all six comps.

## Banding check

All shaders add a triangular ±1/255 dither after tonemapping, plus grain: 2% in
Fluted, the frost texture in Foil, and 1.5% in Space. Grain is a fixed function of
pixel position and frame.

The check was run on frames decoded **from the encoded 720p mp4s**, not the
preview:

- **1A / 1B frame 300, vertical lines through the gradient:** after 9-px smoothing,
  no step is larger than 0.9 of an 8-bit level. The longest run of one identical
  value is 10–34 px. That is shorter than the natural spacing of levels on those
  gradients (1B spans only about 12 levels over 720 px, i.e. a level every 60 px),
  so the dither survives encoding and there are no visible steps.
- **2A frame 30, radial lines out of the Sun's glow:** in the glow (r = 75–330 px),
  the longest identical run is 4–5 px. Rings at r = 80, 110, 140 and 170 have
  smooth means of 130 → 41 → 15 → 7 with noise σ ≈ 5–8, and there are no
  plateaus.
- **3A frame 300:** the longest identical run is 3–8 px per channel. The frost
  texture fully breaks up the gradients.

To repeat: `ffmpeg -i out/FrostedFoil_Gold.mp4 -vf "select=eq(n\,300)" -frames:v 1 f.png`,
then read pixel columns, or use `python3 scripts/check.py banding f.png`.

## Completion checklist

- [x] 6 compositions, 3840×2160, 30 fps, 600 frames; one data row per version
- [x] WebGL2 via three.js / `@remotion/three`; `--gl=angle`; no WebGPU, no PixiJS, no MCP
- [x] Inter (OFL) shipped and loaded behind `delayRender`
- [x] No `Math.random()`, `Date.now()`, R3F clock, `useState`-driven visuals, or TAA
- [x] Dither ±1/255 after tonemapping in every shader; grain from pixel and frame
- [x] Loop check (frames 0 = 600) passes for 1A, 1B, 3A and 3B
- [x] Frame-300 cold start vs sequence render: byte-identical for all six
- [x] 720p previews: 1280×720, h264, yuv420p, 30/1, 20.0 s, no audio (ffprobe)
- [x] Banding read from the encoded mp4s: smooth
- [x] 2B labels spelled exactly; counter ends at 4.24
- [x] README with 4K commands, the still command, the GL flag, timings, banding, colourway how-to and the accuracy note
- [x] Clean copy: `npm install && npx remotion studio` works

## How to add a colourway

Every version is one data row in `src/versions.ts`. `Root.tsx` registers a
composition for each row.

- **Fluted Glass:** add a row with seven `colors` (hex), seven `weights` (how much
  of the frame each colour takes; 1 = normal), `ribs` (90 by default) and a
  `background` (shown only before the GL canvas appears).
- **Frosted Foil:** add a row with `light`, `mid` and `dark` hex colours.
- **Space:** `labels: true | false`.

Example:

```ts
{ id: "FrostedFoil-RoseGold", props: { light: "#F8DCCB", mid: "#C98F72", dark: "#4A2418" } },
```

## Alpha Centauri accuracy note

Proxima Centauri is **4.24 light-years** from the Sun. Alpha Centauri A and B are
about **4.37 light-years** away, and Proxima is far from A and B (about
0.2 light-years). Showing all three in one view is an artistic framing. The
distance counter in 2B ends at **4.24**, the distance of the nearest star.

The labels read exactly "Sun", "Alpha Centauri A", "Alpha Centauri B" and
"Proxima Centauri". The counter reads "0.00 light-years" → "4.24 light-years",
eased with the travel.

## Project layout

```
src/
  Root.tsx, versions.ts          compositions + one data row per version
  shared/                        GLSL hash/noise/dither, full-screen shader stage, fonts, PRNG
  fluted/                        Look 1 shader + component
  space/                         Look 2: timeline, star catalogue, shaders, scene, labels
  foil/                          Look 3 shader + component
public/fonts/                    Inter 300/400/500 (woff2) + OFL-Inter.txt
scripts/                         stills.mjs (render chosen frames), render-previews.sh, verify helpers
```

Starfield note: the brief describes the stars as a `Points` shader. Points cannot
stretch into streaks, so the 40,000 catalogue stars are drawn as instanced
camera-facing quads in a single draw call. Each one is a round point when still
and a capsule streak when the camera moves. There is still no PixiJS, and no
per-star objects. A faint procedural layer of unresolved background stars, fixed
to the sky, is added in the post pass for density.

## Fonts and licences

Inter © The Inter Project Authors, licensed under the SIL Open Font License 1.1
(`public/fonts/OFL-Inter.txt`). Simplex noise GLSL by Ashima Arts / Stefan
Gustavson (MIT). No logos or brands.
