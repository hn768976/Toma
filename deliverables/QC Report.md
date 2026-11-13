# Quality-Control Report — Particle Blob Morph & Data Sphere Network Dive

Date: 2026-11-13 · Remotion 4.0.543 (CLI) · Compositions authored at 3840×2160, 30 fps · Delivered at 1920×1080 (`--scale=0.5` from the 4K composition)

## Deliverables

| # | File | Composition ID (4K) | Frames | Duration (ref) | Size / bitrate |
|---|------|---------------------|--------|----------------|----------------|
| 1 | Version 1 - Particle Blob Morph.mp4 | `V1-Particle-Blob-Morph-Cobalt` | 300 | 10.000 s (10.000 s) | 26.0 MB / 20.8 Mbps |
| 2 | Version 2 - Particle Blob Morph (Ember Palette).mp4 | `V2-Particle-Blob-Morph-Ember` | 300 | 10.000 s (10.000 s) | 30.5 MB / 24.4 Mbps |
| 3 | Version 1 - Data Sphere Network Dive.mp4 | `V1-Data-Sphere-Network-Dive` | 402 | 13.400 s (13.400 s) | 40.3 MB / 24.0 Mbps |
| 4 | Version 2 - Data Sphere Network Dive (Corkscrew Camera).mp4 | `V2-Data-Sphere-Network-Corkscrew` | 402 | 13.400 s (13.400 s) | 45.4 MB / 27.1 Mbps |
| 5 | Particle Blob Morph - 4K Remotion Project.zip | both blob compositions | — | — | 57 KB (20 files) |
| 5 | Data Sphere Network Dive - 4K Remotion Project.zip | both network compositions | — | — | 66 KB (24 files) |

Technology: **Particle Blob Morph** uses Three.js with WebGL 2 / GLSL ES 3.0 shaders (4D simplex deformation field, sphere-impostor beads). **Data Sphere Network Dive** uses Canvas 2D with a custom 3D engine (perspective camera, motion-blur streaks, depth of field, additive light, bloom).

## Technical checks (ffprobe / ffmpeg, all four MP4s)

| Check | Result |
|-------|--------|
| Renders completed | ✅ All 4 rendered successfully; no render errors |
| Codec | ✅ H.264 (High profile), MP4 container |
| Resolution | ✅ 1920×1080 on all 4 |
| Frame rate | ✅ `r_frame_rate` = `avg_frame_rate` = 30/1 on all 4 |
| Duration | ✅ Exact match to references: 300 frames = 10.000 s, 402 frames = 13.400 s (verified by full frame count) |
| Pixel format / colour | ✅ yuv420p, TV range, BT.709 primaries/transfer/matrix (standard playback everywhere) |
| Integrity | ✅ Full decode with `-xerror`: 0 errors, no corrupted frames |
| Audio | ✅ None in references, none in deliverables (no audio issues possible) |
| Black frames (`blackdetect`) | ✅ None in the blob videos. In the network videos the only black is 13.17–13.40 s (0.2 s), which is the reference's own fade-to-black after the flash. |
| Frozen/duplicate frames (`freezedetect`) | ✅ None |
| Flicker / pops (per-frame luma deltas) | ✅ Blob videos: max frame-to-frame luma step < 0.4. Network videos: the only jumps are the intended flash and light fan at 12.8–13.17 s, matching the reference. |
| Brightness vs reference | ✅ Blob V1 mean luma 72 vs ref ≈ 69. Network V1 luma curve within ≈ ±5 of the reference across the clip; flash peak 205 at 12.90 s (ref 211 at 12.92 s). |
| Banding | ✅ Background gradients carry grain/dither (encode at CRF 15–18, x264 slow for the blob). Faint rings visible only under heavy contrast boost (slightly more in blob V2's dark plum). |

## Project ZIP checks (clean-room test from fresh extract)

| Check | Result |
|-------|--------|
| ZIP integrity (`unzip -t`) | ✅ No errors in either archive |
| Contents | ✅ Full `src/` (compositions, shaders, engine, scene), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint/Prettier config, `README.md` with commands. All visuals are procedural, so no external image, font or audio assets are needed. `node_modules`/`out` are excluded. |
| Source matches delivered renders | ✅ Extracted `src/` is byte-identical to the committed source that produced the MP4s |
| Install | ✅ `npm ci` succeeds |
| Lint / type-check | ✅ `npm run lint` (ESLint + `tsc`): 0 errors |
| Compositions present at 4K | ✅ `npx remotion compositions` lists all four at 3840×2160, 30 fps, 300/402 frames |
| Render with documented commands | ✅ `npm run render:v1:4k` / `render:v2:4k` produce 3840×2160 H.264 at 30 fps (frame-range test on all four comps), and `npm run still:4k` produces a 3840×2160 PNG. The 1080p deliverables were produced with `npm run render:v1` / `render:v2` (same commands as documented). |

## Visual verification (independent reviewer agent)

An independent reviewer agent compared each render against its reference at matching timestamps (side-by-side sheets, 100% crops, per-frame luma/difference stats, loop seam). Findings were fixed over several rounds and the renders re-checked.

| Video | Final verdict | Notes |
|-------|---------------|-------|
| Blob V1 (reference match) | **8 / 10** | Framing (centroid 0.50/0.49, height 0.82 vs 0.80), colours, lighting/vignette, wrinkled↔smooth timing and tumble match. The seamless loop seam is clean. Remaining differences: a slightly rounder silhouette, and a horizontal rim band at about 1.0–1.75 s. |
| Blob V2 (alt. colour palette) | **Pass** | Ember/copper beads on a plum sweep. Clearly distinct, with the same concept, motion and quality. |
| Network V1 (reference match) | **8 / 10** | Sphere → burst streaks → icon network → lattice + golden ring → 3×3 chip → white flash → soft fan → black all line up with the reference timing. Remaining differences: the lattice at 10.4–12 s is brighter blue and crisper than the reference's dark defocused columns, and the network motion is slightly slower. |
| Network V2 (alt. camera movement) | **Pass** | Off-axis orbit opening, diagonal swooping burst, helical barrel-roll network, banked lattice approach, spinning final dive. Clearly distinguishable in motion while keeping scene, timing and quality. |

Issues found and fixed during review: a surface tear and crater on the blob, background banding, flat lighting and too little tumble; on the network, over-exposure (≈ +20 luma), burst timing and blow-out, a missing chip core, a harsh flash and banded fan, giant near-lens blobs, a blue-tinted end black, and a hazy rectangle at the sphere crossing. The reference stock watermark was intentionally not reproduced.
