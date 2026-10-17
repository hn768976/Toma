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

Measured in this build environment: a 4-core cloud container with **no GPU**.
WebGL ran on ANGLE → SwiftShader (CPU), so a machine with a real GPU will be much
faster. The 720p numbers are wall-clock times for the full 600-frame
`scripts/render-preview.sh` render at `--concurrency=4`.

| Composition | 720p, 600 frames | 720p per frame | 4K per frame (estimate) | 4K, 600 frames (estimate) |
|---|---|---|---|---|
| `NebulaLens_Pastel` | 2156 s | 3.59 s | 18.7–32.3 s | 3.1–5.4 h |
| `Champagne_Gold` | 73 s | 0.12 s | 0.7–1.1 s | 7–11 min |
| `Champagne_Rose` | 74 s | 0.12 s | 0.7–1.1 s | 7–11 min |
| `DataMontage_Blue` | 246 s | 0.41 s | 2.5–3.7 s | 25–37 min |
| `FireCore_Ember` | 1683 s | 2.81 s | 14.6–25.2 s | 2.4–4.2 h |
| `FireCore_Electric` | 1686 s | 2.81 s | 14.6–25.3 s | 2.4–4.2 h |
| `BarChart_BlueViolet` | 172 s | 0.29 s | 1.7–2.6 s | 17–26 min |
| `BarChart_TealGreen` | 168 s | 0.28 s | 1.7–2.5 s | 17–25 min |

**Two real 4K frames were timed** (frame 300, `npx remotion still … --scale=1`,
single still, cold browser). Browser and bundle start-up is about 2.7 s per
still and is subtracted below:

* **NebulaLens_Pastel:** 40.4 s wall for the 4K still, so about **38 s for the
  frame**. The same frame at 720p took 10.1 s wall (about 7.3 s for the frame),
  a 4K/720p ratio of about 5.2×. This is below the 9× pixel ratio because the
  4K path uses 2×2 star supersampling instead of 3×3.
* **Champagne_Gold:** 4.5 s wall for the 4K still, so about **1.8 s for the
  frame**. At 720p it took 3.0 s wall (about 0.3 s for the frame).

The 4K estimates take the multi-threaded 720p throughput and scale it. The low
end uses the measured 4K/720p ratio: 5.2× for the shader looks and about 6× for
the others. The high end is the full 9× pixel ratio. On a desktop GPU with
`--gl=angle`, expect the shader looks to be one to two orders of magnitude
faster.

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

Every check below was run on the delivered 720p previews. The scripts are in
`scripts/`, and the logs are in `verification/`: ffprobe output, the loop and
determinism log, the banding report, motion stats, render timings, and the
reference-comparison notes from each sub-agent round.

1. **File checks** (`scripts/verify.py probe`): all 8 are 1280×720, 30/1, h264,
   yuv420p, no audio stream, 20.000 s. **PASS.**
2. **Loop** (`scripts/check-loop-determinism.sh`): `--props='{"loopCheck":true}'`
   makes a composition 601 frames long, and frame 600 is rendered and compared
   with frame 0. The two are **pixel- and byte-identical for all 8**.
   Continuity across the seam: the mean change from frame 599 to frame 600 is
   in line with an ordinary step (298→299). For example Nebula 4.34 vs 4.51,
   Champagne 3.18 vs 3.00, Fire 1.92 vs 2.01, Data Montage 6.35 vs 6.98, and Bar
   Chart 5.04 vs 5.30.
   (The first run caught a seam in Nebula, 12.3 vs 4.5: two half-scale noise
   fields advanced only 1.5 cells against a 3-cell period. This is fixed; the
   tile now has F = 4 cells and the half-scale fields use a 2-cell period.)
3. **Determinism:** frame 300 rendered alone from a cold start is
   **byte-identical** to frame 300 of the full multi-threaded, out-of-order
   render **for all 8**.
4. **Banding** (`scripts/verify.py band2`, frames taken *from the encoded mp4*,
   results in `verification/banding-report.txt`): along each gradient, the trimmed
   mean of each column never stays on one value for more than 2–4 px. For
   comparison, an undithered 8-bit version of the Champagne column (96 levels
   over 720 px) would plateau for about 7 px per level, and the Data Montage
   navy (37 levels over 720 px) for about 19 px. Fire's vignetted corners show
   longer flat runs, but there the signal itself is constant near black
   ((11,0,0) and (0,0,8)), and contrast-stretched crops show no contour steps.
5. **Contact sheets** (`scripts/contact-sheet.sh`, frames 0/120/240/360/480):
   each shows the required features. Nebula has the black disc, thin ring,
   lensed nebula and stars, and drift. Champagne has gold or rosé liquid, rising
   bubbles of many sizes, streams, a bright centre and a vignette. Data Montage
   has layered glowing infographics, parallax, DoF and the violet flare. Fire
   has the white-hot core and outward tendrils. Bar Chart has the tilted chart,
   translucent bars, values, candles and lines, and only invented tickers.
6. **Motion** (`scripts/motion-stats.py`, frames 285–345 of the full render):
   the mean frame-to-frame change is steady, with max/median between 1.01 and
   1.07 and no spikes, so there is no sparkle, boiling or popping. Strips of
   consecutive crops show smooth lensing at the ring, steady outward tendrils,
   and grid and values without shimmer. The bubble physics holds by
   construction (`src/looks/Champagne.tsx`): wraps per loop *k* rise with
   diameter, size grows 28% from bottom to top, the wobble has whole cycles,
   and stream bubbles accelerate and grow.
7. / 8. **Reference comparison:** done by eye, then three rounds of fresh,
   context-free sub-agent comparisons for looks 1, 2, 4, 5 and 7, plus a
   champagne-realism check each round. See the delivery notes for what each
   round flagged and what changed.

### Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] Remotion + `@remotion/three` (WebGL2) for looks 1, 3, 4 and 5; PixiJS 8 (WebGL2) for look 2; `--gl=angle`
- [x] Determinism: seeded `mulberry32` at module level, no `Math.random`, `Date.now`, R3F clock or state-driven visuals, no TAA or accumulation
- [x] Half-float targets, ±1/255 blue-noise dither, ~1% grain from (pixel, frame) faded below 3% luminance
- [x] OFL fonts only (Inter, JetBrains Mono) with licences; Natural Earth 1:110m land with public-domain note
- [x] No logos, brands or real tickers (invented list in `src/data/tickers.ts`)
- [x] One data row per version (`src/versions.ts`)
- [x] 720p previews (1280×720 H.264 yuv420p CRF 16) and frame-300 PNG stills
- [x] Render times measured; two 4K frames timed; 4K estimates
