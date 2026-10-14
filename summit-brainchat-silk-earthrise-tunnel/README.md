# Summit Path · AI Brain Chat · Black Silk · Earth Grid Rise · Light Tunnel

Five 3D looks, eight compositions, one Remotion project. Every composition is a
**20 s seamless loop** (600 frames at 30 fps), defined at **3840×2160**, rendered
with **three.js on WebGL2** through `@remotion/three`.

| Composition id | Output file | Look | Version |
|---|---|---|---|
| `SummitPath-Blue` | `SummitPath_Blue.mp4` | Summit Path | 1A Blue (as ref) |
| `SummitPath-GoldDawn` | `SummitPath_GoldDawn.mp4` | Summit Path | 1B Gold Dawn |
| `AIBrainChat-NeonBlue` | `AIBrainChat_NeonBlue.mp4` | AI Brain Chat | 2 Neon Blue (as ref) |
| `BlackSilk-Black` | `BlackSilk_Black.mp4` | Black Silk | 3A Black (as ref) |
| `BlackSilk-Champagne` | `BlackSilk_Champagne.mp4` | Black Silk | 3B Champagne |
| `EarthGridRise-Blue` | `EarthGridRise_Blue.mp4` | Earth Grid Rise | 4 Blue (as ref) |
| `LightTunnel-White` | `LightTunnel_White.mp4` | Light Tunnel | 5A White (as ref) |
| `LightTunnel-Graphite` | `LightTunnel_Graphite.mp4` | Light Tunnel | 5B Graphite |

(Remotion composition ids may not contain `_`, so ids use `-`; the file names
use `_`.)

## Quick start

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ (tested with Node 22). Versions are pinned in `package.json`
(Remotion 4.0.515, three 0.180.0, @react-three/fiber 9.4.0).

## Chromium GL flag

All looks need a WebGL2 context. Headless Chromium must use ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets this (`Config.setChromiumOpenGlRenderer("angle")`),
so the CLI commands below pick it up automatically. On a machine with a GPU,
ANGLE uses it; without a GPU, Chromium falls back to SwiftShader (software),
which is what the timings below were measured on.

## Render commands (4K)

```bash
npx remotion render SummitPath-Blue      out/SummitPath_Blue.mp4      --gl=angle
npx remotion render SummitPath-GoldDawn  out/SummitPath_GoldDawn.mp4  --gl=angle
npx remotion render AIBrainChat-NeonBlue out/AIBrainChat_NeonBlue.mp4 --gl=angle
npx remotion render BlackSilk-Black      out/BlackSilk_Black.mp4      --gl=angle
npx remotion render BlackSilk-Champagne  out/BlackSilk_Champagne.mp4  --gl=angle
npx remotion render EarthGridRise-Blue   out/EarthGridRise_Blue.mp4   --gl=angle
npx remotion render LightTunnel-White    out/LightTunnel_White.mp4    --gl=angle
npx remotion render LightTunnel-Graphite out/LightTunnel_Graphite.mp4 --gl=angle
```

The config sets H.264, `yuv420p`, CRF 16 and PNG intermediate frames.

**720p previews** (how the delivered previews were made):

```bash
scripts/render-all.sh                     # all 8, or pass ids
# = remotion render <id> --sequence --image-format=png --scale=0.3333333333333333
#   then ffmpeg -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30 -an
```

`--scale=0.3333333333333333` gives exactly 1280×720 (checked with ffprobe).

## Stills (6000×3375)

```bash
npx remotion still SummitPath-Blue out/SummitPath_Blue_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375.) Swap the id for any other
composition. All pixel sizes (line widths, point sprites, DoF, bloom) scale
with output height, so stills match the video at any resolution. 6K needs
roughly 2.4× the time of a 4K frame.

<!--TIMINGS-->

<!--CHECKS-->

## How to add a colourway (one data row)

Every version is one row in `src/versions.ts`. To add, say, a "Emerald"
Summit Path, copy a row and change the id, file name and colours:

```ts
{
  id: "SummitPath-Emerald",
  file: "SummitPath_Emerald",
  look: "summit",
  params: { ...the Blue row's params, facets: ["#0A3A2A", "#1A8A5A", "#6AF0B0"],
            halo: "#7AFFC8", bgTop: "#02140E", bgBottom: "#0A4A2A" },
},
```

The composition appears in the studio automatically. Each look's parameter
type (`SummitParams`, `BrainParams`, `SilkParams`, `EarthParams`,
`TunnelParams`) lists every value you can change.

## Determinism

Remotion renders frames out of order, across several browser tabs. Every
value on screen is computed from `useCurrentFrame() % 600` only:

- Layouts (mountain triangulation and path, traces, cubes, brain folds,
  cities/arcs, bokeh) are generated once from `mulberry32` seeds at module or
  build time. `Math.random()` is never used.
- R3F's `useFrame` is used only as the render hook (priority 1); its clock and
  delta are ignored. No `Date.now()`, no state carried between frames, no
  TAA or accumulative shadows.
- All periodic motion completes a whole number of cycles in 600 frames, so
  frame 600 equals frame 0.
- Textures load once; `delayRender` holds the first frame until they are
  uploaded.

## Project layout

```
src/
  Root.tsx           compositions, one per data row
  versions.ts        the 8 data rows
  lib/
    Stage.tsx        ThreeCanvas wrapper: frame -> scene update -> post pipeline
    post.ts          MSAA half-float scene, SSAO, DoF, bloom, ACES, grain, dither
    lines.ts         screen-space AA lines, point sprites, background quad
    rng.ts noise.ts glsl.ts
  looks/
    summit.ts brain.ts silk.ts earth.ts tunnel.ts
public/textures/     NASA Blue Marble + Black Marble (public domain)
scripts/             preview render + verification scripts
```

## Credits

Earth textures are NASA imagery, public domain:

- **NASA Blue Marble** (Visible Earth, NASA Earth Observatory / Reto Stöckli,
  topography + bathymetry), `public/textures/nasa_blue_marble_4096.jpg`
- **NASA Black Marble / Earth at Night** (NASA Earth Observatory / NOAA NGDC,
  Suomi NPP VIIRS), `public/textures/nasa_black_marble_4096.jpg`

Both are 4096×2048 equirectangular copies, obtained from the `three-globe`
project's example images because NASA's own hosts were unreachable from the
build environment. NASA imagery is not copyrighted; see
https://www.nasa.gov/nasa-brand-center/images-and-media/.

Everything else (geometry, materials, shaders, motion) is generated in code.
