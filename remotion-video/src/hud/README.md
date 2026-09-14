# Clean Energy HUD

A 20-second, 30fps motion graphic of a tilted clean-energy control console,
built to match the framing, pacing and element set of a reference stock clip.

Two versions ship from the same component kit:

| Version | Composition (4K master)   | Palette   | Layout |
| ------- | ------------------------- | --------- | ------ |
| V1      | `CleanEnergyHUD-4K`       | Green     | Reference console: columns around a centred globe, clean-energy block on the right, power bar across the bottom |
| V2      | `CleanEnergyHUD-Blue-4K`  | Dark blue | Banded re-layout: full-width header rail, generation cluster on the left, globe pushed right, footer rail of scopes |

`CleanEnergyHUD-1080p` and `CleanEnergyHUD-Blue-1080p` are the same components
at 1920x1080. They exist so the studio and previews stay light; **deliverables
are rendered from the 4K masters**, not from these.

## Rendering

Delivery pair (1080p H.264, no audio, matching the reference's 20.000s / 30fps
/ yuv420p / bt709):

```console
npx remotion render CleanEnergyHUD-4K out/clean-energy-hud_v1-green_1080p.mp4 \
  --scale=0.5 --codec=h264 --crf=18 --muted --color-space=bt709

npx remotion render CleanEnergyHUD-Blue-4K out/clean-energy-hud_v2-blue_1080p.mp4 \
  --scale=0.5 --codec=h264 --crf=18 --muted --color-space=bt709
```

`--scale=0.5` rasterises the 3840x2160 composition at exactly 1920x1080. Drop
the flag to render the full 4K master:

```console
npx remotion render CleanEnergyHUD-4K out/clean-energy-hud_v1-green_2160p.mp4 \
  --codec=h264 --crf=18 --muted --color-space=bt709
```

## How it is put together

Everything is authored in a fixed **1920x1080 design space** and scaled by
`width / DESIGN_WIDTH`, so 4K and 1080p are the same picture at different
rasterisation densities - no layout reflows between sizes, and no per-resolution
tuning.

- `Camera.tsx` - lays the console on a CSS-3D plane and flies the lens across it
  in one eased sweep, with a noise wobble so it reads as a camera. The plane
  overhangs the layout by a wide margin on every side so its edges never enter
  frame.
- `LayoutReference.tsx` / `LayoutAlternate.tsx` - the two arrangements. Both are
  a single SVG of the console surface.
- `primitives.tsx`, `charts.tsx`, `icons.tsx`, `Globe.tsx` - the instrument kit:
  panels, scrolling plots, gauges, heat grids, the dotted globe and its orbit
  ring, turbine, solar array, battery, gears.
- `Atmosphere.tsx` - bloom, scanlines, tiled film grain, vignette and the
  periodic light sweep.
- `theme.ts` - the two palettes. No component knows which version it is in; a
  variant is a palette plus a layout.
- `rng.ts` - seeded randomness. Remotion re-mounts the tree every frame, so any
  value that must stay put between frames is derived from a seed rather than
  `Math.random()`.

### Notes on two choices that look odd

The globe's continents are coarse lat/lon ellipse blobs (27.8% land coverage,
against Earth's ~29%) rather than real coastlines: at the size the globe
occupies, only the silhouette reads. The whole front hemisphere is emitted as
two `<path>` strings instead of thousands of `<circle>` elements, which keeps
per-frame reconciliation cheap.

Film grain is a tiled SVG `<pattern>` of seeded squares. A full-frame
`feTurbulence` would recompute noise over eight million pixels every frame, and
a `background-image` data URI is not guaranteed to have decoded when Remotion
captures the frame.
