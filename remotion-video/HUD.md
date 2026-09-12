# Sci-fi HUD motion graphics

Two 20-second looping HUD/telemetry motion graphics, built with Remotion.
Both are registered at 1080p **and** 4K; the 1080p cuts are the delivered
renders, the 4K compositions are here to render on demand.

| Composition ID  | Resolution  | FPS | Duration           |
| --------------- | ----------- | --- | ------------------ |
| `HudBlue`       | 1920 × 1080 | 30  | 600 frames / 20.00s |
| `HudBlue4K`     | 3840 × 2160 | 30  | 600 frames / 20.00s |
| `HudViolet`     | 1920 × 1080 | 30  | 600 frames / 20.00s |
| `HudViolet4K`   | 3840 × 2160 | 30  | 600 frames / 20.00s |

## The two cuts

**HudBlue** follows the reference framing: a centred reticle over a
dot-matrix world map, a square lattice, telemetry rails down both edges,
counters and matrix blocks across the top, chart cluster along the bottom.

**HudViolet** is the same design language rebalanced — violet/magenta
palette, the reticle dropped out of centre into the left third at a larger
size, the right two-fifths turned into a boxed vertical stack of modules,
a hexagonal lattice in place of the square one, and every chart regrouped
into one band along the bottom.

## Rendering

```console
npm i

# the delivered 1080p cuts
npx remotion render HudBlue   out/hud-blue-1080p.mp4   --codec=h264 --image-format=png --crf=17
npx remotion render HudViolet out/hud-violet-1080p.mp4 --codec=h264 --image-format=png --crf=17

# 4K
npx remotion render HudBlue4K   out/hud-blue-4k.mp4   --codec=h264 --image-format=png --crf=17
npx remotion render HudViolet4K out/hud-violet-4k.mp4 --codec=h264 --image-format=png --crf=17
```

`npm run dev` opens Remotion Studio, where every composition's
`resolutionScale` prop and all the widget props are editable live.

## How the 4K path works

Components lay themselves out in a fixed 1920×1080 *design space* and are
drawn into a single `<svg viewBox="0 0 1920 1080">` whose **pixel** width
and height are the real output size (`src/hud/HudStage.tsx`). Paths and
glyphs are therefore re-rasterised at native resolution rather than a
1080p bitmap being scaled up, and the two resolutions stay pixel-identical
in layout. The one canvas layer — the dot-matrix map and data blocks, far
too many quads per frame for the DOM — gets the same treatment by sizing
its backing store to the output resolution and scaling the 2D context.

This is why `resolutionScale` is a prop rather than a CSS `transform:
scale()`: a transform would composite the tree once at 1× and then upscale
it, which would soften every line and every glyph at 4K.

**`resolutionScale` must match the registered width/height** — 1 for the
1080p compositions, 2 for the 4K ones. `src/Root.tsx` is the single place
that pairs them.

## Looping

All motion is seamless across the 20s: rotation speeds are whole turns per
loop, every cycle length divides the 600-frame duration, and the
percentage counters ease to their target and hold. Frame 600 matches frame
0, so either clip can be looped without a visible cut.

## Layout

```
src/hud/
  constants.ts        timing + design-space size
  theme.ts            BLUE_THEME / VIOLET_THEME, font stacks
  fonts.ts            self-hosted webfont loading (delayRender)
  anim.ts             ramp / wobble / sawtooth helpers, all loop-safe
  random.ts           seeded PRNG (never Math.random -- frames render out of order)
  worldMap.ts         continent polygons + dot-grid rasteriser
  text.ts             generic telemetry vocabulary and pseudo-source
  HudStage.tsx        shared backdrop + canvas + SVG scaffolding
  HudBlue.tsx         layout A
  HudViolet.tsx       layout B
  layers/             Backdrop, DataField, GridLayer, Reticle, HudFrame
  widgets/            Lists, Code, Gauges, Charts, Texture
```

Both layouts share one widget library and differ only in the theme they
are handed and how they arrange it, so a palette or timing change never
means touching a widget.
