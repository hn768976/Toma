# Data Map · Plexus Globe · Circuit Warp · Soft Gradient · Wire Peaks

One Remotion project, five looks, seven compositions. All are **3840×2160, 30 fps,
600 frames (20 s), seamless loops**.

| Composition (id) | File name | Look | Engine |
|---|---|---|---|
| `DataMap-Blue` | `DataMap_Blue.mp4` | tilted world map built from 600 data tags, HUD, DoF | three.js (WebGL2) + Canvas 2D glyph atlas |
| `PlexusGlobe-Navy` | `PlexusGlobe_Navy.mp4` | nested wireframe plexus spheres with ▲ number tags | three.js |
| `CircuitWarp-Violet` | `CircuitWarp_Violet.mp4` | forward rush through circuit fragments | three.js |
| `SoftGradient-Lime` | `SoftGradient_Lime.mp4` | blurred OKLab colour blobs | full-screen fragment shader (three.js plane) |
| `SoftGradient-Peach` | `SoftGradient_Peach.mp4` | same, peach / pink / lilac | full-screen fragment shader |
| `WirePeaks-White` | `WirePeaks_White.mp4` | wireframe mountain range with leader lines and numbers | three.js |
| `WirePeaks-Cyan` | `WirePeaks_Cyan.mp4` | same, cyan on navy with glow | three.js |

Remotion forbids `_` in composition ids, so ids use a hyphen and rendered files use an
underscore.

## Setup

```bash
npm install
npx remotion studio
```

Node 18+ is fine (tested with Node 22). All dependency versions are pinned in `package.json`.

## Chromium GL flag

Everything runs on **WebGL2 through ANGLE**. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the same as passing
**`--gl=angle`** on the command line. Keep it for headless renders. WebGPU is not used.

## Render at 4K (per composition)

```bash
npx remotion render src/index.ts DataMap-Blue       out/DataMap_Blue.mp4       --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts PlexusGlobe-Navy   out/PlexusGlobe_Navy.mp4   --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts CircuitWarp-Violet out/CircuitWarp_Violet.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts SoftGradient-Lime  out/SoftGradient_Lime.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts SoftGradient-Peach out/SoftGradient_Peach.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts WirePeaks-White    out/WirePeaks_White.mp4    --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render src/index.ts WirePeaks-Cyan     out/WirePeaks_Cyan.mp4     --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --muted
```

For a mastering file, ProRes is also possible: `--codec=prores --prores-profile=4444`.

## Stills at 6000×3375

The compositions are 3840×2160; a scale of 1.5625 gives exactly 6000×3375:

```bash
npx remotion still src/index.ts DataMap-Blue out/DataMap_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(Replace the id for any other composition. Line widths and text are defined relative to
the output height, so they stay the same relative size at 6K.)

## 720p previews

```bash
./render-previews.sh            # all seven, or pass ids
```

This renders a lossless PNG sequence at `--scale=0.3333333333333333` (exactly 1280×720)
and encodes it with libx264, CRF 16, yuv420p, 30 fps, no audio. The PNG sequence is kept in
`out/frames/` for the determinism check.

## Add a colourway (one data row)

Every version is one row in `src/versions.ts`. To add one, copy a row, give it a new `id`
(letters, digits and `-`), and change its colours:

```ts
{
  id: "WirePeaks-Amber",
  look: "wirepeaks",
  seed: 1056,
  bg: "#120C04",
  bgTop: "#1A1206",
  mesh: "#FFB84A",
  numbers: "#FFE2B0",
  glow: 0.8,
  meshAlpha: 0.8,
},
```

`Root.tsx` registers a composition for every row automatically. Changing `seed` gives a
different layout (terrain, tag placement, sphere points, fragments).

## How it is built

- **Engine.** `src/lib/gl/Stage.tsx` hosts each look in `@remotion/three`'s `<ThreeCanvas>`
  (WebGL2) and runs its own pipeline in a layout effect keyed on `useCurrentFrame()`. The
  drawing buffer matches the output pixels (Remotion's `--scale` sets `devicePixelRatio`).
- **Lines, dots and sprites** are analytic-AA instanced quads (`src/lib/gl/shaders.ts`).
  Widths are given in pixels at 2160p and scale with the output. **Depth of field** works per
  primitive: each quad grows by its circle of confusion and spreads its energy over the
  wider footprint; text sprites blend a sharp and a pre-blurred glyph atlas.
- **Post chain** (`src/lib/gl/post.ts`): scene → half-float render target → optional bloom
  (13-tap downsample / tent upsample, all half-float) → final pass with the background
  gradient, vignette, ~1% grain and ±1/255 blue-noise dither.
- **Data Map tags** are placed on Natural Earth land with a seeded jittered grid and a
  collision test: 600 tags, about a third ticking (periods 30–150 frames, all dividing 600),
  plus about 20 blinking.
- **Soft Gradient** mixes blobs in **OKLab**, and each blob follows a closed Lissajous path
  with whole cycles per 600 frames. A domain warp samples simplex noise along a circle in
  the noise field.
- **Wire Peaks** is a ridged-noise heightfield (160×80 cells, seeded, not a real place).
  20 leaders sit on local maxima chosen in screen space. Each number changes on its own
  period (60–150 frames, dividing 600), with a 7-frame scramble.

## Determinism

Every value on screen comes from `useCurrentFrame()`:

- seeded `mulberry32` / integer hashes only; no `Math.random()`, `Date.now()`, `useFrame`
  or `useState`-driven visuals; nothing carried between frames;
- grain is a fixed hash of (pixel, loop frame); the dither is a fixed 64×64 blue-noise map,
  generated once by void-and-cluster from a fixed seed and offset per frame;
- all motion is periodic in 600 frames (the pipeline uses `frame % 600`), so frame 600 is
  frame 0;
- fonts, atlases and geometry are built once, behind `delayRender` / `continueRender`;
- no TAA, no accumulation.

`--props='{"loopCheck":true}'` makes any composition 601 frames long for the loop check.

## Assets and licences

- **Fonts** (`public/fonts/`): Inter and JetBrains Mono, both SIL Open Font License 1.1.
  The licence texts are next to the font files (`OFL-Inter.txt`, `OFL-JetBrainsMono.txt`).
- **World map** (`src/data/ne_110m_land.json`): **Made with Natural Earth.** Free vector
  and raster map data @ naturalearthdata.com. Natural Earth 1:110m land (v4.1.0, via the
  `world-atlas` TopoJSON), which is **public domain**. Antarctica is omitted and only outer
  rings are kept. See `data-licenses/NATURAL_EARTH.md`.
- All tags, codes and numbers are made up. No logos or brands.

<!-- MEASUREMENTS -->
