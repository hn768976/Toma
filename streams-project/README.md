# Light Streams · Shield Dome · Neon Waves · Pill Spill · Data Strands

One Remotion project with five looks and eight compositions. They are defined at
3840×2160 and 30 fps. Seven are 20 s seamless loops; `ShieldDome-Story` is a
10 s story.

| Composition | Look | Engine | Length |
|---|---|---|---|
| `LightStreams-CoralViolet` | 1A Light Streams, coral → magenta → violet | PixiJS 8 (WebGL2), strands projected in a shader | 600 f loop |
| `LightStreams-TealBlue` | 1B Light Streams, teal → blue → indigo | PixiJS 8 | 600 f loop |
| `ShieldDome-Story` | 2A Shield Dome: close-up → pull-back → dome assembles → hold | three.js via `@remotion/three` | 300 f |
| `ShieldDome-HoldLoop` | 2B finished scene, ±10° cosine orbit | three.js | 600 f loop |
| `NeonWaves-PinkBlue` | 3 Neon Waves | three.js | 600 f loop |
| `PillSpill-Blue` | 4A Pill Spill, blue | three.js | 600 f loop |
| `PillSpill-WhiteOrange` | 4B Pill Spill, white/orange | three.js | 600 f loop |
| `DataStrands-BlueOrange` | 5 Data Strands | three.js | 600 f loop |

## Setup

```
npm install
npx remotion studio
```

Pinned versions: Remotion 4.0.515, three 0.180.0, @react-three/fiber 9.3.0 and
pixi.js 8.13.2. The bundled font is JetBrains Mono, under the SIL OFL; the
licence is in `public/fonts/OFL.txt`.

### Chromium GL flag

All looks need WebGL2 through ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets this (`Config.setChromiumOpenGlRenderer("angle")`).
If you call the Node APIs, pass `chromiumOptions: { gl: "angle" }`. On a machine
with no GPU, ANGLE falls back to SwiftShader (software). That works, but it is
slow; see the timings below. Do not use WebGPU.

## Rendering

### 4K, one command per composition

```
npx remotion render src/index.ts LightStreams-CoralViolet out/LightStreams_CoralViolet.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts LightStreams-TealBlue    out/LightStreams_TealBlue.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts ShieldDome-Story         out/ShieldDome_Story.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts ShieldDome-HoldLoop      out/ShieldDome_HoldLoop.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts NeonWaves-PinkBlue       out/NeonWaves_PinkBlue.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts PillSpill-Blue           out/PillSpill_Blue.mp4           --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts PillSpill-WhiteOrange    out/PillSpill_WhiteOrange.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts DataStrands-BlueOrange   out/DataStrands_BlueOrange.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

For ProRes masters, use `--codec=prores --prores-profile=4444`.

### 6K still (6000×3375)

```
npx remotion still src/index.ts PillSpill-Blue out/PillSpill_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375. Swap in any composition ID; for
`ShieldDome-Story`, use `--frame=150` or later. Line widths, grain, DoF and bloom
are all defined relative to frame height, so the look holds at any scale.

### 720p previews (what was delivered)

`scripts/render-previews.sh` renders a PNG sequence with `--scale=0.3333333333333333`
(exactly 1280×720). It then encodes H.264 at CRF 16, `yuv420p`, 30 fps, with no
audio. Rendering a PNG sequence keeps every frame available for the byte-exact
determinism check.

## Measured render times

Measured on the build machine: 4 vCPU, no GPU, Chromium with `--gl=angle`
falling back to SwiftShader (software WebGL2). A GPU machine will be much
faster; these numbers are an upper bound.

**720p previews** (`--scale=1/3`, `--concurrency=2`, PNG sequence; wall time ÷ frames,
including browser start-up):

| Composition | s / frame (720p) | total |
|---|---|---|
| LightStreams-CoralViolet | 0.43 | 4 min 19 s |
| LightStreams-TealBlue | 0.44 | 4 min 23 s |
| ShieldDome-Story | 1.13 | 5 min 39 s (300 f) |
| ShieldDome-HoldLoop | 1.01 | 10 min 7 s |
| NeonWaves-PinkBlue | 1.05 | 10 min 33 s |
| PillSpill-Blue | 5.32 | 53 min 14 s |
| PillSpill-WhiteOrange | 5.05 | 50 min 31 s |
| DataStrands-BlueOrange | 0.40 | 4 min 0 s |

**Two real 4K frames** (3840×2160, frame 300, `--concurrency=1`; the time to
render 3 frames minus 1 frame, ÷ 2, so browser start-up is excluded):

| Composition | s / frame (4K) |
|---|---|
| LightStreams-CoralViolet | 2.14 |
| PillSpill-Blue | 17.5 |

**4K estimates** for this software-GL machine at `--concurrency=1`. The measured
4K/720p ratio is about 5× for 1A and about 3.3× for 4A; the other looks use
about 4.5× (DoF and bloom passes scale with pixel count):

| Composition | est. s / frame | est. total |
|---|---|---|
| LightStreams (each) | 2.1 (measured) | ~21 min |
| ShieldDome-Story | ~5 | ~25 min |
| ShieldDome-HoldLoop | ~4.5 | ~45 min |
| NeonWaves-PinkBlue | ~4.7 | ~47 min |
| PillSpill (each) | 17.5 (measured) | ~2 h 55 min |
| DataStrands-BlueOrange | ~1.8 | ~18 min |

On a machine with a real GPU, expect these to drop by an order of magnitude or
more. The heavy parts are fill-rate: MSAA, 96-tap bokeh DoF, SSAO and the
shadow map for the pills.

## Banding check

Each preview was checked from the **encoded mp4** (frame 300, or 150 for 2A),
not from the preview, with `python3 scripts/verify.py banding`. Two methods:

1. Vertical pixel ramps through the areas that band (Light Streams black and
   haze, Shield Dome sky, Neon Waves lavender, Pill Spill backgrounds, Data
   Strands haze), averaged in 8 px bins. Through the gradients the bins rise
   steadily: for example 1.3, 1.6, 1.8, 2.5, 3.2, 3.7, 4.0 in the Light Streams
   haze, and 180, 190, 194, 195, 198, 202, 205 on the Pill Spill background.
   Large steps occur only where a ramp crosses a strand, line or ring.
2. Contrast-stretched crops of each gradient area
   (`out/verify/banding_stretched.png`): only fine grain and dither noise, no
   contour lines.

The Light Streams black above the band encodes to an exact 0. Grain and dither
fade out below about 3% luminance there, as specified.

## Determinism

- Every value on screen is a function of `useCurrentFrame()`. Nothing uses
  `Math.random()`, `Date.now()`, R3F's clock, a Pixi ticker, `useState`-driven
  visuals, TAA, `AccumulativeShadows`, or feedback buffers.
- Random data (strands, icons, dots, text atlas, SSAO kernel, dome face
  selection) comes from `mulberry32` with fixed seeds.
- The pill pile is the saved `data/pill-pile.json`. `scripts/settle-pills.mjs`
  (Rapier, offline, run once) produced it, and the render never simulates.
- three.js looks take over R3F rendering with `useFrame(…, 1)` and read only the
  Remotion frame. PixiJS renders the stage manually, once per frame, inside a
  layout effect.
- Grain is a PCG hash of (pixel x, pixel y, `frame % loop`), where the loop is
  600, or 300 for 2A. The final pass adds a triangular ±1/255 dither. Light
  Streams fades the grain to zero below about 3% luminance.
- The font and the canvas textures (icon atlas, data-text atlas) are built once,
  behind `delayRender`.

## Completion checklist

| Check | Result |
|---|---|
| 1. ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, 10.0 s / 20.0 s | all 8 pass |
| 2. Loop: 601-frame comp (`--props='{"loopCheck":true}'`), frame 0 vs 600 | all 7 loops byte-identical PNGs |
| 3. Cold-start still vs full render (frame 300; 150 for 2A) | all 8 byte-identical |
| 4. Banding from the encoded mp4 | smooth; no contours |
| 5. Contact sheets (5 frames each) | `out/verify/*_sheet.png` |
| 6. Motion: strands and lines, dome assembly fades, pill edges, focus drift | checked frame to frame |
| 7–8. Side-by-side with the references; three rounds of independent comparison | see the delivery notes |
| No logos, brands, drug names or imprints; no bottle label; generic pictograms | yes |
| No `Math.random`, `Date.now`, physics, TAA or clocks at render time | yes |

To re-run the checks: `python3 scripts/verify.py probe|loop|determinism|banding|sheets`
(after `scripts/render-previews.sh`).

## Adding a colourway (one data row)

Add one row to `src/versions.ts`:

```ts
{ id: "LightStreams-GoldRose", file: "LightStreams_GoldRose", look: "lightStreams", frames: 600,
  props: { gradient: ["#FFC85A", "#FF7A8A", "#B05AFF"], seed: 1033 } },
```

`Root.tsx` turns each row into a `<Composition>`. Each look's props:

- `lightStreams`: `gradient` (3 colours along the arc) and `seed`.
- `neonWaves`: `neon` (3 line colours cycled per sheet), `base` (satin colour),
  `lightL` and `lightR` (the left and right coloured wash).
- `pillSpill`: `background`, `tabletA` and `tabletB`, plus `capA`, `capB` and
  `capC` (capsule half colours), and an optional `exposure`. 4B uses 0.66 so the
  white tablets keep their shading.
- `dataStrands`: `colors` (pairs of colour and share), `haze` and `text`.
- `shieldDome`: `mode` (`"story"` or `"hold"`).

## Layout

```
src/Root.tsx            compositions from the data rows
src/versions.ts         one row per version
src/lib/post.ts         three.js post: SSAO, bokeh DoF, bloom, tone map, grain/dither
src/lib/ThreeStage.tsx  R3F canvas driven by the Remotion frame
src/lib/PixiStage.tsx   PixiJS 8 renderer, no ticker
src/lib/lines.ts        analytic-AA ribbons with per-vertex defocus
src/looks/*             the five looks
scripts/settle-pills.mjs offline Rapier settle → data/pill-pile.json
scripts/render-previews.sh 720p preview renders
scripts/verify.py       verification steps 1–5
```
