# Plexus Light Bulb · Wireframe Wind Farm · AI Wind Grid

Three looks, five compositions, one Remotion project. Everything is built in code
(three.js on WebGL2 through `@remotion/three`); the only assets are two OFL fonts.

| Composition id | File name | Look | Length | Type |
|---|---|---|---|---|
| `PlexusBulb-BlueIgnite` | `PlexusBulb_BlueIgnite` | 1 · Plexus Light Bulb | 450 f / 15 s | story |
| `PlexusBulb-GoldLoop` | `PlexusBulb_GoldLoop` | 1 · Plexus Light Bulb | 600 f / 20 s | seamless loop |
| `WireframeWindFarm-Teal` | `WireframeWindFarm_Teal` | 2 · Wireframe Wind Farm | 600 f / 20 s | seamless loop |
| `WireframeWindFarm-Blue` | `WireframeWindFarm_Blue` | 2 · Wireframe Wind Farm | 600 f / 20 s | seamless loop |
| `AIWindGrid-Blue` | `AIWindGrid_Blue` | 3 · AI Wind Grid | 600 f / 20 s | seamless loop |

All compositions are 3840×2160, 30 fps. (Remotion ids cannot contain `_`, so the ids use `-`.)

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ (tested on Node 22). Versions are pinned in `package.json`.

## Chromium GL flag

The project renders with WebGL2 through ANGLE:

```
--gl=angle
```

It is already set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`), so the
commands below do not need it, but pass it explicitly if you render through the Node APIs. On a
machine with a GPU, ANGLE uses it. Without a GPU, ANGLE falls back to SwiftShader (software)
and gives the same pixels, only slower. That is how the numbers below were measured. Do not use
WebGPU.

## Render at 4K

```bash
npx remotion render PlexusBulb-BlueIgnite  out/PlexusBulb_BlueIgnite.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render PlexusBulb-GoldLoop    out/PlexusBulb_GoldLoop.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render WireframeWindFarm-Teal out/WireframeWindFarm_Teal.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render WireframeWindFarm-Blue out/WireframeWindFarm_Blue.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
npx remotion render AIWindGrid-Blue        out/AIWindGrid_Blue.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --muted
```

(The codec, CRF, pixel format, PNG intermediates and muting are also defaults in
`remotion.config.ts`.) For a ProRes master, use `--codec=prores --prores-profile=4444`.

### 720p previews (how the delivered previews were made)

`scripts/render-preview.sh <id> <FileName>` renders PNG frames with `--scale=0.3333333333333333`
(3840×2160 → exactly 1280×720), then encodes them with ffmpeg: H.264, CRF 16, `yuv420p`,
30 fps, no audio. The PNG frames are kept in `out/frames/` so the verification can compare
frames byte for byte.

## 6K stills

```bash
npx remotion still AIWindGrid-Blue out/AIWindGrid_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375. Swap in any composition id; for
`PlexusBulb-BlueIgnite`, use a frame from the hold (≥ 150). Every size in the looks (line widths,
point sizes, bloom levels, DoF radii) scales with frame height, so a 6K still looks the same
as the 4K video. 6K stills were not rendered here.

## How it is built

```
src/
  Root.tsx             one <Composition> per data row
  versions.ts          the data rows (palettes, durations)  ← add colourways here
  engine/
    Stage.tsx          hosts a look in <ThreeCanvas>; renders synchronously per frame
    pipeline.ts        HDR scene → DoF gather → bloom mip chain → composite
                       (background, flare, tone map, vignette, dither, grain)
    lines.ts           screen-space anti-aliased "fat" lines and soft points
    sprites.ts         canvas textures, camera-facing / planar sprites, glyph atlas
    rng.ts, color.ts, fonts.ts
  shared/turbine.ts    the shared turbine (tower, nacelle, spinner, 3 lofted blades)
  looks/bulb/          Look 1: lathe bulb, threaded base, coiled filament, plexus
  looks/windwire/      Look 2: periodic wireframe terrain, 14 turbines, HUD, streaks
  looks/aigrid/        Look 3: tilted map, 40 turbines, 80 AI badges, point wave, HUD
public/fonts/          Blinker SemiBold + JetBrains Mono Medium (woff2) + OFL licences
scripts/               preview render + verification helpers
```

* **Lines.** Every wireframe, plexus link and grid line is an instanced quad, expanded in the
  vertex shader to a constant pixel width (scaled with frame height) with a box-filtered edge.
  A line narrower than a pixel is drawn one pixel wide at proportionally lower intensity, so thin
  and distant lines don't shimmer or crawl, and no TAA is needed.
* **Plexus links** are rebuilt every frame from that frame's point positions. The grid has fixed
  cells, the pair order is fixed, and opacity falls off as `(1 − d/R)²`, so links fade in and
  out instead of popping.
* **Depth of field.** Looks 2 and 3 use a single-frame scatter-as-gather pass at half resolution.
  It reads a view-depth prepass and a tile-max CoC, and samples mipmaps for large discs. Look 3
  uses a very large aperture (a narrow diagonal band stays sharp, because the camera is rolled).
  In Look 1 the dust and plexus points get per-point CoC.
* **Bloom** is a fixed 6-level 13-tap down / tent up chain. The levels have a fixed size in units
  of frame height, so the glow is the same at 720p and 4K.
* **Fake glass.** The bulb has no transmission. It uses fresnel rims and environment
  highlights, plus an emissive volume integrated along the view ray inside the analytic
  envelope profile (the same function as the lathe profile).

### Determinism

* Every value on screen is a function of `useCurrentFrame()` only. Static layouts come from
  `mulberry32` generators seeded at module level. There is no `Math.random()`, `Date.now()`,
  `useFrame` clock or `useState` driving visuals, and nothing carries over between frames.
* The loops use `t = (frame mod 600) / 600`, and every motion is a whole number of cycles of `t`:
  * rotors turn in multiples of 120°;
  * the wind farm glides exactly one layout period;
  * plexus swirls, haze, flicker, HUD tickers (step periods that divide 600), badge pulses, the
    point wave (4D simplex noise with time on a circle) and the camera laps all complete whole
    cycles.
* Grain and dither are a PCG hash of `(pixel x, pixel y, frame mod 600)` (`frame mod 450` for
  1A).
* Fonts and canvas textures are built behind `delayRender` before the canvas mounts.

## Adding a colourway

1. Copy a row in `src/versions.ts` and give it a new `id` (letters, digits and `-` only) and
   `file` name.
2. Change the palette hex values. Each look's palette type lists the fields (for example
   `WindwirePalette`: `line`, `terrain`, `horizon`, `bgTop`, `bgBottom`).
3. `npx remotion studio`. The new composition appears automatically.

For the bulb, `mode: "loop"` gives the always-lit 20 s loop and `mode: "story"` the 15 s ignite
story.

## Measured render times

MEASURED_TIMES

## Banding check

BANDING

## Completion checklist

CHECKLIST

## Fonts and licences

* Blinker SemiBold (the "AI" badges): © the Blinker project authors, SIL Open Font License 1.1.
  See `public/fonts/OFL-Blinker.txt`.
* JetBrains Mono Medium (HUD numbers and labels): © The JetBrains Mono Project Authors, SIL Open
  Font License 1.1. See `public/fonts/OFL-JetBrainsMono.txt`.

There are no logos and no brands. The only text is "AI" and invented HUD numbers and labels
("STATION 04", "OUTPUT 52.80", …).
