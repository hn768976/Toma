# Gold Market · Prism Light Leaks · Wireframe Gears · Gold Ring Frame · Dark Terraces

Five looks, nine compositions, one Remotion project. Every composition is a
20 s (600 frames @ 30 fps) seamless loop, defined at 3840×2160, rendered with
three.js on WebGL2 through `@remotion/three`.

| Composition id | Output name | Look | Engine | Reference |
|---|---|---|---|---|
| `GoldMarket-Bull` | `GoldMarket_Bull.mp4` | 1A — green candles, rising trend, ▲ tags | three.js 3D | 3623788541 |
| `GoldMarket-Bear` | `GoldMarket_Bear.mp4` | 1B — red candles, falling trend, ▼ tags | three.js 3D | 3623788541 |
| `PrismLeaks-Cool` | `PrismLeaks_Cool.mp4` | 2A — lilac / blue / white | full-screen shader quad | 4094562659 |
| `PrismLeaks-Warm` | `PrismLeaks_Warm.mp4` | 2B — amber / peach / gold | full-screen shader quad | 4094562659 |
| `WireframeGears-Blue` | `WireframeGears_Blue.mp4` | 3A — `#7FD8FF` on `#041428 → #0A2A4A` | three.js 3D | 3713158475 |
| `WireframeGears-Amber` | `WireframeGears_Amber.mp4` | 3B — `#FFB050` on `#140802 → #2A1408` | three.js 3D | 3713158475 |
| `GoldRingFrame-Gold` | `GoldRingFrame_Gold.mp4` | 4A — `#E8B860` edges, `#120E0A` bands | three.js 3D | 3425972391 |
| `GoldRingFrame-Silver` | `GoldRingFrame_Silver.mp4` | 4B — `#D8DEE8` edges, `#0E1014` bands | three.js 3D | 3425972391 |
| `DarkTerraces` | `DarkTerraces.mp4` | 5 — graphite `#2A2C30` → near-black | three.js 3D | 3912034999 |

(Remotion ids may not contain `_`, so ids use `-`; output files use `_`.)

## Setup

```bash
npm install          # exact versions pinned in package.json / package-lock.json
npx remotion studio  # preview (Studio caps the WebGL buffer at 1920×1080)
```

Node 18+ (built and tested with Node 22). Remotion downloads its Chrome
Headless Shell on first render; `remotion.config.ts` uses a Playwright headless
shell instead if one is present at `/opt/pw-browsers/...` (sandboxes only).

## Chromium GL flag

All renders need WebGL2 in headless Chromium:

```
--gl=angle
```

It is already set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`);
pass it explicitly when using a different config. WebGPU is not used anywhere.
On a machine with a GPU, ANGLE uses it; without one (CI, containers) Chromium
falls back to SwiftShader, which is correct but slow.

## Render at 4K

The config sets H.264, CRF 16, `yuv420p`, PNG intermediates (lossless, no
JPEG banding), `--gl=angle`.

```bash
npx remotion render GoldMarket-Bull      out/GoldMarket_Bull.mp4
npx remotion render GoldMarket-Bear      out/GoldMarket_Bear.mp4
npx remotion render PrismLeaks-Cool      out/PrismLeaks_Cool.mp4
npx remotion render PrismLeaks-Warm      out/PrismLeaks_Warm.mp4
npx remotion render WireframeGears-Blue  out/WireframeGears_Blue.mp4
npx remotion render WireframeGears-Amber out/WireframeGears_Amber.mp4
npx remotion render GoldRingFrame-Gold   out/GoldRingFrame_Gold.mp4
npx remotion render GoldRingFrame-Silver out/GoldRingFrame_Silver.mp4
npx remotion render DarkTerraces         out/DarkTerraces.mp4
```

Each is 3840×2160, 30 fps, 600 frames. Fully explicit form:

```bash
npx remotion render GoldMarket-Bull out/GoldMarket_Bull.mp4 \
  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
```

On a GPU, `--concurrency` 2–4 helps. On SwiftShader use `--concurrency=1`,
because each tab already uses every core.

## 6K stills (6000×3375)

`--scale=1.5625` turns the 3840×2160 composition into 6000×3375:

```bash
npx remotion still GoldMarket-Bull out/GoldMarket_Bull_6k.png --frame=150 --scale=1.5625 --gl=angle
```

The same command works for any id above; choose any frame from 0 to 599.

## 720p previews (how the delivered previews were made)

```bash
scripts/render-all.sh        # or: scripts/render-preview.sh <Id> <OutName>
```

Each composition is rendered at `--scale=0.3333333333333333`, which gives
exactly 1280×720. Frames are written as a lossless PNG sequence and encoded
with ffmpeg: `libx264 -crf 16 -pix_fmt yuv420p -r 30`, BT.709 tags, no audio.
This is the same encode Remotion would do. Keeping the PNG sequence also
yields frame 300 of the full render for the determinism check.

## Measured render time

The table below was measured in the build sandbox: 4 vCPU, no GPU, so WebGL
ran on SwiftShader, at `--concurrency=1`. Times are wall-clock for 600 frames
at 1280×720, browser start-up included.

RENDER_TIME_TABLE

**4K estimate.** 4K has 9× the pixels of 720p. On SwiftShader, time scales
almost linearly with pixels, so expect about 9× the figures above. On a real
GPU (anything from an RTX 3060 / M1 Pro upward) these scenes are light: a few
thousand instanced pieces, one shader quad, and a post chain that works at a
fixed 540-line resolution for DoF and bloom. Expect roughly 0.3–0.8 s per
4K frame, dominated by Chromium screenshot and PNG encode, so about 3–8
minutes per composition at concurrency 1–2.

## Determinism

Remotion renders frames out of order across tabs, so every value on screen
is a function of `useCurrentFrame()` only:

- All layouts (bars, candles, tags, gear chain, glints, specks, sparkles) come
  from `mulberry32` seeded at **module level** (`src/lib/random.ts`). There is
  no `Math.random()` anywhere.
- There is no `useFrame` clock, `Date.now()`, `useState`-driven visuals, or
  state carried between frames. `useFrame` is used only as the "draw now" hook
  that `ThreeCanvas`' `advance()` calls (`src/lib/LookCanvas.tsx`).
- There is no TAA, temporal AO, accumulation or history buffers. DoF, bloom,
  ACES, dither and grain are single-frame passes (`src/lib/post.ts`).
- The HDRI, PMREM and Inter font load behind `delayRender` / `continueRender`.
  The canvas is advanced once more after the environment is ready.
- Grain and dither are a fixed hash (PCG) of pixel position and `frame % 600`.

**Self-check:** `scripts/determinism-check.sh <Id> <OutName>` renders frame 300
cold (a fresh browser, one frame) and compares it with frame 300 of the full
sequence render, pixel for pixel.

## Seamless loops

`loopPhase(frame) = (frame mod 600) / 600`. Everything animated is a periodic
function of the phase with whole-number cycles:

- **Gold Market:** bars, candles and tags sit on a strip of length S = 6·L
  that repeats every L (L = the wave period). Over the loop the world slides
  by exactly 2·L past the camera, and along the trend in y. Tag values step
  every 30 frames through a fixed cycle.
- **Prism:** `noise(p, cos(2πt)·r, sin(2πt)·r)` with 4D simplex noise,
  `t = frame / 600`.
- **Gears:** the driver advances P = 36 tooth pitches. Tooth counts are 12
  and 18, so every gear turns exactly 3 or 2 whole turns, with neighbours in
  opposite directions at the correct ratios. Glints do whole laps of their
  gear outline. The camera drift is a closed sin/cos path.
- **Ring Frame:** glints orbit 1–3 whole laps. Sparkles twinkle 1–4 whole
  cycles. The camera push and tilt are one closed cycle.
- **Terraces:** the light, fill and camera move on closed paths, one cycle per
  loop.

**Self-check:** `scripts/loop-check.sh <Id>` sets `loopCheck: true`, which
makes the composition 601 frames long. It then renders frames 0 and 600 and
compares them pixel for pixel.

## Banding check

- The post chain adds ±1/255 triangular dither *after* bloom, ACES and the
  sRGB encode.
- Grain is a fixed hash: about 2 % amplitude in every look, about 3 % in
  Prism Light Leaks.
- The scene renders into half-float targets.
- Frames go to the encoder as PNG.

`scripts/banding.py` reads pixel values along rows or columns of frames
**decoded from the encoded mp4**. For each line it reports the smoothed
profile, the largest neighbour jump and the longest run of identical values.
See "Verification results" below.

## Blend mode for Prism Light Leaks (look 2)

The leaks are made for compositing. Put them above your footage with
**Screen** or **Add (Linear Dodge)**. The near-black background then
disappears and only the light remains. Adjust the layer opacity to taste.

## How to add a colourway

1. Add a row to `VERSIONS` in `src/versions.ts`. Copy the closest existing row
   of the same `look` and give it a new `id`, using letters, digits and `-`
   only. The new row only needs the fields its look type defines:
   - **Gold Market:** `upShare` (0..1 share of green candles), `trend` (+1/−1),
     the candle, tag and gold colours, `tagArrow`.
   - **Prism:** `shadow`, `body`, `accent` and `highlight` (dim→hot ramp),
     `bgDeep`, `fringe`, `fringeWidth`, `fringeWarmth` (0 cool spectrum →
     1 warm spectrum).
   - **Gears:** `edge`, `bgTop`, `bgBottom`.
   - **Ring Frame:** `edge` (glow/glint colour), `band` (plate colour),
     `metal` (PBR albedo of the metal).
   - **Terraces:** `top`, `bottom`.
2. The composition appears automatically in the Studio and can be rendered by
   its id. Nothing else needs to change.

## Assets and licences

- `public/hdri/studio.exr` is a Poly Haven studio HDRI, **CC0**. See
  `public/hdri/LICENSE.txt` for its provenance: it came via the CC0 mirror in
  `@pmndrs/assets`, because polyhaven.com was blocked in the build sandbox.
- `public/fonts/Inter-Medium.woff2` is Inter 500, **SIL OFL 1.1**. See
  `public/fonts/OFL.txt`; it comes from `@fontsource/inter` 5.3.0. It is used
  for the price tags in look 1.
- `src/glsl/noise4.ts` is 4D simplex noise by Ian McEwan / Ashima Arts, MIT.
- No logos, brands, stamps or real tickers. All numbers are made up and
  generated from a seed.

## Project layout

```
src/Root.tsx            nine <Composition>s generated from VERSIONS
src/versions.ts         one data row per version
src/lib/LookCanvas.tsx  ThreeCanvas wrapper, HDRI + font loaders (delayRender)
src/lib/post.ts         HDR → DoF → bloom → ACES → sRGB → grain + dither
src/lib/constants.ts    30 fps, 600 frames, 3840×2160, loopPhase()
src/lib/random.ts       mulberry32
src/looks/*.tsx         the five looks
src/glsl/*.ts           4D simplex noise, bicubic upsampling
scripts/                preview render, loop / determinism / banding checks
```

## Completion checklist

COMPLETION_CHECKLIST

## Verification results

VERIFICATION_RESULTS
