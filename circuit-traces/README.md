# Circuit Traces

Two looping motion graphics of a dark PCB with signal pulses running along its
routed copper. Both compositions are **3840x2160, 30fps, 480 frames (16s)** and
loop seamlessly — frame 480 is pixel-identical to frame 0.

| Composition id    | Look                                                          |
| ----------------- | ------------------------------------------------------------- |
| `V1-CircuitNeon`  | Multicolour neon: green at the left, through cyan, to magenta and violet at the right. |
| `V2-CircuitAmber` | Amber and gold on near-black, single-family palette.           |

## Setup

```console
npm install
npx remotion studio
```

## Render at 4K

```console
npx remotion render V1-CircuitNeon out/V1_CircuitNeon.mp4 --scale=1 --crf=16
npx remotion render V2-CircuitAmber out/V2_CircuitAmber.mp4 --scale=1 --crf=16
```

For a 1080p preview instead, swap in `--scale=0.5`. Stills:

```console
npx remotion still V1-CircuitNeon out/V1_CircuitNeon.png --frame=300 --scale=1
npx remotion still V2-CircuitAmber out/V2_CircuitAmber.png --frame=200 --scale=1
```

`remotion.config.ts` already sets PNG intermediate frames, `yuv420p` and CRF 16 —
the near-black background bands badly through a JPEG intermediate, so the
encoder should be the only lossy step.

## How it works

Everything is drawn to a single 2D canvas in `useLayoutEffect`, keyed on
`useCurrentFrame()`. There is no state between frames and no `Math.random()` at
render time: Remotion renders frames out of order across threads, so every value
is a pure function of `(seed, frame)`.

- `src/circuit/board.ts` — generates the board **once** at module scope from a
  seeded PRNG. Traces are routed from component pins on a 20px grid using
  Manhattan plus 45-degree steps only, with a strong bias toward continuing
  straight and a coarse occupancy grid for collision. Adjacent pins are routed in
  bundles that share a PRNG stream, so they turn together and read as parallel
  buses. Each trace is stored as a polyline with cumulative arc length, so a
  pulse position is a lookup along that length.
- `src/circuit/color.ts` — hue as a function of horizontal position,
  interpolated in HSL and quantised into 48 buckets so draws batch by colour.
- `src/circuit/render.ts` — the unlit board is rasterised once per resolution
  into an offscreen canvas and blitted at the camera offset each frame. Only the
  pulses and the components they light are redrawn.
- `src/circuit/CircuitBoard.tsx` — per-frame composition: base board, additive
  pulse layer, two downsampled and blurred bloom passes, vignette, grain.

Every dimension is a fraction of the frame, taken from `useVideoConfig()`, so a
1080p preview and a 4K render are the same picture at two resolutions.

### The loop

Each pulse completes a whole number of traversals of its path over the 480
frames, so no re-seeding is needed at the boundary. The camera drift is two
harmonics of the loop frequency, and the grain cycles on periods of 16 and 15
frames (240 frames, which divides 480).
