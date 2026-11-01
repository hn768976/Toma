# Quality-Control Report

Two Remotion compositions at 4K (3840 × 2160, 30 fps), each with two versions,
delivered as 1080p H.264 MP4s plus the two project ZIPs.

## Deliverables

| # | File | Composition | Frames | Duration | Size |
|---|------|-------------|--------|----------|------|
| 1 | `NeonTunnel-V1_1920x1080.mp4` | NeonTunnel-V1: matches reference A | 394 | 13.133 s | 12.5 MB |
| 2 | `NeonTunnel-V2_1920x1080.mp4` | NeonTunnel-V2: alternative **colour palette** (magenta/violet) | 394 | 13.133 s | 10.5 MB |
| 3 | `HudLoader-V1_1920x1080.mp4` | HudLoader-V1: matches reference B | 360 | 12.000 s | 0.19 MB |
| 4 | `HudLoader-V2_1920x1080.mp4` | HudLoader-V2: alternative **camera angle + movement** (3D orbit, dolly-in, parallax layers) | 360 | 12.000 s | 1.4 MB |
| 5a | `NeonTunnel_Remotion_4K_Project.zip` | 4K project for 1–2 (WebGL 2 shader) | | | 59 KB |
| 5b | `HudLoader_Remotion_4K_Project.zip` | 4K project for 3–4 (Canvas 2D) | | | 67 KB |

**Why these technologies:**

- **Reference A** is a lit 3D corridor with reflections, so it is built as a ray-traced
  **WebGL 2 fragment shader**.
- **Reference B** is crisp 2D vector UI, so it is drawn with **Canvas 2D** plus additive
  blur glow. Version 2 places those canvases in CSS 3D space for its camera move.

**Why each Version 2 changes what it does:**

- **Tunnel:** the scene is defined by its lighting, so a palette change keeps the concept
  and reads as a clearly different version.
- **HUD:** it is a flat graphic, so a 3D camera move adds the most while keeping its
  colours and timing.

## Technical checks

| Check | Result |
|---|---|
| All 4 videos render successfully | ✅ No errors. Full decode of every file reports zero errors. |
| Codec | ✅ H.264 (High profile), yuv420p, MP4 with `+faststart`. |
| Resolution | ✅ 1920 × 1080 for all four, Lanczos downscale from the 4K masters. |
| Frame rate | ✅ Exactly 30/1, both `r_frame_rate` and `avg_frame_rate`. |
| Duration vs reference | ✅ HudLoader: 12.000 s = 12.000 s exactly. ⚠️ NeonTunnel: 13.133 s vs 13.120 s (see note 1). |
| Colour metadata | ✅ BT.709 primaries, transfer and matrix, limited range. Decoded frames are within 0.9/255 of the source frames. |
| 4K masters | ✅ All four 4K renders complete: 3840 × 2160, 30 fps, exact frame counts. |
| Audio | ✅ No audio track. Reference A has a silent AAC track (−∞ dB throughout) and reference B has none, so there is nothing to reproduce. |
| Corrupted, black or glitch frames | ✅ None unintended. Every dark frame in the tunnel lines up with a dark frame in the reference, and every single-frame flash lines up with a reference flicker (same timestamps and pattern). |
| Flicker, shimmer, aliasing, banding | ✅ Checked at full resolution on rolled neon lines, slanted HUD lines and tick rulers: no stair-stepping, no sparkle, vignette steps under 1 code value, so no banding. |
| ZIP integrity | ✅ `unzip -t` reports no errors on both ZIPs. |
| ZIP contents | ✅ Each ZIP contains:<br>• the 4K compositions (`src/Root.tsx`) and all source<br>• assets (font plus its OFL licence)<br>• `package.json` and `package-lock.json`<br>• `remotion.config.ts`, `tsconfig.json` and the lint config<br>• the render script<br>• a README with commands |
| Extract → install → render | ✅ Done from a fresh extract: `npm ci`, then `npm run lint` (ESLint + tsc pass), then `npm run render:4k:v1` / `npm run render:4k:v2` render 4K H.264 for all four compositions. Those frames match the delivered videos at 44–51 dB PSNR, so the deliveries are reproducible from the ZIPs. |

## Fidelity to the references

The analysis was done at 25 fps to match the references; luminance values are on a 0–255 scale.

**NeonTunnel-V1 vs reference A:**

- Mean luminance error 1.37.
- Luminance-curve correlation 0.94.
- Overall mean RGB (18.1, 19.2, 8.9) vs (17.8, 17.8, 9.7).
- Each lighting beat (fully lit, rectangle only, rectangle + ring, dark, dim ending) is
  within about 1.7 levels in all four cycles.
- Every flicker on/off event is within one frame.
- Camera roll, zoom and centring match the measured reference keyframes.

**HudLoader-V1 vs reference B:**

- Layout and size within a few pixels.
- The counter reaches 100 % at 8.56 s, the same as the reference, and is never off by more than 1 %.
- Counter width 513 vs 515 px (at 768 width).
- The blink rhythm is aligned to the frame (every 0.667 s), with depth 0.22 vs 0.24.
- The build-in draws a hollow outline left to right, as in the reference.

**Version 2s:**

- **NeonTunnel-V2:** the palette clearly differs (bright-pixel RGB 136/71/130 vs V1's 107/93/67).
  Structure and timing are identical to V1 (luminance-curve correlation 0.9997).
- **HudLoader-V2:** the camera clearly differs (structural similarity to V1 only 0.29). The
  counter and blink timing are identical to V1, and the widget stays inside the frame throughout.

## Independent verification

A separate review agent compared each video with its reference over four rounds, working only
from the files themselves.

**Round 1 found:**

- The tunnel's camera roll ran in the opposite direction.
- The flash frames were wrongly framed.
- The glitch warp was too strong.
- The dark level was too low and the vignette too weak.
- The HUD blink was irregular, the bar built in as a filled block, and the counter was too narrow.

All were fixed and confirmed in later rounds. A colour-matrix issue in the 1080p conversion
(BT.601 vs BT.709) was also found and fixed in my own QC.

**Final verdicts:**

| Video | Verdict |
|---|---|
| NeonTunnel-V1 | Minor differences |
| NeonTunnel-V2 | Accurate to brief, clearly distinguishable |
| HudLoader-V1 | Minor differences |
| HudLoader-V2 | Accurate to brief, clearly distinguishable |

No defects were found in the final files.

## Known minor differences

1. **Duration:** the reference A clip is 13.12 s at 25 fps. At 30 fps that would be 393.6 frames,
   and a video can only hold whole frames. 394 frames (13.133 s, +13 ms) is the closest possible
   length. The 12.000 s HUD clip matches exactly.
2. **Tunnel flash frames:** on about 6 of 394 frames (the rolled flashes at 3.6 s and 7.2 s and
   the glitch at 10.4 s), the faint floor ghost is a defined panel rather than the reference's soft
   offset blur, and the warped glitch line is crisper.
3. **Tunnel vignette:** in cycles 2–4 it is slightly milder or stronger at some moments
   (corner-to-wall ratio 0.56–0.94 vs 0.64–0.88).
4. **HUD typeface:** the reference's font is unknown; Orbitron Bold (open licence) is used,
   stretched to the reference's width. The tick ruler under the bar is a simpler dash pattern.
5. **Watermark:** the iStock watermark on the reference previews is intentionally not reproduced.
