# Quality-Control Report — Remotion Compositions 1 & 2

Date: 2026-10-31 · Remotion 4.0.539 (projects scaffolded with `npx create-video --blank`)

## Deliverables

| # | File | Size |
|---|---|---|
| 1 | `Comp1_PlexusSphere_V1_Reference_1080p.mp4` — matches reference | 8.6 MB |
| 2 | `Comp1_PlexusSphere_V2_MidnightPalette_1080p.mp4` — alternative **colour palette** | 10.5 MB |
| 3 | `Comp2_RainRipples_V1_Reference_1080p.mp4` — matches reference | 77.3 MB |
| 4 | `Comp2_RainRipples_V2_LowAngleDolly_1080p.mp4` — alternative **camera angle + movement** | 91.4 MB |
| 5 | `Comp1_PlexusSphere_4K_RemotionProject.zip`, `Comp2_RainRipples_4K_RemotionProject.zip` | 56 KB / 70 KB |

Technology: Comp 1 = Canvas 2D (crisp hairlines/dots, deterministic); Comp 2 = WebGL 2 shaders
(two-pass height-field + shading, float render target).
All four compositions are authored at **3840×2160** and the deliverables are rendered from them with
`--scale=0.5` → 1920×1080.

## Technical checks (ffprobe / ffmpeg on the final files)

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Renders successfully | ✅ | ✅ | ✅ | ✅ |
| Codec / profile / pix fmt | H.264 High, yuv420p, bt709 | same | same | same |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames | 600 | 600 | 901 | 901 |
| Duration (video = container) | 20.000 s | 20.000 s | 30.033 s | 30.033 s |
| Reference duration | 20.000 s | 20.000 s | 30.030 s | 30.030 s |
| Full decode errors | none | none | none | none |
| Black segments (blackdetect) | 0 | 0 | 0 | 0 |
| Frozen segments (freezedetect) | 0 | 0 | 0 | 0 |
| Max frame-to-frame mean-luma jump (flicker) | 0.05 | 0.05 | 0.39 | 0.45 |
| Audio | none (ref: none) | none (ref: none) | AAC 48 kHz stereo, 30.033 s, silent (−91 dB) | same |

**Duration note (Comp 2):** the reference is 900 frames at 29.97 fps = 30.030 s. At the required
exactly-30 fps that is 900.9 frames, which cannot be rendered; **901 frames = 30.033 s** is the nearest
frame-exact length (+3.3 ms, under one frame). Video, audio and container durations are all
identical (the silent AAC track is remuxed with Remotion's bundled ffmpeg to exactly 901/30 s).
The reference's audio track is digital silence, so an equivalent silent track is included.

## Project ZIP checks

* `unzip -t`: no errors in either archive. Contents = complete Remotion project: `src/` (all
  compositions and code), `src/rain/colorField.json` (the only data asset), `package.json` +
  `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint/Prettier config, `README.md`
  with documented commands. `node_modules`/outputs excluded. Archive contents match the repository
  (`diff -r`).
* Clean extraction → `npm ci` → `tsc` ✅ → `remotion compositions` lists all four at
  3840×2160, 30 fps, 600 / 901 frames ✅.
* Comp 1: `npm run render:v1` / `render:v2` from the extracted ZIP produce files **bit-identical**
  (matching MD5) to deliverables 1–2.
* Comp 2: the delivered files were produced by the documented `npm run render:v1` / `render:v2`.
  From the extracted ZIP, rendered frames are **pixel-identical** to the repo project
  (max abs diff 0); a 60-frame segment re-encode matches the delivery at 42–43 dB PSNR (encoder
  variance only).
* Native 4K: stills rendered at scale 1 from the extracted projects are 3840×2160 and clean.

## Visual / fidelity verification (independent review agent)

An independent agent compared each output to its reference (side-by-side frames, motion
tracking, regional colour statistics, spectra, temporal analysis). Findings were fixed and
re-checked until both compositions passed:

| | Final score | Verdict | Key fixes made from review |
|---|---|---|---|
| C1 V1 | 8/10 | PASS | Rotation re-modelled from windowed fits (axis precesses once per loop → roll × spin, 2 whole turns per 20 s, on-screen speed now within ~10 %); less dust; depth-of-field blur on back elements; framing |
| C1 V2 | 8/10 | PASS | Gradient dithered (banding removed); dust reduced; dark floor lifted |
| C2 V1 | 8/10 | PASS | Polygon-faceted rings fixed (round); 1–3 thin crests; crater + splash stage; decelerating expansion & 1.6 s life; glint spectrum; rhythm and diagonal grain removed |
| C2 V2 | 8/10 | PASS | Far field alias-free; smooth dolly (no jitter); top-right navy preserved |

Confirmed by the review: loops/seams clean (Comp 1 is a seamless 20 s loop like the
reference, last→first frame difference equals a normal frame step), no flicker, no pops,
no aliasing/shimmer, regional mean colours within ~3–4 levels of the reference (Comp 2),
consistent timing and colour throughout.

**Version 2 distinctness:** C1 V2 swaps the white/black palette for a midnight-navy field with
luminous cyan nodes (same geometry, framing and motion). C2 V2 replaces the static high-angle view
with a low grazing camera (31°→26°) slowly gliding forward with gentle lateral drift and yaw —
same rain simulation and palette. Both were confirmed clearly distinguishable while preserving the
concept and quality.

**Remaining minor differences (optional polish, not failures):** C1 vertex motion ~10 % faster
than the reference with a slightly different speed profile over the loop; C2 is somewhat softer
than the reference (sharpness ≈ ⅔) with crisper ring edges; the reference's stock-photo watermark
is intentionally not reproduced.
