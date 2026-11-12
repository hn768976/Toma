# Quality-Control Report: Liquid Glitter Silk & Spiral Ribbon Vortex

Delivery date: 2026-11-12. Tools: Remotion 4.0.543 (CLI), with renders checked using ffprobe/ffmpeg and `qc/qc_check.py`.

## Deliverables

| # | File | Composition (4K source) | Technology |
|---|------|-------------------------|------------|
| 1 | `Version 1 - Liquid Glitter Silk.mp4` | `LiquidGlitterSilk-V1-Reference` | WebGL 2 fragment shader |
| 2 | `Version 2 - Liquid Glitter Silk (Aqua-Gold Palette).mp4` | `LiquidGlitterSilk-V2-AquaGold` | WebGL 2 fragment shader |
| 3 | `Version 1 - Spiral Ribbon Vortex.mp4` | `SpiralRibbonVortex-V1-Reference` | Three.js (React Three Fiber via @remotion/three) |
| 4 | `Version 2 - Spiral Ribbon Vortex (Orbit-Plunge Camera).mp4` | `SpiralRibbonVortex-V2-OrbitPlunge` | Three.js (React Three Fiber via @remotion/three) |
| 5 | `Project - Liquid Glitter Silk (4K Remotion, V1+V2).zip` | both Silk compositions, 3840×2160 | |
| 5 | `Project - Spiral Ribbon Vortex (4K Remotion, V1+V2).zip` | both Spiral compositions, 3840×2160 | |

Version 2 choices:
* **Silk V2 uses a different colour palette.** It is aqua/teal with molten gold. The reference's identity is its neon two-tone iridescent colour, so a palette swap keeps the material and motion while making the version clearly different.
* **Spiral V2 uses a different camera angle and movement.** It starts low and wide, orbits the hero coil and plunges down its throat with a barrel roll. The reference is about drifting through a swirl tunnel, so a camera move suits it best. The palette is kept.

## 1. Technical checks on the four MP4s

All checks were automated by `qc/qc_check.py`. Every file passes every check.

| Check | Silk V1 | Silk V2 | Spiral V1 | Spiral V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Pixel format / colour | yuv420p, BT.709 | yuv420p, BT.709 | yuv420p, BT.709 | yuv420p, BT.709 |
| Frame rate (r / avg) | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 |
| Frames (reference) | 240 (240) ✔ | 240 (240) ✔ | 270 (270) ✔ | 270 (270) ✔ |
| Duration | 8.000 s | 8.000 s | 9.000 s | 9.000 s |
| Full decode errors | none | none | none | none |
| Black frames (blackdetect) | none | none | none | none |
| Frozen segments (freezedetect) | none | none | none | none |
| Flicker: largest frame-to-frame luma jump | 1.33 | 1.26 | 0.22 | 0.22 |
| Corrupt-frame spikes (frame difference > 4× mean) | none | none | none | none |
| Audio | none (reference is silent) | none | none | none |
| Bitrate | 38.0 Mb/s | 38.5 Mb/s | 3.5 Mb/s | 3.6 Mb/s |

**Duration note.** The references run at 29.97 fps: 240 frames last 8.008 s and 270 frames last 9.009 s. At exactly 30 fps no whole number of frames can equal those durations, so each video keeps the reference's exact frame count. That gives 8.000 s and 9.000 s, which is 8 ms and 9 ms short (less than one frame). This is the closest possible match at 30 fps.

**Loop.** Reference B loops seamlessly from its last frame back to the first. Spiral V1 keeps that loop: the mean luma difference between its first and last frames is 0.67, lower than the reference's 1.38.

## 2. Comparison with the references (independent agent)

An independent agent compared each output with its reference. It looked at side-by-side frames each second, 1:1 crops, contrast-boosted crops, and per-frame luma, chroma and motion measurements. It made three passes, and each found problems that were fixed before the next.

| Pass | Main findings | Fixes |
|---|---|---|
| 1 | Silk: wrong rotation feel, flat exposure, streaky glitter, too little motion. Spiral: too far away, a straight "card" strip, hard-edged background planes, thin pinstripes. | Brightness arc, crisp crest highlights, round glitter, accelerating camera. Closer framing, broader pleats, gentler tail flare. |
| 2 | Spiral: dark shadow band inside the coil, sawtooth layer ends, too bright, orange on the wrong side, weak motion. | Removed the interior light that caused the band, tapered the layer ends, set exposure to match, moved the apricot flank to the right, push-in loop. |
| 3 | All four PASS WITH NOTES. Residual small sawtooth tips on the Spiral layer edges. | Layer edges made nearly coincident, which removes the spikes; added a soft sheen and a little more push-in. Re-rendered and re-checked (section 1). |

Final assessment:

* **Silk V1: 6.5/10, PASS WITH NOTES.**
  * Matches the reference: the lime/magenta-to-violet palette, the dim → bright lime → settle brightness arc (mean luma 97→164→126 vs 85→172→117), motion energy (4.4 vs 4.8) and counter-clockwise rotation, crisp crest highlights, round glitter and depth-of-field falloff.
  * Remaining difference: the folds read as layered parallel bands rather than one large draped fold.
* **Silk V2: PASS WITH NOTES.**
  * Clearly distinct (teal/gold) with the same concept and quality.
  * The gold leans slightly copper late in the clip.
* **Spiral V1: 7/10, PASS WITH NOTES.**
  * Matches the reference: scale and framing, exposure (mean luma 110 vs 110) and hue, apricot on the right of the hero coil, layered pleats, background depth of field, and the seamless push-in loop.
  * Remaining difference: the camera move is gentler than the reference's (frame-to-frame motion is roughly half).
* **Spiral V2: PASS WITH NOTES.**
  * Clearly distinct as a camera move, with the same palette and concept. It is a one-way move and does not loop.

Artifacts re-checked after the final fixes: no shadow band, no hard-edged planes, no hairline scratches, no flicker and no banding.

## 3. Project ZIPs

Each ZIP contains:
* the complete Remotion project with both 4K compositions (3840×2160, 30 fps)
* all source code in `src/`
* `package.json` and `package-lock.json` (pinned versions)
* `remotion.config.ts` (codec, CRF, colour space, GL backend)
* `tsconfig.json`, eslint and prettier configs
* a README with the commands
* `previews/` with native 4K stills of each version.

There are no external assets: everything is procedural. `node_modules`, `out/` and `dist/` are excluded, as is standard.

Integrity: `zip -T` passes on both archives.

Clean-room test: each ZIP was extracted into an empty folder, then `npm ci`, `npm run lint`, `npx remotion compositions`, `npm run render:v1`, `npm run render:v2` (first 30 frames) and `npm run still:v1` were run.

| Step | Liquid Glitter Silk | Spiral Ribbon Vortex |
|---|---|---|
| `npm ci` | ✔ 338 packages | ✔ 360 packages |
| `npm run lint` (eslint + tsc) | ✔ | ✔ |
| Compositions listed | ✔ V1 + V2, 3840×2160, 30 fps, 240 frames | ✔ V1 + V2, 3840×2160, 30 fps, 270 frames |
| `npm run render:v1` (full) | ✔ 240 frames, 1080p H.264 | ✔ 270 frames, 1080p H.264 |
| Re-render vs delivered MP4 | **PSNR = ∞ (pixel-identical)** | **PSNR = ∞ (pixel-identical)** |
| `npm run render:v2` (frames 0–29) | ✔ | ✔ |
| `npm run still:v1` (native 4K) | ✔ 3840×2160 | ✔ 3840×2160 |

Commands (also in each README):

```bash
npm ci                 # or npm install
npm run render:v1      # Version 1 -> out/…-1080p.mp4 (4K composition rendered at --scale=0.5)
npm run render:v2      # Version 2
npm run render:v1:4k   # full 3840x2160 render
npm run dev            # Remotion Studio
```

Rendering uses the `swangle` (CPU) GL backend so it works on any machine. On a machine with a GPU, add `--gl=angle` for much faster renders. Remotion downloads its own Chrome Headless Shell on first use; to use an existing browser instead, set `REMOTION_BROWSER_EXECUTABLE`.

## 4. SHA-256 checksums

```
08b6e45a20498f42ebaa2f6418f71ae112dc724de0768565f5fb2f38a528cdc5  Version 1 - Liquid Glitter Silk.mp4
5aa69019a98e764a862db93754b739d921f4723c4ef6f7dc83ec0f09f8f5b7a5  Version 2 - Liquid Glitter Silk (Aqua-Gold Palette).mp4
9d8251d6e0a15adae2f4334f24e4273aef73b90e50281b158842d63550aa1816  Version 1 - Spiral Ribbon Vortex.mp4
bd19e5e491d77294ad8158de5329ef27e865698823954bea9816470cccb59a7a  Version 2 - Spiral Ribbon Vortex (Orbit-Plunge Camera).mp4
31d6557a74d00f1ce6071cab39fa249f241e2f9df0db4428efdfa3af5f21f633  Project - Liquid Glitter Silk (4K Remotion, V1+V2).zip
981e6671ad0866b3d72449dcd130ad268c08f2c5655a265147fa57c0705c972d  Project - Spiral Ribbon Vortex (4K Remotion, V1+V2).zip
```
