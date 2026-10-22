# Quality-control report

**Deliverables:** 4 × 1080p H.264 MP4 and 2 project ZIPs, each holding the two 4K compositions for one design.
**Source:** branch `ccr-5deb5101-u04li6` (folders `plasma-orb/` and `particle-waves/`).

## What was built

| # | File | Composition (4K master) | Approach |
|---|------|--------------------------|----------|
| 1 | `Comp1_V1_PlasmaOrb_1080p.mp4` | `PlasmaOrb-V1` | Matches reference 1: an orb of blue, violet and magenta plasma strands with a surge at the left edge (2.4–6.3 s) and light rays rising from the top |
| 2 | `Comp1_V2_PlasmaOrb_SolarGold_1080p.mp4` | `PlasmaOrb-V2` | Alternative **colour palette**: solar gold and amber, with geometry, timing and motion unchanged |
| 3 | `Comp2_V1_ParticleWaves_1080p.mp4` | `ParticleWaves-V1` | Matches reference 2: a teal particle cloth seen from close above, with folds, glowing creases and dissolving dust |
| 4 | `Comp2_V2_ParticleWaves_Flyover_1080p.mp4` | `ParticleWaves-V2` | Alternative **camera angle and movement**: a low flyover that travels forward on a banking S-curve toward a horizon fading into fog |
| 5 | `plasma-orb-remotion-4k.zip`, `particle-waves-remotion-4k.zip` | The 4K projects | Remotion 4.0.537 and Three.js 0.180 (WebGL 2, custom GLSL shaders, bloom) |

### Why these alternatives

- **Composition 1 uses a palette change.** The orb is a centred, symmetric subject, so a new camera angle would look almost identical. A new palette changes the look completely and leaves the structure and timing intact.
- **Composition 2 uses a camera change.** The reference is defined by its teal cloth, so I kept the colour. Moving from a hovering top-down close-up to a low, forward-travelling flyover gives the clearest contrast while keeping the concept.

## Technical checks (ffprobe / ffmpeg, all four MP4s)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Pixel format / colour | yuv420p, BT.709, TV range | same | same | same |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames (header / fully decoded) | 450 / 450 | 450 / 450 | 450 / 450 | 450 / 450 |
| Duration | 15.000 s | 15.000 s | 15.000 s | 15.000 s |
| Decode errors (full decode) | 0 | 0 | 0 | 0 |
| Black segments (blackdetect) | 0 | 0 | 0 | 0 |
| Frozen segments (freezedetect) | 0 | 0 | 0 | 0 |
| Mean luma (min–max) | 32.8 (31.6–35.8) | 48.0 (45.8–52.0) | 48.0 (45.8–52.1) | 55.5 (50.3–60.6) |
| Max frame-to-frame luma jump | 0.20 | 0.23 | 0.33 | 0.52 |
| Audio | none (reference has none) | none | none | none |

The luma range across each clip is narrow, and no frame-to-frame jump exceeds 0.52 of 255. That rules out flicker, popping or exposure jumps.

### Duration note (please read)

Both references are **15.015 s at 29.97 fps (450 frames)**. At exactly 30 fps, 15.015 s would be 450.45 frames, which cannot be encoded. Every output therefore keeps the reference's **exact 450-frame count**, which runs **15.000 s** at 30 fps (15 ms shorter, the unavoidable 29.97→30 difference). Timed events are placed by frame, so they line up with the reference frame for frame.

## Project ZIP checks

| Check | Result |
|---|---|
| `unzip -t` integrity | No errors in either archive |
| Contents | `src/` (all composition code and shaders), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint/Prettier config, `public/`, README with commands |
| Assets | Everything is procedural (noise fields, seeded PRNG); there are no external images, fonts or audio to go missing |
| 4K compositions present | `npx remotion compositions` in each extracted project lists V1 and V2 at **3840×2160, 30 fps, 450 frames** |
| Clean install | Extracted into an empty folder; `npm ci`: success, 0 vulnerabilities |
| Lint / typecheck | `npm run lint` (eslint + tsc): passes in both |
| Render from the extracted ZIP | 30-frame 4K renders (`PlasmaOrb-V2` and `ParticleWaves-V1`) output H.264 at 3840×2160, 30 fps, yuv420p |
| Determinism | Seeded PRNG and frame-based time only, so frames are reproducible and render in any order |

The documented commands are in each README and in `package.json`: `npm run render:v1` / `render:v2` (1080p, as delivered) and `render:v1:4k` / `render:v2:4k` (full 4K).

## Independent visual verification

A separate reviewer agent compared each render with its reference frame by frame. It used side-by-side grids every 1.5 s, close-ups of the surge every 0.4 s, consecutive-frame sequences, and colour and frame-difference statistics. There were two passes, and every issue from the first pass was fixed before the second.

| Video | Pass 1 | Pass 2 (final) | Defects found (final) |
|---|---|---|---|
| C1 V1 (match) | 6/10 | **7.5/10** | None blocking. The surge core clips to white for about 1 s at 3.4–4.4 s, as the effect intends. |
| C1 V2 (alt. palette) | 9 distinct / 8 concept | **8/10** | None blocking. A few gold highlights clip, as is typical for a hot palette. |
| C2 V1 (match) | 5/10 | **6/10** | None. |
| C2 V2 (alt. camera) | 8 distinct / 6 concept | **8.5/10** | None blocking. Some crests get very bright but do not clip hard. |

The reviewer reported no black, frozen, corrupted, flickering or popping frames, and no banding, in any video.

**Changes made after pass 1:**
- **C1:** filled the orb interior with magenta speckle and haze, changed the background to the reference's navy, rebuilt the surge (build-up at the left limb, then a wide band that slides down and fades by 6.3 s), softened the rim, and put the light rays on the reference's rhythm.
- **C2:** lit the whole sheet instead of only the crests, enlarged the dots, moved the camera closer and steeper, and added the glow along the left edge.
- **C2 V2:** turned it into a real forward-travelling flyover.

**Known remaining differences (not defects):**
- **C1 V1:** the reference has stronger vertical "curtain" filaments with more cyan. The recreation is a little more lavender and about 30% brighter on average.
- **C2 V1:** the reference's dot grid looks finer, with more crumpled folds and heavier depth of field. The recreation's folds are smoother and its motion is somewhat faster.

These are procedural recreations of stock footage, not frame copies. Each one reproduces the subject, framing, palette, motion character and key timed events.

## Integrity

`SHA256SUMS.txt` lists checksums for all six files.
