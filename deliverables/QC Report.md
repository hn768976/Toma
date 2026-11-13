# Quality-Control Report

Two Remotion projects, each with two 4K (3840×2160) compositions, delivered as 1080p H.264 MP4.

| # | Deliverable | Composition (4K source) | Tech |
|---|---|---|---|
| 1 | Version 1 - Autonomous Radar Hologram (1080p).mp4 | `RadarHologram-V1` | Three.js + shader floor + bloom |
| 2 | Version 2 - Autonomous Radar Hologram - Orbit Camera (1080p).mp4 | `RadarHologram-V2` | same scene, different camera angle + movement |
| 3 | Version 1 - Minimal Clock Macro (1080p).mp4 | `ClockMacro-V1` | WebGL 2 fragment shader |
| 4 | Version 2 - Minimal Clock Macro - Midnight Gold (1080p).mp4 | `ClockMacro-V2` | same scene, different colour palette |
| 5 | autonomous-radar-hologram-4K-project.zip, minimal-clock-macro-4K-project.zip | both 4K comps each | Remotion 4.0.543 |

## Technical checks (ffprobe / ffmpeg, full decode of every file)

| Check | Radar V1 | Radar V2 | Clock V1 | Clock V2 |
|---|---|---|---|---|
| Codec / pixel format | H.264 High, yuv420p | H.264 High, yuv420p | H.264 High, yuv420p | H.264 High, yuv420p |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate | 30/1 | 30/1 | 30/1 | 30/1 |
| Frames / duration | 180 / 6.000 s | 180 / 6.000 s | 899 / 29.967 s | 899 / 29.967 s |
| Reference duration | 180 fr / 6.000 s | same | 749 fr @25 fps = 29.96 s | same |
| Decode errors | 0 | 0 | 0 | 0 |
| Black / blank frames | 0 | 0 | 0 | 0 |
| Audio | none (reference has none) | none | silent AAC (reference has a silent track) | silent AAC |

- Radar: duration matches the reference exactly (180 frames at 30 fps).
- Clock: the reference is 25 fps; 29.96 s is not a whole number of 30 fps frames (898.8), so the nearest whole frame count, 899 (29.967 s), is used — a 6.7 ms difference.
- Flicker scan (per-frame luminance and frame-difference series): no outliers. Radar V2 brightness varies smoothly once per second as the radar blade passes near the low camera (by design). The clock is intentionally still between second-hand ticks.

## Visual / timing checks

- Radar sweep: 1 revolution per 30 frames, same direction as the reference; rings emitted every 20 frames; road scroll loops seamlessly.
- Clock second hand: ticks once per second (measured every 30 frames), starts pointing down and ends pointing up after 30 ticks, as in the reference.
- Version 2 differences: radar uses a low orbiting crane camera instead of the locked-off chase view; clock uses champagne gold on midnight charcoal instead of frost blue/white. Geometry, timing and quality are otherwise identical to Version 1.

## Independent review

A separate reviewer agent compared all four videos with the references frame by frame. First pass verdict: all pass technically, with fidelity notes. Fixed and re-rendered after that review:

- Radar: sweep blade narrowed, darkened and given a finite radius; ring cadence and weight; lane-dash proportions; paler wireframes; partial-arc sensor fan; subtle camera drift; cleaner reflections; extra beam lines removed.
- Clock: second hand changed from a smooth sweep to a one-second tick, made a thin dark needle; chapter ring lightened with hour dashes only; markers given a metallic catch-light; silent audio track added.

The second review pass was done by the author (contact sheets + measurements), not by the independent agent.

Known remaining differences (inherent to a from-scratch procedural recreation of stock footage): vehicle models are simpler lofted wireframes rather than detailed CAD meshes; the radar blade is not occluded by vehicles; the clock has no blurred numerals on the chapter ring and a simpler hub. The stock watermark is intentionally not reproduced.

## Project ZIPs

- `unzip -t` integrity: no errors in either archive.
- Contents: `src/` (all source), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, eslint/prettier config, `README.md`. No external assets are required (everything is procedural); `node_modules` and renders are excluded.
- Clean-extract test for each ZIP: extracted to an empty folder → `npm install` → `npx remotion compositions` lists both comps at 3840×2160, 30 fps → native 4K render of the first 10 frames of each composition succeeded (H.264, 3840×2160, 30 fps). The delivered 1080p files were produced with the documented `npm run render` (4K composition at `--scale=0.5`).
- Not done: a full-length native 4K render of every composition (only 10–15 frame 4K segments were rendered as a check).
- `tsc` and `eslint` pass on both projects.

Note: rendering needs WebGL. The config uses the software backend on Linux and the GPU (`angle`) on macOS/Windows; see each README for the `--gl` override.
