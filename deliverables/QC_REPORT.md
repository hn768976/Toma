# Quality-Control Report

Date: 2026-10-23

## Deliverables

| # | File | Content |
|---|------|---------|
| 1 | `Comp1_LightWaves_V1_1080p.mp4` | Composition 1, Version 1: matches the reference (electric-blue light arcs, wide-angle fly-through) |
| 2 | `Comp1_LightWaves_V2_1080p.mp4` | Composition 1, Version 2: alternative **"ember" magenta/amber color palette**, same scene and camera |
| 3 | `Comp2_ServerRacks_V1_1080p.mp4` | Composition 2, Version 1: matches the reference (oblique rack close-up, slow crane-down) |
| 4 | `Comp2_ServerRacks_V2_1080p.mp4` | Composition 2, Version 2: alternative **camera angle and movement**, a low-angle lateral tracking shot along the rack row |
| 5 | `Comp1_LightWaves_Remotion_4K_Project.zip`, `Comp2_ServerRacks_Remotion_4K_Project.zip` | Remotion projects with the 3840×2160 compositions, source code, configuration and lockfiles |

The projects were scaffolded with the Remotion CLI (`npx create-video`).
- **Composition 1** uses Canvas 2D: a custom 3D projection, depth-of-field layers and bloom.
- **Composition 2** uses Three.js (r178): instanced PBR geometry, an image-based environment, and `BokehPass` plus `UnrealBloomPass`.
- No external assets are needed, because every texture is generated procedurally.
- The stock watermark from the references is not reproduced.

**Why the versions differ the way they do:**
- **Composition 1** is a graphic, color-driven abstract piece, so Version 2 changes the palette and keeps the camera.
- **Composition 2** is a photoreal set where the camera move is the main storytelling device, so Version 2 changes the camera angle and movement and keeps the look.

## Technical checks (ffprobe / ffmpeg, full decode of every file)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Pixel format | yuv420p | yuv420p | yuv420p | yuv420p |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Decoded frames | 601 | 601 | 360 | 360 |
| Duration | 20.033 s | 20.033 s | 12.000 s | 12.000 s |
| Reference duration | 20.020 s | 20.020 s | 12.000 s | 12.000 s |
| Decode errors | none | none | none | none |
| Black frames (blackdetect) | none | none | none | none |
| Frozen segments (freezedetect) | none | none | none | none |
| Mean luma (min–max) | 53.0–59.2 | 54.1–60.5 | 57.7–62.1 | 56.3–67.8 |
| Largest frame-to-frame luma jump | 0.33 | 0.33 | 0.31 | 0.52 |
| Audio | none (references have none) | none | none | none |

**Duration note (Composition 1):** the reference is 600 frames at 29.97 fps, which is 20.020 s.
- At exactly 30 fps no whole number of frames equals 20.020 s.
- 601 frames (20.033 s, +13 ms) is the closest match, so the composition uses 601 frames.
- 600 frames would give 20.000 s, which is 20 ms short.

Composition 2 matches its reference exactly: 300 frames at 25 fps = 360 frames at 30 fps = 12.000 s.

## Project ZIP checks

Each ZIP was checked as follows:
1. Integrity tested with `unzip -t`.
2. Extracted into an empty directory.
3. Dependencies installed with `npm ci`.
4. Type-checked with `tsc`.
5. Compositions listed with `npx remotion compositions`.
6. Rendered with the documented commands, as below.

| Check | Comp 1 | Comp 2 |
|---|---|---|
| Integrity (`unzip -t`) | OK | OK |
| `npm ci` | OK | OK |
| `tsc --noEmit` | OK | OK |
| Compositions listed | `LightWaves-V1/V2`, 3840×2160, 30 fps, 601 frames | `ServerRacks-V1/V2`, 3840×2160, 30 fps, 360 frames |
| Native 4K render test | H.264 3840×2160 30 fps | H.264 3840×2160 30 fps |
| 1080p render test (`--scale=0.5`) | H.264 1920×1080 30 fps, V1 and V2 | H.264 1920×1080 30 fps, V1 and V2 |

**ZIP contents:**
- `src/`
- `package.json` and `package-lock.json`
- `remotion.config.ts`
- `tsconfig.json`
- ESLint and Prettier configs
- `README.md` with the commands
- an empty `public/` folder

`node_modules` and render output are excluded, and are restored or produced by the documented commands.

**Commands** (see each project's README):
- `npm i`
- `npm run dev`
- `npm run render:v1`
- `npm run render:v2` (1080p deliverables)
- `npm run render:v1:4k` and `npm run render:v2:4k` (native 4K masters)

**Note on 4K rendering:** on machines without a GPU, the Three.js project renders 4K in software at about 30–60 s per frame. Its config raises Remotion's frame timeout to allow for this.

## Visual review (independent verification agent)

An independent agent compared each render with its reference using:
- side-by-side frames at matched timestamps
- frame-step sequences
- slit-scan motion analysis
- luma statistics

Issues it found were fixed and re-reviewed:

**Composition 1:**
- V1 was rebuilt from a long-lens side view into the reference's wide-angle forward fly-through. That rebuild added the in-frame vanishing point, the near defocused arcs and continuous glowing arcs, and fixed brightness and arc density. The score went from 4/10 to 6/10. Brightness, hero arcs and arc density were then adjusted further.
- V2 is clearly distinguishable from V1 through its palette and keeps the concept and quality.

**Composition 2:**
- **V1 camera move:** corrected to the reference's downward crane, about 1.4 frame heights, which slit-scan analysis confirms.
- **V1 drive trays:** restyled with dark bodies, small silver handles and per-tray teal latch tabs.
- **V1 neighbouring rack:** quieter and more defocused.
- **V1 exposure:** matched to the reference.
- **V1 score:** went from 4/10 to 7/10.
- **V2 exposure:** reduced from mean luma ~97 to ~62 after the reviewer flagged a washed-out look.
- **V2 distractions:** a glowing door-handle bar was removed from the start of the shot.

**Artifacts (all four videos):**
- no flicker
- no black or corrupt frames
- no banding
- no camera jitter
- no shimmer on fine detail at 1080p
- LED states are held for at least 6 frames, so there is no popping

**Consistency:** colors, timing and animation are consistent throughout every clip. None of the clips has transitions or cuts, and neither do the references.
