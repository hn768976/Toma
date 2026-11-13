# Quality-Control Report

**Two compositions, two versions each, built with the Remotion CLI and rendered from 4K masters.**

The four final videos below are the deliverables. Each project ZIP holds both 4K compositions.

| # | File | Composition (4K master) | Tech |
|---|---|---|---|
| 1 | `DNA-Helix-HUD_Version-1_Reference-Match_1080p.mp4` | `DnaHelixHUD-V1-Reference` | Three.js / WebGL 2 + custom GLSL post |
| 2 | `DNA-Helix-HUD_Version-2_Orbit-Camera_1080p.mp4` | `DnaHelixHUD-V2-OrbitCamera` | same |
| 3 | `Data-Sequence-HUD_Version-1_Reference-Match_1080p.mp4` | `DataSequenceHUD-V1-Reference` | Canvas 2D |
| 4 | `Data-Sequence-HUD_Version-2_Neon-Palette_1080p.mp4` | `DataSequenceHUD-V2-NeonPalette` | Canvas 2D |
| 5a | `DNA-Helix-HUD_4K-Remotion-Project.zip` | both DNA compositions, 3840×2160 | |
| 5b | `Data-Sequence-HUD_4K-Remotion-Project.zip` | both HUD compositions, 3840×2160 | |

**Version 2 choices:**
- **DNA Helix:** a **different camera movement**. It opens on an overhead crane shot, descends and orbits about 120° around the helix, and ends on a low-angle ¾ hero view. The look and palette are unchanged. This is a 3D scene, so a new camera move is the strongest alternative.
- **Data Sequence HUD:** a **different colour palette**. It uses deep navy, ice-cyan text, hot-magenta and electric-cyan accents, and violet bars. Layout and animation are unchanged. The reference is a locked-off flat UI, so palette is its natural variable.

---

## 1. Technical specs: all PASS

The automated checks used `ffprobe` with a full frame count, then decoded every file end to end.

| Video | Codec | Resolution | FPS (r / avg) | Frames | Duration | Ref duration | Pixel format | Size |
|---|---|---|---|---|---|---|---|---|
| DNA V1 | H.264 High | 1920×1080 | 30/1 / 30/1 | 600 | 20.000 s | 20.000 s | yuv420p, BT.709 | 22.3 MB |
| DNA V2 | H.264 High | 1920×1080 | 30/1 / 30/1 | 600 | 20.000 s | 20.000 s | yuv420p, BT.709 | 27.7 MB |
| HUD V1 | H.264 High | 1920×1080 | 30/1 / 30/1 | 600 | 20.000 s | 20.000 s | yuv420p, BT.709 | 6.2 MB |
| HUD V2 | H.264 High | 1920×1080 | 30/1 / 30/1 | 600 | 20.000 s | 20.000 s | yuv420p, BT.709 | 6.8 MB |

- **Compositions:** 3840×2160, 30 fps, 600 frames. Deliverables were rendered from them with `--scale=0.5`, which gives true 1080p from the 4K layout.
- **Audio:** both references are video-only, so no audio was created and audio checks do not apply.

## 2. Integrity and artefact checks: all PASS

| Check | Method | DNA V1 | DNA V2 | HUD V1 | HUD V2 |
|---|---|---|---|---|---|
| Full decode, 0 errors | `ffmpeg -xerror` decode of every frame | ✔ | ✔ | ✔ | ✔ |
| No black frames | `blackdetect` (≥1 frame, pix_th 0.06) | ✔ | ✔ | ✔ | ✔ |
| No frozen segments | `freezedetect` (>0.5 s) | ✔ | ✔ | ✔ | ✔ |
| No flicker | max frame-to-frame mean-luma Δ (reference A: 0.86, reference B: < 0.2) | 0.73 | 0.43 | 0.18 | 0.15 |
| No corrupted/glitch frames | single-frame outlier score (flag > 1.1; references peak at 0.79) | 0.67 | 0.55 | 0.36 | 0.36 |
| Chunk seams invisible (DNA rendered in 4 chunks, joined losslessly) | outlier score at frames 150/300/450 | ✔ | ✔ | n/a | n/a |

## 3. Independent agent verification against the references

A separate reviewer agent compared each render with its reference. It used frame-matched contact sheets, native-resolution crops, consecutive-frame strips and per-region motion, sharpness, brightness and colour metrics. Each round's findings were fixed and re-verified.

| Version | Final fidelity score | Verdict | Key confirmations |
|---|---|---|---|
| DNA V1 | **8 / 10** | SHIP | See below |
| DNA V2 | n/a (alternative) | SHIP | See below |
| HUD V1 | **8.5 / 10** | SHIP | See below |
| HUD V2 | n/a (alternative) | **PASS** | See below |

- **DNA V1:**
  - The structure matches the reference: a dark grazing fly-over, the helix sliding in defocused at about 3 s, a rack focus and pull-back, then a ¾ view with the helix receding right.
  - The cool teal grade matches: background RGB 19/24/30 against 16/24/30.
  - Framing matches: the helix ends at 62–70% of the width, against 62–73% in the reference.
  - The focus falls off toward the far end, as in the reference.
  - Shimmer is lower than the reference's.
- **DNA V2:** the camera movement is clearly distinct from the reference and V1. The concept, look and quality are preserved, motion is smooth, and there is no ghosting, flicker or halos.
- **HUD V1:**
  - Layout is about 9/10.
  - Animation cadence matches.

    | Region | Motion, reference | Motion, V1 |
    |---|---|---|
    | Grid | 0.77 | 0.82 |
    | Gauges | 0.67 | 0.59 |
    | Counter | 0.73 | 0.71 |

  - Camera is locked off.
  - There are no overlaps or clipping.
- **HUD V2:** the palette change is obvious at a glance. Layout and animation are identical to V1, and readability is good.

**Defects found by QC and review, all fixed before delivery:**
1. **Pixel format:** the first renders were tagged full-range `yuvj420p`. The frame pipeline was switched to PNG with BT.709 tagging, giving standard `yuv420p` TV range.
2. **HUD animation fidelity:**
   - The bottom cards now stay on screen after building in.
   - Grid highlights are busier and gauges thicker.
   - The counter steps sequentially.
   - Typography is bolder.
   - A text overlap in the info box was removed, and an orange rule that struck through numbers was shortened.
3. **DNA look:** the first version scored 4/10. It was reworked with a translucent holographic helix, HUD layers around it, the reference's cool grade and lifted blacks, much shallower depth of field, a slow dark opening and corrected late framing.
4. **One corrupted frame (DNA, 13.0 s):** a SwiftShader rasteriser bug drew a huge two-triangle plane with wrong UVs. Large planes are now subdivided into smaller triangles.
5. **Crawling dark outlines around defocused foreground beads:** the DOF composite now spreads near-field blur coverage.
6. **DOF "ghost" helix and a 6-level brightness pop (DNA V2, about 5 s):** these came from faint overlay HUD layers. Those layers no longer write depth, and the ceiling layer fades as the crane passes through it.

**Remaining minor differences, judged not worth a re-render by the reviewer:**
- **DNA V1:**
  - The 4–6 s tilt is a little brisker than the reference.
  - The beads are slightly smoother than the reference's textured ones.
  - A few small star-shaped bokeh particles remain.
- **DNA V2:**
  - The opening is crisper than V1's soft opening.
  - The ceiling-layer text overlaps floor text at 3.5–6.5 s.
  - Two or three soft white orbs drift near the floor at 13–20 s.
- **HUD:**
  - The counter font is a rounded sans, not the reference's squarer techno face.
  - Micro-text is slightly lighter than the reference's.

## 4. Project ZIPs: complete and reproducible

| Check | DNA ZIP | HUD ZIP |
|---|---|---|
| Archive integrity (`unzip -t`) | ✔ no errors (31 files) | ✔ no errors (28 files) |
| Contents | `src/` (React + Three.js scene, GLSL post, camera paths), `public/fonts/` (5 woff2 + OFL licences), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint/Prettier config, `README.md` | `src/` (Canvas 2D HUD, palettes), `public/fonts/` (5 woff2 + OFL licences), the same config files, `README.md` |
| Fresh extract + `npm ci` | ✔ | ✔ |
| `npx remotion compositions` shows both comps at **3840×2160, 30 fps, 600 frames** | ✔ | ✔ |
| Documented render command works | ✔ `npx remotion render … --frames=380-409 --scale=0.5`: 1080p H.264, 30 frames, 43.9 dB PSNR against the delivered file (encoder-only difference) | ✔ `npm run render:v1`: 600 frames, **frame-for-frame identical** (decoded framemd5 match) |
| Native 4K render | ✔ 3840×2160 still (frame 450, V2) | ✔ 3840×2160 still (frame 300, V2) |
| Missing assets / network needed at render time | none: fonts bundled, everything procedural and deterministic | none |
| `tsc` + ESLint | clean | clean |

Render commands are documented in each README: `npm run render:v1`, `render:v2`, `render:v1:4k` and `render:v2:4k`.

On machines without a GPU, add `--gl=swangle` to the DNA renders. It runs at about 2 s per frame at 1080p on 4 CPU cores.

## 5. Checksums (SHA-256, first 16 hex characters)

```
dd69a40277672360  DNA-Helix-HUD_Version-1_Reference-Match_1080p.mp4
a79f06846563d6c9  DNA-Helix-HUD_Version-2_Orbit-Camera_1080p.mp4
bf48591ce2ef1329  Data-Sequence-HUD_Version-1_Reference-Match_1080p.mp4
6091796f0e14faea  Data-Sequence-HUD_Version-2_Neon-Palette_1080p.mp4
22eb4d68fb79f11b  DNA-Helix-HUD_4K-Remotion-Project.zip
14a30ed263196360  Data-Sequence-HUD_4K-Remotion-Project.zip
```

The reference clips' stock watermark was not reproduced in any output.
