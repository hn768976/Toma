# Bacteria Chains · Film Dust · Glowing Tissue · Particle Flow · City Bokeh

Five looks × two colourways = **10 seamless 20 s loops** (600 frames, 30 fps,
16:9, defined at **3840×2160**), built with **Remotion 4** and **PixiJS 8 on
WebGL2**. Everything is generated in code: no footage, no text or logos.

| # | Composition ID | Output name | Look | 2D / 3D |
|---|----------------|-------------|------|---------|
| 1 | `BacteriaChains-Red` | `BacteriaChains_Red` | dark-field microscope, beaded chains + clumps on 4 focus layers | 2D |
| 2 | `BacteriaChains-Blue` | `BacteriaChains_Blue` | same, navy → cyan-white | 2D |
| 3 | `FilmDust-Dense` | `FilmDust_Dense` | ~9,000 dust elements / frame on pure black (**overlay**) | 2D |
| 4 | `FilmDust-Light` | `FilmDust_Light` | ~1,500 elements / frame (**overlay**) | 2D |
| 5 | `GlowingTissue-Orange` | `GlowingTissue_Orange` | fibrous tissue glowing from within | 2D |
| 6 | `GlowingTissue-Blue` | `GlowingTissue_Blue` | same, cool ramp | 2D |
| 7 | `ParticleFlow-Blue` | `ParticleFlow_Blue` | 250k particles on curved sheets | 3D |
| 8 | `ParticleFlow-Gold` | `ParticleFlow_Gold` | same, amber / white-gold | 3D |
| 9 | `CityBokeh-Warm` | `CityBokeh_Warm` | night-city bokeh on 3 depth layers | 2D |
| 10 | `CityBokeh-Cool` | `CityBokeh_Cool` | same, blue night | 2D |

> Remotion composition IDs may only contain `a-z A-Z 0-9 -`, so the IDs use a
> hyphen (`FilmDust-Dense`); the rendered files use the underscore names.

## Quick start

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ is required. Versions are pinned in `package.json`
(Remotion 4.0.515, PixiJS 8.21.0, React 19.2.3).

## Chromium / GL flag (required)

PixiJS runs on **WebGL2**. Headless Chromium needs ANGLE for a WebGL2 context:

```
--gl=angle
```

It is already set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`);
pass `--gl=angle` explicitly if you render through the Node API or another config.
On a machine with a real GPU, ANGLE uses it; without one it falls back to
SwiftShader (software). Every number below was measured on SwiftShader (4 vCPU, no GPU).

## Rendering at 4K (3840×2160)

```bash
npx remotion render BacteriaChains-Red   out/BacteriaChains_Red.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render BacteriaChains-Blue  out/BacteriaChains_Blue.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render FilmDust-Dense       out/FilmDust_Dense.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render FilmDust-Light       out/FilmDust_Light.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render GlowingTissue-Orange out/GlowingTissue_Orange.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render GlowingTissue-Blue   out/GlowingTissue_Blue.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render ParticleFlow-Blue    out/ParticleFlow_Blue.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render ParticleFlow-Gold    out/ParticleFlow_Gold.mp4    --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render CityBokeh-Warm       out/CityBokeh_Warm.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render CityBokeh-Cool       out/CityBokeh_Cool.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

For a mezzanine master use `--codec=prores --prores-profile=4444` (`.mov`).
For an overlay (Film Dust) in particular, ProRes keeps the black exactly 0 and
the white specks free of chroma bleed.

### 720p preview (what was delivered here)

`scripts/render-preview.sh <CompositionId>` renders a PNG sequence at
`--scale=0.3333333333333333` (exactly 1280×720) and encodes it with ffmpeg:
H.264, CRF 16, yuv420p, BT.709, 30 fps, no audio. The PNGs are kept so
frame 300 can be compared byte for byte with a cold-start still.

## Stills

6000×3375 still (scale 1.5625 of 3840×2160), e.g. frame 300:

```bash
npx remotion still BacteriaChains-Red out/BacteriaChains_Red_6K.png --frame=300 --scale=1.5625 --image-format=png --gl=angle
```

Same command for any composition ID. A 720p still:
`npx remotion still <ID> out/<name>.png --frame=300 --scale=0.3333333333333333 --gl=angle`.

## Film Dust is an overlay → Screen / Add

`FilmDust-Dense` and `FilmDust-Light` are white elements on **exactly black
(0,0,0)**: no bloom, no haze, and no grain or dither in the black (grain and
dither are faded to zero below ~3 % luminance on every look and are never
applied to black). Put them over footage with **Screen** or **Add / Linear Dodge**.

## How it works

```
src/
  Root.tsx            one <Composition> per data row (3840x2160, 600 frames)
  versions.ts         THE DATA ROWS — one per colourway
  engine/
    PixiLoop.tsx      creates the PixiJS WebGL2 renderer once, renders the stage
                      manually once per Remotion frame (no ticker); delayRender
                      until every texture is baked
    post.ts           half-float HDR target -> dual-filter bloom (half-float) ->
                      grade (RGB or luminance ramp), vignette, grain, ±1/255 dither
    gl.ts             full-screen shader passes on PixiJS Mesh + GlProgram
    bake.ts           Canvas-2D sprite baking (mipmapped textures)
    rng.ts            mulberry32 + integer hash (no Math.random anywhere)
  looks/
    bacteria.ts       background shader + ~900 sprites on 4 focus layers
    filmdust.ts       hash(frame bucket) layouts, 5 % persistent elements
    tissue.ts         one shader: tileable Voronoi cells, ridged strands, lumps
    particleflow.ts   250k points, 3D positions projected in a vertex shader
    bokeh.ts          prebaked lens discs on 3 drifting depth layers
```

### Determinism

Remotion renders frames out of order across several tabs, so every pixel is a
function of `useCurrentFrame()` only:

* `frame % 600` is the only time input. Every motion term is a whole-cycle
  function of `phase = frame / 600`: sines with integer frequencies, drifts of
  whole tile / layout / sheet lengths, fades on periods that divide 600.
* No `Math.random()`, `Date.now()`, `useFrame` clocks or state driving visuals.
  All random data comes from `mulberry32` seeded per look from the data row,
  or from a stateless integer hash (film-dust layouts: `hash(floor(frame/2) % 300, i)`).
* The Pixi stage is rebuilt from the frame number on every frame (every sprite
  property is set every frame), and rendered manually with no ticker.
* Grain and dither use a PCG hash of (pixel x, pixel y, frame % 600).

### Adding a colourway (one data row)

Copy a row in `src/versions.ts`, give it a new `id` (letters, digits, hyphens)
and change its colours. Example: a green bacteria version.

```ts
{ id: "BacteriaChains-Green", look: "bacteria",
  params: { seed: 1101, ramp: ["#000000", "#08300C", "#2A9A3A", "#9AF0A8", "#ECFFEE"] } },
```

Row parameters per look:

* `bacteria`: `ramp` (5 stops: black, deep, mid, bright, highlight; luminance-driven), `seed`
* `filmdust`: `count` (elements per frame), `seed`
* `tissue`: `ramp` (black → deep → bright → hot → white)
* `particleflow`: `deep`, `sheet`, `edge`, `edge2`, `grey` (pale near sheet), `haze`, `count`, `seed`
* `bokeh`: `bgTop`, `bgBottom`, `glow`, `blob`, `colors` (weighted list, back layers), `front` (near headlight discs; entries 0 and 1 are the bright pair), `seed`

## Verification scripts

* `scripts/render-preview.sh <ID>`: 720p preview + timing
* `scripts/verify.py <ID> <Name> [--black]`: ffprobe, 601-frame loop check,
  cold-start frame-300 byte compare, black-level samples from the decoded mp4
* `scripts/seam.py <Name>`: the 599 → 0 step compared with ordinary frame steps
* `scripts/stills.mjs`: frames / contact sheets / per-frame timings with one browser

## Measured render times

All numbers are from this build machine: 4 vCPU, **no GPU** (Chromium falls back
to SwiftShader through ANGLE), 15 GB RAM. With a real GPU expect these to drop by
an order of magnitude.

### 720p previews (full 600-frame render, `--concurrency=4`, wall time ÷ 600)

| Composition | ms / frame @ 720p |
|---|---|
| BacteriaChains-Red | 782 |
| BacteriaChains-Blue | 791 |
| FilmDust-Dense | 1869 |
| FilmDust-Light | 369 |
| GlowingTissue-Orange | 611 |
| GlowingTissue-Blue | 584 |
| ParticleFlow-Blue | 289 |
| ParticleFlow-Gold | 274 |
| CityBokeh-Warm | 282 |
| CityBokeh-Cool | 280 |

(Concurrency barely helps here: every tab shares the one SwiftShader GPU process.)

### Two timed 4K frames (3840×2160, `--scale=1 --concurrency=1`)

Timed as (render of frames 300–303) − (render of frame 300) ÷ 3, so browser start-up
and sprite baking are excluded:

| Composition | s / frame @ 4K |
|---|---|
| FilmDust-Dense | **11.5** (frame 300 alone, cold: 25.3 s) |
| ParticleFlow-Blue | **2.1** (frame 300 alone, cold: 5.1 s) |

### 4K estimates for a full 600-frame render on this kind of machine (no GPU)

Measured 4K / 720p ratio: ×6.2 (dust, sprite-bound) and ×7.4 (particles). Shader-bound
looks (tissue, bacteria background) scale closer to the ×9 pixel count.

| Composition | est. s / frame @ 4K | est. full render |
|---|---|---|
| BacteriaChains (each) | ~6 | ~60 min |
| FilmDust-Dense | 11.5 (measured) | ~115 min |
| FilmDust-Light | ~2.5 | ~25 min |
| GlowingTissue (each) | ~5.5 | ~55 min |
| ParticleFlow (each) | 2.1 (measured) | ~21 min |
| CityBokeh (each) | ~2 | ~20 min |

Total for all ten at 4K ≈ 8 hours on 4 software-rendered vCPUs; on a machine with a
GPU, roughly 30–60 minutes.

## Banding check (on the encoded mp4)

`scripts/banding.py` decodes frame 300 of each preview and reads the luma profile along
a gradient: the bacteria dark field (column 1240), the tissue vignette ramp (row 360),
the particle-flow haze floor (9×9 minimum filter along row 354, i.e. the haze between
grains) and the bokeh background (column 20, top to bottom). Every profile changes
smoothly: no staircase plateaus. On the smooth bokeh gradients the largest
neighbour step after a 5-px smooth is < 1 code value (0.89 warm, 0.74 cool). Below ~3 %
luminance the dither is deliberately faded out (so blacks stay clean); there the
gradients are so shallow that 1-code plateaus are the minimum possible in 8-bit. Results:
`renders/logs/banding.txt` (render output, not in the zip).

Half-float (rgba16float) targets are used for the scene and every bloom level; the final
pass adds ±1/255 triangular dither and 1.5 % grain from a PCG hash of (pixel, frame % 600).

## Completion checklist

- [x] 10 compositions, 3840×2160, 30 fps, 600 frames, one data row each (`src/versions.ts`)
- [x] PixiJS 8 on WebGL2 (checked at start-up: throws if WebGL2 or float colour buffers are missing)
- [x] Particle Flow: 250,000 points, 3D positions projected in a custom vertex shader
- [x] 720p previews: 1280×720, h264, yuv420p, 30/1, no audio, 20.0 s (ffprobe, all 10)
- [x] Loop check: frame 600 of the 601-frame variant == frame 0, pixel for pixel (all 10)
- [x] Determinism: cold-start `remotion still` frame 300 == full-render frame 300, byte for byte (all 10)
- [x] Seam: the 599→0 step is in the range of ordinary steps (`scripts/seam.py`)
- [x] Film Dust black level: 50 points between the dust read 0,0,0 (max 1) in the decoded mp4
- [x] Grain/dither fade to 0 below ~3 % luminance on every look
- [x] No `Math.random()`, `Date.now()` or state driving visuals; no Pixi ticker
- [x] Banding check on the encoded mp4
- [x] Render times at 720p for all 10; two real 4K frames timed
- [x] Visual comparison against the references by separate agents, 3 rounds per look

## Notes and deviations

* **Bokeh disc size:** the brief says up to 25 % of frame height; the reference's front
  discs are ~34 %, and the comparison agents flagged smaller discs, so the front layer
  is 30–36 %. Change `LAYERS[2].d` in `src/looks/bokeh.ts` to cap it at 25 %.
* **Film Dust vertical scratches:** the rare long vertical scratches are a requested
  feature (0–2 per frame, faint). They are not a bug.
* **Bacteria realism:** a fresh agent judged the bokeh still "probably real footage"
  but the bacteria still "CG" (bead chains, monochrome tint). Both are part of the
  brief, and the reference itself is an abstract CG animation.
