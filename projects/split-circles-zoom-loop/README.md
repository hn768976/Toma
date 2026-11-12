# Split Circles Zoom Loop (Remotion · Canvas 2D · 4K)

Flat "paper-cut" motion graphic: two split (two-tone) disks roll in from opposite
corners along diagonal strips, meet, orbit each other on a growing platform, and
a small circle born at their contact point zooms up to become the next
background – a seamless 3-second infinite-zoom cycle, repeated 3×.
Drawn with the **Canvas 2D** API (screen-space gradients + soft drop shadows),
choreography keyed frame-by-frame from the reference.

| Composition id | Version | Size | FPS | Frames | Duration |
|---|---|---|---|---|---|
| `SplitCircles-V1-Match-4K` | V1 – matches the reference (violet → pink palette sampled from the footage) | 3840×2160 | 30 | 270 | 9.000 s |
| `SplitCircles-V2-CobaltAqua-4K` | V2 – alternative **colour palette** (cobalt → aqua-mint) with identical motion | 3840×2160 | 30 | 270 | 9.000 s |

> The reference is 270 frames @ 29.97 fps (9.009 s). At exactly 30 fps the same
> 270 frames last 9.000 s – the closest whole-frame length (Δ = 9 ms, < 1 frame).

## Requirements
* Node.js 20.19+ / 22.13+ / 24+
* No external assets – all shapes are drawn procedurally.

## Install
```bash
npm install
```

## Preview
```bash
npm run dev            # Remotion Studio
```

## Render
```bash
# Native 4K masters (H.264 MP4)
npm run render:v1:4k
npm run render:v2:4k

# 1080p delivery files rendered from the 4K compositions (what was delivered)
npm run render:delivery          # uses --scale=0.5 on the 4K compositions
```

## Project layout
```
src/index.ts                  registerRoot
src/Root.tsx                  the two 4K compositions
src/circles/constants.ts      fps / duration / loop length / 4K size
src/circles/scene.ts          choreography keyframes + Canvas 2D drawing
src/circles/spline.ts         monotone cubic keyframe interpolation
src/circles/palettes.ts       V1 (reference) and V2 (cobalt/aqua) palettes
src/circles/SplitCircles.tsx  Remotion component
remotion.config.ts            codec, pixel format, browser fallback
render-delivery.sh            1080p delivery renders
```
