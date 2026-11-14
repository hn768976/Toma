# Quality-Control Report

Two Remotion 4.0.537 projects, each with two **3840 × 2160 (4K UHD)** compositions at 30 fps. All four are WebGL 2 fragment shaders. There are no image, video or audio assets, so no assets can go missing. Deliverables are rendered from the 4K compositions at `--scale=0.5` (1920 × 1080). The shaders run at native 4K internally, so the 1080p output is supersampled.

| # | Deliverable | Composition (4K) | Frames | Duration | Reference |
|---|---|---|---|---|---|
| 1 | `Composition1_SilkFlow_V1_Reference_1080p.mp4` | `SilkFlow-V1-Reference` | 600 | 20.000 s | 20.000 s |
| 2 | `Composition1_SilkFlow_V2_SunsetPalette_1080p.mp4` | `SilkFlow-V2-Sunset` | 600 | 20.000 s | 20.000 s |
| 3 | `Composition2_WarpTunnel_V1_Reference_1080p.mp4` | `WarpTunnel-V1-Reference` | 570 | 19.000 s | 19.000 s |
| 4 | `Composition2_WarpTunnel_V2_BankingOrbitCamera_1080p.mp4` | `WarpTunnel-V2-BankingOrbit` | 570 | 19.000 s | 19.000 s |
| 5 | `silk-flow-4k-project.zip`, `warp-tunnel-4k-project.zip` | complete projects | | | |

Checksums are in `SHA256SUMS.txt`.

## Technology choice
- **Composition 1 (Silk Flow): WebGL 2 shader.** The reference is soft, out-of-focus light. The shader builds it from domain-warped flow fields, per-channel chromatic dispersion (the prismatic fringes), thin filaments and a keyframed bloom.
- **Composition 2 (Warp Tunnel): WebGL 2 shader.** The reference is a hyperspace flight down a nebula tunnel. The shader maps the tunnel in polar/perspective space, adds fibrous nebula noise and lays stars out on an angle × log-radius grid so they accelerate outward with perspective.

## Version 2 choices
- **Composition 1 → different colour palette** (plum / magenta / coral, warm-gold bloom). The reference has no camera, so colour is its main expressive dimension. Motion, structure and timing are identical to V1.
- **Composition 2 → different camera movement** (banking figure-eight orbit with roll and a speed surge). A tunnel flight is defined by its camera, so a winding, banking path is the natural alternative. Palette and look are kept.

## Technical checks (all four videos): PASS
| Check | Result |
|---|---|
| Renders completed | 4/4. No render errors. ffmpeg full decode: 0 errors. |
| Duration | Exactly 20.000 s / 20.000 s / 19.000 s / 19.000 s, matching each reference. |
| Frame rate | Exactly 30/1 (r_frame_rate and avg_frame_rate). |
| Codec / resolution | H.264 High profile, 1920 × 1080, yuv420p, tagged BT.709 limited (tv) range. MP4 container. |
| Audio | None. The references have no audio either. |
| Black frames (`blackdetect`) | None. |
| Frozen sections (`freezedetect`) | None. |
| Flicker | No single-frame luma spikes. Largest frame-to-frame mean-luma jump: 0.97 / 0.97 / 1.64 / 3.23 (V4 jump is its camera sweep, smooth). |
| Corrupted frames / artifacts | None found. No visible banding (the shaders add sub-LSB dither), seams or macroblocking. |
| Loop (Comp. 1) | Seamless: first vs last frame PSNR is about 44.7 dB, the same as one normal frame step. |

## Project ZIP checks: PASS
Each ZIP was extracted into an empty directory and run there with the documented commands only:

| Step | silk-flow | warp-tunnel |
|---|---|---|
| `unzip -t` integrity | OK (20 entries) | OK (20 entries) |
| `npm ci` | OK (372 packages) | OK (372 packages) |
| `npm run lint` (eslint + tsc) | OK | OK |
| `npx remotion compositions` | 2 × 3840x2160, 30 fps, 600 frames | 2 × 3840x2160, 30 fps, 570 frames |
| `npm run render:v1` / `render:v2` (1080p) | OK | OK |
| `npm run render:v1:4k` / `render:v2:4k` | OK, 3840 × 2160 H.264 | OK, 3840 × 2160 H.264 |
| Clean-room frames vs delivered video (PSNR) | 55.7 / 56.3 dB | 49.9 / 49.8 dB |

Each ZIP contains the source (`src/`), shader code, `package.json` plus `package-lock.json` (pinned versions), `remotion.config.ts`, `tsconfig.json`, the ESLint/Prettier config and a README with the commands. `node_modules` and renders are excluded and get restored by `npm ci`. The PSNR results show the extracted projects reproduce the delivered videos: rendering is deterministic and frame-driven.

Note: the 4K renders were smoke-tested on the first 30 frames of each composition. Full 4K masters can be produced with `npm run render:v1:4k` / `render:v2:4k`.

## Visual review against the references
An independent reviewer agent compared each output with its reference. It used frame-matched side-by-side sheets, per-second luminance curves and full-resolution crops. Each composition went through several review → fix → re-render rounds.

| Version | First review | Final review | Final reviewer notes |
|---|---|---|---|
| Comp. 1 V1 | 5/10 | 6.5/10 | Palette (mean RGB 119/163/215 vs 115/164/209) and the 20 s brightness arc match. The bloom, fringes and timing were reworked after this review; final per-second luma tracks within about 10 of the reference. |
| Comp. 1 V2 | 7/10 | 7.5/10 | Clearly distinct palette; concept and motion preserved; exposure lifted after review. |
| Comp. 2 V1 | 5/10 | 6.5/10 | Core, palette, flares, speed and the brightness arc (peak at 8 s, dip at 10–12 s) match. Remaining gap: the reference's nebula is a denser, glittery haze; ours reads more as distinct streams. |
| Comp. 2 V2 | 7/10 | 7.5/10 | Camera move is clearly distinct and smooth (no stutter); concept and palette preserved. |

The final review found **no delivery blockers**. The remaining differences are stylistic, listed above. The "shutterstock" watermarks in the references were deliberately not reproduced.

## Rendering commands
```bash
cd silk-flow   # or warp-tunnel
npm ci
npm run render:all     # both 1080p deliverables into out/
npm run render:v1:4k   # full 4K master of V1 (likewise render:v2:4k)
```
