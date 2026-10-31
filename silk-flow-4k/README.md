# Silk Flow 4K (Composition 1)

Flowing black satin / silk motion background, recreated procedurally from the
reference clip. Built with the Remotion CLI (`create-video --blank`) and a single
**WebGL 2 fragment shader**, with no external images or video. Every frame is a
pure function of the frame number, so renders are deterministic.

| Composition  | Size        | FPS | Frames | Duration | Description |
|--------------|-------------|-----|--------|----------|-------------|
| `SilkFlowV1` | 3840 × 2160 | 30  | 360    | 12.000 s | Version 1: neutral black satin matching the reference |
| `SilkFlowV2` | 3840 × 2160 | 30  | 360    | 12.000 s | Version 2: alternate **champagne-gold palette** on warm black, plus a slow camera push-in (×1.18) with 6° of roll |

The reference is 360 frames at 29.97 fps (12.012 s). At exactly 30 fps the
compositions keep the same 360 frames (12.000 s). The 12 ms gap is the NTSC
29.97 → 30 fps difference and can't be closed with whole frames.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- About 1 GB of free disk space for `node_modules`

## Commands

```bash
npm install            # install dependencies (versions pinned)
npm run dev            # open Remotion Studio and preview both compositions

# Final deliverables: 4K composition rendered at --scale=0.5 → 1920×1080 H.264 MP4
npm run render:v1      # out/silk-flow-v1-1080p.mp4
npm run render:v2      # out/silk-flow-v2-gold-1080p.mp4
npm run render:all     # both

# Full-resolution 4K masters (optional)
npm run render:v1:4k
npm run render:v2:4k

npm run lint           # eslint + TypeScript type check
```

Render settings live in `remotion.config.ts`: H.264, yuv420p, CRF 16, BT.709 colour space, and the
`swangle` OpenGL backend (WebGL on SwiftShader). `swangle` works on any
machine, with or without a GPU. On a machine with a working GPU, add `--gl=angle`
to the render command for much faster renders.

## How it works

- `src/gl/ShaderCanvas.tsx` is a minimal WebGL 2 full-screen-triangle renderer
  driven by `useCurrentFrame()`. Its canvas backing store is always the
  composition size (4K).
- `src/silk/silkShader.ts` builds the cloth from a height field of several
  diagonal folds (about 41.5°, swaying ±1.5°) that drift, merge and bend.
  Normals come from a wide-step gradient, which gives the soft, slightly
  defocused look of the reference. Shading combines a soft ambient fill, a
  cubic diffuse term, an anisotropic satin sheen and a left-to-right light
  falloff.
- `src/silk/SilkFlow.tsx` holds the colour ramp (shadow / mid / highlight tints),
  the optional camera move (`pushIn`, `rollDegrees`) and two curves calibrated
  against the reference:
  - `GAIN`: an exposure envelope sampled every 0.5 s. It was calibrated in a closed loop:
    the shader was rendered with a flat gain, its mean luma was compared with the
    reference's at the same timestamps (watermark masked out), and the ratio was stored.
    The per-checkpoint mean luma correlates 0.99 with the reference: a peak
    around 1–2 s, then a slow fade into near-black.
  - `SPEED_WINDOWS`: relative animation speed per 2 s window, integrated into
    a smooth, monotonic animation clock.
- All look parameters are a zod schema, so they can be edited live in Studio.
