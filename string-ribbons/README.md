# String Ribbons (Remotion)

Folded "string-art" ribbons – families of bent strands forming ruled
surfaces – seen through a lens with real depth of field, printed in teal ink
on worn grid paper. Modelled on reference clip *istockphoto-2287708613*.

| | |
|---|---|
| Compositions | `Ribbons-V1-4K` (reference: close, restless orbit through the sculpture), `Ribbons-V2-4K` (alternative camera: high, wide crane shot that descends and arcs 120° around the whole sculpture) |
| Resolution | 3840 × 2160 (4K UHD) |
| Frame rate | 30 fps |
| Duration | 360 frames (12.000 s) – frame-for-frame match of the 360-frame reference |
| Loop | the sculpture morph (and the V1 camera) repeats every 180 frames (6 s), like the reference |
| Technology | WebGL2 shaders for the strands + Canvas 2D for the paper/print texture and compositing |

## Commands

```console
npm i                      # install dependencies
npm run dev                # Remotion Studio preview
npm run render:v1:4k       # 4K master  -> out/ribbons-v1-4k.mp4
npm run render:v2:4k       # 4K master  -> out/ribbons-v2-4k.mp4
npm run render:v1:1080p    # 1080p delivery -> out/ribbons-v1-1080p.mp4
npm run render:v2:1080p    # 1080p delivery -> out/ribbons-v2-1080p.mp4
```

All renders are H.264 MP4, yuv420p (set in `remotion.config.ts`).

### How the depth of field works

Each strand is a 3D polyline projected through a pinhole camera; every
vertex gets a blur radius from the thin-lens circle of confusion
`σ = aperture · |1/focus − 1/z|`. In WebGL2 every segment is drawn as a quad
whose fragment shader evaluates the **exact** Gaussian convolution of a
straight stroke (erf across × erf along the segment). These are summed
additively into a float ink-density buffer – blur therefore varies
continuously along strands that pass through the focal plane, with no
seams – and resolved with Beer–Lambert absorption so overlapping sheets
darken like ink. Canvas 2D then layers paper, ink, printed grid, grunge
speckle and vignette.

### Notes

* The 1080p deliveries render the **4K composition** with `--scale=0.5`;
  all drawing is resolution independent, so the backing canvases follow the
  output resolution.
* `remotion.config.ts` selects the `swangle` OpenGL backend (WebGL2 on any
  machine, GPU or not). Requires `EXT_color_buffer_float` (available in
  SwiftShader and all desktop GPUs).

## Source layout

```
src/Root.tsx                    compositions (ids, size, fps, duration)
src/ribbons/StringRibbons.tsx   frame component: projection, DOF, compositing
src/ribbons/inkRenderer.ts      WebGL2 analytic depth-of-field strand renderer
src/ribbons/scene.ts            ribbon (rail) definitions and looping morph
src/ribbons/camera.ts           V1 close-orbit rig, V2 wide-crane rig
src/ribbons/paper.ts            procedural paper, grid, grunge, vignette
src/ribbons/palettes.ts         teal print palette
```
