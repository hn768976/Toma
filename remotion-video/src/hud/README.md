# Clean Energy HUD

A 20-second, 30fps motion graphic of a tilted clean-energy control console,
matched to a reference stock clip.

Two versions ship from one layout:

| Version | Composition (4K master)  | Palette   | Framing                                    |
| ------- | ------------------------ | --------- | ------------------------------------------ |
| V1      | `CleanEnergyHUD-4K`      | Green     | The console as laid out                    |
| V2      | `CleanEnergyHUD-Blue-4K` | Dark blue | The same shot mirrored left-to-right        |

`CleanEnergyHUD-1080p` and `CleanEnergyHUD-Blue-1080p` are the same components
at 1920x1080. They exist so the studio and previews stay light; **deliverables
are rendered from the 4K masters**, not from these.

## Rendering

Delivery pair (1080p H.264, no audio, matching the reference's 20.000s / 30fps
/ yuv420p / bt709):

```console
npx remotion render CleanEnergyHUD-4K out/clean-energy-hud_v1-green_1080p.mp4 \
  --scale=0.5 --codec=h264 --crf=18 --muted --color-space=bt709

npx remotion render CleanEnergyHUD-Blue-4K out/clean-energy-hud_v2-blue-mirrored_1080p.mp4 \
  --scale=0.5 --codec=h264 --crf=18 --muted --color-space=bt709
```

`--scale=0.5` rasterises the 3840x2160 composition at exactly 1920x1080. Drop
the flag to render the full 4K master. Swap `--crf=18` for `--video-bitrate=10M`
if the file has to fit a size budget.

## Matching the reference camera

The camera was measured off the source clip rather than eyeballed, with two
scripted passes over decoded frames:

- **Phase correlation** between frames two and eighteen seconds in returns a
  shift of (0, 0) and a scale of 1.0000. The reference shot is *locked* - no
  pan, no dolly. Every bit of movement in the clip comes from the instruments.
- **Edge-orientation histograms** put the console's two axes at 15.5-17.5 and
  116.5-117.5 degrees, and hold there for the whole take, so the tilt and roll
  never change either.

`REFERENCE_CAMERA` in `Camera.tsx` was then solved against rendered stills using
the same measurement: tilt 40.5, roll 15.5, and a near-orthographic perspective
of 8000. The near-orthographic distance matters - the source's console edges
barely converge, and a shorter perspective piles extra foreshortening on top of
the tilt, which at 2600 needed a tilt of 26 to produce the same screen angles.
The delivered render measures 14.5 / 115.5-116.5 against the source's 15.5-17.5
/ 116.5-117.5, with phase correlation confirming the same locked shot.

## The mirrored version

V2 is a true reflection: the plane is flipped with one `scale(-1, 1)` and the
camera roll is negated with it, so measured edge angles come out at exactly
180 minus V1's.

Two things are exempt, because mirroring them would read as a mistake rather
than as a design:

- **Type.** `HudText` counter-flips about its own anchor point, so blocks swap
  sides while every readout stays the right way round. Use it instead of a bare
  `<text>` anywhere on the console.
- **The globe.** The dot field counter-flips the same way. A backwards Earth is
  as wrong as backwards text.

## How it is put together

Everything is authored in a fixed **1920x1080 design space** and scaled by
`width / DESIGN_WIDTH`, so 4K and 1080p are the same picture - no layout
reflows between sizes, and no per-resolution tuning.

- `Camera.tsx` - lays the console on a CSS-3D plane and holds the lens still on
  it. The plane overhangs the layout by a wide margin on every side so its edges
  never enter frame.
- `LayoutConsole.tsx` - the console, in one SVG, with the `mirrored` flag.
- `primitives.tsx`, `charts.tsx`, `icons.tsx`, `Globe.tsx` - the instrument kit:
  panels, scrolling plots, gauges, heat grids, the dotted globe and its orbit
  ring, turbine, battery, gears.
- `Atmosphere.tsx` - bloom, scanlines, tiled film grain, vignette and the
  periodic light sweep. Grain strength lives in `CleanEnergyHud.tsx` as
  `GRAIN_OPACITY_GREEN` / `GRAIN_OPACITY_BLUE`; blue runs lighter because its
  brighter surface makes the same grain read stronger.
- `theme.ts` - the two palettes. No component knows which version it is in.
- `rng.ts` - seeded randomness. Remotion re-mounts the tree every frame, so any
  value that must stay put between frames is derived from a seed rather than
  `Math.random()`.

### Notes on choices that look odd

**The globe's continents are ellipse blobs.** Thirty-five of them, unioned, and
trimmed by `LAND_SCALE` until coverage hits 28.5% of the sphere against Earth's
29%. Real coastlines buy nothing at the size the globe occupies; what does
matter is dot size, which is set so neighbouring dots just overlap at the
current density - any smaller and the continents break into confetti. The whole
front hemisphere is emitted as two `<path>` strings rather than twenty thousand
`<circle>` elements.

**The globe's spin is phased, not arbitrary.** It opens over the Americas and
ends over Africa, so land stays in view for the whole take instead of drifting
into an empty Pacific hemisphere halfway through.

**The turbine sizes itself from its box.** The rotor is the binding constraint -
a full diameter of width, and roughly a third of the height stacked above the
tower - so the swept circle stays inside its housing however the panel is laid
out, rather than depending on hand-tuned numbers that break when the layout
moves.

**Film grain is a tiled SVG `<pattern>` of seeded squares.** A full-frame
`feTurbulence` recomputes noise over eight million pixels every frame, and a
`background-image` data URI is not guaranteed to have decoded when Remotion
captures the frame.
