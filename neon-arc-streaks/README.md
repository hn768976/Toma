# Composition 2 — Neon Arc Light Streaks (Remotion, 4K)

Abstract, motion-blurred neon light trails flowing right-to-left along
concentric arcs beneath a dark navy void. The palette runs from cyan / teal
(left) through electric blue to magenta, pink and violet (right). A cyan glow
sits in the top-left corner and a violet glow in the bottom-right. Like the
reference, the motion is a **seamless 2-second loop** (six loops in 12 s).

| Composition ID         | Version | Size        | FPS | Frames | Duration |
| ---------------------- | ------- | ----------- | --- | ------ | -------- |
| `NeonArcStreaks-V1-4K` | V1, matches the reference framing, palette and motion | 3840 × 2160 | 30 | 360 | 12.000 s |
| `NeonArcStreaks-V2-4K` | V2, alternative **camera**: a low, tilted viewpoint over the same streak field (arcs foreshortened toward a soft horizon), with a slow rolling dolly-in (−9° → +5° roll, 1.18 → 0.86 zoom) | 3840 × 2160 | 30 | 360 | 12.000 s |

**Technology:** a single WebGL 2 fragment shader (`src/streaks/shader.ts`),
rendered natively at 3840 × 2160. Three streak layers (soft out-of-focus,
sharp, hairline) are evaluated analytically per pixel, with resolution-aware
anti-aliasing. Each streak's along-arc pattern travels exactly one period per
loop, so frame 60 is identical to frame 0.

**Audio:** the reference has a silent stereo AAC track. The render scripts
pass `--enforce-audio-track` so the deliverables also carry a silent AAC
track.

**Duration note:** the reference is 360 frames at 29.97 fps (12.012 s). At
exactly 30 fps, 12.012 s would be 360.36 frames, which isn't possible. The
composition keeps the reference's exact frame count (360 frames = 12.000 s).

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- Internet access on the first render, so Remotion can download its Chrome
  Headless Shell. Alternatively, point `REMOTION_BROWSER_EXECUTABLE` to a local
  Chrome Headless Shell (see `remotion.config.ts`).
- WebGL 2 is provided by `--gl=swangle` (set in `remotion.config.ts`), which
  works without a GPU.

## Commands

```console
npm ci                 # install exact dependency versions (or: npm i)
npm run dev            # open Remotion Studio to preview both 4K compositions

npm run render:v1      # -> out/Composition2_Version1_1080p.mp4 (4K comp rendered at --scale=0.5)
npm run render:v2      # -> out/Composition2_Version2_1080p.mp4
npm run render:all     # both 1080p deliverables

npm run render:v1:4k   # optional 4K master -> out/Composition2_Version1_4K.mp4
npm run render:v2:4k   # optional 4K master -> out/Composition2_Version2_4K.mp4
```

Output settings (`remotion.config.ts`): H.264, yuv420p, CRF 16, PNG intermediate frames.

## Files

- `src/Root.tsx`: registers the two 4K compositions
- `src/streaks/NeonArcStreaks.tsx`: WebGL 2 setup and per-frame uniforms
- `src/streaks/shader.ts`: the GLSL ES 3.0 shaders (streak field + V2 camera)
