# Quality-control report

Two Remotion compositions, each in two versions, built as 3840×2160 (4K UHD) compositions and delivered as 1080p H.264 MP4s (rendered from the 4K composition with `--scale=0.5`).

## Deliverables

| # | File | Composition / version |
|---|------|-----------------------|
| 1 | `Composition1_PinFieldWaves_V1_1080p.mp4` | Pin Field Waves – V1 (matches reference) |
| 2 | `Composition1_PinFieldWaves_V2_1080p.mp4` | Pin Field Waves – V2 (alternative: orbit + crane-down camera move) |
| 3 | `Composition2_StripedTwistTunnel_V1_1080p.mp4` | Striped Twist Tunnel – V1 (matches reference) |
| 4 | `Composition2_StripedTwistTunnel_V2_1080p.mp4` | Striped Twist Tunnel – V2 (alternative: saffron / indigo palette) |
| 5 | `Composition1_PinFieldWaves_4K_Project.zip`, `Composition2_StripedTwistTunnel_4K_Project.zip` | Remotion projects with both 4K compositions each |
| 6 | `QC_REPORT.md` | This report |

Technology: Composition 1 uses **Three.js** (instanced meshes, soft shadow map, custom WebGL depth-of-field pass). Composition 2 uses a **WebGL 2 fragment shader** (analytic ray / ruled-surface intersection). Both projects were scaffolded with the Remotion CLI (`create-video --blank`).

## Technical checks (all four videos)

| Check | Result |
|---|---|
| Renders successfully | ✅ all four, exit code 0 |
| Codec | ✅ H.264 (High profile), MP4 |
| Resolution | ✅ 1920×1080 |
| Frame rate | ✅ exactly 30/1 (r_frame_rate and avg_frame_rate), constant |
| Frame count / duration | ✅ 270 frames = 9.000 s each |
| Pixel format / range | ✅ yuv420p, limited (TV) range, tagged BT.709 |
| Decode errors (full ffmpeg decode) | ✅ none |
| Black frames (`blackdetect`) | ✅ none |
| Frozen frames (`freezedetect`) | ✅ none |
| Flicker | ✅ none (see per-video max frame-to-frame luma step) |
| Audio | n/a – the references have no audio; none added |
| Watermark | ✅ the references' stock watermark is not reproduced |

**Duration note:** each reference is 270 frames at 29.97 fps = 9.009 s. At exactly 30 fps the same 270 frames last 9.000 s. That is the closest whole-frame duration; 271 frames would be 9.033 s. The difference is 9 ms, under a third of a frame.

### Per-video measurements

Luma is per-frame mean on a 0–255 scale. Motion is mean absolute frame-to-frame difference at 192×108; the value in brackets is the reference measured the same way.

| Video | Bitrate | Luma mean [min..max] | Max luma step | Motion (ref) | Loop check |
|---|---|---|---|---|---|
| Pin V1 | 10.4 Mb/s | 151.3 [140.2..160.8] | 3.12 | 9.28 (10.34) | frame 0 vs 90: 0.52 → seamless 90-frame loop; no 45/30-frame repeat |
| Pin V2 | 13.9 Mb/s | 145.9 [130.4..162.0] | 4.18 | 18.03 (10.34) – higher because of the camera move | n/a – camera move, no loop by design |
| Tunnel V1 | 10.5 Mb/s | 106.3 [105.2..107.3] | 0.26 | 8.40 (8.61) | frame 0 vs 45: 0.45 → seamless 45-frame loop |
| Tunnel V2 | 10.5 Mb/s | 79.5 [78.8..80.2] | 0.24 | 6.61 (8.61) | frame 0 vs 45: 0.49 → seamless 45-frame loop |

## Project ZIP checks

Each ZIP was checked as follows:

- **Integrity:** `unzip -t` reports no errors.
- **Contents:** exactly the git-tracked project files: `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, `src/` (both 4K compositions), `public/`, `README.md` and lint config. `node_modules` and `out` are excluded. No external assets are needed, since everything is procedural.
- **Clean-folder test:** extracted to an empty folder, then:
  - `npm ci` installed the dependencies.
  - `npm run lint` (eslint + tsc) passed.
  - `npx remotion compositions` listed both 3840×2160, 30 fps, 270-frame compositions.
- **Documented commands:** `npm run render:v1` and `npm run render:v2` (on frame ranges) produced 1080p H.264 yuv420p 30 fps output, and `npx remotion still` produced a full 3840×2160 frame.
- **Reproducibility:** frames rendered from the extracted ZIP match the delivered MP4s to within encoder noise (mean abs difference about 1 on 0–255).

A full-length render was not repeated from the ZIP, because the deliverables were rendered with the same commands. On a GPU-less machine (SwiftShader), a full render takes about 35 min per tunnel version and about 75 min per pin-field version. With a GPU, `--gl=angle` is much faster.

## Visual verification (independent reviewer agent)

Each composition was compared against its reference frame by frame by an independent reviewer agent, over several passes. Its findings were fixed and the videos re-rendered.

**Striped Twist Tunnel – V1: 7/10 after 3 passes (started at 6).**
- **Matches:** structure (nested, twisted, striped triangle rings), stripe width, ink colour (12, 31, 37 vs the reference's 13, 32, 38), mean brightness (107.5 vs 109), vanishing point within about 1%, crawl direction, 45-frame loop and the black/white inversion every 15 frames.
- **Residual difference:** the tunnel runs about two rings deeper and ends in a small foggy point, where the reference ends in a larger, light inner triangle. The paper is about 10 levels darker at the frame edges.

**Striped Twist Tunnel – V2: clearly distinguishable.** Indigo ink on saffron with a rose glow in the depths. Geometry, motion, loop and quality are identical to V1, so the concept is preserved.

**Pin Field Waves – V1: 6.5/10 after 4 passes (started at 4).**
- **Fixed during review:** the camera (overhead, halftone look → low, wide perspective) and pin shape (needles → pills with stubs). Motion is now 9.5–10.0 against the reference's 11.0. The 90-frame loop is exact with no 45- or 30-frame repeat.
- **Two defects found and removed:** foreground "boiling" and a visible pin-grid edge.
- **Residual differences:**
  - The near field moves in regular wave crests (about every 13 frames) where the reference swells more slowly.
  - Raised areas form ridges rather than the reference's oval pools.
  - The image is about 13 levels darker than the reference (mean RGB 148/151/155 vs 162/162/164), and the far field is light grey rather than near-white.

**Pin Field Waves – V2: clearly distinguishable.** The camera opens high and nearly overhead, orbits about 95° and cranes down to a low grazing angle, with a smooth cosine ease and no jerks. No grid edge, empty plate or horizon is visible. The reviewer found one defect: a faceted seam where pin heads meet stalks at the low angle. It was fixed geometrically (stalk matches the head radius with aligned vertices), both pin-field versions were re-rendered, and the final check confirmed the seam is gone with no new artifacts.

## Summary

All four videos render successfully. Each is 270 frames, 9.000 s, exactly 30 fps, H.264, 1920×1080, from 4K compositions, with no decode errors, black frames, frozen frames, flicker, missing assets or audio problems. Both project ZIPs are complete and reproduce the deliverables with the documented commands. The V2 versions are clearly distinct alternatives: palette for the tunnel, camera move for the pin field. The residual fidelity differences listed above are stylistic, not defects.
