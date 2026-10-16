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
  MSAA colour pass → blur pyramid → depth of field (mip gather) + bloom → filmic
  curve → ±1/255 TPDF dither + 1.5 % grain → crisp HUD-tag overlay. No TAA, no
  accumulation, no shadows.
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

<!-- MEASUREMENTS -->
