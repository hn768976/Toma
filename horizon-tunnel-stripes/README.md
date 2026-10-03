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
720p PNG still of each. `remotion.config.ts` sets `muted`, so the mp4 has no
audio stream.

## Stills (6K)

```bash
npx remotion still EarthHorizon-Blue out/EarthHorizon_Blue_6K.png --frame=200 --scale=1.5625 --gl=angle
```

`--scale=1.5625` turns 3840×2160 into **6000×3375**. Use any composition id and
frame. The 3D is re-drawn at that size (Remotion's scale sets the device pixel
ratio, which the canvas follows), it is not an upscale.

## Render time

Measured on the machine that built this project: 4 vCPU cloud container,
**no GPU** (Chromium falls back to SwiftShader, i.e. WebGL on the CPU),
`--concurrency=2`, wall-clock time of the full 720p render divided by frames.

| Composition | 720p, s/frame (measured) | 4K, s/frame on this CPU box (estimate) | 4K full length (estimate) |
|---|---|---|---|
| EarthHorizon-Blue | 0.47 | ~7.4 | ~74 min |
| EarthHorizon-Gold | 0.47 | ~7.4 | ~74 min |
| NeonGridTunnel-Blue | 0.53 | ~7.1 | ~71 min |
| NeonGridTunnel-Magenta | 0.52 | ~7.1 | ~71 min |
| HierarchyNetwork | 0.93 | ~7.2 | ~43 min (360 f) |
| DiagonalSlats-Black | 0.89 | ~11.6 | ~116 min |
| DiagonalSlats-White | 0.89 | ~11.6 | ~116 min |
| SpeedTrails | 0.30 | ~4.7 | ~47 min |

How the 4K estimate was made: one 4K still and one 720p still of each look
were timed on the same box; the difference (4.4–10.7 s) is the extra cost of a
4K frame, added to the measured 720p per-frame time. It includes PNG encoding
of the 8.3 MP frame. On a machine with a real GPU (ANGLE on Metal/D3D/Vulkan)
expect roughly an order of magnitude faster; the CPU numbers are a worst case.

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
  2·L; roll and sway are whole sine cycles.
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

Results on the delivered 720p previews (frame 200, values are Rec.709 luma 0–255):

| Clip | Line | Range | Max step (smoothed) | Longest flat run |
|---|---|---|---|---|
| EarthHorizon_Blue (1A) | sky, vertical, x=120 | 4.8 → 18.8 | 1.47 | 13 px |
| NeonGridTunnel_Blue (2A) | centre → left edge | 4.2 → 98.5 | 5.2 (bar edges) | 18 px |
| DiagonalSlats_Black (4A) | along a slat through the light sweep | 4.3 → 20.6 | 0.61 | 18 px |
| DiagonalSlats_White (4B) | along a slat through the light sweep | 203 → 230 | 0.38 | 12 px |

An undithered 14-level ramp over ~480 px would show ~32 px plateaus with
1-level jumps; the profiles above change smoothly. Contrast-stretched crops
(×4–7) of the encoded frames also show no contour lines.

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

- [x] 8 compositions, 3840×2160, 30 fps, one Remotion project, three.js via `@remotion/three`, WebGL2 (ANGLE).
- [x] Lengths: HierarchyNetwork 360 frames, all others 600 frames.
- [x] 720p previews: 1280×720, H.264, yuv420p, 30/1, CRF 16, no audio; 12.0 s / 20.0 s (ffprobe).
- [x] One 720p PNG still per composition.
- [x] Loops: frame 600 == frame 0 byte-for-byte for all 7 looping compositions.
- [x] Speed Trails background exactly 0,0,0 in the encoded mp4 (no grain/dither on black).
- [x] Determinism: frame 200 rendered alone from a cold start == frame 200 from a multi-tab range render, byte-for-byte, all 8.
- [x] Banding: dither ±1/255 after bloom + tonemapping; grain 2 % (1.5 % in 4B) from pixel position and frame; checked on the encoded mp4.
- [x] ACES filmic tonemapping, sRGB output.
- [x] No `Math.random()`, no `Date.now()`, no R3F clock, no TAA / temporal AO / accumulated shadows.
- [x] HDRI (Poly Haven, CC0) and Natural Earth (public domain) shipped with licences, loaded behind `delayRender`.
- [x] No text, logos or brands.
- [x] Render time per frame at 720p measured and recorded above, with a 4K estimate.
