# Quality-Control Report — HUD Compositions

Project: `HUD-Compositions-4K-Remotion-Project.zip` (Remotion 4.0.537, scaffolded with `npx create-video --blank`)
Compositions: 3840×2160, 30 fps. Deliverables rendered from those 4K compositions with `--scale=0.5`.

## Deliverables

| # | File | Composition ID | Version |
|---|------|----------------|---------|
| 1 | `Comp1-SatelliteTargeting-V1-1080p.mp4` | `SatelliteTargeting-V1` | Reference match |
| 2 | `Comp1-SatelliteTargeting-V2-1080p.mp4` | `SatelliteTargeting-V2` | Alternative **camera**: oblique, orbiting drone move |
| 3 | `Comp2-WorldTracking-V1-1080p.mp4` | `WorldTracking-V1` | Reference match |
| 4 | `Comp2-WorldTracking-V2-1080p.mp4` | `WorldTracking-V2` | Alternative **colour palette**: navy / cyan holographic, amber alerts |
| 5 | `HUD-Compositions-4K-Remotion-Project.zip` | all four (plus three asset-bake stills) | 4K project, source, assets, config |

**Why these alternates:**
- **Comp 1:** a satellite pass is fundamentally about viewpoint, so V2 re-shoots it with a tilted, orbiting camera over the same 3D-projected terrain. The HUD stays locked to the ground.
- **Comp 2:** a flat dashboard has no meaningful camera, so V2 changes the palette instead.

**Technology:**
- **Comp 1:** procedural terrain in WebGL 2 GLSL, baked to textures, then a per-frame WebGL 2 shader for the camera, lens, sweep and grade. The HUD is SVG.
- **Comp 2:** Canvas 2D with d3-geo, using Natural Earth 1:50m coastlines (public domain) and a procedural relief texture. The UI is HTML/SVG.
- No stock imagery from the references was used.

## 1. Technical checks on the delivered MP4s

Tools used: ffprobe, a full ffmpeg decode, `blackdetect`, `freezedetect`, and per-frame `signalstats` luma.

| Check | Comp1 V1 | Comp1 V2 | Comp2 V1 | Comp2 V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate | 30/1 (constant) | 30/1 | 30/1 | 30/1 |
| Pixel format / colour | yuv420p, BT.709, tv range | same | same | same |
| Frames (decoded / expected) | 668 / 668 | 668 / 668 | 626 / 626 | 626 / 626 |
| Duration | 22.267 s | 22.267 s | 20.867 s | 20.867 s |
| Reference duration | 22.256 s | 22.256 s | 20.854 s | 20.854 s |
| Decode errors | 0 | 0 | 0 | 0 |
| Black segments | none | none | frame 0 only (1) | frame 0 only (1) |
| Freezes (>1.5 s) | none | none | none | none |
| Largest frame-to-frame luma jump (0–255) | 3.5 (the dive, a continuous zoom) | 3.8 | 13.2 at frame 13 (2) | 12.0 at frame 13 (2) |
| Audio | none (3) | none | none | none |

**Duration note:** the references are 29.97 fps (667 and 625 frames). At exactly 30 fps no whole number of frames hits their durations, so the closest counts are used: 668 and 626 frames. Both are within half a frame (11–13 ms) of the reference. Both compositions are set to exactly 30 fps.

(1) Intentional. The opening glitch-in starts from black, as the reference does.
(2) Intentional. This is the glitch-in resolving to the full map, not flicker. No other jump exceeds 12 anywhere.
(3) The references have no audio track, so none was added and there are no audio issues to check.

## 2. Project ZIP integrity and reproducibility

- **Archive:** `unzip -t` reports no errors. It contains 45 files (17.5 MB): `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, the ESLint and Prettier configs, `README.md`, all of `src/`, and the baked assets in `public/`. `node_modules/` and `out/` are excluded.
- **Clean install:** the ZIP was extracted into an empty directory, then `npm ci` ran with 0 vulnerabilities and `tsc --noEmit` passed.
- **Compositions:** `npx remotion compositions` lists `SatelliteTargeting-V1/V2` at 3840×2160 × 668 frames and `WorldTracking-V1/V2` at 3840×2160 × 626 frames, all at 30 fps.
- **Full 4K render:** run from the extracted copy with the documented `npm run render:4k`. All four succeeded (exit 0, about 62 minutes total, CPU only):

| 4K master | Codec | Resolution | Frames | Duration | Decode errors |
|---|---|---|---|---|---|
| SatelliteTargeting-V1-4K | H.264 yuv420p | 3840×2160 | 668 | 22.267 s | 0 |
| SatelliteTargeting-V2-4K | H.264 yuv420p | 3840×2160 | 668 | 22.267 s | 0 |
| WorldTracking-V1-4K | H.264 yuv420p | 3840×2160 | 626 | 20.867 s | 0 |
| WorldTracking-V2-4K | H.264 yuv420p | 3840×2160 | 626 | 20.867 s | 0 |

- **Consistency:** each 4K master, downscaled to 1080p, was compared against the delivered 1080p file. SSIM is 0.981, 0.978, 0.954 and 0.949, so it is the same picture. The small differences come from text and fine detail being rasterised natively at each resolution.
- **Missing assets:** none. The terrain textures, map relief and fonts are bundled, and no network access is needed at render time.

## 3. Independent agent verification against the references

Separate review agents compared each render with its reference using contact sheets at matched timestamps, beat-by-beat timing, and ffprobe.

- **Round 1 (drafts):** both V1s scored 6/10. The reviewers flagged:
  - **Comp 1:** reticle too small, a hard cut at the dive, a flat grade, the halo arriving late, an over-regular close-up, and a white blob in the close-up.
  - **Comp 2:** framing too tight, the NA zoom and Asia whip early, flat land, outline-only panels, and finale styling.

  All were fixed, and a full-range colour tag on one file was corrected to BT.709.
- **Round 2 (final files):**

| Video | Match score | Verdict | Reviewer notes |
|---|---|---|---|
| Comp1 V1 | 8/10 | **PASS** | All beats on time (ping 3.6 s, halo 4.6–5.4 s, dive 12–13.3 s as a continuous push-in, reticle 16 s, "A" 17 s, red at 19.6 s). The round-1 issues are resolved. |
| Comp1 V2 | — | **PASS** | The oblique orbiting camera is clearly distinguishable. Concept, beats and quality are preserved. |
| Comp2 V1 | 8/10 | **PASS** | Matches beat for beat: auth, panels and loading, search typing, brighten, NA zoom ~7.5 s, Asia ~10.7 s, Africa ~13.5 s, alpha protocol and CAIRO 17 s, target data 17.5 s. Framing now matches. |
| Comp2 V2 | — | **PASS** | The navy/cyan/amber palette is clearly distinct. Layout, timing and readability are preserved. |

**Remaining minor differences, none blocking:**
- The references are photographic stock footage, and these are procedural recreations. So the Comp 1 close-up fields are more regular than real farmland.
- Comp 1 has a stronger corner vignette than the reference.
- The Comp 2 TARGET DATA street map is a stylised radial network rather than a real city.

## 4. Visual consistency checklist

- **Timing and transitions:** beats land within about 0.5 s of the reference. The camera moves are continuous: Comp 1's dive is a single log-space zoom, and Comp 2's whips use 180°-shutter multi-sample motion blur with a directional smear. No stepping or strobing was found.
- **Colours:** the grade is constant per shot. V1 and V2 differ only in camera (Comp 1) or palette (Comp 2).
- **Flicker:** the per-frame luma scan shows no unintended jumps. HUD elements flicker in by design for a few frames as they appear.
- **Artifacts:** none found in the contact sheets at 1 fps or in the frame-by-frame dive and whip sampling.

## SHA-256

```
966696b0b7647d38bd60c3e6788e3d9d9955e2ae159fd54789b11483ebcd56e9  Comp1-SatelliteTargeting-V1-1080p.mp4
aac72d695b74bbb963c11a8fcb46c8377088599b038d928530f8e0bc51903795  Comp1-SatelliteTargeting-V2-1080p.mp4
ff153303d6ef40357375a0a2bf32f338511b4e525ac9bd216077a5d3a2962af1  Comp2-WorldTracking-V1-1080p.mp4
c0299abab16e8716f8ef42b23012081fed20c82d8c2120f75c2224600fd578ca  Comp2-WorldTracking-V2-1080p.mp4
3281c9f6e7257afc1f6f0e55dc270307a8817f624f2a781ddfaecd10a1e88187  HUD-Compositions-4K-Remotion-Project.zip
```
