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
- `SolarPanelArray.tsx` — reference A. Brick-staggered panels drawn far-to-near
  (painter's algorithm), etched cells on the near ones, specular flares
  sweeping the seams, airborne sparkles.
- `NeonGridPlane.tsx` — reference B. Fine mesh plus structural lines that
  ignite on individually seeded schedules under a rising global envelope,
  bloomed through stacked blurred copies.
- `random.ts` — seeded RNG. Frames are rendered by many separate browser
  instances, so anything that varies per panel/mote must be derived from a seed
  rather than `Math.random()`.
- `constants.ts` — design box, fps and the two durations.

## Tuning

Both components take props (editable live in `npm run dev`): camera `yaw` and
`speed`, the brightness multiplier (`glint` / `glow`), and the particle count.
Geometry constants — panel size, grid pitch, subdivisions, depth fades — sit at
the top of each component file.
