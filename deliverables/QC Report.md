# QC Report — 4K Remotion Compositions

## Deliverables

| # | File | Composition (4K source) | Frames / duration | Reference |
|---|---|---|---|---|
| 1 | `Version 1 - Revenue Growth 3D Dashboard (1080p).mp4` | `RevenueGrowth-V1-Reference-4K` | 600 / 20.000 s | 600 / 20.000 s |
| 2 | `Version 2 - Revenue Growth 3D Dashboard - Amber Palette (1080p).mp4` | `RevenueGrowth-V2-AmberPalette-4K` | 600 / 20.000 s | 600 / 20.000 s |
| 3 | `Version 1 - Particle World Map Data Hologram (1080p).mp4` | `ParticleWorldMap-V1-Reference-4K` | 300 / 10.000 s | 300 / 10.000 s |
| 4 | `Version 2 - Particle World Map Data Hologram - Orbit Camera (1080p).mp4` | `ParticleWorldMap-V2-OrbitCamera-4K` | 300 / 10.000 s | 300 / 10.000 s |
| 5 | `Project - Revenue Growth 3D Dashboard (4K Remotion).zip` | both 4K compositions of 1 + 2 | — | — |
| 6 | `Project - Particle World Map Data Hologram (4K Remotion).zip` | both 4K compositions of 3 + 4 | — | — |

**Technology:** Remotion 4 (scaffolded with `npx create-video --three`), Three.js / WebGL 2, and custom WebGL 2 shaders for depth of field, bloom, anamorphic streaks and an ACES film grade. Canvas 2D is used for the panel artwork, and d3-geo with Natural Earth land data for the map. Each composition is native 3840×2160 at 30 fps. The 1080p files are rendered from the 4K compositions with `--scale=0.5`.

**Version 2 choices:**
- **Dashboard:** a different colour palette, "Amber Night". The dashboard's identity comes from its camera sweep, so the move was kept and the colours changed.
- **World map:** a different camera movement, a low-angle orbital crane. The reference camera is locked off, so a 3D move gives the clearest alternative.

## Technical checks (all four videos): PASS

These were checked with `qc/qc_videos.py`, which uses ffprobe/ffmpeg to count every frame and decode the full file.

| Check | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| H.264 (High), MP4, yuv420p | ✔ | ✔ | ✔ | ✔ |
| 1920×1080 | ✔ | ✔ | ✔ | ✔ |
| Exactly 30 fps (r and avg frame rate) | ✔ | ✔ | ✔ | ✔ |
| Frame count and duration identical to reference | ✔ | ✔ | ✔ | ✔ |
| Full decode, zero errors | ✔ | ✔ | ✔ | ✔ |
| No black frames (blackdetect) | ✔ | ✔ | ✔ | ✔ |
| No frozen frames (freezedetect) | ✔ | ✔ | ✔ | ✔ |
| No flicker or corrupted-frame spikes (per-frame luma and frame-difference scan) | ✔ max Δluma 0.10 | ✔ 0.10 | ✔ 0.42 | ✔ 0.66 |
| No local flashes or pops (`qc/popscan.py`: 16×9 grid, any area that jumps and returns within 1–3 frames) | ✔ 0 | ✔ 0 | ✔ 0 | ✔ see note¹ |
| Audio | none, same as reference | none | none | none |

## Project ZIPs: PASS

These were checked with `qc/package_and_verify.sh`, starting from a clean extraction of each ZIP:
- **ZIP integrity:** `unzip -t` reports no errors.
- **Contents:** `src/`, `public/` (bundled Inter font with its OFL licence), map data with its ISC licence, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint/Prettier configs and a README with commands. `node_modules` and renders are excluded.
- **Install:** `npm ci` succeeds, as does `npm run lint` (ESLint + TypeScript).
- **Compositions:** `npx remotion compositions` lists both compositions per project at 3840×2160, 30 fps, 600 or 300 frames.
- **Rendering:** every composition rendered a 4K still and a 4K H.264 clip with no errors.

The documented commands are `npm ci`, then `npm run render:v1:1080p`, `npm run render:v2:1080p`, `npm run render:v1:4k` and `npm run render:v2:4k`.

## Visual fidelity: independent agent review

A separate review agent compared each render with its reference at matching timestamps. It used side-by-side frames, a landmark overlay of the map geometry, phase correlation for camera motion, and brightness and per-frame statistics. I revised the work after each round.

| Video | Round 1 | Final | Verdict |
|---|---|---|---|
| 1. Dashboard V1 | 6/10 | **8/10** | Pass. Content, colours, curve and line timing, light bar and camera roll all match. Remaining: framing is slightly close and right-shifted in 0–7 s, a little extra roll at the very end, and the image is slightly darker. |
| 2. Dashboard V2 | pass | **pass** | Clearly distinct palette. Geometry, timing and camera are identical to V1 frame for frame. Clean. |
| 3. World Map V1 | 5/10 | **8/10** | Pass, no flashes or pops. Map geometry matches the reference within 1–2% of the frame (fitted perspective Mercator plus spline correction). Camera locked off. Brightness, highlights, early brightening and blue bar timing all match. The light structure was rebuilt to match the reference: a glossy floor of light at eye level, pillars and data shelves standing on it, bluish reflections below, crisp near detail, warm stacked dashes, amber specks, and rays down-left and down-right. Remaining: the structure's top surface is a little softer than the reference's, and the particle twinkle is about two-thirds as strong. |
| 4. World Map V2 | pass | **pass** | Clearly distinct, smooth orbital crane (no jerks; largest jump between neighbouring frames is 1.23×). Whole map is in frame at the end. Minor: a thin light line shimmers briefly at about 4.8 s (note¹), the beam's red end dot reaches the frame edge in the last second, and the map is cropped in the first 1–2 s. |

**Fixed during review:**
- **Dashboard:** framing and camera height, panel saturation, candle colours, yellow-line timing, curve end state, light bar visible from frame 0, exposure.
- **World map:** map tilt and Eurasia shape, camera drift, clipped highlights, beam length, blue bar timing, dark background shapes. After a second look at the reference, the light structure was rebuilt, and two flashes (frames 72–73 and 242–243) were found and fixed. Their cause was animated elements being hidden for about 2 frames, which changed the depth-of-field result for those frames.

¹ World Map V2 shows one 3.4-level dip at frames 142–145. It comes from a thin light column passing through focus at peak camera speed, not from anything switching on or off, and is low severity.

No watermark from the stock references was reproduced.
