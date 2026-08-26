# Country Data Curve — 4K Remotion animations

Six variants of the same one-shot scene: a country silhouette on a tilted
grid plane with an exponential growth curve climbing across it, cumulative
counters, drifting particles and a depth-of-field falloff toward the frame
edges. Everything is drawn to a single `<canvas>` as a pure function of
`useCurrentFrame()`, so renders are deterministic.

## Compositions

| Composition id     | Variant   | Palette              | Silhouette                       |
| ------------------ | --------- | -------------------- | -------------------------------- |
| `DataCurveUK`      | `uk`      | deep navy `#0A1F4A`  | GB + Ireland + Scottish islands  |
| `DataCurveUSA`     | `usa`     | teal cyan `#052E42`  | contiguous states                |
| `DataCurveChina`   | `china`   | royal blue `#103A7A` | mainland + Hainan                |
| `DataCurveSpain`   | `spain`   | deep navy `#0A1F4A`  | mainland + Balearics             |
| `DataCurveFrance`  | `france`  | teal cyan `#052E42`  | mainland + Corsica               |
| `DataCurveGermany` | `germany` | royal blue `#103A7A` | mainland                         |

All six are 3840 × 2160, 474 frames at 30fps (15.8s).

The three palettes are shared: each is defined once as `PALETTES.deepNavy`,
`PALETTES.tealCyan` or `PALETTES.royalBlue` and used by two variants, so a
colour tweak lands on both. Every country still gets its own silhouette, curve
shape and number ranges — no two curves in the set follow the same path.

All six render independently from this one project. No audio, no logos, no
loop — frames 0 and 474 differ by design.

## Render

```bash
npm install

npx remotion render DataCurveUK      out/data-curve-uk.mp4      --codec=h264 --crf=12
npx remotion render DataCurveUSA     out/data-curve-usa.mp4     --codec=h264 --crf=12
npx remotion render DataCurveChina   out/data-curve-china.mp4   --codec=h264 --crf=12
npx remotion render DataCurveSpain   out/data-curve-spain.mp4   --codec=h264 --crf=12
npx remotion render DataCurveFrance  out/data-curve-france.mp4  --codec=h264 --crf=12
npx remotion render DataCurveGermany out/data-curve-germany.mp4 --codec=h264 --crf=12
```

1080p (half scale) — add `--scale=0.5` to any of the above:

```bash
npx remotion render DataCurveUK out/data-curve-uk-1080p.mp4 --codec=h264 --crf=18 --scale=0.5
```

A single frame:

```bash
npx remotion still DataCurveSpain out/spain.png --frame=380
```

`--scale` only affects the encoded output — the canvas backing store is always
3840 × 2160, so a 1080p render costs the same wall clock as a 4K one (about 23
minutes per variant on 4 cores). Add `--concurrency=N` to match your core
count; Remotion rejects a value above it.

`npm start` opens Remotion Studio. `npm run typecheck` runs `tsc --noEmit`.

## Layout

```
src/
  Root.tsx              the three <Composition> registrations
  DataCurve.tsx         the composition component: buffers, compositing, finish
  variants.ts           VARIANTS — palettes, labels, silhouette paths, curves, ranges
  config.ts             CONFIG — every number likely to be nudged by eye
  scene.ts              camera, easing, curve geometry and node placement
  plane.ts              affine plane maths, offscreen canvas + colour helpers
  text.ts               hand-rolled tabular figures for canvas
  layers/
    GridPlane.ts        the grid floor (baked once)
    CountryShape.ts     silhouette fill + diagonal hatching (baked once)
    DataCurveLayer.ts   the curve, node markers and value labels
    CounterStack.ts     the counter column and the country name slab
    ChartCards.ts       background data panels (baked once each)
    ParticleField.ts    drifting cyan / white / amber dots
    finish.ts           background wash, vignette, film grain
scripts/gen-paths.mjs   regenerates the silhouette path data (see below)
public/fonts/           Roboto, latin subset (Apache-2.0)
```

### Adding another country

Add an entry to `VARIANTS` in `src/variants.ts` — pointing `palette` at one of
the three `PALETTES`, or defining a fourth — and a `<Composition>` in
`src/Root.tsx`. Nothing else changes: no hex literal, no country name and no
SVG path string appears anywhere outside `variants.ts`.

### Silhouette data

The six paths were generated from Natural Earth 1:50m country boundaries
(`world-atlas`) by `scripts/gen-paths.mjs`: outer rings only, Douglas–Peucker
simplified, Mercator-projected and fitted into a shared 1000 × 1000 viewBox so
they all swap cleanly. UK is Great Britain plus Ireland plus the Scottish
islands; USA is the contiguous states only; China includes Hainan; Spain keeps
the Balearics but drops the Canaries; France keeps Corsica but drops the
overseas departments — those sit thousands of kilometres away and would
collapse the silhouette to a speck inside its own bounding box.

```bash
node scripts/gen-paths.mjs   # rewrites scripts/paths.json, then paste into VARIANTS
```

## How it is put together

**One plane.** `plane.ts` composes a single affine transform — rotate −12°,
horizontal shear, ~8% x squeeze — anchored on the silhouette's centre so the
camera push-in scales about the country. Grid, silhouette, curve, cards,
counters and particles all inherit it. Parallel lines stay parallel: this is
deliberately not a perspective projection.

**Depth of field.** Three offscreen buffers — far, mid, sharp — bucket elements
by depth. Far and mid render at half scale and are each blurred exactly once on
the way back up (26px and 15px equivalent at 4K); sharp renders at full scale
and is not blurred. A final pass lays a heavily blurred, elliptically masked
copy of the composite back over itself so focus falls away toward every edge.
Per-element blurring at 4K would be unusably slow.

**Baked layers.** The grid, the hatched silhouette and every chart card are
drawn once into offscreen canvases in a `useMemo` and blitted each frame. The
hatching alone is several hundred strokes and never changes.

**Determinism.** All motion comes from the frame number; all variation comes
from Remotion's `random()` with stable string seeds. The film grain fills its
tiles with a small PRNG that is itself seeded from `random()`, since seeding
half a million pixels one call at a time is needlessly slow. No `Date.now()`,
no `requestAnimationFrame`, no CSS animation, no component state.

**Tabular figures.** Canvas 2D has no `font-feature-settings`, so `text.ts`
draws each digit centred in a fixed-width cell. The counters reroll every frame
and never jitter.

## Environment notes

Two accommodations for the machine this was built on; both are inert elsewhere:

- `remotion.config.ts` honours `REMOTION_BROWSER_EXECUTABLE` and points Remotion
  at an already-installed Chromium. Unset it and Remotion downloads its own
  Chrome Headless Shell as usual.
- Roboto is bundled in `public/fonts` and loaded through the `FontFace` API,
  gated with `delayRender()` / `continueRender()`, rather than fetched from
  Google Fonts at render time. Renders therefore need no network access.
