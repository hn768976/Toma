# Quality-control report

Two motion-graphics compositions built with the Remotion CLI. Each composition has two versions. Every composition is authored at 4K (3840×2160) and the deliverables are rendered from it at 1080p.

## Deliverables

| # | File | What it is |
|---|------|-----------|
| 1 | `Version-1_Particle-Tunnel-Collision_Reference-Match_1080p.mp4` | Composition 1, Version 1: matches the reference |
| 2 | `Version-2_Particle-Tunnel-Collision_Ember-Palette_1080p.mp4` | Composition 1, Version 2: alternative colour palette (ember) |
| 3 | `Version-1_Voxel-Brain-Assembly_Reference-Match_1080p.mp4` | Composition 2, Version 1: matches the reference |
| 4 | `Version-2_Voxel-Brain-Assembly_Orbit-Camera_1080p.mp4` | Composition 2, Version 2: alternative camera angle and movement (orbit) |
| 5a | `Project_Particle-Tunnel-Collision_4K-Remotion.zip` | Remotion project holding both 4K tunnel compositions |
| 5b | `Project_Voxel-Brain-Assembly_4K-Remotion.zip` | Remotion project holding both 4K voxel-brain compositions |
| 6 | `QC-Report.md` | This report |

## Technology choices

| Composition | Reference | Technology | Why |
|---|---|---|---|
| Particle Tunnel Collision | A tunnel of beaded light strings that bend, curl and tangle into each other | Canvas 2D: manual 3D perspective, seeded simplex noise, quarter-resolution bloom | Thousands of thin anti-aliased strokes and dots with arbitrary widths. Canvas 2D draws these crisply at 4K and needs no GPU. |
| Voxel Brain Assembly | A 3D studio scene: a tiled floor, glowing circuit tubes, and glass cubes that fly in to form a voxel brain | Three.js (WebGL 2): instanced meshes, shadow maps, and a custom post-processing chain (depth of field, bloom, dither) | A real 3D scene with lighting, perspective, depth of field and about 1,000 animated cubes. |

**Alternative versions (Version 2).** I chose the alternative for each composition based on what suited the reference best.
- **Tunnel: colour palette.** The reference is an abstract, centred, symmetrical tunnel. A different camera angle would only distort it. A palette change (cyan → amber, red-orange and crimson on warm black) keeps the geometry, timing and motion and gives it a clearly different mood.
- **Voxel brain: camera angle and movement.** The reference is a 3D scene shot from a low, near-static frontal camera. An elevated three-quarter camera that orbits about 76° while descending reveals the brain's volume, which a palette swap would not.

## Technical checks

<!-- BRAIN-TECH-TABLE -->

The "frozen pairs" column counts consecutive frames that are near-identical. These are expected in two places: where V2's orbit eases in and out at its ends, and in the static stretch at the start of the brain V1 shot.

**Duration.** The tunnel reference is 300 frames (10.000 s). The brain reference is 301 frames (10.033 s); its frame 0 is a black stock-agency slate. Every deliverable has exactly the same frame count and duration as its reference. The slate is not reproduced, because it is not part of the shot and would be an unintended black frame.

### How each check was done
- **Container and stream.** `ffprobe` with `-count_frames` gives codec, profile, resolution, frame rate, decoded frame count, duration, pixel format, colour tags and audio streams.
- **Integrity.** A full decode with `ffmpeg -xerror -f null`; any decode error fails the check.
- **Frame scan.** All frames decoded to 480×270 and checked for black or blank frames, frozen frames (consecutive frames near-identical), sudden luma jumps, and global flicker (one frame out of line with both neighbours).
- **Localised flicker.** Each frame is split into 10×10 blocks, and each block is checked for brightness that alternates up and down from frame to frame. This catches z-fighting and unstable shading that the whole-frame scan misses. It caught a real pool z-fighting defect in an earlier brain render, which was fixed and re-rendered (see the history below).
- **Audio.** Neither reference has audio, so no deliverable carries an audio stream (checked: 0 audio streams).

## Project ZIP checks

Each ZIP was extracted into an empty folder. I then ran only the commands documented in its README:

| Step | Tunnel project | Voxel brain project |
|---|---|---|
| `unzip -t` integrity | No errors | <!-- B-ZIP-T --> |
| Contents | `src/` (Root plus all composition code), `public/`, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint and Prettier config, `README.md`. No `node_modules` and no build output. | The same layout, plus `LICENSE.md` from the Remotion Three.js starter |
| `npm ci` | 338 packages installed, no errors | <!-- B-ZIP-CI --> |
| `npm run lint` (ESLint and `tsc`) | Pass | <!-- B-ZIP-LINT --> |
| `npm run render:v1:4k` | 3840×2160, 300 frames, 10.000 s; full decode OK | <!-- B-ZIP-4K --> |
| `npm run render:v2:4k` | 3840×2160, 300 frames, 10.000 s; full decode OK | <!-- B-ZIP-V2 --> |
| 1080p render from the ZIP compared with the delivered file | `render:v1:1080p`: the last 5 frames have identical frame checksums (framemd5) to the delivered V1 | <!-- B-ZIP-CMP --> |

No assets are missing. Neither project loads external assets at render time: all textures are generated procedurally in code and there are no font or network dependencies. In sandboxed environments the Playwright headless shell is used only if it exists, and otherwise Remotion uses its own browser.

## Visual verification by an independent reviewer agent

A separate reviewer agent compared each deliverable with its reference, frame by frame. Its tools were matched-timestamp side-by-sides, brightness and colour curves, region colour sampling, motion measurement and defect crops. Each round's findings went back into the compositions.

**Particle Tunnel Collision, Version 1**

| Review round | Score | What it found and what changed |
|---|---|---|
| 1 | 5/10 | Lines and beads too thin, deformation too late and too uniform, no vignette, hard central hole, fly-through too slow, wrong colour tagging. All fixed. |
| 2 | 7/10 | Brightness rose too early, strands did not braid early enough, too little motion within each frame. Fixed. |
| 3 | 8/10 | Clean and deliverable. Small refinements followed: a later and steeper brightness ramp, livelier early motion, braiding from about 1 s, strands crossing the core late. |

- **Measured against the reference after the final round.** Mean luminance is within 1–5 levels at 0, 3.5, 5, 7, 9 and 10 s. Hue is within about 5°.
- **Not done.** Defocused near-camera strands in the last 2 seconds were the reviewer's lowest-priority item and were not added.

**Particle Tunnel Collision, Version 2.** Pass. A genuine ember palette, clearly distinguishable, with the same concept, timing and quality as V1.

**Voxel Brain Assembly**

<!-- BRAIN-REVIEW -->

## Fixes made during QC
- **Colour encoding.** The first renders were full-range BT.601 (`yuvj420p`). Both projects now encode BT.709 limited range (`yuv420p`), the standard for HD and UHD delivery.
- **Tunnel blend-mode bug.** A blend-mode leak disabled the core and vignette layers. It was caught by measurement and fixed.
- **Brain cast shadows.** Hard, blotchy cast shadows from the cube swarm were removed; the reference shows none.
- **Brain pool flicker.** Two pool water planes overlapped at the same depth and z-fought. The localised flicker check found it. Fixed by trimming the planes and giving each pool its own depth, and both versions were re-rendered.
- **Brain static stretches.** V1 had near-static stretches. A subtle handheld float, measured from the reference's own camera wobble, now runs through the shot.
