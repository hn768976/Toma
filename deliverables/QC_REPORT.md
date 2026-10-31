# Quality-Control Report — 2 Compositions × 2 Versions

Date: 2026-10-31 · Remotion 4.0.539 · Rendered headless (Chromium + SwiftShader WebGL 2)

## Deliverables

| # | File | Composition / version | Technology |
|---|------|-----------------------|------------|
| 1 | `Composition1_V1_EnergyBeam_1080p.mp4` | Energy beam — V1 (matches reference) | WebGL 2 fragment shader |
| 2 | `Composition1_V2_EnergyBeam_SolarAmber_1080p.mp4` | Energy beam — V2: **alternative colour palette** (solar amber → red-orange) | WebGL 2 fragment shader |
| 3 | `Composition2_V1_StageLights_1080p.mp4` | Stage lights — V1 (matches reference, locked-off camera) | Three.js (React Three Fiber) + custom GLSL |
| 4 | `Composition2_V2_StageLights_CraneArc_1080p.mp4` | Stage lights — V2: **alternative camera movement** (low-angle crane arc, ≈55° orbit with rise and push-in) | Three.js (React Three Fiber) + custom GLSL |
| 5 | `Composition1_EnergyBeam_4K_Project.zip`, `Composition2_StageLights_4K_Project.zip` | Remotion projects with both 4K (3840×2160) compositions each | — |
| — | `SHA256SUMS.txt` | Integrity checksums for all files | — |

**Why these alternatives:** the energy beam is a single, centred, symmetric element, so a camera move adds little; a new palette changes its whole character while keeping the pulse. The stage rig is a genuinely 3D scene, so a camera move shows its depth and parallax and suits it best.

## Technical checks

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Render completed (exit 0) | ✅ | ✅ | ✅ | ✅ |
| Codec | H.264 High, yuv420p | H.264 High, yuv420p | H.264 High, yuv420p | H.264 High, yuv420p |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames / duration | 673 / 22.433 s | 673 / 22.433 s | 300 / 10.000 s | 300 / 10.000 s |
| Reference duration | 22.417 s | 22.417 s | 10.010 s | 10.010 s |
| Full decode (`ffmpeg -f null`) | no errors | no errors | no errors | no errors |
| Audio | none (reference has none) | none | none | none |
| Corrupted / frozen frames | none | none | none | none |
| Unintended black frames | none¹ | none¹ | none (0 dark frames) | none (≤3 % dark pixels in any frame) |
| Single-frame glitch / flicker scan | none² | none² | none | none (max spike 0.37) |
| Mean luma vs reference | 16.4 vs 17.7 | 16.2 (recolour) | 65.9 vs 65.7 | 68.0 vs 65.7 |
| Pulse timing vs reference (luma-curve correlation) | 0.968, no drift | 0.969 | n/a (loop) | n/a |

¹ The reference goes dark for ~0.13 s at the end of every 1.125 s pulse; the renders reproduce this (~4 frames/pulse at 30 fps), so these frames are intended.
² Only the intended single-frame white pre-flash appears as a spike.

**Duration note:** an exact match is impossible at an integer frame count. 22.4167 s × 30 fps = 672.5 frames, so the closest that does not cut content is 673 frames (+0.017 s, half a frame). The reference for comp 2 is 300 frames at 29.97 fps, so 300 frames at 30 fps (−0.010 s) is the nearest.

## Project ZIP checks

Each ZIP was extracted into an empty folder, and the following steps were run there:

- **Contents match the repo:** `src` is identical to the repo. Each ZIP holds `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, the ESLint/Prettier config and a `README.md` with commands.
- **No external assets needed:** everything is procedural.
- **Dependencies install:** `npm ci` succeeded.
- **Compositions are 4K:** `npx remotion compositions` lists two 3840×2160 / 30 fps compositions per project.
- **4K render works:** `npx remotion render <id>` produced a 3840×2160 H.264 file.
- **1080p render works:** `npx remotion render <id> --scale=0.5` produced a 1920×1080 H.264 file. This is the exact command used for the deliverables.
- **Code checks pass:** `npm run lint` (ESLint and `tsc`) is clean for both projects.
- **Archives are intact:** `unzip -t` reports no errors.

On machines without a GPU, add `--gl=swangle`. If Chrome cannot be downloaded, add `--browser-executable=…`. The READMEs cover both.

## Visual QA (independent review agent, 3 rounds)

An independent agent compared each render against its reference using side-by-side contact sheets and numeric analysis.

**Round 1 findings, all fixed before final delivery:**
- **Comp 1:** the decay tail collapsed early, the dark gap was too long, the flare was a flat wash, and the filaments were too straight. There was also banding in the glow.
- **Comp 2:** V2 had a one-frame near-plane glitch at frame 121. The haze was blotchy, the split beams were too brief, the fixture halos were white, and the right-hand fixture was too dim.

**Final round results:**

| Video | Score | Verdict |
|---|---|---|
| C1 V1 | 8/10 | Matches reference A closely in timing, colour and structure. Tail, dark gap and banding are fixed. |
| C1 V2 | 8/10 | Clearly distinct palette at the same quality and identical timing. |
| C2 V1 | 7/10 | Same layout, colour cycle and sweeps as reference B, with no artifacts. Overall brightness and colour match. |
| C2 V2 | 7/10 | A smooth crane arc, clearly distinct from V1 at the same quality. The frame-121 glitch is fixed. |

**Remaining stylistic differences (not defects):**
- **Comp 1:** flare rays are slightly crisper and steeper than the reference's broad fan. In about 1 of 4 pulses the pre-flash lasts 2 frames, because of the 30 fps sampling of a 33.75-frame cycle.
- **Comp 2:** the look is a little softer and less saturated than the reference. The two-colour split beams and the halo tints are subtler than in the reference.
