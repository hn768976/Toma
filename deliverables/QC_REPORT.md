# Quality-Control Report

**Deliverables**

| # | File | What it is |
|---|---|---|
| 1 | `Version-1_Particle-Collision-Network_1080p.mp4` | Composition 1, V1: matches the reference |
| 2 | `Version-2_Particle-Collision-Network_Aurora-Palette_1080p.mp4` | Composition 1, V2: alternative **colour palette** ("Aurora": teal abyss, mint plexus, magenta/violet orbs) |
| 3 | `Version-1_Access-Denied-Login_1080p.mp4` | Composition 2, V1: matches the reference |
| 4 | `Version-2_Access-Denied-Login_Low-Angle-Orbit-Camera_1080p.mp4` | Composition 2, V2: alternative **camera angle and movement** (mirrored low angle, arcing dolly, rack focus that follows the active element) |
| 5a | `Particle-Collision-Network_Remotion-4K-Project.zip` | Remotion project, both 4K compositions (3840×2160) |
| 5b | `Access-Denied-Login_Remotion-4K-Project.zip` | Remotion project, both 4K compositions (3840×2160), bundled fonts |

**How the videos were made**
- Both projects were scaffolded with the Remotion CLI (`npx create-video --blank`).
- They are rendered with **Canvas 2D** plus a custom 3D projection and depth-of-field engine.
- Every composition is authored in 4K at 30 fps.
- Each 1080p deliverable is the 4K composition rendered with `--scale=0.5`, so every frame is drawn at 3840×2160 and downsampled (supersampled anti-aliasing).
- Encoding is H.264 High, yuv420p, BT.709 limited range, CRF 16.

**Why V2 differs the way it does**
- *Particle Collision:* the motion is abstract, so the strongest change that keeps the concept is a new colour world.
- *Access Denied:* the piece is about a perspective UI panel, so a mirrored low-angle orbit with rack focus changes the shot clearly while keeping the story.

## 1. Technical checks (measured with ffprobe/ffmpeg against the reference clips)

| File | Codec | Resolution | FPS | Frames (render / ref) | Duration (render / ref) | Decode errors | Size | Result |
|---|---|---|---|---|---|---|---|---|
| Version-1_Particle-Collision-Network_1080p.mp4 | H264 (High), yuv420p, BT.709 | 1920×1080 | 30/1 (avg 30/1) | 799 / 799 | 26.633 s / 26.633 s | none | 56.53 MB | PASS |
| Version-2_Particle-Collision-Network_Aurora-Palette_1080p.mp4 | H264 (High), yuv420p, BT.709 | 1920×1080 | 30/1 (avg 30/1) | 799 / 799 | 26.633 s / 26.633 s | none | 63.48 MB | PASS |
| Version-1_Access-Denied-Login_1080p.mp4 | H264 (High), yuv420p, BT.709 | 1920×1080 | 30/1 (avg 30/1) | 622 / 622 | 20.733 s / 20.733 s | none | 11.92 MB | PASS |
| Version-2_Access-Denied-Login_Low-Angle-Orbit-Camera_1080p.mp4 | H264 (High), yuv420p, BT.709 | 1920×1080 | 30/1 (avg 30/1) | 622 / 622 | 20.733 s / 20.733 s | none | 12.05 MB | PASS |

| File | Mean luma (render / ref) | Max frame-to-frame luma jump (render / ref) | Black segments | Audio |
|---|---|---|---|---|
| Version-1_Particle-Collision-Network_1080p.mp4 | 56.3 / 55.7 | 6.17 / 8.08 | none (ref: none) | none (ref: none) |
| Version-2_Particle-Collision-Network_Aurora-Palette_1080p.mp4 | 62.0 / 55.7 | 5.42 / 8.08 | none (ref: none) | none (ref: none) |
| Version-1_Access-Denied-Login_1080p.mp4 | 30.3 / 29.2 | 2.97 / 3.21 | 0–0.5 s (ref: 0–0.466667 s) | none (ref: none) |
| Version-2_Access-Denied-Login_Low-Angle-Orbit-Camera_1080p.mp4 | 29.2 / 29.2 | 3.01 / 3.21 | 0–0.5 s (ref: 0–0.466667 s) | none (ref: none) |

| File | Frozen segments (≥0.5 s) | Pixels at peak white, mean / max (reference A: 0.14 % / 1.17 %) | MD5 |
|---|---|---|---|
| Version-1_Particle-Collision-Network | 0 | 0.62 % / 2.40 % (max is the intended finale flare) | 4c452e89e3f36f148b9f0f721a494154 |
| Version-2_Particle-Collision-Network_Aurora-Palette | 0 | 0.58 % / 2.26 % | 3acc5235242e8a7a0a407094a813e313 |
| Version-1_Access-Denied-Login | 0 | 0.15 % / 1.11 % | 1e00abaebd6d8fedba1c0eb47581a49a |
| Version-2_Access-Denied-Login_Low-Angle-Orbit-Camera | 0 | 0.11 % / 1.09 % | 6df2f7d2663d6004ed3d285fb299ae15 |

- **Codec, resolution and frame rate:** all four are H.264, 1920×1080, and exactly 30/1 fps for both the nominal and average rate.
- **Duration:** frame counts and durations equal the references exactly (799 frames / 26.633 s and 622 frames / 20.733 s).
- **Integrity:** a full decode of every file gave zero errors and no corrupted frames.
- **Black frames:** none unintended. The only black is the 0–0.5 s opening of Access Denied, which reproduces the reference's 0–0.47 s black open.
- **Flicker and popping:** the largest frame-to-frame luma jump in every render is below the reference's own (table above). There are no frozen stretches.
- **Audio:** the references have no audio track, so the deliverables have none either. Audio checks don't apply.
- **Loop:** Particle Collision dissolves back to its opening shot like the reference. The last→first frame PSNR is 42.9 dB (V1) and 42.1 dB (V2), the same as the PSNR between two adjacent frames, so the seam is invisible.
- **Banding:** dark gradients are dithered with film grain, and the grain is applied after the opening fade.

## 2. Project ZIP checks
- `unzip -t` reports no errors for either ZIP.
- **Contents:** each ZIP holds:
  - `src/`, with both 4K compositions and the shared engine
  - `public/` (bundled Rajdhani and Share Tech Mono fonts with their OFL licences)
  - `package.json` with documented render scripts, and `package-lock.json`
  - `remotion.config.ts`, `tsconfig.json` and the ESLint config
  - a `README.md` with commands
- `node_modules` and `out` are excluded. No assets need downloading at render time.
- **Clean-room test.** Each ZIP was extracted into an empty directory and the following were run:
  - `npm ci`: OK (338 packages)
  - `npm run lint` (ESLint + tsc): 0 errors
  - `npx remotion compositions`: both compositions report 3840×2160, 30 fps, 799 / 622 frames
  - `npm run still:v1:4k` and `still:v2:4k`: 3840×2160 PNGs
  - `npm run render:v1:4k -- --frames=240-299`: H.264, 3840×2160, 30 fps, 60 frames
  - `npm run render:v2:1080p -- --frames=0-29`: H.264, 1920×1080, 30 fps
- **Determinism:** frames from the fresh install match the delivered videos at a PSNR of 52.5–58.5 dB, which is visually identical (differences are encoder-level only).

## 3. Independent visual review (separate agent, two passes)
A separate review agent compared each render with its reference frame by frame: side-by-side sheets every 1 s, tiles around key events, luma, clipping and frame-difference curves, and the loop seam.

**First pass.** It scored the V1s 6/10. It flagged:
- a blown-out finale
- the wrong opening composition in A
- a too-gentle camera and depth of field in B
- a too-bright red phase
- a blob-like fingerprint
- scrambled text instead of the reference's fades and blinks
- a border/"A" clash in B-V2

All of these were fixed.

**Second pass.** Every fix was confirmed and nothing regressed. Scores rose to **A-V1 7/10** and **B-V1 7.5/10**. For the V2s, A-V2 scored 7 for distinctness and 7 for quality, and B-V2 scored 7.5 for both.

Key-event timing in B now matches the reference within about ±0.2 s:
- box opens at 0.5 s; Login fades in at 0.62 s
- fingerprint scan from 2.4 s; print docks at 3.4 s
- first password dot at 4.1 s
- box collapses at 7.33–7.67 s
- red text fades in at 7.83–8.33 s
- whole-word blinks at 13.67 / 15.0 / 16.67 / 18.0 / 19.67 s

**Final pass.** After the second review, three more items were fixed and checked against the reference:
- B's docked fingerprint is now a bright thumb-shaped oval (it was a dim notched disc).
- B-V1's box now runs off the left edge in the red phase, as in the reference.
- A's finale core was softened: peak white went from 3.45 % to 2.40 %.

**Known, accepted differences from the references:**
- The A strands are procedurally generated and somewhat sparser than the stock clip's meshes.
- A's finale is still brighter at its peak than the reference (2.4 % against 1.2 % of pixels at peak white, for about 0.3 s).
- B's red network is a little sparser than the reference.
- The stock "iStock" watermark is deliberately not reproduced.
