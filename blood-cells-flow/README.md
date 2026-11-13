# Blood Cells Flow

Red blood cells drifting through a blood vessel, seen by a camera travelling
down the lumen towards a glowing far end. Fully procedural: no image, video or
model assets – every frame is generated in the browser with **Three.js on
WebGL 2 (custom GLSL shaders)** inside a **Remotion** composition.

| Composition     | Size      | FPS | Frames | Duration | What it is |
| --------------- | --------- | --- | ------ | -------- | ---------- |
| `BloodCells-V1` | 3840x2160 | 30  | 301    | 10.033 s | Matches the reference: crimson tissue, salmon glow |
| `BloodCells-V2` | 3840x2160 | 30  | 301    | 10.033 s | Alternative colour palette: cold "venous" indigo / cyan / violet |

Both compositions are 4K masters. The 1080p deliverables are rendered from the
same 4K compositions with `--scale=0.5`.

## Requirements

- Node.js 20.19+ / 22.13+ (tested with 22)
- No GPU required. On Linux the config selects Chrome's software WebGL
  (`swangle`); on macOS / Windows it uses the GPU through ANGLE.

## Commands

```console
npm install              # install dependencies

npm run dev              # open Remotion Studio (preview / scrub)

npm run render:v1        # out/Version 1 - Blood Cells Flow (1080p).mp4
npm run render:v2        # out/Version 2 - Blood Cells Flow (1080p).mp4
npm run render           # both 1080p files

npm run render:v1:4k     # native 3840x2160 render of version 1
npm run render:v2:4k     # native 3840x2160 render of version 2
npm run still:4k         # one native 4K frame (quick sanity check)
```

The npm scripts are thin wrappers around the Remotion CLI:

```console
npx remotion render BloodCells-V1 "out/Version 1 - Blood Cells Flow (1080p).mp4" --scale=0.5
npx remotion render BloodCells-V2 "out/Version 2 - Blood Cells Flow (1080p).mp4" --scale=0.5
npx remotion render BloodCells-V1 "out/Version 1 - Blood Cells Flow (4K).mp4"
```

Output is H.264 / yuv420p / BT.709 MP4 at exactly 30 fps (set in
`remotion.config.ts`). There is no audio track (the reference has none).

### Render time

Every frame is a multi-pass HDR WebGL draw. With a GPU a frame takes a
fraction of a second. With the software rasteriser (`swangle`, no GPU) expect
roughly 4 s per 1080p frame and 15–20 s per 4K frame on 4 CPU cores.

### Options

| Environment variable           | Purpose |
| ------------------------------ | ------- |
| `REMOTION_GL`                  | Force the Chrome GL backend: `angle`, `swangle`, `egl`, `vulkan` |
| `REMOTION_BROWSER_EXECUTABLE`  | Use an existing Chrome Headless Shell instead of the one Remotion downloads |

## Project layout

```
src/
  index.ts              Remotion entry point
  Root.tsx              registers BloodCells-V1 / BloodCells-V2 (3840x2160, 30 fps, 301 frames)
  BloodCells.tsx        composition component (picks the palette)
  engine/
    ThreeStage.tsx      hosts a raw Three.js renderer, redraws synchronously per frame
    post.ts             HDR chain: MSAA scene -> bokeh depth of field -> bloom -> grade -> grain
    math.ts             seeded RNG and small helpers (everything is deterministic)
  blood/
    BloodScene.ts       vessel, cells, lights and camera rig
    path.ts             curved vessel centre line (rotation-minimising frames)
    shaders.ts          GLSL: baked tissue map, vessel wall, red blood cells
    palettes.ts         the two colour palettes (V1 crimson, V2 venous)
    refTrack.ts         measured screen position of the vessel's far end, per frame
```

## How it works

- **Vessel** – a tube swept along a gently bending path. Its tissue look comes
  from a tileable height map (domain-warped folds + fibrous ridges) that is
  baked once on the GPU and used for bump lighting and colour.
- **Cells** – about 250 instanced biconcave discs (Evans–Fung profile) placed
  by rejection sampling so none of them touch. They drift towards the lens as
  one plug and tumble individually; they recycle far away in the glow, so
  nothing pops in view and nothing ever interpenetrates.
- **Camera** – rides the centre line; its aim follows the measured trajectory
  of the glowing far end of the vessel in the reference clip.
- **Look** – everything is rendered in linear HDR, then gets depth of field,
  bloom, a filmic tone curve, vignette and a touch of grain.
- Every value is a pure function of the frame number, so renders are
  reproducible and frames can be rendered in any order / in parallel.

## License note

Remotion is free for individuals and small teams; some companies need a
license – see <https://github.com/remotion-dev/remotion/blob/main/LICENSE.md>.
