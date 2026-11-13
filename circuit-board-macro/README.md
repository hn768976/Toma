# Circuit Board Macro

A 10-second macro shot of a circuit board: a large QFP chip in sharp focus, connector
blocks, capacitors and SMD parts falling off into a very shallow depth of field, a
slow truck-right camera move, drifting dust specks and film grain.

Everything is procedural (no external assets): the board is modelled in code with
**Three.js (WebGL 2)** and rendered frame-by-frame by **Remotion**. Lighting uses a
generated HDR environment plus two shadow-casting lights, and a custom post chain
(bokeh depth of field, bloom, grade, vignette, grain).

## Compositions

Both are **3840 x 2160 (4K UHD), 30 fps, 300 frames = 10.000 s**.

| Composition ID                    | What it is                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `CircuitBoard-V1-Reference-4K`    | Version 1 - monochrome, matches the reference clip as closely as possible.       |
| `CircuitBoard-V2-ColorPalette-4K` | Version 2 - same scene and camera, midnight-teal board with gold metal, warm key light and cool fill. |

## Requirements

- Node.js 20.19+ / 22.13+ (tested with Node 22)
- No GPU required: `remotion.config.ts` selects the software WebGL renderer
  (`swangle`). On a machine with a GPU you can change it to `angle` for faster renders.

## Install

```bash
npm install
```

## Preview

```bash
npm run dev
```

## Render

The compositions are 4K masters. `--scale=0.5` renders the same composition natively
at 1920 x 1080 (all effects are resolution independent).

```bash
# 1080p deliverables (H.264 MP4, 30 fps) -> out/
npm run render:v1
npm run render:v2

# full 4K renders -> out/
npm run render:v1:4k
npm run render:v2:4k
```

Equivalent raw commands:

```bash
npx remotion render CircuitBoard-V1-Reference-4K out/v1-1080p.mp4 --scale=0.5 --muted
npx remotion render CircuitBoard-V2-ColorPalette-4K out/v2-1080p.mp4 --scale=0.5 --muted
npx remotion render CircuitBoard-V1-Reference-4K out/v1-4k.mp4 --muted
```

Codec (H.264), pixel format (yuv420p), CRF and the GL renderer are set in
`remotion.config.ts`. The clips have no audio (`--muted`).

Optional flags:

- `--concurrency=2` – number of parallel browser tabs (each one builds its own scene).
- `--browser-executable=/path/to/chrome-headless-shell` – only needed on offline
  machines where Remotion cannot download its own headless browser.

## Project layout

```
src/
  index.ts            Remotion entry point
  Root.tsx            registers the two 4K compositions
  CircuitBoard.tsx    shot description: camera move, lights, dust, post settings
  scene/
    palette.ts        materials / lights / grade for V1 (mono) and V2 (colour)
    board.ts          procedural board layout (chip, pins, blocks, parts, traces)
    builder.ts        geometry helpers (bevelled boxes, ribbons, merging)
  engine/
    Stage.tsx         frame-driven Three.js canvas for Remotion
    post.ts           depth of field, bloom, grade, grain; deterministic RNG
remotion.config.ts    codec / renderer settings
```

Every frame is a pure function of the frame number (seeded RNG, no `Math.random()`),
so renders are deterministic and can be parallelised.
