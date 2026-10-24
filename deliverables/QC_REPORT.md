# Tube Bloom — Quality-Control Report

## Deliverables

| # | File | Content |
|---|------|---------|
| 1 | `Composition1_Ember_V1_1080p.mp4` | Composition 1, Version 1: matches reference 1 (orange hooked tubes, dark vortex core, clockwise inward flow) |
| 2 | `Composition1_Ember_V2_1080p.mp4` | Composition 1, Version 2: **camera-movement** alternative (wide open, push-in with an arc around the vortex) |
| 3 | `Composition2_Pearl_V1_1080p.mp4` | Composition 2, Version 1: matches reference 2 (pearl hooks with violet tips, lavender-grey studio, rolling close-up) |
| 4 | `Composition2_Pearl_V2_1080p.mp4` | Composition 2, Version 2: **colour-palette** alternative (cream-pearl, coral tips, sage-mint backdrop) |
| 5 | `TubeBloom_4K_Remotion_Project.zip` | Remotion project holding all four 3840×2160 compositions, source, config and README |

Technology: Remotion 4.0.538 + Three.js (WebGL 2), with custom GLSL depth-of-field post-processing. All geometry and materials are procedural, so there are no external assets. The references have no audio, and neither do the outputs.

## Technical checks (ffprobe / ffmpeg decode of every frame)

| File | Codec | Pix fmt | Size | FPS | Frames | Duration | Ref. duration | Audio | Decode errors | Black segments | Frozen frames | Max frame step / median |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ember V1 | H.264 High | yuv420p | 1920×1080 | 30/1 | 305 | 10.1667 s | 10.1667 s | none | none | 0 | 0 | 1.40 / 0.97 |
| Ember V2 | H.264 High | yuv420p | 1920×1080 | 30/1 | 305 | 10.1667 s | 10.1667 s | none | none | 0 | 0 | 2.55 / 0.95 |
| Pearl V1 | H.264 High | yuv420p | 1920×1080 | 30/1 | 305 | 10.1667 s | 10.1667 s | none | none | 0 | 0 | 2.74 / 2.62 |
| Pearl V2 | H.264 High | yuv420p | 1920×1080 | 30/1 | 305 | 10.1667 s | 10.1667 s | none | none | 0 | 0 | 2.33 / 2.25 |

What the motion columns mean:
- **Frame step** is the mean absolute change between neighbouring frames. Max and median stay close in every file, so there are no pops or snaps.
- Ember V2's step rises smoothly as the camera pushes in; that is expected.
- The largest change in mean brightness between consecutive frames is 0.2–1.0 out of 255, so there is no flicker.
- The V1 versions loop seamlessly, as the references do.

## Project ZIP checks

- `unzip -t` reports no errors. The archive holds the 4K compositions (`src/Root.tsx`, `src/tube-bloom/*`), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, the ESLint/Prettier config and the README. `node_modules` and renders are excluded.
- **Clean-extract test**, run in a fresh directory:
  - `npm ci` succeeds.
  - `npm run lint` (ESLint + tsc) is clean.
  - `npx remotion compositions` lists Ember-V1, Ember-V2, Pearl-V1 and Pearl-V2, each 3840×2160, 30 fps, 305 frames.
  - A 4K render of each composition (frames 0–5) succeeds: H.264, 3840×2160, 30 fps.
- The documented commands are in the README: `npm run render:1080` for the deliverables and `npm run render:4k` for full 4K.

## Visual review (independent motion-graphics agent)

A separate reviewer compared each render frame by frame against its reference: stacked frames, pixel colour sampling, block-matching motion flow, loop and pop analysis, and edge sharpness. Each fix was re-reviewed until it passed.

| Version | Review rounds | Final verdict | Notes |
|---|---|---|---|
| Ember V1 | 9 | **PASS** | Composition, hooked-tube design, palette (body ≈ (200,32,1) vs ref. (232,49,2); shadows ≈ ref.), clockwise inward motion ≈ 11°/s (ref. 10–16°/s) and seamless loop all match. Fixes made along the way: loop pop, ring-entry flash (gamma-corrected alpha fade), blue tint, framing. |
| Ember V2 | 3 | **PASS** | Clearly distinct camera move: bloom grows from about 34% to 62% of frame width with an arc. Same concept and quality. A focus snap was fixed. |
| Pearl V1 | 11 | **PASS** | Close-up hook ball against the right edge, with the left 42% plain backdrop (bg (187,193,210) vs ref. (189,194,211)). Hooks curl up and out with caps facing left; violet ≈ ref.; on-screen speed ≈ ref.; shallow depth of field. |
| Pearl V2 | 2 | **PASS** | Unmistakable palette alternative with identical geometry and motion. Shaft clipping was reduced from 8.3% to 1.1% at the reviewer's recommendation. |

The reviewer also checked every final file for banding, aliasing, corrupted frames and flicker. None were found.

## Known, accepted deviations

- **Pearl V1 repeat period:** the ball turns 4 tube spacings per loop, so the picture repeats every 38 frames against the reference's 30.4. This keeps the on-screen speed matched to the reference with these larger hooks, and the reviewer agreed with the trade-off.
- **Ember V1 outer-ring sharpness:** the outer ring is somewhat softer than the reference's. The reviewer rated this non-blocking.

## Checksums (SHA-256)

```
b22fba218022688708cc2d5b47314716167b2c251b8d6aa0bd214733f898b762  Composition1_Ember_V1_1080p.mp4
ad662dd66c288adb43877e2a473f9f57a52e6a40054e9cbc257014a77c80bbda  Composition1_Ember_V2_1080p.mp4
73cdcd2c50cef325b016b75e5469a4e51f004f039fc099e8119ee645707a91ef  Composition2_Pearl_V1_1080p.mp4
cda6886630bf6aff6a2f31da6a2fdbd2b612be0173f3b11eb153f587eaf135be  Composition2_Pearl_V2_1080p.mp4
ef13a6991f30520802bc170d633a144fea2c4b534ffa39a525633ec7c146d238  TubeBloom_4K_Remotion_Project.zip
```
