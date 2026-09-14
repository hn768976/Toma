# Growth Timeline

Two broadcast-style data-graphics shots built on one shared scene: a blurred
world map, a perspective grid, a glowing cyan quarter axis with seven-segment
LED readouts, and a marching chevron trail.

| Composition             | Resolution  | Frames | Duration | Layout                          |
| ----------------------- | ----------- | ------ | -------- | ------------------------------- |
| `GrowthTimelineV1`      | 1920 × 1080 | 400    | 13.33 s  | Chevron trail, heat-ramp years  |
| `GrowthTimelineV1-4K`   | 3840 × 2160 | 400    | 13.33 s  | ″                               |
| `GrowthTimelineV2`      | 1920 × 1080 | 420    | 14.00 s  | Mirrored column chart           |
| `GrowthTimelineV2-4K`   | 3840 × 2160 | 420    | 14.00 s  | ″                               |

All four run at 30 fps.

## How the two versions differ

|                | V1 — chevron trail                   | V2 — mirrored columns                       |
| -------------- | ------------------------------------ | ------------------------------------------- |
| Content        | Axis + trail only                    | Axis + trail + green/amber columns          |
| Axis placement | Lower third, rises into frame        | Mid frame, drops into frame                 |
| Camera         | Pull back, 1.08 → 0.93               | Push in, 0.82 → 0.96                        |
| Yaw / roll     | 15.5° → 20°, −6.4° → −9.6°           | 11.5° → 16.5°, −10.6° → −7.1°               |
| Span           | 2025 → 2033 (32 quarters)            | 2025 → 2031 (24 quarters)                   |
| Year readouts  | Ignite green → amber → orange → red  | Stay white                                  |
| Trail hue      | Full ramp, cyan → white → magenta    | Ramp truncated at 62 %, ends on pale pink    |

## Rendering

```console
npx remotion render GrowthTimelineV1    out/GrowthTimeline-V1-1080p.mp4 --codec=h264 --image-format=png --crf=15 --muted
npx remotion render GrowthTimelineV2    out/GrowthTimeline-V2-1080p.mp4 --codec=h264 --image-format=png --crf=15 --muted
npx remotion render GrowthTimelineV1-4K out/GrowthTimeline-V1-4K.mp4    --codec=h264 --image-format=png --crf=15 --muted
npx remotion render GrowthTimelineV2-4K out/GrowthTimeline-V2-4K.mp4    --codec=h264 --image-format=png --crf=15 --muted
```

## Files

- `constants.ts` — timings, palette, colour ramps, the deterministic hash the
  column heights come from.
- `camera.ts` — the `Camera` type and the CSS 3D transform the plane is drawn
  with.
- `Backdrop.tsx` — world map, relighting, vignette.
- `Plane.tsx` — grid, columns, axis + readouts, chevron trail. Everything here
  is positioned in plane space (x = quarter × `QUARTER_PX`, y = 0 on the axis).
- `SegmentText.tsx` — the seven-segment LED display, drawn as SVG so the render
  never waits on a font.
- `GrowthTimeline.tsx` — the two camera rigs, depth of field, bloom, grain.

## Resolution

The scene is authored against a 1920 × 1080 design canvas and scaled by the
`resolutionScale` prop, so the 4K compositions are a true vector upscale rather
than a second set of numbers. `resolutionScale` must match the width/height the
composition is registered with in `src/Root.tsx`: 1 for 1080p, 2 for 4K.

## Map data

`public/world-land.svg` is an equirectangular land outline derived from Natural
Earth 1:50m via the `world-atlas` package (public domain), simplified for size.
