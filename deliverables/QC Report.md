# Quality-Control Report: Plexus Data Network and Digital Globe Network

Date: 2026-11-12. All checks were run on the final delivered files listed below.

## Deliverables

| # | File | Composition (4K source) | Frames | Duration | Size |
|---|------|------------------------|--------|----------|------|
| 1 | `Version 1 - Plexus Data Network - Reference Match (1080p).mp4` | `PlexusNetwork-V1-Reference` | 850 | 28.333 s | 29.8 MB |
| 2 | `Version 2 - Plexus Data Network - Amber Palette (1080p).mp4` | `PlexusNetwork-V2-AmberPalette` | 850 | 28.333 s | 28.9 MB |
| 3 | `Version 1 - Digital Globe Network - Reference Match (1080p).mp4` | `DigitalGlobe-V1-Reference` | 890 | 29.667 s | 81.0 MB |
| 4 | `Version 2 - Digital Globe Network - Orbit Camera (1080p).mp4` | `DigitalGlobe-V2-OrbitCamera` | 890 | 29.667 s | 89.0 MB |
| 5a | `Plexus Data Network - 4K Remotion Project.zip` | both plexus compositions, 3840x2160 | | | 0.1 MB |
| 5b | `Digital Globe Network - 4K Remotion Project.zip` | both globe compositions, 3840x2160 | | | 0.1 MB |

The ZIPs contain no `node_modules` folder. `npm ci` installs the exact pinned versions from the bundled `package-lock.json`.

## Technology chosen

- **Plexus Data Network:** Canvas 2D. The look is a 2D-composited lens effect: a 3D point and line network, per-element depth-of-field bokeh, soft strands and text readouts. Canvas 2D gives precise control of strokes and typography at 4K.
- **Digital Globe Network:** Three.js through @remotion/three, with custom WebGL 2 GLSL shaders. It is a true 3D subject with tens of thousands of points, Fresnel atmosphere, depth-of-field point sprites and analytic occlusion.

## Second versions

| Project | Alternative chosen | Why |
|---|---|---|
| Plexus | **Colour palette**: electric blue changed to molten amber/gold | The reference is a free-floating fly-through with no single subject, so its identity comes from light and colour. Geometry, camera and timing are unchanged, so the concept is preserved exactly. |
| Globe | **Camera angle and movement**: V1 starts with a defocused surface close-up and pulls back. V2 opens wide and low, below the ring plane, orbits about 110° while rising, and ends on a close, high-angle push-in onto the glowing limb. | The globe is a single strong subject, so a new orbit and angle reframe it most clearly. The palette and visual language stay intact. |

## Technical checks

The table below was produced with ffprobe and a full ffmpeg decode of every file.

| Check | Plexus V1 | Plexus V2 | Globe V1 | Globe V2 |
|---|---|---|---|---|
| Renders successfully | ✅ | ✅ | ✅ | ✅ |
| Codec | H.264 High, yuv420p | H.264 High, yuv420p | H.264 High, yuv420p | H.264 High, yuv420p |
| Resolution | 1920x1080 | 1920x1080 | 1920x1080 | 1920x1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames: render / reference | 850 / 850 ✅ | 850 / 850 ✅ | 890 / 890 ✅ | 890 / 890 ✅ |
| Duration: render / reference | 28.333 / 28.333 s ✅ | 28.333 / 28.333 s ✅ | 29.667 / 29.667 s ✅ | 29.667 / 29.667 s ✅ |
| Colour tags | bt709 | bt709 | bt709 | bt709 |
| Full-decode errors (corruption) | none | none | none | none |
| Black frames (blackdetect) | none | none | none | none |
| Flicker (alternating luma spikes) | 0 | 0 | 0 | 0 |
| Max frame-to-frame mean-luma change | 0.19 | 0.18 | 0.43 | 0.49 |
| Isolated single-frame pops (banded scan) | none | none | none | none (the frame-813 step is an intended arc launch) |
| Audio | none (reference has none) | none | none | none |

- **Pop detection method:** each frame was split into horizontal bands, and the scan looked for one-frame brightness steps that are not part of steady motion. A full-width line pop at 24.53 s and an edge label pop-in at 17.1 s were found during QC and fixed. They have been re-verified as gone, and the worst remaining isolated step is 0.35 luma levels.
- **Rendering pipeline:** each 4K composition renders natively at 3840x2160 (the canvas and WebGL buffer are full 4K) and is downsampled to 1080p at encode with `--scale=0.5`, which gives 2x2 supersampled anti-aliasing. Encoding is CRF 16.

## Project ZIP checks

| Check | Plexus ZIP | Globe ZIP |
|---|---|---|
| `unzip -t` integrity | ✅ no errors | ✅ no errors |
| Contains 4K compositions (3840x2160, 30 fps, exact frame counts) | ✅ `npx remotion compositions` lists V1 and V2 | ✅ lists V1 and V2 |
| Source, assets, configuration | `src/`, fonts and OFL licences in `public/fonts/`, `remotion.config.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, ESLint config, README | `src/`, `src/data/land-dots.json`, `scripts/generate-land-dots.mjs`, `remotion.config.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, ESLint config, README |
| Clean extract, then `npm ci` | ✅ 339 packages | ✅ 365 packages |
| `npm run lint` (ESLint and TypeScript) | ✅ 0 errors | ✅ 0 errors |
| Documented render command | ✅ `npm run render:v1`, full clip. Matches the delivered file at 53.7 dB PSNR. | ✅ `npm run render:v2` on frames 780–839. Matches the delivered file at 44.5 dB PSNR. |
| Native 4K still from the extracted project | ✅ 3840x2160 | ✅ 3840x2160 |
| Network needed at render time | none (fonts and land data are bundled) | none |

## Independent visual verification (separate review agents)

One agent per project compared each render with its reference frame by frame, using contact sheets, consecutive-frame strips, luma, colour and motion statistics, and tile-based pop scans. It reported defects, and the renders were revised and re-checked across several passes.

**Plexus**
- V1 match score went from 5 to 6 to 6.5 out of 10 over three passes.
- Fixed during review: network structure, depth-of-field strands, label styling and ticking values, code columns, grade and contrast, camera direction and speed, hard-edged ribbons, label overlaps, and two single-frame pops.
- Final pass: **no blocking issues and no pops**. V2 passes as clearly distinguishable by palette, with the same concept and quality.
- Remaining differences are stylistic: the reference has hotter highlights and denser star-shaped hubs.

**Globe**
- V1 match score went from 5 to 7 out of 10.
- Fixed during review: the hologram body is now see-through, land is a regular dot grid with orange coasts, the rim glow is soft with spikes, and the surface mesh, padlock halos and pins are present. Straight-line arcs were fixed with slerp. The camera roll, the second defocus around 6 s, rotation timing and globe size were corrected.
- Final pass: **no blocking issues** in either version, and no black frames, jumps or steps above 0.8 luma levels.
- **V1:** scored 7.5 out of 10.
- **V2:** scored 8 out of 10 as its own piece. Its camera is clearly distinguishable from V1 and the reference: no frame resembles V1, and the concept, palette and quality are preserved.
- **Frame 813 step in V2:** the brightness step flagged at frame 813 (27.1 s) is an orange data arc launching close to the camera. It is local and intended, not a flicker.
- **Remaining stylistic differences:** the intro is slightly brighter than the reference, the camera is a little closer at 6–10 s, and the reference has denser network lines around the globe.

## Integrity (SHA-256)

```
d27bcfa12371a6c379bd0d8166856533fadd93583a7eb48dac87995b96114930  Version 1 - Digital Globe Network - Reference Match (1080p).mp4
1e0a00e84586b39cf2a37127497a7eb09894986ded20035ae5d5fd394fa95865  Version 1 - Plexus Data Network - Reference Match (1080p).mp4
3e34555775787615fd597f48b76c28ef20d926b5d2acde200ec45f8fa94714c3  Version 2 - Digital Globe Network - Orbit Camera (1080p).mp4
59b03cacef0774b7574762aa50b6a09a6769abac30d3f967debfad920b7b52b0  Version 2 - Plexus Data Network - Amber Palette (1080p).mp4
4497f6da7ab2db259db0e5d802bced7f785b5ceebbc19ab7dec0c90553eeaf5f  Digital Globe Network - 4K Remotion Project.zip
b92a35d84dee802cfa17af9dca660c8e7279cb659d7308a58f29ef7f2342b093  Plexus Data Network - 4K Remotion Project.zip
```
