# golden-hourglass

A macro view of an hourglass: gold glitter sand drains through the neck in a fine stream, the level
in the upper bulb sinks and finally runs out, while star glints twinkle on the glass.
Built with Remotion + three.js (WebGL 2). The reference is live-action footage; this is a CG rebuild.

| Composition | What it is |
|---|---|
| `V1-golden-hourglass` | Matches the reference: a locked-off macro shot with a barely perceptible drift |
| `V2-golden-hourglass` | Same scene, **one change: the camera movement** (slow push-in on an arc) |
| `LookDev` | 3 stills (frames 0, 1, 2 = start / peak / late) used for look development |

All compositions are **3840x2160, 30 fps, 509 frames (16.967 s)**. Nothing loops.
The reference is 1.90:1; the 16:9 frame keeps its full width and shows slightly more above and below.

## Install

```bash
npm ci
```

## Render

4K masters (the compositions' native size):

```bash
npx remotion render V1-golden-hourglass out/03-V1-golden-hourglass-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-golden-hourglass out/04-V2-golden-hourglass-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
```

One 4K frame (quick test):

```bash
npx remotion still V1-golden-hourglass out/v1-4k.png --frame=270 --scale=1 --gl=angle
npx remotion still V2-golden-hourglass out/v2-4k.png --frame=270 --scale=1 --gl=angle
```

1080p (how the delivered MP4s were made):

```bash
npx remotion render V1-golden-hourglass out/03-V1-golden-hourglass.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-golden-hourglass out/04-V2-golden-hourglass.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
```

The WebGL drawing buffer follows `--scale`, so 1080p renders shade 1920x1080 pixels and 4K renders
shade 3840x2160.

`remotion.config.ts` uses a locally installed Chrome Headless Shell if one exists at
`/opt/pw-browsers/chromium_headless_shell`; on any other machine Remotion downloads its own.

## What Version 2 changes, and why

Only the **camera movement** (`CAMERA_V2` in `src/config.ts`): instead of the (almost) locked-off shot, the
camera starts low and wide, then pushes in while arcing about 60 degrees around the glass and rising
to look down into the upper bulb.
The reference camera is essentially static, so movement is the clearest single change available, and it
shows off what a real 3D scene gives you: the highlights slide across the glass, the glints flare
and the crater in the sand opens up as the view rises. Palette, geometry, timing and every look
setting are identical to Version 1.

## Where to change things

| What | Where |
|---|---|
| Colours | `src/config.ts` -> `PALETTE` |
| Counts (grains on the glass, mesh detail) | `src/config.ts` -> `COUNTS` |
| Timings (when the sand runs out, stream tail) | `src/config.ts` -> `TIMING` |
| Glass shape, sand level and slope, stream width | `src/config.ts` -> `SHAPE` |
| Star glints (position, size) | `src/config.ts` -> `GLINTS` |
| Camera paths | `src/config.ts` -> `CAMERA_V1`, `CAMERA_V2`, `CAMERA_FOV` |
| Duration / fps / resolution | `src/config.ts` -> `DURATION_FRAMES`, `FPS`, `WIDTH`, `HEIGHT` |
| Light, glass highlights, glint and sparkle levels, backdrop glow | `src/look.ts` -> `LOOK` |
| Bloom, grade (matte black level), grain, softness | `src/look.ts` -> `POST` |

## How it is built

- `src/lib/ThreeStage.tsx`: a plain WebGL 2 canvas driven only by `useCurrentFrame()`. No
  `requestAnimationFrame`, `useFrame`, clocks or state; each frame is drawn synchronously behind
  `delayRender()`. three.js is used directly rather than through React Three Fiber so that nothing
  but the frame number can drive the picture.
- `src/lib/post.ts`: half-float MSAA scene target -> bloom mip chain -> ACES tone map, grade,
  fixed film grain (hash of pixel + frame), +-1/255 dither.
- `src/scene/profile.ts`: the glass profile and the sand level. Sand leaves at a constant rate, so
  the level follows a cube-root curve and drops faster and faster, as it does in a real cone.
- `src/scene/createScene.ts`, `src/scene/shaders.ts`: lathe meshes for glass and sand, the stream,
  grains on the glass, star glints and the per-frame update. No physics is simulated live and no
  textures, fonts or models are loaded: everything is procedural and seeded with `mulberry32`.

## Look development and measurement

```bash
python3 scripts/measure-look.py frame.png                           # numbers for one frame
python3 scripts/measure-look.py --crop-aspect 1.8987 ref.png ours.png   # comparison on the reference's framing
scripts/lookdev.sh <reference.mp4>                                  # renders LookDev, writes lookdev/compare-*.png
python3 scripts/scan-frames.py out/03-V1-golden-hourglass.mp4       # black / frozen / flicker scan
```

(`measure-look.py` needs Python 3 with numpy and Pillow. The reference clip is not included.)

## Render time

Measured on a 4-core cloud machine with **no GPU** (ANGLE on software rendering). A machine with a GPU will be much faster.

| | Time |
|---|---|
| 1080p (`--scale=0.5`) | about 1.9 s per frame measured (509 frames in 965 s, while another render shared the machine; expect about 1.1-1.2 s alone) |
| 4K (`--scale=1`) | about 4.1 s per frame measured on an 8-frame 4K test (single thread), so roughly 35 minutes for the 509 frames |
