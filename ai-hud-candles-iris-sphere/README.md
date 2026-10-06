# AI Agents Chip · Mono AI HUD · Candle Dashboard · Iris Burst · Data Sphere

Eight three.js motion graphics (five looks plus three variants) in one Remotion project (Remotion 4 + `@remotion/three`,
WebGL2). Every composition is defined at **3840×2160, 30 fps**.

| Composition id | Look | Frames | Preview file |
|---|---|---|---|
| `AIAgentsChip-Blue` | 1 — AI Agents Chip (2.5D) | 600 (20 s) | `AIAgentsChip_Blue.mp4` |
| `MonoAIHUD-Graphite` | 2 — Mono AI HUD (3D) | 600 (20 s) | `MonoAIHUD_Graphite.mp4` |
| `CandleDashboard-Teal` | 3 — Candle Dashboard (3D) | 600 (20 s) | `CandleDashboard_Teal.mp4` |
| `IrisBurst-Neon` | 4 — Iris Burst (3D) | 450 (15 s) | `IrisBurst_Neon.mp4` |
| `DataSphere-WhiteAmber` | 5 — Data Sphere (3D) | 600 (20 s) | `DataSphere_WhiteAmber.mp4` |
| `AIAgentsChip-LeftCopySpace` | 1, framing variant | 600 (20 s) | `AIAgentsChip_LeftCopySpace.mp4` |
| `MonoAIHUD-Light` | 2, light colour variant | 600 (20 s) | `MonoAIHUD_Light.mp4` |
| `IrisBurst-Mirrored` | 4, mirrored variant | 450 (15 s) | `IrisBurst_Mirrored.mp4` |

Remotion composition ids may only contain letters, digits and `-`, so the ids use
hyphens; the preview files use the underscore names.

### Variants

- **AIAgentsChip-LeftCopySpace:** the same scene and timing as `AIAgentsChip-Blue`. The
  camera is offset (`layout.chipScreenX = 0.3`) so the chip and its "AI Agents" label
  sit about 30% from the left. The map slides right (`mapShiftX`) so the right side is
  calm, empty map for a title, and rain and specks are dimmed on the right half
  (`rightDim`). Nothing is flipped, so all text reads normally.
- **MonoAIHUD-Light:** the same layout, camera and timing as `MonoAIHUD-Graphite`,
  driven by a light palette (`light: true`):
  - Plate `#F2F3F5`, panels `#E2E5EA`, charcoal `#2A2E34` ink and chip outline, a white
    chip face with a charcoal "AI", mint `#1AB88A` meters and a charcoal wireframe
    globe.
  - The build-in fades up from the white plate instead of from black.
  - Bloom is very low (0.12) and the tonemap shoulder is off, so the off-white stays
    exact.
  - Dither and grain stay on.
- **IrisBurst-Mirrored:** `IrisBurst-Neon` with `layout.side = -1`. The ring, planet
  and camera path are reflected across x = 0, which puts the ring right of centre and
  the planet arc on the left. The rim lighting follows the mirrored side. Strand data,
  colours, seeds and timing are unchanged.

## Quick start

```bash
npm install
npx remotion studio          # preview in the browser
```

## Chromium GL flag

WebGL2 runs through ANGLE. `remotion.config.ts` sets `--gl=angle`, the right choice
on a machine with a GPU. On a machine **without** a GPU (CI, cloud containers) pass
`--gl=swangle` (ANGLE on SwiftShader), which is what the 720p previews here used.
WebGPU is not used.

## 4K render commands

Codec (H.264), pixel format (`yuv420p`), CRF 16 and PNG frame capture are set in
`remotion.config.ts`. Output is 3840×2160, 30 fps, with no audio.

```bash
npx remotion render AIAgentsChip-Blue      out/AIAgentsChip_Blue_4K.mp4      --gl=angle
npx remotion render MonoAIHUD-Graphite     out/MonoAIHUD_Graphite_4K.mp4     --gl=angle
npx remotion render CandleDashboard-Teal   out/CandleDashboard_Teal_4K.mp4   --gl=angle
npx remotion render IrisBurst-Neon         out/IrisBurst_Neon_4K.mp4         --gl=angle
npx remotion render DataSphere-WhiteAmber  out/DataSphere_WhiteAmber_4K.mp4  --gl=angle
npx remotion render AIAgentsChip-LeftCopySpace out/AIAgentsChip_LeftCopySpace_4K.mp4 --gl=angle
npx remotion render MonoAIHUD-Light            out/MonoAIHUD_Light_4K.mp4            --gl=angle
npx remotion render IrisBurst-Mirrored         out/IrisBurst_Mirrored_4K.mp4         --gl=angle
```

To watch memory, add `--concurrency=2`. Each tab holds the large canvas textures,
including Mono HUD's 8192×4608 texture.

## Stills (6000×3375)

`--scale=1.5625` turns 3840×2160 into 6000×3375. The canvas follows the render scale,
so the still is rendered natively at 6K, not upscaled.

```bash
npx remotion still AIAgentsChip-Blue     out/AIAgentsChip_Blue_6K.png     --frame=300 --scale=1.5625 --gl=angle
npx remotion still MonoAIHUD-Graphite    out/MonoAIHUD_Graphite_6K.png    --frame=300 --scale=1.5625 --gl=angle
npx remotion still CandleDashboard-Teal  out/CandleDashboard_Teal_6K.png  --frame=300 --scale=1.5625 --gl=angle
npx remotion still IrisBurst-Neon        out/IrisBurst_Neon_6K.png        --frame=300 --scale=1.5625 --gl=angle
npx remotion still DataSphere-WhiteAmber out/DataSphere_WhiteAmber_6K.png --frame=540 --scale=1.5625 --gl=angle
npx remotion still AIAgentsChip-LeftCopySpace out/AIAgentsChip_LeftCopySpace_6K.png --frame=300 --scale=1.5625 --gl=angle
npx remotion still MonoAIHUD-Light            out/MonoAIHUD_Light_6K.png            --frame=300 --scale=1.5625 --gl=angle
npx remotion still IrisBurst-Mirrored         out/IrisBurst_Mirrored_6K.png         --frame=300 --scale=1.5625 --gl=angle
```

## 720p previews

```bash
scripts/render-preview.sh AIAgentsChip-Blue AIAgentsChip_Blue.mp4 swangle
```

This renders the full PNG sequence at `--scale=0.3333333333333333`, which gives exactly
1280×720, into `renders/<id>_png/`. It then encodes `renders/<name>.mp4` with ffmpeg:
H.264, `yuv420p`, 30 fps, CRF 16, no audio. The PNG sequence is kept for the
determinism check.

## Render time

Measured in a GPU-less cloud container (4 vCPU) with `--gl=swangle` (software GL) and
one tab (`--concurrency=1`). With two or more tabs, SwiftShader threads compete and
the render gets slower. Times are wall-clock for the full PNG-sequence render, startup
included.

| Composition | 720p s/frame | 4K s/frame (measured, software GL) | 4K full render, software GL |
|---|---|---|---|
| AIAgentsChip-Blue | 1.09 | ~19 | ~3.2 h |
| AIAgentsChip-LeftCopySpace | 1.08 | ~19 (same scene) | ~3.2 h |
| MonoAIHUD-Graphite | 1.39 | ~31 | ~5.2 h |
| MonoAIHUD-Light | 1.29 | ~31 (same scene) | ~5.2 h |
| CandleDashboard-Teal | 1.38 | ~26 | ~4.3 h |
| IrisBurst-Neon | 0.82 | ~8.3 | ~1.0 h |
| IrisBurst-Mirrored | 0.76 | ~8.3 (same scene) | ~1.0 h |
| DataSphere-WhiteAmber | 0.38 | ~5.3 | ~0.9 h |

The 4K column is a single warm frame (frame 301) timed with `--scale=1`, and it
includes the 3840×2160 PNG capture. 4K costs about 9× the pixels of 720p, but
measures 13–24× slower on software GL, because the large textures and bloom chain
don't scale linearly.

**Estimate on a GPU machine** with `--gl=angle`: not measured here. Rasterising and
post-processing are fill-rate bound, so a desktop GPU should be about 10–30× faster
than SwiftShader, roughly 1–3 s per 4K frame. Frame capture and PNG encoding then
dominate. That is about 10–30 minutes per 20-second composition at
`--concurrency=2–4`.

## Determinism

Remotion renders frames out of order across several tabs, so every value on screen is
a pure function of `useCurrentFrame()`:

- Random data comes from `mulberry32`, seeded at module level, or from a stateless
  integer hash of (id, frame). `Math.random()`, `Date.now()` and `useState`-driven
  visuals are not used.
- `useFrame` serves only as the render hook. With priority 1 it takes over R3F's
  render, and it never reads R3F's clock.
- Canvas textures are redrawn from scratch whenever their frame-derived key changes,
  never incrementally (`lib/canvasTex.ts → redraw`).
- Canvas textures use `willReadFrequently: true`, which keeps them on Chrome's
  software rasteriser. The GPU canvas path draws text glyphs slightly differently
  depending on its glyph-cache state. Before this fix, a cold frame and the same frame
  from a full render differed by ±1 on a few text pixels.
- There are no temporal effects: no TAA and no feedback buffers. Bloom, depth of field,
  dither and grain are recomputed each frame.
- Fonts and Natural Earth data are loaded behind `delayRender` / `continueRender`.

To check, run `scripts/check-determinism.sh <id> swangle`. It renders frames 75 and 300
cold, on their own, and compares them byte-for-byte with the full PNG sequence.

## Banding

- The final pass adds **±1/255 TPDF dither** after bloom, tonemapping and the sRGB
  encode.
- It also adds **1.5% grain** from a fixed hash of (pixel x, pixel y, frame).
- The scene is rendered into half-float targets, so glow falloffs never quantise
  before the final pass.
- The check reads pixel values from frames decoded from the **encoded mp4**, not the
  preview, along dark gradients and glow falloffs. Steps of more than 1–2 code values
  with flat runs in between would indicate banding.

## Rendering approach

- **Post pipeline** (`lib/post.ts`): HDR scene (half-float, 4× MSAA), then bloom
  (threshold, 7-level dual-filter chain), then composite. The composite applies
  exposure, a soft shoulder tonemap, vignette, sRGB encode, grain and dither.
- **Depth of field** is computed inside the shaders, per element, so it also works
  for additive light:
  - Textured panels gather a 16-tap screen-space disk of their own texture, mapped
    through uv derivatives so tilted planes blur correctly (`DOF_TEXTURE`).
  - Candles, bars and tags are drawn as their rectangle convolved with the CoC box,
    so energy is conserved.
  - Strands, lines and points widen with the CoC and dim by the same area.
- **Iris Burst:** 3,000 instanced ribbons with 28 segments each, and 40,000 points.
  All growth, overshoot, sway and drift are computed in the vertex shaders from
  `uTime = frame / fps`.

## Adding a colourway or a framing

1. Open `src/versions.ts`.
2. Copy the row of the look you want, give it a new `id` (for example
   `AIAgentsChip-Violet`) and change the hex values in `palette`. The palette type
   (`ChipPalette`, `HudPalette`, …) lists every colour the look uses.
3. `src/Root.tsx` registers every row as a composition automatically.
4. Render it with the commands above.
5. Looks 1 and 4 also accept a `layout` field:
   - `ChipLayout { chipScreenX, mapShiftX, rightDim }` for copy-space framings;
   - `IrisLayout { side: 1 | -1 }` for mirroring.

## Assets and licences

- **Fonts** (SIL Open Font License 1.1, licence next to each font):
  - Inter: `public/fonts/Inter/`
  - JetBrains Mono: `public/fonts/JetBrainsMono/`
  - Rajdhani: `public/fonts/Rajdhani/`
- **Map data:** Natural Earth 1:50m land (public domain), from world-atlas 2.0.2,
  in `public/data/natural-earth/` with its licence note.
- **Content:** no logos, brands, real tickers or real data. The only words used are
  "AI", "AI Agents", "BIG DATA", "ANALYSIS DATA", "Data Sector : 001" and "T-02". All
  numbers are invented by the seeded generators.

## Completion checklist

Verified on the 720p previews in this repo:

- [x] All 8 previews: 1280×720, 30/1, h264, yuv420p, one video stream and no audio.
      Durations are 20.0 s, except the two Iris Burst versions at 15.0 s.
- [x] Determinism: frames 75 and 300 rendered cold with `remotion still` are
      byte-identical to the same frames of the full PNG-sequence render, for all 8
      compositions (`scripts/check-determinism.sh`).
- [x] Banding: frames decoded from the encoded mp4s were read along dark gradients,
      glow falloffs, the light shaft and the Light theme's off-white plate
      (`scripts/banding.py`), and inspected as 5–8× contrast-stretched crops. There are
      no contour steps; flat runs occur only in uniform near-black.
- [x] Contact sheets (five evenly spaced frames, `scripts/verify.sh`) show each look's
      required beats:
  - glitch build-in;
  - typed "AI Agents" label;
  - copy space on the right for LeftCopySpace;
  - Light theme on an off-white plate;
  - candles printing;
  - ring, then burst, then corona, with the mirrored layout for Mirrored;
  - fly-through, then pull-back, then the ring sphere rotating.
- [x] Text: "AI", "AI Agents" and "BIG DATA" are spelled correctly and never mirrored.
      All other numbers are generated filler. There are no brands or real tickers.
- [x] Motion: frames 299, 300 and 301 show no jumps, flicker or crawl. Frame-to-frame
      mean difference is steady, and the small text, wicks, strands and specks hold
      across zoomed crops.
- [x] Reference comparison by fresh sub-agents: three rounds for each original look,
      with fixes applied after each round. The light theme had two rounds of a
      readability check.
