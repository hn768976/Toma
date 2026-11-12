# Quality-Control Report — Cyber Data Wall & Finance Infographics

Two Remotion projects (created with the Remotion CLI `create-video --three`
template) with two 4K compositions each, rendered to four 1080p H.264
deliverables.

## Deliverables

| # | File | Composition (4K source) | Length |
|---|------|-------------------------|--------|
| 1 | `Version 1 - Cyber Data Wall (Steel Blue, matches reference) 1080p.mp4` | `CyberDataWall-V1-SteelBlue-4K` | 19.000 s / 570 f |
| 2 | `Version 2 - Cyber Data Wall (Amber Core colour palette) 1080p.mp4` | `CyberDataWall-V2-AmberCore-4K` | 19.000 s / 570 f |
| 3 | `Version 1 - Finance Infographics (Slow Push, matches reference) 1080p.mp4` | `FinanceInfographics-V1-SlowPush-4K` | 30.000 s / 900 f |
| 4 | `Version 2 - Finance Infographics (Orbit Glide camera move) 1080p.mp4` | `FinanceInfographics-V2-OrbitGlide-4K` | 30.000 s / 900 f |
| 5 | `Cyber Data Wall - 4K Remotion Project (V1 + V2).zip` | both data-wall compositions | — |
| 5 | `Finance Infographics - 4K Remotion Project (V1 + V2).zip` | both finance compositions | — |

Technology: **Three.js (WebGL 2) + GLSL shaders** inside Remotion for both
projects; **Canvas 2D** for the finance chart/glyph atlases.

* **Cyber Data Wall**: procedural dot-matrix wall shader, instanced panel boxes,
  instanced laser fans, particles, lens depth of field.
* **Finance Infographics**: instanced chart sprites and GPU-ticking number
  glyphs, per-sprite depth of field, glitch-streak overlay.

**Version 2 choices:**

* **Data wall: alternative colour palette.** The reference is a monochrome
  steel-blue piece, so the clearest variation that keeps its look is an amber
  wall with teal laser accents.
* **Finance: alternative camera movement.** The reference is a nearly static
  flat layout, so an elevated one-sided orbit around a world-anchored field of
  cards best shows off the 3D depth.

## 1. Render & format checks (ffprobe / ffmpeg on the delivered files)

| Check | V1 Data Wall | V2 Data Wall | V1 Finance | V2 Finance |
|---|---|---|---|---|
| Rendered successfully | ✅ | ✅ | ✅ | ✅ |
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Pixel format / colour | yuv420p, BT.709 TV range | same | same | same |
| Frame rate | 30/1 exactly | 30/1 | 30/1 | 30/1 |
| Frames (decoded / expected) | 570 / 570 | 570 / 570 | 900 / 900 | 900 / 900 |
| Duration vs reference | 19.000 s = 19.000 s | 19.000 s = 19.000 s | 30.000 s = 30.000 s | 30.000 s = 30.000 s |
| Decode errors (full decode) | 0 | 0 | 0 | 0 |
| Audio | none (reference has none) | none | none | none |
| Bitrate | 3.44 Mb/s | 3.84 Mb/s | 6.75 Mb/s | 6.20 Mb/s |

## 2. Artifact checks (every frame)

| Check | Method | Result |
|---|---|---|
| Unintended black frames | `blackdetect` (pix_th 0.10, ≥0.1 s) | Finance: none. Data wall: only the intentional fade-in 0–0.33 s; the reference itself opens with 0.27 s of black. |
| Frozen / stuck frames | `freezedetect` (≥1 s) | none in all four |
| Flicker / strobing | per-frame mean-luma deltas | Finance: max step 1.5 (reference 1.85). Data wall: max step 2.6 (reference 4.0); the intro fade-in follows the reference's brightness curve |
| Tile corruption / partial frames | custom 8×8 block-sharpness detector + visual review of consecutive frames | none. Counts are at or below the reference's own natural count (reference: 5 single-block hits). |
| Speckle / dither in panels | per-pixel isolated-outlier count + nearest-neighbour zoom crops | none (see fixes below) |
| Banding | 4× luma-boosted inspection | none |
| Missing assets | clean extract + render from ZIP | none (the only asset is the bundled Inter font for Finance) |

**Defects found during QC and fixed before delivery:**

1. **Data wall — rectangular sharp/blurred tile flicker.** The original
   EffectComposer/BokehPass chain recycles render targets, and under software
   WebGL a pass could read stale tiles. Replaced it with a pipeline where each
   render target is written once per frame: scene + depth texture, then a
   quarter-resolution pre-filter, then one final DOF + grade pass.
2. **Data wall — stippled texture in blurred panels.** Large blur radii now
   gather from the pre-filtered quarter-resolution copy.
3. **Data wall — per-pixel speckle on barcode panels.** Software GL interpolated
   the per-instance random seed with per-pixel float error, which the hash
   amplified into noise. Fixed with `flat` varyings, plus a coverage fade for
   bars smaller than a few pixels.
4. **Data wall — panel switch-on blink** read as flicker. Replaced with a
   smooth power-on ramp.
5. **Finance V2 matched V1 in the middle of the shot.** Elements now spawn in
   world space with a different seed, and the camera arcs around one side, so
   every frame is seen off-axis.
6. **Output colour range.** Remotion produced full-range `yuvj420p`; switched
   to standard BT.709 TV-range `yuv420p` for broad player compatibility.
7. **Bitrate.** Film grain had pushed the bitrate to 97 Mb/s; reduced it.

## 3. Independent reviewer-agent verification (reference vs render)

Separate reviewer agents compared each final render with its reference using
contact sheets, side-by-side frames, native-resolution crops and frame-by-frame
metrics.

**Cyber Data Wall (final round):** V1 match **7/10**, V2 **8/10**.

* **Matches:** palette (saturation 5.6 vs 5.2, hue ≈297° vs 298°), the
  ≈1.5 s fade-in curve, slow drift camera, shallow depth of field.
* **Remaining stylistic differences:** the reference has denser columns of
  fine alphanumeric code, and laser fans that converge more visibly on single
  hub points.
* **V2:** amber/teal (hue ≈141°) is clearly distinct, with the same quality.
* **Defects:** none found (no speckle, tiles, banding or corrupt frames).
  The switch-on blink it noted was then removed (fix 4).

**Finance Infographics (final round):** V1 match **7/10**, V2 **7/10**.

* **Matches:** light-grey vignette field, the same chart vocabulary (red/yellow/
  blue area charts, green and teal bars, pies, donuts, dotted line charts),
  "-12345,678" and "+8,741 %" numerals, glitch streaks, pacing, DOF.
* **Remaining differences:** the reference is packed slightly more densely with
  tiny labels and is about 5 luma levels darker.
* **V2:** clearly distinct at every sampled second, including 10–20 s, with
  the cards always seen at an angle.
* **Defects:** none found. The largest frame changes are the intended glitch
  jumps.

## 4. Project ZIP checks

For each ZIP:

* `unzip -t`: no errors.
* Extracted into an empty folder, `src/` and `remotion.config.ts` compared with
  the repository: identical.
* `npm ci`: OK. `npm run lint` (TypeScript): OK.
* `npm run still:v1` and `npm run still:v2`: **3840×2160** PNGs rendered.
* A short 4K video segment rendered from the extracted project: H.264
  3840×2160, 30 fps.

Contents: `src/` (all composition code), `public/` (Inter font + OFL licence,
Finance only), `package.json`, `package-lock.json`, `remotion.config.ts`,
`tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`, `README.md`
(documented commands), `LICENSE.md`. `node_modules` and `out/` are excluded;
they are recreated by `npm ci` and the render scripts.

Documented commands (both projects):

```bash
npm ci
npm run render:v1:4k      # full 4K render
npm run render:v2:4k
npm run render:v1:1080p   # delivery render (--scale=0.5, H.264, CRF 18)
npm run render:v2:1080p
```

Notes:

* The config defaults to `--gl=swangle` (CPU WebGL), which works on any
  machine. On a GPU workstation, `REMOTION_GL=angle` is much faster.
* Software 4K renders are slow: allow several seconds per frame.

## 5. SHA-256 checksums

```
979a1a63bae9fcab1cbafaef63dd15ee102966d1af43da3cdef72da1c4460de5  Version 1 - Cyber Data Wall (Steel Blue, matches reference) 1080p.mp4
d1d5d8f50a2cbcbd17d5c1c647b1ba8e917361720254cc104ef2aacf457efef5  Version 1 - Finance Infographics (Slow Push, matches reference) 1080p.mp4
0df682fde1b44e3fc16726b1fc56b538b62d4aed0a56594a033cf0ed820e19a8  Version 2 - Cyber Data Wall (Amber Core colour palette) 1080p.mp4
2c00bbcb2f28519575486cd467844300f3099e630582e3741482783d3312d419  Version 2 - Finance Infographics (Orbit Glide camera move) 1080p.mp4
d2a0d77c2639fc3b3980fcde70bfa411aaf8eea40cd08f47041f35f3bbb6b933  Cyber Data Wall - 4K Remotion Project (V1 + V2).zip
c3d40617f66da635c1e14614126c23fc934e19ed205ac4cf1c93ac343c4a3be6  Finance Infographics - 4K Remotion Project (V1 + V2).zip
```
