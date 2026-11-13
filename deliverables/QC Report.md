# QC Report — Stem Cells in Membranes / Yeast SEM Fly-Through

Date: 2026-11-13. All checks below were run on the final files in this folder.
Verdicts: three files PASS WITH NOTES, one PASS. Nothing fails technically; the
notes are about how closely the two "Version 1" videos resemble their references.

## Deliverables

| # | File | Composition | Verdict |
|---|------|-------------|---------|
| 1 | Version 1 - Stem Cells in Membranes (Reference Match) - 1080p.mp4 | `StemCells-V1-ReferenceMatch` | PASS WITH NOTES |
| 2 | Version 2 - Stem Cells in Membranes (Orchid Palette) - 1080p.mp4 | `StemCells-V2-OrchidPalette` | PASS WITH NOTES |
| 3 | Version 1 - Yeast SEM Fly-Through (Reference Match) - 1080p.mp4 | `YeastSEM-V1-ReferenceMatch` | PASS WITH NOTES |
| 4 | Version 2 - Yeast SEM (Orbit Pull-Back Camera) - 1080p.mp4 | `YeastSEM-V2-OrbitPullBack` | PASS |
| 5 | Stem Cells in Membranes - Remotion Project (4K).zip | both stem compositions, 3840x2160 | PASS |
| 6 | Yeast SEM Fly-Through - Remotion Project (4K).zip | both yeast compositions, 3840x2160 | PASS |

`SHA256SUMS.txt` holds checksums for all six files.

Technology: Remotion 4 (projects created with `npx create-video --blank`),
Three.js on WebGL2 with custom GLSL ES 3.0 shaders. No external assets, no audio.

Version 2 choices:
- Stem cells: different colour palette (magenta / orchid), same scene and camera.
- Yeast SEM: different camera angle and movement (starts close on the three hero
  cells, orbits roughly 80 degrees and pulls back), same colours.

## Technical checks (measured on the final files)

| Check | Stem V1 | Stem V2 | Yeast V1 | Yeast V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Container | MP4 | MP4 | MP4 | MP4 |
| Resolution | 1920x1080 | 1920x1080 | 1920x1080 | 1920x1080 |
| Frame rate | 30 fps constant | 30 fps constant | 30 fps constant | 30 fps constant |
| Frames / duration | 299 / 9.967 s | 299 / 9.967 s | 300 / 10.000 s | 300 / 10.000 s |
| Reference duration | 9.96 s | 9.96 s | 10.00 s | 10.00 s |
| Pixel format / colour | yuv420p, BT.709, limited range | same | same | same |
| Audio streams | none | none | none | none |
| Bitrate | 25.4 Mb/s | 25.8 Mb/s | 23.8 Mb/s | 22.5 Mb/s |
| Full decode errors | 0 | 0 | 0 | 0 |
| Black frames (blackdetect) | none | none | none | none |
| Frozen frames (freezedetect) | none | none | none | none |
| Largest frame-to-frame mean-luma step (of 255) | 0.17 | 0.18 | 1.38 | 0.41 |
| Render log errors | 0 | 0 | 0 | 0 |

- Duration note: the stem-cell reference is 9.96 s, which is 298.8 frames at
  30 fps. A whole number of frames is required, so 299 frames (9.967 s, +0.007 s)
  is used. The yeast clip matches its reference exactly.
- The reference clips themselves are 25 fps (stem) and 30 fps (yeast); all
  outputs are 30 fps as requested.
- Flicker: the reference clips' own largest luma steps are 0.62 (stem) and 1.25
  (yeast), so all four outputs are at or near reference level. The 1.38 step in
  Yeast V1 (3.93 s) is a defocused foreground cell leaving frame, not a flicker.
- No watermark from the stock references appears in any output.
- Audio: none of the references' recreations carry audio; no audio issues apply.

## Project ZIP checks

Each ZIP was extracted into an empty folder and exercised with the commands
documented in its README.

| Check | Stem ZIP | Yeast ZIP |
|---|---|---|
| Archive integrity (`unzip -t`) | no errors | no errors |
| Contents | source (`src/`), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, eslint/prettier config, README | same |
| Assets required | none (fully procedural) | none (fully procedural) |
| `npm install` | OK | OK |
| Type check (`tsc`) | OK | OK |
| Compositions listed | 2 x 3840x2160, 30 fps, 299 frames | 2 x 3840x2160, 30 fps, 300 frames |
| Native 4K render (`npx remotion render <id> out.mp4`) | H.264 3840x2160 yuv420p produced | H.264 3840x2160 yuv420p produced |
| 1080p render (`--scale=0.5`) | 1920x1080 produced | 1920x1080 produced |
| Frame re-rendered from ZIP vs delivered video | matches (PSNR 36.7 dB after H.264) | matches (PSNR 37.8 dB after H.264) |

The 4K test rendered short frame ranges plus single 4K stills from each
composition, not a full-length 4K encode of all four (the build machine has no
GPU). The delivered 1080p files are full-length renders of the same 4K
compositions at `--scale=0.5`.

## Independent review

A separate reviewer agent compared the videos with the references in three
rounds; its findings were applied between rounds, and it performed the final
sign-off on these exact files. Its verdicts are the ones in the table above.

Fixed along the way (confirmed by the reviewer): picture brightness and colour
now within a few percent of both references; BT.709 tagging; bitrate; stair-
stepped membrane rims; faceted yeast cells; thin hard rim light; near-camera
"pop" frames in both yeast versions; background banding; the stem-cell camera
drifting the wrong way and easing out at the end; the yeast Version 2 orbit
being too slight.

## Remaining differences from the references

These are procedural recreations, not copies of the stock footage. The
reviewer's remaining notes on the final files:

Stem cells (both versions)
- Roughly 2-3x more cells in frame than the reference (about 15 vs 7 nuclei at
  the start, about 50 vs 16 at the end), and some membranes still intersect.
- Membranes are smooth translucent spheres with clean rims; the reference has
  thicker, wobblier, more refractive shells with stronger highlights.
- Nuclei are darker and flatter-lit, with a pitted texture rather than the
  reference's wrinkled relief and bright teal rim light.
- Slightly lower contrast: highlights 14-17 levels lower, shadows 11 higher.
- Apparent motion is about half the reference's speed (same direction and shape).

Yeast Version 1
- Large out-of-focus foreground cells pass through at about 1.5-3.5 s; the
  reference has fewer, later (about 4-5.5 s) and smaller.
- The shot keeps drifting to the end but slows to about a third of the
  reference's motion in the last 2 seconds.
- Cells are rounder and more uniform, with shallower surface detail.
- Highlights about 16 levels lower at the 95th percentile.
- Edges of heavily defocused cells look slightly grainy at 100%.

Yeast Version 2
- Intentionally different camera move; same cell-shape and detail notes apply.
- Minor stair-stepping on the brightest rims of large sharp cells at 100%.

## Version 2 distinguishability

- Stem V2: unmistakable. Mean RGB 181/106/170 (magenta, purple nuclei) against
  71/150/196 for V1; geometry and camera identical.
- Yeast V2: unmistakable. Opens close on the hero cells and orbits / pulls back
  to the wide colony, the opposite of V1's push-in; same shading quality.
