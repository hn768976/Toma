# Data Tunnel Flythrough

Two 4K, 30fps, 15-second seamlessly-looping compositions: a camera flying
forward down a rectangular tunnel of dots and dashes, everything radiating
from an off-centre vanishing point, with heavy depth of field.

| Composition ID       | Version                          |
| -------------------- | -------------------------------- |
| `V1-DataTunnelBlue`  | Deep blue (matches the reference) |
| `V2-DataTunnelMono`  | Neutral monochrome                |

Both are 3840x2160, 30fps, 450 frames. Identical geometry and motion; only
the palette differs.

## Setup

```console
npm install
npx remotion studio
```

## Rendering at 4K

```console
npx remotion render V1-DataTunnelBlue out/V1_DataTunnelBlue.mp4 --scale=1 --crf=16
npx remotion render V2-DataTunnelMono out/V2_DataTunnelMono.mp4 --scale=1 --crf=16
```

For a 1080p preview, add `--scale=0.5`. The composition size does not change;
`--scale` sets the browser's device pixel ratio, and every layer's backing
store, point size and blur radius is derived from it, so the preview is a
true downscale of the 4K frame rather than a differently-tuned render.

### Chromium GL flag

Headless Chromium needs a GL backend for the WebGL layers.
`remotion.config.ts` already sets `angle`, which is what these numbers were
measured with:

```ts
Config.setChromiumOpenGlRenderer("angle");
```

Override per render with `--gl=angle`. On a machine with no GPU at all,
`--gl=swiftshader` also works but is substantially slower. `--gl=egl` is the
fastest option on a box with a real GPU.

On its first render Remotion downloads its own Chrome Headless Shell, which
needs network access to `remotion.media`. On a machine where that is blocked,
point it at a Chromium you already have instead:

```console
npx remotion render V1-DataTunnelBlue out/V1.mp4 --scale=1 --crf=16 \
  --browser-executable=/path/to/chrome-headless-shell
```

### Measured render time

Measured on a 4-core x86-64 container with **no GPU** (`--gl=angle`, which
falls back to ANGLE's software backend there), PNG frames, H.264 `--crf=16`:

| Output              | Per frame | 450 frames |
| ------------------- | --------- | ---------- |
| 1080p (`--scale=0.5`) | **1.6 s** | **12-13 min** (measured end to end) |
| 4K (`--scale=1`)      | **7.6 s** | **~58 min** (projected) |

The per-frame figures are marginal cost, taken by differencing a 32-frame run
against a 16-frame one so bundling and browser warm-up cancel out. The 1080p
total is wall-clock for a real full render; the 4K total is that marginal rate
extrapolated.

The 4K pass is the one that needs planning. On a machine with a real GPU
(`--gl=egl`) expect this to drop by roughly an order of magnitude; the cost
here is almost entirely software rasterisation of seven WebGL layers plus
the CSS blur compositing.

To trade time for machines, render in ranges and concatenate:

```console
npx remotion render V1-DataTunnelBlue out/part0.mp4 --scale=1 --crf=16 --frames=0-149
```

## How it is built

Real 3D via `@remotion/three` / react-three-fiber. The points live in a
genuine 3D volume and the camera translates through it, so near elements
sweep outward past the frame edges while distant ones barely move.

- **`constants.ts`** - all timing, geometry, depth-of-field and camera
  numbers. Sizes and blur radii are authored against a 1080-pixel-tall
  reference frame and scaled by `useVideoConfig().height`, so 1080p and 4K
  stay in sync.
- **`volume.ts`** - the 70,000-element volume, generated **once** at module
  scope from a seeded PRNG. Nested rectangular shells on a loose grid (with
  +/-15% jitter) plus a sparser interior scatter. Recycling is an offset
  computed in the shader, never a regeneration.
- **`shaders.ts`** - two instanced renderers. Dots are `THREE.Points`;
  dashes are screen-space capsules built from both projected endpoints, so
  they radiate from the vanishing point and foreshorten correctly. Their
  projected length is capped - a fixed world length explodes into a
  frame-crossing streak near the camera and the shot stops reading as a data
  field. Both write premultiplied alpha and blend `ONE`/`ONE`.
- **`TunnelLayer.tsx`** - one `<ThreeCanvas>` per depth bucket.
- **`DataTunnel.tsx`** - background, glow, the layer stack, vignette, grain.

### Filling the frame

`WALL_SHELLS` defines the volume as nested rectangular shells. The two inner
ones are the walls of the corridor. Beyond them sits a gap, then a mantle of
three progressively coarser and dimmer shells reaching out to four times the
tunnel's own half-width.

Both parts earn their place. Without the mantle, a ray toward the frame
corner leaves the box about nine units out and meets nothing beyond, so the
field ends on a visible rectangular boundary with dark margins around it.
Without the gap - and without the mantle falling away steeply in both
density and brightness - there is no step at the wall plane and the corridor
flattens into a plain radial burst.

Measured on an encoded frame: the outer 6% bands of the picture sit at
62-71% of the centre's mean level, against 35-49% before the mantle existed.

### Depth of field

Six depth buckets, each rendered to its own WebGL layer with its own blur
radius and composited additively with `mix-blend-mode: plus-lighter`. A
single global blur would flatten the volume.

Elements cross-fade between neighbouring buckets over a feather band, using
complementary ramps, so an element dissolves from one blur radius into the
next at constant total brightness instead of popping.

Each bucket's canvas also carries a `renderScale`: a layer about to be
blurred by 30px holds no detail worth rasterising at full resolution. That
is most of what makes the 4K pass affordable.

### Looping

The camera travels exactly `Z_TOTAL` over 450 frames and positions wrap
`mod Z_TOTAL`, so every element recycles exactly once per loop and frame 450
is frame 0. Elements fade in at the far plane and out as they pass the
camera, which hides the seam. The drift sines have period 450; the shimmer
periods (90 / 150 / 225 frames) all divide 450.

Camera position, element offsets and grain offset are pure functions of
`useCurrentFrame()`. There is no `useFrame` clock and no delta
accumulation - Remotion renders frames out of order across threads.

### Grain

The grain is a 256x256 seeded-noise tile composited with `plus-lighter` at
2%. It is dither: without it the dark background ramp posterises into
visible bands in H.264. That is only apparent in the **encoded file**, not
in the studio preview.

### A note on the V2 palette

The brief's monochrome values (`#050506`, `#0d0e10`, `#3a3d42`, `#9aa0a8`)
carry a slight cool cast, which conflicts with "no hue anywhere". `palette.ts`
uses those same values collapsed to their exact luminance
(`#050505`, `#121212`, `#3d3d3d`, `#9f9f9f`), so the brightness ramp is
preserved and the encoded output is measurably neutral. Change them in
`PALETTES.mono` if you want the cool cast back.

## Tuning

Almost everything worth changing is in `constants.ts`:

| Want | Change |
| ---- | ------ |
| Faster / slower travel | `Z_TOTAL` (distance covered per loop) |
| Longer loop | `DURATION_IN_FRAMES` - keep the shimmer periods dividing it |
| More / fewer elements | `NZ`, `WALL_SPACING_X/Y`, `WALL_SHELLS`, `FILL_SETS` |
| Wider / narrower tunnel | `X_HALF`, `Y_HALF` |
| Move the focus band | `BUCKET_EDGES` / `BUCKET_BLUR` |
| Vanishing point position | `VP_OFFSET_X`, `VP_OFFSET_Y` |
| Frame coverage / mantle reach | `WALL_SHELLS` offsets and brightness |
| Dash length and weight | `DASH_FRACTION`, `DASH_MAX_LEN_PX` |

Colours are in `palette.ts`.
