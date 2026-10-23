# Quality-Control Report

Date: 2026-10-23 · Branch `ccr-4c8bf1ee-n6sdbk`

## Deliverables

| # | File | Composition (4K source) | Variant |
|---|------|------------------------|---------|
| 1 | `Composition1_V1_Match_1080p.mp4` | `YesKey-V1-Match` | Matches reference 1 |
| 2 | `Composition1_V2_Orbit_1080p.mp4` | `YesKey-V2-Orbit` | Alternative **camera movement**: slow orbit + push-in onto the YES key |
| 3 | `Composition2_V1_Match_1080p.mp4` | `Energy-V1-Match` | Matches reference 2 |
| 4 | `Composition2_V2_Night_1080p.mp4` | `Energy-V2-Night` | Alternative **colour palette**: night scene (indigo/teal, warm light) |
| 5 | `Composition1_YesKey_Keyboard_4K_Project.zip` | Remotion project, both 4K comps of composition 1 | |
| 5 | `Composition2_Energy_Diorama_4K_Project.zip` | Remotion project, both 4K comps of composition 2 | |

Why these alternatives: the keyboard reference is a locked-off close-up whose only motion is the key press. A camera move adds the most to it while keeping the same palette and concept. The diorama reference tells its story through light (charge → switch-on → drain). A night palette keeps the same camera and timing, and makes that light the hero.

Technology: Remotion 4.0.538 CLI (`create-video --three`), React Three Fiber via `@remotion/three`, Three.js r178 (WebGL 2). All geometry is procedural. Composition 1 bundles one font (Liberation Sans Bold, SIL OFL), and composition 2 needs no external assets.

## Technical checks (ffprobe / ffmpeg, all files)

| File | Codec | Res | FPS | Frames (ref) | Duration (ref) | Pixel fmt | Decode errors | Black frames | Flicker |
|------|-------|-----|-----|--------------|----------------|-----------|---------------|--------------|---------|
| C1 V1 | H.264 High | 1920×1080 | 30/1 | 170 (170) | 5.667 s (5.667 s) | yuv420p bt709 | none | 0 | none |
| C1 V2 | H.264 High | 1920×1080 | 30/1 | 170 (170) | 5.667 s (5.667 s) | yuv420p bt709 | none | 0 | none |
| C2 V1 | H.264 High | 1920×1080 | 30/1 | 555 (555) | 18.500 s (18.500 s) | yuv420p bt709 | none | 0 | none |
| C2 V2 | H.264 High | 1920×1080 | 30/1 | 555 (555) | 18.500 s (18.500 s) | yuv420p bt709 | none | 0 | none |

- **Duration:** frame counts are exactly equal to the references, and so are the durations.
- **Decode integrity:** a full decode with `ffmpeg -xerror` found no errors.
- **Black frames:** mean luma never fell below 8 on any frame.
- **Flicker:** no isolated outlier frames, meaning frames that differ strongly from both neighbours while the neighbours agree.
- **Largest frame-to-frame changes:** they fall only on the scripted events, the key press (f94) and the bulb switching (f241–249 / f321–329).
- **Audio:** none. Reference 1 has an AAC track, but it is digital silence (silencedetect: silent 0 → 5.67 s). Reference 2 has no audio. No audio issues are possible.

## Project ZIP checks

- `zip -T` integrity: OK for both archives.
- **Contents:** `src/` (compositions, scenes, geometry, palettes, timeline), `public/` assets (font + licence), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, `eslint.config.mjs`, and a README with commands. `node_modules` and `out` are excluded.
- **4K:** the compositions are authored at 3840×2160. `npx remotion compositions` lists them at 3840×2160 / 30 fps / 170 and 555 frames, and native 4K renders were verified (3840×2160 H.264 clip, 3840×2160 still).
- **Clean-room rebuild:** I extracted each ZIP into an empty folder, ran `npm ci` (0 vulnerabilities) and `tsc` (pass), then rendered with the documented `npm run render:v1:1080p` / `render:v2:1080p`. All four renders succeeded, and **the outputs are byte-identical (SHA-256) to the delivered MP4s**.

## Visual verification (independent motion-graphics reviewer agent)

The reviewer compared each video against its reference frame by frame, using measured metrics: centroid and bounding-box tracking, colour sampling, turbine angle tracking, LED, window and battery pixel counts, and brightness histograms. Three rounds:

1. **Round 1: 3 FAIL, 1 PASS.**
   - Keyboard camera, lens and grid lean were off.
   - Exposure was too bright and the bevels showed facets.
   - The diorama was missing its floor-by-floor window light-up beat.
   - Battery easing, palette, blades and layout were off.
   - All of these were fixed.
2. **Round 2: 4 PASS**, with small placement and lookdev refinements suggested. All were applied.
3. **Round 3 (final): 4 PASS. No regressions and no remaining real mismatches.**

Matched timing in the final renders (reference → render):

| | Event | Reference | Render |
|---|---|---|---|
| **C1** | Press start | f72 | f72 |
| | Bottom of press | f87 | f88 |
| | Release complete | f99 | f98 |
| | Key travel | 30 px | 30 px (768-scale) |
| **C2** | Turbine | starts f61, stops f496, exactly 15 turns | same |
| | LEDs on | 90 / 105 / 120 / 135 | same |
| | LEDs off | 436 / 451 / 466 / 481 | same |
| | Tower windows on, floor by floor | 135 + 15k | identical |
| | Tower windows off | 346 + 15k | identical |
| | Battery | linear 136→225, 331→420 | within ±0.03 |
| | Bulb on | f241–249 | within 1 frame |
| | Bulb off | f321–329 | within 1 frame |
| | Object centroids | | within ≈1–5 px at 768-scale |

**Alternatives:**
- **C1 V2:** clearly distinct, with continuous, eased camera motion that settles at f158 and holds. The press stays readable.
- **C2 V2:** clearly distinct night palette with identical timing. The floor-by-floor windows and warm switch-on become the strongest beat.
- Both keep the concept and quality.

**Known minor differences (not blocking):**
- The iStock watermark is intentionally not reproduced.
- The C1 YES key is about 8% less bright than the reference.
- Small pastel hue differences remain in C2: facade (251,170,191) vs (255,178,198).
