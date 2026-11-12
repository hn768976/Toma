# Quality-Control Report: Lattice Drift and Cube Wall

Date: 2026-11-12 (round 4: lighting and depth revision). Both projects were scaffolded with the Remotion CLI (`npx create-video --three`) and built with Three.js through `@remotion/three` (React Three Fiber, WebGL 2). Every composition is authored at **3840x2160, 30 fps**. The delivery files were rendered at 4K and then downscaled to 1080p with a Lanczos filter, so the 1080p files are effectively 4x supersampled.

## Deliverables

| # | File | Composition (4K) | Reference |
|---|------|------------------|-----------|
| 1 | `1_LatticeDrift_V1_Reference_1080p.mp4` | `LatticeDrift-V1-Reference` | Ref 1 (white lattice), closest match |
| 2 | `2_LatticeDrift_V2_CraneOrbit_1080p.mp4` | `LatticeDrift-V2-Crane` | Ref 1, alternative **camera angle and movement** |
| 3 | `3_CubeWall_V1_Reference_1080p.mp4` | `CubeWall-V1-Reference` | Ref 2 (cube wall), closest match |
| 4 | `4_CubeWall_V2_IndigoEmber_1080p.mp4` | `CubeWall-V2-IndigoEmber` | Ref 2, alternative **colour palette** |
| 5 | `lattice-drift_remotion_4K_project.zip`, `cube-wall_remotion_4K_project.zip` | both 4K compositions per project | — |

### Why each alternative was chosen

- **Lattice: camera.** The reference is a flat, near-isometric orthographic drift, so its 3D depth never shows. A perspective crane/orbit move that starts high and descends to a low angle shows the structures in depth while keeping the lattice, floor and palette.
- **Cube wall: palette.** The reference is a front-on, wallpaper-like loop, and the straight-on camera is essential to it. A new palette changes the mood completely while keeping the camera, geometry and motion: deep indigo faces, with the tile side walls glowing ember-coral so every depth step is drawn as a light line.

## Technical checks (all four final MP4s)

The checks used `ffprobe -count_frames` and a full `ffmpeg` decode with `-xerror`, plus these ffmpeg filters:
- `blackdetect` (d=0.03, pic_th=0.90, pix_th=0.08)
- `freezedetect` (n=0.0005, d=0.5)

A numpy script also measured frame-to-frame luma: global jumps, difference spikes, duplicate frames and the loop seam.

| Check | 1 Lattice V1 | 2 Lattice V2 | 3 Cube V1 | 4 Cube V2 |
|---|---|---|---|---|
| Codec / profile / pixel format | H.264 / High / yuv420p | H.264 / High / yuv420p | H.264 / High / yuv420p | H.264 / High / yuv420p |
| Resolution | 1920x1080 | 1920x1080 | 1920x1080 | 1920x1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames / duration | 270 / 9.000 s | 270 / 9.000 s | 420 / 14.000 s | 420 / 14.000 s |
| Reference duration | 9.009 s (270 fr @ 29.97) | 9.009 s | 14.000 s | 14.000 s |
| Full decode errors | none | none | none | none |
| Black frames | 0 | 0 | 0 | 0 |
| Frozen segments | 0 | 0 | 0 | 0 |
| Duplicate frames | 0 | 0 | 0 | 0 |
| Max global luma jump (frame to frame) | 0.27 | 0.28 | 0.21 | 0.09 |
| Flicker / difference spikes | none | none | none | none |
| Loop seam (last→first diff vs median step) | 7.92 vs 7.92: **seamless** | n/a (one-shot move) | 0.72 vs 0.57 (max step 0.78): **seamless** | 0.55 vs 0.43 (max step 0.62): **seamless** |
| Audio | none (reference has none) | none | none | none |

**Duration note.** Reference 1 is 270 frames at 29.97 fps (9.009 s). At exactly 30 fps no whole number of frames gives 9.009 s: 270 frames is 9.000 s and 271 frames is 9.033 s. The composition keeps the reference's frame count (270 frames, 9.000 s), which is 9 ms short. Reference 2 (14.000 s) is matched exactly with 420 frames.

**4K masters.** All four rendered without errors at 3840x2160, 30/1 fps, H.264, with 270 / 270 / 420 / 420 frames.

## Project ZIP checks

- `unzip -t` reports no errors for either archive.
- **Contents:** each ZIP holds the complete source, including:
  - `src/` with the 4K compositions, scene code and procedural generators
  - `package.json` and `package-lock.json`
  - `remotion.config.ts`, `tsconfig.json`, the eslint and prettier configs
  - `README.md` with commands, and `LICENSE.md`
- **No missing assets:** everything (geometry, floor-stripe texture, colours) is procedural and seeded, so there are no external asset files.
- **Clean-room test.** Each archive was extracted into an empty folder, then:
  1. `npm ci`: OK (372 packages).
  2. `npm run lint` (eslint + tsc): OK.
  3. `npx remotion compositions` lists both compositions at 3840x2160, 30 fps, with 270 or 420 frames.
  4. The documented commands `npm run render:v1:4k` and `render:v2:4k` (frames 0–29) produced 3840x2160 H.264 files. `deliver:v1:1080p` and `deliver:v2:1080p` produced 1920x1080 H.264 files.
  5. **Determinism:** the clean-room 4K frames match the delivered masters at PSNR 49.2 / 48.7 / 55.7 / 55.3 dB. That is visually identical; the remaining difference is H.264 re-encoding noise.

## Lighting and depth revision (round 4)

The client's feedback was: "there is no light or depth in both videos". Changes:

- **Lattice:**
  - Warm raking key light with soft VSM shadows.
  - Baked contact shadows (ambient occlusion) under beams, rails and post feet.
  - A height-based occlusion shader that darkens posts toward the floor.
  - Taller posts (1.05).
  - Slightly cooler, brighter floor and a light radial vignette.
  - V2 also gets distance haze/fog for aerial perspective.
- **Cube wall:**
  - A raking key light from the upper left, casting soft shadows across the recessed tiles.
  - A per-tile ambient-occlusion shader that darkens each tile next to taller neighbours, and side walls that darken toward the back.
  - A vignette.

### Measured light/depth (independent reviewer)

Std = luma contrast (spread) within a frame.

| # | Luma contrast (std) new / round 3 / reference | Centre-to-corner falloff new / reference | Verdict: light & depth |
|---|---|---|---|
| 1 Lattice V1 | 54.9 / 42.9 / 43.2 | 1.13 / 1.06 | **PASS**: three distinct tones (tops, sides, floor), soft cast shadows, posts darken at the feet |
| 2 Lattice V2 | 50.5 / 41.4 / — | 1.12 / — | **PASS**: perspective, haze and contact shadows; the strongest depth of the four |
| 3 Cube V1 | 22.5 / 18.5 / 16.5 | 1.16 / 1.10 | **PASS**: shadows from the upper-left light, darkened recesses |
| 4 Cube V2 | not comparable (dark palette) | 1.54 / — | **PASS**: ember side faces, shadows and a central glow give clear depth |

No shadow acne, no shadows detached from objects, and no shadow shimmer (motion-compensated residual 0.7 levels).

## Reference match (independent reviewer agent plus my own measurements)

A separate review agent compared each deliverable with its reference frame by frame, using side-by-sides, zoomed crops, phase correlation and colour statistics. There were four review rounds. Findings from rounds 1 and 2 were fixed and re-rendered; round 4 re-checked everything after the lighting revision.

| # | Final verdict | Key evidence |
|---|---|---|
| 1 Lattice V1 | **PASS (minor notes)** | Drift identical to the reference (−39.8° heading, 4.07% of frame width per second); edge directions 42°/137° match; mean RGB 162/167/166 vs 172/178/177 (slightly darker because of the added shading); seamless loop like the reference; flicker 0.06% |
| 2 Lattice V2 | **PASS** | Clearly different perspective crane/orbit, eased one-shot move; same elements and palette; no moiré or strobing |
| 3 Cube V1 | **PASS (minor notes)** | Locked-off front camera (drift 0.04 px/s); cell size 53 px vs 54 px; cell period identical (55 px at 960 wide); mean RGB 211/221/237 vs 214/220/234; seamless 14 s loop |
| 4 Cube V2 | **PASS** | Same wall, timing and loop as V1 with a completely different palette (indigo 42/42/82 plus ember edges); clean edges, flicker 0.027% |

**Remaining minor differences (none affect technical quality):**
- **Lattice V1:**
  - About 10 levels darker overall than the reference.
  - Floor stripes slightly coarser (31 vs 28 px).
  - The reference's elements are hand-modelled, so its frames are a little more regular than the procedural field.
- **Cube V1:**
  - The lighting is deliberately moodier than the reference: larger, softer cast shadows where the reference has crisp side faces and flatter light.
  - Faint step contours appear in the vignette, visible only under a 6× contrast boost.
- **Cube V2:** the corners are quite dark (by design); shadows are subtle on the indigo faces.

**Issues found and fixed during review:**
- No light or depth (client feedback): key light with soft shadows, ambient occlusion, haze and vignette added to both compositions.
- Lattice element design (random maze → staggered upright "Π" frames).
- Lattice seamless loop (row hash fixed to be periodic).
- Shadows that were too hard and long.
- Pieces clipping through each other (folding pieces replaced by a shrink/grow pulse).
- Lattice V2 temporal aliasing at peak orbit speed.
- Cube-wall seam lines between flush tiles.
- Cube-wall depth and motion too low, shading colour, and hotspot position.
- Z-fighting at bar joints.
