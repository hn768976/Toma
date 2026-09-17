# Flight grid — airliner over a wireframe globe

Two 16-second 3D motion backgrounds: a white airliner silhouette flying over
a dark lat/long wireframe globe, with great-circle route arcs, defocus, lens
falloff and CRT scanlines. Built with three.js inside Remotion, authored at
4K.

| Composition          | Size      | fps | Length          |
| -------------------- | --------- | --- | --------------- |
| `FlightGridV1-4K`    | 3840×2160 | 30  | 480f / 16.000 s |
| `FlightGridV1-1080p` | 1920×1080 | 30  | 480f / 16.000 s |
| `FlightGridV2-4K`    | 3840×2160 | 30  | 480f / 16.000 s |
| `FlightGridV2-1080p` | 1920×1080 | 30  | 480f / 16.000 s |

**V1** is the close, slow read: one jet holding frame centre, large grid
cells sliding past, the whole graticule rotating as the camera creeps
around the aircraft.

**V2** is the descent: opens high and wide on a fine graticule with a
second jet large and soft in the foreground, crossing the hero's track
right-to-left and out of frame, while the camera drops and closes in until
it matches V1's framing on a single aircraft.

## Rendering

```console
npm run render:v1        # 1080p deliverable
npm run render:v2
npm run render:v1-4k     # 4K master
npm run render:v2-4k
```

Renders are H.264 / MP4, `yuv420p`, Rec.709 limited range, no audio track.
The 4K passes are the same shot, not an upscale: every px-denominated value
(line width, bokeh radius) is multiplied by the composition's
`resolutionScale`, so 1080p and 4K are pixel-proportional.

On a machine without a GPU, `remotion.config.ts` points Chrome at its
software rasteriser (`swangle`); without that the WebGL canvas renders
black. Software rasterising is also what makes the 4K passes slow — budget
roughly 25 minutes for `render:v2-4k` on four CPU cores, against about two
minutes for `render:v1` at 1080p. On a machine with a real GPU, drop the
`setChromiumOpenGlRenderer` line and both get much faster.

## How it is put together

```
constants.ts      every tunable value, authored at 1080p
sphere.ts         geographic <-> cartesian, local frames, great-circle slerp
lines.ts          builds the graticule and route arcs as line-segment batches
DepthLines.tsx    instanced screen-space line renderer, defocus in-shader
Aircraft.tsx      loads the glTF airliner, draws it as an unlit silhouette
rig.ts            camera + aircraft motion, all pure functions of time
scene-config.ts   per-version keyframes
FlightGridScene.tsx  layer composition, companion traffic, vignette, scanlines
FlightGrid.tsx    composition entry point

public/models/skyliner.glb   the aircraft, geometry only
```

## The aircraft

`public/models/skyliner.glb` is the supplied "Silver Skyliner" model. It is
drawn as an unlit white silhouette to match the references, so none of its
maps are ever sampled — the baseColor (8192²), metallic-roughness and
normal textures were stripped from the asset, taking it from 27.5 MB to
5.7 MB and saving roughly 535 MB of texture memory per render worker.
Re-export from the original upload if the look ever moves to lit metal.

The model is authored nose along -X with its span on ±Z; `Aircraft.tsx`
centres it, yaws it a quarter turn into the rig's nose-+Z convention, and
normalises it to a wingspan of exactly 1 unit, so `PLANE_WINGSPAN` is the
only size dial.

Three decisions are worth knowing about before editing:

**Lines are instanced ribbons, not `GL_LINES`.** GL lines are locked to one
device pixel, so the grid would look identical at 1080p and 4K and there
would be nothing to defocus. Each segment is instead one instance of a quad
that the vertex shader expands perpendicular in pixel space.

**Defocus is in the line shader, not a post pass.** The frame is thin
additive white lines on black; a depth-buffer bokeh pass would need those
lines to write depth, which fights additive blending, and would cost a
full-resolution blur every frame. Instead each ribbon widens with its
circle of confusion and dims to match, which is what defocus actually does
to a line. Aircraft that sit off the focal plane are rendered on their own
transparent canvas and blurred in CSS by the same optics
(`dof.ts` is shared), which is exact for one small object at one depth.

**Scanlines are a soft ramp, not hard bands.** Hard-edged bands at a 4px
pitch beat against the pixel grid as the pattern drifts sub-pixel, and read
as harsh banding on the one large bright area in frame — the aircraft. The
overlay is a triangular gradient instead, which is both closer to a real
CRT and alias-free. Pitch scales with the composition so 4K shows the same
apparent line density rather than twice as many.

**The globe radius is the curvature dial.** Too small and the limb of the
sphere shows up as a hard horizon; too large and the grid flattens into a
plane. The graticule is specified in arc length, so `GLOBE_RADIUS` can be
retuned without also resizing every cell.

## Determinism

Remotion renders frames out of order across worker processes, so nothing in
the scene may depend on wall-clock time, render order or `Math.random()`.
Route layouts come from a seeded PRNG (`random.ts`) and every rig value is
a pure function of the frame.

Two related traps, both already hit once, and both invisible to
`remotion still` because every still is a first frame:

_react-three-fiber diffs object-valued props by reference._ A memoised
`Vector3` mutated in place is treated as unchanged and never re-applied,
which pins the mesh to its first frame while the camera flies away.
Transforms are therefore passed as tuples, which are compared
element-wise.

_Asynchronous assets have to suspend, not call `continueRender` by hand._
`<ThreeCanvas>` only redraws from an effect keyed on the frame number, so
releasing the render when the model finishes loading lets Remotion
screenshot a canvas that was last drawn before the geometry existed — the
aircraft silently goes missing from the video while stills look fine.
`Aircraft.tsx` throws its load promise instead; `<ThreeCanvas>` already
wraps children in a `<Suspense>` whose fallback holds the delay handle, and
the remount draws with the model in place.
