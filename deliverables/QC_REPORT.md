# Quality-Control Report — 4K Remotion Compositions

**Project:** `3d-scenes-4k` (Remotion 4, created with `npx create-video --three`)
**Technology:** Three.js / WebGL 2 with custom GLSL post-processing (bokeh depth of field, bloom, ACES tone mapping, grade)
**Date:** 2026-10-24

## Deliverables

| # | File | Content | SHA-256 |
|---|------|---------|---------|
| 1 | `Composition1_BarrelField_V1_1080p.mp4` | Oil-drum field, matches the reference | `a87c4ab0…45203` |
| 2 | `Composition1_BarrelField_V2_1080p.mp4` | Alternative: **camera angle and movement** (high-angle rising, arcing crane) | `1c7e1cec…fbc3` |
| 3 | `Composition2_VoxelCube_V1_1080p.mp4` | Voxel cube, matches the reference | `0363b5e7…2d95272f` |
| 4 | `Composition2_VoxelCube_V2_1080p.mp4` | Alternative: **colour palette** (copper, orange and magenta on plum) | `3a28b8a0…25be81d` |
| 5 | `3d-scenes-4k_project.zip` | Full project with all four 3840×2160 compositions | `e8cb3a5a…e184` |

**Why each alternative was chosen:** The barrel shot's identity is its warm sepia mood. A palette change would lose that, so V2 changes the camera instead: a high crane conveys the scale of the stockpile. The voxel shot's identity is its colour and light, so V2 swaps the cool neon palette for a warm molten one and keeps the geometry, animation and camera.

## 1. Technical checks on the final MP4s (ffprobe / ffmpeg)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 | Requirement |
|---|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High | H.264 ✅ |
| Pixel format | yuv420p | yuv420p | yuv420p | yuv420p | Plays everywhere ✅ |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 | 1080p ✅ |
| Frame rate (r / avg) | 30/1 | 30/1 | 30/1 | 30/1 | Exactly 30 fps ✅ |
| Decoded frame count | 240 | 240 | 240 | 240 | — |
| Duration | 8.000 s | 8.000 s | 8.000 s | 8.000 s | = reference (8.000 s each) ✅ |
| Full decode (`ffmpeg -f null`) | no errors | no errors | no errors | no errors | No corrupted frames ✅ |
| Black frames (`blackdetect`) | 0 | 0 | 0 | 0 | ✅ |
| Frozen frames (`freezedetect`) | 0 | 0 | 0 | 0 | ✅ |
| Mean luma range (0–255) | 73–89 | 69–84 | 89–119 | 79–113 | Consistent exposure ✅ |
| Max frame-to-frame luma step | 0.41 | 0.19 | 1.85 | 2.08 | < 4 (no flicker) ✅ |
| Audio | none | none | none | none | References have no audio either ✅ |

Both reference clips are 768×432 at 25 fps, 200 frames, 8.000 s. The outputs are 30 fps with 240 frames, so durations match exactly.

## 2. Project ZIP checks

| Check | Result |
|---|---|
| Archive integrity (`unzip -t`) | No errors ✅ |
| Contents | `src/` (all source), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`, `README.md`, `LICENSE.md`. No external assets are needed: environment maps and geometry are generated procedurally. ✅ |
| Clean extract → `npm ci` | Succeeds ✅ |
| `tsc --noEmit` and `eslint src` | Pass ✅ |
| `npx remotion compositions` | `BarrelField-V1/V2` and `VoxelCube-V1/V2`, each **3840×2160, 30 fps, 240 frames (8.00 s)** ✅ |
| Full-resolution 4K still of every composition from the extracted ZIP | All 4 render at 3840×2160 ✅ |
| Documented command `npm run render:voxel-v2 -- --frames=0-5` | Produces 1920×1080, 30 fps H.264 ✅ |
| Reproducibility: frame 100 rendered from the ZIP vs. frame 100 of each delivered MP4 | Mean absolute difference 1.46–1.60 / 255 (encoding noise only) for all four ✅ |

## 3. Independent reviewer-agent verification

Each final video was checked by a fresh, independent reviewer agent against its reference clip. The agent built frame-by-frame contact sheets, inspected full-resolution crops, measured luma and motion, and looked at the frame pairs with the largest change. Earlier versions that failed review were fixed and re-rendered before delivery.

| Video | Review rounds | Final verdict | Final scores |
|---|---|---|---|
| C1 V1 (match reference) | 3 | **PASS, 7/10** | Content 6, camera 7, grade 7 (mean RGB 85/74/56 vs ref 83/72/55), DOF 8, smoothness 8, artifacts 6 |
| C1 V2 (camera alternative) | 2 | **PASS** | Distinguishable 9, concept kept 7, smoothness and artifacts 8 |
| C2 V1 (match reference) | 4 | **Borderline PASS, 6/10** | Content 6, camera 6, colour 5, DOF 7, smoothness 8, artifacts 9 |
| C2 V2 (palette alternative) | 1 | **PASS** | Distinguishable 9, concept and quality 9, smoothness and artifacts 9 |

Earlier failures were all fixed before delivery: wrong camera height and framing, a horizon hotspot, matte plastic blocks, blocks popping between colours, an under-exposed V2 crane shot, and banding inside the depth-of-field blur.

### Known remaining differences (stated plainly)

- **C2 V1, voxel cube:** the reference blocks look like true transmissive glass. The render uses glossy, clear-coated blocks lit by an inner light box that glows through the seams between them. Real refraction and transmission across ~7,300 blocks at 4K was not practical on this machine's CPU-only renderer (SwiftShader). The reviewer also noted a slightly different block-size mix and framing. This is the weakest of the four, but it is recognisably the same shot.
- **C1 V1, barrel field:** slightly harder contrast than the reference. Bungs are simplified (flat discs rather than threaded caps), and there is faint shimmer on rim highlights.
- **C1 V2:** the lid sheen is softer than V1 in the steepest overhead frames.
- **C2 V2:** the glow is cream-gold rather than deep gold, and some dark-red blocks merge into the plum background where it is blurred.

## 4. Visual quality checks (all four videos)

- **Corrupted frames / missing assets:** none. All frames decode, and no external assets are needed.
- **Unintended black frames / flicker:** none (see table in section 1).
- **Popping:** none. Glow and colour changes fade over 10 or more frames.
- **Edge of world / missing geometry:** none seen in any frame.
- **Transitions:** each piece is one continuous shot, as in the references, so there are no cuts to check.
- **Audio:** not applicable. There is no audio stream, matching the references.

## 5. Notes

- **Render time:** on this CPU-only machine a 4K frame takes about 15–20 s, so each 8-second video took 40–95 minutes. A machine with a GPU will be much faster.
- **Rendering at 1080p:** the delivered MP4s were rendered from the 4K compositions with `--scale=0.5`, so every frame is a downsampled 4K image. 4K masters can be rendered with `npm run render:*:4k`.
- **`npm audit`:** reports 10 high-severity advisories, all in `zod@4.5.4`. That version is pinned by Remotion's own packages (`@remotion/cli`/studio), not used by the composition code, and only used at development time. It was left as is, because forcing an upgrade could break the pinned Remotion toolchain.
