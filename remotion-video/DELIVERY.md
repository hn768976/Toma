# Delivery manifest

Eleven versions of the microscopic-bacteria series, one per reference
clip. Every one is built from the single supplied bacillus GLB, with no
change to its geometry.

## Format

| | |
|---|---|
| Compositions | 11, authored at **3840×2160 @ 30fps** |
| Delivered | **1920×1080**, H.264 / MP4, yuv420p, limited range, Rec.709 |
| Audio | none |
| Structure | colour pass for the first half, time-aligned white-on-black matte for the second |

The 1080p files are rendered from the 4K compositions with
`--scale=0.5`; there is no separate 1080p composition to keep in sync.

```bash
npm install
npm run render:bacteria:1080p   # 11 × 1920×1080
npm run render:bacteria:4k      # 11 × 3840×2160
npm run dev                     # Remotion Studio, all 11 compositions
```

## Versions

| Composition | Look | Reference | Frames | Duration |
|---|---|---|---|---|
| `Bacteria01ElectricCyan` | Electric cyan bloom | istockphoto-2233372852 | 240 | 8.000s |
| `Bacteria02VioletCluster` | Violet dark cluster | istockphoto-2278455892 (colour pass) | 396 | 13.200s |
| `Bacteria03PaleBlueSoftFocus` | Pale blue soft focus | istockphoto-2278455755 | 360 | 12.000s |
| `Bacteria04SaturatedCobalt` | Saturated cobalt | istockphoto-2270723498 | 240 | 8.000s |
| `Bacteria05VioletMatte` | Violet matte key | istockphoto-2278455892 (matte pass) | 396 | 13.200s |
| `Bacteria06MagentaBloom` | Magenta bloom | istockphoto-2279714697 | 360 | 12.000s |
| `Bacteria07GoldenField` | Golden fluid field | bacteria-cells-floating-in-a-golden-fluid | 841 | 28.033s |
| `Bacteria08LavenderProbiotic` | Lavender probiotic | lactobacillus-bacteria-probiotic | 251 | 8.367s |
| `Bacteria09BrightfieldGrey` | Bright-field grey | microscopic-view-of-infectious-bacteria-cells | 901 | 30.033s |
| `Bacteria10CrimsonSalmonella` | Crimson salmonella | microscopic-salmonella-bacteria | 469 | 15.633s |
| `Bacteria11SteelTeal` | Steel teal swarm | antibiotic-resistant-bacteria | 274 | 9.133s |

4728 frames in total. Each duration matches its reference clip exactly.

## A note on versions 02 and 05

Two of the eleven uploads were byte-identical — the same iStock clip
(2278455892), which carries its colour pass in the front half of its
timeline and its alpha, as a white-on-black matte, in the back half.
Version 02 is graded to that clip's colour pass and version 05 to its
matte pass, so the set delivers eleven distinct looks rather than ten
and a duplicate.

That clip is also where the colour/matte structure used across the
whole series comes from: the split sits at exactly 50%, and the matte
replays the colour pass from frame 0, so frame *n* of the matte is
precisely the alpha of frame *n* of the colour.
