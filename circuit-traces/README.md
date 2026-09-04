# Circuit Traces

Two seamless 16-second loops of a dark PCB with signal pulses running along
procedurally routed traces. Built with [Remotion](https://remotion.dev).

| Composition id     | Look                                                        |
| ------------------ | ----------------------------------------------------------- |
| `V1-CircuitNeon`   | Multicolour neon — green at the left, through cyan and blue, to magenta and violet at the right |
| `V2-CircuitAmber`  | Amber/gold on near-black, single-family palette              |

Both compositions are **3840×2160, 30 fps, 480 frames (16 s)** and loop
seamlessly: every pulse completes a whole number of traversals of its path over
the 480 frames, and the camera drift is a single sine cycle.

## Setup

```bash
npm install
npx remotion studio
```

## Render at 4K

```bash
npx remotion render V1-CircuitNeon  out/V1_CircuitNeon.mp4  --scale=1 --crf=16
npx remotion render V2-CircuitAmber out/V2_CircuitAmber.mp4 --scale=1 --crf=16
```

Stills:

```bash
npx remotion still V1-CircuitNeon  out/V1_CircuitNeon.png  --frame=204 --scale=1
npx remotion still V2-CircuitAmber out/V2_CircuitAmber.png --frame=204 --scale=1
```

For a 1080p preview, add `--scale=0.5` instead of `--scale=1`. Every size in the
project is expressed as a fraction of the frame width, so a 1080p preview and a
4K render are the same picture at different sample rates.

## How it works

Everything is drawn to a single `<canvas>` in a `useLayoutEffect` keyed on
`useCurrentFrame()`. There is no `Math.random()` at render time and no state
carried between frames — Remotion renders frames out of order across threads,
so each frame is a pure function of its frame number.

| File                        | Role                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| `src/circuit/rng.ts`        | Seeded PRNG (mulberry32) and small math helpers                        |
| `src/circuit/geometry.ts`   | Trace routing and component layout, generated once at module scope     |
| `src/circuit/palette.ts`    | Hue ramps and the colour lookup tables draws are batched against       |
| `src/circuit/pulses.ts`     | The pulse schedule — which trace, how fast, what phase                 |
| `src/circuit/draw.ts`       | Per-frame canvas rendering: base board, bloom, pulses, vignette, grain |
| `src/circuit/grain.ts`      | Pre-baked grain tiles, cycled deterministically by frame number        |
| `src/circuit/CircuitBoard.tsx` | The Remotion component                                              |

**Routing.** Traces are walked over a lattice in Manhattan and 45° steps only,
biased hard toward continuing straight, with a coarse occupancy grid preventing
collisions. Routing runs in three passes — long backbone runs across an empty
board, then fan-out from package pins, then fill — so the early routes get the
long clear paths. Each route can spawn parallel siblings that replay its exact
turn sequence one cell to the side, which is what produces the bus bundles.

**Pulses.** Each pulse is a head plus a long fading tail sampled back along the
trace polyline; the sample points are merged with the trace's own vertices so
the tail turns exactly where the routing turns. Pulses light nearby vias and
pads as they pass.

**Performance.** The unlit board is drawn once per (palette, pixel size) into an
offscreen canvas and blitted with the camera offset each frame. Bloom is
rendered at quarter resolution, blurred small and upscaled, so the trace cores
stay crisp. Trace strokes are batched into 48 quantised hue buckets rather than
setting a style per segment.

## Tuning

- Trace density: the pass sizes and `PITCH` in `src/circuit/geometry.ts`
- Palette: `V1_NEON` / `V2_AMBER` in `src/circuit/palette.ts`
- Number of pulses: `PULSES` in `src/circuit/CircuitBoard.tsx`
- Board seed: `BOARD = buildBoard(...)` in `src/circuit/CircuitBoard.tsx`
