# DNA Helix Growth

Procedural 3D motion graphic: an array of DNA double helices grows out of the
dark with glowing leading wires, base-pair rungs, marker rings, shallow depth
of field and bloom. Built with **Remotion 4** and **Three.js (WebGL 2, custom
GLSL shaders)**. No external assets - everything is generated in code.

| Composition          | Size      | FPS | Frames | Length   | Notes                                              |
| -------------------- | --------- | --- | ------ | -------- | -------------------------------------------------- |
| `DnaHelixGrowth-V1`  | 3840x2160 | 30  | 400    | 13.333 s | Reference match: cyan wires, red rings, teal-black |
| `DnaHelixGrowth-V2`  | 3840x2160 | 30  | 400    | 13.333 s | Alternative colour palette: gold / violet / indigo |
| `Preview-V1` / `-V2` | 1280x720  | 30  | 400    | 13.333 s | Same scenes, light-weight, for Remotion Studio     |

## Commands

```bash
npm install            # or: npm ci

npm run render:v1      # 1080p H.264 MP4 of V1 -> out/dna-helix-growth-v1-1080p.mp4
npm run render:v2      # 1080p H.264 MP4 of V2 -> out/dna-helix-growth-v2-1080p.mp4
npm run render:v1:4k   # full 3840x2160 master of V1
npm run render:v2:4k   # full 3840x2160 master of V2
npm run dev            # open Remotion Studio
```

The 1080p files are the 4K compositions rendered with `--scale=0.5`, so they
are a supersampled down-scale of exactly the same frames.

Codec (H.264, yuv420p, CRF 16), JPEG frame quality and the OpenGL backend are
set in `remotion.config.ts`.

### Rendering notes

- The scene needs WebGL 2. The config uses `swangle` (software ANGLE), which
  works on any machine, including servers without a GPU. With a GPU you can add
  `--gl=angle` to a render command for faster renders.
- Remotion downloads its own Chrome Headless Shell on first render. To use an
  existing one instead, set `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.
- Every frame is a pure function of the frame number (seeded PRNG, no
  wall-clock time), so renders are deterministic and can be parallelised.

## Structure

```
src/
  Root.tsx               composition registry (4K masters + previews)
  DnaHelix.tsx           React component, picks the palette
  dna/dnaScene.ts        scene: helix array, growth timing, camera, shaders
  dna/helixGeometry.ts   procedural double-helix geometry (strands, wires, rungs, rings)
  dna/palettes.ts        V1 and V2 colour palettes
  dna/random.ts          seeded PRNG
  gl/GLCanvas.tsx        Remotion <-> WebGL bridge (one synchronous draw per frame)
  gl/post.ts             HDR post chain: depth of field, bloom, vignette, grain, tone curve
```

To change the look, edit `src/dna/palettes.ts` (colours) or `DEFAULT_CAMERA`
and the `layout` table in `src/dna/dnaScene.ts` (framing and helix placement).
