# Delivered files

| File | Size | Duration | Frames | Codec |
| --- | --- | --- | --- | --- |
| `V1_FrostedPanesRing_1920x1080_30fps.mp4` | 1920x1080 | 10.000s | 300 @ 30fps | H.264 High, yuv420p, no audio |
| `V2_GlossyCardsRing_1920x1080_30fps.mp4` | 1920x1080 | 16.000s | 480 @ 30fps | H.264 High, yuv420p, no audio |

Both are seamless loops — the final frame runs straight back into the first.

Panels in both are placed around a ring at equal angular gaps, and the camera
in both is dead front and dead level (on the +Z axis at the ring's height,
looking straight down -Z, no yaw, pitch or roll).

The 4K compositions (`GlassPanesRing-V1-4K`, `GlassCardsRing-V2-4K`, both
3840x2160) are set up in the project and render with `npm run render:v1-4k` /
`npm run render:v2-4k`. See `../src/glass/README.md`.
