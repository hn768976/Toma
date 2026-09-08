# Curved World Map Financial Display

A Remotion motion graphic: a dotted world map wrapped across a curved screen
over a dark grid field, with jagged white chart lines drawing on, arcing
connection paths, small technical labels and stacked bar columns.

Two versions, same build:

| Composition id | Look |
|---|---|
| `V1-CurvedMapBlue` | Navy blue — reads as tech and markets |
| `V2-CurvedMapAmber` | Amber/gold on near-black — reads as commodities and energy |

Both are defined at **3840x2160, 30 fps, 450 frames (15 s)**. They are not
loops: the charts draw on and the display holds.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

```bash
npx remotion render V1-CurvedMapBlue out/V1_CurvedMapBlue.mp4 --scale=1 --crf=16
npx remotion render V2-CurvedMapAmber out/V2_CurvedMapAmber.mp4 --scale=1 --crf=16
```

Stills:

```bash
npx remotion still V1-CurvedMapBlue out/V1_CurvedMapBlue_still.png --frame=380 --scale=1
npx remotion still V2-CurvedMapAmber out/V2_CurvedMapAmber_still.png --frame=380 --scale=1
```

`--scale=0.5` on the same commands gives the 1920x1080 preview.

### Chromium GL flag

The cylindrical warp is a WebGL fragment shader, so headless Chromium needs a
working GL backend. The project sets it in `remotion.config.ts`:

```ts
Config.setChromiumOpenGlRenderer("angle");
```

On the command line that is `--gl=angle`. On a machine with no GPU, ANGLE falls
back to SwiftShader and renders correctly, just slower — that is what the timing
below was measured on.

### Measured render time

Measured on 4 vCPU / 15 GB, no GPU (ANGLE over SwiftShader), 1920x1080
(`--scale=0.5`), PNG intermediates:

* **~1.3 s per frame** single-threaded (`--concurrency=1`).
* **~0.56 s per frame** wall clock at `--concurrency=3` — about **4 min** for
  the full 450-frame composition.

The flat composite is authored at 5768x2842 regardless of output scale, so a
4K render costs roughly the same per frame in the 2D pass and about 4x more in
the warp pass. Budget accordingly.

## How it is built

The curve is the defining feature, and it is a real cylindrical surface, not a
plane in perspective — a CSS `perspective` transform cannot produce it.

1. **Author flat.** `src/curved-map/draw-flat.ts` draws the entire composite —
   field gradient, grid, dot matrix, chart paths, labels, arcs, bars, edge UI
   texture — into an offscreen 2D canvas at 5768x2842. Charts stay as paths and
   labels stay as real text.
2. **Warp.** `src/curved-map/warp.ts` uploads that canvas as a texture and a
   fragment shader inverts the perspective projection of a cylinder with a
   vertical axis: for each output pixel it solves
   `p = sin(theta) / (a - cos(theta))` for `theta`, then samples the flat
   texture at that angle and at the depth-scaled height. Vignette and grain are
   applied there, after the warp, so the grain stays film-flat.

`FLAT_WIDTH` in `src/curved-map/constants.ts` is derived so the warp samples the
texture 1:1 at the centre of the frame — no magnification, so the dots stay
crisp. At a 1080p preview the same texture is effectively 2x supersampled.
`FLAT_HEIGHT` carries the vertical overscan the corners pull from.

Both steps run synchronously in one `useLayoutEffect` keyed on
`useCurrentFrame()`, so the whole pipeline completes before the frame is
captured. Nothing is stateful and nothing accumulates: Remotion renders frames
out of order across threads, and every frame here is a pure function of its
frame number. All randomness comes from a seeded mulberry32 (`random.ts`).

### Map data

Continents are a dot matrix sampled from a land mask baked from **Natural Earth**
(<https://www.naturalearthdata.com>), which is in the **public domain** — no
attribution required and nothing licensed embedded in the render.

`assets/ne_50m_land.geojson` is the source; `tools/bake-land-mask.mjs`
rasterises it once into a 1200x600 bit-packed equirectangular mask in
`src/curved-map/land-mask.data.ts`. To regenerate:

```bash
node tools/bake-land-mask.mjs
```

The mask is decoded and sampled into the dot array **once at module level**
(`src/curved-map/dots.ts`); nothing is re-sampled per frame.

### Content

No real company names, tickers, timestamps or readable market data. Chart series
are seeded random walks with scripted spikes; labels are non-lexical lowercase
fragments and bare numeric readouts, drawn small and dim as texture. No
watermark, no logo.

## Layout

```
src/
  Root.tsx                     the two compositions
  curved-map/
    constants.ts               format, cylinder geometry, palettes, timing
    CurvedMapDisplay.tsx       the component: draw flat, then warp
    draw-flat.ts               the whole flat composite
    warp.ts                    WebGL cylindrical warp + vignette + grain
    scene.ts                   seeded charts, labels, arcs, bars, UI texture
    dots.ts                    the dot matrix, sampled once at module level
    land-mask.ts               land mask decode and coverage lookup
    land-mask.data.ts          baked Natural Earth mask (generated)
    projection.ts              equirectangular <-> flat pixels
    random.ts                  mulberry32 and seeded value noise
    glow-sprite.ts             cached radial glow sprites
    color.ts                   hex helpers
assets/ne_50m_land.geojson     Natural Earth source data (public domain)
tools/bake-land-mask.mjs       regenerates the baked mask
```
