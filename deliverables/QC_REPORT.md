# QC report — Contour Maze (A) and Tile Wave (B)

## Deliverables

| File | Composition | Output | Frames | Duration |
|---|---|---|---|---|
| `A_ContourMaze_V1_1080p.mp4` | `ContourMaze-V1` (3840×2160) | H.264 High, yuv420p, 1920×1080, 30 fps, no audio | 400 | 13.333 s |
| `A_ContourMaze_V2_1080p.mp4` | `ContourMaze-V2` (3840×2160) | same | 400 | 13.333 s |
| `B_TileWave_V1_1080p.mp4` | `TileWave-V1` (3840×2160) | same | 267 | 8.900 s |
| `B_TileWave_V2_1080p.mp4` | `TileWave-V2` (3840×2160) | same | 267 | 8.900 s |
| `contour-maze_4K_remotion_project.zip` | both A compositions, source, config, lockfile, README | — | — | — |
| `tile-wave_4K_remotion_project.zip` | both B compositions, source, config, lockfile, README | — | — | — |

The 1080p videos are rendered from the 4K compositions with `--scale=0.5`.

**Duration note:** the references run at 29.97 fps (A: 400 frames, 13.347 s; B: 267 frames, 8.909 s). At exactly 30 fps the same frame counts last 13.333 s and 8.900 s. Every frame of the reference has a matching frame, and the difference is under half a frame.

## Technical checks

| Check | A V1 | A V2 | B V1 | B V2 |
|---|---|---|---|---|
| Renders without errors | pass | pass | pass | pass |
| H.264, 1920×1080, 30/1 fps, yuv420p | pass | pass | pass | pass |
| Frame count equals reference | 400 = 400 | 400 = 400 | 267 = 267 | 267 = 267 |
| Full decode, no errors | pass | pass | pass | pass |
| Black frames / frozen stretches (≥0.5 s) | none / none | none / none | none / none | none / none |
| Flicker (frame-to-frame luma jumps) | none (max Δ 0.50) | none (max Δ 0.57) | none (max Δ 1.28) | none (max Δ 1.73) |
| Audio streams (references are silent) | 0 | 0 | 0 | 0 |

These checks are automated by `qc/qc_videos.py`, which wraps ffprobe, a full ffmpeg decode, blackdetect, freezedetect and per-frame luma statistics.

**ZIP integrity:** `unzip -t` reports no errors for either archive. node_modules, out and dist are excluded.

**Clean-room test:** each ZIP was extracted into an empty directory. Then `npm ci`, `npm run lint` (eslint and tsc) and `npm run still:4k` were run; the still came out at 3840×2160. Next, `npm run render:v2 -- --frames=0-5` produced H.264 1920×1080 at 30 fps. Both projects passed every step. The test was repeated on the final ZIPs, and both projects passed again: `npm ci`, `npm run lint` and `npm run still:4k` (3840×2160), then `npm run render:v1 -- --frames=0-5`, which produced H.264 1920×1080 at 30/1 fps.

## Reference match (independent reviewer agents)

Each V1 was compared with its reference by a separate reviewer agent. The reviewer extracted matching frames, built side-by-side montages, and measured per-frame luma and motion. Scores across rework rounds:

- **A V1:** 4 → 3 → 4 → 4 → 4 → 4 → 4 → 5 → **5**
- **B V1:** 4 → 5 → 3 → 5 → 4 → 5 → **6**

**B V1, final review (6/10).**
- The open/close cycle matches the reference closely: mean-luma correlation is r = 0.993, the band-coverage curve is r = 0.988, and the best lag is 1 frame.
- Palette, band angle and diagonal layout match, and frames 0 and 266 loop.
- Remaining differences are the tile form and the closed state. The reference tiles are curled paper leaves with soft cast shadows; ours are flat plates, and the closed state shows fewer long diagonal streaks.

**A V1, final review (5/10).** The concept, palette family and camera angle match.
- **Brightness:** follows the reference across the shot (mean-luma correlation 0.98, RMS gap 2.5). Earlier renders dimmed while the reference brightens; an exposure ramp fixed this.
- **Motion:** similar overall (mean frame-to-frame change 3.3 against 3.6), though it settles a little earlier than the reference.
- **Remaining differences:** the core's shape, which is a rounded block that unrolls into a teardrop rather than the reference's broad lobed maze with crisp serpentine channels. Highlights in the core run hotter than the reference (about 10% of pixels clipped at frame 240, against 5%). The rings are flatter and darker, without the reference's gold haze.

### V2 alternatives

- **A V2: alternative colour palette.** The same scene and camera, but with deep-sea teal/cyan terrain, a rose-magenta core and gold light pulses.
  - The reviewer found it clearly distinguishable, with a coherent palette and no leftover orange. Score: 8/10 as a standalone shot.
  - No freezes, jumps, flicker or banding.
  - Minor: 0.3–0.7% of pixels clip on the hot core rims.
- **B V2: alternative camera angle and movement.** A low oblique tracking shot travels along the valley with a slow orbit, in the same palette and timing.
  - The reviewer found it clearly distinguishable from V1 and the reference, and still recognisably the same effect. Score: 7.5/10 as a standalone shot.
  - No freezes, flicker, gaps, grid edge, z-fighting or banding.
  - Minor: near-camera tiles show motion-blur ghosting at frame 90. Because the camera moves, the last frame doesn't loop back to the first.

## Defects found and fixed during QC

- **B V1 froze** (frozen stretches at 2.77–3.70 s and 7.17–8.10 s). Fixed by adding continuous slat sway, seam oscillation, a stronger floor bob and a breathing band edge.
- **B V1 timing** was about 24 frames late and closed with a snap. The open/close curve was re-fitted to the reference brightness curve; the timing correlation is now 0.993.
- **A V1 brightness** went the wrong way over the shot (down instead of up). Fixed with an exposure ramp that applies to V1 only.
- **A comb artifacts:** comb-like teeth where the short core walls end, caused by the ray march stepping too coarsely over the core. Fixed with quarter-size steps over the core only, with no change to render time. Both A videos were re-rendered.

## Known remaining gaps

- **A, core shape:** the core outline is a broad hook/teardrop rather than the reference's lobed serpentine maze. Matching it more closely would need a new core-field design, not parameter tuning.
- **A, core highlights:** the core runs hotter than the reference (more clipped pixels on the white rims).
- **A, frame 0:** faint 1–2 px serrations remain on a few vertical wall ends inside the core. They are visible only when zoomed in, and the rest of the shot is clean.
- **B:** tiles are thin plates with only a slight curl, without the reference's soft cast shadows. The closed state is sparser than the reference's long diagonal streaks.
- The references carry a faint stock watermark. It is deliberately not reproduced.

## How to rebuild

```bash
unzip tile-wave_4K_remotion_project.zip && cd tile-wave
npm ci
npm run render:v1      # out/TileWave-V1_1080p.mp4 (from the 4K comp, --scale=0.5)
npm run render:v1:4k   # 3840x2160 master
```

The contour-maze project works the same way. CPU-only rendering (SwiftShader) is slow; see each README for GPU flags and for splitting a render into frame ranges.
