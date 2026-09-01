# CATALOG

Every component in `remotion-lib`. Written for someone with no memory of
the conversation that produced it.

**How to use this file:** scan the index. If the thing you need is in it,
jump to its section. If it is not, it does not exist here — build it in
your project, and only promote it once a second project needs it.

**Provenance codes** — how much to trust the defaults:

- **E** *Extracted* — lifted from real project code that existed and worked.
- **A** *Adapted* — a real implementation existed; reworked for purity or parameterisation.
- **S** *Spec* — written from a description of the technique. Correct as
  written and demonstrated working, but defaults are **reasoned, not
  measured**. See README.md § Provenance.

There is exactly one **E**. Do not read this library as a distillation of
20 projects — it is not, and pretending otherwise would mislead you into
trusting numbers nobody has validated.

---

## Index

| Component | Module | Does | Prov |
|---|---|---|---|
| [`makeRng` / `seededRandom`](#seededrandom) | `random` | Deterministic PRNG, addressed by (index, salt) | **E** |
| [`loopPhase`](#loopphase) | `random` | Frame → 0..1 position in a repeating cycle | **E** |
| [`radialPlaces`](#radialplaces) | `random` | N items around a point, angle **and** radius jitter | **S** |
| [`irregularDashes`](#irregulardashes) | `random` | Dash arrays with varied length and gap | **S** |
| [`equirectangular` / `mercator`](#projections) | `geo` | lon/lat → pixels, no d3 dependency | **S** |
| [`dotMapFromLand`](#dotmapfromland) | `geo` | Grid-sample land polygons into dots, coastal flag | **S** |
| [`threeBufferDOF`](#threebufferdof) | `effects` | Depth of field via 3 buffers, not per-element blur | **S** |
| [`bloomPass`](#bloompass) | `effects` | Additive glow from a blurred copy | **A** |
| [`vignettePass`](#vignettepass) | `effects` | Radial edge darkening | **A** |
| [`grainPass`](#grainpass) | `effects` | Tiled seeded film grain | **S** |
| [`lowResUpscale`](#lowresupscale) | `effects` | Compute a soft layer at 1/N and scale up | **S** |
| [`NeonStroke`](#neonstroke) | `strokes` | The four-pass neon construction | **S** |
| [`taperedStroke`](#taperedstroke) | `strokes` | Width and alpha falloff along a path | **S** |
| [`drawOn`](#drawon) | `strokes` | Reveal a path as if drawn | **A** |
| [`strokeFor`](#strokefor) | `strokes` | Counter-scale stroke width under a transform | **S** |
| [`midpointDisplacement`](#midpointdisplacement) | `generators` | Recursive branching — lightning, roots, cracks | **S** |
| [`trendingWalk`](#trendingwalk) | `generators` | Random walk with runs, for price series | **S** |
| [`noiseField`](#noisefield) | `generators` | Layered noise with a loop-closing mode | **S** |
| [`particleFromMask`](#particlefrommask) | `generators` | Rejection-sample particles inside a silhouette | **S** |
| [`blobPath`](#blobpath) | `shapes` | Irregular closed organic shape | **S** |
| [`tornEdge`](#tornedge) | `shapes` | Paper tear at two noise scales, with fibres | **S** |
| [`roundedPill` / `brokenArcRing` / `tickRing`](#rings) | `shapes` | HUD and badge path builders | **A** |

---

## random

### seededRandom

`remotion-lib/src/random` · **Provenance E** — `remotion-video/src/particle-ring/random.ts` (mulberry32 + the index/salt scheme, verbatim). `seededGaussian` is its `gaussianish` from `particles.ts`.

Deterministic pseudo-randomness so a particle's identity is a pure function of its index, not of render order.

| Export | Signature | Notes |
|---|---|---|
| `makeRng` | `(seed) => () => number` | A *stream*. For helpers taking many draws in a loop. |
| `seededRandom` | `(index, salt) => number` | A single *addressed* draw, 0..1. |
| `seededRange` | `(index, salt, min, max) => number` | Addressed draw mapped to a range. |
| `seededGaussian` | `(index, salt) => number` | Bell-ish on [-1, 1]. **Consumes salts `salt`, `salt+1`, `salt+2`.** |
| `hashSeed` | `(text) => number` | String → stable integer seed (FNV-1a). |

```ts
const size = 1.1 + seededRandom(i, 20) * 1.7;
const radius = core + seededGaussian(i, 30) * band;   // clusters at core
```

**Gotcha.** Space your salts (10, 20, 30…). Adjacent salts on a shared index sit adjacent in the state space and can visibly correlate — two attributes that should be independent end up moving together. And `seededGaussian` eats three, so leave a gap.

**Gotcha 2.** Never hoist an `Rng` into module scope or a ref. The closure is stateful; its determinism depends on being created fresh per call.

---

### loopPhase

`remotion-lib/src/random` · **Provenance E** — the only helper found genuinely duplicated. Three identical copies across two unrelated builds: `DataPacket.tsx:58`, `RadioWaves.tsx:52`, `ParticleRingHalo.tsx:112`.

Maps a frame onto a 0..1 position in a repeating cycle, with a per-element phase offset.

| Param | Default | Meaning |
|---|---|---|
| `frame` | — | May be negative |
| `period` | — | Frames per cycle, > 0 |
| `phase` | `0` | Offset 0..1; give element `i` phase `i/count` |

Companions: `loopPhases(frame, period, count)` spreads N elements automatically; `fadeInOut(t)` is a 0→1→0 opacity curve; `pingPong(t)` is the smooth version for *position* (a sine peak in position reads as a visible direction change).

```ts
const t = loopPhase(frame, 100, i / count);
const radius = start + t * distance;
const alpha = fadeInOut(t);
```

**Gotcha.** For the *composition* to loop, `period` must divide `durationInFrames` exactly. 200 frames with period 100 loops; with period 90 it jumps at the wrap.

**Why the double modulo:** JS `%` keeps the left operand's sign, so a negative frame — which Remotion passes when a Sequence starts before frame 0 — yields a negative `t` and the element jumps.

---

### radialPlaces

`remotion-lib/src/random` · **Provenance S**. The *pattern* exists twice in `particle-ring/particles.ts` (`generateRingParticles`, `generateHaloParticles`) but was never a named helper; defaults here are reasoned, not taken from those call sites.

Places N items around a point with **both** angular and radial jitter.

| Param | Default | Meaning |
|---|---|---|
| `count`, `center`, `radius`, `seed` | — | required |
| `angleJitter` | `0.6` | In units of the mean angular step. **0 = a rosette.** |
| `radiusJitter` | `0.12` | Fraction of `radius` |
| `radiusDistribution` | `'gaussian'` | `'gaussian'` = soft-edged band; `'uniform'` = filled annulus |
| `startAngle` | `-PI/2` | Top |
| `arcSpan` | `TAU` | Use less for a fan |

Returns `{ x, y, angle, radius, index }[]` — `angle` is kept because callers usually need it again to orient items or drive a per-angle ripple.

```ts
const places = radialPlaces({ count: 40, center, radius: 260, seed: 7 });
```

**Gotcha.** Breaking only one axis does not work: jittering angle alone leaves every item on one crisp circle (reads as a dial); jittering radius alone leaves the spokes. That is why both default non-zero.

**Gotcha 2.** With a full circle and large `angleJitter`, items 0 and count-1 can cross at the wrap. Correct scatter, but if you draw connected segments in index order you get one long chord — sort by angle first.

---

### irregularDashes

`remotion-lib/src/random` · **Provenance S** — no implementation existed in reachable code.

Dash patterns whose length and gap both vary, so a dashed line does not read as a ladder.

| Export | Returns | Use when |
|---|---|---|
| `irregularDashes` | `number[]` for `strokeDasharray` | Normal case. One attribute, any existing path. |
| `irregularDashSegments` | `{start, length, offset, index}[]` | You need **perpendicular wander**, which `strokeDasharray` cannot express. Costs one node per dash. |

| Param | Default |
|---|---|
| `seed` | — |
| `pairs` | `8` |
| `dash` | `12` |
| `gap` | `9` |
| `variance` | `0.45` (0 = even ladder again) |
| `wander` *(segments only)* | `1.5` px |

```ts
<path d={d} strokeDasharray={irregularDashes({ seed: 3 }).join(" ")} />
```

**Gotcha.** An odd-length dash array is silently doubled by the renderer, re-introducing a repeat at twice the period. `irregularDashes` always returns even-length — **do not slice the result.**

---

## geo

### projections

`remotion-lib/src/geo` · **Provenance S** — no map code of any kind existed in reachable projects, and no d3 dependency.

`equirectangular(opts)` and `mercator(opts)` return a `Projection`: `(lon, lat) => [x, y] | null`.

| Param | Default |
|---|---|
| `width`, `height` | — |
| `centerLon` | `0` |
| `scale` | `1` (1 = fit full lon range across width) |

**These are implemented inline so the library has no d3-geo dependency**, behind an interface d3-geo also satisfies. Need Robinson or Natural Earth 1? Pass d3's in and everything downstream is unchanged:

```ts
import { geoNaturalEarth1 } from "d3-geo";
const p = geoNaturalEarth1().fitSize([1920, 1080], land);
dotMapFromLand({ project: (lon, lat) => p([lon, lat]), land, ... });
```

**Gotcha.** Mercator is clamped to ±85.05° (the web-map cutoff), so Antarctica is unusable in it. Use equirectangular for whole-globe shots.

**Deliberately absent: Natural Earth loading.** The library does no I/O and ships no map data. Fetching, caching and simplifying a shapefile depends on whether the data lives in `public/`, is bundled, or comes via `staticFile()`, and on which admin level and resolution the shot needs — a loader written against guesses about all three is exactly the hardcoded-assumption case. Pass GeoJSON in.

---

### dotMapFromLand

`remotion-lib/src/geo` · **Provenance S**

Samples a lon/lat grid against land polygons, projects the hits, flags the ones adjacent to water.

| Param | Default | Meaning |
|---|---|---|
| `land` | — | GeoJSON Polygon / MultiPolygon / Feature / FeatureCollection |
| `project` | — | From `projections` above, or d3-geo |
| `stepDeg` | `1.2` | ~150 dots across at the equator — the density that reads at 1080p |
| `lonRange` | `[-180, 180]` | |
| `latRange` | `[-56, 84]` | Drops Antarctica and the empty far north |
| `jitter` | `0` | Fraction of a step. ~0.25 breaks grid moiré; >0.5 stops reading as a matrix |
| `seed` | `1` | Only used when `jitter > 0` |

Returns `{ x, y, lon, lat, coastal }[]`.

```ts
const dots = useMemo(() => dotMapFromLand({ land, project }), [land, project]);
dots.map((d) => <circle cx={d.x} cy={d.y} r={d.coastal ? 3 : 2}
                        fill={d.coastal ? coastColor : landColor} />);
```

**Gotcha — the important one.** This is O(gridCells × polygonEdges). A 1.2° grid against full-resolution Natural Earth is ~35k cells against ~200k edges. **Call it once, in a `useMemo`.** Never per frame. If still slow, simplify the polygons first (mapshaper) — dot maps do not need 10m resolution.

**Why `coastal` is computed here, not by you later:** adjacency is one cheap extra pass while the occupancy grid still exists, and an expensive spatial query per dot once it does not.

---

## effects

All five take a `CanvasRenderingContext2D` and **restore every property they touch** (alpha, filter, composite op, smoothing), so they compose in any order.

Conventional order per frame: `lowResUpscale` → `threeBufferDOF` → `bloomPass` → `vignettePass` → `grainPass`.

### threeBufferDOF

`remotion-lib/src/effects` · **Provenance S** — `ParticleRingHalo` has a *two*-layer glow, which is a different technique (bloom, not depth). No depth-bucketed implementation existed.

Buckets elements far/mid/near, draws each into its own buffer, blurs each **once**, composites back to front.

| Param | Default |
|---|---|
| `ctx`, `width`, `height` | — |
| `far`, `mid`, `near` | — (`(ctx) => void` draw callbacks) |
| `farBlur` | `12` |
| `midBlur` | `4` |
| `nearBlur` | `0` |
| `compositeOp` | `"source-over"` (use `"lighter"` for glowing elements) |
| `createCanvas` | `document.createElement` (injectable) |

Companions: `bucketByDepth(items, getDepth, thresholds = [0.33, 0.66])` splits a list; `depthBuffers({ layers })` is the general N-layer form.

```ts
const { far, mid, near } = bucketByDepth(particles, (p) => p.z);
threeBufferDOF({ ctx, width, height, compositeOp: "lighter",
  far: (c) => far.forEach((p) => dot(c, p)), mid: ..., near: ... });
```

**Gotcha.** Blur radii are **device pixels** and do not survive a resolution change — multiply by your resolution scale, exactly as you would a stroke width.

**Gotcha 2.** Buffers composite far → mid → near; later paints over earlier. Within a bucket, order is whatever your callback draws.

**Why three:** two reads as a cutout (a sharp plane and a soft plane, nothing between); four+ costs another full-canvas blur for a difference nobody sees, because adjacent radii are already within a couple of pixels.

---

### bloomPass

`remotion-lib/src/effects` · **Provenance A** — the blur-copy-under-sharp-copy stack is `ParticleRingHalo.tsx:158-170`, there done with two stacked `<canvas>` elements and CSS `mixBlendMode`. Reworked into a single ctx pass; `threshold` is new.

| Param | Default |
|---|---|
| `ctx`, `width`, `height`, `draw` | — |
| `blurPx` | `19` (matches the source project's `BASE_BLUR_PX`) |
| `strength` | `0.85` (matches its glow-layer opacity) |
| `blendMode` | `"lighter"` |
| `drawSharp` | `true` |
| `threshold` | `0` |

```ts
bloomPass({ ctx, width, height, blurPx: 19,
            draw: (c) => particles.forEach((p) => dot(c, p)) });
```

**Gotcha.** `threshold > 0` triggers a full-frame `ImageData` pass — ~8.3M pixel reads at 4K. Prefer restructuring so only emissive things go through `bloomPass` at all. `threshold: 0` is right for additive particle art on a dark ground; on a *bright* scene 0 blooms the whole image into mush and you want ~0.6.

**Gotcha 2.** `blurPx` is device pixels — scale it with resolution.

**Why additive, not a soft shadow:** where two glows overlap they must *sum* toward white, which is what light does. Alpha compositing keeps overlaps the same brightness, and the result looks flat and slightly dirty.

---

### vignettePass

`remotion-lib/src/effects` · **Provenance A** — `ParticleRingHalo.tsx:173` does this as a CSS `radial-gradient` overlay with a hardcoded colour. Reworked to canvas with colour required.

| Param | Default |
|---|---|
| `ctx`, `width`, `height` | — |
| `color` | **required** — no default |
| `innerStop` | `0.45` |
| `outerStop` | `1` |
| `shape` | `"ellipse"` |
| `center` | frame centre |
| `blendMode` | `"source-over"` (`"multiply"` keeps saturation better on bright footage) |

```ts
vignettePass({ ctx, width, height, color: "rgba(2,3,8,0.55)" });
```

**`color` is deliberately required.** A vignette hardcoded to black fights every palette that is not black-grounded, and the alpha in your colour string *is* the strength control.

**Gotcha.** Apply before grain, after everything else. A vignette drawn over grain flattens the grain it covers, making the corners look cleaner than the centre — backwards from real optics.

---

### grainPass

`remotion-lib/src/effects` · **Provenance S**

| Param | Default |
|---|---|
| `ctx`, `width`, `height`, `frame` | — |
| `seed` | `1` |
| `intensity` | `0.06` (>0.15 reads as a broken codec, not film) |
| `tileSize` | `256` |
| `grainScale` | `1` (2-3 = coarser, pushed-ISO grain) |
| `blendMode` | `"overlay"` |
| `tint` | none (monochrome) |
| `tile` | none — pass a `makeGrainTile()` result to avoid rebuilding per frame |

```ts
grainPass({ ctx, width, height, frame, seed: 3, intensity: 0.07 });
```

**Gotcha.** Grain must be **last**, at output resolution. Grain that is itself upscaled is just blur; grain applied before a blur pass is erased by it.

**Why a tile:** a full-frame `ImageData` of fresh noise is ~8.3M writes per 4K frame and dominates render time. A 256px tile is 65k, generated once and blitted with a per-frame offset. The repeat is invisible because grain has no structure to recognise.

---

### lowResUpscale

`remotion-lib/src/effects` · **Provenance S**

| Param | Default |
|---|---|
| `ctx`, `width`, `height`, `draw` | — |
| `divisor` | `8` |
| `opacity` | `1` |
| `blendMode` | `"source-over"` |
| `smoothing` | `true` |

The `draw` callback receives a **pre-scaled** context, so you draw in full composition coordinates whatever the divisor.

```ts
lowResUpscale({ ctx, width, height, divisor: 8, draw: (c) => { /* gradients */ } });
```

**Gotcha — the one that matters.** Correct for gradients, fog, dust haze, large soft glows. **Wrong for particles.** A 1px dot in an /8 buffer either lands in a cell and becomes an 8px blob or falls between samples and vanishes — and which one happens changes as it moves, so the field flickers. Same for text, thin strokes, hard edges. *If you can name an edge in the layer, do not use this.*

**Gotcha 2.** Line widths inside `draw` are in composition units but **rasterised at buffer resolution**. A 1px line in an /8 buffer is an eighth of a pixel and simply will not appear.

---

## strokes

### NeonStroke

`remotion-lib/src/strokes` · **Provenance S** — despite being described as the most-repeated technique in the corpus, **zero implementations existed in reachable code.** Defaults are reasoned. Validate them against a real shot before trusting them.

Renders one path four times: wide atmospheric glow → outer glow → mid channel → thin hot core, blended additively.

| Param | Default |
|---|---|
| `d` | — |
| `coreColor` | **required** — the hot centre, usually near-white |
| `glowColor` | **required** — the saturated haze hue |
| `coreWidth` | `2` (master size; everything else is a multiple) |
| `atmosphericMul` / `outerMul` / `midMul` | `9` / `4.5` / `2.2` |
| `atmosphericOpacity` / `outerOpacity` / `midOpacity` / `coreOpacity` | `0.18` / `0.35` / `0.6` / `1` |
| `blurPx` | `0` |
| `blendMode` | `"screen"` |

Also: `neonStrokePasses(opts)` returns the four pass descriptors as pure data; `drawNeonStroke(ctx, trace, opts)` is the canvas renderer.

```tsx
<NeonStroke d={d} coreColor="#eaf6ff" glowColor="#2f6fed" coreWidth={3} />
```

**Gotcha.** Additive blending only reads as light on a **dark ground**. On a light background every pass washes out into a pale smear, and no parameter fixes it.

**Gotcha 2.** `blendMode: "plus-lighter"` is true additive and closer to real light, but Chromium-only — fine inside Remotion, wrong if the frame also renders in a browser you do not control.

**Gotcha 3.** `coreWidth` is in user units and scales with enclosing transforms. Counter-scale with `strokeFor`.

**Why four passes, not one thick semi-transparent stroke:** a single stroke has one alpha across its whole width, so its edge is a hard step however soft the colour. Real neon falls off across two or three orders of magnitude from a tiny near-white core to a wide dim haze. Four stacked passes approximate that curve with enough breakpoints that the eye reads it as continuous — and stacking them *additively* is the other half, because that is what makes the core go hot and desaturated the way a real emitter clips out on camera. The demo shows both side by side.

---

### taperedStroke

`remotion-lib/src/strokes` · **Provenance S**

| Export | Returns | Use when |
|---|---|---|
| `taperedStrokeOutline` | one path string (fill it) | Alpha is constant. True continuous taper, one node. |
| `taperedStrokeSegments` | `{from, to, width, alpha, index}[]` | You need alpha falloff too. N nodes. |

| Param | Default |
|---|---|
| `points` | — (sample your curve first; these do not parse path data) |
| `startWidth` | `0` |
| `endWidth` | `8` |
| `profile` | `"linear"` — or `"ease"`, or `(t) => number` |
| `startAlpha` / `endAlpha` *(segments)* | `0` / `1` |

```ts
<path d={taperedStrokeOutline(pts, { startWidth: 0, endWidth: 10 })} fill={c} />
```

**Gotcha.** `taperedStrokeOutline` offsets along the local normal, so it **self-intersects on curves tighter than its own half-width** — the fill develops a pinch or bowtie. With hairpins: subdivide more finely, reduce max width, or use the segment form, which cannot self-intersect.

**Why two functions:** SVG and canvas have exactly one `lineWidth` per stroke call. There is no taper primitive, so you either build a filled outline (smooth, but one fill so alpha cannot vary) or chop into segments (both falloffs, at N nodes).

---

### drawOn

`remotion-lib/src/strokes` · **Provenance A** — `remotion-video/src/hooks/useDrawOn.ts`, the most-reused thing in that repo (6 call sites). **Rewritten as a pure function**, because the original had a real bug; see below.

`drawOn(progress, pathLength)` → `{ strokeDasharray, strokeDashoffset }`.

Length helpers, so you never need DOM measurement: `polylineLength(points)`, `quadraticLength(from, c, to)`, `cubicLength(from, c1, c2, to)`, `circleLength(r)`, `roundedRectLength(w, h, r)`.

Also `drawOnWindow(head, pathLength, tailFraction = 0.2)` for a comet / travelling-signal look.

```ts
const len = quadraticLength(from, control, to);
<path d={d} {...drawOn(progress, len)} />
```

**Why not a hook — this is a real bug, not a style preference.** The original measures with `getTotalLength()` in `useLayoutEffect` and stores it in state. The first render always has length 0, which sets `strokeDasharray` to 0 and shows the path **fully drawn for one frame** before the effect corrects it. Remotion renders frames out of order across workers, each mounting fresh — so that flash lands on unpredictable frames of the output. Passing the length in removes the failure entirely.

**Gotcha.** `pathLength` must be ≥ the true length. Too short and the path finishes early then sits still; too long and it never completes. When unsure, overestimate slightly and push `progress` a little past 1 at the end.

---

### strokeFor

`remotion-lib/src/strokes` · **Provenance S** — no implementation existed, but `remotion-video/src/components/MiniIcon.tsx` has exactly the bug it fixes: a `scale` prop that thickens every outline with it.

`strokeFor(scale, strokePx)` → the width to set so the stroke renders at `strokePx` after the transform. Also `strokeForSize(renderedSize, baseSize, strokePx)` and `scaleFor(renderedSize, baseSize)`.

```tsx
<g transform={`scale(${s})`} strokeWidth={strokeFor(s, 4)}>…</g>
```

**Gotcha.** Nested scales multiply — pass the product, not just the inner scale.

**Gotcha 2.** `vector-effect: non-scaling-stroke` solves the same problem in the renderer but is all-or-nothing: it ignores scale *entirely*, so an icon deliberately blown up 4× for a hero shot keeps a hairline outline. Use `strokeFor` when you want proportional control, `vector-effect` when you want none.

---

## generators

**Everything here is expensive.** Call once in a `useMemo`; animate by moving what it returned. Re-running per frame is slow *and* makes the figure boil.

### midpointDisplacement

`remotion-lib/src/generators` · **Provenance S**

Recursive subdivision with sideways displacement and optional branching. One algorithm for lightning, plasma filaments, cracks, river deltas, bronchial trees, roots, dendrites, circuit traces — the difference is entirely parameters.

| Param | Default | Meaning |
|---|---|---|
| `from`, `to`, `seed` | — | |
| `depth` | `6` | 2^6 = 64 segments |
| `displacement` | `0.22 × trunk length` | px at the first subdivision |
| `roughness` | `0.5` | Decay per level. <0.5 smooths fast; >0.7 → noise |
| `branchProbability` | `0.18` | Compounds — 0.4 at depth 6 is thousands |
| `branchAngle` | `0.5` rad (~29°) | Sign random per branch |
| `branchScale` | `0.7` | |
| `maxBranchDepth` | `3` | Generations, **not** subdivision depth |
| `minBranchLength` | `8` px | |

Returns `Branch[]` — index 0 is the trunk; each has `points`, `generation`, `parent`. Companion `polyPath(points)` → path data.

Lightning = high displacement, fast decay, low branch probability, wide angle. Roots = low displacement, slow decay, high branch probability, narrow angle.

```ts
const branches = midpointDisplacement({ from, to, seed: 5 });
branches.map((b) => <path d={polyPath(b.points)}
                          strokeOpacity={1 / (1 + b.generation)} />);
```

**Gotcha.** Cost is exponential in **both** `depth` and `branchProbability`. depth 8 × 0.5 is a five-figure point count and will stall a render. Raise one axis at a time.

**Gotcha 2.** This is a static figure. To animate lightning, derive the seed from the frame (`seed + Math.floor(frame / 4)`) so it re-strikes. **Interpolating between two figures looks like rubber, not electricity.**

**Why displacement must decay:** without it, deep subdivisions move as far as shallow ones and you get uniform noise at every scale — a fuzzy caterpillar rather than a bolt with a recognisable overall path and fine detail riding on it.

---

### trendingWalk

`remotion-lib/src/generators` · **Provenance S**

A seeded series that moves in **runs** — picks a direction, commits for several steps, then re-picks.

| Param | Default |
|---|---|
| `seed` | — |
| `length` | `120` |
| `start` | `100` |
| `bias` | `0.15` (-1..1; a gentle uptrend) |
| `runLength` | `[4, 14]` steps |
| `volatility` | `0.012` (fraction of `start`) |
| `drift` | `0.004` (per-step push along the run) |
| `min` / `max` | none — on hit, the run reverses rather than flat-lining |

Companion `seriesPath(series, { width, height, padding = 0.08 })` → SVG path, auto-scaled.

```ts
const series = trendingWalk({ length: 180, seed: 9, bias: 0.2 });
<path d={seriesPath(series, { width: 1200, height: 400 })} />
```

**Gotcha.** Unbounded and compounding — a long series with strong bias wanders far from `start`. Normalise before plotting or set `min`/`max`.

**Why not a plain random walk:** a memoryless walk is as likely to reverse as continue at every step, so it jitters constantly and never holds a direction. Any trend it shows is accidental and does not persist. Real series (and every chart an audience has seen) are dominated by momentum — sustained moves punctuated by reversals. Committing to a direction for a run is the smallest change that produces that. The demo shows both.

---

### noiseField

`remotion-lib/src/generators` · **Provenance S** — the only noise in reachable code is an SVG `feTurbulence` filter primitive, which is not a sampleable field.

`noiseField(opts)` → `(x, y, t?) => number` in [-1, 1].

| Param | Default |
|---|---|
| `seed` | — |
| `octaves` | `3` |
| `frequency` | `0.004` (~one feature per 250px at 1080p) |
| `amplitude` | `1` |
| `lacunarity` | `2` |
| `gain` | `0.5` (>0.65 → grit; <0.35 → one sine) |
| `timeFrequency` | `1` |
| `integerFrequency` | `true` |

```ts
const noise = useMemo(() => noiseField({ seed: 2 }), []);
const v = noise(x, y, frame / durationInFrames);
```

**Pass `t` as `frame / durationInFrames`, not a raw frame number.**

**Why `integerFrequency` matters:** stock footage loops. A field animated by feeding `t` into a sine only returns to its start if every temporal frequency completes a whole number of cycles. Rounding them makes `t = 0` and `t = 1` identical *by construction* — seamless, no crossfade.

**Gotcha.** This is **value** noise, not simplex. Cheap and dependency-free, but with mild axis-aligned structure — horizontal/vertical streaks can show at low octave counts. If the grid becomes visible: raise `octaves`, sample on a rotated frame, or drop in a simplex implementation behind the same interface.

**Gotcha 2.** Build the sampler once in a `useMemo`. Rebuilding per pixel is the usual performance mistake.

---

### particleFromMask

`remotion-lib/src/generators` · **Provenance S** — `particle-ring` places particles parametrically on a ring; nothing rejection-samples a silhouette.

| Param | Default |
|---|---|
| `count`, `mask`, `bounds`, `seed` | — |
| `edgeWeight` | `0.45` (0 = uniform interior) |
| `edgeRadius` | `12` px |
| `maxAttempts` | `count × 200` |

Returns `{ x, y, edgeDistance, index }[]` — `edgeDistance` is 0 at the boundary, 1 deep inside.

Mask builders: `maskFromImageData(image, bounds, threshold = 128)`, `maskFromDraw(draw, bounds, { resolution, threshold })`.

```ts
const mask = maskFromDraw((c) => { /* draw the silhouette */ }, bounds);
const particles = useMemo(() =>
  particleFromMask({ count: 4000, mask, bounds, seed: 4 }), [mask]);
```

**Gotcha.** Cost scales with how much of `bounds` the shape does *not* fill — a thin diagonal in a big box rejects 95%+ of draws. On hitting `maxAttempts` you get **fewer particles than requested** (it returns what it found rather than looping forever). Tighten `bounds` first; that is almost always the fix.

**Gotcha 2.** Call once. Animate by moving the returned particles — re-sampling per frame makes the figure boil.

**Why edge weighting:** uniform density reads as a flat blob, because the only information about the shape is at the boundary and the boundary has the same density as the middle. Biasing to the edge draws the contour in particles, which is what keeps the figure legible while it dissolves.

---

## shapes

Every export returns a path **string** (or an array of them) and carries no colour, stroke width or opacity — style them where you use them. That keeps them usable for fills, strokes, clip paths and masks without variants.

### blobPath

`remotion-lib/src/shapes` · **Provenance S**

| Param | Default |
|---|---|
| `center`, `radius`, `seed` | — |
| `points` | `9` (<6 reads as a rounded polygon; >14 converges on a circle) |
| `irregularity` | `0.28` (>0.5 starts self-intersecting) |
| `tension` | `0.36` |

Also `blobPoints(opts)` (for animating control points or placing things on the boundary) and `smoothClosedPath(points, tension)` (useful for any closed loop).

```tsx
<path d={blobPath({ center, radius: 140, seed: 3 })} fill={cellColor} />
```

**Gotcha.** The shape **exceeds `radius`** — beziers bulge outside their control points and irregularity adds to it. Budget ~`radius × (1 + irregularity) × 1.15` when laying out around it.

**Why beziers, not a polygon:** straight segments put a visible vertex at every control point and the eye counts them — a 9-point blob reads as a nonagon, not a cell.

**Note.** Angles stay regular here; only radius is jittered. Jittering angle too tends to pinch the curve where points crowd, which reads as a dent rather than a lobe. This is the deliberate exception to `radialPlaces`'s rule.

---

### tornEdge

`remotion-lib/src/shapes` · **Provenance S**

| Param | Default |
|---|---|
| `from`, `to`, `seed` | — |
| `segments` | `120` |
| `coarseAmplitude` | `18` px |
| `coarseScale` | `3` cycles |
| `fineAmplitude` | `4` px |
| `fineScale` | `34` cycles |
| `fibreCount` | `60` (0 disables) |
| `fibreLength` | `9` px |
| `fillDepth` | the edge's own length — how far `closed` extends past the nominal line |

Returns `{ points, path, closed, fibres }`. **Fill `closed`**; `path` is the open edge (stroke it or use as a clip); `fibres` are short strand paths.

```tsx
const tear = tornEdge({ from, to, seed: 6 });
<path d={tear.closed} fill={paperColor} />
```

**Gotcha.** `closed` fills toward the side the normal points away from — downward for a left-to-right edge. **Reverse `from` and `to` to fill the other side**, rather than negating amplitudes.

**Gotcha 2.** `fillDepth` is the depth of the **sheet**, not of the tear. Left too small you fill a narrow floating band instead of a page — the default (the edge's own length) covers a frame for any full-width tear, but set it explicitly for a short edge inside a large fill.

**Why two scales:** a tear has structure at two very different sizes — the slow bends where the sheet gave way, and fibre-by-fibre roughness along that line. Coarse only looks like a torn-edge *icon*; fine only looks like a sanded straight cut. The fibre fringe is what sells it at close range: real torn paper ends in a fringe, not at a line.

---

### rings

`remotion-lib/src/shapes` · **Provenance A** — `RadioWaves.tsx` has an `arcPath` builder; `FrequencyHop.tsx` has a linear tick row (not a ring). Generalised here.

**`roundedPill({ x, y, width, height, radius? })`** — `radius` defaults to `height / 2`.
*Gotcha:* clamped to half the **shorter** side, so a pill narrower than it is tall comes out a circle. Swap and rotate for a vertical capsule.

**`brokenArcRing({ center, radius, segments = 5, gapDeg = 14, jitter = 0.35, seed = 1, startDeg = -90, sweepDeg = 360 })`** → `string[]`, one path per segment. Stroke, do not fill.
*Why jitter defaults non-zero:* even identical segments give the same rosette failure `radialPlaces` exists to avoid — an even broken ring reads as a dashed circle, not as instrumentation. `jitter: 0` is right for a progress track.

**`tickRing({ center, radius, count = 60, majorEvery = 5, minorLength = 8, majorLength = 18, startDeg = -90, sweepDeg = 360, inward = false })`** → `TickMark[]` with `path`, `major`, `angle`, `index` — so a sweeping highlight is just a function of `index`.
*Gotcha:* with `sweepDeg: 360` the last position is skipped (it would coincide with tick 0); with a partial sweep both ends are drawn.

**`arcPath(center, radius, startAngle, endAngle)`** — radians, exported for direct use.

---

## What is deliberately NOT here

Do not go looking for these; they were considered and left out.

| Thing | Why |
|---|---|
| Natural Earth / GeoJSON **loading** | Project-specific (public/ vs bundled vs `staticFile()`, admin level, resolution). The library does no I/O. |
| A colour or palette module | The library is palette-agnostic by rule. Palettes belong in projects — see `demo/src/theme.ts`. |
| `useDrawOn` as a hook | Replaced by the pure `drawOn`. The hook version has a first-frame flash bug; see [drawOn](#drawon). |
| Simplex noise | `noiseField` uses value noise to stay dependency-free. Swap it in behind the same interface if a shot needs it. |
| Anything from a single project | Single-use code belongs in its project. |
