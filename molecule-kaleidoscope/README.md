# Molecule Kaleidoscope (Remotion)

A mirrored kaleidoscope of glossy metaball "molecules" (ball-and-stick atoms
fused with smooth unions) on pale dotted paper. Every 5 s it cycles through
three poses – the opening layout, two separated compact ring clusters, and a
pale-dominant pose – with ~30-frame liquid morphs in which the
molecules glide, turn in 3D, fuse into each other and recolour. Modelled on reference clip *istockphoto-2266998825*.

| | |
|---|---|
| Compositions | `Molecules-V1-4K` (reference look), `Molecules-V2-4K` (alternative colour palette: midnight neon) |
| Resolution | 3840 × 2160 (4K UHD) |
| Frame rate | 30 fps |
| Duration | 302 frames (10.067 s) – frame-for-frame match of the 302-frame reference |
| Loop | the motion repeats every 150 frames (5 s), like the reference |
| Technology | WebGL2 fragment shader (top-down sphere-traced signed distance field) |

## Commands

```console
npm i                      # install dependencies
npm run dev                # Remotion Studio preview
npm run render:v1:4k       # 4K master  -> out/molecules-v1-4k.mp4
npm run render:v2:4k       # 4K master  -> out/molecules-v2-4k.mp4
npm run render:v1:1080p    # 1080p delivery -> out/molecules-v1-1080p.mp4
npm run render:v2:1080p    # 1080p delivery -> out/molecules-v2-1080p.mp4
```

All renders are H.264 MP4, yuv420p (set in `remotion.config.ts`).

### Notes

* The 1080p deliveries render the **4K composition** with `--scale=0.5`.
  The shader is resolution independent (all geometry is in frame-height
  units with analytic anti-aliasing), so its backing canvas follows the
  output resolution: a 4K render shades all 3840×2160 pixels; a 1080p render
  shades natively at 1920×1080 instead of rendering 4K and discarding 3/4.
* `remotion.config.ts` selects the `swangle` OpenGL backend (ANGLE on
  SwiftShader), which provides WebGL2 on any machine, with or without a GPU.
  On a GPU machine you can add `--gl=angle` for much faster renders.
  Software rendering speed: roughly 4–5 s per frame at 1080p on 4 CPU cores.
* If a pre-installed Chrome Headless Shell exists at the path in
  `remotion.config.ts` it is used; otherwise Remotion downloads its own.

## Source layout

```
src/Root.tsx                          compositions (ids, size, fps, duration)
src/molecules/MoleculeKaleidoscope.tsx  WebGL2 canvas component (per-frame draw)
src/molecules/shader.ts               GLSL: SDF ray-march, shading, paper, shadow
src/molecules/scene.ts                molecules, 3D rotation choreography, timing
src/molecules/palettes.ts             V1 reference palette, V2 midnight palette
```
