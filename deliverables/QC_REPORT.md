# QC Report — Ember Nova & Tile Flip

Date: 2026-10-31 · Branch: `ccr-19d8b33c-e9l4y4`

## Deliverables

| # | File | Composition | Reference |
|---|------|-------------|-----------|
| 1 | `EmberNova-V1_1080p.mp4` | `EmberNova-V1` (fire palette, matches reference) | REF A, 9.000 s |
| 2 | `EmberNova-V2_1080p.mp4` | `EmberNova-V2` (alternative: electric plasma blue/violet palette) | REF A |
| 3 | `TileFlip-V1_1080p.mp4` | `TileFlip-V1` (straight-on static camera, matches reference) | REF B, 7.808 s |
| 4 | `TileFlip-V2_1080p.mp4` | `TileFlip-V2` (alternative: low three-quarter camera, slow orbit + push-in) | REF B |
| 5 | `EmberNova_Remotion_4K_Project.zip`, `TileFlip_Remotion_4K_Project.zip` | Remotion projects with both 4K compositions each | — |
| 6 | `QC_REPORT.md` (this file) + `qc/*.json` + `qc/qc_check.py` | — | — |

**Technology choices**
- *Ember Nova*: Three.js on WebGL 2 with custom GLSL shaders. It uses additive sprite and ribbon layers, plus full-screen shaders for the background and the shockwave ring. This suits a pure-light, glow-heavy effect.
- *Tile Flip*: Three.js scene with real 3D geometry. Hinged flap boxes sit over recessed cavities, lit by a directional key with PCF soft shadow maps plus fill lights. This suits physical depth and shadows.

**Pipeline:** each composition is 3840×2160 at 30 fps. It is rendered at native 4K (`npm run master`), then downscaled to 1080p with a Lanczos filter and error-diffusion dithering (`remotion ffmpeg` + `zscale`). Output is H.264 High profile, yuv420p, CRF 16, faststart.

## 1. Technical checks (automated: `qc/qc_check.py`, results in `qc/*_qc.json`)

| Check | EmberNova-V1 | EmberNova-V2 | TileFlip-V1 | TileFlip-V2 |
|---|---|---|---|---|
| Renders successfully | ✅ | ✅ | ✅ | ✅ |
| Codec | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames decoded | 270 | 270 | 234 | 234 |
| Duration | 9.000 s | 9.000 s | 7.800 s | 7.800 s |
| Reference duration | 9.000 s | 9.000 s | 7.808 s | 7.808 s |
| Pixel format | yuv420p | yuv420p | yuv420p | yuv420p |
| Full decode errors | none | none | none | none |
| Black frames (blackdetect) | none | none | none | none |
| One-frame flicker spikes | none | none | none | none |
| Identical consecutive frames (frozen or corrupted) | 0 | 0 | 0 | 0 |
| Audio | none (references have none) | none | none | none |

**Duration note (Tile Flip):** the reference is 7.8078 s, which is 234 frames at 29.97 fps. At the required 30 fps, one frame lasts 33.3 ms, so 234 frames (7.800 s) is the closest whole-frame match, 7.8 ms off. A 235th frame would be 25.5 ms too long. Ember Nova matches exactly (270 frames = 9.000 s).

**4K compositions:** the native 4K masters render at 3840×2160, 30/1, with full frame counts (270 / 270 / 234 / 234).

## 2. Project ZIP checks

| Check | EmberNova ZIP | TileFlip ZIP |
|---|---|---|
| Archive integrity (`unzip -t`) | ✅ no errors | ✅ no errors |
| Contents | `src/` (all source), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`, `public/`, `README.md`, `LICENSE.md` | same |
| Compositions registered at 4K | `EmberNova-V1`, `EmberNova-V2`: 3840×2160, 30 fps, 270 f | `TileFlip-V1`, `TileFlip-V2`: 3840×2160, 30 fps, 234 f |
| External assets | none needed: all textures and noise are procedural | none needed |
| Clean extract → `npm ci` | ✅ | ✅ |
| `npm run lint` (ESLint + `tsc`) | ✅ | ✅ |
| `npx remotion compositions` | ✅ lists both | ✅ lists both |
| Documented render (`npm run master:v1` / `master:v2`) | ✅ __EMBER_CLEAN__ | ✅ V1 4K + 1080p; V2 4K segment |
| Clean-room output equals delivered file | ✅ byte-identical (MD5) | ✅ byte-identical (MD5) |

node_modules is excluded from the ZIPs; `npm ci` restores the exact locked versions (Remotion 4.0.539, three 0.178.0). Rendering is deterministic: nothing depends on wall-clock time and all randomness is seeded.

## 3. Visual verification (independent review agent, three passes)

An independent agent compared every deliverable against its reference at matching timestamps (0.1–0.4 s steps). It used side-by-side frames, per-frame luma curves and frame-difference analysis. Its findings were fixed over two revision rounds.

| Item raised | Status |
|---|---|
| Ember: ring and explosion lasted too long | Fixed: luma at 4.8 s matches the reference |
| Ember: small flash instead of a soft fireball at 3.2 s | Fixed |
| Ember: too little smoke, small trail heads | Improved: smoke visible from 1.2 to 3.0 s, larger blooming heads |
| Ember: too bright from 3.0 to 4.0 s | Fixed in the final round (__EMBER_LUMA__) |
| Ember: symmetric starburst instead of a one-sided dust spray | Fixed in the final round: dust cloud thrown to the left / lower-left |
| Ember V2: vignette banding | Fixed with error-diffusion-dithered downscale; only visible with a 6× contrast boost |
| Tile: dark, hard shading | Fixed: luma range 146–167 (reference 153–167), background RGB within ±2 of the reference |
| Tile: hairline seams on idle tiles | Fixed: only recently-moved tiles show outlines, fading out after closing |
| Tile: too many open holes at the climax | Improved: lower flap angles |
| Tile: about 0.27 s near-freeze around 3.8 s | Fixed: no static frames |
| Tile V2: aliased seam lines | Fixed by the supersampled 4K → 1080p pipeline |

**Second versions are clearly distinct.**
- *EmberNova-V2* uses a different colour palette: electric plasma blue with violet depth instead of molten orange. Geometry, timing, transitions and quality are identical, so the concept is preserved. Palette was chosen because the reference is a pure light and colour effect with no meaningful 3D space for a camera move to reveal.
- *TileFlip-V2* uses a different camera angle and movement: a low three-quarter view with a slow orbit and push-in. It reveals cavity depth, flap thickness and cast shadows that the head-on reference hides. Choreography and timing are identical. Camera was chosen because this reference is a physical 3D relief, where viewpoint is the most expressive variable.

## 4. Known limitations (minor, accepted)

- **Tile Flip V2 does not loop seamlessly.** The camera ends at a different angle from where it starts. V1 loops cleanly, like the reference.
- **Tile flip order is approximate.** Individual tile choices after about 1 s differ slightly from the reference. Rhythm, the two-phrase structure and the climax timing match.
- **Tile climax is slightly darker.** At 2.6–2.8 s the darkest frame measures 146 luma against the reference's 153.
- **Ember was re-created, not reproduced.** It is an original procedural build of the reference's look, so fine particle and smoke textures differ from the stock footage. The iStock watermark was intentionally not reproduced.
