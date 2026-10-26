# Tube Bloom — Quality-Control Report

## Deliverables

| # | File | Content |
|---|------|---------|
| 1 | `Composition1_Ember_V1_1080p.mp4` | Composition 1, Version 1: matches reference 1 (a crown of thick, glossy orange curled tubes around a defocused charcoal well, turning clockwise and writhing) |
| 2 | `Composition1_Ember_V2_1080p.mp4` | Composition 1, Version 2: **camera-movement** alternative (opens wide on the whole crown, pushes in with an arc, lands on the V1 framing) |
| 3 | `Composition2_Pearl_V1_1080p.mp4` | Composition 2, Version 1: matches reference 2 (pearl hooks with violet tips, lavender-grey studio, rolling close-up) |
| 4 | `Composition2_Pearl_V2_1080p.mp4` | Composition 2, Version 2: **colour-palette** alternative (cream-pearl, coral tips, sage-mint backdrop) |
| 5 | `TubeBloom_4K_Remotion_Project.zip` | Remotion project holding all four 3840×2160 compositions, source, config and README |

Technology: Remotion 4.0.538 + Three.js (WebGL 2), with custom GLSL depth-of-field post-processing. All geometry and materials are procedural, so there are no external assets. The references have no audio, and neither do the outputs.

## Technical checks (ffprobe / ffmpeg decode of every frame)

| File | Codec | Pix fmt | Size | FPS | Frames | Duration | Ref. duration | Audio | Decode errors | Black segments | Frozen frames | Max frame step / median |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ember V1 | H.264 High | yuv420p | 1920×1080 | 30/1 | 305 | 10.1667 s | 10.1667 s | none | none | 0 | 0 | 2.32 / 1.95 |
| Ember V2 | H.264 High | yuv420p | 1920×1080 | 30/1 | 305 | 10.1667 s | 10.1667 s | none | none | 0 | 0 | 2.16 / 1.48 |
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
| Ember V1 | 9 + 4 (rebuild) | **PASS** | Rebuilt after client feedback that the first version did not look like the reference, and re-reviewed by a new reviewer independent of the earlier passes. Now a crown of short, thick, opaque glossy orange tubes around a defocused charcoal well. Lit area x 0.26–1.0, y 0–0.75 (ref. 0.29–1.0, 0–0.77). Coverage 0.25 (ref. 0.27). Median lit colour (232,34,0) (ref. (229,48,2)). Clockwise spin plus per-ring writhe; seamless loop. |
| Ember V2 | 3 + 2 (rebuild) | **PASS** | Same rebuilt design. A smooth push-in with an arc that lands exactly on the V1 framing, clearly a different camera move from the reference. |
| Pearl V1 | 11 | **PASS** | Close-up hook ball against the right edge, with the left 42% plain backdrop (bg (187,193,210) vs ref. (189,194,211)). Hooks curl up and out with caps facing left; violet ≈ ref.; on-screen speed ≈ ref.; shallow depth of field. |
| Pearl V2 | 2 | **PASS** | Unmistakable palette alternative with identical geometry and motion. Shaft clipping was reduced from 8.3% to 1.1% at the reviewer's recommendation. |

The reviewer also checked every final file for banding, aliasing, corrupted frames and flicker. None were found.

## Known, accepted deviations

- **Pearl V1 repeat period:** the ball turns 4 tube spacings per loop, so the picture repeats every 38 frames against the reference's 30.4. This keeps the on-screen speed matched to the reference with these larger hooks, and the reviewer agreed with the trade-off.
- **Ember motion blur:** the reference has slight motion blur and these renders don't. The reviewer judged it not decisive, since the reference's feel comes from how far the tubes move.

## Checksums (SHA-256)

```
1bea199ed839de7501ff130ec767aa08cb088189d9f11a51627fbcb2c71813f5  Composition1_Ember_V1_1080p.mp4
2d9b56634600a0209ae15e5081e3002ffd2679d6840223ab5b745c1743ebd86f  Composition1_Ember_V2_1080p.mp4
73cdcd2c50cef325b016b75e5469a4e51f004f039fc099e8119ee645707a91ef  Composition2_Pearl_V1_1080p.mp4
cda6886630bf6aff6a2f31da6a2fdbd2b612be0173f3b11eb153f587eaf135be  Composition2_Pearl_V2_1080p.mp4
47ca7b92f5980b04e51d53a04a5e4ae2b1265f1b2846958101accb46b35a67ac  TubeBloom_4K_Remotion_Project.zip
```
