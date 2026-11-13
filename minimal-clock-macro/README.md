# Minimal Clock Macro

Shallow depth-of-field macro shot of a minimalist clock with a real-time sweeping
second hand, built with **Remotion 4 + a single WebGL 2 fragment shader**.
No assets: the dial, bezel, case, hands, shadows and the lens blur are all
computed analytically per pixel (ray / plane + signed-distance shapes whose edge
softness equals the circle of confusion), so it is noise-free and sharp at 4K.

| Composition     | Size        | FPS | Frames | Length   | Notes                                              |
| --------------- | ----------- | --- | ------ | -------- | -------------------------------------------------- |
| `ClockMacro-V1` | 3840 × 2160 | 30  | 899    | 29.967 s | Frost blue / white (reference match)               |
| `ClockMacro-V2` | 3840 × 2160 | 30  | 899    | 29.967 s | Alternative palette: champagne gold on midnight    |

The reference clip is 749 frames at 25 fps (29.96 s); 899 frames is the closest
whole-frame length at 30 fps. The second hand turns 6° per second, exactly real time.

## Requirements

Node.js 20.19+ / 22.13+ and npm. Remotion downloads its own headless Chrome on first render.

## Commands

```console
npm install            # install dependencies
npm run dev            # open Remotion Studio (preview both compositions)

npm run render:v1      # 1080p H.264 MP4 of V1  (4K composition rendered at --scale=0.5)
npm run render:v2      # 1080p H.264 MP4 of V2
npm run render         # both of the above

npm run render:v1:4k   # native 3840x2160 master of V1
npm run render:v2:4k   # native 3840x2160 master of V2
```

Output goes to `out/`. Equivalent raw CLI call:

```console
npx remotion render ClockMacro-V1 out/v1.mp4 --scale=0.5
```

Encoding defaults live in `remotion.config.ts`: H.264, yuv420p, BT.709, CRF 16, PNG intermediate frames.

### WebGL backend

The scene needs WebGL 2. `remotion.config.ts` picks `angle` on macOS/Windows and the
software backend `swangle` on Linux (works on GPU-less servers). Override with
`--gl=angle` / `--gl=swangle` or the `REMOTION_GL` environment variable.

## Structure

```
src/
  index.ts            registerRoot
  Root.tsx            the two 4K compositions
  ClockMacro.tsx      React component: WebGL2 setup, camera, per-frame uniforms
  clock/
    shader.ts         the clock + depth-of-field fragment shader
    palettes.ts       V1 "frost" and V2 "midnight gold" colour palettes
```

To make another colour variant, add a palette in `src/clock/palettes.ts`.
