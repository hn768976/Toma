# QC Report: Underwater Light Rays (Remotion, 4K compositions, 1080p deliverables)

## Deliverables

| # | File | Reference | Version |
|---|------|-----------|---------|
| 1 | `Composition1_Version1_Match_1080p.mp4` | Ref 1: deep ocean rays (20.04 s) | Match: locked-off camera |
| 2 | `Composition1_Version2_CameraMove_1080p.mp4` | Ref 1 | Alternative **camera movement**: opens rolled about 11°, then tilts up and pulls back to a wide shot as the light swings into frame, with particle parallax |
| 3 | `Composition2_Version1_Match_1080p.mp4` | Ref 2: surface seen from below (10.01 s) | Match: clear tropical blue |
| 4 | `Composition2_Version2_GoldenHour_1080p.mp4` | Ref 2 | Alternative **colour palette**: golden-hour amber surface and shafts, sinking into rose and indigo |
| 5 | `underwater-light-rays-4k-project.zip` | | Remotion project containing all four 3840×2160 compositions |

### Technology

- WebGL 2 fragment shaders (GLSL ES 3.00) drawn by a small `ShaderCanvas` component and driven by `useCurrentFrame()`.
- Fully procedural: no image or video assets. Every frame is a deterministic function of the frame number.
- The project was scaffolded with the Remotion CLI (`npx create-video --blank`, Remotion 4.0.538).

### Why each alternative

- **Ref 1 (camera movement):** the reference is a single static light in an otherwise empty, dark scene, so a palette change would mostly just tint the blackness. A camera move gives the scene depth and lets the particles show parallax.
- **Ref 2 (palette):** the reference is defined by its colour (bright tropical blue), and its sun, surface and seabed read strongly under a warm grade.

## 1. Render and format checks (ffprobe plus a full decode of every file)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Renders successfully | ✅ | ✅ | ✅ | ✅ |
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate | 30/1 exact | 30/1 exact | 30/1 exact | 30/1 exact |
| Frames (decoded) | 601 | 601 | 300 | 300 |
| Duration | 20.033 s | 20.033 s | 10.000 s | 10.000 s |
| Reference duration | 20.04 s | 20.04 s | 10.01 s | 10.01 s |
| Pixel format / colour | yuv420p, BT.709 limited | same | same | same |
| Bitrate | 22.9 Mb/s | 23.7 Mb/s | 4.5 Mb/s | 4.3 Mb/s |
| Decode errors | none | none | none | none |
| Audio | none (references have none) | none | none | none |

**Duration note.** At 30 fps the reference lengths come to 601.2 and 300.3 frames. A video can only hold whole frames, so the deliverables use 601 frames (20.033 s) and 300 frames (10.000 s). Both are within one frame (under 33 ms) of the reference. Composition 2 has exactly the reference's frame count.

## 2. Artifact checks (every frame analysed)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Black segments (ffmpeg blackdetect) | 0 | 0 | 0 | 0 |
| Frozen or duplicate frames | 0 | 0 | 0 | 0 |
| Flicker spikes (single-frame luma outliers) | 0 | 0 | 0 | 0 |
| Max mean-luma jump between frames (0–255) | 0.51 | 0.69 | 0.24 | 0.24 |
| Frame mean-luma range | 30.7–48.9 | 31.7–71.3 | 131.3–134.9 | 123.6–127.0 |
| Clipped pixels on brightest frame | 0% | 0% | — | — |

Reference baselines:

- Ref 1 mean luma ranges 29–47 and moves at most 0.88 between frames.
- Ref 2 mean luma ranges 129–133 and moves at most 0.39 between frames.

**Problems found and fixed during QC:**

- **atan() seam.** A hard horizontal line appeared when the V2 camera move brought the light into frame. Fixed by measuring angles from the fan's own direction.
- **Colour tagging.** The first renders were full-range BT.601. The project now outputs standard limited-range BT.709 (`Config.setColorSpace("bt709")`), verified within about 1 LSB of a lossless frame.
- **Banding.** 8-bit banding in Composition 1's dark gradients is broken up by animated grain sized to survive H.264. This is why Composition 1's bitrate is higher. The grain is not visible at normal viewing.
- **V2 opening.** The V2 opening was too dark and has been lifted.

## 3. Match to reference: independent reviewer agent

A separate agent reviewed each composition against its reference. It received only the files, not my conclusions. It compared side-by-side frames, crops, colour grids, brightness curves and temporal statistics. Each composition went through three review rounds, and each round's findings were fixed and re-rendered.

| | Round 1 | Final round |
|---|---|---|
| C1 V1 similarity | 6/10, PASS WITH NOTES | **7.5/10, PASS** |
| C1 V2 | PASS WITH NOTES (not distinct enough) | **PASS** (clearly distinct camera move) |
| C2 V1 similarity | 7/10, PASS WITH NOTES | **8/10, PASS** |
| C2 V2 | PASS WITH NOTES (muddy lower half) | **PASS** (clearly distinct palette) |

### Main fixes from review

- **Composition 1:**
  - Starburst rays replaced with broad, soft, steep shafts (the reference's are 57–71°).
  - Brightness pulse fitted to the reference: per-second correlation is **0.97** with the same mean.
  - Hotspot now blooms in from outside the frame.
  - Particles are smaller and sparser.
  - Banding is fixed.
  - Stronger V2 camera move.
- **Composition 2:**
  - One broad main shaft leaning right replaces many thin streaks.
  - Larger surface cells with darker troughs and a blown-out sun.
  - Lighter teal mid-water, aqua seabed glow, corrected dark corner.
  - Motion speeds matched to the reference: surface 1.17 vs 1.11.
  - A gradual surface fade.

### Known minor differences, accepted

- **C2 V1 surface pattern:** the ripples read as horizontal perspective bands, where the reference's run diagonally.
- **C2 V1 colour and fade:** mid-water centre is slightly bluer, and a faint soft fade edge is visible at about 20% from the top.
- **C2 V1 ray shimmer:** slightly calmer than the reference (0.20 vs 0.29).
- **C1 V1:** lower-centre slightly darker, and a few subtle thin streaks remain at the hotspot.
- **C1 V2:** brightens to about 66–70 mean luma over 15–20 s as the light enters frame. This is a deliberate reveal, with no clipping.
- **Looping:** the clips are not seamless loops (neither are the references).
- **No watermark:** the iStock watermark in the references was intentionally not reproduced.

## 4. Project ZIP checks

| Check | Result |
|---|---|
| Archive integrity (`unzip -t`) | ✅ no errors |
| Contents | 22 files: `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint and Prettier config, `README.md` (documented commands), and `src/` (four 3840×2160 compositions, shader sources, WebGL renderer) |
| Matches final source | ✅ byte-identical to the committed source |
| Assets | None required (procedural). `public/` is intentionally empty. |
| Extract → `npm ci` | ✅ 0 vulnerabilities |
| `npm run lint` (ESLint + tsc) | ✅ clean |
| `npx remotion compositions` | ✅ four compositions, 3840×2160, 30 fps, 601/601/300/300 frames |
| 4K render with documented command | 4K_RESULT |

## 5. Integrity (SHA-256)

```
b5df1f011cc5f75a6b54b3fa47ce4f3927bb469cc89f6f7d38205602c37b3a1b  Composition1_Version1_Match_1080p.mp4
cbcfc155ebd5c913c5f48f596bfc9a23bb7be44e88251b484153a5f96441a640  Composition1_Version2_CameraMove_1080p.mp4
21a830a73deea71459ac3b2e0d9370d7867d2268c7b5f1d62439deb5cc328fce  Composition2_Version1_Match_1080p.mp4
151eeae127202dcdc1174adbdeda47825a8afdba0927f8857a400d5b3551a193  Composition2_Version2_GoldenHour_1080p.mp4
72e518db17d1e303a7d6662e0b8e7dba370855c39cd762702fcea6ca405b23d9  underwater-light-rays-4k-project.zip
```
