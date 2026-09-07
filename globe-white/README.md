# Dotted Globe Network on White

A pale translucent globe on white: continents built from fine dot rows, a
triangulated network of nodes and chords wrapping the surface, rotating slowly.
Seamless 20-second loop, authored at 4K.

Two versions, same geometry:

| Composition id       | Delivered as              | Network colour            |
| -------------------- | ------------------------- | ------------------------- |
| `V1-GlobeWhiteMono`  | `V1_GlobeWhiteMono.mp4`   | grey (reference match)    |
| `V2-GlobeWhiteBlue`  | `V2_GlobeWhiteBlue.mp4`   | corporate blue `#1f6feb`  |

In V2 only the network carries colour. The sphere and the continent dots stay
grey in both.

## Install and preview

```console
npm install
npx remotion studio
```

## Rendering

Both compositions are defined at **3840x2160, 30fps, 600 frames**. Render at 4K
with:

```console
npx remotion render V1-GlobeWhiteMono out/V1_GlobeWhiteMono.mp4 --scale=1 --crf=16
npx remotion render V2-GlobeWhiteBlue out/V2_GlobeWhiteBlue.mp4 --scale=1 --crf=16
```

For the 1920x1080 preview, add `--scale=0.5`. Every size in the project is
authored as a fraction of frame height, so the preview is a true scale model of
the 4K master rather than a differently-proportioned render.

Stills (pick a frame with a recognisable landmass facing the camera):

```console
npx remotion still V1-GlobeWhiteMono out/V1_GlobeWhiteMono.png --frame=583 --scale=0.5
```

### Chromium GL flag

This is a WebGL composition, so headless Chromium needs an OpenGL renderer
selected. `remotion.config.ts` already sets `angle`; on the command line it is
`--gl=angle`. On a machine with no GPU, `--gl=swiftshader` renders on the CPU -
same output, slower.

### Measured render time

Rendered on this build machine (CPU only, no GPU, ANGLE falling back to a
software rasteriser), at 1920x1080 via `--scale=0.5`:

- **~245 ms per frame**, **~2 min 25 s** wall-clock for the full 600-frame clip
  including encode (V1 146 s, V2 148 s).

That is end-to-end throughput on a 4-core CPU-only machine at Remotion's chosen
concurrency of 2, not single-thread cost. More cores, or a real GPU, cut it
sharply.

A 4K render is roughly four times the pixels; budget accordingly, and expect a
large speed-up on any machine with a real GPU.

### Encoding

High-contrast dark detail on a flat white field is the H.264 failure mode here -
mosquito noise around the globe rather than banding. `--crf=16` with
`yuv420p` is the configured default. If the white around the globe ever looks
dirty, raise the bitrate before touching anything else.

## Map data

Continents come from **Natural Earth 1:110m "land"**, which is in the **public
domain** and requires no attribution. The polygons are rasterised offline by
`tools/bake-mask.py` into a bit-packed 720x360 equirectangular mask that is
committed as base64 inside `src/globe/landmask.ts`. Nothing is fetched at render
time and no third-party or licensed basemap is embedded anywhere in the project.

To re-bake at a different resolution:

```console
curl -O https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
python3 tools/bake-mask.py ne_110m_land.geojson
```

## How it is built

`src/globe/`

- `landmask.ts` - the baked mask plus an `isLand(lon, lat)` sampler.
- `geometry.ts` - all buffers, built **once at module level**: continent dots,
  node placement, the chord mesh, the travellers. Nothing here reads the frame.
- `ContinentDots` / `NetworkNodes` / `Travellers` - single `THREE.Points` draws
  with custom shaders. Never one object per dot.
- `Chords` - one merged indexed `BufferGeometry` of screen-space ribbons.
- `Shell` - the translucent glass sphere.

### Depth

Everything is drawn twice from one buffer: a far pass before the shell and a
near pass after it, with the crossover exactly on the perspective silhouette
(`dot(normal, toCamera) == 0`) and a smooth ramp across it. The far side is
never removed - hiding it flattens the globe - and never drawn at full strength,
which would bury the front in noise. It lands at roughly a third of near-side
strength in the finished frame.

Because the shell attenuates the far pass a second time, `farFactor` is divided
by the shell's transmission before it reaches the shaders, so the prop means the
fraction that actually survives into the frame.

### Antialiasing

Thousands of small dark dots and hairline chords on white will crawl between
frames if you leave them to MSAA. Every dot and every chord instead computes its
own analytic one-pixel coverage ramp, centred on the true edge, with the sprite
or quad padded a pixel so the ramp is never clipped. This is resolution
independent: sub-pixel dots near the limb fade out smoothly instead of
flickering, at any render scale.

### Looping

The globe turns exactly 360 degrees over 600 frames at constant speed. Node
pulses run a whole number of cycles per loop, travellers complete whole trips,
and the grain seed cycles every 30 frames - 600 is a multiple of all of them.
Every animated value is a pure function of `useCurrentFrame()`; there is no
`useFrame` clock and no accumulated delta, because Remotion renders frames out
of order across threads.

## Notes on the brief

Three places where the implementation makes a deliberate choice worth knowing
about:

- **Globe size.** The brief asks for "roughly 80% of frame height" and, in the
  same sentence, for the sphere to be "larger than the frame's vertical extent"
  with the poles "cropped very slightly". Those cannot both hold: at 80% nothing
  is cropped. The default `globeDiameter` is **1.08** frame heights, which
  satisfies the second reading literally. The reference clip measures **1.40**,
  which crops considerably more - set the prop to `1.4` to match it exactly.
- **Chord geometry.** The brief asks for the chord buffer to be rebuilt per
  frame. It is built once instead: the nodes are fixed to the sphere and the
  whole globe spins as a single group, so the vertex data is genuinely
  frame-invariant. The depth-dependent fade that a rebuild would have supplied
  is computed in the shader, which is both cheaper and exact.
- **Continent dot pitch.** Rows sit on a 1 degree grid, matching the reference.
  Columns sit on **1.25 degrees**, not 1. The globe turns 0.6 degrees per frame,
  so a 1 degree column pitch puts the dot lattice exactly three pitches on every
  five frames and continent interiors visibly strobe at 6 Hz. At 1.25 the
  lattice only realigns every 25 frames, by which point the coastlines have
  moved 15 degrees and nothing reads as a repeat.

## Props

Both compositions take the same schema; edit them live in the studio sidebar.

| Prop             | Default | Notes                                                     |
| ---------------- | ------- | --------------------------------------------------------- |
| `variant`        | `mono`  | `mono` or `blue` - selects the palette.                    |
| `globeDiameter`  | `1.08`  | Silhouette diameter in frame heights. Above 1 crops poles. |
| `tiltDeg`        | `-15`   | Axial tilt, so it is not a perfect vertical spin.          |
| `dotSizePx`      | `5`     | Continent dot diameter at the sub-camera point, px at 4K.  |
| `nodeSizePx`     | `11`    | Node diameter, px at 4K.                                   |
| `chordWidthPx`   | `2`     | Chord weight, px at 4K.                                    |
| `farFactor`      | `0.34`  | Far-side strength in the finished frame.                   |
| `shellOpacity`   | `0.55`  | Glass opacity. Colours are pre-compensated to stay exact.  |
| `grainOpacity`   | `0.025` | Fine grain. Set to 0 for a perfectly clean white.          |
| `showTravellers` | `true`  | The few dots running along chords.                         |

No text, no country labels, no watermark, no logo, no camera movement, no glow.
