# Quality-Control Report

Two Remotion compositions, each with two versions, built at 3840×2160 (4K
UHD) and delivered at 1920×1080 in H.264 MP4. All four videos passed every
technical check. An independent review agent compared each video with its
reference.

## Deliverables

| # | File | Contents |
|---|------|----------|
| 1 | `Composition1_V1_Brightfield_1080p.mp4` | Microbe Field, V1: matches the reference (brightfield microscope) |
| 2 | `Composition1_V2_Fluorescence_1080p.mp4` | Microbe Field, V2: different colour palette (fluorescence / dark-field) |
| 3 | `Composition2_V1_LowTracking_1080p.mp4` | Neon Wave Flow, V1: matches the reference (low, tilted tracking shot) |
| 4 | `Composition2_V2_CraneSweep_1080p.mp4` | Neon Wave Flow, V2: different camera movement (crane/orbit over the track) |
| 5 | `Composition1_MicrobeField_4K_Project.zip`<br>`Composition2_NeonWaveFlow_4K_Project.zip` | Remotion projects containing the 4K compositions |

### How each composition was built

- **Composition 1** uses Canvas 2D. The filaments are built by integrating curvature along their length. They are drawn as tapered, translucent tubes, with blurred depth layers, procedural slide mottling, debris, a vignette and sensor grain.
  - **V2 alternative:** a different colour palette. Fluorescence imaging is the standard alternative view of this kind of specimen, so the subject and motion stay the same while the look changes completely.
- **Composition 2** uses Three.js with a custom WebGL 2 GLSL shader. Each filament segment is drawn as an analytically blurred gaussian line, and its width grows with depth-of-field defocus. One draw call per frame.
  - **V2 alternative:** a different camera movement. The reference's identity is its blue neon palette, so I changed the camera rather than the colours. The crane starts high on the near side, passes over the track and ends low on the far side.

## Technical checks

The four videos were measured with ffprobe and ffmpeg (decode, blackdetect and signalstats over every frame).

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Codec | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames | 901 | 901 | 601 | 601 |
| Duration (reference) | 30.033 s (30.030) | 30.033 s (30.030) | 20.033 s (20.020) | 20.033 s (20.020) |
| Pixel format / colour | yuv420p, BT.709 | yuv420p, BT.709 | yuv420p, BT.709 | yuv420p, BT.709 |
| Full-decode errors | 0 | 0 | 0 | 0 |
| Black segments | 0 | 0 | 0 | 0 |
| Frozen frames | 0 | 0 | 0 | 0 |
| Largest frame-to-frame brightness jump | 0.38 | 0.48 | 1.12 | 4.4 |
| Audio | none (reference has none) | none | none | none |

The 4.4-level jump in C2 V2 was checked frame by frame. A bright light plate leaves the frame smoothly over 4 frames during the crane move; it is not a pop.

**Duration.** The references are 29.97 fps clips lasting 30.03 s and 20.02 s. At exactly 30 fps no whole number of frames gives those lengths, so each composition uses the closest one:

| Composition | Frames | Length | Reference | Difference |
|---|---|---|---|---|
| Composition 1 | 901 | 30.033 s | 30.03 s | 3.3 ms |
| Composition 2 | 601 | 20.033 s | 20.02 s | 13.3 ms |

Both differences are under half a frame.

**Seamless loops.** Both references loop, so all motion in both compositions is periodic over the clip. The jump from the last frame back to the first was measured against a normal frame-to-frame step:

| Video | Last→first | Normal step |
|---|---|---|
| C1 V1 | 0.93 | 0.83 |
| C1 V2 | 1.66 | ≈1.5 |
| C2 V1 | ≈1.4× | 1× |

C2 V2 is a one-way camera move, so it does not loop by design.

## Project ZIP checks

Each ZIP was extracted into an empty directory and tested with the commands documented in its README. Every step passed.

- **Contents:** source code, `package.json` with `package-lock.json`, `remotion.config.ts`, tsconfig, ESLint and Prettier configs, and a README. There are no external assets; everything is procedural.
- **Integrity:** `unzip -t` reports no errors, and the extracted source is identical to the repository source (`diff -r`).
- **Install:** `npm ci` succeeds with 0 vulnerabilities.
- **Lint and types:** `npm run lint` (ESLint and `tsc`) runs clean.
- **Composition list:** `npx remotion compositions` lists all four compositions at 3840×2160, 30 fps, 901 or 601 frames.
- **4K render:** `npm run render:v1:4k` and `npm run render:v2:4k` (frames 0–29) in both projects produce H.264 at 3840×2160, 30 fps, and each output fully decodes without errors.
- **1080p deliverables:** these are the same compositions rendered with `--scale=0.5` (`npm run render:v1` / `render:v2`).

## Independent visual verification

Separate review agents compared each video with its reference, using frame comparisons, motion strips and region colour measurements. Each round of findings was fixed and the videos were re-rendered before the final check.

| Video | Final verdict | Remaining notes |
|---|---|---|
| C1 V1 | **PASS WITH NOTES** | Shapes, density, tube look, vignette ratio and loop match. Strands are slightly flatter and more uniform than the reference. The whole-frame brightness stepping flagged in review is fixed: the largest jump is now 0.38, against the reference's 0.36. |
| C1 V2 | **PASS** | Clearly different look (green-cyan glow on a near-black field); concept kept; no artifacts. |
| C2 V1 | **PASS WITH NOTES** | Overall colour is almost identical (mean RGB 21.9/43.1/86.2 against 22.5/41.1/86.2). The diagonal track, the arcs, the defocused foreground and the corner glow all match, with no flicker or popping. Some regions are brighter than the reference. The reference's crisp rectangular light slabs are only approximated, by soft gliding plates. The loop seam is a slight hitch, about 1.4× a normal step. |
| C2 V2 | **PASS WITH NOTES** | Clearly different camera move with the concept kept. When the camera is directly overhead, the arcs are seen edge-on and fade. There is no faceting, banding or blockiness. |

Earlier rounds found and fixed these problems:

- **Composition 1:**
  - cartoon-like outlined strands
  - loops that were too small
  - motion that was too fast
  - no seamless loop
- **Composition 2:**
  - starburst artifacts on defocused bends
  - a dense tangle of arcs
  - a missing track
  - colours that were too bright and saturated
  - the wrong framing and vanishing point
  - motion that was too slow
  - a render time of about 30 s per frame (now about 3 s)

The iStock watermark in the references is not reproduced in any video.

## SHA-256 checksums

```
4865145efd04fbd58fd7fc74fb289db39ffa2aa7389721dfac7da0f723315603  Composition1_V1_Brightfield_1080p.mp4
c11c424d47a9713eaad323058de25107e80348d4e44dad939d90f11f3141ad08  Composition1_V2_Fluorescence_1080p.mp4
555cec2188ad01ccfd5b05040fac2b5b0b869c0464c043427ccf8fa49d892617  Composition2_V1_LowTracking_1080p.mp4
db83b663273ccc8c987c7fb3d5043311295bb957c5e2751ca7a0356d0a858672  Composition2_V2_CraneSweep_1080p.mp4
6f66d88acfa69c01cbbd58a687c4dd6b6f017de64d94c82b368227fd9f23df5d  Composition1_MicrobeField_4K_Project.zip
1ec27690c14ee83cd754793e0b795c6b08871d8cfa63f7c351feb8a9e9c6c694  Composition2_NeonWaveFlow_4K_Project.zip
```
