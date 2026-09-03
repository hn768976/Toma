# remotion-lib

Reusable pieces for deterministic 2D canvas work in Remotion.

Everything here obeys the same three rules, which is what makes a component
eligible for this catalogue in the first place:

- **Deterministic.** No `Date.now()`, no `Math.random()`, no
  `requestAnimationFrame`, no component state. Randomness routes through
  Remotion's `random()` with stable string seeds, so a value survives frames
  being rendered out of order across workers.
- **Palette-agnostic.** No module below holds a colour value. Colours arrive as
  parameters; components that need several take a small named object rather
  than a project's palette type.
- **Fully parameterised.** No project constant is imported. Frame size, loop
  length and periods are arguments.

Consumers vendor these files (copy them in) rather than depending on a package,
so a project can be zipped and rendered standalone.

---

## random/seeded.ts

Seeded randomness over Remotion's `random()`.

| Export | Purpose |
| --- | --- |
| `rand(seed)` | Deterministic value in `[0, 1)`. |
| `randRange(seed, min, max)` | Float in a range. |
| `randInt(seed, min, max)` | Integer in an inclusive range. |
| `pick(seed, items)` | One item from a list. |
| `chance(seed, p)` | Boolean true with probability `p`. |
| `shuffled(seed, items)` | Seeded Fisher-Yates copy. |
| `makePrng(seed)` | A stateful `() => number` stream, for tight inner loops where a per-value string seed would be wasteful. |

String seeds rather than an index into a shared stream: a value's identity then
survives elements being added or reordered.

## color/hex.ts

| Export | Purpose |
| --- | --- |
| `toRgb(hex)` | `#RRGGBB` to an `[r, g, b]` triple. |
| `withAlpha(hex, a)` | `#RRGGBB` to `rgba(...)`. |
| `mix(a, b, t)` | Blend two hex colours to an `rgb()` string. |
| `mixHex(a, b, t)` | Blend two hex colours back to hex — useful for deriving a dim companion tone from two colours a design actually specifies, instead of inventing a third. |

## geometry/polyline.ts

Pure 2D maths. `Vec2`, `Arc` and `Rect` types plus:

| Export | Purpose |
| --- | --- |
| `cumulativeLengths(points)` / `polylineLength(points)` | Arc-length tables. |
| `pointAtT(points, cum, t)` | Point at normalised arc length — *uniform speed*, which is what stops a travelling dot lurching where a sampled curve's segments bunch up. |
| `sampleArc(arc, steps)` / `arcPoint(arc, t)` | Sample a circle segment. |
| `arcThroughPoint(p, r, angle, sweep, side)` | Build a large arc guaranteed to pass through a given point — how a rail is made to intersect a hub. |
| `distToSegment` / `distToPolyline` | Point-to-line distance, for hit tests. |
| `distanceToFrameEdge(p, dir, w, h)` | How far a ray travels before leaving the frame. |
| `circleHitsRect(centre, r, rect, pad)` | Circle/rect overlap with padding. |
| `inFrameSpan(points, cum, w, h, margin)` | The span of normalised arc length over which a polyline stays on screen. Essential when stratifying items along a curve much larger than the frame — without it, slots allocated to off-screen stretches simply never place. |

## canvas/pen.ts

Drawing primitives for line icons authored in a normalised `0..1` box and
scaled to any pixel size, so one definition serves every size in a frame and
re-renders crisply instead of upscaling a bitmap.

`pen(ctx, size)` returns a `Pen` of normalised helpers (`line`, `poly`,
`rect`, `roundRect`, `circle`, `arc`, `dot`, …). The caller owns
`strokeStyle` / `lineWidth` / `lineCap`; **primitives never set a colour**,
which is what lets one icon set serve several palettes. `IconDraw` is the
`(ctx, size) => void` signature an icon implements.

## canvas/Layer.tsx

`<Layer draw width height left top />` — one `<canvas>` whose backing store is
the real pixel grid, painted once per React render in a layout effect. No
`requestAnimationFrame`: a frame is a pure function of its number.

## canvas/passes.ts

| Export | Purpose |
| --- | --- |
| `makeOffscreen(w, h)` | Detached canvas for draw-once/blit-many content. |
| `prepareLayer(canvas, w, h)` | Size and clear a layer's context. |
| `makeBloom(w, h, steps)` | Reusable bloom. Applied **per layer** rather than once over the composite, so one layer can bloom generously while another barely glows. |
| `vignettePass(ctx, w, h, strength, color)` | Radial darkening. |
| `makeGrainTiles()` | Pre-rendered grain tiles. |
| `grainPass(ctx, w, h, frame, alpha, tiles, loopFrames)` | Tiled grain whose tile and offset derive from `frame % loopFrames`, so grain matches at both ends of a loop instead of popping at the seam. |

## canvas/rings.ts

HUD ring construction.

| Export | Purpose |
| --- | --- |
| `brokenArcRing(seed, count, spanRange?, gapRange?)` | A ring of `count` arc segments with **unequal lengths and unequal gaps**, normalised to close the circle exactly. Equal segments read as a measuring dial rather than as instrumentation, so the default ranges are deliberately uneven. |
| `strokeArcRing(ctx, segments, centre, r, w, color)` | Strokes those segments. |
| `strokeTickRing(ctx, centre, options)` | A ring of fine radial ticks. Majors may differ from minors in length at *both* ends, in weight and in alpha. |

`count` ticks have a symmetry period of `2π/count`, so a tick ring loops
seamlessly when rotated a whole number of tick steps — it does not need a
whole turn. That is what lets a slow counter-rotation close a short loop.

## layout/satelliteLayout.ts

**The layout mode branch.** `buildSatelliteLayout(options)` places N nodes
around a hub and returns their positions plus the connector paths joining
them. It takes a `mode` and both modes return the same shape, so a renderer
draws either arrangement without knowing which one it was given.

```ts
const layout = buildSatelliteLayout({
  mode: "radiating",            // or "arcs"
  count: 14,
  icons: ["chip", "cloud"],     // any string union
  hub: {x: 1920, y: 1080}, hubRadius: 259,
  width: 3840, height: 2160,
  seed: "hub/ai", exclusions: panelRects,
  loopFrames: 450, dotPeriods: [50, 75, 90, 150, 225],
});
const {dots, boosts} = resolveFrame(layout, frame, 450);
```

| Mode | Arrangement |
| --- | --- |
| `"radiating"` | Nodes burst from the hub at deliberately uneven distances and jittered angles. Paths are straight hub spokes **plus node-to-node cross-links** — the cross-links are what make it read as a network rather than a star. |
| `"arcs"` | Nodes are beads strung along a few large intersecting circle segments sweeping across the frame. The hub sits where two of them cross and there are **no spokes at all**: the arcs themselves are the connective tissue. |

Node positions are static — a pure function of seed and frame size — so build
once and memoise. `resolveFrame` is the only per-frame call, returning
travelling-dot positions and a per-node `boost` for a dot passing through it.

`exclusions` are rectangles nodes must avoid (side chrome); without them a
node can land on a panel, which reads as a mistake rather than as depth.

Every entry in `dotPeriods` must divide `loopFrames`, or dots jump at the seam.

Nothing here knows about colour: nodes carry a `bright` weight and paths a
`"dim"`/`"bright"` tone, which the caller maps onto its own palette. The icon
name is a free type parameter, so any registry works.

## components/IconNode.tsx

`<IconNode node drawIcon colors boost />` — one satellite: a line icon,
optionally inside a thin circle, optionally with a short connector stub.

Each node owns a canvas sized to its own footprint rather than sharing a
full-frame layer, which is what lets a bright node bloom hard while a dim one
barely glows. Icon geometry is rasterised **once** per
`(icon, size, weight, colour)` into a module-level sprite cache and blitted
after that; per-frame brightness is an alpha on the blit, since the sprite is
single-colour line work.

It takes two explicit colours (`stroke`, `stub`) and a `drawIcon` callback
rather than a palette or a registry, and it does not know how its node was
positioned — a bead on an arc and the endpoint of a radial spoke render
through exactly the same path.
