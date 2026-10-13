# Code Towers · Fibre World Map · Glass City Drive · Wireframe Street · AI Server Row

One Remotion project, five 3D looks, seven compositions. All scenes are three.js on
**WebGL2** through `@remotion/three` (no WebGPU, no PixiJS). Everything is generated in code:
procedural cities, generated pseudo-code, Natural Earth outlines, and procedural racks.

| Composition id | Output file | Frames | Loop |
|---|---|---|---|
| `CodeTowers-Cyan` | `CodeTowers_Cyan.mp4` | 600 (20 s) | yes |
| `FibreWorldMap-Story` | `FibreWorldMap_Story.mp4` | 360 (12 s) | no (story) |
| `FibreWorldMap-HoldLoop` | `FibreWorldMap_HoldLoop.mp4` | 600 (20 s) | yes |
| `GlassCityDrive-Blue` | `GlassCityDrive_Blue.mp4` | 600 | yes |
| `WireframeStreet-BlueCyan` | `WireframeStreet_BlueCyan.mp4` | 600 | yes |
| `WireframeStreet-VioletPink` | `WireframeStreet_VioletPink.mp4` | 600 | yes |
| `AIServerRow-Teal` | `AIServerRow_Teal.mp4` | 600 | yes |

All compositions are 3840×2160, 30 fps.

## Setup

```bash
npm install
npx remotion studio          # preview (the Studio renders at reduced resolution)
```

Node 18+ is required (developed on Node 22). Package versions are pinned in `package.json` and
`package-lock.json`.

### Chromium GL flag

Headless Chromium needs ANGLE for WebGL2. `remotion.config.ts` sets it:

```ts
Config.setChromiumOpenGlRenderer("angle");   // CLI equivalent: --gl=angle
```

On a machine with a GPU, ANGLE uses it. Without a GPU (CI, containers), ANGLE falls back to
SwiftShader, which is slower but gives the same images.

## 4K render commands

```bash
npx remotion render CodeTowers-Cyan            out/CodeTowers_Cyan.mp4            --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render FibreWorldMap-Story        out/FibreWorldMap_Story.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render FibreWorldMap-HoldLoop     out/FibreWorldMap_HoldLoop.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render GlassCityDrive-Blue        out/GlassCityDrive_Blue.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render WireframeStreet-BlueCyan   out/WireframeStreet_BlueCyan.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render WireframeStreet-VioletPink out/WireframeStreet_VioletPink.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render AIServerRow-Teal           out/AIServerRow_Teal.mp4           --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

For a mastering-grade file, use `--codec=prores --prores-profile=4444` instead.

## 6K stills (6000×3375)

The compositions are 3840 wide, so a 6000×3375 still is `--scale=1.5625`:

```bash
npx remotion still CodeTowers-Cyan out/CodeTowers_Cyan_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Change the composition id and frame as needed: use frame 330 for `FibreWorldMap-Story`, at the hold.

## 720p previews

`scripts/render-previews.sh` renders a PNG sequence at `--scale=0.3333333333333333`
(1280×720 exactly), then encodes H.264 / yuv420p / CRF 16 / 30 fps with no audio. The
PNG frames are kept for the determinism and banding checks.

## Adding a colourway or changing a city seed

Every version is **one row** in `src/versions.ts`. For example, here is a third Wireframe Street
colourway:

```ts
{
  id: "WireframeStreet-Emerald",
  file: "WireframeStreet_Emerald",
  component: WireframeStreet,
  frames: 600,
  loop: true,
  props: { citySeed: 4141, body: "#06301E", line: "#2AE88A", glow: "#B8FF5A", skyTop: "#04221A" },
},
```

- **New city:** change `citySeed` (Looks 3 and 4) or `seed` (Looks 1, 2 and 5).
  - The layouts are generated once at module level with `mulberry32(seed)`.
  - Every city stays periodic, so the loop still closes.
- **Story vs loop:** only `FibreWorldMap` has a story mode, set with `mode: "story" | "hold"`.

## How it is built

- **`src/lib/Stage.tsx`**
  - `<ThreeCanvas>`, with the drawing buffer at exactly the output size (the device pixel
    ratio is Remotion's `--scale`).
  - Post chain:
    - MSAA ×4, HalfFloat
    - optional depth of field
    - **own mip-chain bloom** (`src/lib/bloom.ts`)
    - final pass: tone curve, then ±1/255 triangular dither and ~1.5 % grain.
  - Grain and dither come from a fixed hash of pixel position and `frame % period`.
- **`src/kit/city.ts` and `src/kit/buildings.ts`:** the shared building kit for Looks 3 and 4.
  - Rectangles, L-shapes, podium setbacks, stepped crowns and spires.
  - Periodic along the street.
  - Instanced boxes, with edges, floor lines, mullions and lit windows drawn analytically in
    the shader, so they stay anti-aliased and never thinner than about 1.5 px.
- **`src/kit/code.ts`:** generated pseudo-code (six variants in one atlas) from neutral
  made-up words. No real code and no real library names.
- **`src/kit/worldmap.ts`:** Natural Earth 1:110m land.
  - Miller projection, with Antarctica and tiny islands dropped.
  - Outlines get Chaikin smoothing and are drawn as 4 parallel fibre strands.
  - Delaunay fill (d3-delaunay) inside each continent.
- **Looks:** `src/looks/*.tsx`.

### Determinism

- Every animated value is a function of `useCurrentFrame()`, and loops use `frame % period`.
- There is no `Math.random()` at render time, no clock, no `useState`/`useFrame` driving
  visuals, and no TAA or accumulation.
- `useFrame` is used only as the "render now" hook that `ThreeCanvas` calls once per frame. Its
  clock is never read.
- Fonts load once behind `delayRender`. The canvas mounts only after they are ready.
- Pass `--props='{"loopCheck":true}'` to make a composition one frame longer, so frame 600 can
  be rendered and compared with frame 0.

## Licences

See `NOTICE-data.md`:
- Natural Earth data: public domain.
- JetBrains Mono and Inter: SIL OFL 1.1. The licence texts are in `public/fonts/`.

No logos, brands, real skylines or real code are used.
