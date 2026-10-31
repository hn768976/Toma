# QC Report: Pool Float Compositions

**Date:** 2026-10-31. **Project:** `pool-floats` (Remotion 4.0.539 + Three.js 0.187, custom GLSL 3 / WebGL 2 shaders).

## Deliverables

| # | File | Content |
|---|------|---------|
| 1 | `comp1_striped-float_v1_1080p.mp4` | Composition 1, V1: matches reference 1 (red/white striped float) |
| 2 | `comp1_striped-float_v2_1080p.mp4` | Composition 1, V2: **alternative colour palette** (golden-hour turquoise pool, navy/sunflower stripes) |
| 3 | `comp2_watermelon-float_v1_1080p.mp4` | Composition 2, V1: matches reference 2 (watermelon float) |
| 4 | `comp2_watermelon-float_v2_1080p.mp4` | Composition 2, V2: **alternative camera movement** (crane-down orbit from overhead to a low three-quarter view) |
| 5 | `pool-floats-4k-project.zip` | Complete Remotion project with all four compositions authored at 3840×2160 |
| 6 | `qc/qc_check.py`, `qc/qc_results.json` | Automated QC script and its raw results |

**Why each V2 alternative:**
- **Stripes:** they work in any colour pair, so a palette change keeps the concept.
- **Watermelon:** it is defined by its colours, so V2 keeps the palette and changes the camera instead. The move shows off the 3D float and its refracted floor shadow.

## 1. Technical checks on the delivered videos (all PASS)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Rendered without errors | ✔ | ✔ | ✔ | ✔ |
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames / duration | 300 / 10.000 s | 300 / 10.000 s | 300 / 10.000 s | 300 / 10.000 s |
| Reference duration | 10.000 s ✔ | 10.000 s ✔ | 10.000 s ✔ | 10.000 s ✔ |
| Pixel format / range / matrix | yuv420p / tv / BT.709 | same | same | same |
| Full decode (`ffmpeg -xerror`) | no errors | no errors | no errors | no errors |
| Black frames (`blackdetect`) | none | none | none | none |
| Frozen frames (`freezedetect`) | none | none | none | none |
| Flicker: max frame-to-frame mean-luma jump | 0.29 | 0.32 | 0.22 | 0.20 |
| Size | 17.1 MB | 20.7 MB | 14.3 MB | 16.0 MB |

**Audio:** neither reference has an audio track, so none of the outputs has one either (0 audio streams). There were no audio checks to run.

**Reference durations:** both references are 240 frames at 24 fps, exactly 10.000 s. The outputs are 300 frames at 30 fps, also exactly 10.000 s.

**Frame-to-frame motion:** the mean absolute difference between frames stays in a narrow band for every file (for example 3.95–4.72 for C1 V1). That means steady animation, with no dropped, duplicated or popping frames.

**Colour range:** an early render pass came out as full-range `yuvj420p`. I fixed this by rendering PNG frames with BT.709 colour space, so the final files are standard limited-range `yuv420p` and display correctly in browsers, QuickTime and editing software.

## 2. Project ZIP checks (all PASS)

- **Archive integrity:** `unzip -t` reports no errors.
- **Contents (19 entries):**
  - `src/` with all composition source: `Root.tsx`, `pool/config.ts`, `pool/motion.ts`, `pool/shaders.ts`, `pool/PoolScene.tsx`
  - `package.json` and `package-lock.json`
  - `remotion.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`
  - `render-all.sh` and `README.md` (with the commands)
  - `node_modules` and build output are deliberately excluded and are restored by `npm ci`.
- **Assets:** none required. Everything is procedural (shaders and geometry), so there are no external assets that could go missing.
- **Clean-room test:** I extracted the ZIP to a new folder and ran `npm ci`. Dependencies installed and the extracted source is byte-identical to the repository. `npx remotion compositions` lists all four compositions at **3840×2160, 30 fps, 300 frames (10.00 s)**.
- **Full 4K renders from the extracted project**, using the documented `npx remotion render <id> out/<file>.mp4`:
  - `Comp1-StripedFloat-V1`: 3840×2160, H.264 High, 30 fps, 300 frames, 10.000 s, decodes cleanly.
  - `Comp2-WatermelonFloat-V2`: 3840×2160, H.264 High, 30 fps, 300 frames, 10.000 s, decodes cleanly.
  - `Comp1-StripedFloat-V2` and `Comp2-WatermelonFloat-V1`: 4K stills (3840×2160) rendered successfully.
- **Linting:** `tsc` and `eslint` pass with 0 errors and 0 warnings.

## 3. Independent visual verification (review agent)

A separate review agent compared each render with its reference over three rounds. It used side-by-side frames at matching timestamps plus measurements: float bounding box and axis ratio, shadow position, extent and colour, bob/drift/roll timelines, water colour statistics, and how quickly the water pattern changes over time. Each round's findings were fixed and the videos re-rendered.

| Video | Round 1 | Round 2 | Final |
|---|---|---|---|
| C1 V1 (stripes vs ref 1) | 6.5/10 | 7.5/10 | **8/10** |
| C2 V1 (watermelon vs ref 2) | 6/10 | 7/10 | **7.5/10** |
| C1 V2 | distinct, good | distinct, good | **clearly distinct (palette), good quality** |
| C2 V2 | distinct, good | distinct, good | **clearly distinct (camera move), good quality** |

**Confirmed matching in the final round:**
- Float position and size.
- Drift and bob timelines.
- Roll timing (level until 5 s, then the float rocks left-side-down).
- Water speed and colour.
- Stripe count (about 22).
- Floor shadow position, size, cyan colour and visible hole.
- Watermelon inner crescent and soft highlights.

**Artifacts:** none found in any round. No flicker, black frames, banding, seams, aliasing or popping.

**Remaining minor differences** (the reviewer judged none of them delivery blockers):
- Caustic cells grow slightly towards the bottom of the frame because of perspective; the reference's cells are uniform.
- The striped float reads about 10% taller than in the reference.
- The roll amplitude is a little smaller than the reference's.
- The watermelon flesh is slightly more coral and the striped float's red slightly darker than in the references.
- The references' faint stock watermark was intentionally not reproduced.

## 4. Consistency checks

- **Timing, colour and animation:** every frame is a pure function of the frame number, so renders are deterministic and repeatable.
- **Lighting and water:** all four videos share one camera, light and water rig, so lighting and water behaviour are the same across versions.
- **V2 changes:** each V2 changes only its chosen dimension. C1 V2 changes the palette on the same camera and motion. C2 V2 changes the camera on the same palette and motion.

**Result: all requested checks passed.**
