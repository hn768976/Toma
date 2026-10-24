# Quality-control report

**Project:** `ocean-sky-compositions`, a Remotion 4.0.538 project created with `npx create-video --three`.
**Compositions:** all four are 3840×2160 at 30 fps.
**Deliverables:** H.264 MP4 at 1920×1080, rendered from the 4K compositions with `--scale=0.5`.

## Deliverables

| # | File | Composition ID | Concept / version | Technology |
|---|------|----------------|-------------------|------------|
| 1 | `Comp1_Underwater_V1_1080p.mp4` | `Underwater-V1` | Underwater light rays. Matches the reference: clear ocean blue. | WebGL 2 fragment shader |
| 2 | `Comp1_Underwater_V2_1080p.mp4` | `Underwater-V2` | Alternative **colour palette**: emerald lagoon water with warm golden light shafts. | WebGL 2 fragment shader |
| 3 | `Comp2_MoonClouds_V1_1080p.mp4` | `MoonClouds-V1` | Flight over a moonlit cloud deck. Matches the reference: steady forward glide, moon low on the right, a near cloud sweeps across the moon at about 1–2 s. | Three.js with custom GLSL (sky/moon shader, procedural billboard cloud puffs) |
| 4 | `Comp2_MoonClouds_V2_1080p.mp4` | `MoonClouds-V2` | Alternative **camera move**: the camera starts inside the cloud tops, then cranes up into a banking right turn, and the moon swings from the right edge toward the centre. | Three.js with custom GLSL |
| 5 | `ocean-sky-compositions_4K_project.zip` | — | Complete project: source, configuration, lockfile and README. | — |

Everything is generated procedurally, so the project has no external image, video or font assets.

## Duration and frame rate

| Reference | Reference specs | Deliverable frames at 30 fps | Deliverable duration |
|-----------|-----------------|------------------------------|----------------------|
| Underwater (`…886838266…mp4`) | 300 frames at 29.97 fps = 10.010 s | 300 | 10.000 s |
| Moon/clouds (`…1178646134…mp4`) | 200 frames at 25 fps = 8.000 s | 240 | 8.000 s |

10.010 s cannot be reached exactly at 30 fps: it would be 300.3 frames. 300 frames, 10.000 s, is the closest whole-frame match. It has the same frame count as the reference and is 10 ms shorter.

## Technical checks (ffprobe / ffmpeg)

| Check | U-V1 | U-V2 | C-V1 | C-V2 |
|-------|------|------|------|------|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Pixel format | yuv420p | yuv420p | yuv420p | yuv420p |
| Frame rate (r / avg) | 30/1 | 30/1 | 30/1 | 30/1 |
| Frames / duration | 300 / 10.000 s | 300 / 10.000 s | 240 / 8.000 s | 240 / 8.000 s |
| Full decode errors | 0 | 0 | 0 | 0 |
| Black frames (`blackdetect` d=0.04, pix_th=0.1) | none | none | none | none |
| Frozen frames (`freezedetect` n=0.001, d=0.2) | none | none | none | none |
| Largest frame-to-frame mean-luma step | 0.17 | 0.18 | 0.97 | see note |
| Audio | none (references have none) | none | none | none |

**Note on Cloud V2's luma step.** The larger steps happen over a few consecutive frames while the near cloud clears and reveals the bright moon. It is a smooth ramp, not flicker; the independent reviewer confirmed this visually on the earlier render.

## Project ZIP checks

- The ZIP is built with `git archive` from the committed source and passes `unzip -t` with no errors. It contains 26 files:
  - `src/` with all four compositions
  - `package.json` and `package-lock.json`
  - `remotion.config.ts`, `tsconfig.json`, the ESLint and Prettier configs
  - `README.md` with the setup and render commands
- **Clean-room test** in an empty directory: unzip, then `npm ci`.
  - All 372 packages installed with no errors.
  - `remotion compositions` lists all four at **3840×2160, 30 fps** with the correct durations.
  - The documented `npm run render:c1v1` rendered the full 300-frame 1080p H.264 file in 9 min. Its first frame is bit-identical to the delivered `Comp1_Underwater_V1_1080p.mp4`.
  - Each other composition rendered successfully, as a 4K still and as a short 1080p test render.
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

### Composition 2, moon over clouds (4 review rounds on V1, 1 on V2)

**V1, final round.**
- **PASS:**
  - moon position and size (150 px against 148 px at 768 px width)
  - horizon height
  - near-cloud timing and coverage (it enters at about 1.0 s, the moon's upper-left stays visible, and it exits right by about 1.9 s)
  - stars and Milky Way
  - forward speed and parallax
  - smoothness, with no popping
  - all technical checks
- **Close:** overall luma is 55.0 against 59.2, and deck RGB is 54/60/65 against 56/63/67.

**V1, remaining differences flagged by the reviewer and not fully closed.**
- **Sweep cloud:** it is not as strongly backlit as the reference. In the reference it glows near white where it crosses the moon; here it is a darker grey.
- **Sky:** the sky around and above the moon is about 10–13 luma darker than the reference haze.
- **Moon surface:** it reads as softer and more uniformly mottled than the reference's photographic moon.
- **Brightest cloud tops:** about 30 luma below the reference.

**V2.**
- **Distinct camera move: PASS.**
  - The moon travels about 0.34 of the frame width, from x 0.92 to 0.58, while the reference and V1 keep it locked at x≈0.69.
  - It has a different opening (a low skim through a near cloud) and ends on a higher, wider view.
- **Concept and quality: PASS** after two fixes:
  - A billboard-clipping edge at 1.0–1.3 s, where the camera passed through a near cloud, is now removed by fading puffs before the lens.
  - The bank was too subtle and now peaks at 8° of roll.
- **Technical: PASS.**

## Known limitations

- The underwater deliverable is 10.000 s against the reference's 10.010 s. This is the closest possible at 30 fps (see above).
- Rendering uses WebGL in headless Chrome. Without a GPU it falls back to software rendering: about 9–13 min per underwater video and 50–80 min per cloud video on 4 CPU cores. `remotion.config.ts` raises the per-frame timeout to 10 min and sets concurrency to 2 so these renders don't time out.
