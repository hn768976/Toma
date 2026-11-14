# Quality-control report

Two reference clips were recreated as procedural Remotion compositions
(Three.js on WebGL 2 with custom GLSL shaders, no external assets). Each
composition is a 3840x2160, 30 fps master with two versions; the delivered
videos are 1080p renders of those 4K compositions (`--scale=0.5`).

## Deliverables

| File | Composition | Size | Frames | Duration |
| --- | --- | --- | --- | --- |
| `Version 1 - Blood Cells Flow (1080p).mp4` | `BloodCells-V1` – reference match | 1920x1080 | 301 | 10.033 s |
| `Version 2 - Blood Cells Flow (1080p).mp4` | `BloodCells-V2` – alternative colour palette (cold indigo / cyan / violet) | 1920x1080 | 301 | 10.033 s |
| `Version 1 - Microchip Lead Frame (1080p).mp4` | `Microchips-V1` – reference match | 1920x1080 | 361 | 12.033 s |
| `Version 2 - Microchip Lead Frame (1080p).mp4` | `Microchips-V2` – alternative camera (top-down start, crane down, opposite orbit, no wipe) | 1920x1080 | 361 | 12.033 s |
| `Blood Cells Flow - Remotion Project (4K).zip` | both blood compositions, source, config, README | 71 kB | | |
| `Microchip Lead Frame - Remotion Project (4K).zip` | both microchip compositions, source, config, README | 76 kB | | |

Why these alternatives: the blood shot is defined by its camera ride, so the
second version keeps the move and changes the palette; the microchip shot is
defined by its metal-and-silicon look, so the second version keeps the look and
changes the camera move.

## Technical checks (all four videos)

Automated with ffprobe / ffmpeg over every frame: 64 of 64 checks passed.

| Check | Result |
| --- | --- |
| Renders completed without errors (no shader or browser errors in the logs) | Pass |
| Container / codec | MP4, H.264 High profile, yuv420p, BT.709 |
| Resolution | 1920x1080 on all four |
| Frame rate | exactly 30/1 (real and average) on all four |
| Duration vs reference | Blood: 10.0333 s vs 10.0333 s (exact). Microchips: 12.0333 s vs 12.04 s (see note 1) |
| Frame count | 301 / 301 / 361 / 361, all decoded |
| Full decode | no decode errors |
| Black frames | none |
| Frozen or duplicated frames | none |
| Flicker (luminance step that reverses) | none; largest frame-to-frame luminance step 1.2 / 1.3 / 4.2 / 1.1 levels |
| Glitch frames (isolated motion spikes) | none |
| Audio | no audio stream, matching the references (neither has audio) |
| ZIP integrity | CRC of every member verified |
| ZIP contents | source, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, README; no `node_modules` or build output |
| Compositions in the ZIPs | 3840x2160 at 30 fps |

## Project ZIP test

Each ZIP was extracted into an empty folder and run with the documented
commands:

| Step | Blood Cells Flow | Microchip Lead Frame |
| --- | --- | --- |
| `npm install` | Pass | Pass |
| `npm run lint` (ESLint + TypeScript) | Pass | Pass |
| Native 4K render of V1 (6 frames) | 3840x2160, H.264, 30 fps | 3840x2160, H.264, 30 fps |
| 1080p render of V2 (10 frames) | 1920x1080, H.264, 30 fps | 1920x1080, H.264, 30 fps |
| Zipped source equals the source the videos were rendered from | Yes | Yes |
| Frame rendered from the ZIP vs delivered video | matches (mean difference 0.36 of 255 levels, encoding only) | V2 stills pixel-identical |

The full-length videos were rendered at 1080p only. Native 4K was verified on
single frames and short frame ranges, not on a full-length 4K render (about
25–30 s per frame on this GPU-less machine, roughly 2–3 hours per video).

## Match against the references

Independent reviewer agents compared every video with its reference (side-by-
side frames at matching times, full-resolution crops, per-frame statistics).
Their findings were fed back into the compositions over several rounds; the
verdicts below are for the delivered files.

| Video | Verdict | Match | Main remaining differences |
| --- | --- | --- | --- |
| Blood Cells V1 | Pass | 7 / 10 | Vessel wall is softer and less fibrous; cells are smaller and more numerous near the glow; no motion blur on the fastest near cells |
| Blood Cells V2 | Pass with notes | – | Clearly distinct (mean hue about 231° vs 3°), same motion and timing. Note: frames 197–204, a few far cells pass behind a visibly darker wall rim |
| Microchips V1 | Pass with notes | 7.5 / 10 | Wipe is translucent panes plus a short defocus, not opaque foreground objects, and refocuses about 0.4 s later; metal is cleaner and less glossy; a 1-pixel hairline is visible between lead-frame units at 100% zoom |
| Microchips V2 | Pass | – | Clearly different move (elevation 80° to 21°, opposite orbit, wider start); same scene, materials and grade |

Measured against the references: blood motion energy 7.49 vs 7.67, median
luminance 21.4 vs 21.9, glow-path correlation about 0.9; microchip luminance
curve correlation 0.97.

Defects found during review and fixed before delivery: intersecting blood
cells, far cells cut by an invisible edge, the glow sliding out of frame, and a
two-frame focus snap after the microchip wipe.

## Notes

1. The microchip reference is 12.04 s at 25 fps. At the required 30 fps the
   closest whole-frame length is 361 frames = 12.033 s (6.7 ms shorter; 362
   frames would be 26.7 ms longer).
2. The stock watermark in the references is not reproduced.
3. Rendering uses Chrome's software WebGL on Linux without a GPU and the GPU
   elsewhere (see each README). In this sandbox Remotion could not download its
   own browser, so the tests used a pre-installed Chrome Headless Shell through
   `REMOTION_BROWSER_EXECUTABLE`; on a normal machine no variable is needed.

## SHA-256

```
eeb2b3d7ea3dc5b29d1ff23d51d53cc08eef9a90dc2b4704a87c0bbc8b755e2b  Version 1 - Blood Cells Flow (1080p).mp4
a162f88b0f558003872e376d4469c880c041f0c0e2aaf5c5dcf5e8826852d665  Version 2 - Blood Cells Flow (1080p).mp4
1e917394a997e3c15ea9bb1a8c81db5e608b7365327bf431c68b51b81cb60556  Version 1 - Microchip Lead Frame (1080p).mp4
087c00372fc1a85289f0e1b27ec96558a35992e0d1c0e46f724562cbbb7c939c  Version 2 - Microchip Lead Frame (1080p).mp4
51aab0c26224555d1d3f90db1e1c9ba49ba1392443aa2149e41337a7e811901a  Blood Cells Flow - Remotion Project (4K).zip
d4c8eb109ce7644274dd6f85dc1c820e6902db4c5cab55162f7b4f1428656985  Microchip Lead Frame - Remotion Project (4K).zip
```
