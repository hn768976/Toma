# Quality-control report

**Deliverables:** 4 × 1080p MP4 and 2 × project ZIPs (4K Remotion compositions)
**Date:** 2026-10-23

## 1. What was delivered

| # | File | Composition (4K source) | Technology |
|---|------|------------------------|------------|
| 1 | `Composition1_V1_1080p.mp4` | `ClockSpiral-V1-4K`: matches reference 1 (sepia clock spiral) | WebGL 2 shaders + Canvas 2D |
| 2 | `Composition1_V2_1080p.mp4` | `ClockSpiral-V2-4K`: alternative **colour palette** (moonlit silver / ice blue) | WebGL 2 shaders + Canvas 2D |
| 3 | `Composition2_V1_1080p.mp4` | `CpuCircuit-V1-4K`: matches reference 2 (CPU and circuit lights, 3 framings joined by whip moves) | Three.js (WebGL 2) + GLSL |
| 4 | `Composition2_V2_1080p.mp4` | `CpuCircuit-V2-4K`: alternative **camera movement** (one continuous crane-down and orbit move) | Three.js (WebGL 2) + GLSL |
| 5 | `Composition1_ClockSpiral_4K_RemotionProject.zip` | Project for #1 and #2 | Remotion 4.0.538 |
| 5 | `Composition2_CpuCircuit_4K_RemotionProject.zip` | Project for #3 and #4 | Remotion 4.0.538 |

Every visual is generated procedurally from fixed seeds. There are no external images, fonts, video or audio, so there are no assets to go missing and every render is deterministic.

Why each V2 change was chosen:
- **Composition 1 → colour palette.** The clock spiral's identity is its motion and form, and its look is defined by colour. The camera is locked to the spiral's eye, so a new angle would break the infinite-tunnel concept, while a new palette keeps it intact.
- **Composition 2 → camera movement.** The CPU scene is a 3D macro set whose gold-and-cyan palette is its signature. A new camera path shows the same scene in a clearly different way.

## 2. Technical checks (ffprobe / ffmpeg)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 |
| Frames / duration | 431 / 14.367 s | 431 / 14.367 s | 361 / 12.033 s | 361 / 12.033 s |
| Reference duration | 14.381 s | 14.381 s | 12.040 s | 12.040 s |
| Pixel format / colour | yuv420p, BT.709 limited range | same | same | same |
| Decode errors (full decode) | 0 | 0 | 0 | 0 |
| Black segments (blackdetect) | 0 | 0 | 0 | 0 |
| Frozen segments ≥ 0.5 s (freezedetect) | 0 | 0 | 0 | 0 |
| Audio | none (references have no audio) | none | none | none |
| Mean luma, this video (reference) | 62.3 (60.4) | 62.8 | 56.9 (55.8) | 51.9 |
| Largest frame-to-frame luma step | 0.75 | 0.74 | 1.51 (during a whip) | 0.97 |
| Flicker reversals (luma up/down > 3 levels) | 0 | 0 | 0 | 0 |

**About duration.** At exactly 30 fps a video can only last a whole number of frames, so 14.381 s and 12.040 s cannot be hit exactly. Each composition uses the nearest whole-frame length:
- 431 frames = 14.367 s, 14 ms short of the reference.
- 361 frames = 12.033 s, 7 ms short of the reference.

Both differences are under half a frame (16.7 ms).

## 3. Project ZIP checks

- Both ZIPs pass `unzip -t` with no errors.
- Each contains `src/` (all composition code and shaders), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, the ESLint and Prettier configs, `.gitignore`, `public/` and a `README.md` with the commands. `node_modules` and renders are excluded.
- Clean-room test: both ZIPs were extracted into an empty folder, then the documented commands were run.
  - `npm ci`: OK.
  - `npm run lint` (ESLint and TypeScript): 0 errors.
  - `npx remotion compositions` lists all four as **3840×2160, 30 fps**, with 431 and 361 frames.
  - `npx remotion render <id> …` produced valid **3840×2160 H.264** files from both extracted projects.
- The 1080p deliverables are those 4K compositions rendered with `--scale=0.5`, which are the `npm run render:vN:1080p` scripts.

## 4. Visual verification (independent review agent)

Separate review agents compared each render with its reference frame by frame, using side-by-side tiles, motion strips and per-frame luma and difference curves. There were three review rounds, and their findings were applied before the final renders:
- **Round 1:**
  - Composition 1 was too dark, the spiral grew too fast and the trough was too smooth.
  - In Composition 2 the shot angles needed re-blocking. The scene was too dark, the lights formed a "curtain" rather than beads along the traces, and the camera eased into a stop before the whips.
- **Round 2:** the outer ribbon needed to fill the frame, the lens needed more character (edge defocus and fringing), and the brightness needed matching.

Final review verdicts and notes:

| Video | Verdict | Notes |
|---|---|---|
| C1 V1 | PASS-WITH-NOTES | Palette, numerals, hands and motion timing match. After the final review, brightness was matched to the reference (62 vs 60), the outer ribbon now fills the frame, and edge defocus and fringe were added. |
| C1 V2 | PASS-WITH-NOTES | Identical spiral and motion re-graded to silver / ice blue. Clearly distinguishable, consistent grade, no banding. Reviewer noted dial highlights near clipping; exposure was lowered afterwards along with V1. |
| C2 V1 | PASS-WITH-NOTES | Whips land at 5.0 s and 8.4 s (reference: 5.04 s and 8.36 s). Palette, lands, bokeh and depth of field match. Section framings are close but not identical: it is a procedural scene, not a copy. |
| C2 V2 | PASS-WITH-NOTES | One continuous move from a high three-quarter view, craning down and orbiting into a grazing glide. Clearly different from V1 with the same look and quality. Reviewer noted the last ~4 s is a slow, very shallow-focus low shot with large foreground bokeh, where the chip becomes a thin strip at the top. This was left as a stylistic choice. |

No artifacts were found in any video: no seams, aliasing shimmer, popping, banding, corrupt frames or abrupt jumps.

## 5. File checksums (MD5)

See `checksums.md5` in this folder (`md5sum -c checksums.md5`).
