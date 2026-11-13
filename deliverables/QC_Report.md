# Quality-control report

There are two Remotion projects. Each has two 4K compositions (Version 1 matches the reference, Version 2 is the alternative). All four videos below were rendered from the 4K compositions and delivered at 1080p.

## Deliverables

| # | File | Source composition (4K) | Duration | Frames |
|---|------|-------------------------|----------|--------|
| 1 | `Version1_Particle-Collision_1080p.mp4` | `ParticleCollision-V1-4K` | 20.000 s | 600 |
| 2 | `Version2_Particle-Collision_Orbit-Camera_1080p.mp4` | `ParticleCollision-V2-4K` | 20.000 s | 600 |
| 3 | `Version1_HUD-Interface_1080p.mp4` | `HudInterface-V1-4K` | 30.000 s | 900 |
| 4 | `Version2_HUD-Interface_Amber-Palette_1080p.mp4` | `HudInterface-V2-4K` | 30.000 s | 900 |
| 5 | `Particle-Collision_Remotion-Project_4K.zip` | Both particle compositions | | |
| 5 | `HUD-Interface_Remotion-Project_4K.zip` | Both HUD compositions | | |

`SHA256SUMS.txt` lists the checksum of every file.

## Technology used

- **Particle collision**: Three.js with custom GLSL ES 3.00 (WebGL 2) shaders.
  - About 305k GPU-animated particles form the edge, comb-rung and fill layers.
  - Depth of field produces bokeh.
  - The image is rendered to a half-float HDR target, then goes through a box-downsampled bloom chain and a filmic tone map.
  - The HUD overlay is drawn with Canvas 2D.
- **HUD interface**: a WebGL 2 fragment shader draws the smoke (drifting cloud masses × domain-warped fBm). The interface is vector SVG, authored at 1920×1080 and scaled through the viewBox to a sharp 3840×2160.
- Both are Remotion 4.0.543 projects scaffolded with `npx create-video` (Remotion CLI). Every frame is a pure function of the frame number, with no hidden state.

## Technical checks (all four videos: PASS)

| Check | Particle V1 | Particle V2 | HUD V1 | HUD V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames (reference) | 600 (600) | 600 (600) | 900 (900) | 900 (900) |
| Duration (reference) | 20.000 s (20.000) | 20.000 s (20.000) | 30.000 s (30.000) | 30.000 s (30.000) |
| Pixel format / colour | yuv420p, BT.709, TV range | same | same | same |
| Full decode errors (`-xerror`) | none | none | none | none |
| Black frames (`blackdetect`) | none | none | none | none |
| Frozen segments > 1 s | none | none | none | none |
| Mean luma (min–max per frame) | 47.3 (42.7–51.1) | 47.3 (43.7–48.7) | 28.1 (24.0–32.2) | 27.6 (23.5–31.7) |
| Largest frame-to-frame luma change (flicker check) | 0.51 | 0.39 | 0.45 | 0.47 |
| Audio | none (the references have none) | none | none | none |
| Size / bitrate | 17.6 MB / 7.0 Mbps | 19.7 MB / 7.9 Mbps | 25.9 MB / 6.9 Mbps | 25.8 MB / 6.9 Mbps |

Reference luma for comparison, measured the same way: particle reference 36–56 (mean 45.4), HUD reference 18–28.

## Project ZIP checks

- `unzip -t` reports no errors in either archive.
- Each archive contains:
  - `src/` with both 4K compositions;
  - `public/fonts` with the font and its OFL licence;
  - `package.json` with render scripts, and `package-lock.json`;
  - `remotion.config.ts` (H.264, yuv420p, BT.709, CRF 16, WebGL renderer);
  - `tsconfig.json`, the ESLint config and a README with the commands.
- `node_modules`, `out` and `dist` are excluded.
- A clean-room test extracted each archive into an empty folder and ran:
  - `npm ci`: passed;
  - `npm run lint` (ESLint + `tsc`): passed;
  - `npm run render:v1` / `render:v2` on a 15-frame range: 1920×1080 H.264 at 30 fps, BT.709;
  - `npm run render:v1:4k` / `render:v2:4k` on a 10-frame range: 3840×2160 H.264 at 30 fps.
- Earlier, full-resolution 4K stills were rendered from both projects and checked for sharpness.
- Note: this sandbox can't download Remotion's headless Chrome, so the tests passed `--browser-executable` pointing at a local Chromium. On a normal machine Remotion downloads Chrome automatically on the first render.

## Independent visual verification

A separate agent compared each render against its reference frame by frame, using side-by-side sheets at 13–15 timestamps, consecutive-frame flicker checks and luma statistics. It made several passes, and I fixed the issues it raised before each re-render.

| Video | First pass | Final pass | Fixed after review |
|---|---|---|---|
| HUD V1 | 6/10 | **8/10** | Reticle size, path and exit; boot timing; missing elements (data blocks, rotated graph labels and data columns, curved cables, chart markers); reveal strobe; wispy smoke; roaming labels with collision fading |
| HUD V2 | n/a | **Pass** | Clearly distinguishable by palette; concept and quality kept; accent colour harmonised |
| Particle V1 | 5/10 | **7.5/10** | Striated comb-rung sheets, depth of field and bokeh, wedge-to-X opening, exposure and fade-up, smeared HUD text grouped on the left, bokeh orbs, standard colour range |
| Particle V2 | n/a | **7/10, passes brief** | Reverse-angle orbit distinguishable throughout, including 8–12 s; concept and quality kept; no artifacts |

The reviewer found no flicker, popping, corrupted or black frames, and no clipping, in the final files.

### Version 2 choices

- **Particle collision**: a different camera angle and movement. The scene is a 3D particle simulation, so the camera move shows the most new information: an approximately 80° reverse-angle orbit behind the collision, craning down from a high three-quarter view. The X reads mirrored and the ribbons sweep the other way. Palette and HUD stay the same.
- **HUD interface**: a different colour palette. The design is a flat screen interface, so a palette change suits it better than a camera move: an amber/red "alert" scheme with warm smoke, amber lines, hot-orange markers and ice-white data points. Layout and animation are the same.

### Known minor differences (optional polish, not defects)

- Particle V1: the highlights are about 15% hotter than the reference, and the opening is a slightly narrower fan.
- Particle V2: the crane move is subtle in the first ~4 s.
- HUD: the smoke averages slightly brighter than the reference, mostly because V1 has a denser interface. V2 differs from V1 only by palette, as chosen.
- The references' stock-photo watermark was deliberately not reproduced.
