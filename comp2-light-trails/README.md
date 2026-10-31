# Composition 2 — Light Trails (Remotion · Canvas 2D · SVG colour-ramp filter)

Hand-painted, long-exposure light trails on black: wiggly glowing filaments,
dotted fine webs, and thick out-of-focus streaks and bokeh that flash past.
Rebuilt procedurally from the 8.333 s reference clip.

| Composition ID          | Resolution  | FPS | Frames | Duration | Description |
|-------------------------|-------------|-----|--------|----------|-------------|
| `LightTrails-V1-Gold`   | 3840 × 2160 | 30  | 250    | 8.333 s  | Version 1: amber/gold palette that matches the reference. |
| `LightTrails-V2-Violet` | 3840 × 2160 | 30  | 250    | 8.333 s  | Version 2: alternative **colour palette** (neon violet/magenta). Same trails, timing and motion. |

## Requirements

* Node.js 20.19+ or 22.13+ (tested with 22.23)
* npm

## Commands

```bash
npm ci                     # install exact dependency versions
npm run dev                # Remotion Studio preview
npm run render:v1:4k       # -> out/LightTrails-V1-Gold_4K.mp4   (3840x2160 H.264)
npm run render:v2:4k       # -> out/LightTrails-V2-Violet_4K.mp4
npm run render:v1:1080p    # 4K master -> out/LightTrails-V1-Gold_1080p.mp4 (Lanczos downscale)
npm run render:v2:1080p    # 4K master -> out/LightTrails-V2-Violet_1080p.mp4
npm run render:all         # all of the above in order
```

The `:1080p` scripts use Remotion's bundled ffmpeg to make the delivery files:
H.264 High profile, `yuv420p`, BT.709 limited range with correct colour tags,
30 fps, `+faststart`. They convert the full-range BT.601 4K master through an
RGB intermediate, so the colours match the rendered frames exactly.

You can also render 1080p directly from the 4K composition, without a 4K
master: `npx remotion render LightTrails-V1-Gold out/v1_1080p.mp4 --scale=0.5`.

On the first render, Remotion downloads its Chrome Headless Shell. In
sandboxes that can't download it, set `REMOTION_BROWSER_EXECUTABLE` to a local
Chromium headless shell (see `remotion.config.ts`).

## How it works (`src/trails/`)

* `scene.ts`: generates every stroke once from a fixed seed: squiggles, fine
  dotted filaments, hero streaks and bokeh. Each stroke is a random walk with
  curvature drift, occasional kinks and band-limited hand tremor. Strokes start
  near wandering cluster centres. `trailState()` returns each stroke's head
  progress and opacity at time *t*, so each frame is a pure function of time.
  Like the reference, the clip is a **seamless loop**. Stroke ages wrap modulo
  the 250-frame loop, and the cluster paths, flow direction, flicker and camera
  shake all complete whole cycles.
* `LightTrails.tsx`: draws grayscale *intensity* with additive blending into
  layers: crisp strokes at full resolution and soft streaks at half resolution.
  It builds glows from two blurred quarter-resolution passes, then maps
  intensity to colour through an SVG `feComponentTransfer` lookup table.
  A light handheld camera drift and roll moves the whole exposure.
* `palette.ts`: the gold ramp, sampled from the reference footage by
  luminance bucket, and the violet V2 ramp.
