# Delivery manifest

Eleven versions of the microscopic-bacteria series, one per reference
clip, each delivered as a colour clip and a matching matte clip — 22
files. Every one is built from the single supplied bacillus GLB, with
no change to its geometry.

## Format

| | |
|---|---|
| Compositions | 22, authored at **3840×2160 @ 30fps** |
| Delivered | **1920×1080**, H.264 / MP4, yuv420p, limited range, Rec.709 |
| Audio | none |
| Pairing | `<Version>.mp4` is the picture, `<Version>Matte.mp4` is its key |

Both passes of a version share a duration, a seed and a timeline, so
frame *n* of the matte is exactly the alpha of frame *n* of the colour,
over the full length of the clip.

The 1080p files are rendered from the 4K compositions with
`--scale=0.5`; there is no separate 1080p composition to keep in sync.

```bash
npm install
npm run render:bacteria:1080p   # 22 × 1920×1080
npm run render:bacteria:4k      # 22 × 3840×2160
npm run dev                     # Remotion Studio: Bacteria-Colour and Bacteria-Matte folders
```

## Versions

| Colour | Matte | Look | Reference | Frames | Duration |
|---|---|---|---|---|---|
| `Bacteria01ElectricCyan` | `Bacteria01ElectricCyanMatte` | Electric cyan bloom | istockphoto-2233372852 | 240 | 8.000s |
| `Bacteria02VioletCluster` | `Bacteria02VioletClusterMatte` | Violet dark cluster | istockphoto-2278455892 (first read) | 396 | 13.200s |
| `Bacteria03PaleBlueSoftFocus` | `Bacteria03PaleBlueSoftFocusMatte` | Pale blue soft focus | istockphoto-2278455755 | 360 | 12.000s |
| `Bacteria04SaturatedCobalt` | `Bacteria04SaturatedCobaltMatte` | Saturated cobalt | istockphoto-2270723498 | 240 | 8.000s |
| `Bacteria05IndigoDrift` | `Bacteria05IndigoDriftMatte` | Indigo drift | istockphoto-2278455892 (second read) | 396 | 13.200s |
| `Bacteria06MagentaBloom` | `Bacteria06MagentaBloomMatte` | Magenta bloom | istockphoto-2279714697 | 360 | 12.000s |
| `Bacteria07GoldenField` | `Bacteria07GoldenFieldMatte` | Golden fluid field | bacteria-cells-floating-in-a-golden-fluid | 841 | 28.033s |
| `Bacteria08LavenderProbiotic` | `Bacteria08LavenderProbioticMatte` | Lavender probiotic | lactobacillus-bacteria-probiotic | 251 | 8.367s |
| `Bacteria09BrightfieldGrey` | `Bacteria09BrightfieldGreyMatte` | Bright-field grey | microscopic-view-of-infectious-bacteria-cells | 901 | 30.033s |
| `Bacteria10CrimsonSalmonella` | `Bacteria10CrimsonSalmonellaMatte` | Crimson salmonella | microscopic-salmonella-bacteria | 469 | 15.633s |
| `Bacteria11SteelTeal` | `Bacteria11SteelTealMatte` | Steel teal swarm | antibiotic-resistant-bacteria | 274 | 9.133s |

4728 frames per pass, 9456 in total. Each duration
matches its reference clip exactly.

## Mattes

Each version's matte ships as its own clip, the same length as the
colour and keyed to it frame for frame — a full-length key, so you can
pull any part of the clip rather than a sample of it. The matte is flat
white on black: no backdrop, no defocus, no grade, no grain.

## A note on versions 02 and 05

Two of the eleven uploads were byte-identical — the same iStock clip,
2278455892. Rather than ship a duplicate, version 05 takes a second
read of it: a brighter indigo across a drifting, spread-out field,
against version 02's tight violet knot, and on its own layout seed. The
set therefore delivers eleven distinct looks rather than ten and a
repeat.
