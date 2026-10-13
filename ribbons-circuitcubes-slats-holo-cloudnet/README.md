# Ribbon Layers · Circuit Cubes · Slat Ribbon · Holo Liquid · Cloud Network

Five abstract looks in eight Remotion compositions. Each one is a **20 s seamless loop**
(600 frames, 30 fps), defined at **3840×2160**. Everything is built in code: there is no
text, no logos and no external assets apart from the Natural Earth land data.

| Composition id | Output file | Look | Engine |
|---|---|---|---|
| `RibbonLayers-Blue` | `RibbonLayers_Blue.mp4` | 9 thick satin ribbons, rounded profile, PCF shadows, fixed-pattern SSAO | three.js (WebGL2) |
| `RibbonLayers-Coral` | `RibbonLayers_Coral.mp4` | same, coral / rose | three.js |
| `CircuitCubes-Blue` | `CircuitCubes_Blue.mp4` | tilted tile board, 240 glass cubes in 14 clusters, traces with pulses, core cube, strong DoF | three.js |
| `SlatRibbon-GraphiteOrange` | `SlatRibbon_GraphiteOrange.mp4` | 420 instanced graphite slats on a travelling wave, warm underglow | three.js |
| `SlatRibbon-GraphiteCyan` | `SlatRibbon_GraphiteCyan.mp4` | same, cyan underglow | three.js |
| `HoloLiquid-HoloBlue` | `HoloLiquid_HoloBlue.mp4` | full-screen liquid-chrome relief, holographic bands | fragment shader on a plane |
| `HoloLiquid-GoldRose` | `HoloLiquid_GoldRose.mp4` | same, gold / rose | fragment shader |
| `CloudNetwork-Blue` | `CloudNetwork_Blue.mp4` | cloud icon, 12 instanced pawns, pulse lines, Natural Earth dot map, 30° orbit | three.js |

Remotion does not allow `_` in composition ids, so ids use `-` and the delivered files use `_`.

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Versions are pinned in `package.json`: Remotion 4.0.515, three 0.185.1 and
@react-three/fiber 9.8.1.

### Chromium GL flag

All looks render with **WebGL2 through ANGLE**. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the CLI's `--gl=angle`. Pass it
explicitly if you render through the Node APIs:

```bash
npx remotion render <id> out.mp4 --gl=angle
```

On a machine without a GPU, ANGLE falls back to SwiftShader (CPU). That is how the timings
below were measured, and it gives exactly the same frames, only slower.

## Rendering

### 4K, one command per composition

```bash
npx remotion render RibbonLayers-Blue         out/RibbonLayers_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=120000
npx remotion render RibbonLayers-Coral        out/RibbonLayers_Coral.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=120000
npx remotion render CircuitCubes-Blue         out/CircuitCubes_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=120000
npx remotion render SlatRibbon-GraphiteOrange out/SlatRibbon_GraphiteOrange.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=120000
npx remotion render SlatRibbon-GraphiteCyan   out/SlatRibbon_GraphiteCyan.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=120000
npx remotion render HoloLiquid-HoloBlue       out/HoloLiquid_HoloBlue.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=120000
npx remotion render HoloLiquid-GoldRose       out/HoloLiquid_GoldRose.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=120000
npx remotion render CloudNetwork-Blue         out/CloudNetwork_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --timeout=120000
```

On a CPU-only machine, `--concurrency=1` or `--concurrency=2` is fastest, because
SwiftShader already uses every core. On a GPU, raise it. **Keep `--timeout`:** on a CPU a
4K Holo Liquid frame takes about 33 s, which is longer than Remotion's 30 s per-frame
default.

### 6K still (6000×3375)

The compositions are 3840×2160, so a 6000×3375 still needs `--scale=1.5625`:

```bash
npx remotion still CircuitCubes-Blue out/CircuitCubes_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle --timeout=300000
```

Swap in any composition id. All post-processing (DoF radius, bloom, AO radius, grain) is
defined relative to the frame height, so the 6K still matches the 4K look.

### 720p previews and verification

```bash
npx remotion bundle src/index.ts --out-dir=out/bundle
scripts/render-all.sh                     # or: scripts/render-verify.sh CircuitCubes-Blue
```

For each composition, `scripts/render-verify.sh` does the following:

1. Renders **601 frames** (input prop `{"loopTest":true}` makes the composition 601 frames
   long) as a PNG sequence at `--scale=0.3333333333333333` (1280×720), using two browser tabs.
2. **Loop check:** compares frame 600 with frame 0 pixel for pixel.
3. Encodes frames 0–599 to H.264, `yuv420p`, CRF 16, 30 fps, with no audio.
4. **Determinism check:** renders frame 300 alone from a cold start and compares it byte for
   byte with frame 300 of the full sequence.
5. Writes `renders/<Name>.mp4`, a 720p still `renders/<Name>.png` (frame 300), and a
   `renders/<Name>.verify.txt` log.

## Determinism

Remotion renders frames out of order, across tabs. Every visual is therefore a pure
function of `useCurrentFrame()`:

- Layouts (cube clusters, traces, pawn ring, slat path) come from `mulberry32` seeded **at
  module level**. `Math.random()` is never used.
- Motion uses whole-cycle sines of `2π·frame/600`, or points on a circle (Holo Liquid's 4D
  noise), so frame 600 ≡ frame 0.
- Rendering is driven by `@remotion/three`'s `<ThreeCanvas>`. A `useFrame` callback at
  priority 1 does the rendering, but it reads Remotion's frame and never R3F's clock.
- There is no TAA, no `AccumulativeShadows`, no `useState` for visuals, no `Date.now()` and
  no history buffers. The SSAO kernel and rotation are a fixed formula of the pixel position
  (interleaved gradient noise).
- The world map is loaded once with `delayRender` / `continueRender` before the first frame.

## Banding

The final pass (`src/engine/post.ts`) works in half-float linear HDR and adds:

- **±1/255 dither**;
- **1.5 % grain** from a PCG hash of `(pixel x, pixel y, frame % 600)`.

The banding check reads pixel values along lines across the risk areas from frames
**decoded from the encoded mp4s**. See *Verification results* below.

## Adding a colourway

Add **one row** to `src/versions.ts`, for example:

```ts
row<RibbonParams>("RibbonLayers-Teal", createRibbonLayers, {
  ribbon: "#1AA8B0", shadow: "#1A4A7A", key: "#D8F8FF", sheen: "#7AE8F0",
}),
```

The composition appears in the Studio automatically. Its output name is the id with `-`
replaced by `_`.

## Project layout

```
src/
  index.ts, Root.tsx        compositions (one per data row), async data loading
  versions.ts               the data rows
  engine/
    Stage.tsx               ThreeCanvas + frame-driven render loop
    post.ts                 SSAO, DoF (gather), bloom, vignette, grain, dither
    rng.ts, fullscreen.ts
  looks/
    RibbonLayers.ts  CircuitCubes.ts  SlatRibbon.ts  HoloLiquid.ts  CloudNetwork.ts
    landmask.ts             Natural Earth → dot-grid mask
public/data/                ne_110m_land.geojson + public-domain notice
scripts/                    render-verify.sh, render-all.sh
```

## Measured render times

All times were measured in this build environment: a 4-core cloud VM with **no GPU**,
Chromium headless shell, `--gl=angle` falling back to SwiftShader.

**720p** previews (1280×720, `--scale=0.3333333333333333`). Each is a 601-frame PNG
sequence rendered with `--concurrency=2`, and the time per frame is the wall time divided
by the number of frames:

| Composition | Per frame (720p) | 601 frames |
|---|---|---|
| RibbonLayers-Blue | 0.92 s | 9.2 min |
| RibbonLayers-Coral | 0.95 s | 9.5 min |
| CircuitCubes-Blue | 0.89 s | 8.9 min |
| SlatRibbon-GraphiteOrange | 0.98 s | 9.8 min |
| SlatRibbon-GraphiteCyan | 0.97 s | 9.7 min |
| HoloLiquid-HoloBlue | 1.95 s | 19.6 min |
| HoloLiquid-GoldRose | 1.95 s | 19.6 min |
| CloudNetwork-Blue | 1.16 s | 11.6 min |

**Two real 4K frames** (3840×2160, frame 300, `remotion still --scale=1`). Browser startup
was subtracted, measured with a 720p still of the same composition:

| Composition | Wall time | Render time (startup subtracted) |
|---|---|---|
| CircuitCubes-Blue | 21.1 s | **≈ 13 s / frame** |
| HoloLiquid-HoloBlue | 40.2 s | **≈ 33 s / frame** |

**4K estimates** for a full 600-frame render on the same kind of CPU-only machine are
based on 4K/720p ratios of about 15× (Circuit) and about 17× (Holo):

| Composition | ≈ per frame at 4K | ≈ 600 frames |
|---|---|---|
| RibbonLayers (each) | 14 s | 2.3 h |
| CircuitCubes-Blue | 13 s (measured) | 2.2 h |
| SlatRibbon (each) | 15 s | 2.5 h |
| HoloLiquid (each) | 33 s (measured) | 5.5 h |
| CloudNetwork-Blue | 17 s | 2.9 h |

On a machine with a real GPU behind ANGLE, expect these to drop by one to two orders of
magnitude. The frames are identical either way.

## Verification results (final renders)

| Check | Result |
|---|---|
| 1. ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, 20.0 s | all 8 pass (a single video stream each) |
| 2. Loop: frame 600 == frame 0, pixel for pixel (601-frame render) | all 8 pass |
| 3. Cold single frame 300 == frame 300 of the full multi-tab render, byte for byte (PNG) | all 8 pass |
| 4. Banding, read from frames **decoded from the mp4** | pass: see below |
| 5. Contact sheets (5 frames each) | content as specified for every composition |
| 6. Motion around frame 300 (consecutive-frame difference, flicker test) | smooth, no shimmer (see below) |

**Banding.** Pixel profiles were read along lines through the risky areas. On smooth
gradients (the Slat Ribbon background, the Cloud Network floor and left edge, the Ribbon
Layers faces, the Circuit Cubes haze) the 9×9-averaged profile changes by at most about
0.4–1.0 levels per pixel. No run of identical raw blue values is longer than 8 px (11 px in
Holo's deep valleys), so there are no plateaus or steps. Larger per-pixel steps occur only
at real geometric edges (ridges, grid seams, ribbon edges).

**Motion.** Mean absolute luminance change between consecutive frames is about 2 levels for
Ribbon, Circuit, Slat and Cloud, and 2–4.5 for Holo. The reference clip measures about 3.8
without grain. "Flicker" pixels (a large change that immediately reverts, which is what
shimmer looks like) make up at most 0.1% of each frame.

### Completion checklist

- [x] 8 compositions at 3840×2160, 30 fps, 600 frames, seamless 20 s loops
- [x] three.js on WebGL2 via `@remotion/three` (Looks 1, 2, 3, 5); full-screen fragment shader for Look 4
- [x] no text, logos or brands; no MCP servers used to build it
- [x] Natural Earth 1:110m land as a dot grid (public domain, notice included)
- [x] deterministic: no `Math.random()`, no `useFrame` clock, no TAA, no `AccumulativeShadows`; data loaded with `delayRender`
- [x] ±1/255 dither and 1.5 % grain from a fixed formula of pixel position and `frame % 600`
- [x] one data row per version in `src/versions.ts`
- [x] 720p previews, 720p stills, the 4K and 6K commands, timings and 4K estimates

