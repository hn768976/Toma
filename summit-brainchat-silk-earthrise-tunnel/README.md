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

## Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] three.js on WebGL2 via `@remotion/three`; `--gl=angle`
- [x] one data row per version (`src/versions.ts`)
- [x] deterministic: frame-only, seeded `mulberry32`, no `Math.random()`/clock/TAA
- [x] half-float render targets, ±1/255 dither, 1.5 % frame-hashed grain (3A fades <3 %)
- [x] 720p previews + 720p stills of all 8, verified (steps 1-6)
- [x] reference comparisons (steps 7-8)
- [x] measured 720p times, two timed 4K frames, 4K estimates
- [x] NASA Blue Marble / Black Marble textures with credit
- [x] `npm install && npx remotion studio` checked from a clean copy

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

## Measured render times

Measured in a cloud container with **no GPU**: headless Chromium, ANGLE falling
back to **SwiftShader** (software WebGL2), 4 CPU cores, one Chromium tab
(extra tabs don't help; SwiftShader already uses every core). On a machine with
a real GPU expect these to drop by roughly an order of magnitude.

**720p** (`--scale=1/3`, full 600-frame render ÷ 600, including PNG capture):

| Composition | s / frame @720p | 600 frames |
|---|---|---|
| SummitPath-Blue | 0.62 | 6.2 min |
| SummitPath-GoldDawn | 0.63 | 6.3 min |
| AIBrainChat-NeonBlue | 1.70 | 17.0 min |
| BlackSilk-Black | 1.63 | 16.3 min |
| BlackSilk-Champagne | 1.64 | 16.4 min |
| EarthGridRise-Blue | 0.83 | 8.3 min |
| LightTunnel-White | 1.45 | 14.5 min |
| LightTunnel-Graphite | 1.43 | 14.3 min |

**Two real 4K frames** (`remotion still --frame=300 --scale=1`, 3840×2160; wall
time minus the ~4-5 s browser/bundle start-up measured with a 720p still of
the same frame):

| Composition | 4K still wall | ≈ s / 4K frame | 4K ÷ 720p |
|---|---|---|---|
| AIBrainChat-NeonBlue | 22.4 s | **17.7 s** | 10.4× |
| BlackSilk-Black | 15.9 s | **12.3 s** | 7.5× |

**4K estimates** (same software renderer; 720p time × the measured 7.5-10.4×
ratio, ~9× for the untimed ones):

| Composition | ≈ s / 4K frame | ≈ 600 frames |
|---|---|---|
| SummitPath-Blue / GoldDawn | 5.6 | ~56 min each |
| AIBrainChat-NeonBlue | 17.7 (measured) | ~3.0 h |
| BlackSilk-Black / Champagne | 12.3 (measured) | ~2.0 h each |
| EarthGridRise-Blue | 7.5 | ~75 min |
| LightTunnel-White / Graphite | 13 | ~2.2 h each |

All eight at 4K on this kind of CPU-only box: roughly 15 h. With a GPU, far
less. Use `--concurrency` only on a GPU machine.


## Verification (run on the delivered 720p previews)

Scripts: `scripts/verify/verify-one.sh` (steps 1-6 per composition),
`scripts/verify/loop-determinism.sh`, `scripts/verify/banding.py`.

**Step 1 — files.** All 8: h264, 1280×720, `yuv420p`, 30/1, 20.000 s, no audio
stream (ffprobe).

**Step 2 — loop.** With `--props='{"durationOverride":601}'`, frame 600 and frame
0 are identical PNGs for all 8. Because that check is trivially satisfied by
`frame % 600`, the seam itself was also measured: the mean pixel change
599→0 equals an ordinary step 299→300 for every composition (e.g. Silk Black
1.65 vs 1.67, Brain 3.56 vs 3.50, Tunnel White 2.82 vs 2.83) — no jump.

**Step 3 — determinism.** Frame 300 rendered alone from a cold start is
**byte-identical** to frame 300 of the full render, for all 8.

**Step 4 — banding** (frame 300 decoded from the *encoded mp4*). Lines across the
navy halo (Summit), dark board/sky (Brain), black valleys (Silk 3A), sky
(Earth), white gradients/end glow (Tunnel) change in sub-level steps
(max smoothed step 0.2-0.8 code values). Where the line had to cross a real
edge (a fold crest, a ceiling rib, the end-light panel) the script flags a
step; those were inspected as 6-10× contrast-stretched crops instead and show
smooth dithered gradients with no contours. Grain is 1.5 %, from a pixel hash
of (x, y, frame % 600); in 3A it fades to zero below 3 % luminance.

**Step 5 — content** (contact sheets in `renders/verify/contact/`). Summit:
faceted crystal mountain, beaded glowing path with climbing pulses, plain
waving flag, halo. Brain: glass brain + cerebellum on a chip, neon traces with
pulses, glass cubes/blocks, three-dot bubbles rising. Silk: full-frame satin,
slow diagonal folds. Earth: night horizon, city lights, geodesic grid, orange
arcs, pulsing rings, cyan rim. Tunnel: forward glide through angled slats,
strips, bright end. No text, no logos, the flag is plain.

**Step 6 — motion** (2 s around frame 300, `renders/verify/motion/`). No
shimmer/moiré on facet edges, grid lines or slats (all lines are analytic
screen-space AA; MSAA ×4 on geometry); cloth moves without boiling; bubble pop
is an eased overshoot; arcs and pulses move smoothly.

**Steps 7-8.** Reference comparisons done; three rounds of fresh-agent comparison
per look (plus three Black Silk realism checks). See the delivery report.

## Deliberate deviations from the brief

- **Earth grid density.** "Detail 3" (3 subdivisions = 1280 faces = three.js
  `detail 7`) was too coarse next to the reference at this framing; the grid
  uses three.js `detail 11` (2880 faces).
- **Bubble lifetime.** 4 bubbles per loop as specified, but each lives ~9 s
  (not ~5 s) so two are on screen at once, as in the reference stack.
- **Black Silk weave.** Band-limited (fades out below ~5 px per cycle) to avoid
  moiré; at 720p it is subtle, at 4K it reads clearly.
- **Black Silk grade.** Highlight colour is `#8A8A90` as specified, with a slight
  neutralising tint in the final grade (reviewers read it as blue-violet).
- **Traces** are right-angled as specified (the reference uses 45° jogs).


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
