# Steel Pipes, Glyph Surfaces (Remotion, 30 fps)

Seven 20-second seamless loops (600 frames, 3840×2160) built in code with
three.js on WebGL2 inside one Remotion project.

| Composition id | Look | Engine |
|---|---|---|
| `SteelPipes-Stacked` | 1 — even hex stack of steel pipes | `src/looks/pipes.ts` |
| `SteelPipes-Bundle` | 2A — mixed-size steel bundle | `src/looks/pipes.ts` |
| `CopperPipes-Bundle` | 2B — the 2A scene in copper | `src/looks/pipes.ts` |
| `DataTileFloor-GreenTeal` | 3A — glowing tile floor | `src/looks/glyphs.ts` |
| `DataTileFloor-MagentaBlue` | 3B — 3A in magenta / blue | `src/looks/glyphs.ts` |
| `GlyphWave-Blue` | 4 — undulating character surface | `src/looks/glyphs.ts` |
| `BinaryCubes-CyanViolet` | 5 — rippling binary / padlock cubes | `src/looks/glyphs.ts` |

Every version is one data row in `src/versions.ts`.

## Setup

```bash
npm install
npx remotion studio          # preview
```

Node 18+ is required. `package.json` pins exact versions.

### Chromium GL flag

`remotion.config.ts` sets `Config.setChromiumOpenGlRenderer("angle")`, which is
the same as passing **`--gl=angle`** on the command line. WebGL2 through ANGLE is the reliable
path in headless Chromium. On a machine without a GPU, ANGLE falls back to
SwiftShader (software). It is slow but gives identical results.

## Render commands (4K)

```bash
npx remotion render src/index.ts SteelPipes-Stacked        out/SteelPipes_Stacked.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts SteelPipes-Bundle         out/SteelPipes_Bundle.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts CopperPipes-Bundle        out/CopperPipes_Bundle.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts DataTileFloor-GreenTeal   out/DataTileFloor_GreenTeal.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts DataTileFloor-MagentaBlue out/DataTileFloor_MagentaBlue.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts GlyphWave-Blue            out/GlyphWave_Blue.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts BinaryCubes-CyanViolet    out/BinaryCubes_CyanViolet.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

720p preview: add `--scale=0.3333333333333333`, which gives exactly 1280×720.

### Still (6000×3375)

```bash
npx remotion still src/index.ts SteelPipes-Bundle out/SteelPipes_Bundle_6K.png --frame=300 --scale=1.5625 --gl=angle
```

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375. Every size-dependent effect (DoF
radius, bloom radius, grain) is defined relative to image height, so 6K and 720p
have the same look.

<!-- TIMINGS -->

## How it works

### Determinism

- Everything on screen is a function of `loopFrame = frame mod 600` and nothing
  else (`src/engine/rng.ts`). R3F's `useFrame` is used only as the render hook,
  and its clock is ignored. There is no `Date.now()`, no `Math.random()` and no
  state carried between frames.
- All random layout (pipe packing, cell palettes, glyph schedules, padlocks,
  brushed-noise texture) comes from `mulberry32` with fixed seeds.
- Glyph swaps use holds from {10, 12, 15, 20, 24, 30, 40, 60} frames, all of
  which divide 600. The glyph is `hash(cell, step)`, evaluated on the GPU.
- Waves sample simplex noise around a circle in time (`cos θ, sin θ`).
  Flicker uses whole cycles per loop. The floor moves exactly one patch depth
  (64 × 1.12 units) per loop.
- DoF and bloom are single-frame passes. There is no TAA.
- The font, glyph atlas and environment are built once, before the first frame
  (`delayRender` in `src/engine/Stage.tsx`).
- Grain and dither are fixed hashes of pixel position and `frame % 600`.

### Post pipeline (`src/engine/post.ts`)

1. The scene renders to a 4× MSAA half-float target. Alpha holds view depth.
2. DoF prefilter: downsample to about 540 rows max and compute a signed CoC.
   Each half-res texel takes its CoC from its nearest tap, so bright in-focus
   edges never inherit a background CoC.
3. DoF gather: a fixed 72-sample Vogel disc with scatter-as-gather weighting.
   Background samples are clamped so they cannot bleed over sharper foreground.
   An optional tilted focal plane gives the diagonal band in Glyph Wave.
4. Composite: blend sharp full-res with the blurred buffer by the gathered blur
   amount.
5. Bloom: a fixed 6-level mip chain (box down, tent up), with the base at about
   360 rows at every output size.
6. Final pass: exposure, ACES, grade, vignette, sRGB, then grain (1.5 %) and
   ±1/255 dither.

## Adding a colourway or a metal

- **Glyph colourway:** copy a row in `src/versions.ts`, e.g.
  `FLOOR_MAGENTA_BLUE = { ...floorBase, palette: [...], accent, fog }`.
  Register it in `src/Root.tsx` with a new `<Composition id=... />`.
- **Metal:** copy `BUNDLE_COPPER` and change `metal.color`, `metal.roughness`,
  the `env` tints (`panel`, `top`, `base`) and the grade (`lift` / `gain`).
  The studio environment is rebuilt from those tints.

## Fonts and licences

All glyphs are drawn from **JetBrains Mono Bold** (`public/fonts/`), under the
SIL Open Font License 1.1 (`public/fonts/OFL.txt`). The padlocks are drawn with
Canvas paths. There are no logos, brands, words or real code: every glyph is a
random single character, hex digit or binary digit.

<!-- CHECKS -->
