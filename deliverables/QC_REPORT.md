# Quality-Control Report

Two Remotion projects, each with two 4K (3840×2160) compositions. The four
deliverable MP4s are rendered from those 4K compositions with `--scale=0.5`
(1920×1080).

## Deliverables

| # | File | Composition | Version | Technology |
|---|------|-------------|---------|------------|
| 1 | `Composition1_V1_LightStreams_1080p.mp4` | `LightStreams-V1` | V1 – matches the reference | Three.js (WebGL 2), custom GLSL |
| 2 | `Composition1_V2_LightStreams_AltCamera_1080p.mp4` | `LightStreams-V2` | V2 – alternative camera movement | Three.js (WebGL 2), custom GLSL |
| 3 | `Composition2_V1_SilkWaves_1080p.mp4` | `SilkWaves-V1` | V1 – matches the reference | WebGL 2 fragment shader |
| 4 | `Composition2_V2_SilkWaves_ChampagneGold_1080p.mp4` | `SilkWaves-V2` | V2 – alternative colour palette | WebGL 2 fragment shader |
| 5 | `Composition1_LightStreams_4K_Remotion.zip` | Project with both 4K compositions | | |
| 5 | `Composition2_SilkWaves_4K_Remotion.zip` | Project with both 4K compositions | | |
| – | `Composition1_preview.png`, `Composition2_preview.png` | Reference / V1 / V2 frame comparison | | |

### Choice of the Version 2 alternative

* **Composition 1 (Light Streams): camera movement.** The reference is a 3D scene, so a new camera shows it in a different way while keeping the concept and colours.
  * Shot A is a low, banked truck shot moving right-to-left along the foot of the wall.
  * Shot B is an overhead crane that orbits about 120° around the hairpin fold while it descends.
* **Composition 2 (Silk Waves): colour palette (champagne gold on warm black).** The reference is a flat, camera-less abstract, so a camera move would change little, while a palette change transforms its mood.

## Technical checks (ffprobe / ffmpeg on the delivered files)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High @ L4.0 | H.264 High @ L4.0 | H.264 High @ L4.0 | H.264 High @ L4.0 |
| Pixel format / colour | yuv420p, BT.709, TV range | same | same | same |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames (decoded count) | 241 | 241 | 300 | 300 |
| Duration | 8.033 s | 8.033 s | 10.000 s | 10.000 s |
| Reference duration | 8.040 s | 8.040 s | 10.000 s | 10.000 s |
| Full decode errors | none | none | none | none |
| Black frames (blackdetect) | none | none | none | none |
| Audio | none (reference has none) | none | none | none |
| Luma range (min–max frame mean) | 85.5–94.5 | 78.8–110.3 | 41.9–42.6 | 52.6–54.1 |
| Luma jumps > 3 between frames (excluding the intended cut) | none | none | none | none |
| Intended hard cut | frame 120 = 4.000 s (the reference also cuts at 4.000 s) | frame 120 | n/a | n/a |
| Loop seam (last frame → first frame) | n/a | n/a | seamless (≈1.2× a normal frame step) | seamless (≈1.1×) |

**Duration note (Composition 1).** The reference is 8.04 s (201 frames at 25 fps). At 30 fps, 8.04 s would be 241.2 frames, which cannot be encoded. 241 whole frames (8.033 s) is the closest possible length: 6.7 ms short, less than a quarter of one frame. Composition 2 matches its reference exactly (300 frames, 10.000 s).

## Project ZIP checks

| Check | Composition 1 ZIP | Composition 2 ZIP |
|---|---|---|
| CRC integrity (`unzip -t`, Python `zipfile.testzip`) | OK | OK |
| Contents | `README.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `remotion.config.ts`, ESLint/Prettier config, `.gitignore`, `src/` (all source), `public/` | same |
| External assets needed | none (fully procedural; no fonts, textures or audio) | none |
| Clean extract → `npm ci` | OK | OK |
| `npm run lint` (ESLint + `tsc`) | OK, 0 errors | OK, 0 errors |
| `npx remotion compositions` | `LightStreams-V1` and `-V2`: 3840×2160, 30 fps, 241 frames | `SilkWaves-V1` and `-V2`: 3840×2160, 30 fps, 300 frames |
| Documented render command (`npm run render:v2`, frame range) | OK: H.264, 1920×1080, 30 fps | OK: H.264, 1920×1080, 30 fps |
| Determinism (still from the extracted ZIP vs the original project) | bit-identical (same MD5) | bit-identical (same MD5) |

## Visual QA (independent review agents)

Separate reviewer agents compared each output with its reference over several rounds. They used side-by-side frames, 1080p crops, colour statistics, motion measurement, cut detection and flicker/banding analysis. Their findings drove three rounds of fixes; final-round results:

| Output | Final reviewer score | Verdict |
|---|---|---|
| C1 V1 – shot A (rising wall of light lines) | 6/10 | Deliverable: close stylistic match |
| C1 V1 – shot B (folded hairpin sheet) | 6.5/10 (up from 4.5) | Deliverable: close stylistic match |
| C1 V2 – alternative camera | 7/10 | Deliverable: clearly different camera, same look and quality |
| C2 V1 – silk strands | 7/10 (up from 5) | Deliverable: faithful in palette, motion and mood |
| C2 V2 – champagne gold | 8/10 | Deliverable: clearly distinct palette, same quality |

Defects checked in the final round for all four outputs:

* Flicker: none.
* Black frames: none.
* Popping: none.
* Stray streaks or line tearing: none.
* Polygonal curves: none.
* Aliasing: none.
* Missing assets: none.
* Rendering errors: none.
* Watermark: the iStock watermark in the references is not reproduced.

Banding was mitigated with dithering. Faint one-code-value steps in the dark sky gradient show only under a 6× brightness boost.

### Known residual differences

The reviewers judged V1 versions as close stylistic matches, not frame-exact replicas, and listed these remaining differences:

* **C1 V1**
  * Lines are slightly softer and denser than the reference's crisp single lines.
  * The shot A camera is a little further back.
  * In shot B, the hairpin interior shows a dark slot and the far sheet is brighter and softer than the reference's upright wall.
* **C2 V1**
  * The strand layout is a more symmetric "eye" than the reference's diagonal S-folds.
  * The lower area is slightly brighter.
  * There are fewer specular hot-spots.
  * One steep crossing strand appears at the upper right.
  * Overall the image is slightly more saturated blue.
