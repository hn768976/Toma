# Card & Coin Rain — Remotion + three.js

Two seamless 20 s loops (600 frames @ 30 fps, 16:9) of a metallic bank card
floating in a soft studio while coins (and, in look 1, gold bars) fall and
tumble around it, with strong depth of field.

| Composition id | Look | Output name |
|---|---|---|
| `CardRain-Gold` | Gold Rush — crinkled gold-foil card, gold coins + bars, warm beige set | `CardRain_Gold.mp4` |
| `CardRain-RoseGold` | Rose Card — satin rose-gold card with print, rose-gold / copper / silver coins, dusty pink set | `CardRain_RoseGold.mp4` |

Both compositions are defined at **3840×2160**. They share all scene code;
everything that differs between the looks is in `src/lib/looks.ts`.

**3D**: `@remotion/three` (react-three-fiber), WebGL2, `MeshPhysicalMaterial`
metals lit by a CC0 studio HDRI plus three soft rect-area lights,
`DepthOfField` + ACES tonemapping from `@react-three/postprocessing`.

---

## Quick start

```bash
npm install
npx remotion studio          # preview (renders the canvas at 1920×1080 in the Studio)
```

Node 18+ (tested with Node 22). `package.json` pins every dependency to an
exact version.

## Render commands

The Chromium GL flag is set in `remotion.config.ts`
(`Config.setChromiumOpenGlRenderer("angle")`) and repeated below so the
commands also work when copied into a Node / Lambda setup:
**`--gl=angle`**. On a machine without a GPU, Chromium falls back to
SwiftShader through ANGLE (slow but correct; that is what the numbers below
were measured on).

### 4K masters (3840×2160)

```bash
npx remotion render CardRain-Gold     out/CardRain_Gold_4K.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --concurrency=1
npx remotion render CardRain-RoseGold out/CardRain_RoseGold_4K.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --concurrency=1
```

With a real GPU raise `--concurrency` (e.g. 2–4) and check it actually helps;
on SwiftShader one tab already uses every core, so `1` was fastest.

### 1080p previews (what was delivered)

```bash
npx remotion render CardRain-Gold     out/CardRain_Gold.mp4     --scale=0.5 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --concurrency=1
npx remotion render CardRain-RoseGold out/CardRain_RoseGold.mp4 --scale=0.5 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --concurrency=1
```

### Stills, 6000×3375 PNG (2 per composition)

`--scale=1.5625` turns the 3840×2160 composition into 6000×3375. Frames were
picked by `scripts/analyze.ts` (card square-on, no near-lens object over it,
frames ≥ 200 apart):

```bash
npx remotion still CardRain-Gold     out/CardRain_Gold_still_f304.png     --frame=304 --scale=1.5625 --gl=angle --image-format=png
npx remotion still CardRain-Gold     out/CardRain_Gold_still_f538.png     --frame=538 --scale=1.5625 --gl=angle --image-format=png
npx remotion still CardRain-RoseGold out/CardRain_RoseGold_still_f058.png --frame=58 --scale=1.5625 --gl=angle --image-format=png
npx remotion still CardRain-RoseGold out/CardRain_RoseGold_still_f337.png --frame=337 --scale=1.5625 --gl=angle --image-format=png
```

All size-dependent effects (bokeh radius, CoC blur) scale with the drawing
buffer height, so the look is the same at 1080p, 4K and 6000 px.

## Render time

Measured on the build machine: 4 vCPU, 15 GB RAM, **no GPU** (Chromium's
ANGLE → SwiftShader software WebGL2), `--concurrency=1` (2 and 4 were slower:
one SwiftShader tab already uses every core).

| | Gold Rush | Rose Card |
|---|---|---|
| 1080p preview, 600 frames, whole command | 2458 s on an idle machine; final run 2500 s | 2606 s on an idle machine; final run 2959 s (other checks shared the CPU) |
| **per frame at 1080p** | **≈ 4.1 s** | **≈ 4.3 s** |

**4K (3840×2160), measured:** a 20-frame 4K render of `CardRain-Gold`
(frames 300–319) minus a 2-frame run (startup) gives **≈ 13.6 s per frame**,
so a full 600-frame 4K master takes **≈ 2 h 15 min per composition** on this
CPU-only machine (≈ 3.3× the 1080p time for 4× the pixels: part of each frame
is fixed cost). A 6000×3375 still takes ≈ 2 min including startup.

With any real GPU expect a small fraction of that; the scene is ~60 draw
calls plus six full-screen post passes.

---

## How it works

### Determinism

Every value on screen is a pure function of `useCurrentFrame()`:

- All object parameters (depth, x, size, track, fall count, tumble turns,
  phase, finish, roughness) are drawn **once at module level** from
  `mulberry32` (`src/lib/objects.ts`). No `Math.random()` anywhere.
- No physics engine, no `useFrame` clock, no `Date.now()`, no state carried
  between frames. Per-frame transforms are written in a `useLayoutEffect`
  keyed on the frame, which runs before `@remotion/three` advances R3F.
- No TAA, no temporal AO, no accumulative shadows. The DoF, tonemap and grain
  passes are all stateless.
- The HDRI, the Inter font and every baked texture are loaded/generated behind
  `delayRender` / `continueRender` before the canvas mounts. Procedural
  textures come from a stateless integer-hash noise, so every browser tab bakes
  identical bytes.

### The loop (600 frames)

- `t = frame / 600` (deliberately *not* reduced mod 600, so the loop check is
  meaningful).
- Falling objects: `y = top − wrap(y0 + k · L · t, L)` with whole `k` (1–3).
  `L` runs from above the top of the frame to below the bottom **at that
  object's depth**: visible height from the camera's FOV and pitch, plus margin
  for the object's bounding radius, its defocus spill and the camera drift.
- Tumble: whole turns per axis per loop (coins 1–3, bars ≤ 1, one axis may be 0).
- Card tilt, card float and camera drift: sums of sines with whole-number
  frequencies.
- Grain is a hash of (pixel x, pixel y, `frame % 600`).

### Look details

- Lens 58 mm on a 36 mm gate, camera ~37 cm from the card, 4.3 cm below it and
  looking slightly up; the card fills ~37.5 % of frame width square-on.
  Camera drift: ±~3.5° orbit, ±1 cm height, closed path.
- Card 85.6 × 53.98 × 0.8 mm, 3.18 mm corner radius, extruded with a small
  bevel so the edge catches light. Tilt stays within 22° of facing the camera.
- Coins: lathe profile with a recessed field, one raised emboss ring and a
  raised rim; reeded edge + concentric tooling from a generated normal map;
  per-instance colour and roughness. One `InstancedMesh` for coins, one for bars.
- Bars: rounded box tapered to a trapezoid ingot (normals transformed exactly),
  lightly hammered normal map, plain.
- Depth layers per look: near-lens (large, heavily blurred, kept to the frame
  sides), "front" (cross one end of the card, ~10 % of coins), mid (sharp),
  far (small, soft).
- Backdrop: camera-locked plane far behind the scene with a radial gradient
  (hot spot behind the card, darker corners). Its colours are passed through the
  **exact inverse of three.js' ACES Filmic** (`src/lib/tonemap.ts`), so the
  displayed backdrop is the colour asked for in `looks.ts`.
- HDRI graded per look at load (tint + lift toward the set colour), so the
  metals reflect a warm beige / pink room.

### Depth of field

`DepthOfField` from `@react-three/postprocessing`, focused every frame on the
card's distance, with three patches applied in `src/three/Scene.tsx`:

1. **CoC curve**: thin-lens style `|d − f| / d` with separate near/far gains
   (near-lens coins blur hard; far coins stay recognisable) instead of the stock
   symmetric linear ramp.
2. **Far field, scatter-as-gather**: a tap only contributes if that sample's own
   blur radius reaches the pixel. The stock gather smeared sharp coins into the
   blurred background, which showed up as a dark outline around every sharp coin.
3. **Near "fill" pass**: the stock second pass takes the *max* of 16 taps, which
   washed near-lens objects out to pale blobs; it is an average now.

Bokeh radius is scaled with the drawing-buffer height (34 px at 1080p), and the
DoF runs at full resolution (half-res left a stair-step on the card edge).

### Banding

- ±1/255 TPDF dither after tonemapping, in display (sRGB) space.
- ~2 % luma grain from a fixed hash of pixel position and `frame % 600`.
- Frames go to the encoder as PNG (no JPEG intermediate), H.264 CRF 16 yuv420p.

---

## Verification

All scripts are in `scripts/` and run with `npx tsx`.

| Step | How | Result |
|---|---|---|
| 1. File checks | `ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of default=noprint_wrappers=1 out/CardRain_Gold.mp4` | 1920×1080, 30/1, 20.000 s, h264, yuv420p, 600 frames, video stream only — both |
| 2. Loop check | `npx tsx scripts/stills.ts --comp=CardRain-Gold --frames=0,600 --props='{"loopCheck":true}'` (601-frame comp), then `cmp` the PNGs | byte-identical — both |
| 3. Determinism | `npx tsx scripts/stills.ts --comp=CardRain-Gold --frames=300 --cold --scale=0.5` vs frame 300 of `npx remotion render ... --sequence --frames=240-300 --image-format=png --scale=0.5` (same page, 60 frames of history) | byte-identical (same pixel MD5) — both |
| 4. No popping | `npx tsx scripts/analyze.ts` checks every wrap of every object with the exact drifting camera; plus 1-in-10 frame contact sheets | 0 pops; worst off-screen margin 120 px (gold) / 115 px (rose) |
| 5. Banding | `npx tsx scripts/banding.ts out/CardRain_RoseGold.mp4 150` reads backdrop pixels from the **encoded** mp4 | smooth: 7–10 code values per 64-px window, no plateaus — both |
| 6. Look checks | five evenly spaced frames per look | pass — see report |
| extra: clipping | `npx tsx scripts/clipping.ts out/CardRain_Gold.mp4 5` | 0.000 % flat-white pixels — both |

`--props='{"disable":{"coins":true}}'` (also `bars`, `card`, `camera`,
`grain`, `dof`) switches groups off for bisecting a loop or determinism issue.

## Completion checklist

- [x] Two compositions, 3840×2160, 30 fps, 600 frames, shared scene code
- [x] 3D: `@remotion/three` / R3F, WebGL2, `--gl=angle`
- [x] Lens 58 mm, card ≈ 37.5 % of frame width, camera slightly below looking up
- [x] Camera drift: closed path, a few degrees, whole-number frequencies
- [x] Card 85.6 × 53.98 × 0.8 mm, rounded corners, visible edge, tilt ≤ 22.1°
- [x] One `InstancedMesh` per object type (coins, bars)
- [x] Three depths: near-lens (blurred, large), mid (sharp), far (soft)
- [x] ~10 % of coins pass in front of the card (gold 5/45, rose 5–7/55)
- [x] Raised rim + reeded edge (normal map); edge-on flashes
- [x] Poly Haven CC0 studio HDRI + soft key / fill / rim, `delayRender` loading
- [x] ACES tonemapping; highlights roll off (0.000 % flat-white pixels over 120 sampled frames per video)
- [x] `DepthOfField` focused on the card; no dark outline / halo at sharp-over-blurred edges
- [x] No motion blur, no TAA / temporal AO / accumulative shadows
- [x] Seeded `mulberry32` at module level; no `Math.random()`, no clock, no state
- [x] Dither ±1/255 after tonemapping + ~2 % grain from (pixel, `frame % 600`)
- [x] Loop: frame 600 == frame 0, byte for byte (both looks)
- [x] Determinism: cold frame 300 == in-sequence frame 300, byte for byte (both looks)
- [x] No popping: every wrap of every object checked off-screen (≥ 115 px margin at 1080p incl. blur) + 1-in-10 contact sheets
- [x] Banding: encoded-mp4 backdrop reads smooth (no 1–2 value plateaus)
- [x] Gold: crinkled foil card, gold chip, no text, gold bars, warm beige set
- [x] Rose: rose-gold satin card, chip, "Bank Card", `0123 4567 8910 1112` (crisp at 6000 px), rose-gold / copper / silver coins, dusty pink set
- [x] No logos, card-network marks, currency, denominations, portraits, refinery stamps
- [x] Inter (OFL) and the HDRI (CC0) shipped with licences
- [x] `npm install && npx remotion studio` works from a clean unzip

## Project layout

```
remotion.config.ts        GL flag, PNG frames, H.264 / CRF 16 / yuv420p
src/Root.tsx              the two compositions (3840×2160, 600 frames)
src/CardRain.tsx          asset loading (delayRender) + ThreeCanvas
src/lib/loop.ts           camera, card and track formulas (pure functions of frame)
src/lib/objects.ts        seeded object lists (mulberry32, module level)
src/lib/looks.ts          per-look palette, counts, lights, DoF
src/lib/tonemap.ts        ACES Filmic + exact inverse
src/three/Scene.tsx       scene, instancing, lights, DoF patches, post chain
src/three/geometry.ts     coin lathe, ingot, card body/faces
src/three/textures.ts     baked normal/roughness maps, chip, card print
src/three/GrainDitherEffect.ts
scripts/                  analyze (pop/tilt/stills), stills, banding
public/                   Inter woff2, HDRI
licenses/                 OFL, CC0 notes
```
