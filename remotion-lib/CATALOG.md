# remotion-lib — CATALOG

Deterministic, palette-agnostic 2D-canvas building blocks for Remotion pieces.

Everything here obeys the same contract:

- **Deterministic.** All randomness goes through Remotion's `random()` with
  stable seeds. No `Math.random()`, no `Date.now()`, no `requestAnimationFrame`,
  no CSS animation, no component state. Motion is always a pure function of
  `useCurrentFrame()`, so `npx remotion render` is reproducible and frames may
  be produced out of order across workers.
- **Palette-agnostic.** No colour is hardcoded. Every colour, proportion and
  period is a parameter.
- **Loop-safe.** Components take a `loopLength` and every default period
  divides it, so frame 0 and frame `loopLength` are pixel-identical.
- **2D only.** Plain `CanvasRenderingContext2D`. No WebGL, no Three.js.

Import from `src/index.ts`.

---

## Utilities

### `random.ts`
Seeded random helpers over Remotion's `random()`.

| Export | Purpose |
| --- | --- |
| `rand01(seed)` | Uniform in `[0, 1)`. |
| `randRange(seed, min, max)` | Uniform in `[min, max)`. |
| `randInt(seed, min, maxExclusive)` | Integer in range. |
| `randPick(seed, items)` | Stable pick from a list. |
| `mulberry32(seed)` | Cheap integer PRNG for bulk generation. |
| `seededStream(seed)` | `mulberry32` seeded from a stable string — use for noise tiles and other bulk work where a `random()` call per value would be too slow. |
| `DIVISORS_OF_360` | Periods that divide a 360-frame loop exactly. |

### `canvas.ts`
| Export | Purpose |
| --- | --- |
| `useCanvas2D(draw)` | Ref for a `<canvas>`; runs `draw` once per React render, before paint, on a context reset to a clean state. |
| `resetContext(ctx)` | Puts a 2D context back to defaults. |
| `offscreen(w, h)` | Detached canvas + context. |
| `hexToRgb`, `rgba`, `mixRgba` | Hex → canvas colour strings with alpha. |
| `lerp`, `clamp`, `frac`, `cyclePhase`, `TAU` | Small maths. |

### `sprites.ts`
Pre-rendered radial light sprites. Building a `createRadialGradient()` per
point per frame is the second most expensive mistake at 4K.

| Export | Purpose |
| --- | --- |
| `lightSprite(color, coreStop?, falloff?)` | Cached white-hot-core glow sprite in any hue. |
| `blitSprite(ctx, sprite, x, y, w, h, alpha)` | Centred blit. Non-uniform `w`/`h` gives an anamorphic streak for free. |

### `glyph-atlas.ts`
Rasterise each distinct character **once** per (size × colour), then blit.
Laying out thousands of glyphs per frame with `fillText()` is the expensive
mistake at 4K.

| Export | Purpose |
| --- | --- |
| `glyphAtlas({fontSize, color, fontStack, generation, glyphs?, fontWeight?})` | Cached single-row atlas. `generation` busts the cache when the font face changes. |
| `blitGlyph(ctx, atlas, index, x, y, scale?)` | Blit one glyph, optionally scaled for reduced-resolution buffers. |
| `DEFAULT_GLYPHS` | Digits, letters and symbols. |

### `three-buffer-dof.ts`
Depth-of-field for large numbers of 2D sprites: bucket by depth into three
offscreen buffers and blur each **once**, instead of blurring per object. The
near bucket is the most blurred, so it is also rendered at reduced resolution —
the blur hides the downscale and the 4K memory saving is substantial.

| Export | Purpose |
| --- | --- |
| `createThreeBufferDOF(w, h, buckets?)` | `{contexts, scales, clear(), composite(ctx, w, h)}`. Create once (`useMemo`), reuse per frame. |
| `DEFAULT_DEPTH_BUCKETS` | far (1.0, no blur) → mid (0.85, 1.6px) → near (0.6, 5px). |
| `bucketForDepth(z, count?)` | Bucket index from normalised depth. |

### `neon-stroke.ts`
Multi-pass glowing line whose brightness varies along its length: each segment
is stroked wide-and-faint for glow, then narrow-and-bright for the line, every
pass using an *end colour → body colour → end colour* gradient. Give the
endpoints the colours of whatever sits there and the light reads as travelling
inward along the line.

| Export | Purpose |
| --- | --- |
| `neonStroke(ctx, segments, {baseWidth, bodyColor, passes, blendStop?})` | Strokes every segment once per pass. Set `globalCompositeOperation = "lighter"` first for the additive neon look. |

## Post passes

### `bloom-pass.ts`
`bloomPass(ctx, source, w, h, {wideRadius, tightRadius, wideStrength, tightStrength})`
— additive two-radius glow from a low-resolution bright-pass buffer (typically
1/6 of the destination). Draw only what should glow into the buffer; the
upscale is part of what makes the glow wide and cheap.

### `vignette-pass.ts`
`vignettePass(ctx, w, h, strength, inner?, falloff?)` — radial corner
darkening. `strength` is the alpha at the extreme corners (`0.22` = a ~22%
vignette). Uses plain alpha, so it works on a separate stacked overlay canvas
where canvas blend modes cannot reach the layers below.

### `grain-pass.ts`
`grainPass(ctx, w, h, loopedFrame, alpha)` — fine film grain tiled from 16
pre-generated 256px noise tiles. Tile choice and sub-tile offset are seeded on
the looped frame, so grain is deterministic and repeats exactly once per loop.
Tile pixels are bimodal with a magnitude-driven alpha, so mid-grey noise stays
transparent and the pass adds speckle without a grey haze over the blacks.

## Components

### `<CornerNodeFrame>`
An outlined rectangular frame with bright multi-hue corner nodes, for title
plates. Configurable proportions and position.

- Four corners, four different hues, each node a small intense point inside a
  wide soft halo, each pulsing on its own period, each emitting a wide flat
  anamorphic streak.
- Outline brightness varies along its length — brightest at the corners,
  dimmest at edge midpoints (via `neonStroke`).
- A faint highlight travels the perimeter, completing a whole number of
  circuits per loop.
- Interior deliberately left empty; an optional `interiorScrim` calms whatever
  is behind the plate so a title stays legible.

Key props: `width`, `height`, `loopLength`, `rect`, `lineColor`, `coreColor`,
`nodeColors` (per corner), `strokeWidth`, `nodeHaloRadius`, `streakScale`,
`streakAspect`, `highlightCircuits`, `highlightTail`, `pulse`, `strokePasses`,
`interiorScrim`, `bloom`.

### `<CharacterRain>`
Falling glyph columns with per-column speed and depth.

- Each column has its own seeded speed, size, opacity and z; z drives size,
  speed, opacity and blur (near = large, fast, soft; far = small, slow, sharp).
- Blur via `threeBufferDOF`: three depth buckets, one blur each.
- Leading characters brightest, fading toward the trailing end, so a column
  reads as a streak; characters reroll individually as they fall.
- Column spacing is irregular by construction — clusters and gaps, not a grid.
- Every column completes a whole number of traversals per loop.

Key props: `width`, `height`, `loopLength`, `columns`, `minGlyphSize`,
`maxGlyphSize`, `colors` (`bright`/`mid`/`dim`), `seedKey`, `fontStack`,
`fontGeneration`, `glyphs`, `buckets`, `bloom`, `headBloomColor`.

---

## Not yet in the library

`drawOn` (progressive path reveal) and `threeBufferDOF`'s 3D cousin have not
been needed by a piece here yet. Add them when a second piece wants them —
extract on the second use, not the first.

## Consuming the library

Remotion bundles from a project root, so projects vendor a copy of `src/` into
their own `src/lib/` (`node scripts/sync-lib.mjs`) rather than importing across
the filesystem. That also keeps a project's distributable ZIP standalone. The
canonical source is this repository; edit here and re-sync.

---

## Performance notes (learned the hard way)

- **Never set `ctx.filter` per draw call.** Chromium allocates a filter layer
  for each filtered draw, so a few dozen short blurred strokes at 4K can cost
  more than every other layer in a composition combined — measured at roughly
  a 3x whole-render regression from one glow effect. Draw the thing that
  should glow into a small buffer instead and blur it **once** (`bloomPass`),
  or blur a whole buffer on its way to the destination (`threeBufferDOF`).
- **`--scale` does not make a render cheaper.** It changes the screenshot
  size, not the canvas backing store, so a "1080p preview" of a 4K composition
  does exactly as much drawing as the 4K render.
- **Rasterise once, blit many.** `glyphAtlas` for text, `lightSprite` for
  glows. Both cache; neither re-rasterises per frame.
- **Create offscreen buffers in `useMemo`, never per frame.** A 4K RGBA
  surface is ~33 MB.
