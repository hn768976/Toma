# Hyperspace Wormhole · Coin Growth · Hologram Threat Map · Sparkle Burst

One Remotion project, **6 compositions**, all defined at **3840×2160, 30 fps**.
Everything is built in code (no MCP servers, no AI-generated images, no stock clips).

| Composition id (Remotion) | Output file | Look | Engine | Frames | Loop |
|---|---|---|---|---|---|
| `Wormhole-Violet` | `Wormhole_Violet.mp4` | Hyperspace Wormhole 1A | three.js via `@remotion/three` (WebGL2) | 600 (20 s) | yes |
| `Wormhole-CyanGold` | `Wormhole_CyanGold.mp4` | Hyperspace Wormhole 1B | three.js | 600 (20 s) | yes |
| `CoinGrowth` | `CoinGrowth.mp4` | Coin Growth 2 | three.js | 360 (12 s) | no |
| `HologramThreatMap` | `HologramThreatMap.mp4` | Hologram Threat Map 3 | three.js | 600 (20 s) | yes |
| `SparkleBurst-Blue` | `SparkleBurst_Blue.mp4` | Sparkle Burst 4A | **PixiJS 8** (WebGL2) | 360 (12 s) | no, ends on pure black |
| `SparkleBurst-Gold` | `SparkleBurst_Gold.mp4` | Sparkle Burst 4B | PixiJS 8 | 360 (12 s) | no, ends on pure black |

Remotion composition ids may not contain `_`, so the ids use `-`. The output files use the `_` names.

## Quick start

```bash
npm install
npx remotion studio          # opens the Studio with all 6 compositions
```

Versions are pinned in `package.json`: remotion / @remotion/cli / @remotion/three 4.0.532, three 0.180.0,
@react-three/fiber 9.3.0, pixi.js 8.22.0, React 19.2.3.

## Chromium GL flag (important)

WebGL2 in headless Chromium needs ANGLE. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the same as passing **`--gl=angle`**.
On a machine with a GPU, ANGLE uses it. On a machine without any GPU (like the one these previews were made on),
Chromium falls back to SwiftShader (software WebGL2) under the same flag. That works but is slow; `--gl=swangle` forces it explicitly.
WebGPU is not used anywhere.

To use a specific Chromium headless shell, set `REMOTION_BROWSER=/path/to/headless_shell`.

## 4K render commands (one per composition)

```bash
npx remotion render Wormhole-Violet    renders/Wormhole_Violet_4K.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted --disallow-parallel-encoding
npx remotion render Wormhole-CyanGold  renders/Wormhole_CyanGold_4K.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted --disallow-parallel-encoding
npx remotion render CoinGrowth         renders/CoinGrowth_4K.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted --disallow-parallel-encoding
npx remotion render HologramThreatMap  renders/HologramThreatMap_4K.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted --disallow-parallel-encoding
npx remotion render SparkleBurst-Blue  renders/SparkleBurst_Blue_4K.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted --disallow-parallel-encoding
npx remotion render SparkleBurst-Gold  renders/SparkleBurst_Gold_4K.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted --disallow-parallel-encoding
```

`--disallow-parallel-encoding` lets the ffmpeg override in `remotion.config.ts` apply. That override forces a keyframe at frame 330, so Sparkle Burst's black tail encodes as exact 0,0,0.

For a mastering-grade file of the transition, render Sparkle Burst as ProRes 4444 instead:
`--codec=prores --prores-profile=4444`.

### 720p previews

```bash
scripts/render-previews.sh     # all six at --scale=0.3333333333333333 → 1280×720, H.264 yuv420p CRF 16 + a PNG still each
```

### Stills at 6000×3375

3840 × 1.5625 = 6000 and 2160 × 1.5625 = 3375:

```bash
npx remotion still Wormhole-Violet   stills/Wormhole_Violet_6K.png   --frame=104 --scale=1.5625 --gl=angle
npx remotion still Wormhole-CyanGold stills/Wormhole_CyanGold_6K.png --frame=104 --scale=1.5625 --gl=angle
npx remotion still CoinGrowth        stills/CoinGrowth_6K.png        --frame=300 --scale=1.5625 --gl=angle
npx remotion still HologramThreatMap stills/HologramThreatMap_6K.png --frame=200 --scale=1.5625 --gl=angle
npx remotion still SparkleBurst-Blue stills/SparkleBurst_Blue_6K.png --frame=66  --scale=1.5625 --gl=angle
npx remotion still SparkleBurst-Gold stills/SparkleBurst_Gold_6K.png --frame=66  --scale=1.5625 --gl=angle
```

All renderers draw at the real output resolution: three.js uses `dpr = window.devicePixelRatio`, which is Remotion's scale, and Pixi uses `resolution: devicePixelRatio`. So 6K stills are rendered natively, not upscaled.

## Engines and how each look is built

- **Hyperspace Wormhole (three.js).** About 3,000 instanced ribbons on a curving, twisting tunnel, computed in a vertex shader:
  - **Ribbon types:**
    - 160 thick, soft ribbons with a fine glitter;
    - fine streaks with bright comet heads;
    - small orange data-block glyphs;
    - 3×450 flash streaks.
  - **Rendering:** additive blending, with an `UnrealBloomPass`. Then a final pass applies ACES filmic, grain and dither.
  - **Loop:** streak depth lives in a repeating segment of length L = 140. Over 600 frames the camera travels exactly 4·L, using integer speed multipliers. The tunnel twist turns one whole turn, the path wobble phases are whole cycles, and the 3 flashes sit at fixed frames (104, 296, 486).
  - **Colourways:** they differ only in hue. Each colour is scaled to the luminance of the same slot in 1A, so cyan does not blow out.
- **Coin Growth (three.js).**
  - **Coins:** plain coins built as `LatheGeometry`, with a raised rim and a recessed field. The reeded edge comes from a procedural tangent-space normal map. They use `MeshStandardMaterial` (metalness 1) lit by the shipped Poly Haven studio HDRI plus warm and cool key lights. There are no designs, numbers or portraits.
  - **Dropping:** every coin follows a fixed, seeded drop schedule. It falls on a t² curve, then does a small damped-abs-sine bounce. There is no physics.
  - **Floor:** a glossy floor that fades out at the back. Under it sits a mirrored copy of the stacks with a rougher material, so the reflection reads soft.
  - **Backdrop:** a canvas texture with:
    - a blurred Natural Earth map;
    - a grid;
    - candlestick and line charts;
    - made-up labels;
    - warm and cool light leaks.
  - **Double-exposure overlay:** grid, tall candles, a ticker strip of made-up symbols and a warm leak, drawn over everything.
  - **Arrow:** a white ribbon that draws on (`discard` beyond progress), with an arrowhead.
  - **Camera:** slow push-in and drift.
- **Hologram Threat Map (three.js).**
  - **Land:** Natural Earth land is rasterised to a canvas. A 0.42° grid of square dots is drawn as a `Points` shader (about 60k land dots plus faint ocean tiles). Instanced translucent blocks rise on a coarser grid, with height from seeded value noise.
  - **Hotspots:** four hotspot regions blend dots toward orange. Each pulses with a period that divides 600 (60, 100, 120, 150 frames). There is also a vertical coastal flare.
  - **Streams:** ribbons of dashes that slide by a whole number of dash periods per loop.
  - **HUD:** sprites drawn with JetBrains Mono, including tags, labels, target circles, panels and tick bars.
  - **Depth of field:** computed analytically. Each pixel's view ray is intersected with the map plane, and a 64-tap golden-angle disc blur is applied. Additive particles have no depth buffer, so this avoids needing one.
  - **Camera:** drift on a closed sin/cos path.
- **Sparkle Burst (PixiJS 8).**
  - **Pixi setup:** one `Application` with `preference:'webgl'`, `autoStart:false` and `preserveDrawingBuffer:true`. The ticker is stopped, and there is one `app.render()` per Remotion frame. Init and textures sit behind `delayRender` / `continueRender`.
  - **Particles:** 150,000 `Particle`s in one `ParticleContainer`, with an additive blend. Per-particle data (start position, direction, speed, size, brightness, death time) is built once in `Float32Array`s from a seeded `mulberry32`.
  - **Projection:** each frame, every 3D position is computed from the frame number and projected in JS.
  - **Textures:** these come from one procedural atlas: spark, star, 7 bokeh discs chosen by projected size (alpha drops as discs grow), and a streak. Streaks are oriented along the analytic screen velocity.
  - **Light:** a core glow, the burst flash, 11 soft light shafts and 4 rainbow-tinted light leaks.
  - **Dither:** a custom `Filter` adds ±1/255 dither. It is gated off on pure black, and the filter is removed entirely from frame 330.
  - **Two moments of the timeline:** at frame 0 the ball is small enough that the frame corners are exactly 0,0,0. Frames 330–359 render nothing at all.

**Sparkle Burst is a transition element.** It is designed on pure black so it can be laid over footage
with **Screen** or **Add** blending: black adds nothing, and the burst lights the plate underneath.

## Determinism

Remotion renders frames out of order on several tabs, so every value on screen is a pure function of
`useCurrentFrame()`:

- **Seeded randomness only:**
  - every random value comes from `mulberry32` streams seeded at module level (`src/lib/random.ts`);
  - shader grain uses an integer hash of (pixel, frame), or a float hash in the Pixi filter;
  - `Math.random()` is never used.
- **No hidden state:**
  - no physics, no stepped simulation, no `Date.now()`, no `useState` driving visuals, no values carried between frames;
  - `useFrame` is used only as R3F's render hook (priority 1 → our composer renders). R3F's clock is never read.
  - no TAA, no temporal AO, no accumulation.
- **Assets:** the HDRI, fonts and Natural Earth data load behind `delayRender` / `continueRender` (`src/lib/useAsset.ts`).

Loop check: `--props='{"loopCheck":true}'` turns each looping composition into a 601-frame version, so frame
600 can be compared with frame 0 (`scripts/verify.sh`).

## Banding

- **Dither:** ±1/255 after bloom and tonemapping in every look. It is a shader in three.js and a `Filter` in Pixi, and it is not applied on pure black.
- **Grain:** about 2%, from a fixed hash of pixel position and frame, in looks 1–3. Loops use `frame % 600`, so the grain loops too.
- **Measurement:** checked on the **encoded mp4**. See "Measured results" below for the pixel profiles.

## Adding a colourway

1. Add one row to the relevant array in `src/versions.ts`, for example a new `WormholePalette` with `id: "Wormhole_Magenta"`.
2. That's it. `Root.tsx` maps every row to a composition (`Wormhole-Magenta`), and the shaders read colours from the row.
   Wormhole colours are luminance-matched to 1A automatically, so a new hue keeps the same exposure.
3. Add it to `scripts/render-previews.sh` (`COMPS` and `STILL`) if you want a preview.

## Assets and licences (shipped in `public/`)

- `data/ne_50m_land.geojson`: **Natural Earth** 1:50m land. Public domain; see `data/NATURAL_EARTH_LICENSE.md`.
- `hdri/studio_small_03_1k.hdr`: **Poly Haven "Studio Small 03"** by Sergej Majboroda, **CC0**. See `hdri/LICENSE.txt`.
- `fonts/Inter-*.woff2`: **Inter**, SIL OFL 1.1 (`fonts/Inter-OFL.txt`).
- `fonts/JetBrainsMono-*.woff2`: **JetBrains Mono**, SIL OFL 1.1 (`fonts/JetBrainsMono-OFL.txt`).

There are no real coins or currency designs, no real tickers and no logos. All numbers and symbols are made up.

## Project layout

```
src/
  Root.tsx              compositions (one per data row)
  versions.ts           one data row per colourway
  lib/                  seeded random, asset loaders, post-processing (bloom/ACES/grain/dither), plane DOF
  wormhole/Wormhole.tsx
  coins/CoinGrowth.tsx, coins/backdrop.ts
  hologram/HologramMap.tsx
  burst/SparkleBurst.tsx, burst/textures.ts
scripts/
  render-previews.sh    720p previews + stills
  verify.sh             ffprobe, loop, black checks
  compare.sh, pair.sh   side-by-side reference comparisons (need refs/<id>.mp4, not shipped)
```

## Measured results (this build)

Measured on the build machine: 4 vCPU, **no GPU**. Chromium ran `--gl=angle`, which fell back to SwiftShader software WebGL2. Remotion concurrency was 4.

### Render time per frame

**720p** (`--scale=0.3333333333333333`, whole mp4 render ÷ frames, including bundling and encoding):

| Look | 720p s/frame | 720p render time |
|---|---|---|
| Wormhole (each version) | 0.57 | ≈ 5.7 min / 600 frames |
| Coin Growth | 2.25 | ≈ 13.5 min / 360 frames |
| Hologram Threat Map | 1.14 | ≈ 11.4 min / 600 frames |
| Sparkle Burst (each version) | 1.36–1.42 (2.54 during the burst, frames 45–104) | ≈ 8.3 min / 360 frames |

**4K** (3840×2160, measured on sampled ranges):

| Look | 4K s/frame (measured) | 4K estimate on this machine |
|---|---|---|
| Wormhole (each version) | 5.6 (frames 150–169) | ≈ 56 min each |
| Coin Growth | 14.8 (frames 150–169) | ≈ 89 min |
| Hologram Threat Map | 11.5 (frames 150–169) | ≈ 115 min |
| Sparkle Burst (each version) | **2.86 during the burst** (frames 45–104); a single cold 4K still of frame 66 takes 9–10 s including browser start-up | ≈ 15–17 min each |

**4K estimate for all six on this CPU-only box: about 5.8 hours.**

- The three.js looks are fill-rate bound (bloom, depth of field, MSAA at 4K). On a GPU they should drop to well under 1 s/frame. That would bring all three.js renders to roughly 30–60 minutes in total; this figure is an estimate and was not measured on a GPU.
- Sparkle Burst is bound by JavaScript: it projects 150k particles per frame. That is why its 4K and 720p times are almost the same, and a GPU will help it only a little.

### Verification

| Check | Result |
|---|---|
| ffprobe (all 6) | 1280×720, 30/1, h264, yuv420p, video stream only. Durations: 20.0 s (looks 1 and 3) and 12.0 s (looks 2 and 4). |
| Loop check (601-frame variant, frame 0 vs 600) | Wormhole-Violet, Wormhole-CyanGold and HologramThreatMap are **identical pixel for pixel** (max diff 0). |
| Black check (encoded mp4) | SparkleBurst Blue and Gold: frame 0 corners are **0**, and frames 330–359 (including 345) are **max 0**. |
| Determinism | For each composition, frame 150 came from a full multi-tab PNG sequence render and was compared with frame 150 rendered alone from a cold start. **Byte-identical for all 6** (`scripts/determinism.sh`). |
| Banding (frames from the encoded mp4) | No flat plateaus in any gradient. The longest run of identical luma is 4–8 px across glows and gradients; runs longer than that are true black (value 0). Probes were taken across the coin backdrop's warm light leak, the hologram hot glow and dark haze, and the wormhole glow (`scripts/banding.py`). |

### Completion checklist

- [x] 6 compositions at 3840×2160, 30 fps, with the lengths in the brief (looks 1 and 3: 600 frames; looks 2 and 4: 360 frames)
- [x] three.js through `@remotion/three` for looks 1–3, PixiJS 8 (WebGL) for look 4, WebGL2 only
- [x] ACES filmic tonemapping, bloom, ±1/255 dither after bloom, about 2% grain from a pixel/frame hash (looks 1–3)
- [x] Pixi: one `Application`, `preference:'webgl'`, `autoStart:false`, `preserveDrawingBuffer:true`, ticker stopped, one `app.render()` per frame, `ParticleContainer`, `Float32Array` data, 7 bokeh textures chosen by depth, streaks along motion, additive blending, dither `Filter` gated off black
- [x] No `Math.random()`, physics, temporal effects or `Date.now()`. Assets sit behind `delayRender`.
- [x] Natural Earth, Poly Haven CC0 HDRI, Inter and JetBrains Mono (OFL) shipped with their licences
- [x] One data row per colourway (`src/versions.ts`)
- [x] 720p previews and a 720p PNG still of each composition
- [x] Loop, black, determinism and banding checks passed (see above)
- [x] `npm install && npx remotion studio` tested from a clean unzip. All 6 compositions are listed.

