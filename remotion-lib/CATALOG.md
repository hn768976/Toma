# remotion-lib — catalogue

Source-only shared components for Remotion canvas work. Nothing here is
published as a package: **copy the files you need into a project's `src/`**,
keeping the `lib/` + `components/` layout so the relative imports resolve
unchanged. Every entry is deterministic (a pure function of a seed and the
frame number), palette-agnostic (colours arrive as parameters, never as
literals) and free of `Math.random`, `Date.now`, `requestAnimationFrame`,
CSS animation and component state.

---

## components/PerspectiveCorridor.tsx — `<PerspectiveCorridor>`

**The important one.** A faked two-plane corridor: it places arbitrary
elements on a floor and a ceiling converging to a horizon, and derives scale,
speed, opacity and blur from each element's depth.

There is no camera and no projection matrix. A horizon sits at a configurable
height with a vanishing point on it; elements carry a depth `d` in (0, 1] where
d→0 is the horizon and d→1 is the camera. `y` interpolates from the horizon to
the plane edge on a **squared** curve — that is what produces perspective
compression, and the difference between a corridor and a flat ramp. `x` spreads
from the vanishing point in proportion to `d`, so lanes diverge as they
approach. Depth advances linearly, which makes screen speed proportional to `d`.
Elements exit past the frame edge and recycle to the horizon; opacity reaches
zero at both ends of the cycle so the recycle is invisible.

**The engine does not know what it is drawing.** Element groups are supplied as
children via the `useCorridorGroup` hook, each contributing element records and
a renderer function `(ctx, element, projected, api) => void`. Swapping the
children is the whole difference between one look and another.

Depth of field is three offscreen buffers (far / mid / near) bucketed by depth
with cross-faded boundaries and blurred **once each** — per-element blurring is
unusably slow at 4K. The blurred buckets render and blur at reduced resolution
and scale back up, which is invisible and costs a quarter of the fill rate.

```tsx
<PerspectiveCorridor order={40} geo={geo} frame={frame} loop={375}
  palette={palette} blend="lighter" dof={{far: 9, near: 26}}>
  <MyElements order={10} />
</PerspectiveCorridor>
```

Requires `lib/perspective`, `lib/dofBuffers`, `lib/canvasLayers`, `lib/math`.

## components/CorridorBackdrop.tsx — `<CorridorBackdrop>`
Deep fill plus a wash that lifts toward the horizon and falls off at the left
and right edges. Colours: `deep`, `wash`, `shadow`.

## components/HorizonGlow.tsx — `<HorizonGlow>`
Soft bright bloom centred on the vanishing point, stacked radial gradients plus
an ellipse stretched along the horizon. Pulses ±8% on a sine whose period must
divide the loop length. Makes a corridor read as receding into light rather
than into nothing. Colour: `color`.

## components/BokehLayer.tsx — `<BokehLayer>`
Soft out-of-focus discs with a faint rim, drifting on closed Lissajous paths
with integer frequencies over the loop. Radial gradients, so no blur filter and
no buffer. Render it twice over disjoint index ranges (`from`/`to`) to put some
discs behind the subject and some in front. Colours: `colorA`, `colorB`.

## components/FinishPass.tsx — `<FinishPass>`
Bloom → vignette → grain, in that order, reading the finished frame back out of
the target canvas. Colour: `vignetteColor`.

---

## lib/canvasLayers.tsx — `<CanvasStage>`, `useCanvasLayer`
One `<canvas>` that a tree of layer components draws into, in `order`.
Layers register a draw callback during render; the stage runs them in a layout
effect, which React guarantees happens after all children have rendered and
before the browser paints — so a frame grabber always sees a finished frame.
Redraws exactly once per React render: no rAF, no state, no timers.

## lib/perspective.ts
The projection itself: `CorridorGeometry`, `projectPoint`, `project`,
`depthAlpha`, `bandMask` (the open band kept clear for a title), and
`depthBuckets` (cross-faded depth-of-field bucketing).

## lib/dofBuffers.ts — `DofBuffers`
N offscreen buffers with per-bucket resolution scale and blur radius. Callers
always draw in full-resolution coordinates. `composite()` blurs each buffer
once and stacks them.

## lib/taperedStroke.ts — `taperedStroke`
Draws a polyline as a single filled ribbon whose width varies per point and
whose opacity varies via a gradient laid along the chord — one fill, no seams.
Splitting the ribbon into constant-alpha bands is the obvious implementation
and the wrong one: under additive blending the bands overlap at their shared
vertices and stripe the stroke. Colour via a `colorAt(alpha, t)` builder.

## lib/bloomPass.ts — `BloomPass`
Downsample → square (a threshold-free bright pass; on a near-black scene
squaring crushes the background and keeps the highlights) → blur → add back.
Runs at quarter resolution, which is free quality for a low-frequency effect.

## lib/vignettePass.ts — `VignettePass`
Cached radial darkening toward the corners. `amount` is the corner alpha.

## lib/grainPass.ts — `GrainPass`
Fine film grain from a pool of seeded noise tiles cycled by frame number, with
a tiling offset that closes on the loop. Tiles come from a mulberry32 stream
seeded through `random()`, so every render worker builds byte-identical tiles.
Pool size must divide the loop length.

## lib/seededRandom.ts
`rand`, `randRange`, `randInt`, `randPick`, `randSign`, `randChance` over
Remotion's string-seeded `random()`, plus `mulberry32` for bulk work where
hashing a string per sample would be too slow.

## lib/color.ts
`hexToRgb` (cached), `rgba(hex, alpha)`, `mixRgba(hexA, hexB, t, alpha)`.

## lib/math.ts
`clamp`, `lerp`, `smoothstep`, `frac` (positive modulo), `TAU`.

---

### Loop discipline
Anything that moves must complete a whole number of cycles in the loop length:
element traversals, glow pulses, bokeh drifts, grain tile pools and tiling
offsets. Verify by rendering frame 0 and frame `loop` and comparing bytes.
