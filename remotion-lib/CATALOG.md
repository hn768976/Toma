# CATALOG

Everything in `remotion-lib`. Written for a future session with no memory of
how this was built. Scan the table, then read the entry.

**Rules that hold for every component here:** pure functions, no internal
state, no `Date.now()`, no `requestAnimationFrame`. Everything takes a frame
number or a progress value. Same seed + same frame = identical output. No
colours are baked in anywhere — every colour is a parameter.

**Import style.** `import { neonStroke } from 'remotion-lib/strokes'` (or from
`'remotion-lib'` for everything). Paths below are relative to `src/`.

---

## At a glance

| Component | Path | One line | Rebuilt in |
|---|---|---|---|
| `mulberry32` + helpers | `random/seededRandom` | Fast seeded PRNG and draw helpers | 14 |
| `radialPlaces` | `random/radialPlaces` | N items round a point, angle **and** radius jitter | 3 |
| `irregularDashes` | `random/irregularDashes` | Dash arrays with varied length, gap, wander | 36 |
| `fitProjection` | `geo/projection` | Equirectangular fitted to a frame, + path generator | 5 |
| `dotMapFromLand` | `geo/dotMap` | Grid sampled against land, coastal flag per dot | 6 |
| `threeBufferDOF` | `effects/threeBufferDOF` | Near/mid/far buffers, blur each once | 5 |
| `grainPass` | `effects/grain` | Film grain from pre-baked noise tiles | 57 |
| `vignettePass` | `effects/vignette` | Elliptical corner darkening | 55 |
| `bloomPass` | `effects/bloom` | Threshold → blur ladder → add back | 40 |
| `lowResUpscale` | `effects/lowResUpscale` | Compute soft layers at 1/8 and scale up | 13 |
| `neonStroke` | `strokes/neonStroke` | **The four-pass neon construction** | 51 |
| `taperedStroke` | `strokes/taperedStroke` | Width + alpha falloff along a path | 16 |
| `drawOn` | `strokes/drawOn` | Progressive reveal via dash offset | 16 |
| `midpointDisplacement` | `generators/midpointDisplacement` | Recursive branching: lightning, plasma, roots | 22 |
| `trendingWalk` | `generators/trendingWalk` | Seeded walk with biased runs → price series | 7 |
| `particleFromMask` | `generators/particleFromMask` | Rejection-sample particles inside a silhouette | 7 |
| `blobPath` | `shapes/blobPath` | Irregular closed organic path | 19 |
| `tornEdge` | `shapes/tornEdge` | Torn edge at two noise scales + fibres | 8 |

"Rebuilt in" = how many of the 78 project branches contained an independent
implementation. Nearly every one was unique — these were retyped, not copied.

---

## random/

### `mulberry32(seed)` · `random/seededRandom`
Fast deterministic PRNG. Also `seedFrom`, `between`, `intBetween`, `sign`,
`chance`, `pick`, `shuffled`.

| Param | Default | Meaning |
|---|---|---|
| `seed` | — | Integer. Coerced with `\| 0`. |

```ts
import { random } from 'remotion';
const rng = mulberry32(seedFrom(random('stars')));
const x = between(rng, 0, 1920);
```

**Why not Remotion's `random()` directly:** it hashes a string per call. Fine
for a few values, far too slow for one per pixel. Seed this from it once.

**Gotcha:** never `Math.random()` in a composition — Remotion renders frames
out of order across workers and it will pop.

**From:** meteor-shower-nebula, candlestick-chart-variants, chat-bubbles-4k,
lightning-strike, crypto-hud, financial-data-wall + 8 more.

---

### `radialPlaces({...})` · `random/radialPlaces`
N positions around a centre with angle and radius jitter.

| Param | Default | Meaning |
|---|---|---|
| `count`, `cx`, `cy`, `radius` | — | Required. |
| `rng` | — | Required. No internal default by design. |
| `angleJitter` | `0.26` | Fraction of one slot. 0 = regular spokes. |
| `radiusJitter` | `0.18` | Fraction of radius. 0 = exact circle. |
| `startAngle` | `-PI/2` | Item 0 at twelve o'clock. |
| `spread` | `TAU` | Smaller = a fan. |

```ts
for (const p of radialPlaces({ count: 24, cx: 960, cy: 540, radius: 300, rng })) {
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
}
```

**Gotcha:** jittering the angle alone is not enough — items still sit on a
perfect circle and read as a dial. Both axes must move.

**From:** particle-burst-4k, defocused-cells-4k, security-icon-animation.

---

### `irregularDashes({...})` · `random/irregularDashes`
Dash arrays with varied length and gap, plus optional perpendicular wander.

| Param | Default | Meaning |
|---|---|---|
| `count` | — | Dash+gap pairs. |
| `dash` / `gap` | `18` / `12` | Means in px. |
| `variance` | `0.55` | Deviation fraction. 0 = an even ladder. |
| `wander` | `0` | Max perpendicular offset, reported per segment. |

```ts
const { pattern } = irregularDashes({ count: 16, rng });
ctx.setLineDash(pattern);
```

**Gotcha:** canvas repeats the array cyclically — with few pairs the eye finds
the repeat anyway. Use ≥12 for a long path. `wander` only applies if you stroke
`segments` yourself; a dash array cannot express it.

**From:** ai-core-hud, agentic-hud, contour-landscape, crypto-hud,
neon-shield-hud, hud-dashboard + 30 more.

---

## geo/

### `fitProjection({...})` · `geo/projection`
Equirectangular projection fitted to a frame, plus a bound `geoPath`.
Also `dropAntarctica`, `loadLand`.

| Param | Default | Meaning |
|---|---|---|
| `land`, `width`, `height` | — | Required. |
| `padding` | `0` | Inset px per side. |
| `projectionFactory` | `geoEquirectangular` | Pass another d3 projection. |
| `fitWorld` | `true` | Fit the sphere, not the data bounds — this is what makes the map tile horizontally. |

```ts
const { projection, path, project } = fitProjection({ land, width, height });
```

**No data is bundled.** Pass your own GeoJSON. The demo bakes `world-atlas`
land-110m into `demo/src/land.ts` via `demo/scripts/bake-land.mjs`.

**Gotcha:** `fitExtent` letterboxes a 2:1 sphere inside the box, so the map is
*not* the full frame height. Never hand-roll a latitude→y formula — call
`project([0, lat])` and ask the projection.

**Gotcha:** `dropAntarctica` matches on feature *name* properties. On a merged
single-feature dataset (world-atlas `land-110m`) it is a **silent no-op** — use
a latitude cut instead. It is for country-level data.

**From:** market-dashboard-4k, dotted-world-map, network-map-4k, geodata-hud,
financial-data-wall.

---

### `dotMapFromLand({...})` · `geo/dotMap`
Grid sampled against rasterised land; one dot per land cell, coastal flagged.

| Param | Default | Meaning |
|---|---|---|
| `fitted`, `land` | — | Required. |
| `pitch` | `13` | Grid spacing px. |
| `coastal` | `true` | Compute the coastal flag. |
| `coastalThreshold` | `8` | Land neighbours (of 8) below which a dot is coastal. |
| `jitter` | `0` | Offset as a fraction of pitch. Needs `rng`. |

```ts
const dots = useMemo(() => dotMapFromLand({ fitted, land }), [fitted, land]);
ctx.fillStyle = d.isCoastal ? coastColor : landColor;
```

**Why the coastal flag is on by default:** without it the continents are
undifferentiated fields of identical dots and the coastline — the only
recognisable feature — disappears. Only 1 of the 6 source projects had this;
it is the version that reads best. Pass `coastal: false` for the plain one.

**Gotcha:** needs a DOM canvas; call in `useMemo`, never per frame.
**Gotcha:** `pitch: 6` at 4K is ~230k dots. Draw them in one path.

**From:** dotted-world-map (the only one with the coastal flag), network-map-4k,
market-dashboard-4k, geodata-hud, financial-data-wall, doc-approval.

---

## effects/

### `threeBufferDOF` · `effects/threeBufferDOF`
`createDofBuffers`, `clearDofBuffers`, `bufferFor`, `bucketFor`, `compositeDof`.

| Param | Default | Meaning |
|---|---|---|
| `blurPx` | `[24, 8, 0]` | Far → near. Last is the focal plane. |
| `bleed` | `3 × max blur` | Margin so blur never samples past the edge. |
| `recede` | `0` | Wash blurred layers toward `recedeColor`. |
| `recedeColor` | — | **Required** when `recede > 0`. Must match your background. |

```ts
const buf = createDofBuffers({ width, height });
clearDofBuffers(buf);
for (const el of elements) drawElement(bufferFor(buf, el.depth), el);
compositeDof({ ctx, buffers: buf, recede: 0.5, recedeColor: '#05070D' });
```

**Why:** per-element blur at 4K is seconds per frame. This is exactly `levels`
blurs regardless of element count.

**Why `recede` matters:** real defocused content loses *contrast*, not just
sharpness. Without it, blurred layers glow instead of receding.

**Gotcha:** buffer contexts are pre-translated by `bleed` — draw in ordinary
frame coordinates, do not add it yourself.
**Gotcha:** allocate once per resolution (`useMemo`), clear per frame.

**From:** crypto-terminal, candlestick-macro, chip-dashboard, neon-light-streaks,
contour-landscape.

---

### `grainPass` / `buildGrainTiles` · `effects/grain`

| Param | Default | Meaning |
|---|---|---|
| `size` / `tileCount` | `256` / `4` | Tile edge; distinct tiles cycled by frame. |
| `intensity` | `0.5` | Noise amplitude around neutral. |
| `opacity` | `0.06` | Pass strength. Above ~0.15 reads as noise, not film. |
| `composite` | `'overlay'` | 128 is neutral under overlay. |

```ts
const tiles = useMemo(() => buildGrainTiles({ seed: 1 }), []);
grainPass({ ctx, width, height, tiles, frame });
```

**Why tiles:** per-pixel noise at 4K is ~8M values a frame. **Why several:** one
tile restamped is static grain, which reads as dirt on the lens.

**Gotcha:** build tiles ONCE. Rebuilding per frame defeats the point.
**Gotcha:** `overlay` needs mid-tones. Over pure black use `'lighter'` and low
opacity instead.

**From:** 57 projects.

---

### `vignettePass` · `effects/vignette`
Also exports `withAlpha(color, alpha)` (handles `#rgb`, `#rrggbb`, `rgb()`).

| Param | Default | Meaning |
|---|---|---|
| `color` | — | **Required.** Usually your background, or black. |
| `strength` | `0.55` | Alpha at the corner. |
| `inner` / `outer` | `0.45` / `1.0` | Normalised radii. |

**Why elliptical:** `createRadialGradient` makes a circle, which on 16:9
darkens left and right far more than top and bottom — a lens fault, not a grade.
This scales the context to match the frame aspect.

**Gotcha:** apply **last**, after bloom. A vignette under a bloom gets
brightened back up at the edges and does nothing.

**From:** 55 projects.

---

### `bloomPass` · `effects/bloom`

| Param | Default | Meaning |
|---|---|---|
| `source` | — | Your **scene buffer**, not the frame you composite into. |
| `threshold` | `0.6` | Luminance cut, 0..1. Rec.601 luma. |
| `ladder` | 4 stops, 6→130px | Tight spill through wide wash. Radii suit 1080p — double for 4K. |
| `downscale` | `4` | Threshold pass runs on a smaller copy. |

**Why a ladder:** one radius gives a uniform halo with a findable edge. Real
bloom has a tight bright core spill plus a very wide faint wash.

**Gotcha:** pass the scene buffer as `source`, or the bloom feeds back on itself.
**Gotcha:** composites with `'lighter'` — invisible on light backgrounds.

**From:** 40 projects.

---

### `lowResUpscale` · `effects/lowResUpscale`
`createLowResLayer`, `clearLowResLayer`, `compositeLowRes`.

| Param | Default | Meaning |
|---|---|---|
| `scale` | `8` | Divisor. Above ~12 gradients band. |
| `composite` | `'source-over'` | `'lighter'` for glows. |
| `smoothing` | `true` | False gives deliberate chunky pixels. |

**CORRECT FOR:** gradients, dust, fog, nebulae, glows — anything you were going
to blur heavily anyway.
**WRONG FOR:** particles, text, line art, anything with a hard edge. Upscaling
quantises positions to the low-res grid, so particles snap between frames and
thin lines alias into dashes. **This is the most common misapplication.**

**Gotcha:** the layer context is pre-scaled — draw in frame coordinates.

**From:** code-flythrough, candlestick-chart, christmas-bokeh, dna-microarray,
ai-search-bar, data-tunnel-4k, dotted-world-map, particle-rain-4k + 5 more.

---

## strokes/

### `neonStroke({...})` · `strokes/neonStroke`
**The single most repeated technique in the library — 51 projects, 122 distinct
implementations.** Also `neonFill` for discs, and `DEFAULT_NEON_PASSES`.

| Param | Default | Meaning |
|---|---|---|
| `path` | — | Thunk laying the geometry. Called once per pass. |
| `color` | — | **Required.** Halo colour. |
| `coreColor` | `color` | Should be near-white — this is what makes it read *hot*. |
| `width` | — | Width of the **core**; every pass multiplies it. |
| `passes` | 4 passes | ×9.0@0.05, ×4.5@0.10, ×2.0@0.30, ×1.0@1.00 core. |
| `intensity` | `1` | Scales all pass alphas. Animate to flicker. |

```ts
neonStroke({
  ctx,
  path: (c) => { c.beginPath(); c.moveTo(100, 400); c.lineTo(900, 300); },
  color: '#2E6BFF', coreColor: '#EAF4FF', width: 3,
});
```

**A single thick semi-transparent stroke does NOT produce this.** It gives a
flat band of uniform colour with a hard edge. Light falls off with distance;
additive compositing is what reproduces that. Where passes overlap near the
centre their alphas sum toward white.

**Why not `shadowBlur`:** some source projects used it. Cheaper for a few large
glyphs, but the radius is capped, it does not scale with the canvas, and over a
long polyline it is dramatically slower than restroking. The pass array is the
form that survived. `blur` is available *per pass* if you want a soft
atmospheric wash on the widest one.

**Gotcha:** `'lighter'` only accumulates toward white on a **dark** ground. For
neon on white, draw into an offscreen buffer over black and composite that.
**Gotcha:** alphas are additive, so a self-crossing path is brighter at the
crossing. Physically right, but you cannot draw a uniform-brightness closed
shape this way.

**From:** neon-light-streaks, lab-dashboard, chip-dashboard, country-data-curve,
shield-status-hud, candlestick-chart, crypto-hud, data-tunnel-4k + 43 more.

---

### `taperedStroke({...})` · `strokes/taperedStroke`

| Param | Default | Meaning |
|---|---|---|
| `startWidth` / `endWidth` | `6` / `0` | px. 0 = a true point. |
| `startAlpha` / `endAlpha` | `1` / `0` | |
| `easing` | linear | `(t) => t * t` for a comet tail. |
| `maxSegments` | `240` | Polyline is sampled down to this. |
| `additive` | `false` | `true` for light trails. |

**Why:** canvas has no variable-width stroke. A constant width has a blunt end
that reads as a drawn mark, not a moving thing.

**Gotcha:** each segment is a separate stroke, so a semi-transparent taper shows
seams where they overlap. Keep alpha high or use `additive: true`.

**From:** ticker-board, candlestick-chart, chip-dashboard, halftone-ai-dashboard,
neon-shield-hud, plasma-burst, breathing-lungs-4k, lightning-strike + 8 more.

---

### `drawOn` / `applyDrawOn` / `polylineLength` · `strokes/drawOn`

| Param | Default | Meaning |
|---|---|---|
| `length` | — | Real path length. Use `polylineLength()` or SVG `getTotalLength()`. |
| `progress` | — | 0..1, clamped. |
| `reverse` | `false` | Draw from the far end. |

**Why not a clip rect:** that reveals in *screen* space, so a curved path
appears from behind a moving straight edge. The dash follows the path itself.

**Gotcha:** OVERWRITES any dash pattern. A path that is both dashed and draws on
needs the dashes baked into the geometry.
**Gotcha:** guess `length` low and the stroke finishes early then sits still;
high and it never completes.

**From:** agentic-hud, candlestick-chart, crypto-terminal, kurzgesagt-explainer,
neon-shield-hud, ai-search-bar, workflow-diagram + 9 more.

---

## generators/

### `midpointDisplacement({...})` · `generators/midpointDisplacement`
Also exports `polyline(ctx, points)`.

| Param | Default | Meaning |
|---|---|---|
| `depth` | `7` | Main channel gets 2^depth + 1 points. |
| `displacement` | `0.32` | Top-level offset as a fraction of segment length. |
| `roughness` | `0.5` | Survival per level. 0.5 = self-similar. |
| `branchProbability` | `0.4` | 0 = a single unbranched filament. |
| `branchAngle` | `0.5` rad | Max fork deviation. |
| `branchDepth` | `3` | Levels that may still fork — limiting this keeps tips clean. |
| `maxGeneration` | `2` | Forks of forks. |

Returns `{ strokes }`, each with `points`, `generation`, and suggested `width`
and `brightness` multipliers that fall off with generation — the visual
hierarchy comes free.

**Lightning, plasma, bronchial trees and root systems are the same algorithm.**
Verified in the demo:

| | depth | displacement | branchProb | branchAngle |
|---|---|---|---|---|
| lightning | 7 | 0.32 | 0.4 | 0.5 |
| plasma | 6 | 0.55 | 0.7 | 1.1 |
| bronchi | 5 | 0.10 | 1.0 | 0.6 |
| roots | 6 | 0.22 | 0.8 | 0.9 |

**Gotcha:** point count is exponential in `depth`. Keep it ≤ 9; depth 12 with
branching will hang the render.

**From:** lightning-strike, plasma-burst, 4k-fireworks, neuron-network,
malware-alert-4k, neon-shield-hud, network-map-4k + 15 more.

---

### `trendingWalk({...})` · `generators/trendingWalk`

| Param | Default | Meaning |
|---|---|---|
| `length` | `120` | |
| `bias` | `1` | `1` rising, `-1` falling, `0` sideways. |
| `biasStrength` | `0.62` | How hard bias skews run direction. |
| `runLength` | `[6, 18]` | Ticks per run. Short = chop, long = trend. |
| `volatility` | `0.012` | Step as a fraction of `start`. |
| `closeLoop` | `false` | Correct so last = first, for tiling. |

Returns `{ values, candles, min, max, unit }`. `candles` is OHLC per step.

**Why not a plain random walk:** independent steps read as flat noise — no runs,
no reversals, a seismograph rather than a market. Committing to runs is what
produces structure. Counter-trend runs are shortened automatically, which is
what makes a bull series grind up and drop fast instead of zigzagging evenly.

**Gotcha:** `closeLoop` forces net drift to zero, so a looping series cannot
also have a net rise — character must come from run structure alone.

**Not extracted:** the hand-authored segment plans in `candlestick-macro`
(capitulation, failedRally, retrace with tuned slopes) stayed in that project —
they are art direction, not a general generator.

**From:** candlestick-chart, candlestick-macro, crypto-terminal,
financial-data-wall, neon-stock-line, analytics-dashboard-4k, market-dashboard-4k.

---

### `particleFromMask({...})` · `generators/particleFromMask`

| Param | Default | Meaning |
|---|---|---|
| `path` | — | SVG path data or a `Path2D`. |
| `count` | — | Particles to return. |
| `width` / `height` | — | Space the path is authored in. |
| `resolution` | `512` | Mask raster on the long edge. |
| `edgeBias` | `0.35` | 0 = uniform fill, 1 = almost all on the rim. |
| `edgeFalloff` | `12` | Mask px over which edge weighting decays. |

Returns particles with `x`, `y`, `edgeDistance` (mask px from the rim), so you
can size or brighten by proximity to the edge.

**Why rejection sampling:** no closed form exists for "a uniform point inside an
arbitrary path". Rasterise once, test candidates — works for concave shapes and
holes.
**Why the edge weighting:** a uniform fill reads as a filled blob; the outline,
the only thing that makes a silhouette recognisable, is no denser than the
middle. Clearly visible in the demo at `edgeBias` 0 vs 0.8.

**Gotcha:** needs a DOM canvas. `useMemo`, never per frame — the rasterise and
chamfer distance transform are the expensive part and are frame-independent.
**Gotcha:** throws if the path fills nothing, rather than looping forever.

**From:** particle-figure-4k, error-cascade, halftone-ai-dashboard,
led-stock-ticker, dotted-world-map, hud-scan, market-dashboard-4k.

---

## shapes/

### `blobPath({...})` · `shapes/blobPath`

| Param | Default | Meaning |
|---|---|---|
| `points` | `9` | Below 5 it stops closing convincingly. |
| `irregularity` | `0.28` | Radial variation as a fraction of radius. |
| `angleJitter` | `0.2` | Keeps lobes unevenly spaced — stops it reading as a flower. |
| `squash` | `1` | Vertical scale. |
| `rotation` | `0` | radians. |

Returns `{ path: Path2D, points }`.

**Why bezier smoothing across the seam:** the curve uses midpoints between
samples as on-curve anchors and the samples as control points, so every join
including the closing one is smooth by construction. A naive "close the path"
leaves a visible corner where the last point meets the first — **that corner is
the single most common tell that a blob was generated.**

**Gotcha:** `irregularity: 0` is *not* a perfect circle unless `angleJitter` is
also 0 — unevenly spaced samples pull the smoothed curve inside the circle
between them. Set both to 0 for a true circle.
**Gotcha:** `irregularity` above ~0.5 with few points can self-intersect, which
fills with holes under the nonzero rule.

**From:** defocused-cells-4k, formula-field-4k, malware-alert-4k, grid-corridor,
chat-bubbles-4k, security-icon-animation, code-flythrough + 12 more.

---

### `tornEdge({...})` · `shapes/tornEdge`

| Param | Default | Meaning |
|---|---|---|
| `segments` | `120` | Samples along the edge. |
| `coarseAmp` / `coarseScale` | `14` / `3` | Large-scale wander. |
| `fineAmp` / `fineScale` | `3.5` / `40` | Small-scale roughness. |
| `fibres` | `0` | Off by default — wrong for torn metal or glass. |
| `fibreLength` | `[3, 11]` | px. |

Returns `{ points, fibres }` — fibres are `{from, to}` segments to stroke thin
and faint.

**Why two scales:** one scale reads as a wobble, not a tear. Real torn paper has
large-scale wander (where the tear chose to go) and small-scale fibre roughness.
**Why the fibre band:** a clean torn line still reads as a *cut*.

Deviation tapers to zero at both ends so the edge meets its endpoints exactly —
otherwise a torn edge detaches from the corner it belongs to. Uses a seeded
sum-of-sines, so the module has no dependencies.

**Gotcha:** deviation is perpendicular to the straight `from`→`to` line, not the
local tangent. Over a long edge with high `coarseAmp` the fibres look slightly
sheared — generate in segments instead.

**From:** headline-scroll, chip-dashboard, cybersecurity-padlock, error-cascade,
lab-dashboard, grid-corridor, particle-burst-4k, terminal-animation.

---

## Deliberately NOT extracted

Do not go looking for these — they were considered and rejected.

| Candidate | Why not |
|---|---|
| `strokeFor(size, px)` | **1 project only** (`code-tunnel-title`). Single-use code belongs in its project. |
| `noiseField()` | 3 mentions, but only `contour-landscape` implements it — and it just wraps `simplex-noise`. Add that dependency directly. |
| `roundedPill` / `brokenArcRing` / `tickRing` | 2–3 projects, and `brokenArcs` in `crypto-hud` is a config *mode*, not a shape builder. Too thin to parameterise honestly. |
| Candlestick segment plans | Hand-authored art direction in `candlestick-macro`, not a generator. |

---

## Verifying

```bash
cd demo
npx remotion render LibDemo out/lib-demo.mp4 --codec=h264 --crf=18
```

Every component also has its own composition (`npx remotion studio`), because a
component that cannot be demonstrated in isolation is not properly
parameterised.

**In this sandbox** Remotion's Chrome download host is not on the proxy
allowlist. Add:
```
--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
```
