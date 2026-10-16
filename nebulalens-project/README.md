# Nebula Lens · Champagne · Data Montage · Fire Core · Bright Bar Chart

Eight **20 s seamless loops** (600 frames, 30 fps, 3840×2160) in one Remotion
project, built entirely in code from five reference looks.

| # | Composition id (Remotion) | Output file | Look | Engine |
|---|---------------------------|-------------|------|--------|
| 1 | `NebulaLens-Pastel` | `NebulaLens_Pastel.mp4` | black hole lensing a drifting pastel nebula | full-screen fragment shader (three.js / `@remotion/three`) |
| 2 | `Champagne-Gold` | `Champagne_Gold.mp4` | bubbles rising through gold sparkling wine | PixiJS 8 (WebGL2) |
| 3 | `Champagne-Rose` | `Champagne_Rose.mp4` | the same in rosé | PixiJS 8 |
| 4 | `DataMontage-Blue` | `DataMontage_Blue.mp4` | layered glowing infographics with parallax and DoF | three.js + Canvas 2D textures |
| 5 | `FireCore-Ember` | `FireCore_Ember.mp4` | white-hot core, fiery tendrils streaming outward | full-screen fragment shader |
| 6 | `FireCore-Electric` | `FireCore_Electric.mp4` | the same in cold blue-white | full-screen fragment shader |
| 7 | `BarChart-BlueViolet` | `BarChart_BlueViolet.mp4` | bright tilted chart, camera gliding | three.js + Canvas 2D texture |
| 8 | `BarChart-TealGreen` | `BarChart_TealGreen.mp4` | the same in teal-green | three.js + Canvas 2D texture |

Remotion composition ids may only contain `a-z A-Z 0-9 -`, so the ids use a
hyphen where the file names use an underscore.

## Setup

```bash
npm install          # versions are pinned in package.json / package-lock.json
npx remotion studio  # preview (the Studio caps the canvas at 1:1 pixels)
```

**Chromium GL flag:** every render must use WebGL2 through ANGLE:
`--gl=angle`. `remotion.config.ts` already sets
`Config.setChromiumOpenGlRenderer("angle")`, so the CLI picks it up
automatically. Pass it explicitly when using the Node APIs
(`chromiumOptions: { gl: "angle" }`). WebGPU is not used.

## 4K render commands

`remotion.config.ts` sets H.264, `yuv420p`, CRF 16 and PNG intermediates.

```bash
npx remotion render NebulaLens-Pastel   out/NebulaLens_Pastel.mp4   --gl=angle
npx remotion render Champagne-Gold      out/Champagne_Gold.mp4      --gl=angle
npx remotion render Champagne-Rose      out/Champagne_Rose.mp4      --gl=angle
npx remotion render DataMontage-Blue    out/DataMontage_Blue.mp4    --gl=angle
npx remotion render FireCore-Ember      out/FireCore_Ember.mp4      --gl=angle
npx remotion render FireCore-Electric   out/FireCore_Electric.mp4   --gl=angle
npx remotion render BarChart-BlueViolet out/BarChart_BlueViolet.mp4 --gl=angle
npx remotion render BarChart-TealGreen  out/BarChart_TealGreen.mp4  --gl=angle
```

**6K still (6000×3375):**

```bash
npx remotion still NebulaLens-Pastel out/NebulaLens_Pastel_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(Any composition id works. 3840 × 1.5625 = 6000.)

**720p previews** (how the delivered previews were made):

```bash
scripts/render-preview.sh NebulaLens_Pastel
```

This renders all 600 frames as a PNG sequence with `--scale=0.3333333333333333`
(1280×720, `--concurrency=4`, frames rendered out of order across threads).
It then encodes them with ffmpeg: `libx264 -crf 16 -pix_fmt yuv420p`, 30 fps,
no audio. The output size is exactly 1280×720, because every renderer rounds
`3840 × scale` instead of flooring it (see `src/lib/output.ts`), so the 0.5×
fallback was not needed.

## Measured render times

MEASUREMENTS_PLACEHOLDER

## How it is built

* **Determinism.** Every value on screen is a function of
  `useCurrentFrame() % 600`. Layouts (stars, bubbles, streams, infographic
  placement, chart series, ticker values) are generated once at module level
  from `mulberry32` seeds (`src/lib/random.ts`). Nothing calls `Math.random()`
  or `Date.now()`, and no state is carried between frames. The three.js looks
  render from an R3F priority-1 callback that reads the Remotion frame only and
  never touches R3F's clock. There is no TAA and no accumulation. Fonts and the
  Natural Earth mask load once, behind `delayRender` / `continueRender`
  (`src/lib/assets.ts`).
* **Loops.** All noise is *periodic* (integer lattice periods,
  `src/lib/glsl.ts`), and every motion advances by a whole number of periods
  per 600 frames:
  * Nebula: the background slides exactly one tile, the noise evolves round a
    circle, and the infall stream flows inward by two whole lattice cells.
  * Fire: the outward flow moves one full log-radius period, and flicker runs
    on a periodic time axis.
  * Bubbles: they wrap a whole number of times, and their wobble has integer
    cycle counts.
  * Data Montage: each layer slides a whole number of wrap widths, and gauge,
    bar, wave and globe periods divide 600.
  * Bar Chart: bar and line cycles are whole, candles scroll two whole series
    periods, and the camera follows one cosine cycle.
* **Banding.** Scenes render into half-float targets: the shader passes, the
  three.js post chain (DoF blurs, bloom), and the PixiJS scene target
  (`rgba16float`). A shared final pass (`GRAIN_DITHER` in `src/lib/glsl.ts`)
  then adds about 1% monochrome grain from a hash of (pixel, frame), faded out
  below 3% luminance, plus a ±1/255 dither. The dither comes from a 64×64
  void-and-cluster **blue-noise** map with a new offset every frame
  (`src/lib/blueNoise.ts`). All eight compositions use the blue-noise dither.
* **Depth of field (Data Montage).** Each of the five depth layers renders into
  its own half-float target and gets its own gaussian blur, with focus on the
  middle layer. A quarter-resolution bloom and a violet lens flare are added in
  the final composite.
* **Lensing (Nebula).** Point-mass lens: β = θ − θE²/θ, with θE = 1.6 × the
  shadow radius. The shadow is pure black. There is also a thin photon ring,
  beamed into two crescents, and a gentle swirl. Stars are supersampled, and
  their source-plane footprint is widened by the local lens magnification so
  they don't sparkle near the ring.

## Adding a colourway (one data row)

Every version is one row in `src/versions.ts`. Copy a row, give it a new `id`
(this becomes the output name; the composition id is the same with `_` → `-`),
and change its colours:

```ts
{
  id: "FireCore_Toxic",
  look: "firecore",
  ref: "4036022599",
  palette: { tendrilHot: "#B8FF3A", tendrilCool: "#2A9A0A", core: "#F4FFE0", haze: "#041A02" },
},
```

The composition appears in the Studio and renders with the commands above.

## Assets and licences

* `public/fonts/`: **Inter** 4.1 (chart values) and **JetBrains Mono** 2.304
  (small codes). Both are SIL OFL 1.1, and the licence texts sit next to the
  files.
* `public/data/ne_110m_land.geojson`: **Natural Earth 1:110m land**, public
  domain (see `public/data/NATURAL_EARTH_NOTE.md`).
* `src/data/tickers.ts`: the **invented ticker list**. No logos, brands or real
  tickers are used, and all values are made up.

## Verification

VERIFICATION_PLACEHOLDER
