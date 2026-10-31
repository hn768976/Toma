# Quality-Control Report — Remotion 4K Compositions (1080p delivery)

Date: 2026-10-31 · Branch: `ccr-c05c1bbd-b4o2v6`

## Deliverables

| # | File | What it is |
|---|------|-----------|
| 1 | `Composition1_Version1_1080p.mp4` | Fireworks loop. V1 matches the reference (warm orange / gold / red / pink). |
| 2 | `Composition1_Version2_1080p.mp4` | Fireworks loop. V2 is the same show in an alternative **colour palette** ("arctic": cyan, silver-blue, violet, emerald, orchid). |
| 3 | `Composition2_Version1_1080p.mp4` | Neon arc light streaks. V1 matches the reference (framing, palette, 2 s seamless loop). |
| 4 | `Composition2_Version2_1080p.mp4` | Neon arc light streaks. V2 is the same streak field with an alternative **camera angle and movement**: a low tilted viewpoint with a slow rolling dolly-in. |
| 5 | `Composition1_FireworksLoop_4K_RemotionProject.zip` | Remotion project with both 3840×2160 compositions (`Fireworks-V1-4K`, `Fireworks-V2-4K`). |
| 5 | `Composition2_NeonArcStreaks_4K_RemotionProject.zip` | Remotion project with both 3840×2160 compositions (`NeonArcStreaks-V1-4K`, `NeonArcStreaks-V2-4K`). |

**Technology choices**
- **Composition 1:** a Canvas 2D particle system with additive blending and a two-level bloom. It suits thousands of thin, glowing spark trails, and CPU-backed canvases render quickly without a GPU.
- **Composition 2:** a single WebGL 2 fragment shader. Soft, motion-blurred light fields like these are best evaluated analytically per pixel.
- **Both:** the projects were created with the Remotion CLI (`npx create-video --blank`). The compositions are 3840×2160 at 30 fps. The 1080p deliverables are those 4K compositions rendered with `--scale=0.5`.

**Why the 2nd versions differ the way they do**
- **Fireworks:** colour is the defining variable of a fireworks display. Changing the palette produces an obviously different piece while keeping the choreography, layout, timing and quality identical.
- **Streak field:** this is an abstract, colour-graded backdrop, so a palette swap would mainly read as a grade. A new camera gives a genuinely new view of the same light field: a low angle, arcs foreshortened toward a soft horizon, and a roll plus dolly over 12 s.

## Technical checks (ffprobe / ffmpeg, all four MP4s)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 | Result |
|---|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High | PASS |
| Pixel format | yuv420p | yuv420p | yuv420p | yuv420p | PASS |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 | PASS |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | PASS |
| Frames decoded | 300 | 300 | 360 | 360 | PASS, same as reference |
| Duration | 10.000 s | 10.000 s | 12.000 s (container 12.011) | 12.000 s (container 12.011) | see note |
| Full decode errors | none | none | none | none | PASS |
| Frozen segments (freezedetect) | none | none | none | none | PASS |
| Black segments (blackdetect) | 0–0.13 s (opening) | 0–0.10 s (opening) | none | none | PASS, see note |
| Max frame-to-frame mean-luma jump (flicker) | 0.68 (ref 1.15) | 0.87 (ref 1.15) | 0.16 (ref 0.30) | 0.21 (ref 0.30) | PASS, steadier than reference |
| Audio | none (ref: none) | none (ref: none) | AAC 48 kHz stereo, −91 dB (ref: same, silent) | AAC 48 kHz stereo, −91 dB | PASS, matches reference |
| 2 s loop (PSNR frame 0 vs 60 / 120 / 300) | n/a | n/a | 51.9 / 51.9 / 51.6 dB | n/a (camera move by design) | PASS, seamless |
| Bitrate | 18.5 Mb/s | 18.9 Mb/s | 4.5 Mb/s | 5.6 Mb/s | n/a |

**Duration note:** both references are 29.97 fps (300 frames = 10.010 s, 360 frames = 12.012 s). At exactly 30 fps those durations are 300.3 and 360.36 frames, which can't be encoded. Each video therefore keeps the reference's exact frame count, so it is 10 ms and 12 ms shorter than the reference.

**Black-frame note:** the fireworks open on a near-black sky while the first shells ignite, as the reference does. The reference is black for 1 frame; ours is black for 3–4 frames. The mean luma over the first 12 frames tracks the reference within about 0.5 levels (16.6 → 20.7 against 17.0 → 21.3).

## Independent agent review (visual match)

A separate reviewer agent compared each deliverable with its reference. It used contact sheets at matched timestamps, regional colour and hue statistics, luma-over-time correlation, motion estimates and loop PSNR. Two review rounds produced specific findings, and the compositions were revised after each:
- **Fireworks:** redder palette, larger overlapping shells, softer cores, stronger bloom, more droop and glitter, a less regular rhythm, and a matched opening.
- **Streaks:** about 25% brighter, a lopsided arc that is steeper on the left, a dark bottom-left wedge, teal on the left and crimson mid-frame, softer streaks, and a loop-safe brightness "breathing".

Final review results:

| Item | Verdict |
|---|---|
| C1 V1 vs reference | **6/10.** Layout, palette and build-up match: saturated hues are 84% red, 13% orange and 3% magenta, against the reference's 91/7/2. Remaining gaps: the shells are dense straight-spiked "pom-poms" with no beaded or crackling strands, inner pistils or falling glitter trails, and it is a little brighter (mean luma 21.5 against 18.0). |
| C2 V1 vs reference | **7/10.** Palette (RGB 27.6/14.1/70.5 against 27.3/18.1/68.4), geometry and the 2 s loop match. It is slightly crisper and darker in the gaps than the reference's softer haze. |
| C1 V2 | **Distinct: yes.** Same show (luma correlation with V1 0.994) with completely different hues: no red or orange, and cyan, azure, blue, violet, white and emerald instead. |
| C2 V2 | **Distinct: yes.** A clearly different camera: a low tilted vortex view with a dolly-in. Palette and streak style are kept. It does not loop, by design. |
| Artifacts (all four) | No unintended black frames, flicker, banding, aliasing or shimmer, corrupted or frozen frames, or pops. The C2 V1 loop seam is clean. |

## Project ZIP checks

- **Integrity:** `unzip -t` reports no errors for either archive.
- **Contents of each ZIP:**
  - `package.json` (with render scripts) and `package-lock.json` (exact dependency versions)
  - `remotion.config.ts`, `tsconfig.json`, `eslint.config.mjs` and `.prettierrc`
  - `README.md` with the documented commands
  - `src/`: the full 4K compositions and source code, plus `public/`
  - There are no external assets: everything is procedural, so no asset files are needed.
- **Excluded:** `node_modules/` and `out/`, which are restored by `npm ci` and the render scripts.

**Clean-room test:** both ZIPs were extracted into an empty folder, outside the repository and without `node_modules`. Each project was installed and rendered only with its documented commands:

| Step | Composition 1 (fireworks-loop) | Composition 2 (neon-arc-streaks) |
|---|---|---|
| `npm ci` | OK | OK |
| `npm run lint` (ESLint + TypeScript) | OK | OK |
| Documented 1080p render | `npm run render:all`: OK. Both MP4s are **byte-identical** to the deliverables. | `npm run render:v1`: OK. The MP4 is **byte-identical** to the deliverable. |
| Native 4K render (3840×2160) | `Fireworks-V1-4K`, frames 140–169: OK (H.264, 3840×2160, 30 fps) | `NeonArcStreaks-V2-4K`, frames 170–189: OK (H.264, 3840×2160, 30 fps) |

Renders are deterministic, using seeded randomness and pure functions of the frame. Anyone rebuilding from the ZIPs gets exactly the delivered videos.

## How to reproduce

```console
unzip Composition1_FireworksLoop_4K_RemotionProject.zip && cd fireworks-loop
npm ci
npm run render:all        # both 1080p deliverables -> out/
npm run render:v1:4k      # optional 4K master
```

The same steps apply to `Composition2_NeonArcStreaks_4K_RemotionProject.zip` / `neon-arc-streaks`.

## SHA-256 of the delivered files

```
15469dd769d2f98b48d64190a98a8170bb9b041545907963e38e7a1ba3e91e3d  Composition1_FireworksLoop_4K_RemotionProject.zip
bc3ea31a49bb6aaa6e29ce4698a4a95b38178434ff3ad7fb58bdca98f0ec1284  Composition1_Version1_1080p.mp4
59b5e57a2367ef78263783b99878df586e9c61df1836ead375dd785e0a52b2c5  Composition1_Version2_1080p.mp4
135695ecfea989c3232f6cfd2e46ce396ebacff1452190841d17920220eb1786  Composition2_NeonArcStreaks_4K_RemotionProject.zip
8962711feefd3a8d00771be6cbff85cd83c7ce8d76b47f86c7486e253202a76c  Composition2_Version1_1080p.mp4
25a69b15dae144fac61b328b4bc801b58c67edd1acedad3ddfa60ac3434fcbc8  Composition2_Version2_1080p.mp4
```
