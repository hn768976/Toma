# Network Growth · Hologram People · Timeline HUD · AI Hub · Gear World

One Remotion project, 8 compositions, 30 fps, 16:9, defined at **3840×2160**.
Everything is drawn in code: no logos, no stock footage, no images.

| Composition ID | Output file | Engine | Frames | Notes |
|---|---|---|---|---|
| `NetworkGrowth-White` | `NetworkGrowth_White.mp4` | Canvas 2D | 600 (20 s) | story |
| `NetworkGrowth-Navy` | `NetworkGrowth_Navy.mp4` | Canvas 2D | 600 (20 s) | story |
| `HoloPeople-Amber` | `HoloPeople_Amber.mp4` | three.js / WebGL2 | 600 (20 s) | seamless loop |
| `HoloPeople-Cyan` | `HoloPeople_Cyan.mp4` | three.js / WebGL2 | 600 (20 s) | seamless loop |
| `TimelineHUD-White` | `TimelineHUD_White.mp4` | Canvas 2D | 300 (10 s) | story, pure black, for Screen/Add |
| `AIHub-TealOrange` | `AIHub_TealOrange.mp4` | Canvas 2D | 360 (12 s) | story |
| `AIHub-BlueViolet` | `AIHub_BlueViolet.mp4` | Canvas 2D | 360 (12 s) | story |
| `GearWorld-Blue` | `GearWorld_Blue.mp4` | Canvas 2D | 600 (20 s) | seamless loop |

> Remotion only allows `a-z A-Z 0-9 -` in composition IDs, so the IDs use a
> hyphen (`NetworkGrowth-White`). The output files keep the underscore names.

## Setup

```bash
npm install          # Node 18+; all versions are pinned in package.json / package-lock.json
npx remotion studio  # preview in the browser
```

### Chromium GL flag

Hologram People uses WebGL2. Headless Chromium needs ANGLE:

```
--gl=angle
```

`remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer("angle")`, so the
CLI picks it up automatically. Add `--gl=angle` yourself if you render through the
Node APIs (they ignore the config file). Don't use `swiftshader`/`swangle` for 4K
renders: they work but are much slower.

## 4K render commands

H.264, `yuv420p`, CRF 16, PNG intermediate frames (set in `remotion.config.ts`):

```bash
npx remotion render src/index.ts NetworkGrowth-White out/NetworkGrowth_White.mp4 --gl=angle
npx remotion render src/index.ts NetworkGrowth-Navy  out/NetworkGrowth_Navy.mp4  --gl=angle
npx remotion render src/index.ts HoloPeople-Amber    out/HoloPeople_Amber.mp4    --gl=angle
npx remotion render src/index.ts HoloPeople-Cyan     out/HoloPeople_Cyan.mp4     --gl=angle
npx remotion render src/index.ts TimelineHUD-White   out/TimelineHUD_White.mp4   --gl=angle
npx remotion render src/index.ts AIHub-TealOrange    out/AIHub_TealOrange.mp4    --gl=angle
npx remotion render src/index.ts AIHub-BlueViolet    out/AIHub_BlueViolet.mp4    --gl=angle
npx remotion render src/index.ts GearWorld-Blue      out/GearWorld_Blue.mp4      --gl=angle
```

ProRes 4444 for the timeline overlay, if preferred:
`npx remotion render src/index.ts TimelineHUD-White out/TimelineHUD_White.mov --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --gl=angle`

### 6K still (6000×3375)

```bash
npx remotion still src/index.ts NetworkGrowth-White out/NetworkGrowth_White_6K.png --frame=540 --scale=1.5625 --gl=angle
```

(Any composition ID and frame works; `--scale=1.5625` turns 3840×2160 into 6000×3375.)

### 720p previews

```bash
./scripts/render-previews.sh   # all 8, 1280x720 (--scale=1/3), plus a PNG still each
```

## Timeline HUD: blend mode and labels

`TimelineHUD-White` is drawn on **exactly black (0,0,0)** with **no grain or dither**,
so it can be laid over footage with **Screen** or **Add** (Linear Dodge) and the
black disappears completely.

Edit the labels in **one data row**: `src/looks/timeline/versions.ts`

```ts
steps: [
  { num: "01", title: "Step Title", sub: "Lorem ipsum dolor sit" },
  ... // six entries: number, title, sub-line
]
```

The line colour is `ink` in the same row.

## Adding a colourway (one data row)

Every look reads its colours from a `versions.ts` file, and `src/Root.tsx`
registers one composition per row. To add a colourway, append a row:

```ts
// src/looks/network/versions.ts
{ id: "NetworkGrowth-Green", background: "#05140C", badges: ["#2AD07A", "#1A9A5A", "#9AE8C0"],
  line: "#5AA080", dashed: "#4A8A6A", pictogram: "#FFFFFF", counter: "#9AE8C0", grain: 0.015 },
```

The same works for `holo/versions.ts` (figure, plexusAlt, hud, bokeh),
`aihub/versions.ts` (primary, secondary, background, grain),
`gears/versions.ts` and `timeline/versions.ts`. IDs may only use letters,
digits and `-`. Use `grain: 0` on pure black backgrounds so black stays black.

## How it is built

- **Canvas 2D looks** (Network, Timeline, AI Hub, Gear World) draw in a 1280×720
  logical space that `CanvasStage` scales to the real pixel buffer (4K for a full
  render, 1280×720 at `--scale=1/3`, 6000×3375 for the big still), so they are
  resolution-independent.
- **Hologram People** is `@remotion/three` (React Three Fiber) on WebGL2 with a
  small hand-written post pipeline (`src/looks/holo/pipeline.ts`): depth pre-pass →
  MSAA colour pass (back rows, floor, bokeh) + a separate MSAA pass for the front
  row (so the depth-of-field blur never smears it into a halo) → blur pyramid
  built from a 720p-equivalent base → depth of field (mip gather) + bloom →
  filmic curve → crisp MSAA HUD-tag layer → ±1/255 TPDF dither + 1.5 % grain.
  No TAA, no accumulation, no shadows. Blur radii, line widths (three.js
  `LineSegments2`) and point sizes all scale with the output height, so a 4K
  render looks like the 720p preview, only sharper.
  The figures are stylised, featureless mannequins (smooth lathe/capsule
  pieces, no face or anatomy).
- **Gear World**: involute spur-gear outlines (20° pressure angle), each train
  shares one module, so meshing gears have exact centre distances. Phases are
  solved so a tooth always meets a gap, and neighbours turn in opposite
  directions at speeds inversely proportional to their tooth counts. Every gear
  advances a whole number of teeth per loop, so the loop is exact. The gauge
  gear has 40 teeth.
- **World map**: Natural Earth 1:110m land (public domain), turned into a 1°
  dot grid by `scripts/build-map-dots.mjs` (`data/natural-earth/`).
- **Icons** (person, satellite, cloud, atom, server, robot arm, chart, folder,
  brain) are generic pictograms drawn with canvas paths in `src/lib/icons.ts`.

### Determinism

Every value on screen is a function of `useCurrentFrame()` only:

- `mulberry32` is seeded at module level; the network graph, circuit routing and
  gear layout are generated once.
- There's no `Math.random()`, `Date.now()`, `useFrame` clock or state carried
  between frames. R3F's `useFrame` is used only as the render hook; it reads the
  Remotion frame from a ref.
- Grain and dither are a hash of pixel position and frame number.
- Loops use `frame % 600` everywhere (including grain), so frame 600 equals frame 0.
- Fonts are loaded once, behind `delayRender` / `continueRender`.

Loop check: `--props='{"loopCheck":true}'` makes the loop compositions 601 frames
long, so frames 0 and 600 can be rendered and compared.

## Fonts and data licences

- **Inter** (SIL OFL 1.1): `public/fonts/OFL-Inter.txt`
- **JetBrains Mono** (SIL OFL 1.1): `public/fonts/OFL-JetBrainsMono.txt`
- **Natural Earth**: public domain, `data/natural-earth/README.md`

## Measured render times

Machine: 4 vCPU cloud container, **no GPU** (WebGL runs on ANGLE's software
path), Chromium headless shell 1194, Remotion 4.0.515.

Per-frame time is single-threaded (`--concurrency=1`), measured as
(time for 80 frames − time for 20 frames) / 60, which cancels browser and
bundle start-up (`scripts/measure-timing.sh`).

| Composition | 720p s/frame | 4K s/frame | 4K full render, 1 thread | 4K, `--concurrency=4` (est.) |
|---|---|---|---|---|
| NetworkGrowth-White | 0.109 | **0.67 (timed)** | ≈ 6.7 min | ≈ 2.5 min |
| NetworkGrowth-Navy | 0.157 | ≈ 0.96 | ≈ 9.6 min | ≈ 3.5 min |
| HoloPeople-Amber | 3.51 | **9.95 (timed)** | ≈ 100 min | ≈ 40 min |
| HoloPeople-Cyan | 3.38 | ≈ 9.6 | ≈ 96 min | ≈ 38 min |
| TimelineHUD-White | 0.090 | ≈ 0.55 | ≈ 2.7 min | ≈ 1 min |
| AIHub-TealOrange | 0.128 | ≈ 0.78 | ≈ 4.7 min | ≈ 2 min |
| AIHub-BlueViolet | 0.184 | ≈ 1.12 | ≈ 6.7 min | ≈ 2.5 min |
| GearWorld-Blue | 0.333 | ≈ 2.0 | ≈ 20 min | ≈ 7.5 min |

- The two **timed 4K frames** are frame 300 of `NetworkGrowth-White` (0.67 s)
  and frame 300 of `HoloPeople-Amber` (9.95 s), measured the same way (3 frames −
  1 frame, /2).
- Canvas 4K estimates use the measured 4K/720p ratio of NetworkGrowth (×6.1).
  The concurrency column assumes about 2.7× from 4 threads (measured on the 720p
  previews).
- The hologram is GPU-bound. On a machine with a real GPU and `--gl=angle`
  it is many times faster than these software-GL numbers. Most of its cost
  here is the wide-line wireframes.

## Verification (run on the 720p previews)

1. **ffprobe:** all 8 are 1280×720, h264, yuv420p, 30/1, video only, and exactly
   20.0 / 10.0 / 12.0 s (600 / 300 / 360 frames).
2. **Loop check** (`--props='{"loopCheck":true}'`, frames 0 and 600): HoloPeople-Amber,
   HoloPeople-Cyan and GearWorld-Blue are byte-identical PNGs.
3. **Determinism** (`scripts/verify/determinism.sh`): the middle frame from a full
   4-thread PNG-sequence render matches a cold-start `remotion still` of that frame
   **byte for byte** for all 8 compositions.
4. **Banding / black level** (frames taken from the encoded mp4s,
   `scripts/verify/banding.py`, `black_level.py`):
   - Gradients (hologram bokeh glow, Gear World haze, flat navy backgrounds)
     change by at most about 1 level per pixel after a 9×9 average. There is no
     staircase; the grain/dither interleaves values (66 distinct raw values across
     the hologram's glow).
   - **Timeline:** 50 sample points away from the artwork all read **0,0,0**, and
     every pixel in the empty rows (614,400 pixels) is 0.
   - **AIHub-TealOrange:** the background stays exactly 0 (no grain on black).
5. **Contact sheets** (`scripts/verify/contact_sheet.py`): checked for every
   composition.
6. **Motion:** stepped through frames. Badges pop with an overshoot, gears hold
   their mesh frame to frame, the hologram flicker is subtle, and thin lines don't
   shimmer.

### Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps, correct lengths
- [x] Canvas 2D for Network, Timeline, AI Hub, Gear World; `@remotion/three` WebGL2 for Hologram
- [x] Seeded `mulberry32` at module level; no `Math.random()` / `Date.now()` / clocks / carried state
- [x] OFL fonts only (Inter, JetBrains Mono), licences included
- [x] No logos or brands; generic code-drawn pictograms; "AI" in capitals
- [x] Featureless mannequin figures
- [x] Natural Earth 1:110m land as a dot grid, public-domain note included
- [x] Exact 600-frame loops (gears advance whole teeth per loop)
- [x] Dither ±1/255 + 1.5 % grain from pixel position and frame; none on the Timeline or the black AI Hub
- [x] Timeline on exactly black, for Screen/Add
- [x] One data row per colourway
- [x] 4K looks the same as 720p (resolution-relative blur, line widths and point sizes)

