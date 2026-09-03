# remotion-lib — CATALOG

Shared, source-only building blocks for Remotion pieces. No build step: consumers
vendor or path-import the `.ts` files directly.

House rules for anything added here:

- **Deterministic.** All randomness through `seeded-random` (Remotion's `random()`
  with stable string seeds). Never `Math.random()`, `Date.now()` or `rAF`.
- **Palette-agnostic.** No hex literal in a component. Colours arrive as
  parameters with role names (`inkStrong`, `surface`), never hue names.
- **Subject-agnostic.** No copy, no domain vocabulary, no branding.
- **Canvas-first.** Painters take a `CanvasRenderingContext2D` and return the
  height or geometry they consumed; they do not own their canvas unless they
  return one.

---

## Primitives

### `seeded-random`
`rand` · `randRange` · `randInt` · `pick` · `chance` · `weighted`

Seeded value helpers over Remotion's `random()`. `weighted` takes
`[value, weight][]`, which is the readable way to express "mostly A, sometimes B".

### `color`
`rgbOf` · `withAlpha` · `mix`

Turns the `#RRGGBB` strings that live in a palette into `rgba()` or blends
between two of them. Holds no colours of its own.

### `canvas2d`
`makeCanvas` · `context2d` · `releaseCanvas` · `setLetterSpacing` · `setBlur` · `clamp`

`releaseCanvas` zeroes a canvas's backing store — worth calling on 4K
intermediates, where a handful of leaked canvases is hundreds of megabytes.
`setLetterSpacing` wraps the Chromium-only `ctx.letterSpacing`.

### `filler-text`
`fillerWord` · `fillerLines`

Deterministic illegible filler: nonsense words from syllable fragments, laid
into lines with ragged lengths and a short last line, so a block reads as a
paragraph's *shape*. Use it wherever body copy is texture rather than writing —
and specifically so rendered "text" can never be mistaken for real prose.

---

## Components

### `<KeywordHighlight>`
`measureKeywordRun(ctx, options) -> KeywordRunPlan` · `KeywordHighlight(ctx, plan, part, colors)`

Per-word emphasis within a run of text. One word renders at full contrast and
full sharpness; every other word is drawn at reduced contrast and progressively
blurred, the blur climbing with distance from the keyword so the transition is
graded rather than abrupt. It reads as an eye that has settled on one word.

Measure and paint are separate: the plan reports where the keyword landed
(callers usually need that to position the whole block), and painting takes a
`part` of `"rest"` or `"keyword"` so the keyword can go on its own layer and be
treated differently downstream — less motion blur, a different composite.

Lines are wrapped at the narrowest width that still yields the same line count,
which evens them out instead of leaving a long line above a stub.

Parameters: `text`, `keyword`, `font`, `fontSize`, `lineHeight`, `maxWidth`,
`minBlur`, `maxBlur`, `falloff`, `nearAlpha`, `farAlpha`. A short keyword wants
a smaller `falloff` — the focus point has to be tighter to read as one word.

### `<SiteChrome>`
`SiteChrome(ctx, options) -> height`

The strip of generic site furniture above a headline: either a small square
placeholder mark beside a short wordmark in tracked caps, or a breadcrumb
trail. The mark is a plain square. Wordmark and trail are caller-supplied.

### `<BodyBlock>`
`BodyBlock(ctx, options) -> height`

Several lines of `filler-text` at a given measure, in paragraphs, with optional
blur and alpha. Returns the height consumed.

### `<ArticleCard>`
`ArticleCard(spec) -> ArticleCardLayers`

A fragment of a generic article page, painted once to its own offscreen canvas:
top rule or coloured band, site chrome, section label, headline, byline and
date, body block, and optionally an image placeholder above, beside or below.
Which of those appear — and the headline's typeface, size, measure, and the
body's width and line count — vary per card from the seed, so a run of cards
never reads as one template.

Built once, deliberately: laying headlines and body copy out per frame at 4K
does not render in usable time. The keyword focus blur is baked in at build
time too, leaving a blit as the only per-frame cost.

Returns two layers — the card minus the keyword, and the keyword alone — shaped
to drop straight into `composeMotionBlurred` as a `LayeredSprite`.

Carries no copy of its own: headline, keyword, wordmarks, sections, bylines and
dates are all caller-supplied, and the body is illegible filler. Callers are
responsible for supplying invented copy; this is not a way to reproduce a real
page.

Key parameters: `width` and `targetHeight` (body line count is chosen to land
near the target, which is how a caller controls a scroll's block length),
`headlineSize`, `serifBias`, `serifLabels`, `headroom`, `focusBlurMax`,
`focusFalloff`, `texturedSurface`, `sectionColor`, and an
`ArticleCardPalette` of role-named colours.

---

## Passes

### `paperSurface(ctx, seed, w, h, base, shade, strength)`
Soft irregular tonal drift across a surface — mottling, not grain. Tones are
mixed in JS and painted opaque. Note the trap it exists to avoid: routing this
through `multiply`, or encoding strength as per-pixel alpha, puts it at the
mercy of canvas's premultiply round-trip, where near-transparent pixels become
rounding noise and print as *coloured blotches* rather than tonal variation.

### `composeMotionBlurred(sprite, options) -> ComposedSprite`
Flattens a `LayeredSprite` into the single bitmap a scroll blits each frame,
baking in tilt, an optional drop shadow, and directional motion blur along an
axis. The overlay layer gets a shorter shutter than the base, which is how a
focal element stays legible while its surroundings smear.

The blur is a true box filter, not a ghost trail: N shifted copies accumulated
with `lighter` at `1/N` alpha, which sums premultiplied colour *and* alpha to
their exact average. Repeated `source-over` draws at `1/N` weight the copies
exponentially and read as onion-skinning instead.

Only correct for constant velocity — which is the case it exists for.

### `grainPass(ctx, options)`
Fine film grain. A few noise tiles are built once and shared; each frame picks
and offsets one, so grain moves without regenerating megapixels per frame.
Seeded on `frame % loopLength`, so a looping piece loops cleanly. Composited
with `overlay`, which keeps it tonally neutral on light and dark grounds alike.

### `vignettePass(ctx, options)`
Corner falloff towards a caller-supplied colour rather than an assumed black.
On a pale ground a dark vignette reads as dirt; lightening the corners with the
ground's own light tone is what actually reads as falloff.
