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

__RENDER_TIMES__

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
- Self-checks that were run: __DETERMINISM__

## Banding check

All shaders add a triangular ±1/255 dither after tonemapping, plus grain: 2% in
Fluted, the frost texture in Foil, and 1.5% in Space. Grain is a fixed function of
pixel position and frame.

__BANDING__

## Completion checklist

__CHECKLIST__

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
