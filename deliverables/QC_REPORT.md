# Quality-Control Report: 4K Compositions (Remotion)

Date: 2026-10-31.

All four videos and both project ZIPs passed QC. One spec item can't be met exactly: the 12 ms / 10 ms duration difference under "Timing" below. No blocking defects were found.

## Deliverables

| # | File | Composition (4K source) | Variant |
|---|------|-------------------------|---------|
| 1 | `Composition1_SilkFlow_V1_1080p.mp4` | `SilkFlowV1` (3840×2160) | Matches the reference: black satin folds |
| 2 | `Composition1_SilkFlow_V2_GoldPalette_1080p.mp4` | `SilkFlowV2` (3840×2160) | **Different colour palette** (champagne gold on warm black), plus a subtle push-in and roll |
| 3 | `Composition2_PoolCaustics_V1_1080p.mp4` | `PoolCausticsV1` (3840×2160) | Matches the reference: top-down pool floor |
| 4 | `Composition2_PoolCaustics_V2_TiltedGlideCamera_1080p.mp4` | `PoolCausticsV2` (3840×2160) | **Different camera angle and movement** (tilted perspective, forward glide with slow yaw) |
| 5 | `silk-flow-4k-project.zip`, `pool-caustics-4k-project.zip` | Remotion projects for both 4K compositions | |

- **Technology:** both projects were scaffolded with the Remotion CLI (`npx create-video --blank`). Each composition is a WebGL 2 fragment shader on a 3840×2160 canvas. The renders use no external assets and are deterministic per frame.
- **Why V2 differs the way it does:**
  - Silk is an abstract, colour-driven backdrop, so a palette change suits it best.
  - The pool is defined by its geometry (tile grid, caustics), so a camera-angle and movement change suits it best.

## Technical checks (ffprobe / ffmpeg on the final files)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames (reference) | 360 (360) | 360 (360) | 300 (300) | 300 (300) |
| Duration | 12.000 s | 12.000 s | 10.000 s | 10.000 s |
| Pixel format / colour | yuv420p, BT.709 tv | same | same | same |
| Decode errors | none | none | none | none |
| Black frames (blackdetect) | none | none | none | none |
| Frozen frames (freezedetect ≥0.5 s) | none | none | none | none |
| Unique frames (framemd5) | 360/360 | 360/360 | 300/300 | 300/300 |
| Max frame-to-frame luma jump | 0.51 | 1.11 | 0.20 | 0.35 |
| Audio | none | none | none | none |

- **Flicker:** none. The largest frame-to-frame jump in average brightness is about 1 level out of 255 in every video.
- **Audio:** the references carry a silent AAC track (measured at −91 dB, i.e. digital silence), so the deliverables are video-only and there are no audio issues to check.
- **Timing:** each video keeps the reference's exact frame count, mapping frame for frame.
  - The references run at 29.97 fps (12.012 s and 10.010 s).
  - At exactly 30 fps, 360 and 300 frames last 12.000 s and 10.000 s.
  - The 12 ms and 10 ms gaps are the NTSC 29.97 → 30 fps difference and can't be closed with whole frames.

## Project ZIP integrity and reproducibility

- `unzip -t` reports no errors for either archive. Each ZIP's contents are byte-identical to the committed sources.
- **Contents:**
  - `src/`: compositions, shaders, WebGL 2 renderer
  - `package.json` and `package-lock.json`, with pinned versions
  - `remotion.config.ts`: H.264, CRF 16, BT.709, swangle GL
  - `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`
  - `public/`
  - `README.md` with the commands
  - No external assets are needed.
- **Clean-room test on fresh extracts:** `npm ci` succeeded, then `npm run lint` (eslint + tsc) passed with no warnings. `remotion compositions` lists all four compositions at 3840×2160, 30 fps, with 360 / 300 frames.
- **Documented commands:**
  - `npm run render:v1` and `npm run render:v2` (first 60 frames) produced H.264 1920×1080 30/1 output.
  - Against the delivered files that output scores PSNR Y = 62.2 / 57.2 / 45.6 / 49.4 dB, i.e. effectively identical.
  - `npm run render:v1:4k` and `npm run render:v2:4k` produce H.264 3840×2160 30/1.

## Reference-matching verification (independent agents)

Separate reviewer agents compared each video with its reference over three rounds: an initial review of each composition, then a final review of all four videos after fixes.

- **Round 1 findings, now fixed:**
  - Silk: folds too wide and flat-angled, brightness curve off, too much contrast with no fill, a brushed-metal texture, V2 only a recolour.
  - Pool: grid wobble about 3× too weak, grout too thin, caustics too wispy, slight red cast.
- **What was changed:**
  - Silk brightness was calibrated in a closed loop against the reference. Its brightness curve over time now correlates 0.98 with the reference, with a mean luma of 20.2 vs 21.8.
  - Pool colour now matches the reference (mean RGB 45/173/173 vs 43/173/173) and the tile grid density matches exactly (62 × 41 tiles).
  - Caustic animation speed matches (0.91 vs 0.91).

**Final round verdicts**

| Video | Verdict |
|---|---|
| C1 V1 | PASS WITH NOTES |
| C1 V2 | PASS |
| C2 V1 | PASS WITH NOTES |
| C2 V2 | PASS |

In the final round, V2 was judged clearly distinct, faithful to the concept and smooth in both compositions. No aliasing or moiré was found in the pool V2 far field.

**Remaining minor notes (non-blocking)**
- **C1 V1:**
  - Slightly softer than the reference; it lacks the occasional thin, sharp highlight streak.
  - Moves a little faster around 6–10 s.
- **C2 V1:**
  - The grout grid is somewhat crisper and more regular than the reference's soft, low-resolution source.
  - The caustics are a touch paler.
