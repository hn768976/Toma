# QC Report: Fiber Optic Data Cables & Server Room Flythrough

Date: 2026-11-13 (revised: fiber cable-overlap fix) · Toolchain: Remotion CLI 4.0.543, React 19, Three.js r181 (WebGL 2 + custom GLSL shaders)

## Deliverables

| # | File | Composition (4K source) | Frames / duration |
|---|------|-------------------------|-------------------|
| 1 | Version 1 - Fiber Optic Data Cables.mp4 | FiberOpticCables-V1-Reference | 301 / 10.033 s |
| 2 | Version 2 - Fiber Optic Data Cables - Amber Palette.mp4 | FiberOpticCables-V2-AmberPalette | 301 / 10.033 s |
| 3 | Version 1 - Server Room Flythrough.mp4 | ServerRoom-V1-Reference | 401 / 13.367 s |
| 4 | Version 2 - Server Room Flythrough - Low-Angle Crane.mp4 | ServerRoom-V2-LowAngleCrane | 401 / 13.367 s |
| 5 | Fiber Optic Data Cables - 4K Remotion Project.zip | Both fiber compositions, 3840×2160 | — |
| 6 | Server Room Flythrough - 4K Remotion Project.zip | Both server compositions, 3840×2160 | — |

All four compositions are authored at **3840×2160, 30 fps**. The MP4s are rendered from those 4K compositions with `--scale=0.5`, which renders natively at 1920×1080 rather than downscaling.

**Version 2 choices**
- **Fiber:** a different colour palette (amber/copper strands on a plum background instead of blue). The fiber reference is defined by its whip-pan camera move, so keeping that move and changing the palette preserves the concept while making V2 instantly distinguishable.
- **Server room:** a different camera angle and movement (low-angle crane rising from floor level, with yaw, pitch and roll and a FOV change, instead of a level dolly). The server room is visually defined by its blue-steel palette, so changing the camera move is the stronger alternative there.

## Technical checks (all four MP4s): PASS

| Check | Fiber V1 | Fiber V2 | Server V1 | Server V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Pixel format | yuv420p (BT.709, limited range) | ✓ | ✓ | ✓ |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frame count (decoded) | 301 ✓ | 301 ✓ | 401 ✓ | 401 ✓ |
| Duration (stream = container) | 10.033 s ✓ | 10.033 s ✓ | 13.367 s ✓ | 13.367 s ✓ |
| Matches reference length | ✓ exact | ✓ exact | ✓ exact | ✓ exact |
| Full decode errors | none | none | none | none |
| Black frames (blackdetect) | none | none | none | none |
| Frozen frames (freezedetect) | none | none | none | none |
| Max frame-to-frame luma jump | 4.6 | 5.6 | 1.6 | 1.1 |
| Luma jumps > 6 (flicker) | none | none | none | none |
| Audio | none (references are silent) | none | none | none |
| Bitrate | 20.8 Mb/s | 25.1 Mb/s | 30.6 Mb/s | 33.8 Mb/s |

**Methods**
- `ffprobe -count_frames` for stream and container metadata.
- `ffmpeg -v error -f null` full decode.
- `blackdetect`, `freezedetect`, and `signalstats` YAVG per frame for flicker and exposure stability.
- `tblend` difference curves for motion continuity. On the fiber whip, motion builds smoothly from frame 147, peaks around 180–188, and eases out to frame 200. After that a slow, continuous push-in follows, with no hard stop and no stutter.

**Mastering note.** Remotion writes full-range `yuvj420p`. Every file was re-encoded with ffmpeg to standard limited-range `yuv420p` (BT.709, CRF 14, `+faststart`) so it plays with correct levels in every player. The step is documented in each project as `npm run master`.

## Project ZIPs: PASS

Each ZIP was rebuilt from the committed sources and then tested from a **clean extraction** in an empty directory:

| Step | Fiber ZIP | Server ZIP |
|---|---|---|
| `zip -T` integrity | OK | OK |
| Contents | 21 files: src, config, package.json + lockfile, README, scripts | 20 files: same set |
| `npm ci` | OK (348 packages) | OK (348 packages) |
| `npx tsc --noEmit` | OK | OK |
| `npx remotion compositions` | 2 × 3840×2160, 30 fps, 301 frames | 2 × 3840×2160, 30 fps, 401 frames |
| 4K still, each composition | 3840×2160 ✓ | 3840×2160 ✓ |
| 4K H.264 test render (V1, 6 frames) | h264 3840×2160 30/1 ✓ | h264 3840×2160 30/1 ✓ |

- All visuals are procedural (geometry, shaders, PBR materials), so there are no external asset files that could go missing.
- `node_modules` and render outputs are excluded. Run `npm ci` to restore dependencies.
- Render commands are in each README, for example `npm run render:v1:4k`, `npm run render:v1:1080p` and `npm run render:all:1080p`.

## Reference-match verification (independent reviewer agent)

A separate reviewer agent compared frame grabs, motion and timing of each render against its reference, over several rounds. Each round's findings were fixed before the next.

1. **Round 1, fiber "no", server "mostly/no".**
   - Server: the camera was too fast and swaying, where the reference is a slow push toward a fixed end bank. There was haze, LEDs were dashes instead of dots, and the floor was striped.
   - Fiber: timing was late, strands were too thin, the RJ45 connector was too small, and there was a stray arching cable and blow-out.
   - All of these were fixed.
2. **Round 2, both "mostly".** Remaining issues: strand flicker at frames 211–215, cross-shaped streak artefacts, server speed, and a weak V2 crane move. All fixed (constant motion-blur sampling, slower push, stronger crane).
3. **Round 3, server clean.** One fiber blocker remained: a hard camera stop at about 7.15 s. Fixed by moving the whip onto an arc-length Catmull-Rom path with quintic ease-out, settling at 6.7 s and blending into a continuous push-in. The tblend motion curve above confirms the fix.
4. **Final round on the delivered files: no blocking issues.**
   - **Fiber V1: mostly.**
     - The hard stop is confirmed gone. Motion ramps smoothly into the whip, eases out over frames 189–200 and continues as a slow push-in.
     - Frames 186–230 show no popping or flicker.
     - Timing holds: strands at 1 s, cables at 4 s, RJ45 hero frame at about 6.7 s.
     - The remaining differences are stylistic: strands are slightly more curved and the ending is a little darker.
   - **Fiber V2: approved.** Clearly distinct, same concept.
   - **Server V1: mostly, close match.** Exposure, end-wall size and motion all match. The gantry beams are slightly subtler than in the reference.
   - **Server V2: approved.** Clearly distinct through the final frame, and the smoothest motion of the set.

## Revision: non-overlapping fiber cables

**Client feedback:** the cables in the fiber composition should not overlap.

**Cause:** the black cables started from scattered points around the bundle and curved towards their connectors, so they criss-crossed. Some connector cables also passed straight through other connectors.

**Fix (new file `src/fiber/layout.ts`):**
- Every black cable now runs straight out of the bundle's vanishing point, fanning outward as in the reference. Straight lines from one shared point can never cross in any perspective view, so no two cables cross in any frame.
- Each connector has its own angular slot around the vanishing point.
- Every cable and connector is tested as a screen-space capsule from the settle camera (6.7 s), the mid-hold camera and the closing camera (10 s), with a minimum gap of about 7 px at 1080p. Any background cable that would touch something else is dropped: 10 of 40 candidates are kept.
- During the fast camera swing (about 5–6.6 s) the cables are seen side-on, so some pass in front of others there. None of them cross.

**After the fix:**
- The automated layout check reports 0 connector conflicts.
- Both fiber versions were re-rendered, re-mastered and re-tested; all technical checks above pass.
- The largest brightness step (4.6 on V1, 5.6 on V2, at frame 178) is a gradual 5-frame rise as the fibres fill the frame mid-swing. It is not a single-frame flash.
- The server room videos and their ZIP are unchanged; the server ZIP is byte-identical.

## Consistency

- **Colour:** both versions of each project share one grade chain (ACES tone mapping, bloom, SMAA, vignette and grain), so V1 and V2 differ only in the intended dimension.
- **Determinism:** every render is deterministic (seeded RNG, frame-driven animation), so re-rendering any composition reproduces the delivered frames.
- **Exposure:** mean luma is stable across each clip (fiber 34–73, server 53–69 on a 0–255 scale). The only gradual changes are the intended ones, such as the fiber background deepening as the camera settles.

## Known limitations

- The renders use software WebGL (SwiftShader, `--gl=swangle`) for reproducibility in headless environments. On a machine with a GPU, `--gl=angle` renders faster with identical output intent.
- These are procedural recreations of the reference shots, not frame-exact copies. Composition, timing, camera motion, palette and lighting are matched; individual strand and cable placement is generated.

## SHA-256

```
47e2ce5edc45940727d15a536525253a023b6310dbaf91eedc6f5130ee69df90  Version 1 - Fiber Optic Data Cables.mp4
206741891d546af97a371d37d13e966f1eed841c19ef076601a6b3c52ca7ea0f  Version 2 - Fiber Optic Data Cables - Amber Palette.mp4
09b7888c069e1243b8b7478c588a1389d8308843e8571367b883aa10ddad7517  Version 1 - Server Room Flythrough.mp4
81c4608b003f48f17b34e63618e08cf4a616f0febae1055809b4d94eb19ed8da  Version 2 - Server Room Flythrough - Low-Angle Crane.mp4
cee2d385dc5e10be7e3401ae9fe280837590e4ded92668386a58dcaa2bf3a247  Fiber Optic Data Cables - 4K Remotion Project.zip
0b9cb900534cfc9a7ba38e3d8314467c1f85388c0357c751961b5845599cf066  Server Room Flythrough - 4K Remotion Project.zip
```
