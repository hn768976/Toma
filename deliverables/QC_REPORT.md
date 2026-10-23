# Quality-Control Report

**Date:** 2026-10-23. All checks below were run on the final files in this folder.

## Deliverables

| # | File | Contents |
|---|------|----------|
| 1 | `Comp1_GoldGridMorph_V1_1080p.mp4` | Composition 1, Version 1: matches the reference |
| 2 | `Comp1_GoldGridMorph_V2_1080p.mp4` | Composition 1, Version 2: different **camera movement** |
| 3 | `Comp2_GlassCubeRing_V1_1080p.mp4` | Composition 2, Version 1: matches the reference |
| 4 | `Comp2_GlassCubeRing_V2_1080p.mp4` | Composition 2, Version 2: different **colour palette** |
| 5 | `Comp1_GoldGridMorph_4K_Project.zip` | Remotion project with the 4K compositions `GoldGridMorph-V1` and `GoldGridMorph-V2` |
| 5 | `Comp2_GlassCubeRing_4K_Project.zip` | Remotion project with the 4K compositions `GlassCubeRing-V1` and `GlassCubeRing-V2` |

## Technology

Both projects use Remotion 4.0.538 (scaffolded with `npx create-video`) and Three.js 0.186.1 on WebGL 2.

- **Composition 1 (gold studs):**
  - Cube-to-sphere studs drawn as instanced meshes; each frame computes their rounded shape directly (no stored morph targets).
  - The metal reflects a lighting environment generated in code, so the project needs no image files.
  - A custom WebGL 2 shader adds the depth-of-field blur.
- **Composition 2 (glass cubes):**
  - Three.js glass material (`MeshPhysicalMaterial`, with transmission and iridescence).
  - Each cube has an inner wall that only shows its far side, so it reads as thick, hollow glass.
  - The same depth-of-field shader as Composition 1.
  - The backdrop colour is solved through the tone-mapping curve so it lands exactly on the reference's #BF7037.

The compositions are 3840×2160. The 1080p deliverables are rendered from those same compositions with `--scale=0.5`. The WebGL canvas resolution follows the output size, and blur and other sizes are proportional to frame height, so the image is the same at either resolution.

## Technical checks (ffprobe / ffmpeg)

| Check | Gold V1 | Gold V2 | Glass V1 | Glass V2 |
|---|---|---|---|---|
| Codec | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate | 30/1 (constant) | 30/1 | 30/1 | 30/1 |
| Frames (reference) | 360 (360) | 360 (360) | 400 (400) | 400 (400) |
| Duration (reference) | 12.000 s (12.000) | 12.000 s (12.000) | 13.333 s (13.333) | 13.333 s (13.333) |
| Pixel format / colour | yuv420p, BT.709, standard range | same | same | same |
| Decode errors (full decode) | none | none | none | none |
| Black segments (blackdetect) | 0 | 0 | 0 | 0 |
| Frozen frames | 0 | 0 | 0 | 0 |
| Largest frame-to-frame brightness jump (0–255) | 1.0 | 1.0 | 1.5 | 1.7 |
| Audio | none (the references have none) | none | none | none |

All four files **PASS**.

## Project ZIP checks

- **Integrity:** `unzip -t` reports no errors in either archive.
- **Contents:** a clean extract was byte-identical to the source projects. Each ZIP contains:
  - the source code;
  - `package.json` and `package-lock.json`;
  - `remotion.config.ts`, `tsconfig.json` and the ESLint and Prettier settings;
  - a README with the commands.

  There are no external assets: the lighting environments and geometry are generated in code.
- **Install and lint:** `npm ci` installs cleanly in the extracted folders, and `npm run lint` (ESLint and the TypeScript compiler) passes.
- **Compositions:** `npx remotion compositions` lists all four at 3840×2160, 30 fps, 360 or 400 frames.
- **4K render:** `npx remotion still` rendered a 3840×2160 frame of every composition from the extracted copies.
- **1080p render:** the documented command (`npm run render:v1`, equivalent to `remotion render <id> --scale=0.5 --codec=h264`) rendered a 30-frame test clip from each extracted project. Each clip was H.264, 1920×1080, 30 fps, yuv420p.
- **Reproducibility:** each test clip matches the delivered video (PSNR 46.6 dB for gold and 56.6 dB for glass), so the renders are deterministic.

## Visual review by the motion-graphics reviewer agent

A separate reviewer agent compared side-by-side sheets of each version against its reference over five rounds, and then checked the final MP4s.

| Round | Gold V1 | Gold V2 | Glass V1 | Glass V2 |
|---|---|---|---|---|
| 1 | FAIL | FAIL | FAIL | conditional PASS |
| 2 | FAIL | FAIL | FAIL | PASS |
| 3 | PASS | PASS | FAIL | PASS |
| 4 | – | – | PASS | PASS |
| Final MP4s, 1st pass | PASS | PASS | FAIL: jump at loop point | FAIL: jump at loop point |
| Final MP4s after fix | **PASS** | **PASS** | **PASS** | **PASS** |

Main fixes made in response to the review:

- **Gold:**
  - Stud scale and height.
  - Morph timing, front-loaded so the studs round off sooner.
  - Stud tops no longer look like rings partway through the morph.
  - Deeper amber tone with dark grooves.
  - Depth-of-field amount and placement.
  - Version 2 no longer shows past the edge of the sheet.
- **Glass:**
  - Clear, hollow-looking glass instead of an opaque "gift box" look.
  - Orange rims, with the teal/cyan glints moved inside the cubes.
  - Rounder bevels.
  - The ring is mostly edge-on, as a vertical column.
  - Focus on the front cube.
  - Removed the green edge fringes.
  - Fixed a jump at the 200-frame loop point.

Timing and loop checks:

- **Gold V1:** plays forward and then back, like the reference (frame *i* matches frame 360−*i*). The step from the last frame back to the first is as smooth as any other.
- **Glass V1 and V2:** loop every 200 frames, as the reference does. Frame 0 matches frame 200 (47 dB), and the step from frame 199 to 200 matches the neighbouring steps (26.5 vs 26.3–26.6 dB).
- **Background colour:** Glass V1's backdrop measures (191, 112, 55), against (191, 112, 55) in the reference.

### The alternative versions

- **Composition 1, Version 2, camera movement:**
  - **Reference:** a nearly static macro shot with a slight back-and-forth drift.
  - **Version 2:** a continuous slider-and-crane move. It starts low, glides across the sheet while rising and swinging around the stud grid, and the focus follows it.
  - **Why:** the reference's interest comes from the material and the shallow focus. A moving camera shows both off without changing the palette.
  - **Same as Version 1:** material, lighting and morph.
- **Composition 2, Version 2, colour palette:**
  - **Reference:** a flat orange backdrop.
  - **Version 2:** a deep indigo backdrop with violet and magenta glass and cyan interiors, a cool inversion of the warm original.
  - **Why:** a flat backdrop with a tumbling object is defined by its colour, so a palette change is the clearest alternative.
  - **Same as Version 1:** motion, framing and depth of field.

## Known limitations (non-blocking)

- **Gold V1, first and last ~1 s:** the crisp cube tops are brighter and flatter than in the reference.
- **Gold V2, opening frames:** a thin stair-stepped line where sharp cube edges meet the blurred grooves, centre-left of frame.
- **Gold V2 looping:** the crane move goes one way only, so looped playback cuts from the last frame to the first. The reference doesn't need to loop for this version.
- **4K masters:** the most heavily blurred areas show faint ring-shaped artifacts from the blur shader's sampling. They're hard to see in the 1080p deliverables.
- **Watermark:** the iStock watermark in the references was intentionally not reproduced.

## Checksums (SHA-256)

```
b18ce88624b0020e09beef57922298f3de35ff74587c2132b54d91d26445ce18  Comp1_GoldGridMorph_V1_1080p.mp4
9ccd9a3b38d547e72e012be0a8331ff2c821f35c18fa85a69daeaefae1527647  Comp1_GoldGridMorph_V2_1080p.mp4
2f5a6934d32efe9a2c02e7c7c2dae91743266a07ac09be5f5cc54a8f05ba0b12  Comp2_GlassCubeRing_V1_1080p.mp4
c857a40c0bb0b6591395e4e18d059c0ed95282ea6935acbc64b805e3a6c4e47d  Comp2_GlassCubeRing_V2_1080p.mp4
da149b12ee42bcef0694815dbce1d0ef0ae7d2da7671c0846bf7c639ef6f3b3e  Comp1_GoldGridMorph_4K_Project.zip
6c1b8017f001117b4ecf4e696409ee7becf0ee70090393c4a1851ea39dd2e83a  Comp2_GlassCubeRing_4K_Project.zip
```
