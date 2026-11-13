# QC Report: Map Pins Drop and Glass Circuit Datacore

Two Remotion projects, each with two versions:
- Compositions are authored at 3840×2160 and 30 fps.
- Final videos are rendered from the 4K compositions with `--scale=0.5`, which supersamples 2×2 down to 1920×1080.
- Every final video is mastered to H.264 High, `yuv420p`, limited-range BT.709.
- Each project ZIP holds the complete 4K Remotion project.

## Deliverables

| File | Contents | SHA-256 (first 16) |
|---|---|---|
| `Version-1_Map-Pins-Drop_1080p.mp4` | Map V1: matches reference A | `cfcabe84ad0d3932` |
| `Version-2_Map-Pins-Drop-Night-Palette_1080p.mp4` | Map V2: night-mode palette, amber pins, neon highways | `cddfb25e58b0e09b` |
| `Version-1_Glass-Circuit-Datacore_1080p.mp4` | Circuit V1: matches reference B | `cd3413b9400254a4` |
| `Version-2_Glass-Circuit-Datacore-Crane-Orbit_1080p.mp4` | Circuit V2: crane-and-orbit camera with a rack focus | `446443644c4b2744` |
| `Map-Pins-Drop_Remotion-Project_4K.zip` | Map project: 4K compositions, source, lockfile, README | `143cd6ff6889bfa0` |
| `Glass-Circuit-Datacore_Remotion-Project_4K.zip` | Circuit project: 4K compositions, source, lockfile, README | `4a3d0f83fdb2986f` |

`sha256sum *.mp4 *.zip` gives the full hashes.

## 1. Technical checks (automated, `qc/qc_videos.py`)

| Video | Frames (ref) | Duration (ref) | FPS | Codec / pix_fmt | Size | Audio | Black | Frozen | Max luma step | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| Map V1 | 451 (451) | 15.033 s (15.033 s) | 30 | H.264 High / yuv420p | 1920×1080 | none (ref: none) | 0 | 0 | 0.28 | PASS |
| Map V2 | 451 (451) | 15.033 s (15.033 s) | 30 | H.264 High / yuv420p | 1920×1080 | none | 0 | 0 | 0.36 | PASS |
| Circuit V1 | 219 (219) | 7.300 s (7.300 s) | 30 | H.264 High / yuv420p | 1920×1080 | none (ref: none) | 0 | 0 | 5.37 (smooth ramp) | PASS |
| Circuit V2 | 219 (219) | 7.300 s (7.300 s) | 30 | H.264 High / yuv420p | 1920×1080 | none | 0 | 0 | 2.78 | PASS |

All four decode with no errors (`ffmpeg -v error` full decode). Neither reference has an audio track, so the deliverables have none either; there are no audio issues to report.

## 2. Fidelity and visual review (independent review agent)

A separate review agent compared each V1 frame by frame against its reference at matching timestamps, using side-by-side stills, full-resolution crops and per-frame luma, contrast and colour statistics. It also looked for artifacts: flicker, banding, aliasing, shimmer, and seams at render-chunk joins.

| Version | Score | Verdict | Notes |
|---|---|---|---|
| Map V1 | 8/10 | PASS | Map style, pin design, camera move and pin timing match reference A. |
| Map V2 | n/a | PASS (clearly distinct) | Same choreography in a night-navigation palette. |
| Circuit V1 | 8/10 | PASS (round 6) | Grade, composition, camera and brightness rhythm match reference B (per-frame brightness correlation 0.935). |
| Circuit V2 | n/a | PASS (clearly distinct) | A wide-lens crane-and-orbit (19° → 40° elevation, ~54° orbit) with a smooth rack focus. No V2 frame could be mistaken for V1. Same concept, grade and timeline. |

Remaining differences in Circuit V1 (none blocking):
- The 3–4 s flare is slightly hotter and more contrasty than the reference.
- The white stacks bloom, but they don't hard-clip the way the reference does.
- Overall motion is about 25% calmer.

Circuit V1 took six review rounds. Problems fixed along the way:
- panel layout;
- ground density;
- the core material;
- brightness timing;
- the glass body;
- out-of-focus specular streaks;
- stack glow.

Minor notes on Circuit V2 (none blocking):
- At 0–2 s the far background above the horizon falls off to pure black.
- From 5 s to the end, bright stacks sit along the left edge.

Artifact review (all versions):
- no flicker, banding, shimmer, corrupt frames or visible seams at the 30-frame chunk joins;
- no black frames.

## 3. Project ZIPs

| Check | Map | Circuit |
|---|---|---|
| `unzip -t` integrity | OK | OK |
| Contents | `package.json`, `package-lock.json`, `remotion.config.ts`, `src/`, `scripts/finalize.mjs`, README (no `node_modules` or `out`) | same |
| Clean-room: extract to an empty folder → `npm ci` | OK | OK (369 packages) |
| `npx remotion compositions` | 2 × 3840×2160, 30 fps, 451 frames | 2 × 3840×2160, 30 fps, 219 frames |
| 4K test render from the clean extract | OK: 3840×2160 H.264, 30 fps | OK: V1 and V2, 3840×2160 H.264, 30 fps |

## How to reproduce
```bash
unzip Glass-Circuit-Datacore_Remotion-Project_4K.zip && cd glass-circuit-datacore
npm ci
npm run render:all     # V1 + V2 at 1080p from the 4K comps, then finalize to out/final/
npm run render:v1:4k   # full 3840×2160 master
```
Rendering uses software WebGL by default (slow but portable). With a GPU, set `REMOTION_GL=angle`. Each README has the details.
