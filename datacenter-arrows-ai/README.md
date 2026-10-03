# Data Center · Rising Arrows · Padlock Grid · Cloud HUD · AI Cube

One Remotion project, **8 compositions**, 30 fps, defined at **3840×2160**.
Everything is built in code: self-drawn SVG icons, procedural textures, no logos,
no brands, no icon libraries, no MCP servers. Fonts and the HDRI ship in `public/`.

| Composition id | Look | Engine | Frames | Loop |
|---|---|---|---|---|
| `DataCenter-SideStreaks` | 1A Data Center, side dolly + horizontal streaks | three.js (`@remotion/three`, WebGL2) | 600 | yes |
| `DataCenter-AisleFibres` | 1B Data Center, forward down the aisle + fibres | three.js (`@remotion/three`, WebGL2) | 600 | yes |
| `RisingArrows-Blue` | 2A Rising Arrows, blue | Canvas 2D | 600 | yes |
| `RisingArrows-Green` | 2B Rising Arrows, green | Canvas 2D | 600 | yes |
| `PadlockGrid` | 3 Padlock Grid | three.js (`@remotion/three`, WebGL2) | 600 | yes |
| `CloudHUD` | 4 Cloud HUD | SVG/HTML + Canvas 2D (+ one CSS 3D tilt) | 450 | no |
| `AICube-Blue` | 5A AI Cube, blue | three.js (`@remotion/three`, WebGL2) | 360 | no |
| `AICube-Violet` | 5B AI Cube, violet | three.js (`@remotion/three`, WebGL2) | 360 | no |

## Setup

```bash
npm install          # Node 18+; versions are pinned in package.json
npx remotion studio  # preview in the browser
```

### Chromium GL flag

The three.js looks need WebGL2 in headless Chromium. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, i.e. the CLI flag **`--gl=angle`**.
Pass it explicitly when rendering through the Node API or on another machine:
`--gl=angle`. (On a machine with a GPU, ANGLE uses it; without one it falls back
to SwiftShader, which is what the measurements below were taken on.)

## Render at 4K

```bash
npx remotion render DataCenter-SideStreaks out/DataCenter_SideStreaks.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render DataCenter-AisleFibres out/DataCenter_AisleFibres.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render RisingArrows-Blue      out/RisingArrows_Blue.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render RisingArrows-Green     out/RisingArrows_Green.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render PadlockGrid            out/PadlockGrid.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render CloudHUD               out/CloudHUD.mp4               --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render AICube-Blue            out/AICube_Blue.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render AICube-Violet          out/AICube_Violet.mp4          --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

`remotion.config.ts` already sets H.264, CRF 16, yuv420p and **PNG intermediate
frames** (JPEG intermediates would add their own banding), so the flags above
only make it explicit. The WebGL looks render with `--concurrency=1` fastest on
software GL (SwiftShader is already multi-threaded); on a GPU machine raise it.

### Stills (6000×3375)

```bash
npx remotion still AICube-Blue out/AICube_Blue_6K.png --frame=340 --scale=1.5625 --gl=angle
```

`--scale=1.5625` turns the 3840×2160 composition into 6000×3375. Any id and frame
works the same way. The three.js canvases follow the scale (they render at
6000×3375, not upscaled); blur, bloom and depth-of-field sizes are expressed as
fractions of the frame so the look matches the 720p preview.

### 720p previews (what was rendered here)

`scripts/render-previews.sh [compId ...]` renders a lossless PNG sequence at
`--scale=0.3333333333333333` (exactly 1280×720) and encodes it with ffmpeg:
H.264, yuv420p, CRF 16, 30 fps, BT.709 tags, no audio. Keeping the PNG frames
makes the byte-for-byte determinism check below possible.

## Engine per look (why)

- **Data Center, Padlock Grid, AI Cube → three.js** via `@remotion/three`
  (`ThreeCanvas`), WebGL2. Real geometry, reflections (drei
  `MeshReflectorMaterial`), the Poly Haven studio HDRI as a PMREM env map for
  metal/glass highlights, instancing for racks, padlocks, rings and blocks.
  Post chain (`src/lib/three/PostFX.tsx`, built synchronously so a cold tab's
  first frame already has it): [depth of field] → mip-map bloom → **ACES filmic
  tonemapping** → grain + ±1/255 dither in display space.
- **Rising Arrows → Canvas 2D.** Flat shapes and gradients, a quarter-res glow
  buffer blurred once per frame, front layer slightly blurred.
- **Cloud HUD → SVG/HTML + Canvas 2D.** Rings, cloud, icons, connector lines and
  the arrow are SVG; falling binary (clipped to the cloud path), specks and the
  grain layer are Canvas 2D; the ring stack tilts into the platform with one CSS
  3D transform.
- No PixiJS (no heavy particle counts), no WebGPU (WebGL2 is reliable headless).

## How to add a version (one data row)

All versions live in `src/versions.ts`. Copy a row, give it a new `id`, change
its props, done — `src/Root.tsx` registers every row as a composition.

```ts
{
  id: "AICube-Gold",
  look: "aicube",
  durationInFrames: 360,
  loop: false,
  props: { word: "ML", glass: "#FFD27F", trace: "#FFB347", background: "#2A1A06",
           glowAccents: ["#ffffff", "#ffe0a0", "#ffb347"] },
},
```

Props per look: Data Center `mode` (`"sideStreaks"` | `"aisleFibres"`) + colours;
Rising Arrows colours; Padlock Grid colours; Cloud HUD colours; AI Cube `word`,
`glass`, `trace`, `background`, `glowAccents`. The AI Cube word is a data field —
any short word is extruded from Montserrat ExtraBold at render time.

## Determinism

Every value on screen is a function of `useCurrentFrame()` only:

- No `Math.random()` anywhere: `mulberry32` streams seeded at module level and
  pure integer hashes (`src/lib/random.ts`; `pcg3d` for grain).
- No physics, no CSS animations/transitions, no `useFrame` clock, no
  `Date.now()`, no state driving visuals, no TAA / temporal AO / accumulation.
- `@remotion/three` renders with `frameloop="never"`; all per-frame updates run
  in layout effects before its render, and the post chain is built synchronously.
- Canvas 2D is redrawn from scratch every frame.
- Fonts, the HDRI and the Montserrat outlines load behind
  `delayRender()`/`continueRender()`.

**Loops.** Periodic motion goes through `cyc(frame, cycles, 600)`
(`src/lib/loop.ts`), which uses integer maths so frame 600 is exactly frame 0:
the data-centre room slides exactly one 8-rack period (racks, LED seeds, ceiling
panels and tiles repeat every 8 racks), the padlock field exactly one 2-tile
period, arrows rise a whole number of wrap heights, rings turn whole turns,
LED blink periods all divide 600, grain uses `frame % 600`.
`--props='{"loopCheck":true}'` makes any loop 601 frames long for the seam test
(`scripts/loop-check.sh`).

## Banding

- three.js looks: grain (~2 %, triangular, luminance) and ±1/255 dither are added
  **after** bloom and tonemapping, in sRGB space, in the last post effect.
- Canvas 2D looks: the same `pcg3d` grain + dither formula is applied to the
  pixels (Rising Arrows) or composited as a grain layer (Cloud HUD).
- Intermediate frames are PNG (lossless), and the check is done on the
  **encoded mp4**: `scripts/banding-check.py <mp4> <frame> <x0,y0,x1,y1> ...`
  decodes a frame and reads values along lines through dark gradients and glows.

## Measured render times

Machine: 4 vCPU, no GPU — Chromium's ANGLE falls back to SwiftShader (software
WebGL2), so every number below is a worst case. `--concurrency=1`.

| Look | 720p (`--scale=1/3`), s/frame | 4K, s/frame | 4K estimate, this machine | 4K estimate, typical GPU workstation* |
|---|---|---|---|---|
| Data Center 1A / 1B (600 f each) | 1.39 / 1.36 | 14.4 | ~2 h 25 min each | ~10–20 min each |
| Rising Arrows A / B (600 f each) | 0.23 / 0.23 | 2.5 | ~25 min each | ~10 min each (CPU-bound 2D) |
| Padlock Grid (600 f) | 0.96 | 12.3 | ~2 h 05 min | ~10–15 min |
| Cloud HUD (450 f) | 1.78 | 6.9 | ~52 min | ~20–30 min (SVG filters, CPU-bound) |
| AI Cube A / B (360 f each) | 0.98 / 0.92 | 10.4 | ~62 min each | ~5–10 min each |

720p figures are whole-render wall time ÷ frames (they include browser start-up).
4K figures are (8-frame render − 2-frame render) ÷ 6, so start-up cancels out.
*The GPU column is an estimate, not a measurement: WebGL looks typically run
10–20× faster on a real GPU; the Canvas/SVG looks gain much less.
Whole project at 4K on this machine: roughly 13 h; on a GPU workstation about 1.5–2 h.

## Verification results (what was checked, and how)

| Check | Tool | Result |
|---|---|---|
| 1. File checks (1280×720, 30/1, h264, yuv420p, no audio, 20 / 15 / 12 s) | `ffprobe` | all 8 pass |
| 2. Loop seam (601-frame variant, frame 0 vs 600, decoded pixels) | `scripts/loop-check.sh` | all 5 loops identical; the wrap step 599→0 is in the range of ordinary frame steps (`scripts/seam-check.py`) |
| 3. Determinism (cold `remotion still --frame=200` vs frame 200 of the full sequence render, file bytes + decoded pixels) | `scripts/determinism-check.sh` | all 8 identical byte for byte (after one fix, see below) |
| 4. Banding on the encoded mp4 (1A, 2A, 3, 4, 5A) | `scripts/banding-check.py` | smooth: monotonic profiles, max flat run 3–7 px through the grain, no stair steps (12 px in the near-black top of Cloud HUD, where the image is at code 2–5) |
| 5./6. Content, text and icons | contact sheets of 5 frames per preview | as specified; "AI" and HUD icons crisp at 720p; no logos or brands |
| 7./8. Look vs reference | self check + 3 rounds of fresh blind sub-agent comparisons per look | see the delivery report |

Determinism fix found by check 3: drei's `MeshReflectorMaterial` renders its
reflection before three.js refreshes world matrices for the frame, so a moving
floor (Padlock Grid) used the previous frame's transform in a sequential render.
`UpdateWorldFirst` in `src/lib/three/Scene3D.tsx` now updates all world matrices
first, in every frame.

## Completion checklist

- [x] 8 compositions, one project, data rows in `src/versions.ts`
- [x] Engines: three.js (WebGL2, `@remotion/three`) for 1, 3, 5; Canvas 2D for 2; SVG/HTML + Canvas 2D (+ CSS 3D) for 4
- [x] 3840×2160, 30 fps; 600 / 600 / 600 / 450 / 360 frames
- [x] ACES filmic tonemapping in the 3D looks; ±1/255 dither after bloom and tonemapping
- [x] Grain ~2 % from a fixed formula of pixel position and frame, never `Math.random()`
- [x] Exact loops (frame 600 == frame 0)
- [x] Deterministic: cold frame 200 == full-render frame 200, byte for byte
- [x] Fonts (Inter, Montserrat, JetBrains Mono, OFL) and the Poly Haven studio HDRI (CC0) shipped with licences
- [x] Icons self-drawn SVG; no logos, brands or icon libraries; no MCP servers
- [x] 720p previews + PNG stills; 4K render, still and GL-flag commands above
- [x] `npm install && npx remotion studio` works from a clean copy
