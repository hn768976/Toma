# Tile Flip — Remotion + Three.js (4K)

A 4 × 4 grid of square panels set into a warm-grey wall. Panels swing open
on hinges along different edges, revealing deep navy cavities and casting
soft cool shadows, first one by one around the edges and then in a dense
burst through the middle. The phrase plays twice, like the reference.

| Composition   | Size        | FPS | Frames | Duration | Camera                                   |
| ------------- | ----------- | --- | ------ | -------- | ---------------------------------------- |
| `TileFlip-V1` | 3840 × 2160 | 30  | 234    | 7.800 s  | Matches the reference: straight-on, static |
| `TileFlip-V2` | 3840 × 2160 | 30  | 234    | 7.800 s  | Alternative: low three-quarter angle with a slow orbit + push-in |

The reference clip is 7.8078 s at 29.97 fps = 234 frames, so at the required
30 fps the composition is 234 frames (7.800 s); one frame at 30 fps is
33.3 ms, so this is as close as a whole number of frames allows (7.8 ms off).

## Technology

- **Three.js (WebGL 2)** with real geometry: each tile is a thin box on a
  hinge pivot above a recessed cavity, lit by a directional key light with
  PCF soft shadow mapping (4096² shadow map), ambient + hemisphere fill and a
  warm point light for the subtle top-left hot-spot.
- Everything is driven by `useCurrentFrame()` (no wall-clock time), so frames
  are deterministic and render in parallel.
- Panels sit flush and seamless when idle; a panel's seam fades in just
  before it opens and fades out after it closes, as in the reference.

## Project layout

```
src/
  index.ts / Root.tsx         Composition registration (4K, 30 fps, 234 frames)
  lib/ThreeStage.tsx          Frame-driven Three.js renderer for Remotion
  lib/math.ts                 Easing helpers
  tiles/choreography.ts       Flip timing / hinge sides traced from the reference
  tiles/scene.ts              Wall, cavities, flaps, lights, cameras (V1 & V2)
  tiles/TileFlip.tsx          React component
remotion.config.ts            H.264, yuv420p, CRF 16, WebGL renderer selection
```

## Commands

```bash
npm install

npm run dev              # Remotion Studio preview

# Final deliverables: render the 4K composition, then Lanczos-downscale to 1080p
npm run master           # both versions -> out/TileFlip-V1_4K.mp4, out/TileFlip-V1_1080p.mp4, ...
npm run master:v1        # V1 only (4K render + 1080p downscale)
npm run master:v2        # V2 only

npm run render:4k        # 4K renders only (3840x2160)
npm run render:1080p     # quick previews rendered directly at 1920x1080 (--scale=0.5)
```

The downscale step uses Remotion's bundled FFmpeg (`remotion ffmpeg`), so no
system FFmpeg is needed. Output: H.264 (libx264, CRF 16), yuv420p, 30 fps, no
audio. Equivalent raw CLI for one version:

```bash
npx remotion render TileFlip-V1 out/TileFlip-V1_4K.mp4 --crf=12
npx remotion ffmpeg -i out/TileFlip-V1_4K.mp4 -vf scale=1920:1080:flags=lanczos \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 out/TileFlip-V1_1080p.mp4
```

### Renderer notes

- WebGL defaults to `swangle` (SwiftShader via ANGLE), which works on any
  machine including GPU-less servers. On a workstation with a GPU you can
  speed things up with `REMOTION_GL=angle npm run master`.
- On first render Remotion downloads Chrome Headless Shell. On an offline
  machine, point it at an existing Chromium instead:
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run master`.
