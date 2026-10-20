## One 4K frame (3840×2160, --scale=1, --gl=angle, software WebGL on this CPU-only container)

Measured as 30 consecutive frames at --concurrency=1 (including ~12 s browser/bundle start-up):
| Composition | 30 frames | ≈ per frame |
|---|---|---|
| Painted-Watercolour-LakeLoop | 231 s | ~7.3 s |
| Painted-ArtDeco-LakeLoop | 229 s | ~7.2 s |
| Painted-StainedGlass-DrawOn (painting phase) | 62 s | ~1.7 s (the 9–12 s hold costs like a loop frame) |

4K estimates on this machine: a 600-frame loop ≈ 73 min at concurrency 1, ≈ 25–30 min at concurrency 4;
a 360-frame draw-on ≈ 10 min (painting) + ≈ 11 min (hold) at concurrency 1. On a machine with a real GPU behind ANGLE
expect these to drop by an order of magnitude — the cost is software rasterising ten 4608×2592 textures per frame.
720p previews ran at ~0.95–1.15 s/frame (concurrency 4).
