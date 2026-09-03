# remotion-lib

Reusable, deterministic Remotion pieces. Everything here is:

- **frame-pure** — a function of `useCurrentFrame()` only. No `Date.now()`, no
  `requestAnimationFrame`, no CSS animation, no component state, so
  `npx remotion render` is deterministic and frames may be produced in any
  order across workers.
- **seeded** — all randomness via Remotion's `random()` with caller-supplied
  string seeds.
- **palette-agnostic** — no component contains a colour literal. Every colour
  is a prop.
- **resolution-agnostic** — sizes are passed in; authored and tested at 4K.

Import paths below are relative to `src/`.

---

## core/seeded-random

`rnd`, `rndRange`, `rndInt`, `rndPick` — thin, readable wrappers over
Remotion's `random()` with string seeds.

`mulberry32(seed)` — a fast integer PRNG for **bulk per-pixel work only**
(film grain and the like), where a million `random()` calls per frame would
dominate the render. Seed it from `random()` so the output stays a pure
function of the frame.

## core/color

`hexToRgb`, `rgba(hex, alpha)`, `mix(a, b, t)`, `mixRgba(a, b, t, alpha)`.
Hex parsing is memoised; the draw loops call these tens of thousands of times
per frame.

## core/canvas

`createBuffer(w, h)` — a detached backing canvas, `null` during SSR.
`clear(canvas)` — clears and returns the 2D context.

---

## mesh/node-field

The geometry behind `<NodeMesh>`.

```ts
const nodes = generateNodes(count, seedKey, width, height, margin);
const mesh = computeMeshFrame(
  nodes, frame, duration, threshold, maxConnections, wantTriangles,
  width, height, margin,
);
// mesh: { x, y, bright, edges, triangles }
```

- Points are seeded on a jittered grid across the frame **plus a margin**, so
  the field has no visible border and edges run in from off-screen.
- Each node carries a depth `z` in [0.2, 1.0] and drifts along its own closed
  two-harmonic path, returning exactly to its start at `duration`. Drift
  amplitude scales with `z`, so near nodes move faster — that parallax is what
  makes a flat field read as volumetric.
- `bright` combines a seeded brightness pulse (period always divides the loop)
  with short seeded flashes; flashes use cyclic frame distance so one
  straddling the loop point still closes.
- Edges are rebuilt from scratch each frame. Alpha falls off with length and
  reaches **exactly zero** at `threshold`, so edges fade rather than pop.
- The per-node cap is **continuous**: a node's edge strengths may sum to at
  most `maxConnections`. Crowded regions dim instead of shedding lines. A hard
  "keep the N shortest" cap blinks visibly — measured on a 220-node field, it
  produced edge transitions at 0.52 strength; the continuous budget caps the
  loudest transition at 0.02.
- Neighbour search uses a uniform spatial grid, not an O(n^2) sweep.
- `triangles` (opt-in) are the mutually connected triples, for `<FacetLayer>`.

## mesh/NodeMesh

`<NodeMesh width height nodes mesh colors [lightBoost] [boostGain]
[depthOfField] [bloom] />`

Draws the edges and node dots with depth of field and an additive bloom pass.

- `colors: { nodeBase, nodePeak, edgeNear, edgeFar }`.
- **Depth of field uses three offscreen buffers** — near, mid, far — bucketed
  by depth and each blurred *once* on composite. Per-element blurring is
  unusably slow at 4K. The mid bucket is the focal band. Near and far render
  at half resolution since the blur hides it.
- `lightBoost(x, y) => 0..1` lets an external light element (a flare, a rising
  bloom) brighten the nodes and edges it passes over.
- Renders two stacked canvases: the mesh, and a `screen`-blended bloom.

## mesh/FacetLayer

`<FacetLayer width height mesh colors opacity />`

Fills the triangles from `computeMeshFrame` with a very low-alpha wash;
`colors.facet` shifts toward `colors.sink` with the triangle's average depth.
Rendered at quarter resolution and blurred once. Keep `opacity` tiny — if the
facets read as solid, a network becomes a low-poly surface. Opacity scales
roughly inversely with triangle count, so retune it when you change density.

---

## light/AnamorphicFlare

`<AnamorphicFlare width height frame duration colors [travel]
[intensityScale] />`

A wide, flat horizontal streak with a hot core that travels across the frame
and exits, twice per loop by default.

- `colors: { core, fringeA, fringeB }` — conventionally white, cyan, magenta.
- **Chromatic fringing is the point.** The streak is composited three times
  with `lighter`: the tinted copies are pushed apart horizontally *far enough
  that their tails run past the core*, and offset vertically so one colour
  rides above the line and the other below. The core is kept short and thin so
  it cannot wash them out. Skip any of those three and it reads as a plain
  white line.
- Secondary ghosts — circles and hexagons — sit along the axis from the core
  through the frame's centre, as a real lens produces.
- `travel: { travelFrames, traversals, heights, startLeftToRight, overshoot }`.
  Intensity fades from and to zero within each crossing, so a cycle boundary
  is never a cut and the whole thing loops.
- `flareStateAt(frame, duration, width, height, travel)` is exported so the
  host can drive `<NodeMesh>`'s `lightBoost` from the same timing.

---

## atmosphere/BokehLayer

`<BokehLayer width height frame duration color pass [count] />`

Defocused discs drifting on closed paths, in one hue. `pass` splits the same
seeded field into `"back"` (behind the subject) and `"front"` (drifting over
it, partially occluding). Half resolution, blurred once — they are out of
focus by definition.

## atmosphere/PostFx

`<PostFx width height frame duration [vignetteStrength] [grainAlpha] />`

Vignette plus film grain. Grain is generated at half resolution from a
`mulberry32` seeded by `random()` on `frame % duration`, then upscaled with
smoothing off — so it is deterministic, cheap, and frame `duration` gets
frame 0's noise exactly, closing the loop. Blended with `overlay`.

---

## Not extracted (candidates)

Built for the network-mesh piece and plausibly reusable, but left in that
project rather than generalised here:

- **`<LightBloom>`** — a broad soft glow rising from below on a breathing
  cycle. Generic in shape, but its `bloomLevelAt` / `bloomTopAt` exports are
  shaped around driving a specific host's node brightening; wants a cleaner
  contract before it moves.
- **`<DustMotes>`** — upward-drifting motes whose brightness is coupled to an
  external bloom level. Same objection.
- **`<BackgroundWash>`** — a base fill plus drifting radial washes. Small
  enough that inlining it is not a burden.
- **`<LabelField>`** — an edge-weighted field of drifting text that rerolls on
  periods dividing the loop. Fully parameterisable, but it carries a
  vocabulary, and the placement (golden angle for the angle, an R2 sequence
  for the radius) is tuned to that content.
