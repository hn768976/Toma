# Quality-control report

All four videos render without errors and pass every technical check. Durations match the references to the frame, and every file is H.264, 1920×1080, 30 fps. Both ZIPs extract, install and re-render the deliverables. The visual match to the references was checked independently, as described in section 3.

**Deliverables** (all in `deliverables/`):

| # | File | Contents |
|---|---|---|
| 1 | `Composition1_HoloGlobe_V1_1080p.mp4` | Holographic binary globe. Matches the reference. |
| 2 | `Composition1_HoloGlobe_V2_1080p.mp4` | Holographic binary globe. Alternative **camera angle and movement**. |
| 3 | `Composition2_MarketFlythrough_V1_1080p.mp4` | Stock-market fly-through. Matches the reference. |
| 4 | `Composition2_MarketFlythrough_V2_1080p.mp4` | Stock-market fly-through. Alternative **colour palette** (amber). |
| 5 | `Composition1_HoloGlobe_4K_RemotionProject.zip`, `Composition2_MarketFlythrough_4K_RemotionProject.zip` | Remotion projects. Each holds both 4K (3840×2160) compositions. |

**How it was built:**

- Both projects were scaffolded with the Remotion CLI (`npx create-video@4.0.539 --blank`).
- Rendering uses **Three.js 0.180 / WebGL 2 with custom GLSL shaders**.
- The market composition also uses **Canvas 2D** textures for the ticker tables, candlesticks and flares.
- Each composition is authored at 4K. The 1080p deliverables are rendered from those same compositions with `--scale=0.5`.

## 1. Technical checks on the final MP4s

I checked each file with `ffprobe` (counting every frame), did a full `ffmpeg` decode, and ran `blackdetect` and a per-frame luma analysis.

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Renders successfully | ✅ | ✅ | ✅ | ✅ |
| Codec | H.264 High, MP4 | H.264 High, MP4 | H.264 High, MP4 | H.264 High, MP4 |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Pixel format / colour | yuv420p, BT.709, TV range | same | same | same |
| Frame rate | exactly 30/1, constant | 30/1 | 30/1 | 30/1 |
| Frames (reference) | 900 (900) | 900 (900) | 400 (400) | 400 (400) |
| Duration (reference) | 30.000 s (30.000 s) | 30.000 s (30.000 s) | 13.333 s (13.333 s) | 13.333 s (13.333 s) |
| Decode errors / corrupt frames | none | none | none | none |
| Black frames (`blackdetect`) | none | none | none | none |
| Audio | none (reference has none) | none | none | none |
| Largest frame-to-frame luma change | 7.8 (intro digits rushing in) | 3.7 | 9.8 * | 11.9 * |
| Size / bitrate | 74.2 MB / 19.8 Mb/s | 59.1 MB / 15.8 Mb/s | 13.5 MB / 8.1 Mb/s | 15.3 MB / 9.2 Mb/s |

\* The only jump above 8 luma happens where the camera flies through the giant ticker table and the letters leave the frame (~6.6 s). The reference has the same kind of pass-through jump (18.4 at 8.1 s). This is intended motion, not flicker.

**Timing checks:**

- **Brightness curves match the reference.** C1 V1 rises to its peak of 97 luma at 2–3 s, against 97 at 2 s in the reference. Its steady section sits at 44–56, against 39–48. C2 V1 averages 57.7 luma, against 60.1, and has the same rise-and-fall shape, including the bright finale.
- **Globe rotation timing matches.** The continents face the camera at the same times as in the reference: Africa at 3 s, the Americas at about 10 s, the Pacific at about 15 s, Asia/Australia at 18–24 s, then Africa again at 26–30 s.

## 2. Project ZIP checks

| Check | Result |
|---|---|
| ZIP integrity (`unzip -t`) | ✅ both ZIPs, no errors |
| Contents | ✅ Full source (`src/`), compositions (`Root.tsx`, 4K 3840×2160, 30 fps, 900 / 400 frames), fonts with their OFL licences (`public/`), `package.json` plus `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint and Prettier config, and a README with the commands. The world map data comes from the pinned `world-atlas` npm package. |
| Clean extract → `npm ci` | ✅ Installs from the lockfile on Node 22. |
| `npm run lint` (ESLint and `tsc`) | ✅ 0 errors. |
| `npx remotion compositions` | ✅ Lists `HoloGlobeV1/V2` and `MarketFlythroughV1/V2`, all 3840×2160 at 30 fps, 30.00 s and 13.33 s. |
| Documented render commands | ✅ `npm run render:v1:4k` gives H.264 at 3840×2160. `npm run render:v1` and `npm run render:v2` give H.264 at 1920×1080. All are yuv420p at 30 fps. |
| Reproducibility | ✅ Frames rendered from the extracted ZIPs against the same frames in the delivered MP4s: PSNR 41.2, 45.0, 46.2 and 45.4 dB, which is visually identical (the remainder is encoder noise). Rendering is deterministic: a seeded RNG drives it, and every frame is a pure function of the frame number. |
| 4K quality | ✅ Native 4K frames inspected: crisp glyphs and text, with line widths and point sizes scaled to the resolution. |

## 3. Visual verification by independent reviewer agents

Independent reviewer agents compared each render with its reference, frame by frame (side-by-side contact sheets, luma and colour statistics), and looked for defects. Each review was acted on, and the affected videos were re-rendered.

**Composition 1: Holo Globe**

- **V1:**
  - Same beats as the reference, in order:
    1. ~0.3 s of navy.
    2. Huge, defocused digits rushing in.
    3. A dense digit wall with a glow burst from the data panels at about 2 s.
    4. Africa revealed.
    5. Pull-back to the ringed globe, which spins west to east for the rest of the clip.
  - Same globe size and position as the reference, the same rings, binary read-outs, panels and network.
  - The final reviewer scored it 7/10.
  - Remaining differences are stylistic: the intro digits are more orderly than the reference's motion-blurred streaks, there are slightly fewer orbiting data panels, and the background is a darker navy.
- **V2 (camera alternative):**
  - Shot sequence:
    1. A top-down dive out of the Arctic.
    2. A low "orbital horizon" flight between the rings, with the planet's curved edge filling the lower frame.
    3. A rising crane up to a high three-quarter view.
  - The reviewer found it clearly different, with the concept and quality preserved.
- **Fixed after review:**
  - **Intro strobing:** the globe spun at full speed while the camera was right at the surface, so the digits flickered. The spin now eases in.
  - **Colour:** re-sampled from the reference.
  - **Burst brightness:** calibrated to the reference's luma curve.
  - **V2 label pop:** a label close to the camera disappeared in one frame at 19.1 s. It now fades out.
  - **V2 alternative:** strengthened so it is clearly distinguishable.
- **Defects remaining:** none found.

**Composition 2: Market fly-through**

- **V1:**
  - Same beats as the reference, in order:
    1. Push in on a steep chart drawing itself, with ticker walls and starburst hubs.
    2. The dot-matrix "LED" chart sweeps past the camera (~4.8 s).
    3. Dive into a ticker table until the symbols fill the frame (5.3–6.6 s).
    4. A second LED chart passes (~8 s).
    5. A medium drift over a chart, tables and candlesticks.
    6. Dissolve into green haze, network lines and a laser beam.
- **V2 (palette alternative):** the same shot in an amber "trading terminal" palette. The reviewers found it clearly different, with the concept and quality preserved.
- **Fixed after review:**
  - LED chart rebuilt as an upright dot-matrix instead of a dashed ribbon.
  - Faster push-in, and fly-pasts re-timed to the reference.
  - Palette re-sampled to the reference's emerald (no red cast).
  - Brightness calibrated to the reference, including a brighter finale.
  - Candlesticks and hubs strengthened.
- **Final review on the delivered renders:**
  - Beat timing matches closely: the ticker-to-wide transition lands at frame 198 against the reference's 199, and the LED chart exits at frame 238 against 244.
  - No serious defects: no black frames, freezes, garbled frames, banding or timing jumps.
  - The reviewer scored V1 at 6/10. The remaining gap is framing: the reference's camera sits closer and lower, with elements spilling off the edges of the frame. Its starbursts are spiky particle clusters where ours are lens-flare stars, and its candlesticks are more prominent.
  - V2 is clearly distinguishable and keeps the concept and quality. It is slightly darker than V1.

Note on fidelity: both references are stock footage, and the match is in look, timing and camera beats. The ticker symbols and prices are randomly generated and fictional, and no watermark has been reproduced.

## 4. Re-rendering

Rendering is CPU-only (SwiftShader, `--gl=swangle`) and works without a GPU. On this 4-vCPU machine it took about 1.6 s per frame at 1080p. On a machine with a GPU, add `-- --gl=angle` to the render command for a large speed-up. See each project's `README.md`.
