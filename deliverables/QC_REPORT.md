# QC Report: Petal Swirl and Fire Ring

**Result: PASS.** All four videos and both project ZIPs pass every technical check. Accuracy against the reference was judged by independent verification agents; their scores and remaining differences are listed below.

## Deliverables

| # | File | Comp ID (4K) | Size | SHA-256 |
|---|------|--------------|------|---------|
| 1 | `1_PetalSwirl_V1_Reference_1080p.mp4` | `PetalSwirl-V1-Reference` | 4.00 MB | `17a06b5e…6a0a643` |
| 2 | `2_PetalSwirl_V2_Blush_1080p.mp4` | `PetalSwirl-V2-Blush` | 4.02 MB | `0f67ea51…0226217` |
| 3 | `3_FireRing_V1_Reference_1080p.mp4` | `FireRing-V1-Reference` | 27.77 MB | `b4d2b603…428f3d8` |
| 4 | `4_FireRing_V2_Plasma_1080p.mp4` | `FireRing-V2-Plasma` | 30.99 MB | `46d4df57…877f2` |
| 5 | `PetalSwirl_4K_Project.zip` | both petal comps | 58 KB | `ae77707c…f30aa5` |
| 6 | `FireRing_4K_Project.zip` | both fire comps | 58 KB | `b9060d4e…096e` |

Full checksums can be regenerated with `sha256sum *.mp4 *.zip`. The values are listed at the end of this report.

## 1. Video specifications (ffprobe, full decode)

| Check | Petal V1 | Petal V2 | Fire V1 | Fire V2 | Result |
|---|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High | ✅ |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 | ✅ |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | ✅ exactly 30 |
| Frames: ours / reference | 270 / 270 | 270 / 270 | 277 / 277 | 277 / 277 | ✅ match |
| Duration | 9.000 s | 9.000 s | 9.233 s | 9.233 s | ✅ (see note) |
| Pixel format / colour | yuv420p, tv/bt709 | same | same | same | ✅ |
| Bitrate (CRF 16) | 3.56 Mbps | 3.57 Mbps | 24.1 Mbps | 26.9 Mbps | ✅ |
| Audio streams | 0 | 0 | 0 | 0 | ✅ (references have none) |

**Duration note.** The references are 29.97 fps: 270 frames run 9.009 s and 277 frames run 9.243 s. The brief requires exactly 30 fps, so each video matches its reference frame for frame, and it plays 0.009 s shorter.

## 2. Integrity and image quality

| Check | Petal V1 | Petal V2 | Fire V1 | Fire V2 |
|---|---|---|---|---|
| Decode errors (`ffmpeg -v error`, full decode) | none | none | none | none |
| Black frames (`blackdetect`) | none | none | none | intentional, see below |
| Luma min / max / mean (YAVG) | 177.1 / 177.4 / 177.3 | 151.1 / 151.3 / 151.2 | 27.5 / 165.6 / 76.7 | 24.0 / 156.2 / 72.0 |
| Largest frame-to-frame luma jump | 0.10 | 0.09 | 3.75 | 3.78 |
| Flicker events (alternating jumps above 2 levels) | 0 | 0 | 0 | 0 |
| Loop seam, frame 269 → 0 | clean (PSNR 41.2 dB) | clean | n/a (one-shot) | n/a |

**Fire V2 black frames.** `blackdetect` flags frame 0 and 9.1–9.2 s. These are the intended empty dark-navy background before ignition and after the smoke clears, the same beats as the reference: reference start luma 27.3, V1 27.5, V2 24.0. They are not dropouts.

The fire luma jumps of about 3.8 are the ignition flash and track the reference's own curve. The fire V1 luma curve correlates with the reference at **r = 0.991**.

Verification agents also reviewed the videos visually and found no banding, blocking, popping or artefacts.

## 3. Project ZIPs

**Contents.** Each ZIP contains:
- `package.json` and `package-lock.json`
- `remotion.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`
- `README.md`
- `public/`
- the full `src/`

`node_modules/` and `out/` are excluded. Both projects are fully procedural (Three.js geometry and a GLSL shader), so no external assets can go missing.

**Integrity.**
- `unzip -t` reports no errors for either ZIP.
- Extracted contents are byte-identical (`diff -r`) to the committed source that rendered these videos.

**Clean-room test.** Each ZIP was extracted into an empty folder and run with the README commands:

| Step | PetalSwirl | FireRing |
|---|---|---|
| `npm ci` | ✅ 372 packages | ✅ |
| `npx tsc --noEmit` | ✅ | ✅ |
| `npx remotion compositions` | ✅ V1 and V2 at 3840×2160, 30 fps, 270 frames | ✅ V1 and V2 at 3840×2160, 30 fps, 277 frames |
| 4K proof render | ✅ V1 f0–4 and V2 f0–4 | ✅ V1 f60–69 and V2 f80–84 |
| Proof output | H.264, 3840×2160, yuv420p, 30/1 | same |

The PetalSwirl V2 4K proof averages YAVG 151.1, against 151.2 for the 1080p deliverable. The 4K comps and the 1080p deliverables are the same render: each 1080p file is the 4K composition rendered at `--scale=0.5`, and the canvases render at device pixel ratio, so the 1080p output is native, not a downscale.

**Render commands** (also in each README):
```bash
npm ci
npx remotion render <CompID> out/<name>-4K.mp4                  # 4K master
npx remotion render <CompID> out/<name>-1080p.mp4 --scale=0.5   # 1080p deliverable
```
`remotion.config.ts` sets H.264, yuv420p, bt709, CRF 16 and the software `swangle` WebGL backend, which works on any machine. On a machine with a GPU, add `--gl=angle` for much faster renders.

## 4. Accuracy against the reference (independent verification agents)

Each round used a fresh agent that was given only the files, with no knowledge of my intended result. Each agent built side-by-side contact sheets, per-region colour statistics, motion curves and loop-seam checks.

### Petal Swirl V1 vs reference A: final score 6.5 / 10
Five review rounds scored 5.5 → 7 → 6.5 → 6 → 6.5. Fixes between rounds included unison sway, the twist profile, a pale hole, neutral shadows, and per-disc brightness traced from the reference.

**Matches:**
- Layout: disc centres within about 10 px, the same sizes and the same stacking order.
- No camera move.
- About 21–23 flutes against about 20–25 in the reference, with the same swirl direction and a close twist profile.
- Same overall luma (186.5 vs 186.7).
- Per-disc brightness within about 10 levels.
- Scalloped rims.
- The same 90-frame motion period, three cycles per clip.

**Remaining differences:**
1. **Motion.** The reference's flutes and rim ripples travel forward continuously. Ours rock back and forth in unison with a smaller amplitude.
2. **Shadows.** Cast shadows are crisper and slightly deeper than the reference's soft occlusion.
3. **Material.** Ours is a more matte satin; the reference is pearlescent, with warm highlights and a cooler cyan-grey body.
4. **Flutes.** Ours are more regular and run all the way into the hub. The reference's pleats are irregular and fade near the centre. Its hole is also about 30% larger.

### Fire Ring V1 vs reference B: final score 7 / 10
Three review rounds scored 5 → 6.5 → 7.

**Matches:**
- Luma curve correlation 0.991.
- Ignition, fill-in, cooling and dissipation timing.
- The hole size and position through the smoke phase.
- Cream, amber and orange to grey colour progression.
- Dark corners.

**Remaining differences:**
- Softer, procedural flame texture against the reference's crisp simulated wisps.
- Fire covers slightly more of the frame at its peak (about 97% vs 86%, f70–130).
- The early ring is not fluted.
- The hole is a little small at f50–70.

### Version 2 distinctness: ✅ both clearly distinct
- **Petal V2 Blush:** blush-pink discs, mauve hue-shifted shadows and maroon hubs (mean luma 163 vs V1's 186), with the same design and motion. The verdict was "clearly distinct and well made".
- **Fire V2 Plasma:** a cold palette with a white-cyan core, electric blue and violet flames, and indigo smoke on navy, with the same simulation and timing. The verdict was clearly distinct.

## 5. Checksums (SHA-256)
```
17a06b5e379e59b80450d19444d37de7f00029d11626e54f97277a19f6a0a643  1_PetalSwirl_V1_Reference_1080p.mp4
0f67ea514ff163035b379d38678730eaf2fa9f116390ccd3fe6b68ce10226217  2_PetalSwirl_V2_Blush_1080p.mp4
b4d2b60390fe2fb9641cf799472a904bd63163fdb017c47bbabfb1403428f3d8  3_FireRing_V1_Reference_1080p.mp4
46d4df5719087d5734d7af0120889b772b6cd9d8f0785f4d8845064cfbb877f2  4_FireRing_V2_Plasma_1080p.mp4
b9060d4ea5ca726582d51b2bc1bcf13887335f15a4723c4b704df53e6423096e  FireRing_4K_Project.zip
ae77707c439b834718f8aeaf60ca9b57c14510efa5e727145d9baa0003f30aa5  PetalSwirl_4K_Project.zip
```
