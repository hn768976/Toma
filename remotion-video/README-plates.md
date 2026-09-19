# Abstract Background Plates

Four seamlessly-looping abstract motion backgrounds, built with
**Remotion + PixiJS v8 + custom WebGL shaders**, one per supplied reference
clip. Everything is generated procedurally — the project contains no image or
video assets.

## The four plates

| Composition | Look | Duration | Frames |
| --- | --- | --- | --- |
| `GoldRain` | Vertical strands of gold particles falling through a warm haze | 20.0s | 600 |
| `CosmicDust` | Deep navy star field, teal key light, vertical cyan shaft | 30.0s | 900 |
| `MagentaNebula` | Hot pink cloud banks into violet, glitter river through frame | 11.0s | 330 |
| `GoldBand` | Turbulent river of gold glitter on pure black, molten core | 20.0s | 600 |

All are 30 fps, 16:9, silent, and **loop seamlessly** — the last frame flows
straight back into the first.

Each look is registered twice:

* `<Name>` — 1920×1080, the delivery resolution.
* `<Name>4K` — 3840×2160.

The scenes size themselves from the composition width (`scale = width / 1920`),
and all textures are generated at that scale, so the 4K composition is the same
animation authored at twice the detail rather than an upscale of the 1080p one.

## Rendering

```bash
npm install
npm run dev                # Remotion Studio, to preview and tweak

npm run render:plates      # all four at 1080p  -> out/1080p/*.mp4
npm run render:plates-4k   # all four at 4K     -> out/4k/*.mp4

# or one at a time
npm run render:gold-band
npm run render:gold-band-4k
```

Output is H.264 / MP4, CRF 16, `yuv420p`.

### GPU

The plates need a real WebGL context. `remotion.config.ts` defaults to
`swangle` (SwiftShader behind ANGLE), which works anywhere including headless
containers with no GPU, but is CPU-bound — roughly 0.9 s/frame at 1080p on four
cores. On a machine with a GPU, render several times faster with:

```bash
npx remotion render GoldBand out/gold-band.mp4 --gl=angle
```

## How it is put together

```
src/plates/
  constants.ts            frame counts and the 1920x1080 design space
  GoldRain.tsx            plate 1
  CosmicDust.tsx          plate 2
  MagentaNebula.tsx       plate 3
  GoldBand.tsx            plate 4
  pixi/
    PixiScene.tsx         the Remotion <-> PixiJS bridge
    passes.ts             nebula / bloom / grade passes built on custom shaders
    glsl.ts               the GLSL sources
    textures.ts           procedural sprite textures (glow, star, streak, ramp)
    rng.ts                seeded PRNG and periodic noise
    band.ts               the travelling wave that the "river" plates ride on
```

### Frame-accurate, not real-time

`PixiScene` initialises the Pixi `Application` with `autoStart: false` and never
uses Pixi's ticker. On every Remotion frame it calls `scene.draw(frame)` and
then renders once, holding a `delayRender()` handle until the draw has
committed. A plate's `draw` is a pure function of the frame number, so scrubbing
the studio timeline, re-rendering a frame, and rendering at 4K all produce
exactly the same image. Nothing calls `Math.random()` at draw time — all scatter
is baked once from the composition's `seed` prop, which you can change in the
studio's props panel to reroll a plate's layout.

### Why the loops are seamless

Time enters every plate as `u = frame / durationInFrames`, in `[0, 1)`, and
every animated quantity is periodic in `u`:

* **Oscillation** uses `sin(2π · (k·u + phase))` with an integer `k`.
* **Travel** wraps with `(start + u · n · wrap) % wrap`, `n` an integer, so a
  particle covers a whole number of screen widths per loop.
* **Noise fields** in the fragment shaders use the two-sample cross-fade
  `mix(fbm(p + A·u), fbm(p + A·(u−1)), u)`, which returns exactly `fbm(p)` at
  both `u = 0` and `u = 1`.

### The shader passes

* **Nebula** (`NEBULA_FRAG`) — domain-warped fbm shaped into a tilted band and
  graded through a four-stop palette, with an optional horizontal ramp so a
  layer can be weighted to one side of frame. Plates 2 and 3 each stack two of
  these.
* **Bloom** — threshold, then separable Gaussian, on half-resolution render
  targets, composited back additively. This is what blows out the highlights on
  the gold plates instead of leaving flat dots.
* **Grade** (`GRADE_FRAG`) — saturation, shadow lift, film grain that rides the
  shadows harder than the highlights, and a ±1/255 dither. The dither matters:
  the deep blue ramps in `CosmicDust` band visibly in 8-bit H.264 without it.
