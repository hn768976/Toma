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

## Measured render times (this build machine)

Measured in a cloud container with **no GPU**: 4 vCPU, Chromium headless with `--gl=angle`
falling back to SwiftShader (software). Renders used `--concurrency=2`.

Per-frame times for full renders at 720p (`--scale=1/3`):

| Composition | Frames | Wall time | s / frame (720p) |
|---|---|---|---|
| CodeTowers-Cyan | 600 | 958 s | 1.60 |
| FibreWorldMap-Story | 360 | 315 s | 0.87 |
| FibreWorldMap-HoldLoop | 600 | 423 s | 0.71 |
| GlassCityDrive-Blue | 600 | 754 s | 1.26 |
| WireframeStreet-BlueCyan | 600 | 417 s | 0.70 |
| WireframeStreet-VioletPink | 600 | 430 s | 0.72 |
| AIServerRow-Teal | 600 | 568 s | 0.95 |

Two real 4K frames, each a cold `remotion still` of frame 300 at `--scale=1`, 3840×2160:

| Composition | 4K still wall time | 720p still, same method | 4K frame excl. ≈5 s startup |
|---|---|---|---|
| CodeTowers-Cyan | 35.2 s | 6.9 s | ≈ 30 s |
| GlassCityDrive-Blue | 31.9 s | 6.0 s | ≈ 26 s |

A 4K frame costs about 19–21× a 720p frame here (9× the pixels, plus bloom/DoF chains and
4×MSAA at full size).

**4K estimates, same CPU-only machine:** 720p s/frame × ≈20 × frames:

| Composition | Estimate |
|---|---|
| CodeTowers | ≈ 5.3 h |
| GlassCityDrive | ≈ 4.2 h |
| AIServerRow | ≈ 3.2 h |
| FibreWorldMap-HoldLoop | ≈ 2.4 h |
| each WireframeStreet | ≈ 2.3 h |
| FibreWorldMap-Story | ≈ 1.7 h |
| **all seven** | **≈ 21 h** |

On a machine with a real GPU behind ANGLE, expect these to drop by roughly an order of
magnitude. That is an estimate; it was not measured here. Splitting work across machines with
`--frames=a-b` is safe because every frame is independent.

## Verification (run on the 720p previews)

| Check | Result |
|---|---|
| 1. ffprobe | All 7: 1280×720, 30/1, h264, yuv420p, no audio. Durations 20.0 s (12.0 s for the Story). |
| 2. Loop | The 6 loops rendered at 601 frames (`loopCheck`): frame 600 is pixel-identical to frame 0. Seams were also checked for continuity: the 599→0 change is the same size as the other frame steps. |
| 3. Determinism | Frame 300 (180 for the Story), rendered alone from a cold start, is **byte-identical** to the same frame of the full render, for all 7. It is also identical across concurrency 1, 2 and 4. |
| 4. Banding | Frames read from the encoded mp4s, with profiles through the horizon hazes, dark skies, black map background and AI-row background. Steps are at most about 2 code values per pixel along steep gradients, with no plateaus. Map black stays at 1–4/255. Details: `out/checks/banding.txt`. |
| 5. Content | A contact sheet per composition (5 evenly spaced frames). Each shows the expected scene. No logos; the code is generated; "AI" is spelled correctly. |
| 6. Motion | 2 s around frame 300 (75–270 for the Story). Frame-to-frame fine-detail energy changes by ≤2.6% on the loops, so there is no crawl or moiré. The Story's largest change is the smooth peak of the eased pull-back (frames 151–156), not a pop. |

### Banding measures

- Dither: ±1/255 triangular, applied in display space in the final pass.
- Grain: about 1.5%. It comes from a hash of pixel position and `frame % period`.
- Map (Look 2): grain and dither fade to zero below about 3% luminance.

## Completion checklist

- [x] 7 compositions, one data row each, 3840×2160 at 30 fps (600 frames; Story 360)
- [x] three.js on WebGL2 via `@remotion/three`, `--gl=angle`
- [x] Deterministic: no `Math.random` at render time, no clock, no state carried between frames
- [x] Fonts and atlases loaded once behind `delayRender`
- [x] Loops close exactly; cold frames are byte-identical
- [x] OFL fonts with licence texts; Natural Earth with a public-domain note
- [x] README with render, still and GL commands, timings, checks and how to add a colourway

## Licences

See `NOTICE-data.md`:
- Natural Earth data: public domain.
- JetBrains Mono and Inter: SIL OFL 1.1. The licence texts are in `public/fonts/`.

No logos, brands, real skylines or real code are used.
