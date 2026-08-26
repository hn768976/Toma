# Country Data Curve — 4K Remotion animations

Three variants of the same one-shot scene: a country silhouette on a tilted
grid plane with an exponential growth curve climbing across it, cumulative
counters, drifting particles and a depth-of-field falloff toward the frame
edges. Everything is drawn to a single `<canvas>` as a pure function of
`useCurrentFrame()`, so renders are deterministic.

## Compositions

| Composition id   | Variant | Dominant colour        | Resolution  | Duration          | FPS |
| ---------------- | ------- | ---------------------- | ----------- | ----------------- | --- |
| `DataCurveUK`    | `uk`    | deep navy `#0A1F4A`    | 3840 × 2160 | 474 frames / 15.8s | 30  |
| `DataCurveUSA`   | `usa`   | teal-navy `#052E42`    | 3840 × 2160 | 474 frames / 15.8s | 30  |
| `DataCurveChina` | `china` | royal blue `#103A7A`   | 3840 × 2160 | 474 frames / 15.8s | 30  |

All three render independently from this one project. No audio, no logos, no
loop — frames 0 and 474 differ by design.

## Render

```bash
npm install

npx remotion render DataCurveUK    out/data-curve-uk.mp4    --codec=h264 --crf=12
npx remotion render DataCurveUSA   out/data-curve-usa.mp4   --codec=h264 --crf=12
npx remotion render DataCurveChina out/data-curve-china.mp4 --codec=h264 --crf=12
```

Half-scale preview:

```bash
npx remotion render DataCurveUK out/data-curve-uk-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

`--scale` only affects the encoded output — the canvas backing store is always
3840 × 2160, so a preview costs the same wall clock as a full render.
`--concurrency=8` needs at least 8 CPU cores; lower it to your core count
otherwise.

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

### Adding a fourth country

Add an entry to `VARIANTS` in `src/variants.ts` and a `<Composition>` in
`src/Root.tsx`. Nothing else changes: no hex literal, no country name and no
SVG path string appears anywhere outside `variants.ts`.

### Silhouette data

The three paths were generated from Natural Earth 1:50m country boundaries
(`world-atlas`) by `scripts/gen-paths.mjs`: outer rings only, Douglas–Peucker
simplified, Mercator-projected and fitted into a shared 1000 × 1000 viewBox so
the three swap cleanly. UK is Great Britain plus Ireland plus the Scottish
islands; USA is the contiguous states only; China includes Hainan.

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
