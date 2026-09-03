# Catalog

This library was created on 2026-09-03 while building the neon countdown
timer set; it did not exist before then, so nothing here predates that
build.

Everything is framework-plain: React + Remotion + canvas 2D, no 3D, no
extra dependencies. Entries are copied into a project's own source tree
rather than imported across directories, so a project stays
self-contained and shippable on its own; this file is the source of
truth for the canonical version.

| Entry | Kind | Summary |
| --- | --- | --- |
| `canvasStage.ts` | helper | One shared canvas that several components paint onto per frame. Each paints into a scratch buffer, blooms it, then composites additively, so paint order is irrelevant. `claim()` clears once per frame and makes each component's paint idempotent. Far cheaper than a full-size canvas per component at 4K. |
| `effects.ts` | helper | `bloomPass` (blurs in a reduced-resolution buffer and composites with `lighter` — the difference between a fast 4K render and an unusable one), `sharpPass`, and `grainPass` (film grain from a `random()`-seeded tile, offset per frame). |
| `angularNoise.ts` | helper | A smooth, seamlessly periodic noise field over (angle, time), from a sum of integer-mode angular harmonics. Neighbouring samples are correlated, so it flows like an audio visualiser instead of jittering; integer modes mean no seam where the circle closes. Configurable modes, amplitudes and drift range; seeded by string. |
| `cyclicGradient.ts` | helper | `makeCyclicGradient(colors)` — a gradient that closes back on itself, for colouring anything laid out around a circle without a hard seam at the wrap. Palette-agnostic. |
| `sevenSegmentGeometry.ts` | helper | Seven-segment digit geometry: the seven bars as hexagonal polygons with 45-degree mitred ends, plus the lit-segment table for numerals 0-9. Pure geometry, no drawing. |
| `RadialBarRing.tsx` | component | A ring of thin bars radiating outward from a circular track. Per-bar length comes from a supplied function; colour comes from a supplied sampler over the bar's angular position, so the gradient rotates with the ring rather than shimmering as lengths change. Rounded caps, two-radius bloom. Evenly spaced on purpose — it reads as a meter because the variation is in the lengths. |
| `SevenSegmentDigits.tsx` | component | A digital numeral readout drawn from segment geometry rather than from a font, including a `:` cell. Unlit segments are drawn too, in a dim colour, so the full cell ghosts faintly behind the numeral — the detail that makes it read as a real display instead of as type imitating one. |
| `UnitLabels.tsx` | component | Short canvas text labels at given points, with letter-spacing (which canvas lacks) and a light bloom, for captions that need to sit in the same bloom as canvas-drawn artwork. |

## Not extracted, and why

- **A ring-track component.** A single `ctx.arc()` stroke. Wrapping it
  earns nothing over calling canvas directly.
- **Seeded-random helpers.** Remotion's own `random()` already covers
  this; a local PRNG would only risk diverging from it.
- **A vignette pass.** Nothing here has needed one yet — over a pure
  black ground it does nothing at all.
