# Big Data Screen · Data World Map · Finance Infographic · Social Globe · Global Security Lock

Five data/technology motion graphics in one Remotion project, built entirely in
code (three.js on WebGL2 through `@remotion/three`, Canvas 2D for flat UI).

| Composition id | Look | Frames | Length |
|---|---|---|---|
| `BigDataScreen-Blue` | Big Data Screen | 600 | 20 s, build-in then live hold |
| `DataWorldMap-BlueYellow` | Data World Map | 600 | 20 s seamless loop |
| `FinanceInfographic-Teal` | Finance Infographic | 600 | 20 s, build-in then live hold |
| `SocialGlobe-Blue` | Social Globe | 900 | 30 s seamless loop |
| `GlobalSecurityLock-Blue` | Global Security Lock | 600 | 20 s, build-in then live hold |

All compositions are 3840×2160 at 30 fps.

## Setup

```bash
npm install
npx remotion studio          # preview (the Studio renders at half resolution for speed)
```

Node 18+; versions are pinned in `package.json` / `package-lock.json`.

## Chromium GL flag

WebGL2 is required. Renders use ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer("angle")`.
With a GPU, ANGLE uses it. Without one (CI containers), Chromium falls back
to SwiftShader; `--gl=swangle` selects that explicitly. Both produce the same
picture; only speed differs.

## 4K render commands

`remotion.config.ts` sets H.264, `yuv420p`, CRF 16, PNG frames, no audio.

```bash
npx remotion render BigDataScreen-Blue        out/BigDataScreen_Blue_4K.mp4        --gl=angle
npx remotion render DataWorldMap-BlueYellow   out/DataWorldMap_BlueYellow_4K.mp4   --gl=angle
npx remotion render FinanceInfographic-Teal   out/FinanceInfographic_Teal_4K.mp4   --gl=angle
npx remotion render SocialGlobe-Blue          out/SocialGlobe_Blue_4K.mp4          --gl=angle
npx remotion render GlobalSecurityLock-Blue   out/GlobalSecurityLock_Blue_4K.mp4   --gl=angle
```

Each frame is a pure function of the frame number, so `--concurrency` can be
raised freely on a GPU machine. Under SwiftShader, one tab already uses every
core, so `--concurrency=1` is fastest.

## 6K still (6000×3375)

```bash
npx remotion still BigDataScreen-Blue out/BigDataScreen_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(Same for the other ids. 3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375.)

## 720p previews

```bash
scripts/render-previews.sh out            # all five
scripts/render-previews.sh out SocialGlobe-Blue
```

Renders a lossless PNG sequence at `--scale=0.3333333333333333` (exactly
1280×720), encodes H.264 / yuv420p / CRF 16 / 30 fps with ffmpeg, and saves a
720p still (frame 300).

## How the look was matched

Each composition went through three rounds of review. In each round a fresh
agent compared a frame of the reference clip with a frame of the 720p preview
and listed the differences, and the differences that affected the overall
impression were fixed. The reference clips are not shipped (`refs/` is
excluded).

## Render time

Measured in the build container: 4 CPU cores, **no GPU** (Chromium WebGL2 via
ANGLE on SwiftShader), one tab (`--concurrency=1`; more tabs were slower
because SwiftShader already uses every core).

| Composition | 720p, s/frame | 720p, whole clip | 4K, s/frame | 4K whole clip, this machine |
|---|---|---|---|---|
| BigDataScreen-Blue | 1.51 | 15 min (600 f) | 9.3 | ~95 min |
| DataWorldMap-BlueYellow | 2.5 | 25 min (600 f) | 14.7 | ~150 min |
| FinanceInfographic-Teal | 2.3 | 23 min (600 f) | 12.7 | ~130 min |
| SocialGlobe-Blue | 1.09 | 16 min (900 f) | 5.0 | ~75 min |
| GlobalSecurityLock-Blue | 1.52 | 15 min (600 f) | 12.6 | ~125 min |

720p times for BigDataScreen, SocialGlobe and GlobalSecurityLock are whole
renders divided by the frame count. DataWorldMap and FinanceInfographic are
the marginal cost of 60 frames (frames 300 to 359), because their whole
renders shared the CPU with checks. 4K times are the marginal cost of
frames 300 to 303 at `--scale=1`. These are not projections from 720p.

**4K estimate.** Without a GPU, allow about 1.5 to 2.5 hours per clip.
On a machine with a GPU, ANGLE uses the GPU, and the work that dominates here
(the MSAA layer passes, the blur pyramid and the large textures) runs much
faster. That GPU figure is my expectation and was not measured: roughly
1 to 3 s per 4K frame, so about 10 to 30 min per clip with `--concurrency=1`.
Raising `--concurrency` is safe, because every frame is independent.

## How it is built

```
src/
  Root.tsx                 compositions (+ `frames` / `grade` input props)
  lib/
    Stage.tsx              <ThreeCanvas> wrapper: build once, update(frame), render
    pipeline.ts            layered DoF, bloom, tonemap, grain + dither
    batch2d.ts             instanced 2D widgets on panels (rects, lines, arcs, dots, text)
    prims3d.ts             point clouds, billboards, screen-space 3D lines
    canvas.ts              Canvas 2D helpers, glyph atlas (JetBrains Mono), icon atlas
    assets.ts              fonts + Natural Earth loading behind delayRender
    random.ts              mulberry32 (module-level seeds) + pure integer hashes
  looks/                   one file per look
public/fonts               Inter, JetBrains Mono (OFL, licences alongside)
public/data                Natural Earth 1:50m land (public domain, licence alongside)
scripts/render-previews.sh
```

- **Static flat UI** (frames, labels, tiny text, grids, maps) is drawn once
  with Canvas 2D into sRGB textures with mipmaps and 16× anisotropic
  filtering (the Big Data Screen tile is 8192×8192).
- **Everything that moves on a panel** (rolling digits, growing bars, donut
  sweeps, table scrolls, blinks) is a GPU instanced batch whose buffers are
  filled every frame from pure functions of the frame number. Rects, lines and
  arcs use analytic box-filter coverage, and glyphs come from a mipmapped atlas
  through `textureGrad`, so small digits and thin lines hold steady at steep
  angles. No canvas is ever redrawn incrementally.
- **Depth of field** is per layer: each layer renders into a half-float
  target (4× MSAA for layers that stay sharp; blurred layers skip MSAA) and
  is either blurred uniformly (2.5D layers) or, for
  tilted planes, blended per pixel between pre-blurred levels by a circle of
  confusion computed from its depth buffer (the diagonal focus band of the Big
  Data Screen).
- **Final pass**: bloom (6-level mip chain), a hue-preserving soft-shoulder
  tonemap, vignette, then sRGB encode, **grain ≈1.5 %** and **±1/255
  triangular dither**, both a PCG hash of (pixel, frame). No temporal effects.

## Determinism

Remotion renders frames out of order on several tabs, so:

- no `Math.random()`, `Date.now()`, `useFrame` clock or `useState`-driven
  visuals; layouts come from `mulberry32` streams seeded at module level,
  per-frame variation from pure integer hashes of the frame;
- loops (looks 2 and 4) use only whole cycles per loop (600 / 900 frames),
  including the grain hash, which gets `frame % loop`;
- fonts and map data are loaded behind `delayRender` / `continueRender`.

## Banding check

Final pass, after bloom and tonemapping: sRGB encode, then **grain ≈1.5 %**
(zero-mean triangular noise) and **±1/255 triangular dither** per channel.
Both are a PCG hash of (pixel x, pixel y, frame), never `Math.random()`.
The loops feed the hash `frame % loop`, so grain repeats with the loop.

How it was checked: frame 300 was decoded **from each encoded mp4** (H.264,
yuv420p, CRF 16, `-tune grain`). In the smooth dark gradients and glow
falloffs (found automatically: gentle slope, low local contrast, dark), the
check measures how often neighbouring pixels share the same 8-bit value and
how long those runs are. A control is made by blurring the same frame and
requantising it to 8 bits, which produces real banding.

| Composition | identical neighbours | p99 run | max run | control: identical / p99 / max |
|---|---|---|---|---|
| BigDataScreen-Blue | 20.2 % | 5 px | 12 px | 63 % / 13 px / 51 px |
| DataWorldMap-BlueYellow | 21.8 % | 5 px | 15 px | 70 % / 19 px / 66 px |
| FinanceInfographic-Teal | 20.6 % | 5 px | 13 px | 58 % / 14 px / 31 px |
| SocialGlobe-Blue | 21.3 % | 5 px | 10 px | 61 % / 14 px / 39 px |
| GlobalSecurityLock-Blue | 19.8 % | 5 px | 8 px | 72 % / 16 px / 36 px |

Each gradient's 15 px local mean changes smoothly across the frame, with no
plateaus. The first encode used plain `-preset slow`, and one flattened patch
showed up in DataWorldMap: a 68 px run of identical pixels where the source
PNG had about 320 distinct values. `-tune grain` keeps the dither through the
encoder, and `scripts/render-previews.sh` now uses it.

## Completion checklist

All checks were run on the final 720p renders:

- [x] **Files:** 1280×720 (exact; `--scale=0.3333333333333333` gives
      1280×720), 30/1, h264, yuv420p, video stream only. 20.0 s for looks 1,
      2, 3 and 5; 30.0 s for look 4.
- [x] **Loops:** DataWorldMap rendered at 601 frames and SocialGlobe at 901.
      Frame 0 and the last frame are pixel-identical (0 differing pixels).
- [x] **Determinism:** frame 300 rendered alone from a cold start is
      **byte-identical** to frame 300 of the full render, for all five looks.
      Frame 75 (inside the build-in) is byte-identical for looks 1, 3 and 5.
- [x] **Banding:** checked on frames decoded from the mp4 (table above).
- [x] **Content:** a five-frame contact sheet per look shows the required
      elements. Look 1 builds in from black. Look 2 has a dotted map with
      yellow and cyan bars and blurred drifting layers. Look 3 builds in and
      has the bar chart, the "45" tile, the donuts, the tables and both globes
      turning. Look 4 has the dotted globe, the coil ring, people and links,
      and turns once in 900 frames. Look 5 starts on the dark map, then shows
      the burst, the binary padlock and the streak.
- [x] **Smoothness:** frames 299, 300 and 301 with grain removed. 0.0 to 0.6 %
      of pixels change by more than 24 levels per frame, and that change is
      the intended rolling digits and blinks. There are no flicker spikes on
      slanted small digits, thin lines, the dot map or the point globe
      (all line, rect, arc and glyph primitives are analytically
      anti-aliased; sub-pixel points fade rather than drop out).
- [x] **Content:** no logos, brands, real tickers or real data. All text and
      numbers are invented and all icons are self-drawn.
- [x] **Clean copy:** `npm install && npx remotion studio` from a fresh copy
      (no `node_modules`) installs and starts, and all five compositions
      resolve.

## Adding a colourway

Two levels, depending on how far the new colourway goes:

1. **Grade (no code):** every composition takes an optional `grade` input
   prop, applied in linear light before tonemapping: `hue` (degrees, rotates
   around the neutral axis), `saturation` (multiplier), `tint` (linear RGB
   multiplier). Register a new composition in `src/Root.tsx`:

   ```tsx
   <Composition
     id="SocialGlobe-Violet"
     component={SocialGlobe}
     durationInFrames={SOCIAL_FRAMES}
     defaultProps={{ grade: { hue: 40, saturation: 1.1 } } as Props}
     calculateMetadata={withFrames(SOCIAL_FRAMES)}
     {...common}
   />
   ```

   or try it without code:
   `npx remotion render SocialGlobe-Blue out/test.mp4 --props='{"grade":{"hue":40}}'`.
   Without `grade`, the final pass skips the grade entirely, so existing
   renders are unchanged bit for bit.

2. **Exact palette:** each look file starts with its colour constants
   (for example `C_HI`, `C_MID`, `C_BG` in `looks/BigDataScreen.tsx`; `YEL`,
   `CYA`, `MAPDOT`, `BG` in `looks/DataWorldMap.tsx`). Copy the look file,
   change the constants, export the component under a new name and register
   it with a new id (e.g. `BigDataScreen-Amber`). The pipeline background
   colour is the `background` field returned from `build()`.

## Credits and licences

- Fonts: Inter and JetBrains Mono, SIL Open Font License 1.1
  (`public/fonts/OFL-*.txt`), from the Fontsource packages.
- Map data: Natural Earth (public domain), `public/data/LICENSE-NaturalEarth.txt`.
- All numbers, labels and icons are invented and self-drawn. No logos,
  brands, tickers or real data.
