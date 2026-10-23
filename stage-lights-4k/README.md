# Composition 2 — Stage Light Wall (4K, Remotion + WebGL 2 shader)

A wall of par-can stage lights flashing on and off with swinging, streaky
light beams in a cool blue-white grade, recreated from reference clip
`istockphoto-855195970` (601 frames @ 29.97 fps = 20.053 s).

| Composition id    | Size        | FPS | Frames | Duration | Notes |
|-------------------|-------------|-----|--------|----------|-------|
| `StageLights-V1`  | 3840 × 2160 | 30  | 602    | 20.067 s | Matches the reference: locked-off front view of the 8 × 4 grid |
| `StageLights-V2`  | 3840 × 2160 | 30  | 602    | 20.067 s | Alternative camera: oblique orbit (22° → −22° yaw) with a slow dolly-in and tilt-up across a wider 16 × 8 wall |

At exactly 30 fps a 20.053 s clip cannot be hit to the frame; 602 frames
(20.067 s) is the nearest frame count (13 ms longer, under half a frame).

Technology: a single full-screen WebGL 2 fragment shader. Each pixel casts a
camera ray onto the wall plane, then accumulates every lamp's housing rings,
lit face, bloom and a soft streaked beam cone. A deterministic, seeded flash
schedule (`src/lights.ts`) drives intensity, beam angle and swing; its
timing statistics (~30 % duty, soft 5–7 frame attack, ~13 frame median
hold, 4–9 frame release, a share of partial-brightness flashes) were measured
from the reference. Each pixel shades only its own lamp housing plus the
currently lit lamps (packed on the CPU), which keeps 4K renders practical.
No external assets.

## Files

- `src/Root.tsx` — registers both 4K compositions
- `src/StageLights.tsx` — WebGL 2 setup, camera paths, per-frame uniforms
- `src/shader.ts` — GLSL ES 3.00 shaders
- `src/lights.ts` — seeded flash/beam schedule
- `remotion.config.ts` — uses the ANGLE OpenGL renderer (required for WebGL)

## Commands

```bash
npm ci                      # install exact dependency versions (Node 20.19+/22.13+)
npm run dev                 # open Remotion Studio

# 4K master renders
npx remotion render StageLights-V1 out/StageLights-V1-4K.mp4 --codec=h264
npx remotion render StageLights-V2 out/StageLights-V2-4K.mp4 --codec=h264

# 1080p delivery renders (same 4K composition, rendered at 0.5 scale)
npx remotion render StageLights-V1 out/StageLights-V1-1080p.mp4 --scale=0.5 --codec=h264 --crf=16
npx remotion render StageLights-V2 out/StageLights-V2-1080p.mp4 --scale=0.5 --codec=h264 --crf=16
```

The WebGL canvas allocates its drawing buffer at `composition size × render
scale`, so `--scale=0.5` draws natively at 1920×1080 and the default scale
draws natively at 3840×2160.

If Remotion cannot download its headless Chrome (offline machines), pass an
existing Chromium headless shell: `--browser-executable=/path/to/headless_shell`.
