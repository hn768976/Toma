# Phone Mockup Packs

Five green-screen phone mockup packs built in code with Remotion and three.js
(WebGL2 via `@remotion/three`). Each pack is one long video made of many short
phone moves cut back to back. Every phone screen is flat, unlit `#00FF00`, so one
key removes all of them. On the green packs the background is the same `#00FF00`,
so the same key removes it too.

| Composition (render ID) | Output file | Background | Frames | Length |
|---|---|---|---|---|
| `PhonePack-White` | `PhonePack_White.mp4` | white studio `#F4F5F7` | 872 | 29.07 s |
| `PhonePack-Black` | `PhonePack_Black.mp4` | black `#000000` | 1815 | 60.50 s |
| `PhonePack-DarkSpin` | `PhonePack_DarkSpin.mp4` | graphite radial `#1A1C20` → `#050506` | 1656 | 55.20 s |
| `PhonePack-TrioGreen` | `PhonePack_TrioGreen.mp4` | green `#00FF00` | 720 | 24.00 s |
| `PhonePack-MixGreen` | `PhonePack_MixGreen.mp4` | green `#00FF00` | 1803 | 60.10 s |

Remotion doesn't allow `_` in composition IDs, so the compositions are
registered with a hyphen (`PhonePack-White`). The output files keep the
underscore names.

All compositions are 3840×2160 at 30 fps.

## Setup

```bash
npm ci            # exact versions from package-lock.json
npm run dev       # Remotion Studio, to preview and scrub
npm run check     # validate data/packs.json
```

Requires Node 18+ and ffmpeg/ffprobe on the PATH for the verification scripts.

## Rendering at 4K

PNG frames are used as the intermediate image format (set in
`remotion.config.ts`). JPEG frames would smear the green before encoding.

```bash
npx remotion render src/index.ts PhonePack-White     out/PhonePack_White.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted --x264-preset=veryslow
npx remotion render src/index.ts PhonePack-Black     out/PhonePack_Black.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted --x264-preset=veryslow
npx remotion render src/index.ts PhonePack-DarkSpin  out/PhonePack_DarkSpin.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted --x264-preset=veryslow
npx remotion render src/index.ts PhonePack-TrioGreen out/PhonePack_TrioGreen.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted --x264-preset=veryslow
npx remotion render src/index.ts PhonePack-MixGreen  out/PhonePack_MixGreen.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted --x264-preset=veryslow
```

Notes:

- `--gl=angle` is required: the scene is three.js on WebGL2 (not WebGPU).
- Add `--concurrency=N` to match your CPU/GPU, and `--timeout=300000` on a
  machine without a GPU. On a machine with a GPU, Chrome
  uses it through ANGLE; without one it falls back to SwiftShader (CPU), which
  is much slower (see Timings).
- For a ProRes master suitable for keying, use
  `--codec=prores --prores-profile=4444` instead of the h264 flags.
- The 720p previews were rendered with `--scale=0.3333333333333333`
  (`scripts/render-previews.sh`).

## How a pack is put together

`data/packs.json` holds everything you would want to re-order or re-time:

```json
{
  "id": "PhonePack_White",
  "reference": "3774395149",
  "background": "white",
  "durationInFrames": 872,
  "segments": [
    { "move": "brickStack", "start": 0,   "length": 195, "phones": 3 },
    { "move": "singlePass", "start": 195, "length": 195, "phones": 1 },
    ...
  ]
}
```

- `move`: the name of a move function in `src/moves/` (see the list below).
- `start` / `length`: in frames. Segments must tile the pack exactly, with no
  gaps or overlaps. The Studio and the renderer refuse to run if they don't.
- `phones`: phone count. The layout moves (`brickWall`, `tiltedGrid`) honour any
  count; the others are designed for the count shown.
- `params`: optional per-segment numbers passed to the move.

Each segment brings its phones in from off-screen, holds for 2–3 s with a gentle
float (±0.5% of frame height, ±1° tilt), then sends them out or holds to the end.
Entrances settle with an ease-out and ~2% overshoot, and exits accelerate out.
Segment boundaries are hard cuts on an empty frame or after a phone has left,
with no fades. Two exceptions are continuous takes: Pack 4 (one trio, match-cut
between its three segments, like its reference) and the `dropIn` → `floatTurn`
pair in Pack 5.

### Re-ordering or re-timing segments

1. Edit `data/packs.json`: move segment objects around, or change `length`.
2. Run `npm run retime`. It recomputes every `start` from the lengths, in order,
   and updates `durationInFrames` to the new total.
3. `npm run check` confirms the pack tiles exactly.

Moves read their timing from the segment length, so a longer segment gives a
longer hold. Entrances and exits keep their speed.

### Switching a pack's background (one data row)

Change the pack's `"background"` to `"white"`, `"black"`, `"graphite"` or
`"green"`. Lighting, the backdrop, camera framing and contact shadows (white
only) follow automatically. Any move works on any background.

### Moves

| Move | What it does |
|---|---|
| `brickStack` / `brickStackReturn` | three phones in a staggered brick stack slide through from the left / settle from the right |
| `singlePass` | phone slides in, stops at centre, turns 15° and back, exits |
| `rise` | phone rises from below, holds, sinks |
| `threeViews` | front, side and back phones in a row, then slide apart |
| `centreHold` | one phone swings to face camera and floats |
| `slideRight` | phone glides to the right third |
| `pairOverlap` / `pairSwap` | second phone slides in behind / the back phone swings to the front |
| `brickWall` | columns of phones slide up through the frame |
| `tiltedGrid` | rows of phones at 35°, scrolling diagonally |
| `lineupFive` | five phones, centre one largest |
| `closeFloat` | one phone close to camera, slowly turning |
| `spinReveal` | front → back (camera strip) → front |
| `tiltIn` | swings in from a steep angle and straightens |
| `diagonalFall` | glides diagonally across the frame, turning |
| `floatingPair` / `pairFloat` | two phones at different depths / drifting, one rotating |
| `fanOfThree` | three phones fan out from one pivot and fold back |
| `closeUpPan` | camera glides close past the top corner and edge |
| `pushIntoScreen` | camera pushes in until `#00FF00` fills the frame (final 30 frames fully green) |
| `trioSpread` / `trioTurn` / `trioClose` | the Pack 4 trio: spread from a stack, turn 30° and back, push in |
| `dropIn` / `floatTurn` | drop in and settle / turn 20° left and right |
| `frontAndBack`, `pairLean`, `closeCrop`, `diagonalPair`, `tumbleLand`, `backReveal` | Pack 5 moves |

## Keying the screens and adding footage

The screens are exactly RGB (0, 255, 0) in the renders. There is no glare,
gradient, shading, dither or bloom on them, and no motion blur or depth of
field anywhere, so the screen edges stay sharp for keying and tracking.

**Key**

- After Effects: Keylight 1.2, Screen Colour = pure green (0,255,0). The default
  settings already give a clean matte. Optionally set Screen Shrink/Grow −0.5
  to tidy the edge.
- Premiere Pro: Ultra Key, Key Colour (0,255,0), Setting: Default.
- DaVinci Resolve: Fusion Delta Keyer, or the 3D Qualifier on the screen colour.
- ffmpeg (quick check):
  `ffmpeg -i PhonePack_Black.mp4 -i myapp.mp4 -filter_complex "[0:v]chromakey=0x00FF00:0.12:0.05[k];[1:v][k]overlay" out.mp4`

On **white, black and graphite** packs only the screens key out. On **green** packs
the key also removes the background, leaving just the phone bodies over
whatever you place underneath. Put your app footage under the screens and a
backdrop under the whole layer.

**Corner pin** (to make your footage follow the phone)

1. Duplicate the pack layer. Use the keyed one on top and your footage beneath.
2. Track the screen: Mocha AE / Mocha Pro planar tracker on the screen area, or
   AE's Track Motion → Perspective Corner Pin on the four screen corners. The
   flat green screen against the black bezel gives a high-contrast edge that
   tracks well.
3. Apply the track to your footage as a Corner Pin. Because the screen has
   rounded corners, let the key define the final shape (the footage only needs
   to cover the screen).
4. For the push-in shots the screen fills the frame for the last 30 frames, so
   your footage becomes full-frame.

Recommended screen footage aspect: 9 : 19.5 (e.g. 1080 × 2340).

## Project layout

```
data/packs.json          segments, timings, phone counts, background per pack
src/Root.tsx             registers one composition per pack
src/PhonePack.tsx        ThreeCanvas + per-frame shot from the active segment
src/moves/*.ts           pure move functions: (frame, length, …) → camera + phones
src/anim.ts              easing (2% overshoot settle), float, travel helpers
src/three/phoneGeometry.ts   the original generic phone, built from primitives
src/three/StudioScene.tsx    backdrop shaders, lights, RoomEnvironment PMREM, contact shadows
src/three/Pipeline.tsx       half-float MSAA target → sRGB + masked ±1/255 dither
scripts/                 data check/retime, preview render, stills, verification
```

### Determinism

Every value comes from `useCurrentFrame()`. Nothing uses `Math.random`,
`Date.now` or `useState` for visuals. There is no TAA, no accumulative shadows
and no shadow maps; the contact shadows are analytic. The environment map is
generated behind `delayRender`. The single R3F `useFrame` in `Pipeline.tsx`
only issues the draw calls for the post pass at priority 1. It reads the frame
number from props and no clock. `scripts/determinism.sh` renders frames cold
(a new process per frame) and warm (after 24 preceding frames in the same tab)
and compares them byte for byte.

### Banding

The scene renders into a half-float, 4× MSAA target in linear light. The final
pass converts to sRGB and adds ±1/255 triangular dither. The dither is masked
out of every `#00FF00` pixel (screens and green backgrounds) and out of pure
black and white, so those stay exact.

## The phone

An original, generic design built from primitives, with no logos or text:
- a rounded 19.5:9 slab with flat sides and a small chamfer;
- a graphite metal frame `#2A2C30` (metalness 0.9, roughness 0.3), with buttons
  on the right edge only;
- a thin even black bezel and a small round centred punch-hole;
- a matte dark glass back `#1E2024`, with a vertical camera strip top-left
  holding two lenses and a flash.

## Timings

Measured in the build environment: 4 vCPU, no GPU, so Chrome's WebGL2 ran on
SwiftShader (CPU) through ANGLE, with `--concurrency=4`. A machine with a GPU
will be much faster.

**720p previews** (`--scale=0.3333333333333333`, wall time including encode):

| Pack | Frames | Render time | Per frame |
|---|---|---|---|
| PhonePack_White | 872 | 309 s | 0.35 s |
| PhonePack_Black | 1815 | 725 s | 0.40 s |
| PhonePack_DarkSpin | 1656 | 576 s | 0.35 s |
| PhonePack_TrioGreen | 720 | 360 s | 0.50 s |
| PhonePack_MixGreen | 1803 | 633 s | 0.35 s |

**4K** (3840×2160). The steady-state figures are the difference between an 8-frame
and a 40-frame sequence render, which removes startup:

| Pack | One cold 4K frame (`remotion still`) | Steady state, 4 tabs | Full pack estimate |
|---|---|---|---|
| PhonePack_Black | ~14 s | ~5.1 s/frame | ~2.6 h |
| PhonePack_DarkSpin | ~9.6 s | ~3.1 s/frame | ~1.4 h |

The other packs scale similarly from their 720p times (about 9–13× the 720p
per-frame cost): White ~0.9 h, TrioGreen ~1 h, MixGreen ~1.8 h. That makes all
five about 7.5 h on a CPU-only 4-core machine.

On CPU-only machines, add `--timeout=300000`. With four software-GL tabs, the
first 4K frame can take longer than Remotion's default 30 s timeout.
