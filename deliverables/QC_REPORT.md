# Quality-Control Report — Two 4K Remotion Compositions

Date: 2026-10-31

## Deliverables

| # | File | Content |
|---|------|---------|
| 1 | `Comp1-V1_LedWall_Reference_1080p.mp4` | Composition 1, Version 1: LED light wall, matches the reference |
| 2 | `Comp1-V2_LedWall_SunsetPalette_1080p.mp4` | Composition 1, Version 2: **different colour palette** (magenta → crimson → amber) |
| 3 | `Comp2-V1_PlanetSunrise_Reference_1080p.mp4` | Composition 2, Version 1: planet sunrise, matches the reference (locked-off camera) |
| 4 | `Comp2-V2_PlanetSunrise_CameraMove_1080p.mp4` | Composition 2, Version 2: **different camera movement** (push-in, Dutch-roll drift, rise over the horizon, with parallax) |
| 5a | `Comp1_LedLightWall_Remotion_4K_Project.zip` | Remotion project with both 3840×2160 compositions for Composition 1 |
| 5b | `Comp2_PlanetSunrise_Remotion_4K_Project.zip` | Remotion project with both 3840×2160 compositions for Composition 2 |

**Technology.** Both projects were created with the Remotion CLI (`npx create-video --blank`, Remotion 4.0.539). Each composition is a WebGL 2 fragment shader (GLSL ES 3.00) drawn into a 3840×2160 canvas. The shaders are fully procedural, so there are no external assets. Every frame is computed only from its frame number, so renders come out the same every time.

**Why each Version 2 changes what it does.**
- *Composition 1 (palette).* The reference is a flat, front-on LED wall used as a background loop. Its identity is the grid and the twinkle, so a palette change is the most natural variant.
- *Composition 2 (camera move).* The reference is a cinematic space shot, which benefits most from camera motion. The 1080p deliveries are rendered from the 4K compositions with `--scale=0.5`, which supersamples 4K down to 1080p.

## Technical checks (ffprobe/ffmpeg on the delivered files)

| Check | C1-V1 | C1-V2 | C2-V1 | C2-V2 | Result |
|---|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High | PASS |
| Container | MP4 | MP4 | MP4 | MP4 | PASS |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 | PASS |
| Frame rate (r / avg) | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 | PASS |
| Frames (counted by decoding) | 300 | 300 | 300 | 300 | PASS |
| Duration (stream / container) | 10.000 s | 10.000 s | 10.000 s | 10.000 s | PASS* |
| Pixel format | yuv420p | yuv420p | yuv420p | yuv420p | PASS |
| Full decode (`-xerror`) | no errors | no errors | no errors | no errors | PASS |
| Black frames (blackdetect) | none | none | none | none | PASS |
| Frozen frames (freezedetect) | none | none | none | none | PASS |
| Largest frame-to-frame mean-luma jump (reference) | 4.9 (8.1) | 5.2 (8.1) | 1.4 (1.9) | 1.9 (1.9) | PASS: no flicker spikes |
| Audio | none (reference has none) | none | none | none | N/A |
| Bitrate / size | 10.9 Mb/s, 13.7 MB | 10.9 Mb/s, 13.6 MB | 42.0 Mb/s, 52.5 MB | 42.1 Mb/s, 52.7 MB | — |

\* **Duration note.** Each reference clip is 300 frames at 29.97 fps, which is 10.010 s. At exactly 30 fps, 10.010 s would be 300.3 frames, which cannot be encoded. The frame count is therefore matched exactly (300), and the duration is 10.000 s, 10 ms (0.1%) shorter than the reference. Using 301 frames would have been 23 ms longer.

Composition 2 has the larger files because it reproduces the reference's film grain (CRF 14).

MD5 checksums:
- C1-V1 `eaea5ca23f8f17db616cfef0074a3f53`
- C1-V2 `6fc0f05596b4f68a7ad02a951a7a9ca8`
- C2-V1 `b37f54e48847dc4b1130b6d72aa2dd3e`
- C2-V2 `42361efea7df972562560d54c47cd647`

## Project ZIP checks

| Check | Comp1 ZIP | Comp2 ZIP |
|---|---|---|
| `unzip -t` integrity | No errors | No errors |
| Contents | `src/` (compositions, shader, GL renderer), `public/`, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`, `README.md` (21 entries) | same layout (21 entries) |
| Assets required | none (fully procedural) | none (fully procedural) |
| Extracted `src/` identical to the final source | yes | yes |
| `npm ci` from a clean extraction | OK (350 packages) | OK (350 packages) |
| `npm run lint` (ESLint + `tsc`) | pass | pass |
| `npx remotion compositions` | 2 compositions, 3840×2160, 30 fps, 300 frames | 2 compositions, 3840×2160, 30 fps, 300 frames |
| `npm run test:render` (documented smoke test) | renders, H.264, 30 fps | renders, H.264, 30 fps |
| Native 4K render from the extracted ZIP | 3840×2160 H.264 OK | 3840×2160 H.264 OK |
| MD5 | `050a19f34b374d14d6b66e6b34e82daa` | `d2872ae7673d368253bcd622067af7a3` |

The documented commands are in each project's `README.md`: `npm install`, `npm run dev`, `npm run render:v1:4k`, `npm run render:v2:4k`, `npm run render:v1:1080p`, `npm run render:v2:1080p`, `npm run render:all:1080p` and `npm run test:render`.

Each project renders on CPU with no GPU needed (SwiftShader). On a machine with a GPU, add `--gl=angle` to any render command for a large speed-up.

## Visual fidelity: independent reviewer agent

A separate reviewer agent compared each render with its reference. It did not see my working notes. It used side-by-side frames, mean/min/max-over-time images, slit-scans, region colour statistics and temporal correlation measurements. Its findings went into two improvement rounds for each composition, and every final video was re-reviewed.

| Composition | Round 1 | Final | Final verdict |
|---|---|---|---|
| C1-V1 LED wall | 6 / 10 | **8 / 10** | Matches in grid (19×10, exact row and column positions), overall colour (mean RGB 107/147/234 vs ref 103/144/231), halo size (5.6 vs 5.5 px), bloom between lamps (+38 vs +37), twinkle period (~27 vs ~25 frames, no directional chase), rays, static camera, and flicker (largest step 3.9 vs ref 7.0, 3-frame correlation 0.70 vs 0.64). No artifacts. |
| C1-V2 Sunset palette | Pass | Pass | Palette is clearly different. Layout and motion are the same as V1 (luma correlation 0.94), so the concept is kept. |
| C2-V1 Planet sunrise | 6 / 10 | **8 / 10** | Sun pulse correlates 0.997 with the reference. Whole-frame colour 48/95/100 vs 49/96/101, planet colour, grain (1.43 vs 1.61), ghost positions, sizes and colours, limb geometry and corners all match. No flicker, banding or artifacts. |
| C2-V2 Camera move | — | **Pass** | Clearly different: tilted horizon, sun drifts to centre, clear push-in. The move is smooth (motion deviation about 0.005 px/frame, no judder). Parallax and flare tracking are optically plausible. No edge reveals, flicker, black or frozen frames. |

**Known remaining differences (minor, reported by the reviewer).**
- *C1.* The top-right and right-middle are slightly lavender instead of pure cyan. Halos are a little crisper and less textured than the reference's cyan glow. Faint haze patches show at the lower left. Global flicker is a little calmer than the reference's.
- *C2.* Somewhat fewer stars than the reference, especially over the planet. The atmosphere rim is about 1.7× thinner at the frame edges. Faint rays remain above the sun, and the white core is slightly rounder.
- *C2-V2.* The frame brightens as the camera pushes in on the sun, as intended. The clipped area is 2% of the frame at the end.
- *Both.* The reference's "iStock / Getty Images" watermark is intentionally not reproduced.

## Summary

All four videos render successfully. Each is H.264 MP4 at 1920×1080, exactly 30 fps and 300 frames (10.000 s), and decodes with no errors. None has black frames, frozen frames, flicker spikes, seams or banding. Both project ZIPs pass integrity checks, contain the complete 4K compositions, source code and configuration, and install, lint and render from a clean extraction using the documented commands.
