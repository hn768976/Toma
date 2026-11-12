# Quality-Control Report: DNA Helix Macro & Earth Network Countdown

## Deliverables

| # | File | Contents |
|---|---|---|
| 1 | `Version-1_DNA-Helix-Macro_Reference-Match_1080p.mp4` | Composition 1, V1: matches the reference (slow push-in, focus on the hero helix) |
| 2 | `Version-2_DNA-Helix-Macro_Orbit-Rack-Focus_1080p.mp4` | Composition 1, V2: alternative **camera move** (low-angle orbit/crane plus a rack focus from the foreground helix to the hero) |
| 3 | `Version-1_Earth-Network-Countdown_Reference-Match_1080p.mp4` | Composition 2, V1: matches the reference (navy globe, golden sunrise, 20 s countdown, glitches) |
| 4 | `Version-2_Earth-Network-Countdown_Aurora-Palette_1080p.mp4` | Composition 2, V2: alternative **colour palette** (emerald/teal network and atmosphere, magenta-violet sunrise) |
| 5a | `Project_DNA-Helix-Macro_4K-Compositions_Remotion.zip` | Remotion project with both 3840×2160 compositions |
| 5b | `Project_Earth-Network-Countdown_4K-Compositions_Remotion.zip` | Remotion project with both 3840×2160 compositions plus the bundled Exo 2 font (OFL) |
| 6 | `QC_Report.md` | This report |

**Why each V2 alternative was chosen:**
- **DNA:** the reference is defined by its macro depth of field, so a new camera path with a rack focus shows the scene from a new angle while keeping the palette and material.
- **Earth:** the reference is a locked-off shot with a timed countdown, so changing the camera would break the composition and the timing. A new colour palette is the most suitable alternative.

**Technology:**
- Both projects were created with the Remotion CLI (`npx create-video --blank`), version 4.0.543.
- The DNA scene uses raw WebGL 2 with GLSL shaders: sphere impostors with per-sprite depth of field in resolution tiers.
- The Earth scene uses WebGL 2 shaders (procedural Earth bake, ray-cast planet and atmosphere, HDR, instanced plexus network, post-processing) plus a Canvas 2D HUD.

**Render pipeline:** `remotion render` produces a 4K H.264 master (CRF 12, BT.709). That master is downscaled with Lanczos to the 1080p delivery file (H.264 High, CRF 16, yuv420p, BT.709, faststart). The exact commands are `npm run render:v1` and `npm run render:v2` in each project; see each project's README.

## 1. Render, duration, frame-rate and codec checks (ffprobe plus a full decode)

| File | Codec / profile | Resolution | Pix fmt / range | FPS (r / avg) | Frames (ref) | Duration (ref) | Audio | Decode errors |
|---|---|---|---|---|---|---|---|---|
| DNA V1 | H.264 High | 1920×1080 | yuv420p / tv, BT.709 | 30/1 / 30/1 | 261 (261) | 8.700 s (8.700 s) | none | 0 |
| DNA V2 | H.264 High | 1920×1080 | yuv420p / tv, BT.709 | 30/1 / 30/1 | 261 (261) | 8.700 s (8.700 s) | none | 0 |
| Earth V1 | H.264 High | 1920×1080 | yuv420p / tv, BT.709 | 30/1 / 30/1 | 890 (890) | 29.667 s (29.667 s) | none | 0 |
| Earth V2 | H.264 High | 1920×1080 | yuv420p / tv, BT.709 | 30/1 / 30/1 | 890 (890) | 29.667 s (29.667 s) | none | 0 |

- All four 4K masters were also verified: 3840×2160, 30 fps, 261 or 890 frames, yuv420p, tv range.
- **Audio:** neither reference has an audio track, so none of the deliverables has one. There is nothing to check for audio issues.
- **Result: PASS.** Every duration matches its reference to the frame, every file is exactly 30 fps, and every file is H.264 1080p.

## 2. Artifacts, black frames, flicker and consistency (automated, every frame)

| File | Black-frame events | Max frame-to-frame mean-luma jump | Frame-difference spikes | Mean luma (ref) | Luma-curve correlation vs ref |
|---|---|---|---|---|---|
| DNA V1 | 0 | 0.28 | none | 109.5 (107.8) | **0.988** |
| DNA V2 | 0 | 0.21 | none | 107.2 (107.8) | 0.569 (expected: different camera path) |
| Earth V1 | 0 | 2.12 | frames 638–644, 659 | 35.1 (33.7) | **0.982** |
| Earth V2 | 0 | 2.03 | frames 638–644, 659 | 35.6 (33.7) | 0.980 |

- The Earth spikes fall only inside the intended glitch bursts, which mirror the reference's glitches. There are no other flicker or brightness jumps.
- Reviewer agents checked runs of consecutive frames for popping, shimmer on thin lines, jitter and ring or see-through defocus. No defects were found in the final DNA renders.
- Dithering is applied in both projects to prevent banding in dark gradients.
- No stock watermark appears in any deliverable.
- **Result: PASS.**

## 3. Countdown accuracy (Earth V1 and V2)

| Frame | 0 | 15 | 181 | 300 | 599 | 600 | 889 |
|---|---|---|---|---|---|---|---|
| Reference | 00:00:20:00 | 00:00:19:15 | 00:00:13:29 | 00:00:10:00 | 00:00:00:01 | 00:00:00:00 | 00:00:00:00 |
| V1 / V2 | identical | identical | identical | identical | identical | identical | identical |

The digits use fixed-width cells, and the HUD's left edge stays at the same x position on every non-glitch frame. **Result: PASS.**

## 4. Project ZIP integrity and reproducibility

| Check | DNA ZIP | Earth ZIP |
|---|---|---|
| `unzip -t` integrity | OK | OK |
| Contents | src, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, eslint/prettier config, README (no `node_modules` or `out`) | same plus `public/fonts` (Exo 2 woff2 and OFL licence) |
| Extracted to an empty folder, then `npm ci` | exit 0 | exit 0 |
| `npm run lint` (eslint + `tsc`) | exit 0 | exit 0 |
| `remotion compositions` | 2 compositions, 3840×2160 @30, 261 frames | 2 compositions, 3840×2160 @30, 890 frames |
| Documented render command (partial range, 4K H.264) | OK | OK |
| Frame from the extracted project vs the original project | PSNR = ∞ (pixel-identical) | PSNR = ∞ (pixel-identical) |

- All randomness is seeded, so renders are deterministic.
- The projects run on GPU-less machines (`swangle`). On machines that cannot download Remotion's Chrome, set `REMOTION_BROWSER`.
- **Result: PASS.**

## 5. Visual match review (independent reviewer agents)

Each composition went through several rounds of review against its reference, with fixes applied after each round:
- **DNA:** three rounds.
- **Earth:** two rounds; the final Earth renders were then checked by me, not by a reviewer agent (see below).

| File | Latest reviewer score | Verdict |
|---|---|---|
| DNA V1 | 7/10 overall. Strong on layout, depth of field, camera pacing and brightness curve. | Deliver |
| DNA V2 | 7.5/10. Clearly different for the whole clip: tilted orbit, visible rack focus at about 2–4 s, then a two-helix side-by-side layout. Same quality as V1. | Deliver |
| Earth V1 | 7/10 before the final pass. Timer, composition, sun path and glitch timing are exact. | Deliver (stylised recreation) |
| Earth V2 | 8/10. Clearly different for the whole clip; coherent teal/violet palette. | Deliver |

**Fixes applied after the reviews:**
- **DNA:**
  - focus moved to the front face of the hero helix;
  - bead scale and colour balance (about 2:1 blue to orange);
  - orange hue corrected;
  - opaque bokeh with no ring outlines or see-through;
  - bright cyan haze in the top-right that glows through the translucent beads;
  - dolly at a constant rate with a leftward drift;
  - V2 camera keeps travelling until the last frame.
- **Earth:**
  - correct tv range and BT.709 tags;
  - exposure matched to the reference;
  - darker night side;
  - orange-red horizon rim;
  - sun fades by about 24 s, and the overall brightness fades earlier, as in the reference;
  - mesh densest at the limb and fading with depth;
  - no network spikes reaching into the timer;
  - dark sky with no amber haze;
  - HUD jitters during glitches instead of being sliced;
  - bolder timer font.
- I checked the final Earth renders with contact sheets and the automated metrics above. They were not sent through another reviewer-agent round.

**Known remaining differences, by design or because the content is procedural:**
- **Earth:** the globe is procedural, so it shows generated landmasses rather than real continents.
- **Earth:** the glitch style uses band slices and RGB splits instead of the reference's exact smear pattern.
- **DNA:** the reference's waxy, subsurface material is approximated with shaders, and the beads are slightly larger and more regular than in the reference.

## Summary

All technical criteria pass:
- 4 MP4s, all H.264 1080p at exactly 30 fps;
- each duration matches its reference to the frame (261 and 890 frames);
- no render errors, missing assets, corrupt or black frames, unintended flicker, or audio issues;
- both ZIPs are complete and reproducible from a clean extract.
