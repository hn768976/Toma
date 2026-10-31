# Quality-Control Report: Downtrend Charts

Date: 2026-10-31.
Project: Remotion 4.0.539 + Three.js 0.178 (`@remotion/three`, React Three Fiber, WebGL 2).
All four compositions are authored at 3840 × 2160 (4K UHD), 30 fps. The delivery files are 1080p renders of those 4K compositions (`--scale=0.5`).

## Deliverables

| # | File | Composition | Alternative | SHA-256 |
|---|------|-------------|-------------|---------|
| 1 | `Comp1-V1-Ember_1080p.mp4` | Comp 1 V1: matches reference 1 | n/a | `7c67eb8c…09951` |
| 2 | `Comp1-V2-Glacier_1080p.mp4` | Comp 1 V2 | **Colour palette**: electric blue→cyan bars, violet arrow, blue glow | `46796d84…e0b` |
| 3 | `Comp2-V1-Static_1080p.mp4` | Comp 2 V1: matches reference 2 | n/a | `7284a945…7ecc8` |
| 4 | `Comp2-V2-Orbit_1080p.mp4` | Comp 2 V2 | **Camera angle and movement**: low front-left → high front-right crane/arc | `79dc7f38…5be` |
| 5 | `downtrend-charts_4K-project.zip` | Remotion project with all 4 compositions at 4K | n/a | n/a |

Why each alternative was chosen:
- **Reference 1** already has a strong continuous camera move, so V2 changes the palette and keeps the motion.
- **Reference 2** has a locked-off camera, so V2 adds camera movement and keeps the palette.

## Technical checks

| Check | Comp1-V1 | Comp1-V2 | Comp2-V1 | Comp2-V2 |
|---|---|---|---|---|
| Render exit status / log errors | 0 / none | 0 / none | 0 / none | 0 / none |
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Container | MP4 | MP4 | MP4 | MP4 |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Pixel format | yuv420p | yuv420p | yuv420p | yuv420p |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames: header / decoded | 450 / 450 | 450 / 450 | 210 / 210 | 210 / 210 |
| Duration (reference) | 15.000 s (15.015 s)\* | 15.000 s (15.015 s)\* | 7.000 s (7.000 s) | 7.000 s (7.000 s) |
| Full decode with `-xerror` | no errors | no errors | no errors | no errors |
| Black frames (`blackdetect`) | none | none | none | none |
| Flicker: single-frame luma spikes > 4 | none | none | none | none |
| Pops: frame-to-frame luma jumps > 12 | none (max 1.25) | none (max 1.04) | none (max 0.61) | none (max 1.22) |
| Mean luma range (reference) | 24.7–70.1 (27.5–68.0) | 24.6–58.6 | 132.3–134.7 (134–138) | 128.2–132.8 |
| Geometry touching the frame edge, every frame | none\*\* | none\*\* | none | none |
| Audio | none (reference has none) | none | none | none |

\* **Comp 1 duration.** Reference 1 is 450 frames at 29.97 fps, which is 15.015 s. The brief requires 30 fps, and no whole number of 30 fps frames equals 15.015 s. The nearest is 450 frames (15.000 s): 15 ms short, under half a frame. It keeps the reference's exact frame count and frame-for-frame timing. Comp 2 matches its reference exactly.

\*\* **Comp 1 edge hits.** The red floor glow and its reflection reach the bottom and left edges, and bar 1's base is deliberately cropped by the bottom edge at f15–45. The reference shows both. No bar or arrow geometry is cropped otherwise.

## Project ZIP checks

- **Archive integrity:** `unzip -t` reports no errors. The archive has 24 files: the full source, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, the ESLint/Prettier configs, `README.md` and `LICENSE.md`.
- **Assets:** everything is procedural (geometry, textures, shaders, environment), so there are no external assets to go missing. `node_modules` and build output are excluded.
- **Composition settings:** all four compositions are registered at 3840×2160, 30 fps, with 450 / 450 / 210 / 210 frames.
- **Clean-room test,** run in a fresh directory:
  - `npm ci`: OK.
  - `npm run lint` (eslint + tsc): OK.
  - `npm run still:4k`: OK, four 3840×2160 PNGs.
  - `npm run render:4k:comp1-v1 -- --frames=400-429`: OK. 3840×2160 H.264, 30 fps, decodes cleanly. This segment includes the bloom pass.
  - `npm run render:4k:comp2-v1 -- --frames=0-29`: OK. 3840×2160 H.264, 30 fps, decodes cleanly.
  - `npm run render:comp2-v1`: OK, and the output is **bit-identical** (same SHA-256) to the delivered `Comp2-V1-Static_1080p.mp4`. Renders are deterministic and reproducible from the ZIP.
- **4K vs 1080p consistency:** bloom runs at a fixed 1080-line working resolution, so the glow looks the same at both. The final frame rendered at 4K and downscaled to 1080p matches the 1080p render at 48.8 dB PSNR.
- **GPU-less machines:** set `REMOTION_GL=swangle`, plus `REMOTION_BROWSER_EXECUTABLE` when offline. Both are documented in the README.

## Independent reference-match review

A separate review agent compared each render frame by frame against its reference. It used side-by-side frame sheets, luma measurements and an every-frame edge-crop test, and went through three rounds. Its findings were fixed between rounds:
- white blow-out on the last bars
- glow popping on as each bar appeared
- floor banding (fixed with a dither pass) and an over-dark floor
- bar 1, bar 2 and arrow timing
- an up-pointing arrowhead at the start
- tube-shaped ribbon and over-wide bars
- two frame-edge crops that appeared in round 2
- a shadow-frustum artefact in the Comp 2 orbit

| File | Final verdict | Score | V2 distinguishable and concept preserved? |
|---|---|---|---|
| Comp1-V1-Ember | PASS WITH NOTES | 7/10 | n/a |
| Comp1-V2-Glacier | PASS WITH NOTES | 7/10 | Yes: palette alternative, no blow-out |
| Comp2-V1-Static | PASS WITH NOTES | 8/10 | n/a |
| Comp2-V2-Orbit | PASS WITH NOTES | 8/10 | Yes: orbit alternative. Round 3 still found a faint backdrop sliver at f0–35. I traced it to the shadow-camera frustum edge, fixed it, re-rendered, and confirmed by inspection that it is gone. |

**Known remaining differences** (cosmetic, non-blocking):
- **Comp 1:** at the end, the chart fills somewhat less of the frame than the reference (about 20–74% of the width vs 9–83%), and a strip of black sky stays visible above the floor. The bars' body bloom is a little lighter, and the arrow is less glossy than the reference.
- **Comp 2:** the lighting is slightly flatter than the reference's soft key light.
- **Not reproduced:** the stock-photo watermark in both references.
