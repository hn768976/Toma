# QC Report

Two Remotion projects, each with two 4K compositions (3840x2160, 30 fps), delivered as 1080p H.264 MP4.
All scenes are procedural WebGL 2 fragment shaders (no footage, images or model files; the stock watermark is not reproduced).

| # | Deliverable | Composition | What it is |
|---|---|---|---|
| 1 | `Version 1 - Water Droplets Hydrating Cracked Skin - 1080p.mp4` | `SkinHydration-V1` | Reference match |
| 2 | `Version 2 - Water Droplets Hydrating Cracked Skin - Golden Palette - 1080p.mp4` | `SkinHydration-V2` | Alternative colour palette (deep skin tone, golden-amber droplets, warm studio); camera and animation identical to V1 |
| 3 | `Version 1 - Serum Drop Repairing Cracked Skin - 1080p.mp4` | `SerumDrop-V1` | Reference match |
| 4 | `Version 2 - Serum Drop Repairing Cracked Skin - Orbit Camera - 1080p.mp4` | `SerumDrop-V2` | Alternative camera (orbiting crane: low side view, near top-down, low grazing end); colours and timing identical to V1 |
| 5 | `Project - Water Droplets Hydrating Cracked Skin - 4K Remotion.zip` | both `SkinHydration-*` | Source project |
| 6 | `Project - Serum Drop Repairing Cracked Skin - 4K Remotion.zip` | both `SerumDrop-*` | Source project |

Why these alternatives: the water-droplet reference is defined by its camera move (crane, pull-back, cross-section reveal), so its Version 2 keeps the move and changes the palette. The serum-drop reference has a simple frontal camera and a radial effect, so its Version 2 keeps the palette and changes the camera.

## 1. Video specifications (ffprobe + full decode of every file)

| Check | Water V1 | Water V2 | Serum V1 | Serum V2 |
|---|---|---|---|---|
| Codec / profile / pixel format | H.264 High, yuv420p | same | same | same |
| Container, colour space | MP4, BT.709 | same | same | same |
| Resolution | 1920x1080 | 1920x1080 | 1920x1080 | 1920x1080 |
| Frame rate (r / avg) | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 |
| Frames: reference / output / decoded | 251 / 251 / 251 | 251 / 251 / 251 | 301 / 301 / 301 | 301 / 301 / 301 |
| Duration: reference / output (s) | 8.366667 / 8.366667 | 8.366667 / 8.366667 | 10.033333 / 10.033333 | 10.033333 / 10.033333 |
| Audio streams (references have none) | 0 | 0 | 0 | 0 |
| Decode errors | none | none | none | none |
| File size | 21.3 MB | 35.1 MB | 40.3 MB | 46.7 MB |

Result: **pass** for all four. Durations and frame counts are identical to the respective references.

## 2. Frame-level checks (automated, every frame)

| Check | Water V1 | Water V2 | Serum V1 | Serum V2 |
|---|---|---|---|---|
| Black segments (ffmpeg blackdetect) | 0 | 0 | 0 | 0 |
| Darkest / brightest frame mean (0-255) | 207 / 224 | 115 / 144 | 187 / 207 | 186 / 213 |
| Largest frame-to-frame brightness step | 0.59 | 1.12 | 0.48 | 0.84 |
| Identical consecutive frames (stuck frames) | 0 | 0 | 0 | 0 |
| Single-frame glitches (frame differs from both neighbours) | 0 | 0 | 0 | 0 |

Result: **pass**. No black, corrupt, frozen or flickering frames. There is no audio in the references, so the outputs are video-only.

## 3. Project ZIPs

| Check | Result |
|---|---|
| `unzip -t` integrity | No errors in either ZIP |
| Contents | `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`, `README.md`, `public/`, `src/` (compositions, renderer, bake shader, scene shader, timeline, palettes) - 19 files each |
| Required assets | None: everything is generated procedurally at render time (`public/` is intentionally empty) |
| ZIP vs repository source | Byte-identical (`diff -r`) |
| 4K compositions | Both compositions in each project are registered at 3840x2160, 30 fps, 251 / 301 frames |
| Lint / type check (`eslint src && tsc`) | Clean in both projects |

## 4. Extract, install, render with the documented commands

Each ZIP was extracted into an empty directory, `npm ci` was run, and the README commands were executed there.

| Step | Water project | Serum project |
|---|---|---|
| `npm ci` | OK (338 packages) | OK (338 packages) |
| `npm run render:v1` (1080p, `--scale=0.5`) | OK - this output is deliverable 1 | OK - see note |
| `npm run render:v2` (1080p, `--scale=0.5`) | OK - this output is deliverable 2 | OK - this output is deliverable 4 |
| `npm run still:4k` (native 3840x2160 still) | OK, 3840x2160 | OK, 3840x2160 |
| Native 4K still of V2 | OK, 3840x2160 | OK, 3840x2160 |
| Native 4K video, 5 frames, V1 and V2 | OK, H.264 3840x2160 30 fps | OK, H.264 3840x2160 30 fps |

Notes:
- Serum V1 (deliverable 3) was rendered from the ZIP one commit before the final one. The only later change is Version 2's camera keys and a far-edge value that is unchanged for Version 1. A segment of V1 re-rendered from the final ZIP matches the delivered file (PSNR 44.9 dB between the two independent CRF-14 encodes).
- **Not done:** full-length native 4K renders. This machine has no GPU (software WebGL, about 9 s per 4K frame, about 40 minutes per video), so 4K was verified with stills and short clips of every composition instead. The 1080p deliverables are the same 4K compositions rendered at `--scale=0.5`.

## 5. Independent match verification (reviewer agents)

Separate reviewer agents compared the outputs with the references frame by frame (side-by-side sheets, event timelines, sampled colours, motion measurements). Each Version 1 went through several rounds; findings were fixed and re-rendered between rounds.

### Water Droplets - Version 1 (3 rounds)

| Round | Verdict | Technical quality |
|---|---|---|
| 1 | Partial match | 8/10 |
| 2 | Partial match (upper end) | 8/10 |
| 3 (final) | **Close match with minor differences** (low end of that band) - signed off "yes, with reservations" | 9/10 |

Final scores: sequence & timing 7, camera 6.5, colour/lighting 6.5, drop look 6, skin look 6.5, end reveal 6, technical 9.
Matches: same six drops landing on the same spots in the same order, landings within a few frames, tilt-down, pull-back and cross-section reveal present, cell layer enters within ~2 frames of the reference, last-frame layout matches, palette close.
Remaining differences the reviewer still lists as fixable: camera 12-15 degrees steeper mid-clip; cell layer more matte and darker-gapped than the reference's glossy packed cells; cracks thin out about 10 frames early; flattened drops lose their aqua body 10-20 frames early; far edge re-enters about 20 frames early; drops 5 and 6 enter about 22 frames late; healed-skin highlight flatter on the right half.

### Serum Drop - Version 1 (4 rounds)

| Round | Verdict | Technical quality |
|---|---|---|
| 1 | Partial match | 8/10 |
| 2 | Partial match (upper end) | 7/10 |
| 3 | Partial match (upper end) | 8/10 |
| 4 (final) | **Partial match (upper end) - the reviewer did not sign it off as "as close as possible"** | 8/10 |

Final scores: sequence & timing 8, camera 6.5, colour/lighting 7, drop look 5.5, skin look 5.5, crack glow & healing 6, technical 8.
Matches: same order of events; backdrop band leaves and re-enters within one frame of the reference; ground sweep in the first 40 frames within 2% of the reference; absorption complete at ~f138 (reference ~f136); centre clear ~f240-245 (reference ~f245); last glow ~f276 (reference ~f275); final band height 0.171 vs 0.169 of frame height; base skin colour within about 3 levels.
Remaining differences the reviewer lists as fixable: crack glow is thinner and covers 2-5x less area than the reference after frame 150; the melt runs 15-20 frames ahead between frames 46-80 and the dome/lens is more opaque; the pull-back after frame 57 has about one third of the reference's amplitude; the camera stops abruptly at frame 40 instead of easing out; micro-texture is finer and the final frame flatter than the reference.

### Inherent limits (both)

These are approximated, not reproduced: the exact crack layout (procedural), true refraction/caustics and sub-surface scattering, thick displaced flake/slab geometry, lens-flare stars. The references are offline 3D renders; the outputs are real-time shaders.

### Version 2 checks

| | Water V2 (Golden Palette) | Serum V2 (Orbit Camera) |
|---|---|---|
| Distinct from V1 | **Clearly distinct** - mean colour difference deltaE 27-37 per phase, drops cyan vs amber | See below |
| Concept and timing preserved | Yes - camera offset 0 px on all sampled frames, drop events frame-locked | See below |
| Quality on par with V1 | Yes - one minor note: cracks inside the golden halo read slightly olive | See below |

SERUM_V2_RESULT

## 6. Summary

- All four MP4s: H.264, 1920x1080, exactly 30 fps, frame count and duration identical to their references, video-only, no rendering or decoding defects found.
- Both ZIPs: intact, complete, install and render with the documented commands at 1080p and at native 4K.
- Match to reference: Water Droplets V1 is a close match with minor differences; Serum Drop V1 is a partial match at the upper end and was not signed off by the reviewer as the closest achievable. The specific open items are listed above.
