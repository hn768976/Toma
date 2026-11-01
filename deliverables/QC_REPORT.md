# QC Report: Crack Glow and Smoke Portal

All four videos render, pass every technical check, and come with tested 4K project ZIPs. On fidelity to the references, the alternative versions are strong (8/10). The two reference-matching versions are moderate (CrackGlow V1 6/10, SmokePortal V1 5/10); see *Independent visual review*.

## Deliverables

| # | File | Composition (4K source) | Version |
|---|------|-------------------------|---------|
| 1 | `CrackGlowV1_1080p.mp4` | `crack-glow` → `CrackGlowV1` | V1: matches reference A |
| 2 | `CrackGlowV2_1080p.mp4` | `crack-glow` → `CrackGlowV2` | V2: alternative **color palette** (cool blue/cyan/mint) |
| 3 | `SmokePortalV1_1080p.mp4` | `smoke-portal` → `SmokePortalV1` | V1: matches reference B |
| 4 | `SmokePortalV2_1080p.mp4` | `smoke-portal` → `SmokePortalV2` | V2: alternative **camera movement** (dolly-in, roll, depth parallax) |
| 5 | `crack-glow-4k-project.zip`, `smoke-portal-4k-project.zip` | Remotion projects with both 4K compositions each | — |

**Technology:** Remotion 4.0.539 (scaffolded with `create-video --blank`) and a raw **WebGL 2 fragment shader** per composition.

- Crack Glow uses a Voronoi fracture with a perspective camera.
- Smoke Portal uses domain-warped noise smoke.
- Both are fully procedural: no external assets, deterministic per frame.

**How the 1080p files were made:** each composition is 3840×2160. The 1080p files were rendered with `npx remotion render <id> <out> --scale=0.5`, so the shader draws at full 4K and Chromium downsamples it 2×. This is the same command documented in each project README.

## Automated technical checks (ffprobe / ffmpeg)

| Check | CrackGlow V1 | CrackGlow V2 | SmokePortal V1 | SmokePortal V2 |
|---|---|---|---|---|
| Renders without error | ✅ | ✅ | ✅ | ✅ |
| Codec | H.264 High, yuv420p | ✅ same | ✅ same | ✅ same |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames (reference) | 182 (182) | 182 (182) | 301 (301) | 301 (301) |
| Duration (reference) | 6.067 s (6.073 s) | 6.067 s | 10.033 s (10.043 s) | 10.033 s |
| Full decode, `-xerror` | no errors | no errors | no errors | no errors |
| Audio | none (reference has none) | none | none | none |
| Frames with no visible content | none (min peak luma 134) | none (143) | none (frame 0 is a dark pre-ignition frame, as in the reference) | none (frame 0 as V1) |
| Largest frame-to-frame luma jump (reference) | 1.51 (0.49) | 1.79 | 6.47 (9.22) | 5.94 |
| Flicker (alternating luma spikes > 3) | 0 | 0 | 0 | 0 |

### Duration note

The references are 29.97 fps (30000/1001). The deliverables are exactly 30 fps, as requested, so an exact length match is impossible. I matched the **frame count** exactly instead: 182 and 301 frames. The resulting durations are 6 ms and 10 ms shorter than the references, which is under a third of a frame.

### Black-frame note

Crack Glow has dark rest phases at the end of each pulse, just as the reference does. A strict `blackdetect` (98 % of pixels below 6 %) flags them. The reference escapes the detector only because of its bright watermark. Every frame still has visible content: rim-lit shard edges reach peak luma of at least 134.

## Project ZIP checks

Each ZIP contains:
- `package.json` and `package-lock.json` with pinned versions
- `remotion.config.ts` (H.264, yuv420p, CRF 16, WebGL backend)
- `tsconfig.json` and the ESLint / Prettier configs
- `README.md` with documented commands
- the full `src/` folder: Root with both 4K compositions, the shader component and the GLSL shaders

There are no external assets; everything is procedural.

Verified from a fresh extraction into an empty folder:
- ✅ `unzip -t`: no errors.
- ✅ The extracted sources are byte-identical to the repository (`diff -r`).
- ✅ `npm ci` installs 350 packages.
- ✅ `npm run lint` (ESLint and `tsc`) is clean.
- ✅ `npx remotion still <V1> --frame=N` gives 3840×2160 PNGs.
- ✅ `npx remotion render <V2> --frames=…` gives 3840×2160 H.264 at 30 fps.
- ✅ `npx remotion render <V1> --scale=0.5 --frames=…` gives 1920×1080 H.264 at 30 fps.
- ✅ Determinism: a re-render from the extracted ZIP matches the delivered Crack Glow file at **55.8 dB PSNR**. The only differences come from encoding.

## Independent visual review (separate agent, compared with the references)

| Video | Score | Reviewer summary |
|---|---|---|
| CrackGlow V1 | **6/10** match | Concept, two-pulse timing (91-frame cycle), static camera, violet-left / orange-right palette and luma curve all track the reference; technically clean. Remaining gap: the reference has true 3D shards with depth of field and spoke-like radial cracks; V1 is a 2.5D tile plane. |
| CrackGlow V2 | **8/10** | Clearly distinct cool palette; same concept, timing and quality. |
| SmokePortal V1 | **5/10** match | Mean luma matches (76.4 vs 76.5). Ignition, centred framing, flare colours and blue-violet outer smoke also match, and there are no technical defects. Remaining gap: the reference is a volumetric fluid simulation. V1's 2D-noise plume is less saturated and less puffy, and it lacks the bright white ring wrapping the core. |
| SmokePortal V2 | **8/10** (concept / palette / timing kept) | Clearly different camera: a smooth eased push-in of about 2.1× (0.63× → 1.35× relative to V1), a 47° clockwise roll, drift from lower-right to centre, and measured parallax (the background scales about 10 % less than the portal). There are no jerks, edge gaps, seams or flicker. V2 shares V1's softness, which is more visible when zoomed in (frames 170–300). |

**Review history.** Each composition went through 3–4 review-and-fix rounds. CrackGlow V1 rose from 4/10 to 6/10 and SmokePortal V1 from 4/10 to 5/10. Fixed along the way:
- a seam at the `atan()` branch cut
- a camera snap at the loop point
- whole-frame flashes
- wedge artifacts at crack junctions
- banding (contour lines)
- tearing near the core
- an ignition "pop"
- an incomplete palette swap in V2

### Choice of alternative (V2)

- **Crack Glow → colour palette.** The reference camera is locked off and the look is defined by its neon colours, so I re-coloured it while keeping geometry, timing and camera identical.
- **Smoke Portal → camera movement.** The radial portal reads best with depth. The camera starts wide (0.6×), dollies in to 1.35× with a −20° → +31° roll, and applies parallax between the inner plume and the outer cloud. Palette and timing are unchanged.
