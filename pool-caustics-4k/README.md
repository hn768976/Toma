# Pool Caustics 4K (Composition 2)

Swimming-pool floor seen through moving water: a mosaic tile grid wobbling
under refraction, with drifting patches of bright caustic light. Recreated
procedurally from the reference clip. Built with the Remotion CLI
(`create-video --blank`) and a single **WebGL 2 fragment shader**, with no external
images or video. Every frame is a pure function of the frame number.

| Composition      | Size        | FPS | Frames | Duration | Description |
|------------------|-------------|-----|--------|----------|-------------|
| `PoolCausticsV1` | 3840 × 2160 | 30  | 300    | 10.000 s | Version 1: straight top-down view matching the reference |
| `PoolCausticsV2` | 3840 × 2160 | 30  | 300    | 10.000 s | Version 2: alternate **camera angle and movement**: tilted perspective camera gliding forward over the pool with a slow yaw |

The reference is 300 frames at 29.97 fps (10.010 s). At exactly 30 fps the
compositions keep the same 300 frames (10.000 s). The 10 ms gap is the NTSC
29.97 → 30 fps difference and can't be closed with whole frames.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- About 1 GB of free disk space for `node_modules`

## Commands

```bash
npm install            # install dependencies (versions pinned)
npm run dev            # open Remotion Studio and preview both compositions

# Final deliverables: 4K composition rendered at --scale=0.5 → 1920×1080 H.264 MP4
npm run render:v1      # out/pool-caustics-v1-1080p.mp4
npm run render:v2      # out/pool-caustics-v2-tilted-glide-1080p.mp4
npm run render:all     # both

# Full-resolution 4K masters (optional)
npm run render:v1:4k
npm run render:v2:4k

npm run lint           # eslint + TypeScript type check
```

Render settings live in `remotion.config.ts`: H.264, yuv420p, CRF 16, and the
`swangle` OpenGL backend (WebGL on SwiftShader). `swangle` works on any
machine, with or without a GPU. On a machine with a working GPU, add `--gl=angle`
to the render command for much faster renders.

## How it works

- `src/gl/ShaderCanvas.tsx` is a minimal WebGL 2 full-screen-triangle renderer
  driven by `useCurrentFrame()`. Its canvas backing store is always 4K.
- `src/pool/poolShader.ts` builds the image in three layers:
  1. **Tile mosaic.** The grid density (62 × 41 tiles across the frame) was
     measured from the reference with an FFT of the grout lines. Grout lines
     are anti-aliased with `fwidth`, with a subtle per-tile tint variation.
  2. **Refraction.** The floor lookup is displaced by three octaves of
     animated 3-D gradient noise, so grid lines wobble like in the reference.
  3. **Caustics.** A net of thin bright lines (ridged 3-D noise), gathered into
     drifting blotches by a low-frequency mask.
- Version 2 ray-casts a perspective camera (52° FOV, pitched 52° → 46°)
  onto the floor plane. It adds distance-based depth tint and a Fresnel sky
  reflection that grows toward the top of frame.
- Colours and camera mode are a zod schema, editable live in Studio.
