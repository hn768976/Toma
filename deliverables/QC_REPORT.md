# Quality-control report

**Project:** `ocean-sky-compositions`, a Remotion 4.0.538 project created with `npx create-video --three`.
**Compositions:** all four are 3840×2160 at 30 fps.
**Deliverables:** H.264 MP4 at 1920×1080, rendered from the 4K compositions with `--scale=0.5`.

## Deliverables

| # | File | Composition ID | Concept / version | Technology |
|---|------|----------------|-------------------|------------|
| 1 | `Comp1_Underwater_V1_1080p.mp4` | `Underwater-V1` | Underwater light rays. Matches the reference: clear ocean blue. | WebGL 2 fragment shader |
| 2 | `Comp1_Underwater_V2_1080p.mp4` | `Underwater-V2` | Alternative **colour palette**: emerald lagoon water with warm golden light shafts. | WebGL 2 fragment shader |
| 3 | `Comp2_MoonSky_V1_1080p.mp4` | `MoonSky-V1` | Full moon in a starry night sky, in the reference's framing: a near-locked view with the moon low on the right. **Clouds removed on request.** | Three.js with a custom GLSL sky/moon shader |
| 4 | `Comp2_MoonSky_V2_1080p.mp4` | `MoonSky-V2` | Alternative **camera move**: a banking turn to the right while tilting down. The moon swings from the right edge toward the centre and the horizon rolls up to 8°. | Three.js with a custom GLSL sky/moon shader |
| 5 | `ocean-sky-compositions_4K_project.zip` | — | Complete project: source, configuration, lockfile and README. | — |

Everything is generated procedurally, so the project has no external image, video or font assets.

## Duration and frame rate

| Reference | Reference specs | Deliverable frames at 30 fps | Deliverable duration |
|-----------|-----------------|------------------------------|----------------------|
| Underwater (`…886838266…mp4`) | 300 frames at 29.97 fps = 10.010 s | 300 | 10.000 s |
| Moon sky (`…1178646134…mp4`) | 200 frames at 25 fps = 8.000 s | 240 | 8.000 s |

10.010 s cannot be reached exactly at 30 fps: it would be 300.3 frames. 300 frames, 10.000 s, is the closest whole-frame match. It has the same frame count as the reference and is 10 ms shorter.

## Technical checks (ffprobe / ffmpeg)

| Check | U-V1 | U-V2 | S-V1 | S-V2 |
|-------|------|------|------|------|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Pixel format | yuv420p | yuv420p | yuv420p | yuv420p |
| Frame rate (r / avg) | 30/1 | 30/1 | 30/1 | 30/1 |
| Frames / duration | 300 / 10.000 s | 300 / 10.000 s | 240 / 8.000 s | 240 / 8.000 s |
| Full decode errors | 0 | 0 | 0 | 0 |
| Black frames (`blackdetect` d=0.04, pix_th=0.1) | none | none | none | none |
| Frozen frames (`freezedetect` n=0.001, d=0.2) | none | none | none | none |
| Largest frame-to-frame mean-luma step | 0.17 | 0.18 | 0.12 | 0.14 |
| Audio | none (references have none) | none | none | none |

## Project ZIP checks

- The ZIP is built with `git archive` from the committed source and passes `unzip -t` with no errors. It contains 24 files:
  - `src/` with all four compositions
  - `package.json` and `package-lock.json`
  - `remotion.config.ts`, `tsconfig.json`, the ESLint and Prettier configs
  - `README.md` with the setup and render commands
- **Clean-room test** in an empty directory: unzip, then `npm ci`.
  - All 372 packages installed with no errors.
  - `remotion compositions` lists all four at **3840×2160, 30 fps** with the correct durations.
  - The documented `npm run render:c1v1` rendered the full 300-frame 1080p H.264 file in 9 min. Its first frame is bit-identical to the delivered `Comp1_Underwater_V1_1080p.mp4`.
  - Each other composition rendered successfully, as a 4K still and as a short 1080p test render.
- **Final ZIP re-verified** after the clouds were removed:
  - The extracted source is identical to the repository.
  - `npm ci` and `npm run lint` are clean.
  - All four compositions are listed at 3840×2160.
  - A 4K still of `MoonSky-V1` renders at 3840×2160.
  - The documented `npm run render:c2v1` produces 1920×1080 H.264.
  - Frame 0 rendered from the extracted project is bit-identical to frame 0 rendered from the repository. The encoded test clip matches the delivered file at 46.5 dB PSNR; the remaining difference is only the encoder's rate control on a shorter clip.
- `npm run lint` (ESLint and `tsc`) is clean.

## Independent agent verification

A separate reviewer agent compared each render with its reference. It used side-by-side frames at matching timestamps, numeric colour samples, per-region luma, frame-difference motion metrics, and full-resolution crop inspection. I fixed issues between rounds.

### Composition 1, underwater (2 review rounds)

- **Round 1 found:**
  - rays too thin and crisp
  - surface blown out
  - motion about 40% of the reference
  - floor haze and the dark area misplaced
  - the reference durations were swapped in my setup; this was caught and fixed
- **Round 2 result:** technical PASS, overall colour PASS (mean RGB 41/149/206 against the reference's 38/149/204), layout PASS, banding fixed.
  - Remaining items were ray tint and spread, the dark right side, the bottom-right corner, surface thickness and motion levels. These were addressed in a final pass.
  - After that pass, colour samples at five reference points are within about 20 levels of the reference.
- **V2 palette:** PASS. It is clearly distinct (mean RGB 68/156/139 against V1's 41/149/206) with the same concept and quality.

### Composition 2, moon and night sky

**History.** The reference flies over a cloud deck under the moon. My cloud versions went through four review rounds on V1 and one on V2. Layout, timing, motion and technical checks passed, but the procedural clouds still looked artificial. **At the client's request the clouds were removed.** Both versions now show only the sky: moon with glow, Milky Way, three star layers and a horizon haze.

**What is kept from the reference** (measured in the review rounds):
- Moon position: centre at about x 0.71, y 0.44 of the frame.
- Moon size: about 0.195 of frame width.
- The cool, desaturated night palette.
- Stars and Milky Way detail.
- The near-locked framing of V1.

**Moon surface.** It was reworked for this version:
- maria with soft edges, concentrated on the upper part of the disc as on the real Moon
- fine highland grain
- scattered bright fresh craters
- a bright crater with rays in the south
- a darker right limb

**V2 vs V1.** Moon centre over the 8 s:
- V1 stays locked near x≈0.69.
- V2 sweeps from the right edge toward the centre and rises in frame, while the camera banks up to 8° of roll.
- So V2 is clearly a different camera move with the same concept and palette.

**Technical:** both pass, as in the table above. The largest luma step is 0.12 for V1 and 0.14 for V2, with no flicker.

## Known limitations

- The underwater deliverable is 10.000 s against the reference's 10.010 s. This is the closest possible at 30 fps (see above).
- Rendering uses WebGL in headless Chrome. Without a GPU it falls back to software rendering: about 9–13 min per underwater video and about 8 min per sky video on 4 CPU cores. `remotion.config.ts` raises the per-frame timeout to 10 min and sets concurrency to 2 so these renders don't time out.
