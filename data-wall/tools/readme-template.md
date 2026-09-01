# Financial Data Wall — {{TITLE}}

A 4K, seamlessly looping "financial data wall": a dense field of percentage
values, faint Natural Earth continents, and a candlestick chart, all lying on a
single tilted plane that drifts slowly along its own axis.

## This build

| | |
|---|---|
| Composition id | **{{COMPOSITION}}** |
| Resolution | **3840 × 2160 (4K UHD)** |
| Duration | **600 frames — 20.0 seconds** |
| Frame rate | **30 fps** |
| Loops | **Yes — frame 600 is pixel-identical to frame 0** |

{{DESCRIPTION}}

The project also registers the companion board `{{OTHER_COMPOSITION}}`, which
shares all of this code and differs only in the `VARIANTS` entry it reads.

## Render at full 4K

```bash
npm install
npx remotion render {{COMPOSITION}} out/{{OUTNAME}}.mp4 --codec=h264 --crf=12 --concurrency=8
```

Lower `--concurrency` if the machine has fewer than eight cores (Remotion
refuses a value above the core count). For a quick 1080p check, add
`--scale=0.5`.

```bash
npx remotion studio      # interactive preview
npm run lint             # typecheck
```

## How it is put together

Everything is drawn with the Canvas 2D API — no 3D, no Three.js, no SVG.

```
src/
  variants.ts       every colour, tilt, density and layer-order value
  plane.ts          the affine tilt, the tile size, the drift and the loop
  series.ts         seeded, cyclic price and volume series
  grid.ts           grid cells, values and the reroll schedule
  geo.ts            Natural Earth land, projected once
  chartGeometry.ts  where the chart sits on the plane
  fonts.ts          Inter, gated with delayRender()
  DataWall.tsx      composes the layers in the configured order
  components/
    WorldBackdrop.tsx   background wash + continents
    NumberGrid.tsx      the percentage field
    ChartLayer.tsx      owns the chart canvas
    VolumeBars.tsx      volume bars
    CandleSeries.tsx    candlesticks
    MovingAverage.tsx   moving-average curves
```

A few things worth knowing if you come to modify it:

- **Every frame is a pure function of `useCurrentFrame()`.** There is no
  `Date.now()`, no `requestAnimationFrame`, no CSS animation and no component
  state driving anything. Renders are deterministic and resumable.
- **All randomness goes through Remotion's `random()` with stable string
  seeds.** `Math.random()` appears nowhere, so the price series and the grid
  values are identical on every render, on every machine.
- **The loop closes by construction.** The plane drifts exactly one tile width
  over 600 frames, the price series is detrended so it wraps, the moving
  averages use cyclic windows, and every reroll and grain seed derives from
  `frame % 600`.
- **The number grid is cached.** Laying out ~700 text cells at 4K every frame
  is far too slow, so the grid lives in an offscreen tile canvas and only the
  cells that actually rerolled (plus the ones whose 3-frame flash just expired)
  are redrawn. The tile is then blitted onto the tilted plane three times.
- **Layer order is a config value, not a hardcoded order.** `layerOrder` in
  `variants.ts` decides whether the chart draws over the number grid or behind
  it. That single branch is what makes the two boards read as different pieces
  rather than one recolour.

## Map data

Land polygons come from **Natural Earth**, 1:110m scale, "Admin 0 – Countries",
as redistributed by the [world-atlas](https://github.com/topojson/world-atlas)
project. The file is bundled at `public/countries-110m.json`.

Natural Earth is released into the **public domain**: "All versions of Natural
Earth raster and vector map data found on this website are in the public
domain. You may use the maps in any manner, including modifying the content and
design, electronic dissemination, and offset printing."
See <https://www.naturalearthdata.com/about/terms-of-use/>.

Antarctica is omitted — on an equirectangular projection it is a solid band
across the bottom of the frame and reads as a subject rather than as texture.

## Type

Inter, loaded through `@remotion/google-fonts` and gated with
`delayRender()` / `continueRender()` so no frame is ever captured with a
fallback face substituted in. Inter's lining figures share a single advance
width; proportional figures would make the whole grid shimmer sideways every
time a value changed.

## Notes

No real ticker symbols, no real index names, no watermark, no audio. Every
number on the board is generated.
