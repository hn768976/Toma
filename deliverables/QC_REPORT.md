# Quality-Control Report — Glass Blob & Stage Lights (Remotion, 4K masters)

## Deliverables

| # | File | Content |
|---|------|---------|
| 1 | `Composition1_GlassBlob_V1.mp4` | Comp 1, Version 1: matches the reference (iridescent glass blob) |
| 2 | `Composition1_GlassBlob_V2.mp4` | Comp 1, Version 2: **alternative colour palette** (dichroic gold/rose film, amber glass, plum backdrop) |
| 3 | `Composition2_StageLights_V1.mp4` | Comp 2, Version 1: matches the reference (8 × 4 stage-light wall, locked-off) |
| 4 | `Composition2_StageLights_V2.mp4` | Comp 2, Version 2: **alternative camera angle/movement** (oblique orbit 22° → −22°, dolly-in, tilt-up) |
| 5a | `Composition1_GlassBlob_4K_Project.zip` | Remotion project with both 4K compositions (`GlassBlob-V1`, `GlassBlob-V2`) |
| 5b | `Composition2_StageLights_4K_Project.zip` | Remotion project with both 4K compositions (`StageLights-V1`, `StageLights-V2`) |

Technology choices: Comp 1 uses **Three.js (WebGL 2) + custom GLSL**, with a vertex-displaced sphere plus refraction, Fresnel and thin-film shading. A real 3D glass surface needs this. Comp 2 uses a **full-screen WebGL 2 fragment shader**, because many additive light sources are cheapest and cleanest in a single pass. Neither project needs any external assets. Neither reference has audio, so none of the outputs do either.

## 1. Final MP4 checks (ffprobe, every frame decoded)

| File | Codec | Res. | FPS | Frames | Duration | Reference | Decode errors |
|------|-------|------|-----|--------|----------|-----------|---------------|
| Comp1 V1 | H.264 High, yuv420p | 1920×1080 | 30/1 | 300 | 10.000 s | 10.000 s (250 f @ 25) | none |
| Comp1 V2 | H.264 High, yuv420p | 1920×1080 | 30/1 | 300 | 10.000 s | 10.000 s | none |
| Comp2 V1 | H.264 High, yuv420p | 1920×1080 | 30/1 | 602 | 20.067 s | 20.053 s (601 f @ 29.97) | none |
| Comp2 V2 | H.264 High, yuv420p | 1920×1080 | 30/1 | 602 | 20.067 s | 20.053 s | none |

Comp 2 reference is 20.053 s at 29.97 fps. At exactly 30 fps no whole number of frames reaches 20.053 s (601.6 frames). 602 frames is the nearest possible length, 13 ms longer, which is less than half a frame. Comp 1 matches exactly.

## 2. Frame-level defect scan (all frames)

| File | Black frames | Frozen frames | Frame-diff spikes (flicker/corruption) | Luma min–max |
|------|-----|-----|-----|-----|
| Comp1 V1 | 0 | 0 | 0 | 23.7–28.2 |
| Comp1 V2 | 0 | 0 | 0 | 28.4–33.5 |
| Comp2 V1 | 0 | 0 | 0 | 28.0–92.5 (intended flashing) |
| Comp2 V2 | 0 | 0 | 0 | 27.8–100.3 (intended flashing) |

- **Comp 1 loop:** the reference loops seamlessly, and so does the recreation. The difference from the last frame to the first is 1.84, below a normal frame step of 2.22, so there is no pop at the loop point.
- **Comp 2 flashing compared with the reference** (brightness sampled at the 32 lamp centres):

  | Measure | Reference | Version 1 |
  |---------|-----------|-----------|
  | Lamps on | 30.3 % of the time | 30.1 % |
  | Lit lamps per frame | 9.7 | 9.6 |
  | Lamps snapping on or off in one frame (> 150 levels) | 0 | 0 |

## 3. Project ZIP checks

- Both archives pass `unzip -t` with no errors.
- **Contents:** each archive holds the full `src/` (compositions, shaders, palettes or light schedule), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, the ESLint/Prettier configuration and a `README.md` with the commands. `node_modules` and render output are left out. No external assets are needed.
- **Fresh-extract test:** each archive was extracted into an empty directory, then:
  - `npm ci` installed cleanly with 0 vulnerabilities;
  - `tsc` and `eslint` reported no errors;
  - `remotion compositions` listed both compositions at **3840×2160**, 30 fps.
- **Native 4K render:** from the extracted projects, `npx remotion render <id> … --codec=h264` produced H.264 at **3840×2160**, 30 fps, for all four compositions (30-frame test ranges).
- **Source match:** the source in each ZIP is byte-identical to the source that rendered the delivered MP4s (`diff -r`).
- The 1080p deliverables come from the same 4K compositions with `--scale=0.5`. The WebGL buffer follows the render scale, so they are drawn natively at 1080p rather than downsampled.

## 4. Independent agent review against the references, and what changed

A separate reviewer agent compared each composition with its reference frame by frame and numerically. The first review found real gaps, all of which were fixed before the final renders:

**Composition 1**
- Fixed: too many thin ripples, so the sheets are now fewer, thicker and overhanging.
- Fixed: milky, low-contrast colour, so the body is now dark blue glass with wide, saturated spectral bands.
- Fixed: motion about 3× slower than the reference, so it now makes 2 tumbles and a stronger deformation.
- Fixed: a pop at the loop point, so every animated term now cycles a whole number of times.

**Composition 2**
- Fixed: a hard seam on every lamp housing, caused by angular noise wrapping at ±π. The noise is now periodic around the circle.
- Fixed: off lamps were too bright, so their spill and rim brightness are reduced.
- Fixed: 44 lamps snapping on in a single frame, so the attack is now a soft 5–7 frame ramp with a gamma curve, and there are 0 snaps.
- Fixed: flashes were too sparse (22 % on), now 30 %.
- Fixed: lit faces were cyan where the reference is white, and the shadows are now deep navy.
- Fixed: beams were thin and combed, now wider and softer.

## 5. Version 2 distinctiveness

**Composition 1 V2** keeps the same geometry, motion and timing, but uses a clearly different palette: warm gold, rose and amber thin-film over amber glass on a deep plum backdrop, instead of rainbow over clear blue glass on black.

**Composition 2 V2** keeps the same lights and flash timing on a wider 16 × 8 wall. It is filmed with a moving oblique camera: it sweeps from 22° to −22° yaw, dollies in from 1.15 to 0.85 and tilts from −8° to +6°. The motion is eased and smooth, and no wall edges come into frame.

## Known limitations (stated, not hidden)

- The recreations are procedural, so they match the references in concept, framing, timing and look, but not frame by frame.
- **Comp 1:** the reference's glass still has slightly crisper, higher-contrast white highlights.
- **Comp 2:** lamps are rendered as stylised rings rather than photographed par cans. In V2 the beams lie in the wall plane, so they read slightly flat at the most oblique angles.
