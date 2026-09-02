# remotion-lib

Reusable, deterministic building blocks for Remotion scenes. Everything here is:

- **Palette-agnostic** — colour enters through props, never through a constant
  inside a component.
- **Deterministic** — every varying value comes from a seeded hash of a stable
  string, so a scene renders identically on every machine, in any frame order,
  across any number of workers.
- **Loop-safe** — periodic motion is expressed in whole cycles per loop and
  reduced through `loopSin`/`loopCos`, so the first and last frame of a loop
  come out bit-identical rather than merely similar.

There is no build step and no package: import the `.ts`/`.tsx` files directly,
or vendor `src/` into a project that needs to ship standalone.

Peer dependencies: `react`, `remotion`.

---

## Components

### `<SvgSilhouetteField>` — `src/SvgSilhouetteField.tsx`

Places ONE source SVG many times across the frame with a seeded flip, scale,
shear, rotation, squash and depth per instance, and blurs the whole band once.
Stack several at different depths for a treeline, a skyline, a crowd, a reed
bed, a mountain range.

Two things make it work rather than look like wallpaper:

- The band is assembled into its own offscreen buffer and blurred **once** on
  the way out. Blurring per instance is one blur pass per instance per frame,
  which is unusable at 4K for any interesting count.
- Scale comes from a golden-ratio low-discrepancy sequence over the instance
  index, not a plain random draw. A random draw regularly puts two same-size
  instances side by side, and two same-size instances of one silhouette — one
  flipped — read instantly as a mirrored stamp.

Also draws an optional irregular ground ridge, which hides the flat cut where
the source artwork ends and gives each band its own receding ground line.

```tsx
<SvgSilhouetteField
  sprites={sprites}          // from useSvgSprites
  band={{ count: 40, baseHeightFrac: 0.19, scaleMin: 0.45, scaleMax: 1.5, ... }}
  seed="forest-far"
  driftAmount={4}            // parallax: give nearer bands a larger value
  ridgeColor="#3A3A42"
  loopFrames={240}
/>
```

Exports `buildSilhouetteBand()` separately if you want the placement without
the rendering.

### `useSvgSprites()` — `src/useSvgSprites.ts`

Loads an SVG, rasterises it once, and returns a small set of pre-tinted
bitmaps indexed by depth. Takes `tintAt: (t: number) => string`, which is what
keeps it palette-agnostic.

Exists because the two obvious approaches are both unusable at 4K: re-parsing
the SVG per instance per frame, and giving each instance its own `source-in`
recolour pass. Quantising the tint up front reduces every instance to a single
`drawImage()`.

Rewrites the SVG's intrinsic size before decoding, so Chrome rasterises the
vector at full resolution instead of rasterising small and scaling up. Reads
the aspect from the `viewBox`.

### `<FogLayer>` — `src/FogLayer.tsx`

Drifting volumetric haze: broad, wider-than-tall blobs composited with
`lighter` at very low alpha, then blurred until no blob edge survives. Blobs
cluster into horizontal strata, so it reads as banded haze at particular
heights rather than an even mist. Optional angled light shaft.

Stack **two or more at different points in the layer order** — one behind the
mid-ground, one in front of it. That interleaving is what creates depth; blur
alone just looks soft.

Computed into a small backing store (1/8 of the composition by default) and
upscaled, with the blur radius scaled to match. It is all soft gradient, so
nothing is lost and it is roughly a quarter of the cost.

### `<ParticleDriftField>` — `src/ParticleDriftField.tsx`

Small drifting particles travelling steadily in one vertical direction with a
horizontal wander, wrapping when they leave the frame.

One system covers behaviours that look nothing alike:

| | rising embers | falling snow |
|---|---|---|
| `direction` | `1` | `-1` |
| `flicker` / `opacityDrift` | flicker | drift |
| `coreHardness` | `1` (hot core) | `0` (soft) |
| `blend` | `lighter` (light) | `source-over` (matter) |
| `rotate` / `spriteAspect` | off / `1` | on / `0.72` |
| wander | narrow | wide |

Writing those as two systems is a mistake — the sign and the flags are the
whole difference.

Loop-safety details worth knowing: each particle completes a whole number of
traversals; a particle that wraps re-enters at a **new** seeded x, but the lane
list is indexed by lap modulo its own cycle count, so after a full loop it is
back on the first lane. Flicker is two sines at incommensurate periods
*multiplied*, both dividing the loop, which gives an irregular spark rather
than a clean pulse.

Exports `buildParticles()`, `particleAt()`, `buildParticleSprites()` and
`drawParticle()` for callers that need to run the same model over a different
span (a dense bed along the ground, say) inside their own layer.

### `<GrainVignettePass>` — `src/GrainVignettePass.tsx`

Radial vignette plus fine film grain, as a finishing overlay.

The grain tile is seeded on `frame % loopFrames`, so in a looping composition
the last frame's grain is byte-identical to the first frame's. Grain seeded on
the raw frame number is the most common reason an otherwise perfect loop still
ticks. A tile is generated and repeated rather than filling the frame directly
— at 4K that is 8.3M random samples per frame versus ~590k, and at the alphas
grain is used at, the repeat is not detectable.

---

## Helpers

### `src/random.ts`
`rnd`, `rndRange`, `rndPow`, `rndInt`, `rndPick`, `rndBool` — seeded values
from stable string keys, built on Remotion's `random()`. Plus `mulberry32` for
the rare case where a hash per value is too slow (a grain tile), and `wrap`,
`lerp`, `clamp`.

Remotion renders frames out of order across worker processes, so anything that
is not a pure function of (identity, frame) will flicker. Everything
per-instance should come from here; nothing from `Math.random()`.

### `src/color.ts`
`hexToRgb`, `rgbToCss`, `mixRgb`, `mixHex`, `withAlpha`, `rampAt`.

Note that `mixHex` returns an `rgba()` string, not hex, so it cannot be fed
back into `mixHex` or `withAlpha` — that yields `rgba(NaN, ...)` and a
`DOMException` from `addColorStop`. Pass the alpha to `mixHex` directly.

### `src/loop.ts`
`loopT`, `loopSin`, `loopCos`, `loopAngle`, `cameraDrift`.

The trap these exist to avoid: `sin(phase + 2*PI*cycles)` is algebraically
equal to `sin(phase)` but not bit-identical in floating point, and that is
enough to change the odd pixel between the first and last frame. These reduce
the argument with a wrap **before** the trig call, so a loop check comes back
at zero differing pixels rather than "close enough".

`cameraDrift` is a small closed figure-of-eight. Give each depth layer a
different amplitude and the difference between them is the parallax.

### `src/useLayerCanvas.tsx`
`useLayerCanvas` and `<LayerCanvas>` — mount a full-bleed canvas and draw once
per React render, synchronously before paint. No `requestAnimationFrame`, no
component state.

The backing store need not match the composition: a layer that is entirely
soft gradient can use a much smaller one and let the browser upscale.

### `src/bloom.ts`
`applyBloom` — downsample what has been drawn, blur it, add it back with
`lighter`. Apply per layer, to the layers that should glow. Blooming the whole
composited frame lifts everything pale — fog, haze, a light sky — which is
almost never what is wanted.

### `src/noiseEdge.ts`
`buildEdgeProfile`, `edgeAt` — a seeded static sum-of-sines for any boundary
that must not be a straight line: a ground ridge, a snow line, a hill, the top
of a liquid. A straight horizontal boundary reads as a gradient or a graphic
device; an irregular one reads as a thing.

Evaluate the same profile again at `u * 3.1` and add it at a smaller amplitude
to get broad drifts with finer lumps riding on them.

---

## Conventions

- Components read `useCurrentFrame()` and `useVideoConfig()` themselves.
- `loopFrames` defaults to the composition duration; override it when the loop
  is shorter than the composition, or when a composition is given one extra
  frame so frame N can be compared against frame 0 to prove the loop closes.
- Sizes are expressed as fractions of the frame wherever they are art
  direction, and in composition pixels wherever they are optical (blur radii,
  particle diameters).
- Seeds are strings, hierarchical, and stable: `"<scene>-<layer>-<index>"`.

## Verifying a loop

Register the composition a second time with `durationInFrames + 1`, pass
`loopFrames` explicitly, render stills at frame 0 and frame N, and compare.
Anything other than zero differing pixels means something periodic is not on a
whole cycle count, or is seeded on the raw frame number.

## Consumers

- `Toma/remotion-video` — `ForestEmber` / `ForestFrost` (4K, 240 frames).
  Vendors `src/` into `src/lib/` so the project ships standalone; the copy is
  byte-identical.
