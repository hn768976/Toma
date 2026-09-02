# remotion-lib

Reusable pieces for frame-pure Remotion compositions. Everything here is
**deterministic** (a pure function of a stable string seed and the frame
number), **palette-agnostic** (colours arrive as props; nothing has a hex
literal of its own) and **fully parameterised** (no composition-specific
constants baked in).

House rules these all follow, and that anything added here must follow:

- No `Math.random()`, `Date.now()`, `requestAnimationFrame`, CSS animation
  or React state. Remotion renders frames out of order across workers, so
  anything that is not a pure function of `(seed, frame)` will boil.
- Every periodic quantity uses a period that **divides the composition
  duration exactly**, so frame N is pixel-identical to frame 0.
- Colours are passed in as 6-digit hex strings (`#RRGGBB`).
- Generation is separated from drawing, so one built set can be drawn more
  than once — a second, filtered pass is how bloom sources are made.

---

## `rng.ts`

Seeded randomness. `makeRng(seed)` returns an independent stream of
uniform values; Remotion's `random()` supplies the string hashing and a
mulberry32 stream supplies the bulk draws, so a rejection sampler taking
200k samples costs one multiply each rather than one string hash each.

`makeRng`, `seedValue`, `range`, `rangeInt`, `pick`, `gaussianish`,
`biasedRange`.

```ts
const rng = makeRng("brain:particles");
const size = range(rng, 3, 9);
```

## `loopMath.ts`

The seamless-loop toolkit. `divisorsOf(total, min, max)` gives the legal
periods to choose from; the rest are cycles built on them.

- `loopSine(frame, period, phase)` — periodic sine.
- `loopPhase(frame, period, phase)` — position in cycle, 0..1.
- `closedOrbit(frame, period, radius, aspect, phase)` — a tiny elliptical
  drift that returns exactly to its start.
- `pulseBand(s, progress, width, tail)` — the profile of a travelling band
  of raised intensity, with a sharp leading edge and a longer trailing
  tail so it reads as a wave with direction rather than a glow.
- `inLoopWindow(frame, start, hold, total)` — a one-shot event window that
  wraps across the loop boundary.

## `bezierPath.ts`

Anchors to dense polyline via a centripetal Catmull-Rom spline, plus
arc-length traversal. `catmullRomPath`, `pointAtArc`, `indexAtArc`,
`offsetPath`. Arc-length space is what tapered strokes and travelling
highlights both work in.

## `taperedStroke.ts`

Variable-width strokes, which canvas `lineWidth` cannot do. Both build a
filled polygon by offsetting the path along its normals.

- `taperedStroke(ctx, path, { widthAt, fillStyle, from, to, alpha })`
- `taperedGradientStroke(ctx, path, { from, to, widthAt, colorAt, stops })`
  — one shape filled with a gradient along its length. Deliberately not a
  run of abutting quads: translucent quads composite twice where they
  overlap and seam where they do not, which reads as beading.

## `maskSampler.ts` — *particle-from-mask*

Turn any drawn shape into a particle field. Draw it once into an offscreen
canvas, read the pixels, rejection-sample against them. The shape need not
be expressible as a formula — silhouettes, letterforms, scribbled guide
curves all work.

- `renderMask(w, h, draw)` → alpha coverage.
- `coverageField(w, h, draw)` → the same as a 0..1 weight, for softly
  stroked guide curves used as a density field.
- `distanceField(mask, inside)` → two-pass chamfer transform; distance to
  the edge from inside, or to the shape from outside.
- `sampleFromMask({ mask, count, grid, seed, weightAt, inside, bounds })`
  → grid-snapped points, one per cell.
- `maskBounds(mask)`.

Two things make the result read as structure rather than dust: weighting
density by a distance field (crowd the outline) and by a coverage field
(crowd interior features that are never themselves drawn); and snapping to
a grid, one particle per cell, which gives a quantised digital character.

**Sample once, in `useMemo`.** Re-sampling per frame is the mistake that
makes a particle subject boil.

```ts
const mask = renderMask(w, h, (ctx) => ctx.fill(shape));
const dist = distanceField(mask, true);
const pts = sampleFromMask({
  mask, count: 5000, grid: 9, seed: "subject",
  weightAt: (x, y, i) => 0.2 + 0.8 * Math.exp(-dist[i] / 17),
});
```

## `particleField.ts`

Gives sampled points the identity they need to move, and draws them.

- `buildParticleField(points, opts)` — twinkle cycle, closed drift orbit,
  brightness tier, and an optional second home to churn between (fade out,
  swap, fade in, twice per loop, both swaps hidden inside a fade).
- `drawParticleField(ctx, field, { frame, duration, colors, pulseAt,
  minBrightness, sizeScale, alphaScale })`.

`minBrightness` filters to the brightest slice, which is how a bloom
source pass is made. `pulseAt` is an allocation-free callback that writes
a brightness boost and a small displacement into a reused object.

## `DrawCanvas.tsx`

A canvas that redraws exactly once per React render, in a layout effect so
it is painted before the frame is captured. Backing store size is
independent of display size — passing a smaller one is a deliberate and
useful trick for low-frequency layers.

## `FlowRibbons.tsx`

Long sweeping curved lines with travelling highlights. Subject-agnostic
background motion: lines entering and leaving the frame edges, each
carrying two or three short bright segments that travel along it. The
lines sit close to the background colour; the highlights are what make
them visible, which keeps them from competing with the subject.

Anchors are laid out with alternating offsets from the entry-exit chord,
which forces two or three genuine inflections rather than one lazy arc.

`buildRibbons(opts)` / `drawRibbons(ctx, ribbons, opts)` / `<FlowRibbons>`.
Split so one set can be drawn as a back layer, a front layer, and a
`highlightsOnly` bloom pass.

## `UIGlyphField.tsx`

Scattered generic HUD marks: bordered squares with simple line icons
(magnifier, document, home, chevron, crosshair), horizontal bar groups
whose lengths breathe, triangles, bracket pairs, dot rows. Placement is
rejection-sampled toward the frame edges and away from an exclusion disc,
so the subject keeps a clear surround. Seeded flicker, with windows that
wrap across the loop boundary.

`buildGlyphs(opts)` / `drawGlyphs(ctx, field, opts)` / `<UIGlyphField>`.

## `finishPasses.tsx`

`<BloomPass>`, `<VignettePass>`, `<GrainPass>`. All three render into a
buffer much smaller than the frame and are scaled back up — at 4K that is
half a million pixels of fill per pass instead of 8.3 million, and the
result is indistinguishable once blurred, darkened or dithered.

`<BloomPass>` takes a `draw` callback rather than an image: redraw only
the bright elements into the reduced buffer and let a CSS blur plus a
screen blend do the rest. Two passes at different radii read as a generous
bloom; one alone reads as a smudge.

`<GrainPass>` reseeds from `frame % duration`, so grain is deterministic,
never repeats within a loop, and lines up when the loop restarts.

---

## Used by

- `particle-brain` — 4K particle brain, 600 frames at 30fps.
