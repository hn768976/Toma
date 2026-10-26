# Coral Particle Blobs (Remotion, 4K)

Composition 1: thousands of soft-lit coral-pink spheres packed into curved,
folded sheets that flow and drift through a light-grey studio space, with
depth of field. It's rendered with **WebGL 2 shaders**: instanced sphere
impostors, sorted back to front, with a per-particle depth-of-field blur.

| Composition ID     | Size      | FPS | Frames | Duration | Notes |
|--------------------|-----------|-----|--------|----------|-------|
| `CoralBlobs-V1-4K` | 3840×2160 | 30  | 300    | 10.000 s | Matches the reference: dusty-pink/coral palette on light grey |
| `CoralBlobs-V2-4K` | 3840×2160 | 30  | 300    | 10.000 s | Alternative colour palette: aqua/deep-teal on pale blue-grey |

## Requirements
- Node.js 20.19+ / 22.13+ / 24+
- About 4 GB of free RAM. No GPU needed: rendering uses SwiftShader, Chrome's
  software WebGL (`swangle`), set in `remotion.config.ts`.

## Commands
```console
npm ci                       # install the exact dependency versions from package-lock.json
npm run dev                  # Remotion Studio preview

# 4K master
npx remotion render CoralBlobs-V1-4K out/CoralBlobs-V1-4K.mp4 --codec=h264 --pixel-format=yuv420p
npx remotion render CoralBlobs-V2-4K out/CoralBlobs-V2-4K.mp4 --codec=h264 --pixel-format=yuv420p

# 1080p delivery (the 4K composition downscaled by Remotion)
npx remotion render CoralBlobs-V1-4K out/CoralBlobs-V1-1080p.mp4 --codec=h264 --scale=0.5 --crf=16 --pixel-format=yuv420p
npx remotion render CoralBlobs-V2-4K out/CoralBlobs-V2-1080p.mp4 --codec=h264 --scale=0.5 --crf=16 --pixel-format=yuv420p
```
On a machine with a GPU, add `--gl=angle` for faster renders.

## Layout
- `src/Root.tsx`: registers both 4K compositions
- `src/presets.ts`: duration and FPS, plus every look and motion parameter for V1 and V2
- `src/CoralBlobs.tsx`: the Remotion component (one WebGL draw per frame)
- `src/engine/field.ts`: deterministic particle-field generation and per-frame motion
- `src/engine/renderer.ts`: WebGL 2 shaders (backdrop, shaded spheres with depth of field)
- `src/engine/noise.ts`: seeded simplex noise

Everything is procedural and seeded, so every render is identical. There are
no external assets.
