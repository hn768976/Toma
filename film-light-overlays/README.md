# Film & Light Overlays (Remotion, 30 fps, 3840×2160)

Eight full-frame overlay compositions. Each one is a full-screen fragment shader on a
three.js plane (`@remotion/three`, WebGL2), with Canvas 2D textures for the sprocket and
scratch details. Everything is generated in code: there are no image or video assets.

| Composition ID (Remotion) | Output file | Length | Blend mode |
|---|---|---|---|
| `FilmBurn-Sequence` | `FilmBurn_Sequence.mp4` | 10 s (300 f) | Screen / Add |
| `FilmBurn-Transition` | `FilmBurn_Transition.mp4` | 3 s (90 f); cut point 1.2–1.6 s | Screen / Add |
| `VintageFilm-Colour` | `VintageFilm_Colour.mp4` | 20 s seamless loop | Screen / Add |
| `VintageFilm-Mono` | `VintageFilm_Mono.mp4` | 20 s seamless loop | Screen / Add |
| `FilmGate-16mm` | `FilmGate_16mm.mp4` | 20 s seamless loop | **Multiply** (white shows footage, black masks it) |
| `PrismGlints-Teal` | `PrismGlints_Teal.mp4` | 20 s seamless loop | Screen / Add |
| `BokehLeak-Warm` | `BokehLeak_Warm.mp4` | 20 s seamless loop | Screen / Add |
| `Starburst-White` | `Starburst_White.mp4` | 20 s seamless loop | Screen / Add |

Remotion composition IDs cannot contain `_`, so the IDs use `-`. The output files use the
underscore names.

## Setup

```bash
npm ci            # versions are pinned in package.json / package-lock.json
npm run dev       # Remotion Studio
```

Rendering needs Chrome Headless Shell. Remotion downloads it on first render. On an
offline machine, pass `--browser-executable=/path/to/chrome-headless-shell`.

## 4K render commands

`--gl=angle` is required, because the shaders need WebGL2. The codec, CRF 16, `yuv420p`,
PNG frames and muted output are already set in `remotion.config.ts`.

```bash
npx remotion render FilmBurn-Sequence   out/FilmBurn_Sequence.mp4   --gl=angle
npx remotion render FilmBurn-Transition out/FilmBurn_Transition.mp4 --gl=angle
npx remotion render VintageFilm-Colour  out/VintageFilm_Colour.mp4  --gl=angle
npx remotion render VintageFilm-Mono    out/VintageFilm_Mono.mp4    --gl=angle
npx remotion render FilmGate-16mm       out/FilmGate_16mm.mp4       --gl=angle
npx remotion render PrismGlints-Teal    out/PrismGlints_Teal.mp4    --gl=angle
npx remotion render BokehLeak-Warm      out/BokehLeak_Warm.mp4      --gl=angle
npx remotion render Starburst-White     out/Starburst_White.mp4     --gl=angle
```

- **720p preview:** add `--scale=0.3333333333333333`, which gives 1280×720.
- **Loop check:** add `--props='{"loopCheck":true}'`. The loop then has 601 frames, and
  frame 600 is identical to frame 0.
- **Prores 4444 / other codecs:** add e.g. `--codec=prores --prores-profile=4444`.
  The overlays are opaque and sit on black, so no alpha is needed.

## Changing colours (one data row)

All colours live in `src/palette.ts`, one row per look:

```ts
FilmBurn:      { whiteHot: "#FFF6D8", yellow: "#FFC830", orange: "#FF7A1A", red: "#C81A0A", char: "#140600", strip: "#1E1D1E" },
PrismGlints:   { haze: "#0E1C1E", rays: "#3A5A60", core: "#F2FAFF", streak: "#9CC8FF" },
...
```

Edit a hex value in that row and re-render. Nothing else needs changing.
- **Film burn:** the colour comes from a temperature ramp (black → red → orange → yellow →
  white-hot) built from those five colours.
- **Bokeh:** blobs cycle through `a`, `b` and `c`.
- **Gate:** `frame` must stay `#FFFFFF` for a clean Multiply matte.

## Guarantees built into the code

- **Deterministic.**
  - Every value is a pure function of `useCurrentFrame()`.
  - Randomness uses `mulberry32`, seeded at module level, plus integer hashes; nothing
    calls `Math.random()`.
  - Nothing uses `Date.now()`, `useFrame` or state to drive the visuals.
  - Burn shapes, spark paths, glint positions and ray tables are generated once.
- **Loops (clips 3–8) repeat every 600 frames.**
  - Noise is sampled on a time circle.
  - Drifts follow closed paths with whole-number frequencies.
  - The starburst rotates by exactly 8 ray spacings per loop.
  - Flicker, specks, scratches and gate weave come from a hash of `floor(frame / 2) mod 300`.
- **Black is black.**
  - Every falloff has a finite cut-off, so empty areas render exactly `(0,0,0)`.
  - Grain is multiplicative only, so it never appears on empty black.
- **No banding.**
  - The effect renders into a half-float target.
  - The final pass adds ±1/255 blue-noise dither (a 64×64 void-and-cluster map built in
    code), only where the pixel is above 2%. Pure black stays 0, and the gate's white
    stays 255.

## Project layout

```
src/Root.tsx            compositions (8)
src/palette.ts          colours (one row per look)
src/lib/ShaderOverlay   two-pass renderer: effect → half-float RT → dither → canvas
src/lib/glsl.ts         shared GLSL: 4D simplex noise, loop noise, hashes, SDFs, final pass
src/lib/textures.ts     Canvas 2D textures: sprocket holes, scratch profiles, gate edge
src/lib/blueNoise.ts    64×64 blue-noise dither map
src/lib/random.ts       mulberry32, hashes, periodic noise
src/looks/*.ts          one file per look (shader + per-frame uniforms)
```

## Timings

TIMINGS_PLACEHOLDER
