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
npx remotion render RibbonLayers-Blue         out/RibbonLayers_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render RibbonLayers-Coral        out/RibbonLayers_Coral.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render CircuitCubes-Blue         out/CircuitCubes_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render SlatRibbon-GraphiteOrange out/SlatRibbon_GraphiteOrange.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render SlatRibbon-GraphiteCyan   out/SlatRibbon_GraphiteCyan.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render HoloLiquid-HoloBlue       out/HoloLiquid_HoloBlue.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render HoloLiquid-GoldRose       out/HoloLiquid_GoldRose.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render CloudNetwork-Blue         out/CloudNetwork_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

On a CPU-only machine, `--concurrency=1` or `--concurrency=2` is fastest, because
SwiftShader already uses every core. On a GPU, raise it.

### 6K still (6000×3375)

The compositions are 3840×2160, so a 6000×3375 still needs `--scale=1.5625`:

```bash
npx remotion still CircuitCubes-Blue out/CircuitCubes_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
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

<!-- RESULTS -->
