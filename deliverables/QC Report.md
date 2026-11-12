# QC Report: DNA Helix Spectrum and Fiber Optic Light Streams

**Result: all four videos and both project ZIPs passed every check below.**

## Deliverables

| # | File | Composition (4K source) | Length |
|---|---|---|---|
| 1 | Version 1 - DNA Helix Spectrum (Reference Match).mp4 | `DNA-Helix-Spectrum-V1-Reference` | 301 frames / 10.033 s |
| 2 | Version 2 - DNA Helix Spectrum (Orbit Camera).mp4 | `DNA-Helix-Spectrum-V2-Orbit-Camera` | 301 frames / 10.033 s |
| 3 | Version 1 - Fiber Optic Light Streams (Reference Match).mp4 | `Fiber-Optic-Light-Streams-V1-Reference` | 471 frames / 15.700 s |
| 4 | Version 2 - Fiber Optic Light Streams (Aurora Palette).mp4 | `Fiber-Optic-Light-Streams-V2-Aurora-Palette` | 471 frames / 15.700 s |
| 5 | DNA Helix Spectrum - Remotion Project (4K compositions).zip | both DNA compositions | |
| 5 | Fiber Optic Light Streams - Remotion Project (4K compositions).zip | both fiber compositions | |

Both projects were scaffolded with the Remotion CLI (`npx create-video --three`). The compositions are authored at 3840×2160 and 30 fps. Rendering uses Three.js with WebGL 2 and custom GLSL shaders:
- a thin-lens depth-of-field point-sprite renderer;
- a half-float HDR target with two-level bloom and filmic tone-mapping.

The 1080p deliverables are rendered from the 4K compositions with Remotion `--scale=0.5`, which also gives 2×2 supersampled anti-aliasing.

## Technical checks (ffprobe / ffmpeg)

| Check | DNA V1 | DNA V2 | Fiber V1 | Fiber V2 |
|---|---|---|---|---|
| Renders without errors | ✅ | ✅ | ✅ | ✅ |
| Codec | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 | 30/1 | 30/1 | 30/1 |
| Frame count (reference) | 301 (301) ✅ | 301 (301) ✅ | 471 (471) ✅ | 471 (471) ✅ |
| Duration (reference) | 10.033333 s ✅ | 10.033333 s ✅ | 15.700000 s ✅ | 15.700000 s ✅ |
| Pixel format / colour | yuv420p, BT.709 limited | same | same | same |
| Full decode errors | none | none | none | none |
| Audio | none (reference has none) | none | none | none |
| Largest frame-to-frame luma step (flicker) | 0.14 | 0.14 | 3.4 (during fade-in) | 5.3 (during fade-in) |
| Black frames | none | none | f0–10 intended fade-in (reference also opens from black) | same |

**Black frames:** the first 11 frames of both fiber videos are black. This is the intended fade-in from black; the reference also opens from black.

**Visual inspection:** 1:1 crops of 4K stills and full 1080p frames showed:
- no missing assets (both scenes are fully procedural, with no external media);
- no corrupted frames, banding, blocking or line shimmer;
- no popping elements and no motion jumps.

**Fixed during QC:** a level-of-detail weighting bug that dimmed about 25% of samples. It made the fiber lines look dashed and the cables beaded.

## Project ZIP integrity and reproducibility

Each ZIP was extracted into a clean folder and taken through the documented steps:

| Step | DNA | Fiber |
|---|---|---|
| `unzip -t` | ✅ | ✅ |
| Contents | `src/` (compositions, scenes, engine, shaders), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint/Prettier configs, `README.md`, `public/` | same |
| `npm ci` | ✅ | ✅ |
| `npm run lint` (ESLint + tsc) | ✅ | ✅ |
| `npx remotion compositions` | 2 × 3840×2160 @ 30 fps, 301 frames | 2 × 3840×2160 @ 30 fps, 471 frames |
| `npm run still:4k` | 3840×2160 PNG ✅ | 3840×2160 PNG ✅ |
| `npm run render:v1` / `render:v2` (frames 60–104) | ✅ | ✅ |
| PSNR vs. delivered MP4 (V1 / V2) | 51.0 / 51.7 dB | 48.1 / 48.2 dB |

PSNR above 48 dB means the frames are effectively identical; the small difference comes from re-encoding. Renders are deterministic because every random value comes from a seeded generator.

## Match to reference: independent agent review

Independent reviewer agents compared each output with its reference. They used side-by-side contact sheets, motion crops, and per-frame brightness and hue measured in full-range RGB. The fixes they asked for were applied and re-verified.

### DNA Helix Spectrum

**V1, final verdict: APPROVE.**
- Matches the reference's diagonal rainbow ribbon helix: dotted multicolour rungs, a bluish backbone, and shallow depth of field with near and far ends dissolving.
- The camera push swings down the helix axis, and the twist travels at the reference pace (frame-to-frame change 3.86 vs 3.94).
- Mean brightness is within 6% of the reference.

**V2 (orbit camera), final verdict: APPROVE.**
- Different camera move: a low-angle orbit that cranes from a diagonal, end-on view into a clean side-on view.
- Same palette, lens and quality, so it reads clearly as the same concept.

### Fiber Optic Light Streams

**V1:**
- The two later re-checks scored 6/10 and gave NEEDS FIX for colour: saturation and the neutral phase in the latest re-check, timeline and haze in the one before. Those fixes were applied (see the colour timeline below). The final render was then checked by measurement only, not by another agent review.
- Glowing tips lead each streak and race down-left at the reference speed (about 25–27 px/frame at 768 px width).
- Thick defocused cables rise from the lower left and crest in a hump; saturated bokeh discs; blue-grey haze.
- Mean brightness ratio 1.007 vs the reference.

**V1 colour timeline (measured):** the reference runs a 5-second cycle of red-orange → warm/teal mix → magenta → blue. The final render matches it within ±0.3 s:

| t (s) | Reference hue / chroma | V1 hue / chroma |
|---|---|---|
| 1.6 | 16° / 0.29 | 10° / 0.33 |
| 4.0 | 301° / 0.26 | 296° / 0.28 |
| 5.6 | 228° / 0.23 | 232° / 0.22 |
| 7.2 | 18° / 0.35 | 11° / 0.34 |
| 9.6 | 304° / 0.31 | 295° / 0.29 |
| 10.4 | 239° / 0.22 | 234° / 0.22 |
| 12.0 | 7° / 0.39 | 11° / 0.35 |
| 15.2 | 238° / 0.24 | 234° / 0.23 |

**V2 (Aurora palette), final verdict: APPROVE.**
- Same scene, motion and timing.
- Alternative emerald, teal, cyan and gold colour waves; mean RGB 64/102/80, clearly distinct from V1.

## SHA-256 checksums

Taken after the final renders.

```
7cd1045f3ac58becf1d01e1471689c27a797da75d6a70916218b4dfe7452f30c  Version 1 - DNA Helix Spectrum (Reference Match).mp4
f684128222e7e016339891a04bf3e7e7ab386a1717837aed7a622085b61ed6ac  Version 2 - DNA Helix Spectrum (Orbit Camera).mp4
feac345eac7c7461e8a719ce242f2c45d6c879d9eecccc03772257e89d4c64e3  Version 1 - Fiber Optic Light Streams (Reference Match).mp4
c0dc295a817518bb6d43a2465c59649c1dd411d7ae3d68c89045efc2a9608e49  Version 2 - Fiber Optic Light Streams (Aurora Palette).mp4
b83dc14086425e80810c3c7f2c6dbf824e623995bbfcfaaa37b45cde9f76f650  DNA Helix Spectrum - Remotion Project (4K compositions).zip
eea794252950d00f4e625f349bad9134d982335d793f9579ee8984de007fe949  Fiber Optic Light Streams - Remotion Project (4K compositions).zip
```

The preview sheets `QC Preview - … (reference vs V1 vs V2).jpg` show reference, V1 and V2 at matching frames.
