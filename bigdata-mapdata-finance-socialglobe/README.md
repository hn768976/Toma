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

## Render time

RENDER_TIMES_PLACEHOLDER

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
- **Depth of field** is per layer: each layer renders into a 4× MSAA
  half-float target and is either blurred uniformly (2.5D layers) or, for
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

BANDING_PLACEHOLDER

## Completion checklist

CHECKLIST_PLACEHOLDER

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
