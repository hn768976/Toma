# Isometric Data Centre Build

Server racks assembling row by row in a true isometric projection, with cable
runs, status LEDs and a slow reveal of a complete facility. Two versions:

| Composition id | Look |
| --- | --- |
| `DataCentreDark` | **V1** — near-black floor, cool blue-white rack panels, cyan and green status LEDs. The conventional data-centre look. |
| `DataCentreLight` | **V2** — white floor, light grey racks, soft shadows, muted accent LEDs. Reads as an explainer diagram rather than a photo-real facility. |

Both are **3840×2160, 30 fps, 600 frames (20 s)**. The clip builds and holds —
it is not a loop.

## Quick start

```console
npm install
npx remotion studio
```

## Rendering

Compositions are authored at 4K. Every world-space measurement is resolution
independent and the orthographic frustum is derived from `useVideoConfig()`,
so `--scale` changes the pixel count without changing the framing.

**4K, final quality:**

```console
npx remotion render DataCentreDark  out/V1_DataCentreDark.mp4  --scale=1 --crf=16
npx remotion render DataCentreLight out/V2_DataCentreLight.mp4 --scale=1 --crf=16
```

**1080p preview** (half scale):

```console
npx remotion render DataCentreDark  out/V1_DataCentreDark.mp4  --scale=0.5 --crf=18
npx remotion render DataCentreLight out/V2_DataCentreLight.mp4 --scale=0.5 --crf=18
```

**Stills** (frame 520 is fully built and holding):

```console
npx remotion still DataCentreDark  out/V1_DataCentreDark.png  --frame=520 --scale=0.5
npx remotion still DataCentreLight out/V2_DataCentreLight.png --frame=520 --scale=0.5
```

### Chromium GL flag

Headless Chromium needs the ANGLE backend for WebGL. `remotion.config.ts`
already sets it:

```ts
Config.setChromiumOpenGlRenderer("angle");
```

If you drive the render from the Node.js APIs (where the config file does not
apply) or from another CLI, pass it explicitly:

```console
npx remotion render DataCentreDark out/V1.mp4 --scale=1 --crf=16 --gl=angle
```

Without it the canvas comes back blank, or falls back to a much slower
software path.

### Measured render time

Measured on the machine this project was built on: a 4 vCPU Linux container
with **no GPU**, so headless Chromium's ANGLE backend falls through to
SwiftShader and every frame is rasterised in software. `--concurrency=4`.

| Composition | Output | Frames | Wall clock | Per frame |
| --- | --- | --- | --- | --- |
| `DataCentreDark` | 1920×1080 (`--scale=0.5`) | 600 | 25 min 55 s | **2.59 s** |
| `DataCentreLight` | 1920×1080 (`--scale=0.5`) | 600 | 25 min 36 s | **2.56 s** |

Those figures include bundling and H.264 encoding, and they are a worst case:
software rasterisation dominates them. The scene itself is deliberately cheap
— roughly 60 draw calls, no post-processing stack, no depth of field, one
2048² shadow map — so on a machine with a real GPU expect a large drop. 4K
(`--scale=1`) is four times the pixels; on this software path budget roughly
four times the wall clock.

## How it is built

**True isometric, not "3D pulled far back".** An `OrthographicCamera` looking
down the `(1, 1, 1)` diagonal — 45° of azimuth, 35.264° of elevation. Parallel
edges stay parallel, which is the entire aesthetic; any perspective
convergence breaks it immediately. `camera.manual` keeps react-three-fiber
from recomputing the frustum from the pixel size, and the frustum comes from
`useVideoConfig()`, so 1080p and 4K frame identically.

Orthographic projection also makes this one of the cheaper 3D builds: no
depth-of-field pass, far simpler lighting, and no perspective falloff to
fight. There is deliberately **no depth of field in either version** —
isometric implies an infinitely distant viewer, so DOF looks wrong.

**Everything is a cuboid or a swept tube.** No models, no assets, nothing to
license. Racks, unit divisions, LEDs, floor tiles and trays are
`InstancedMesh`es with per-instance scale and colour, so the whole facility —
several thousand elements — renders in roughly a dozen draw calls. Cables are
`TubeGeometry` along piecewise-quadratic sag curves.

**Every frame is a pure function of `useCurrentFrame()`.** No `useFrame`
clock, no delta accumulation: Remotion renders frames out of order across
threads, so anything stateful would tear. Layout variation — rack counts and
heights, which racks are left open, LED placement, blink schedules, cable sag
— comes from a seeded mulberry32 PRNG, so the facility is identical on every
render.

**Cable sag.** Each run is built once with its final sag and both endpoints at
local `y = 0`, so "settling into the sag" is a `scale.y` animation on the
parent group and the support points never move. The sweep-in is a draw-range
animation along the tube, which costs nothing per frame.

**Bloom and grain.** V1 puts a modest additive halo on the LEDs only — they
should read as pinpricks, not glows — drawn as camera-aligned quads rather
than a post-processing pass, which keeps the render cheap and deterministic.
Grain is a small pre-generated noise tile scrolled per frame; the vignette is
V1 only. V2 has no bloom and no vignette: soft shadow maps, contact shadows
under every rack and a broad aisle occlusion pass do the work instead.

## Layout of the source

```
src/
  index.ts                    registerRoot
  Root.tsx                    the two compositions
  data-centre/
    constants.ts              dimensions, camera, and the build timeline
    theme.ts                  the V1 / V2 palettes
    random.ts                 seeded mulberry32
    anim.ts                   easing and window helpers
    layout.ts                 seeded facility generation
    textures.ts               procedural glow / vent / grain textures
    Instanced.tsx             InstancedMesh wrapper
    CameraRig.tsx             orthographic isometric camera and drift
    Lighting.tsx              hemisphere fill, key, bounce
    Floor.tsx                 tile grid and vents
    Racks.tsx                 chassis, panels, unit lines, LEDs, shadows
    Trays.tsx                 cable trays and supports
    Cables.tsx                bundles, drops, data pulses
    Ceiling.tsx               light strips
    Props.tsx                 floor unit, wall panel, cable spool
    Scene.tsx                 the assembled facility
    Overlays.tsx              vignette and grain
    DataCentre.tsx            composition component
```

## Build sequence

| Frames | Beat |
| --- | --- |
| 0–40 | Empty floor grid, fading up tile by tile in a wave from the front. |
| 30–180 | Racks rise from zero height, staggered row by row and along each row, front rows first, with a slight `easeOutBack` overshoot. |
| 150–280 | Unit divisions draw in, then LEDs light in staggered bursts per rack. |
| 250–380 | Cable trays extend along the row tops, then the bundles sweep in and settle into their sag. |
| 350–450 | Vertical drops connect; ceiling strips fade on. |
| 420–600 | Hold. LEDs keep blinking, the camera keeps drifting, data pulses travel the bundles. |

No text, no rack labels, no brand marks, no real vendor hardware shapes.
