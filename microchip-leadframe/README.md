# Microchip Lead Frame

A macro shot of silicon dies sitting on a stamped metal lead-frame strip:
long lens, very shallow depth of field, a soft light gliding over brushed
metal. Fully procedural: no image, video or model assets – every frame is
generated in the browser with **Three.js on WebGL 2 (custom GLSL shaders)**
inside a **Remotion** composition.

| Composition     | Size      | FPS | Frames | Duration | What it is |
| --------------- | --------- | --- | ------ | -------- | ---------- |
| `Microchips-V1` | 3840x2160 | 30  | 361    | 12.033 s | Matches the reference: slow rising orbit around the centre die, foreground wipe near the end |
| `Microchips-V2` | 3840x2160 | 30  | 361    | 12.033 s | Alternative camera: starts almost top-down, cranes down and glides sideways into a low hero angle, orbiting the other way |

The reference clip is 12.04 s at 25 fps (301 frames). At the required 30 fps
the closest whole-frame length is 361 frames = 12.033 s (7 ms shorter; 362
frames would be 27 ms longer).

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

npm run render:v1        # out/Version 1 - Microchip Lead Frame (1080p).mp4
npm run render:v2        # out/Version 2 - Microchip Lead Frame (1080p).mp4
npm run render           # both 1080p files

npm run render:v1:4k     # native 3840x2160 render of version 1
npm run render:v2:4k     # native 3840x2160 render of version 2
npm run still:4k         # one native 4K frame (quick sanity check)
```

The npm scripts are thin wrappers around the Remotion CLI:

```console
npx remotion render Microchips-V1 "out/Version 1 - Microchip Lead Frame (1080p).mp4" --scale=0.5
npx remotion render Microchips-V2 "out/Version 2 - Microchip Lead Frame (1080p).mp4" --scale=0.5
npx remotion render Microchips-V1 "out/Version 1 - Microchip Lead Frame (4K).mp4"
```

Output is H.264 / yuv420p / BT.709 MP4 at exactly 30 fps (set in
`remotion.config.ts`). There is no audio track (the reference has none).

### Render time

Every frame is a multi-pass HDR WebGL draw. With a GPU a frame takes a
fraction of a second. With the software rasteriser (`swangle`, no GPU) expect
roughly 4–5 s per 1080p frame and 15–20 s per 4K frame on 4 CPU cores.

### Options

| Environment variable           | Purpose |
| ------------------------------ | ------- |
| `REMOTION_GL`                  | Force the Chrome GL backend: `angle`, `swangle`, `egl`, `vulkan` |
| `REMOTION_BROWSER_EXECUTABLE`  | Use an existing Chrome Headless Shell instead of the one Remotion downloads |

## Project layout

```
src/
  index.ts              Remotion entry point
  Root.tsx              registers Microchips-V1 / Microchips-V2 (3840x2160, 30 fps, 361 frames)
  Microchips.tsx        composition component (picks the camera look)
  engine/
    ThreeStage.tsx      hosts a raw Three.js renderer, redraws synchronously per frame
    post.ts             HDR chain: MSAA scene -> bokeh depth of field -> bloom -> grade -> grain
    keyframes.ts        smooth keyframe tracks
    math.ts             seeded RNG and small helpers (everything is deterministic)
  chips/
    ChipScene.ts        scene assembly, materials, lighting timeline, camera rig
    leadframe.ts        the stamped lead-frame unit (real openings, extruded) + small parts
    environment.ts      procedural studio environment baked to an HDR cube map
    dieTexture.ts       die floor plan and brushed-metal textures (drawn on a canvas)
    looks.ts            per-version settings: camera tracks, light path, wipe (V1 reference orbit, V2 crane-down)
```

## How it works

- **Lead frame** – one 10x10 unit (die paddle, 4x21 lead fingers, dam bar,
  tie bars, rail slots and rounded pilot slots) is built as a 2D outline with
  real holes, extruded, and instanced on a 7x7 grid. Dies, bond pads, tie-bar ribs
  and rail dimples are instanced on top.
- **Materials** – a lean metal shader (blurred environment reflection + one
  analytic GGX highlight from a travelling light) and a thin-film shader for
  the dies whose violet → blue → cyan → green ramp slides across the die with
  the viewing direction.
- **Camera** – long lens (8–9°), keyframed orbit / elevation / framing.
  Version 1 uses values measured from the reference by tracking the
  perspective of the centre die, three light sweeps timed like the reference
  and a foreground wipe (out-of-focus glass panes plus a short focus drift)
  at 8.6–10 s. Version 2 keeps scene, materials and grade and changes only
  the camera move and the light path.
- **Look** – linear HDR, bokeh depth of field focused on the hero die, bloom,
  filmic tone curve, a grade that drifts from cool blue to neutral steel,
  vignette and a touch of grain.
- Every value is a pure function of the frame number, so renders are
  reproducible and frames can be rendered in any order / in parallel.

## License note

Remotion is free for individuals and small teams; some companies need a
license – see <https://github.com/remotion-dev/remotion/blob/main/LICENSE.md>.
