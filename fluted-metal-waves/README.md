# Fluted Metal Waves (Remotion + WebGL 2 shader)

A seamless-looping abstract background: a vertically fluted, polished metal
sheet with a soft wave swaying and breathing in place. Rendered entirely by one WebGL 2
fragment shader - there are no external assets.

| Composition ID | Description | Size | FPS | Frames |
| --- | --- | --- | --- | --- |
| `FlutedMetalWaves-V1-Silver` | Version 1 - silver / chrome, matches the reference | 3840x2160 | 30 | 461 (15.367 s) |
| `FlutedMetalWaves-V2-Gold` | Version 2 - alternative colour palette (polished gold) | 3840x2160 | 30 | 461 (15.367 s) |

The wave motion loops every 230 frames (7.67 s), like the reference.

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
npx remotion render FlutedMetalWaves-V1-Silver out/v1.mp4 --scale=0.5
```

Output is H.264 / yuv420p MP4 at 30 fps (set in `remotion.config.ts`).
On a machine with a GPU you can speed rendering up with `--gl=angle`.

## Structure

- `src/Root.tsx` - composition registration (both versions)
- `src/FlutedMetalWaves.tsx` - WebGL 2 canvas driven by the Remotion frame
- `src/shader.ts` - vertex + fragment shader (wave field, flutes, studio reflections)
- `src/constants.ts` - resolution, duration, loop length and colour palettes
