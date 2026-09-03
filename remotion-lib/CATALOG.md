# remotion-lib

Shared, subject-agnostic building blocks for Remotion pieces.

Everything in here is:

- **fully parameterised** — no piece-specific constants,
- **palette-agnostic** — colours arrive as props, never as hex literals inside,
- **deterministic** — a pure function of the frame and of stable string seeds,
  so frames may be rendered out of order across workers,
- **standalone** — modules depend only on `remotion`, `react` and (where noted)
  `d3-geo` / `topojson-client`.

Vendor the files you need into a project's `src/lib/` so the project's zip
stays self-contained.

## Catalogue

### `TextFillMask.tsx` — shape made of text
`<TextFillMask>` fills an arbitrary shape with a dense field of characters
clipped to it, and rerolls a trickle of those characters over time. The shape
arrives as a rasterised `MaskField`, so the component is completely
subject-agnostic: a map, a logo, a letterform or a silhouette all work the
same way. Characters are drawn from a caller-supplied set, coloured from a
caller-supplied ramp with weighted brightness brackets, and each rerolled
character flashes for a few frames.

Performance: the visible canvas *is* the persistent buffer. When asked for the
frame immediately after the last one drawn, only the cells that changed value
or stopped flashing are repaired in place; every other frame triggers a full
redraw that reconstructs identical state by replaying the reroll stream from
zero. The fast path is a cache, never a source of truth — determinism is not
traded away for it. Glyphs are blitted from a `GlyphAtlas`, never `fillText`ed
per frame.

Needs: `mask-field.ts`, `glyph-atlas.ts`, `use-canvas.ts`.

### `mask-field.ts` — rasterised shape mask + O(1) hit test
`createMaskField(width, height, drawShape)` rasterises any shape once and
returns `{canvas, contains(x, y)}`. `contains` is a single array lookup, which
is what makes testing tens of thousands of candidate points affordable; the
canvas doubles as the clip for `destination-in` compositing.

### `glyph-atlas.ts` — character sprite sheet
`createGlyphAtlas({chars, colors, fontFamily, fontSize, boxWidth, boxHeight})`
rasterises a small character set once per colour into an offscreen sheet, laid
out one row per colour and one column per character, with symmetric padding so
jittered blits never clip.

### `natural-earth.ts` — land geometry loader
`loadLand(file, southLimit)` / `useLand(...)` fetch a Natural Earth TopoJSON
from `public/`, flatten it (handles both the FeatureCollection and bare Feature
shapes `topojson-client` can return), and drop polygons lying entirely south of
`southLimit` — which removes Antarctica at 110m. Memoised at module scope and
gated with `delayRender()` / `continueRender()`. Natural Earth is public
domain.

Needs: `topojson-client`, `geojson` types.

### `projection.ts` — equirectangular map projection
`createEquirectangular({width, height, centerLon, centerLat, scale})` returns
`{project, trace, path2d}`. Pinned by explicit centre and pixels-per-radian
rather than fitted to a bounding box, so the framing is a deliberate choice
instead of a letterbox. Build the projected path once and animate with a
transform on the composited result — never re-project per frame.

Needs: `d3-geo`.

### `catmull-rom.ts` — smooth spline
`catmullRomPath(ctx, points, closed, tension)` traces a curve through sparse
control points as cubic beziers, into a context or a `Path2D`. Supports closed
rings, so open contours and closed loops share one helper.

### `seeded.ts` — seeded random helpers
`seededRange`, `seededInt`, `seededPick`, `seededChance`,
`seededWeightedIndex`, `seededWobble`. Thin, well-named wrappers over
Remotion's `random()` with string seeds. `seededWobble` sums two non-harmonic
sines so motion reads organic rather than metronomic.

### `color.ts` — hex maths
`mixHex(a, b, t)` and `withAlpha(hex, alpha)`. Lets every visual module take
resolved colour strings and keeps palettes in one place.

### `use-canvas.ts` — draw-once-per-render canvas
`useCanvas2D(width, height, draw)` returns a `<canvas>` ref and runs `draw` in
a layout effect on every render — no dependency array, no rAF. In Remotion the
render is the clock. `makeCanvas(w, h)` creates a detached offscreen canvas.

### `BloomLayer.tsx` — additive bloom
`<BloomLayer source={ref} .../>` blurs a source canvas at a downscaled
resolution and composites it back with `mixBlendMode: screen`. Blurring
megapixels per frame in a software rasteriser is not affordable; a quarter-scale
blur upsampled is indistinguishable at bloom radii, and bright source pixels
bloom proportionally more without needing a separate bright-pass.

### `FilmGrain.tsx` — fine grain
`<FilmGrain frame={frame} alpha={0.04} />` cycles a small pool of noise tiles
generated once and repeated as a CSS background. Deterministic per frame and
effectively free, unlike regenerating full-frame noise.

### `Vignette.tsx` — edge darkening
`<Vignette strength={0.24} inner={0.42} />`. Radial falloff that leaves the
centre untouched.

## Used by

- `binary-world-map` — 4K binary world map, 450f @ 30fps. First contributor of
  every module above.
