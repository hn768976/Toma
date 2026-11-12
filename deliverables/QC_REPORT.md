# Quality-Control Report

## Deliverables

| # | File | Composition | Version |
|---|------|-------------|---------|
| 1 | `1_composition1_molecules_V1_match_1080p.mp4` | Molecule Kaleidoscope (WebGL 2 SDF ray-march) | V1: reference match |
| 2 | `2_composition1_molecules_V2_alt-palette_1080p.mp4` | Molecule Kaleidoscope | V2: alternative colour palette ("midnight neon") |
| 3 | `3_composition2_ribbons_V1_match_1080p.mp4` | String Ribbons (WebGL 2 analytic depth of field + Canvas 2D print) | V1: reference match |
| 4 | `4_composition2_ribbons_V2_alt-camera_1080p.mp4` | String Ribbons | V2: alternative camera (high overhead orbit) |
| 5 | `molecule-kaleidoscope-4k-project.zip` | Remotion project: `Molecules-V1-4K`, `Molecules-V2-4K` at 3840×2160 | |
| 6 | `string-ribbons-4k-project.zip` | Remotion project: `Ribbons-V1-4K`, `Ribbons-V2-4K` at 3840×2160 | |

The compositions are 4K. The 1080p deliverables were rendered from them with `--scale=0.5`; every pixel is drawn natively at the output size, not upscaled. Each project's `README.md` documents the render commands.

## Technical checks

The checks used ffprobe, a full ffmpeg decode, and numpy frame analysis.

| Check | Molecules V1 | Molecules V2 | Ribbons V1 | Ribbons V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Pixel format / colour | yuv420p, BT.709, TV range | same | same | same |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate | 30/1 exactly | 30/1 | 30/1 | 30/1 |
| Frames (render / reference) | 302 / 302 | 302 / 302 | 360 / 360 | 360 / 360 |
| Duration (render / reference) | 10.067 s / 10.077 s | same | 12.000 s / 12.012 s | same |
| Audio | none (reference has none) | none | none | none |
| Decode errors | none | none | none | none |
| Black frames | 0 | 0 | 0 | 0 |
| Flicker / luma pops | none | none | none | none |
| Loop seam (last→first frame vs. average frame step) | 0.20 vs 1.72 | 0.20 vs 2.47 | 22.9 vs 20.8 | 11.8 vs 15.4 |
| Result | PASS | PASS | PASS | PASS |

**Note on duration.** Both references run at 29.97 fps. At exactly 30 fps the renders have the same number of frames as their references. The duration therefore differs by 10–12 ms, less than one frame, which is unavoidable at 30 fps.

**Note on "frozen" frames.** Molecules V1 and V2 each contain 120 static frames. These are deliberate holds between moves; the reference has 116.

## ZIP and project integrity

- **Archive integrity:** `unzip -t` passes for both ZIPs. They are built with `git archive` from the committed sources and contain source, config, `package.json`, `package-lock.json`, `tsconfig.json`, README and lint/format config. No external assets are needed because everything is procedural.
- **Clean-room test:**
  1. Each ZIP was extracted into an empty folder.
  2. `npm ci` and `tsc --noEmit` ran clean.
  3. The documented `npm run render:v1:4k` and `npm run render:v2:4k` scripts (limited to the first frames) produced H.264 3840×2160 30 fps output for all four compositions.
- **4K detail:** 1:1 crops of the 4K output were checked and show real 4K detail, not upscaling.

## Reference-match verification (independent agent)

An independent reviewer agent compared each render with its reference three times. It used side-by-side frame sheets at matching timestamps, crops, and colour and motion statistics. Issues it found were fixed between rounds.

| Render | Round 1 | Round 2 | Final |
|---|---|---|---|
| Molecules V1 (match) | 6 | 6 | **7 / 10** |
| Molecules V2 (alt palette) | 7 | 8 | **8.5 / 10** |
| Ribbons V1 (match) | 4.5 | 5 | **5.5 / 10** |
| Ribbons V2 (alt camera) | 4 | 6.5 | **7.5 / 10** |

### Fixed during review

**Molecules**
- The three-pose, 5 s cycle and its holds now line up with the reference: motion-curve correlation is 0.86.
- The colours were corrected: lime atoms and a pale-dominant third pose. Mean frame colour is 198/211/212 against the reference's 196/208/206.
- The morph necks are thinner and the colour cross-fades are cleaner.

**Ribbons**
- Fixed earlier:
  - exposure;
  - the rounded-square pleats;
  - the grain texture;
  - the V2 loop break;
  - frame-edge clipping.
- The palette was cooled and brightened. Mean colour is 140/167/166 against the reference's 149/172/164.
- Motion is about 15% slower.
- The V2 ground grid now turns under the overhead camera.

### Known remaining differences

**Molecules V1**
- It moves about 35% less than the reference.
- The fusing is slightly less gooey.
- The resting outer molecules are rings rather than S-shapes.

**Ribbons V1**
This is the weakest match. The palette, grid, strand construction, depth of field and 6 s repeat all match, but:
- the reference ribbon is a narrower zig-zag left of centre, where the render's is broader;
- the reference has bursty pacing with near-lens out-of-focus passes;
- the reference background is more mottled.

**Ribbons V2**
- It uses one 12 s orbit rather than a 6 s repeat. This is intentional, so the alternative camera loops seamlessly.

**Both ribbon versions**
- The print grain is overlaid on the ink, so light speckles show on top of shadows. This is a stylistic choice, not a rendering error.

The reviewer found no rendering artefacts: no corruption, flicker, banding, clipping or broken loops.
