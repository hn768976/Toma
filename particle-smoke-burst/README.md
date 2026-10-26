# Particle Smoke Burst (Remotion, 4K)

Composition 2: a burst of glowing particle filaments on black. A gold and
orange cap expands and rolls to the right, and a pink-violet then blue body
fills in behind it. It's rendered with **WebGL 2 shaders**: additive filament
segments in a half-float HDR buffer, a two-level bloom, and tone mapping. The
particle simulation is deterministic, so it gives the same result whatever
order frames are rendered in.

| Composition ID     | Size      | FPS | Frames | Duration | Notes |
|--------------------|-----------|-----|--------|----------|-------|
| `SmokeBurst-V1-4K` | 3840×2160 | 30  | 189    | 6.300 s  | Matches the reference: near side-on camera, slow push-in |
| `SmokeBurst-V2-4K` | 3840×2160 | 30  | 189    | 6.300 s  | Alternative camera: low-angle three-quarter view from ahead of the burst, orbiting and rising |

The reference clip is 6.2917 s (151 frames at 24 fps). At 30 fps that is
188.75 frames, so it can't be matched exactly. 189 frames (6.300 s, +8 ms) is
the closest whole-frame length.

## Requirements
- Node.js 20.19+ / 22.13+ / 24+
- About 4 GB of free RAM. No GPU needed: rendering uses SwiftShader, Chrome's
  software WebGL (`swangle`), set in `remotion.config.ts`.

## Commands
```console
npm ci
npm run dev

# 4K master
npx remotion render SmokeBurst-V1-4K out/SmokeBurst-V1-4K.mp4 --codec=h264
npx remotion render SmokeBurst-V2-4K out/SmokeBurst-V2-4K.mp4 --codec=h264

# 1080p delivery (the 4K composition downscaled by Remotion)
npx remotion render SmokeBurst-V1-4K out/SmokeBurst-V1-1080p.mp4 --codec=h264 --scale=0.5 --crf=16
npx remotion render SmokeBurst-V2-4K out/SmokeBurst-V2-1080p.mp4 --codec=h264 --scale=0.5 --crf=16
```

## Layout
- `src/Root.tsx`: registers both 4K compositions
- `src/presets.ts`: duration and FPS, plus the simulation, palette and camera parameters for V1 and V2
- `src/SmokeBurst.tsx`: the Remotion component (builds filament segments per frame)
- `src/engine/sim.ts`: deterministic strand-based particle simulation, with per-tab caching and snapshots
- `src/engine/renderer.ts`: WebGL 2 HDR accumulation, bloom and tone-map shaders
- `src/engine/noise.ts`: seeded simplex noise

Everything is procedural and seeded. There are no external assets.
