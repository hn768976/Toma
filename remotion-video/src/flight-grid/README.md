# Flight grid — airliner over a wireframe globe

Two 16-second 3D motion backgrounds: a white airliner silhouette flying over
a dark lat/long wireframe globe, with great-circle route arcs, defocus and
lens falloff. Built with three.js inside Remotion, authored at 4K.

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
second jet large and soft in the foreground, then drops and closes in until
it matches V1's framing on a single aircraft, with a third jet crossing
lower right around the midpoint.

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
airliner.ts       procedural wide-body geometry, merged to one buffer
Aircraft.tsx      unlit white silhouette mesh
rig.ts            camera + aircraft motion, all pure functions of time
scene-config.ts   per-version keyframes
FlightGridScene.tsx  layer composition, companion traffic, vignette
FlightGrid.tsx    composition entry point
```

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

**The globe radius is the curvature dial.** Too small and the limb of the
sphere shows up as a hard horizon; too large and the grid flattens into a
plane. The graticule is specified in arc length, so `GLOBE_RADIUS` can be
retuned without also resizing every cell.

## Determinism

Remotion renders frames out of order across worker processes, so nothing in
the scene may depend on wall-clock time, render order or `Math.random()`.
Route layouts come from a seeded PRNG (`random.ts`) and every rig value is
a pure function of the frame.

One related trap, already hit once: react-three-fiber diffs object-valued
props by reference. A memoised `Vector3` mutated in place is treated as
unchanged and never re-applied, which pins the mesh to its first frame
while the camera flies away — and single-frame `remotion still` renders do
not reveal it, because every still is a first frame. Transforms are
therefore passed as tuples, which are compared element-wise.
