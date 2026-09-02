# remotion-lib — CATALOG

Shared building blocks for Remotion canvas pieces. Everything here is:

- **deterministic** — a pure function of a frame number and a stable string
  seed. No `Math.random()`, no `Date.now()`, no `requestAnimationFrame`, no
  component state. Remotion renders frames out of order across workers, so
  anything else flickers.
- **palette-agnostic** — every colour is a parameter. No hex literals.
- **fully parameterised** — no subject-specific constants baked in.

Import from `remotion-lib/src` (or the vendored copy a project syncs in).

---

## `random.ts` — seeded random helpers

Thin, typed wrappers over Remotion's `random()`.

| Export | Signature | Notes |
| --- | --- | --- |
| `rand` | `(seed: string) => number` | One draw in `[0, 1)`. |
| `randRange` | `(seed, min, max) => number` | Draw in `[min, max)`. |
| `randInt` | `(seed, min, max) => number` | Integer in `[min, max]`. |
| `randChance` | `(seed, p) => boolean` | True with probability `p`. |
| `randPick` | `(seed, items) => T` | Uniform pick from a list. |
| `seededSequence` | `(prefix: string) => { next, range, bell, count }` | Endless stream from one prefix, for when the number of draws isn't known up front. |

```ts
const rng = seededSequence("cloud-icon/particles");
const x = rng.range(0, width);
const wobble = rng.bell(); // roughly normal in [-1, 1]
```

**Gotcha:** `seededSequence` is stateful *within a single call site*. Build it
inside the `useMemo` that consumes it — never share one instance across
components, or their draws will interleave differently on re-render.

**First used by:** cloud-icon.

---

## `particleFromMask.ts` — edge-weighted rejection sampler

Rasterises any drawn silhouette, builds a chamfer distance field over it, and
rejection-samples particle positions with an acceptance probability that falls
off from the boundary inward. Dense along the edge, sparse through the middle —
which is what makes a particle-built shape legible instead of a blob.

### `buildMaskField({ width, height, downscale?, draw })`

| Parameter | Default | Notes |
| --- | --- | --- |
| `width`, `height` | — | Source-space dimensions. |
| `downscale` | `4` | Mask grid is source size / this. 4 is plenty for a density falloff. |
| `draw` | — | `(ctx) => void`. The ctx is **pre-scaled**, so draw in source-space coordinates. |

Returns `{ isInside, insideDistance, outsideDistance, maxInsideDistance, bounds, ... }`,
all in source-space pixels.

### `particlesFromMask({ field, count, outsideFraction?, edgeFalloff?, interiorFloor?, outsideBand?, seed })`

| Parameter | Default | Notes |
| --- | --- | --- |
| `count` | — | Total particles returned, inside + outside. |
| `outsideFraction` | `0` | Share placed beyond the silhouette, drifting free. |
| `edgeFalloff` | `100` | Source-space distance over which interior density decays. Smaller = tighter edge band. |
| `interiorFloor` | `0.05` | Acceptance deep inside, so the middle is sparse rather than empty. |
| `outsideBand` | `180` | How far beyond the edge outliers may land. |
| `seed` | — | Same seed always returns the same particle set. |

Each particle carries `{ x, y, edgeDistance, depth, outside }`, where `depth`
is 0 at the edge and 1 at the deepest interior point.

```ts
const field = buildMaskField({ width, height, downscale: 4, draw: drawSilhouette });
const points = particlesFromMask({
  field, count: 2200, outsideFraction: 0.04,
  edgeFalloff: 62, interiorFloor: 0.028, seed: "cloud-icon/particles",
});
```

**Gotchas:**
- Sample **once**, in `useMemo`. Resampling per frame makes the shape boil.
- `depth` is compressed by design — with edge weighting, most particles land in
  a narrow band of depths. If you want an edge-first assembly wave, sort by
  `depth` and drive the delay off the particle's **rank**, not its raw `depth`;
  a raw-depth delay launches nearly everything at once.
- `buildMaskField` throws on an empty silhouette rather than returning a
  degenerate field.

**First used by:** cloud-icon.

---

## `brokenArcRing.ts` — irregular segmented ring geometry

Angles for a ring of arc segments with unequal lengths and unequal gaps. Equal
segments read as a dial or a loading spinner; this doesn't.

| Parameter | Default | Notes |
| --- | --- | --- |
| `count` | — | Number of segments. |
| `seed` | — | Stable string seed. |
| `lengthJitter` | `0.55` | Segment length variation, as a multiple of the mean. |
| `gapJitter` | `0.7` | Gap size variation. |
| `gapShare` | `0.3` | Share of the circle given over to gaps. |
| `longIndices` | `[]` | Indices promoted to long segments. Two opposite indices give the ring an axis. |
| `longFactor` | `2.6` | How much longer a promoted segment is. |

Returns `{ index, start, length, long }[]` in radians, summing to exactly 2π
including gaps. Apply rotation at draw time — the geometry itself is static.

```ts
const segments = brokenArcRing({
  count: 14, seed: "ring", longIndices: [0, 7],
  longFactor: 3.4, lengthJitter: 0.45,
});
for (const s of segments) {
  ctx.arc(cx, cy, r, s.start + rotation, s.start + s.length + rotation);
}
```

**Gotchas:**
- `start` is the *un-rotated* angle. Adding rotation inside the generator would
  make it frame-dependent and force a per-frame rebuild.
- `longFactor` and `lengthJitter` interact, and the defaults are weak: a
  promoted segment's jitter is applied *before* the factor, so an unlucky one
  can come out barely longer than a lucky ordinary segment and stop reading as
  a long arc at all. At the defaults (`2.6` / `0.55`) cloud-icon's two promoted
  segments landed at 45.3° and 27.4° against a longest ordinary of 21.1° — the
  second one vanished into the crowd. `3.4` / `0.45` gave 52.9° and 35.1°
  against 18.3°. **Print the sorted lengths for your seed rather than trusting
  the defaults.**
- `longIndices` opposite in *index* space are only approximately opposite in
  *angle*, because lengths are unequal. `[0, 7]` of 14 lands within a couple of
  degrees of 180° in practice, but check if it matters to you.

**First used by:** cloud-icon.

---

## `drawOn.ts` — polyline draw-on

| Export | Signature |
| --- | --- |
| `cumulativeLengths` | `(points) => number[]` |
| `strokePolylineTo` | `(ctx, points, progress, cumulative?) => void` |
| `vertexProgress` | `(cumulative, index) => number` |

Strokes a path revealed to `progress` (0–1) of its length. Pure — no internal
state, so frames render identically in any order.

**Gotcha:** pass the precomputed `cumulative` array when animating, or you pay
a full length pass every frame for every path.

**First used by:** cloud-icon.

---

## `circuitTraces.ts` — right-angle trace generator

Orthogonal polylines with pads at some vertices and short stub terminations.
Right angles are guaranteed *by construction* — the walk alternates axis, so no
code path can emit a diagonal. Run lengths and turn positions are irregular
multiples of a coarse grid; a regular walk reads as a printed pattern.

Geometry only — no colours, no drawing.

| Parameter | Default | Notes |
| --- | --- | --- |
| `width`, `height`, `count`, `gridSize`, `seed` | — | Required. |
| `minTurns` / `maxTurns` | `3` / `9` | Segments per trace. |
| `maxRun` | `6` | Longest single run, in grid cells. |
| `padChance` | `0.3` | Probability a vertex carries a pad. |
| `stubChance` | `0.55` | Probability of a stub termination. |
| `reverseChance` | `0.35` | Low values make traces travel across frame; high values make them curl up. |

Returns `{ index, points, cumulative, totalLength, padIndices, brightness }[]`.

**First used by:** cloud-icon.

---

## `<CircuitBackdrop>` — drawn-on circuit field

The generator above, wired into a self-contained canvas layer: traces stroke on
over a configurable window several at a time, then the finished field is
blitted from a pre-rendered offscreen canvas and only the pads redraw and blink.

| Prop | Default | Notes |
| --- | --- | --- |
| `frame`, `width`, `height`, `seed` | — | Required. |
| `dimColor`, `brightColor` | — | Required. The only two colours it uses. |
| `count` | `120` | Traces across the frame. |
| `gridSize` | `96` | Coarse grid. |
| `minTurns` / `maxTurns` | `3` / `9` | |
| `lineWidth` | `3` | |
| `padSize` | `15` | |
| `padChance` | `0.26` | |
| `stubChance` | `0.55` | |
| `drawOnStart` / `drawOnEnd` | `0` / `40` | Draw-on window, in frames. |
| `minDrawFrames` / `maxDrawFrames` | `12` / `20` | Per-trace stroke duration. |
| `padBlinkPeriodMin` / `Max` | `90` / `240` | |
| `padBaseAlpha` / `padBlinkAlpha` | `0.22` / `0.6` | |
| `style` | — | You control layering and opacity. |

```tsx
<CircuitBackdrop
  frame={frame}
  width={3840}
  height={2160}
  dimColor={theme.circuitDim}
  brightColor={theme.circuitBright}
  seed="cloud-icon/circuit"
  count={120}
  gridSize={96}
  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.6 }}
/>
```

**Gotchas:**
- Sizes are in **canvas backing-store pixels**, not CSS pixels. At 4K,
  `lineWidth: 3` is a hairline; at 1080p it is not.
- Hold the overall opacity low (~0.6) if this is meant to sit *under* a
  subject. At full strength the field competes with the foreground.
- The static field is cached per `(traces, size, colours)`. Animating either
  colour defeats the cache and re-renders the whole field every frame.

**First used by:** cloud-icon.

---

## `<StarField>` — sparse twinkling points

| Prop | Default |
| --- | --- |
| `frame`, `width`, `height`, `color`, `seed` | — |
| `count` | `460` |
| `minRadius` / `maxRadius` | `1.2` / `3.4` |
| `brightnessBias` | `2.4` (higher pushes more stars dim) |
| `minAlpha` / `maxAlpha` | `0.12` / `0.9` |
| `twinklePeriodMin` / `Max` | `110` / `290` |
| `twinkleDepth` | `0.28` |
| `style` | — |

**Gotcha:** radii are backing-store pixels; a `minRadius` under ~1 disappears
entirely once the output is downscaled.

**First used by:** cloud-icon.

---

## `postFx.ts` — bloom, vignette, grain, colour maths

### `bloomPass(canvas, ctx, { downscale?, layers, scratch })`

Additive bloom over a whole layer canvas. Intended for a layer holding **only**
emissive content on transparency — the layer's own alpha then acts as the
brightness threshold, so no per-pixel extraction is needed. The blur runs on a
downscaled scratch buffer: far cheaper than blurring at 4K, and smoother.

| Parameter | Default | Notes |
| --- | --- | --- |
| `downscale` | `4` | Scratch buffer is canvas size / this. |
| `layers` | — | `{ blurPx, alpha }[]`. `blurPx` is in **full-resolution** pixels. Stack a tight core under a wide halo. |
| `scratch` | — | Reusable offscreen canvas — use `useScratchCanvas()` so frames don't each allocate one. |

```ts
bloomPass(canvas, ctx, {
  scratch,
  layers: [{ blurPx: 18, alpha: 0.95 }, { blurPx: 72, alpha: 0.58 }],
});
```

### `vignettePass(ctx, { width, height, color, strength, innerStop? })`

`strength` is peak ink opacity at the frame edge; `innerStop` (default `0.45`)
is the fraction of the radius at which darkening begins.

### `buildGrainTiles({ size, count, light, dark, seed })` + `grainPass(ctx, { width, height, tiles, frame, alpha, seed })`

Full-frame per-frame noise is prohibitive at 4K. Build a handful of tiles once
(`useMemo`) and cycle them, offset per frame; indistinguishable from true
per-frame noise at the alphas grain is actually used at.

### Colour helpers

`hexToRgb(hex)`, `withAlpha(hex, a)`, `mixColors(a, b, t, alpha?)` — all return
canvas-ready `rgba()` strings from `#rrggbb` input.

**Gotchas:**
- `bloomPass` composites with `lighter`. Run it **last** on its layer; anything
  drawn after it will not glow.
- Call it on a layer holding only what should glow. On a layer with an opaque
  background, the background blooms too and the layer just goes milky.
- `buildGrainTiles` at `size: 1024, count: 6` holds ~25 MB. Don't rebuild per
  frame, and don't raise the count without reason.

**First used by:** cloud-icon.

---

## `canvas.ts` — canvas plumbing

| Export | Notes |
| --- | --- |
| `useCanvasDraw(width, height, draw)` | Returns a ref for a `<canvas>`; runs `draw` exactly once per React render — i.e. once per Remotion frame. Backing store is fixed at `width × height` regardless of CSS size, so `--scale` changes output resolution without changing what is drawn. Clears and resets the transform before each call. |
| `useScratchCanvas()` | A lazily-created offscreen canvas that persists across frames. |
| `layerStyle(zIndex, opacity?)` | Full-bleed absolutely-positioned layer style. |

**Gotchas:**
- `useCanvasDraw` deliberately has **no dependency array** — it must run on
  every render. The draw callback is held in a ref, so you can close over the
  current frame freely without stale-closure worries.
- No `requestAnimationFrame` anywhere. It paints in a layout effect, before the
  browser paints, which is what makes `remotion render` deterministic.

**First used by:** cloud-icon.
