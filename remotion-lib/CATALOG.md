# remotion-lib

Deterministic, palette-agnostic canvas components for Remotion pieces.

Everything here is a pure function of its arguments — no `Date.now()`, no
`requestAnimationFrame`, no module-level state, no randomness of its own.
Anything that needs randomness takes a caller-supplied `rand` callback, so the
caller decides the seeding scheme (Remotion's `random()`, for instance) and a
render stays reproducible.

No component holds a colour. Palettes come in as hex strings or parsed `Rgb`.

Import from `src/index.ts`, or vendor the individual files into a project that
needs to ship standalone.

---

## `colour.ts`

| Export | What it does |
| --- | --- |
| `parseHex(hex)` | `"#RRGGBB"` → `{r,g,b}`, memoised |
| `mixRgb(a, b, t)` / `mixHex(a, b, t)` | linear blend |
| `rgba(c, alpha)` | canvas-ready `rgba(...)` string |
| `clamp(v, lo, hi)`, `TAU` | small numeric helpers |

## `canvas.ts`

| Export | What it does |
| --- | --- |
| `makeBuffer(w, h)` | offscreen canvas with an explicit backing store |
| `Ctx` | alias for `CanvasRenderingContext2D` |

## `taperedStroke.ts`

Variable-width polyline drawing.

| Export | What it does |
| --- | --- |
| `fillTapered(ctx, samples, from, to, widthMul, fill, positions?)` | fills a stretch of polyline as one polygon whose width varies sample by sample; optionally reads positions from a flat `Float64Array` so per-frame offsets don't need the samples rebuilt |
| `chunkRanges(n, size)` | splits a polyline into overlapping index ranges, so colour/alpha/depth bucket can vary along a curve while still using ordinary fills |
| `normalsFor(pts)` | unit normals from each point's neighbours |

A single thick semi-transparent stroke reads flat. Two passes — a wide low-alpha
one and a thin bright one — read as light in a fibre. Per-segment stroking gives
the same result but is far slower at 4K; chunked polygon fills are the cheap way.

## `radialBlob.ts`

| Export | What it does |
| --- | --- |
| `radialBlob(ctx, x, y, r, inner, outer, alpha, stops?)` | soft radial disc; the building block for points of light, defocused highlights and bloom centres |

## `bendingStrand.ts`

A curve that runs along one plane, bends through a configurable angle over a
smooth arc, and continues along another. Subject-agnostic — it knows only a
perspective frame.

| Export | What it does |
| --- | --- |
| `bendingStrandPath(options)` | returns the sampled polyline, the arc's index range and the point where the turn finishes |
| `depthWidth(d, min, max, gamma?)` | depth-derived half-width |
| `depthBrightness(d, nearFalloff)` | depth-derived brightness, with an optional hold-back over the nearest stretch |

Notes that matter in use:

* The turn is a true circular fillet between the two tangents, approximated by
  the cubic bezier that matches a circular arc. It is always a smooth arc,
  never a corner.
* `direction` is signed. `+1` turns toward smaller y after the bend, `-1`
  toward larger y, and `nearEdgeY` decides which side of the horizon the first
  plane lies on. Nothing inside assumes a floor rising into a wall; flipping
  the sign inverts the whole construction.
* Lane offsets scale with `d²`. A linear spread reads as a flat fan rather than
  a plane receding from the camera.
* Seed `radius` per curve and **decorrelate it from `bendDepth`**. If a larger
  radius always begins bending proportionally earlier, every curve reaches the
  second plane at the same height and leaves a visible seam across the frame.

## `depthBuffers.ts`

A three-bucket depth-of-field rig: bucket by depth, draw into per-bucket
offscreen buffers, blur each buffer **once**, composite. Per-object blurring is
unusably slow at 4K; this is three blurs per frame however many objects there
are.

| Export | What it does |
| --- | --- |
| `createDepthBuffers(w, h, specs)` | allocates buffers, each at its own `scale` |
| `clearDepthBuffers(b)` | clears and sets each buffer's device scale, leaving it additive |
| `bucketWeights(d, near, far, feather)` | cross-fade weights `[near, mid, far]` |
| `compositeDepthBuffers(main, b)` | adds each bucket's halo, blurs once, composites furthest first |

A bucket that will be blurred heavily loses nothing at `scale: 0.5` and costs a
quarter as much to blur. Samples in a feather zone are drawn into both
neighbouring buffers at complementary weights; because compositing is additive
the halves sum back to full brightness and the boundary is invisible.

The per-bucket `halo` is what gives every drawn curve its soft glow — once per
bucket rather than once per curve.

## `travellingPacket.ts`

A point of light following a precomputed curve at parameter `t`, with a comet
trail.

| Export | What it does |
| --- | --- |
| `samplePolyline(positions, count, u)` | interpolates a flat `[x,y,...]` polyline at `u` |
| `drawTravellingPacket(ctx, options)` | trail, optional motion smear, and the head |

The point is the curve evaluated at `t`, so it can never drift off what it is
travelling along. The trail is sampled at `t`, `t-step`, `t-2·step` … and drawn
through the curve's **own** points between those parameters, so it bends with
the curve instead of cutting the corner. `smear` draws the head several times
along a motion vector at falling alpha, for packets fast enough to strobe at
30fps.

## `postFx.ts`

| Export | What it does |
| --- | --- |
| `createBloomBuffers(w, h, down?, wideDown?)` | scratch surfaces, allocated once |
| `bloomPass(main, bufs, w, h, opts)` | two-level additive bloom |
| `vignettePass(ctx, w, h, colour, strength)` | radial darkening toward the corners |
| `createGrainTiles(count, size, rand)` | a set of grey noise tiles |
| `grainPass(ctx, tile, w, h, alpha, ox, oy)` | tiles one across the frame in `overlay` |

`bloomPass` does its bright pass by drawing the downsampled frame onto itself
with `multiply`, squaring every channel: darks fall away, highlights survive.
Cycling a small set of grain tiles with a per-frame offset is far cheaper than
full-frame noise, and it closes exactly on a loop whose length is a multiple of
the tile count.

---

## Used by

* `fibre-corridor` — 4K fibre-optic corridor, three variants.
