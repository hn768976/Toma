# Horizon · Tunnel · Stripes — Remotion + three.js motion backgrounds

Five looks, eight compositions, one Remotion project. Everything is built in
code (three.js through `@remotion/three`, WebGL2). No text, logos or brands.

| Composition id | Look | Length | Loop |
|---|---|---|---|
| `EarthHorizon-Blue` | Earth Horizon Rays, blue | 600 f (20 s) | yes |
| `EarthHorizon-Gold` | Earth Horizon Rays, gold | 600 f (20 s) | yes |
| `NeonGridTunnel-Blue` | Neon Grid Tunnel, blue | 600 f (20 s) | yes |
| `NeonGridTunnel-Magenta` | Neon Grid Tunnel, magenta + cyan | 600 f (20 s) | yes |
| `HierarchyNetwork` | Hierarchy Network, blue | 360 f (12 s) | no |
| `DiagonalSlats-Black` | Diagonal Slats, black | 600 f (20 s) | yes |
| `DiagonalSlats-White` | Diagonal Slats, white | 600 f (20 s) | yes |
| `SpeedTrails` | Speed Trails, blue & orange on pure black | 600 f (20 s) | yes |

All compositions are defined at **3840×2160, 30 fps, 16:9**.

> **Speed Trails is meant for Screen / Add blending.** Its background is exactly
> RGB 0,0,0 (no grain or dither on black), so it can be laid over other footage
> with a Screen or Add blend mode and the black disappears.

## Setup

```bash
npm install
npx remotion studio        # preview (the Studio draws at max 1080p for speed)
```

Node 18+ is required. Versions are pinned in `package.json`.

### Chromium GL flag

three.js needs a real WebGL2 context in headless Chromium. `remotion.config.ts`
sets it for every CLI command:

```ts
Config.setChromiumOpenGlRenderer("angle");   // == --gl=angle
```

If you render with the Node API or override the config, pass `--gl=angle`
yourself. On a machine with a GPU, ANGLE uses it; without one it falls back to
SwiftShader (CPU), which is slower but produces identical-looking output.

## Render commands (4K)

```bash
npx remotion render EarthHorizon-Blue      out/EarthHorizon_Blue_4K.mp4      --gl=angle
npx remotion render EarthHorizon-Gold      out/EarthHorizon_Gold_4K.mp4      --gl=angle
npx remotion render NeonGridTunnel-Blue    out/NeonGridTunnel_Blue_4K.mp4    --gl=angle
npx remotion render NeonGridTunnel-Magenta out/NeonGridTunnel_Magenta_4K.mp4 --gl=angle
npx remotion render HierarchyNetwork       out/HierarchyNetwork_4K.mp4       --gl=angle
npx remotion render DiagonalSlats-Black    out/DiagonalSlats_Black_4K.mp4    --gl=angle
npx remotion render DiagonalSlats-White    out/DiagonalSlats_White_4K.mp4    --gl=angle
npx remotion render SpeedTrails            out/SpeedTrails_4K.mp4            --gl=angle
```

The config already sets H.264, `yuv420p`, CRF 16 and PNG intermediate frames
(no JPEG blocking in soft gradients). For a mastering codec add e.g.
`--codec=prores --prores-profile=4444`.

720p previews (what was delivered): `scripts/render-previews.sh`, which runs
`npx remotion render <id> out/previews/<name>.mp4 --scale=0.3333333333333333`
for each composition (1280×720 exactly; checked with ffprobe) and saves a
720p PNG still of each.

## Stills (6K)

```bash
npx remotion still EarthHorizon-Blue out/EarthHorizon_Blue_6K.png --frame=200 --scale=1.5625 --gl=angle
```

`--scale=1.5625` turns 3840×2160 into **6000×3375**. Use any composition id and
frame. The 3D is re-drawn at that size (Remotion's scale sets the device pixel
ratio, which the canvas follows), it is not an upscale.

## Render time

__RENDER_TIMES__

## How it is built

```
src/
  Root.tsx              8 <Composition>s (3840x2160, 30 fps)
  compositions.tsx      one component + post settings per look
  versions.ts           one data row per colour version
  engine/
    Stage.tsx           ThreeCanvas wrapper; renders each frame from useCurrentFrame()
    post.ts             HDR post: DOF, bloom mip chain, ACES, sRGB, grain, dither
    lines.ts            instanced thick glowing lines (world or screen width, per-line DOF)
    dots.ts             glowing points
    backdrop.ts         full-frame shader layers (sky, column, analytic atmosphere)
    assets.ts           HDRI + Natural Earth loading behind delayRender
    random.ts           mulberry32
  looks/  earth.ts  tunnel.ts  hierarchy.ts  slats.ts  trails.ts
public/
  hdri/studio_small_03_1k.hdr           Poly Haven, CC0
  naturalearth/ne_50m_land.geojson      Natural Earth, public domain
```

* **Tonemapping:** ACES filmic (the same fit three.js uses), then sRGB encode,
  done in the final pass.
* **Bloom / DOF** run at fixed working heights (bloom 360 px, DOF 720 px), so
  the 720p preview and the 4K master have the same glow spread and blur size
  relative to the frame.
* **Lines** are expanded in screen space with an anti-aliased profile and a
  minimum on-screen width (thinner lines are widened and dimmed by the same
  factor), so they don't shimmer at 720p and stay fine at 4K.

### Determinism

Remotion renders frames out of order across several tabs. Every value on screen
is a function of `useCurrentFrame()` only:

* All randomness is `mulberry32`, seeded at module level, used once when the
  scene is built. No `Math.random()`, `Date.now()`, R3F clock, `useState`
  animation or values carried between frames.
* R3F's `useFrame` is used only as the hook that draws (priority 1); it never
  reads R3F's clock or delta — it reads the Remotion frame number.
* No TAA, temporal AO or accumulated shadows. Shadows in Diagonal Slats are a
  regular shadow map, recomputed every frame.
* Grain and dither come from an integer hash of (pixel x, pixel y, frame mod loop).
* The HDRI and Natural Earth data load behind `delayRender` / `continueRender`.

### Loops

Looping compositions accept `{"loopCheck": true}` as input props, which makes
them 601 frames so frame 600 can be compared with frame 0:

```bash
npx remotion still SpeedTrails out/f0.png   --frame=0   --props='{"loopCheck":true}' --scale=0.3333333333333333
npx remotion still SpeedTrails out/f600.png --frame=600 --props='{"loopCheck":true}' --scale=0.3333333333333333
python3 scripts/verify.py same out/f0.png out/f600.png
```

* Earth: the globe turns exactly 360° per 600 frames; ray streaks move by whole
  repeats; twinkles and orbit arcs use whole cycles.
* Tunnel: built from a repeating segment of length L; camera travels exactly
  3·L; roll and sway are whole sine cycles.
* Slats: light sweeps, glints and camera drift are whole cycles.
* Speed Trails: dashes move by whole repeats along their ribbons.

## Banding check

Done on the **encoded mp4**, not the preview window:

```bash
python3 scripts/verify.py band out/previews/DiagonalSlats_Black.mp4 200 0,360,1279,360
```

It extracts the frame with ffmpeg, reads pixel values along the line and reports
the largest step in a lightly smoothed profile and the longest perfectly flat
run. Banding shows as long flat runs separated by 1-level jumps; with the
±1/255 dither (after bloom and tonemapping) plus 2 % grain (1.5 % in the white
slats) the profile changes smoothly.

__BANDING__

## Adding a colourway

1. Add a row to the relevant table in `src/versions.ts`, e.g.

   ```ts
   export const EARTH_VERSIONS = {
     Blue: { ... },
     Gold: { ... },
     Green: { rim: "#5CFFB0", land: "#2E9A6A", ocean: "#04201A",
              skyTop: "#020A08", skyHorizon: "#0A3A2A", star: "#DFFFF0" },
   };
   ```

2. Add a `<Composition>` in `src/Root.tsx` with `id="EarthHorizon-Green"` and
   `defaultProps={{ version: "Green", loopCheck: false }}` (copy an existing
   entry). For the tunnel and slats looks also add an entry to `TUNNEL_POST` /
   `SLAT_POST` in `src/compositions.tsx` (they carry the background colour,
   exposure and grain).
3. `npx remotion studio` to check it, then render as above.

## Licences

* `public/hdri/studio_small_03_1k.hdr` — "Studio Small 03" by Poly Haven,
  **CC0** (https://polyhaven.com/a/studio_small_03). Fetched from the pmndrs
  drei-assets mirror of the Poly Haven file.
* `public/naturalearth/ne_50m_land.geojson` — Natural Earth 1:50m land
  polygons, **public domain** (https://www.naturalearthdata.com/about/terms-of-use/).
  See `public/naturalearth/LICENSE.md`.

## Completion checklist

__CHECKLIST__
