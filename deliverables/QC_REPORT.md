# Quality-Control Report: Remotion 4K Compositions

**Date:** 2026-10-31
**Tooling:** Remotion CLI 4.0.539, React 19, WebGL 2 fragment shaders, ffmpeg/ffprobe

## Deliverables

| # | File | Composition (4K source) | Variant |
|---|------|-------------------------|---------|
| 1 | `Comp1-V1_ForestSunrays-Reference_1080p.mp4` | `ForestSunrays-V1-Reference` | Matches reference 1 |
| 2 | `Comp1-V2_ForestSunrays-GoldenHour_1080p.mp4` | `ForestSunrays-V2-GoldenHour` | Alternative **colour palette** (golden hour) |
| 3 | `Comp2-V1_SunburstFlare-Reference_1080p.mp4` | `SunburstFlare-V1-Reference` | Matches reference 2 |
| 4 | `Comp2-V2_SunburstFlare-CameraPan_1080p.mp4` | `SunburstFlare-V2-CameraPan` | Alternative **camera movement** (pan, push-in, roll) |
| 5 | `comp1-forest-sunrays-4k-project.zip`, `comp2-sunburst-flare-4k-project.zip` | Both 3840×2160 projects | Source, config, lockfile, README |

`SHA256SUMS.txt` lists a checksum for every file.

**Reference mapping:**
- Reference 1 (`…2248654345…mp4`, teal forest bokeh with sun rays) → Composition 1.
- Reference 2 (`…2293805839…mp4`, sunburst with lavender lens flare) → Composition 2.

**Technology choice:** both references are defocused, light-driven footage (bokeh, glare, rays, flare ghosts) with a static camera. A single WebGL 2 fragment shader per composition gives soft, physically styled light at any resolution, with no image assets. Every frame is a pure function of the frame number, so renders are deterministic.

**Choice of V2 alternatives:**
- **Composition 1** is all about the colour of light through leaves, so the alternative is a palette change.
- **Composition 2** is a lens flare, whose ghosts move along the optical axis when the camera moves. A camera pan shows that off, so the alternative is camera movement. The ghosts are computed as mirrors of the sun through the frame centre, so they sweep correctly as the camera moves.

## 1. Render success, duration, frame rate, codec, resolution

All four renders completed without errors. Columns are measured with `ffprobe -count_frames` and a full decode pass.

| Video | Codec / profile | Size | FPS (r / avg) | Frames | Duration | Reference | Δ |
|---|---|---|---|---|---|---|---|
| C1-V1 | H.264 High, 4:2:0 | 1920×1080 | 30/1 / 30/1 | 601 | 20.033 s | 20.020 s | +13 ms |
| C1-V2 | H.264 High, 4:2:0 | 1920×1080 | 30/1 / 30/1 | 601 | 20.033 s | 20.020 s | +13 ms |
| C2-V1 | H.264 High, 4:2:0 | 1920×1080 | 30/1 / 30/1 | 506 | 16.867 s | 16.850 s | +17 ms |
| C2-V2 | H.264 High, 4:2:0 | 1920×1080 | 30/1 / 30/1 | 506 | 16.867 s | 16.850 s | +17 ms |

**Duration note:** an exact match is not possible at exactly 30 fps.
- 20.02 s is 600.6 frames and 16.85 s is 505.5 frames, and a video can only contain whole frames.
- The nearest whole-frame lengths were used: 601 and 506 frames. Both deviations are under 17 ms, which is half a frame.

**Pixel format:** Remotion's default output is `yuvj420p` (full-range 4:2:0). It plays in every common player and browser.

**Audio:** none.
- The reference 1 audio track is digital silence (−91 dB mean and peak), so no audio was reproduced.
- Reference 2 has no audio.
- There are therefore no audio issues to check.

## 2. Frame integrity and artifacts

| Check | C1-V1 | C1-V2 | C2-V1 | C2-V2 |
|---|---|---|---|---|
| Full decode errors | none | none | none | none |
| Black segments (`blackdetect`) | 0 | 0 | 0 | 0 |
| Min / max frame mean luma | 92 / 147 | 87 / 139 | 148 / 171 | 144 / 176 |
| Mean frame-to-frame difference | 2.19 | 2.07 | 0.53 | 0.68 |
| Largest single-frame luma spike | 7.3 | 6.9 | 0.56 | 0.57 |

**Light flicker in Composition 1:** the brightness dips are intentional.
- They reproduce the reference's sunlight being occluded by leaves.
- They are driven by a light curve measured from the reference: luma-curve correlation is 0.989.
- They are gentler than the reference's own dips. Its largest single-frame spike is 13.7 and its mean frame difference is 2.71.

**Composition 2:** no flicker; the largest single-frame spike is under 0.6 luma levels.

**Banding:** a dither and grain term is applied in the shader. The verifier found no banding even with contrast boosted 3–4×.

**Other artifacts:** no seams, garbled frames, missing assets or camera discontinuities were found. The V2 pan's largest frame difference is 1.8, with smooth ease-in and ease-out.

## 3. Match to reference

An independent agent reviewed the renders twice. It used side-by-side frames at 0, 25, 50, 75 and 100%, region colour grids, and luma and motion curves.

**Pass 1:**
- C1-V1 scored 7/10 (pass) and C2-V1 scored 7.5/10 (pass).
- Its ranked differences were all fixed. Composition 1 got a bluer palette, a wider soft left ray, filled bokeh, a larger sun bloom and stronger light dips. Composition 2 got a darker olive top-left, a compact core with a stronger starburst, crisper leaf highlights and a repositioned red streak.

**Pass 2 (final):** all four videos passed.

| Video | Score | Mean-luma curve correlation | Frame-difference correlation | Mean RGB vs reference |
|---|---|---|---|---|
| C1-V1 | 8/10 | 0.989 | 0.895 | 112/138/145 vs 107/137/142 |
| C2-V1 | 8/10 | 0.995 | 0.929 | within 3 levels |

**V2 checks from pass 2:**
- C1-V2 is clearly distinguishable: mean RGB 155/122/66, amber/brown. Layout and motion are identical to V1, so the concept is preserved.
- C2-V2 is clearly distinguishable. The sun travels smoothly from about 81% to 43% of the frame width, with a push-in and slight roll, and the flare ghosts sweep accordingly. There are no jumps.

**Pass 2 follow-up fix (Composition 2):**
- *Finding:* the sun core greyed to 225–245 during light dips.
- *Cause:* the exposure curve was applied after tone mapping.
- *Fix:* it is now applied in linear light before tone mapping, and both C2 videos were re-rendered.
- *Check:* the sun core peaks at 255 in all 506 frames of both versions. Luma correlation with the reference is 0.992 and mean luma is 162.8 vs 164.8, with all integrity checks above still passing.
- The verifier did not review this re-render; I checked it myself as described.

**Known remaining differences (minor, from the verifier):**
- C1: the bokeh discs are slightly more uniform than the reference's, and the shimmer is about 25% weaker.
- C2: the starburst spikes are a little crisper than the reference's.

## 4. Project ZIPs: completeness and reproducibility

**Contents:**
- 4K compositions (`src/Root.tsx`, 3840×2160 at 30 fps).
- All source: shaders, GL runner, scene and palette code, measured light curves.
- `package.json` with render scripts, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint and Prettier config.
- A README with commands, and the light-curve extraction script.
- No binary assets are required; everything is procedural.

**Integrity:** `unzip -t` reports no errors for either ZIP. Checksums are in `SHA256SUMS.txt`.

**Clean-room test:** each ZIP was extracted into an empty directory, and then:
- `npm ci` succeeded.
- `npm run lint` (ESLint + `tsc`) succeeded.
- `npx remotion compositions` listed all four compositions at 3840×2160, 30 fps, 601 and 506 frames.
- A native 4K still rendered for every composition (PNG 3840×2160).
- A 1080p H.264 segment rendered for every composition.
- The Composition 2 ZIP was retested after the final fix.

**4K vs delivery frames:** native 4K frames, downscaled, match the delivered 1080p frames at 46–47 dB PSNR. The residual is grain and H.264 compression.

**Documented commands:** the final videos were produced with the documented `npm run render:v1` and `npm run render:v2`. These run `remotion render <id> … --scale=0.5`, which renders the 4K compositions to 1920×1080. 4K masters are available via `npm run render:v1:4k` and `npm run render:v2:4k`.

**Rendering requirements:** no GPU is required. WebGL 2 runs through ANGLE + SwiftShader (`--gl=swangle`). On a GPU machine, adding `--gl=angle` is much faster.
