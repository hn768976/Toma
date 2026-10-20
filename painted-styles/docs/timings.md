# Timings

Machine: 4-core cloud container, numpy single-threaded, one paint job at a time (the determinism re-run).

## Layer paints (3840x2160 + 10% bleed = 4608x2592)

Each layer is cut from a cumulative paint (sky, sky+clouds, ...), so the time for layer *n* paints groups 0..n.
The last prefix (reeds) also writes the 40-60 draw-on snapshots for the three draw-on styles.

| Style | sky | clouds | far | near | water | mist | boat | birds | reeds | total |
|---|---|---|---|---|---|---|---|---|---|---|
| artdeco | 16s | 15s | 18s | 22s | 25s | 27s | 28s | 27s | 29s | 3.4 min |
| inkwash | 56s | 53s | 53s | 55s | 46s | 49s | 48s | 48s | 522s | 15.5 min |
| linocut | 50s | 46s | 50s | 62s | 85s | 86s | 89s | 85s | 90s | 10.7 min |
| stainedglass | 62s | 61s | 67s | 70s | 92s | 101s | 104s | 106s | 551s | 20.2 min |
| watercolour | 27s | 28s | 33s | 36s | 54s | 51s | 52s | 57s | 331s | 11.2 min |

## Stills (3840x2160)

| Still | Paint time |
|---|---|
| ArtDeco_Coast_Day.png | 17s |
| ArtDeco_Coast_Dusk.png | 22s |
| ArtDeco_Forest_Day.png | 20s |
| ArtDeco_Forest_Dusk.png | 18s |
| ArtDeco_Lake_Day.png | 18s |
| ArtDeco_Lake_Dusk.png | 16s |
| InkWash_Coast_BlackInk.png | 38s |
| InkWash_Coast_Indigo.png | 39s |
| InkWash_Forest_BlackInk.png | 41s |
| InkWash_Forest_Indigo.png | 44s |
| InkWash_Lake_BlackInk.png | 27s |
| InkWash_Lake_Indigo.png | 28s |
| Linocut_Coast_Indigo.png | 42s |
| Linocut_Coast_Vermilion.png | 40s |
| Linocut_Forest_Indigo.png | 40s |
| Linocut_Forest_Vermilion.png | 41s |
| Linocut_Lake_Indigo.png | 47s |
| Linocut_Lake_Vermilion.png | 41s |
| StainedGlass_Coast_Day.png | 61s |
| StainedGlass_Coast_Dusk.png | 62s |
| StainedGlass_Forest_Day.png | 73s |
| StainedGlass_Forest_Dusk.png | 69s |
| StainedGlass_Lake_Day.png | 65s |
| StainedGlass_Lake_Dusk.png | 62s |
| Watercolour_Coast_Day.png | 36s |
| Watercolour_Coast_Dusk.png | 35s |
| Watercolour_Forest_Day.png | 69s |
| Watercolour_Forest_Dusk.png | 65s |
| Watercolour_Lake_Day.png | 28s |
| Watercolour_Lake_Dusk.png | 30s |
| **all 30** | **20.6 min** |

## Remotion 720p previews (--scale=1/3, --concurrency=4, --gl=angle, CRF 16)

| Composition | Frames | Wall time | Per frame |
|---|---|---|---|
| Painted-Watercolour-LakeLoop | 600 | 697s | 1.16s |
| Painted-ArtDeco-LakeLoop | 600 | 565s | 0.94s |
| Painted-StainedGlass-LakeLoop | 600 | 561s | 0.94s |
| Painted-InkWash-LakeLoop | 600 | 567s | 0.94s |
| Painted-Linocut-LakeLoop | 600 | 566s | 0.94s |
| Painted-Watercolour-DrawOn | 360 | 181s | 0.50s |
| Painted-InkWash-DrawOn | 360 | 187s | 0.52s |
| Painted-StainedGlass-DrawOn | 360 | 191s | 0.53s |

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

