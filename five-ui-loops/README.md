# Five UI Loops — Remotion project

Five looks, two versions each → **10 compositions**, all defined at
**3840×2160, 30 fps**. Everything is drawn in code: no MCP servers, no icon
libraries, no logos, no stock art.

| # | Look | 2D/3D | Compositions | Frames |
|---|------|-------|--------------|--------|
| 1 | AI Diagnosis Loading | 2.5D (CSS 3D tilt) | `AIDiagnosis-Medical`, `AIDiagnosis-DNA` | 450 (15 s) |
| 2 | Cart Counter | 2.5D (CSS 3D tilt) | `CartCounter-SlateUSD`, `CartCounter-LightEUR` | 300 (10 s) |
| 3 | Data Stack | 3D (`@remotion/three`, WebGL2) | `DataStack-Cyan`, `DataStack-Amber` | 360 (12 s) |
| 4 | Dot World Map | 2D (one `<canvas>`) | `DotWorldMap-Lime`, `DotWorldMap-Cyan` | 600 (20 s loop) |
| 5 | Gradient Orb | 2D (fragment shader via `@remotion/three`) | `GradientOrb-SunsetPink`, `GradientOrb-OceanMint` | 600 (20 s loop) |

## Quick start

```bash
npm install
npx remotion studio
```

Node 18+ (tested with Node 22). All versions in `package.json` are pinned.

## Chromium GL flag

WebGL2 needs a GL backend in headless Chromium. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, i.e. the same as passing
**`--gl=angle`** on the command line. On a machine with **no GPU at all** use
`--gl=swangle` (SwiftShader behind ANGLE). WebGPU is not used.

## 4K render commands (one per composition)

```bash
npx remotion render AIDiagnosis-Medical    out/AIDiagnosis_Medical.mp4    --gl=angle
npx remotion render AIDiagnosis-DNA        out/AIDiagnosis_DNA.mp4        --gl=angle
npx remotion render CartCounter-SlateUSD   out/CartCounter_SlateUSD.mp4   --gl=angle
npx remotion render CartCounter-LightEUR   out/CartCounter_LightEUR.mp4   --gl=angle
npx remotion render DataStack-Cyan         out/DataStack_Cyan.mp4         --gl=angle
npx remotion render DataStack-Amber        out/DataStack_Amber.mp4        --gl=angle
npx remotion render DotWorldMap-Lime       out/DotWorldMap_Lime.mp4       --gl=angle
npx remotion render DotWorldMap-Cyan       out/DotWorldMap_Cyan.mp4       --gl=angle
npx remotion render GradientOrb-SunsetPink out/GradientOrb_SunsetPink.mp4 --gl=angle
npx remotion render GradientOrb-OceanMint  out/GradientOrb_OceanMint.mp4  --gl=angle
```

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16 and lossless PNG
frames, so these produce 3840×2160 / 30 fps / no audio. Add
`--concurrency=N` to match your cores.

1080p previews (what was delivered) are the same command with `--scale=0.5`;
`scripts/render-previews.sh` does that via a PNG sequence + ffmpeg so the frames
can also be used for the determinism check.

## Still command

```bash
# 6000×3375 = scale 1.5625 of the 3840×2160 composition
npx remotion still DataStack-Cyan out/DataStack_Cyan_f150.png --frame=150 --scale=1.5625 --gl=angle
```

`scripts/stills.sh` renders the full set: two 6000×3375 PNGs per composition
(look 1: mid-progress f200 + complete f435; look 2: early f40 + final f299;
look 3: half-built f150 + complete f359; looks 4/5: f0 + f300) and one 1080p
PNG each.

## Render time

@@TIMING@@

## Determinism

Remotion renders frames out of order on several threads, so every visual value
is a pure function of `useCurrentFrame()`:

- Randomness: `mulberry32` seeded at **module level** (`src/lib/random.ts`) or
  stateless integer hashes of (index, frame) / (pixel, frame). No
  `Math.random()` anywhere.
- No CSS `@keyframes` / transitions, no `Date.now()`, no `useState` driving
  visuals, no R3F clock. The R3F `useFrame` in look 3 is used only as the hook
  where the post-processing chain renders (priority 1); it ignores its clock
  argument. Uniforms and instance buffers are written during React render from
  the frame number. No TAA or temporal effects.
- Count / price (look 2) and progress (look 1) are recomputed from the frame
  each time — nothing is carried between frames.
- Fonts (`src/lib/fonts.ts`) and the Natural Earth land mask
  (`src/looks/dot-map/landMask.ts`, memoised at module level) are behind
  `delayRender` / `continueRender`.
- Loops (looks 4, 5) use `frame % 600` for every input: each dot flicker has a
  whole number of cycles per 600 frames, scan lines move exactly one repeat,
  the gradient turns exactly once, grain is keyed on `frame % 600`.

## Banding

@@BANDING@@

## Verification / completion checklist

@@CHECKLIST@@

## Adding a version (one data row)

All versions live in **`src/versions.ts`**, one object per version. Copy a row,
change `key` (composition id suffix), `file` and the values; it appears in the
Studio as `<Look>-<key>`:

```ts
// src/versions.ts → cartCounterVersions
{
  key: "DarkGBP", file: "CartCounter_DarkGBP",
  bar: "#26303A", barEdge: "#55626E", band: "#1E262E", background: "#14191F",
  icon: "#C8CED4", priceColor: "#EEF1F4", badge: "#2FC48A", badgeText: "#FFFFFF",
  currency: "£", currencyPosition: "before", thousands: ",", decimal: ".",
  finalCount: 45, seed: 7,
},
```

- Look 1 rows: title, ID code, accent colours, `backdrop: "body" | "helix"`,
  progress `seed` (pauses/bursts).
- Look 2 rows: colours, currency symbol + position, separators, final count.
- Look 3 rows: stack colour, trace colours, light palettes.
- Look 4 rows: bright/dim dot colours, scan-line colour.
- Look 5 rows: the two gradient colours and the background.

For the stills/preview scripts, also add the id → file name to
`scripts/render-previews.sh` and a line to `scripts/stills.sh`.

## Project layout

```
remotion.config.ts        GL backend, codec, CRF, pixel format
src/Root.tsx              registers every row of src/versions.ts
src/versions.ts           ← one data row per version
src/lib/                  seeded RNG, fonts, grain overlay, GLSL helpers, colour utils
src/looks/ai-diagnosis/   look 1 (panel, backdrop: body / DNA helix, progress pacing)
src/looks/cart-counter/   look 2 (odometer, count/price curve, self-drawn icons)
src/looks/data-stack/     look 3 (scene, shaders, timeline, bloom/CA/grain post chain)
src/looks/dot-map/        look 4 (Natural Earth → dot grid, canvas renderer)
src/looks/gradient-orb/   look 5 (full-screen fragment shader)
public/fonts/             Inter, JetBrains Mono, Montserrat (woff2) + OFL licences
public/data/              Natural Earth 1:50m land + licence (public domain)
scripts/                  preview render, stills, verification helpers
```

## Licences

- Fonts: **Inter**, **JetBrains Mono**, **Montserrat** — SIL Open Font License
  1.1 (`public/fonts/OFL-*.txt`). Files from the Fontsource packages (v5.2.8).
- Map: **Natural Earth** 1:50m land, public domain
  (`public/data/NaturalEarth-LICENSE.md`).
