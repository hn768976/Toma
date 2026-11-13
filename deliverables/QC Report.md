# Quality-Control Report — Particle Brain Formation & Holographic Chess King

**Date:** 2026-11-13 · **Tooling:** Remotion 4.0.543 (projects created with `npx create-video --blank`), Three.js 0.187 (WebGL 2 + GLSL), ffmpeg/ffprobe

## Deliverables

| # | File | Size |
|---|------|------|
| 1 | `Version 1 - Particle Brain Formation.mp4` | 51.3 MB |
| 2 | `Version 2 - Particle Brain Formation (Neural Ember Palette).mp4` | 53.2 MB |
| 3 | `Version 1 - Holographic Chess King.mp4` | 4.2 MB |
| 4 | `Version 2 - Holographic Chess King (Orbit Camera).mp4` | 6.4 MB |
| 5a | `Particle Brain Formation - 4K Remotion Project.zip` (compositions `BrainFormationV1`, `BrainFormationV2`) | 63 KB |
| 5b | `Holographic Chess King - 4K Remotion Project.zip` (compositions `ChessKingV1`, `ChessKingV2`) | 62 KB |

Both references are 10.000 s, 300 frames, 30 fps, with no audio track.

The brain files are larger because a dense particle field has very high detail. They are encoded at the same quality setting (CRF 16) as the chess files.

## 1. Technical checks on the final MP4s

All four outputs pass every check.

| Check | Brain V1 | Brain V2 | Chess V1 | Chess V2 |
|---|---|---|---|---|
| Codec | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames decoded | 300 | 300 | 300 | 300 |
| Duration (reference 10.000 s) | 10.000 s | 10.000 s | 10.000 s | 10.000 s |
| Pixel format / colour | yuv420p, BT.709, TV range | same | same | same |
| Full-decode errors | none | none | none | none |
| Black frames (blackdetect) | none | none | none | none |
| Unintended flicker (largest frame-to-frame mean-luma jump outside designed events) | 0.65 | 0.72 | 0.32 | 0.50 |
| Audio | none (matches reference) | none | none | none |

**How these were checked:**
- Every frame was decoded with `ffmpeg -f null`.
- `blackdetect` scanned for black frames.
- Per-frame luma (`signalstats`) and frame-differencing scanned all 300 frames for flicker, pops and corrupt frames.
- The chess king's flash, flicker and power-down are designed events copied from the reference, so they are excluded from the flicker figure.
- Each MP4 in the deliverables folder is byte-identical to its render output (checked with `cmp`).

## 2. Project ZIP checks

Both ZIPs pass every step below.

| Step | Brain ZIP | Chess ZIP |
|---|---|---|
| `unzip -t` integrity | OK | OK |
| Contents: `src/`, `package.json` + `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint/Prettier config, README with commands | complete | complete |
| Fresh extract → `npm ci` | 346 packages, OK | 346 packages, OK |
| `npm run lint` (ESLint + `tsc`) | clean | clean |
| `npx remotion compositions` | 2 × 3840×2160, 30 fps, 300 frames | 2 × 3840×2160, 30 fps, 300 frames |
| Full-resolution 4K still of each composition | 3840×2160 OK | 3840×2160 OK |
| 4K clip render (frames 0–29) | H.264, 3840×2160, 30 fps OK | H.264, 3840×2160, 30 fps OK |
| Native 4K frame vs 1080p deliverable | — | same framing; mean luma 35.6 vs 34.9 |

**Assets:** none are external. All geometry, textures and particles are generated in code, so nothing can go missing.

**Commands** (also in each README):
- `npm install`
- `npm run render:v1`, `npm run render:v2` or `npm run render:all` for the 1080p deliverables
- `npm run render:v1:4k` and `npm run render:v2:4k` for 4K masters

The 1080p deliverables are the 4K compositions rendered with `--scale=0.5`; the WebGL buffer follows the scale, so frames rasterise natively at 1080p.

## 3. Match to reference: independent reviewer agent

A separate reviewer agent compared each deliverable against its reference. It worked from extracted frames, per-frame metrics and side-by-side sheets, and did not see the code. Its findings drove two (brain) or three (chess) rounds of fixes.

### Particle Brain Formation — V1 score 5.5 → 7.5 / 10

**Confirmed matches:**
- **Anatomy and orientation:** frontal lobe on screen-right, cerebellum and brainstem lower-left, red temporal pole lower-right.
- **Final framing:** bounding box within a few pixels of the reference.
- **Colour washes:** red peaks at 4.8 s (97% coverage vs 86% in the reference), green peaks around 5.6–6 s, then decays toward cyan (24% vs 26% at 8 s, 17% vs 20% at the end).
- **Ending:** the turn eases out by about 9.5 s.
- **Background:** colour matches.

**Remaining differences (cosmetic):**
- The opening particle cloud is somewhat sparser and taller than the reference's dense, luminous mass.
- The red phase is darker (frame luma about 18 vs 24).
- The settled brain is slightly duller cyan.
- Fine fold detail appears about 0.5–1 s earlier.

**Defects:**
- Edge clipping, shimmer and halo banding were found and fixed.
- In the final files: no clipping (top margin at least 27 px), no black, corrupt or duplicate frames, no pops.

### Holographic Chess King — V1 score 6 → 7.5 / 10

**Confirmed matches:**
- **Lighting events are frame-exact against the reference:**
  - f11 micro-flicker;
  - f21 one-frame flash;
  - f22–25 dark;
  - f26–28 partial ignition;
  - f29 full on;
  - f270 partial, f271 off.
- **Camera zoom matches the reference at every measured frame** (f0, 29, 40, 260, 270, 280, 299), within about 0.01×.
- **Composition matches:** king on the left third, rim-lit silhouette when unlit, left-weighted lit floor, background pieces in depth of field with neon base rings, constellations and light rays.

**Defects found and fixed during review:**
- No camera push-in or pull-out at first (added).
- King overexposed and flat (re-lit with facet shading).
- Bokeh "striped" constellation lines (replaced with soft lines).
- Zoom pausing at each keyframe (now one continuous ease; a motion check shows a smooth rise and fall).
- Crown knob poking through the cross (cross rebuilt).

**Remaining differences (cosmetic):**
- The lit king is a little brighter than the reference.
- The right side of the floor is darker.
- Constellations are slightly sparser.

## 4. Version 2 alternatives

The reviewer confirmed that each V2 is clearly distinct, keeps the concept, and has V1's timing and quality.

**Particle Brain Formation V2 — colour palette.** "Neural Ember" palette: gold body, magenta side, violet then amber washes, plum background. Shape, camera and timing are identical to V1. A palette change suits this piece because colour is its main storytelling device.

**Holographic Chess King V2 — camera movement.** A continuous crane-down orbit of about 70° around the king: it starts high and looking down, and ends low, with the king centred, sharp and never cropped. The look and lighting events are identical to V1. A camera move suits this piece because it is a locked-off 3D scene, and orbiting shows off the depth, the holographic rings and the reflections.

## 5. Notes

- The renders use the SwiftShader (`swangle`) WebGL backend, which works on machines without a GPU. On a machine with a GPU, add `--gl=angle` for much faster renders.
- The references' iStock watermark was not reproduced.
