# Grid-plane backgrounds

Two looping-feel tech background pieces, each a recreation of a supplied stock
reference. Both are built on the same camera/projection engine and both exist
at 1080p and 4K.

| Composition | Size | Duration | Reference |
| --- | --- | --- | --- |
| `SolarPanelArray1080` | 1920x1080 | 300 frames @ 30fps = 10.000s | A: staggered solar-panel field |
| `SolarPanelArray4K` | 3840x2160 | 300 frames @ 30fps = 10.000s | — |
| `NeonGridPlane1080` | 1920x1080 | 180 frames @ 30fps = 6.000s | B: neon grid ignition |
| `NeonGridPlane4K` | 3840x2160 | 180 frames @ 30fps = 6.000s | — |

Reference A runs 10.000s, so 30fps lands on exactly 300 frames. Reference B
runs 6.006s (144 frames at 23.976fps); at 30fps that rounds to 180 frames /
6.000s, which is 6ms — well under one frame — shorter than the source.

## Rendering

```console
npm run render:solar:1080
npm run render:solar:4k
npm run render:neon:1080
npm run render:neon:4k
```

All four emit H.264 MP4 with no audio track, `yuv420p` / bt709, into `out/`.

## How resolution independence works

Every scene is authored against a fixed 1920x1080 design box and drawn into an
SVG `viewBox` of that size. The 4K compositions are the same component at
3840x2160 — the browser rasterises the identical vector geometry at twice the
pixel density, so framing, timing and layout are bit-for-bit the same shot and
there is nothing to re-tune per resolution. No raster assets are involved.

## Files

- `camera.ts` — pinhole camera over an infinite ground plane. World axes are
  y-down: the camera sits at the origin looking along `+z` with the plane at
  `y = camera.height`. Handles yaw/pitch/roll, near-plane clipping for both
  segments and polygons, and `depthBand`, which solves exactly for the visible
  stretch of a line within a depth range.
- `solar-surface.ts` — the monocrystalline cell surface both videos sit on.
- `SolarPanelArray.tsx` — reference A. Brick-staggered modules, each a slab
  standing proud of its mounting plane so the aluminium frame has real
  thickness. Drawn far-to-near (painter's algorithm); all four frame walls are
  emitted and then the glass on top, so walls facing away land inside the top
  face's silhouette and the drawing order does the hidden-surface removal.
  Specular flares sweep the frames; sparkles drift above the array.
- `NeonGridPlane.tsx` — reference B. A field of square modules whose seams
  ignite on individually seeded schedules under a rising global envelope,
  bloomed through stacked blurred copies. The cell surface itself is static:
  nothing on the panel face lights up or shimmers, only the seams between
  panels.
- `random.ts` — seeded RNG. Frames are rendered by many separate browser
  instances, so anything that varies per panel/mote must be derived from a seed
  rather than `Math.random()`.
- `constants.ts` — design box, fps and the two durations.

## The panel surface

`solar-surface.ts` draws the modules from the supplied reference photograph.
The giveaway of a monocrystalline module is the pseudo-square cell: its corners
are cut off, so the pale backsheet shows through as a straight gap between
neighbouring cells and as a small diamond wherever four cells meet, with thin
silver busbars crossing each cell row.

It is drawn as light detail over a dark panel face — gaps, corner diamonds and
busbars — rather than as one polygon per cell. That is the same picture with far
less geometry, and it lets each kind of detail dissolve at the distance where it
stops being resolvable (`detailFade`) instead of a panel switching level of
detail at one depth and popping. Each helper returns path data holding many
subpaths, so a panel's hundreds of cell details cost a single DOM node.

## Avoiding flicker

Two things in a moving perspective scene will strobe from frame to frame unless
they are handled, and both were visible before they were fixed:

- **Sub-pixel strokes.** Below about a pixel wide, a stroke's antialiased
  coverage depends on where it falls between pixel centres, so a field of
  hairlines crawls as the camera moves. `strokeFor` holds the width at a pixel
  and takes the lost weight out of the opacity instead, which keeps the apparent
  density identical with none of the aliasing.
- **Coarse subdivision of long lines.** A seam is split into pieces so its
  stroke can taper with distance. Spacing those pieces evenly *along the line*
  puts nearly all of them past the middle distance and leaves one piece covering
  the whole foreground at a single width — and that width then steps around as
  the camera moves. `linePieces` spaces them evenly across the *screen* instead,
  stepping through the reciprocal of depth, which is the quantity that is affine
  in screen space. Measured on a frozen camera, this took the frame-to-frame
  swing in mean luminance from 11% to under 1%.

Two smaller rules follow from the same concern: geometry is clipped to the frame
(`clipToFrame`), since a line reaching the near plane projects to coordinates in
the tens of thousands and a bloom group's bounding box would balloon; and the
bloom filters use `filterUnits="userSpaceOnUse"` with a fixed region, so the blur
cannot shift as content enters and leaves the group.

## Tuning

Both components take props (editable live in `npm run dev`): camera `yaw` and
`speed`, the brightness multiplier (`glint` / `glow`), and the particle count.
Geometry constants — panel size, grid pitch, subdivisions, depth fades — sit at
the top of each component file.
