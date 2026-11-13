# Colonoscopy Polyp Detection (Remotion + Three.js)

A 3D cutaway of a colon: an endoscope advances towards a polyp and an
AI-style detection ring locks onto it. Built with Remotion and Three.js
(WebGL 2) plus a Canvas 2D particle backdrop. Everything is procedural -
there are no external assets.

| Composition ID | Description | Size | FPS | Frames |
| --- | --- | --- | --- | --- |
| `ColonoscopyPolypDetection-V1-Reference` | Version 1 - locked-off cutaway camera, matches the reference | 3840x2160 | 30 | 259 (8.633 s) |
| `ColonoscopyPolypDetection-V2-OrbitCamera` | Version 2 - alternative camera angle + movement (orbiting push-in) | 3840x2160 | 30 | 259 (8.633 s) |

## Requirements

- Node.js 20.19+ / 22.13+
- No GPU required (renders with ANGLE/SwiftShader, see `remotion.config.ts`)

## Commands

```console
npm install            # install dependencies
npm run dev            # open Remotion Studio (preview)

npm run render:v1      # Version 1 -> out/...-1080p.mp4 (4K composition, --scale=0.5)
npm run render:v2      # Version 2 -> out/...-1080p.mp4
npm run render:all     # both 1080p versions

npm run render:v1:4k   # Version 1 at native 4K (3840x2160)
npm run render:v2:4k   # Version 2 at native 4K
```

Equivalent raw CLI call:

```console
npx remotion render ColonoscopyPolypDetection-V1-Reference out/v1.mp4 --scale=0.5
```

Output is H.264 / yuv420p MP4 at 30 fps (set in `remotion.config.ts`).
On a machine with a GPU you can speed rendering up with `--gl=angle`.

## Structure

- `src/Root.tsx` - composition registration (both versions)
- `src/ColonoscopyPolypDetection.tsx` - frame-driven animation + cameras
- `src/scene.ts` - Three.js scene: colon wall, polyp, endoscope, HUD ring shader, lights
- `src/Background.tsx` - Canvas 2D drifting-particle backdrop
- `src/constants.ts` - resolution, duration, timeline and layout constants
