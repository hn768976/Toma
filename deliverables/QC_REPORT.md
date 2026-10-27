# Quality-control report

Two Remotion compositions, each authored at **3840 × 2160 (4K UHD), 30 fps**, in
two versions. Final deliveries are rendered from the 4K compositions at
`--scale=0.5` (1920 × 1080). The checks were run on the final files in this folder.

| # | Deliverable | Reference |
|---|---|---|
| 1 | `Composition1_CrumpledGridPaper_V1_1080p.mp4`: crumpled charcoal grid paper, stop-motion (matches reference) | `c7108387-istockphoto-2270827432` (9.6 s) |
| 2 | `Composition1_CrumpledGridPaper_V2_1080p.mp4`: same, **alternative colour palette** (blueprint: cyanotype blue, pale-cyan ink) | same |
| 3 | `Composition2_GoldenBokehSky_V1_1080p.mp4`: golden bokeh, tilt up into blue sky (matches reference) | `aa66135b-istockphoto-2245483740` (28 s) |
| 4 | `Composition2_GoldenBokehSky_V2_1080p.mp4`: same scene, **alternative camera movement** (crane pull-back: opens 1.4× tight on an 8° dutch angle, fast rise then glide, pulls back wide and rolls level, with depth parallax) | same |
| 5 | `crumpled-grid-paper_4K-project.zip`, `golden-bokeh-sky_4K-project.zip`: complete Remotion projects | |

`SHA256SUMS.txt` lists checksums for every file.

## Technology choice

Both references are continuous-tone photographic textures with no discrete
objects, so each composition is a single procedural **WebGL2 fragment
shader**. There are no image assets, and it is resolution independent.

- **Composition 1:** a heightfield made of random fold creases, folds and fibre grain, lit by one directional light. The grid is drawn in paper space and warped by the folds. There are 8 seeded crumple states, swapped stop-motion style.
- **Composition 2:** layered hexagonal-aperture bokeh, a warm light mass, translucent haze, and a blue sky with light shafts, all viewed through a virtual camera.

## Technical checks (all four files PASS)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Codec | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames | 288 | 288 | 840 | 840 |
| Duration vs reference | 9.600 = 9.600 s | 9.600 = 9.600 s | 28.000 = 28.000 s | 28.000 = 28.000 s |
| Pixel format | yuv420p, limited range, BT.709 | same | same | same |
| Full decode errors | none | none | none | none |
| Black frames (blackdetect) | none | none | none | none |
| Largest frame-to-frame jump in mean brightness (0–255) | 3.6 (at state swaps) | 6.4 (at state swaps) | 0.44 | 0.24 |
| Audio | AAC 48 kHz stereo, silent (−91 dB) | same | none | none |

- **Audio** matches the references. Reference 1 carries a digitally silent stereo AAC track, so Composition 1 does too. Reference 2 has no audio, and neither does Composition 2.
- **Flicker:**
  - Composition 1 changes only at the stop-motion state swaps (every 0.12 s, as in the reference); within a state the frame difference is at most 0.09.
  - Composition 2's largest second difference of mean brightness is 0.17–0.37 (the reference's is 0.76).
- **Timing at 30 fps:** at 30 fps the 0.12 s state hold alternates 4- and 3-frame holds; the average interval is 0.120 s and the cycle is 0.96 s, both identical to the reference.

## Project ZIPs

- **Complete:** each ZIP holds the full Remotion project:
  - sources (`src/`): compositions, GLSL shaders, WebGL canvas, camera
  - `package.json` with documented render scripts, plus `package-lock.json`
  - `remotion.config.ts`, `tsconfig.json`, ESLint and Prettier configs
  - `README.md` with the commands
  - No external assets are needed, since everything is procedural.
- **Integrity:** `unzip -t` reports no errors, and the contents are byte-identical to the committed source.
- **Fresh install:** both projects were extracted into empty folders, then:
  - `npm ci` installed cleanly.
  - `tsc` typechecked with no errors.
  - `remotion compositions` listed `*-V1` and `*-V2` at 3840×2160, 30 fps, 288 or 840 frames.
- **Documented commands reproduce the deliveries:**
  - Composition 1: `npm run render:v1` in the extracted project gave output **bit-identical** to the delivered file (PSNR ∞ over all 288 frames).
  - Composition 2: the delivered V2 *is* the `npm run render:v2` output from the extracted ZIP. A V1 frame rendered from the ZIP matches the delivered frame at 44.5 dB PSNR (H.264 compression only).
  - Native 4K stills (3840×2160) of all four versions rendered successfully from the extracted projects.

Commands (in either project): `npm ci`, then `npm run render:v1`, `npm run render:v2` or `npm run render:all` for the 1080p deliveries, and `npm run render:v1:4k` / `npm run render:v2:4k` for native 4K masters.

## Independent visual verification

A separate reviewer agent compared each render against its reference, using its own measurements and side-by-side stills. Findings were fed back and fixed over several rounds.

| Version | First review | Final verdict | Fixed along the way |
|---|---|---|---|
| C1 V1 | Pass with notes | **Pass** | Grid jump per state cut from 4.3 px to under 1.2 px (reference ≈1.5). Creases less regular. Line contrast and paper tone now match: median luma 31, the same as the reference. |
| C1 V2 | Pass with notes | **Pass with notes** | Clearly distinguishable by palette, with the same quality. The note is that geometry and motion are shared with V1, which is intended: the variant is the palette. |
| C2 V1 | Pass with notes (close to Fail) | **Pass with notes** | Straight seams through the bokeh fixed (a shader bug). Hexagonal apertures. Gold contrast up (std 23 → 35–38). Haze coverage now close to the reference. First-half brightness within 1–4 levels. Slope matches (15 vs 16 rows). Clean sky ending. Timing within about ±4 rows of frame height. |
| C2 V2 | Pass with notes (not distinct enough) | **Pass with notes** | Redesigned camera move, now clearly distinct: a different speed profile, a 1.4×→1.0× pull-back, an 8° roll that levels out, and parallax 4–6× V1's. Ends near V1's framing. |

### Known remaining deviations (minor, from the final reviews)

- **C1:**
  - Highlights are slightly compressed (p95 of 51 against 58).
  - The grid bends a little less than in the reference.
  - Line kinks at creases are slightly sharp, visible only zoomed in.
- **C2 V1:**
  - The bokeh is a little more opaque than the reference's translucent layered look.
  - Gold shadows lean olive, and the gold is slightly over-saturated.
  - There is a small highlight hotspot in the first 2–3 s (p99 241 against about 218).
  - The bottom edge clears about 1 s late at 16–19 s.
- **C2 V2:**
  - Same gold notes as V1.
  - The gold leaves the frame by about 12 s, so the back half is a slow open-sky glide.
  - It starts at full speed from frame 0 (a "cut into a move").
- **All:** the reference watermark is deliberately not reproduced.

No rendering errors, missing assets, corrupted frames, unintended black frames, flicker or seams remain in any delivered file.
