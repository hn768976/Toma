# Dotted world map

Three 4K variants of a dotted world map, built in Remotion on 2D canvas only —
no 3D and no Three.js. Each is 3840 × 2160, 600 frames at 30fps (20.0 seconds),
and loops seamlessly.

| Composition | Motion mode | What it does |
| --- | --- | --- |
| `DotMapNavy` | `ambient` | The map at rest and merely alive: every dot breathes on its own seeded sine, roughly eight dots a second flash brighter, and the whole map drifts on a slow closed path. Nothing sweeps and nothing propagates. |
| `DotMapGreen` | `sweep` | A thin bright line crosses the frame top to bottom three times. Dots brighten sharply as it reaches them and decay over 25 frames, leaving a fading trail. A small readout counts each pass from 00% to 99%. |
| `DotMapAmber` | `hotspot` | Eight regions activate in turn, each lighting from its centre outward; two or three overlap at any moment, and arcs bow between the regions that are lit together. |

## Running it

```bash
npm install
npx remotion studio
```

## Rendering

1080p preview:

```bash
npx remotion render DotMapNavy  out/dotmap-navy-preview.mp4  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render DotMapGreen out/dotmap-green-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render DotMapAmber out/dotmap-amber-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

Full 4K:

```bash
npx remotion render DotMapNavy out/dotmap-navy.mp4 --codec=h264 --crf=12 --concurrency=8
```

`--concurrency` cannot exceed the machine's CPU core count; lower it if a
render refuses to start.

## Packaging

```bash
node tools/package.mjs
```

Writes `dist/dot-map-{navy,green,amber}.zip`, each a self-contained Remotion
project holding a single composition with its own variant data inlined —
no shared three-key config, and none of the other variants' colours or
settings. Each is type-checked before it is zipped. `node_modules/`, `out/` and
`.git/` are excluded.

## The map data

`public/countries-110m.json` is the Natural Earth 1:110m Admin 0 countries
dataset in TopoJSON form, taken from the
[world-atlas](https://github.com/topojson/world-atlas) package (kept as a
devDependency purely to record where the file came from — nothing imports it at
runtime).

**Natural Earth is in the public domain: no attribution is required and no
permission is needed to use it for any purpose**, commercial work included. See
[naturalearthdata.com/about/terms-of-use](https://www.naturalearthdata.com/about/terms-of-use/).

At load time the country polygons are merged into one land geometry with their
internal borders dissolved, and Antarctica is dropped — it adds a heavy band
along the bottom of the frame and unbalances the composition.

## How the dots are made

The land is projected with d3-geo's equirectangular projection, fitted edge to
edge across the frame with a small bleed so the drift never exposes a border,
and rasterised once into an offscreen mask. A 13px grid of screen positions is
then tested against that mask — rasterise-and-sample rather than a
point-in-polygon test per position, which is both far faster and handles the
antimeridian correctly. Positions that land on land become dots: 10,699 of them
out of 51,300 candidates.

Each dot is a 7px square, leaving a visible gap at the 13px pitch; squares
rather than circles, because the slight hardness reads as a display matrix
rather than as a stipple. Brightness varies per dot from a seeded draw — most
mid, a scattering bright, some dim. Dots with fewer than 6 land neighbours in
the grid are treated as coastal and drawn brighter still; that edge emphasis is
what makes the continents legible at a glance.

The dot set is built **once** per render worker and reused for every frame.
Re-projecting per frame would make the map boil.

## Determinism and the loop

Every value in the animation is a pure function of `useCurrentFrame()`, and
every random value comes from Remotion's seeded `random()` with a stable string
seed. There is no `Date.now()`, no `requestAnimationFrame`, no CSS animation and
no component state, so `npx remotion render` is deterministic — the same frame
always produces the same pixels, and the dot set is identical on every run.

The loop period is `LOOP_FRAMES` in `src/constants.ts`, deliberately separate
from a composition's `durationInFrames` so the loop point can be rendered and
compared against frame 0 without changing what is being tested. Every
oscillation period, sweep pass and hotspot cycle divides it. All three variants
were checked by temporarily registering a 601-frame composition and confirming
that the PNG of frame 600 is byte-identical to the PNG of frame 0.

## Performance

The static dot field is baked to an offscreen canvas once and blitted at the
drift offset each frame; only the per-frame brightness modulation is drawn on
top. That modulation batches squares into one `Path2D` per (colour, quantised
alpha) pair, so a full field costs a few dozen `fill()` calls instead of tens of
thousands of `fillRect()` calls. The faint full-frame background grid is baked
the same way, and the bloom is built in a quarter-scale buffer and blurred there
rather than at 4K.

## Layout

```
src/
  Root.tsx                     registers the three compositions
  DotMap.tsx                   stacks the canvas layers, branching on motion mode
  variants.ts                  THE config: every colour, every motion parameter
  constants.ts                 loop length, frame rate, frame size
  components/
    BackgroundWash.tsx         base gradient, radial wash, full-frame grid
    DotGrid.tsx                the land dots and their per-frame modulation
    SweepLine.tsx              the scan line, its glow and the readout
    HotspotLayer.tsx           the arcs between simultaneously lit regions
    GrainVignette.tsx          vignette and film grain
  lib/
    dots.ts                    builds the dot set from the map data
    motion.ts                  every per-frame value, all loop-closed
    regions.ts                 which dots belong to which region
    canvas.ts                  batched square drawing
    color.ts                   hex parsing and mixing
    useDotField.ts             loads the map and builds the field once
tools/
  package.mjs                  builds the three standalone project zips
public/
  countries-110m.json          Natural Earth 110m, public domain
```

`src/variants.ts` is the single source of truth. The motion mode is a value in
it — `"ambient" | "sweep" | "hotspot"` — not a baseline that the other versions
patch, so a new variant is a new key and nothing more.
