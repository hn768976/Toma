# Radial Circuit Chip

Two seamless 20-second loops of a glowing circuit board whose traces radiate
from a central ring, built with [Remotion](https://remotion.dev).

| Composition id         | Look                          | Output name                |
| ---------------------- | ----------------------------- | -------------------------- |
| `V1-CircuitChipBlue`   | Blue / cyan on deep blue      | `V1_CircuitChipBlue.mp4`   |
| `V2-CircuitChipAmber`  | Amber / gold on near-black    | `V2_CircuitChipAmber.mp4`  |

Both compositions are **3840×2160, 30 fps, 600 frames (20 s)** and loop
seamlessly: frame 600 is byte-identical to frame 0.

## Setup

```bash
npm install
npx remotion studio
```

## Rendering at 4K

Render each composition at full resolution:

```bash
npx remotion render V1-CircuitChipBlue  out/V1_CircuitChipBlue.mp4  --scale=1 --crf=16
npx remotion render V2-CircuitChipAmber out/V2_CircuitChipAmber.mp4 --scale=1 --crf=16
```

(`npm run render:blue` and `npm run render:amber` are the same two commands.)

A 1080p preview is the same command at half scale:

```bash
npx remotion render V1-CircuitChipBlue out/V1_CircuitChipBlue.mp4 --scale=0.5 --crf=18
```

Stills:

```bash
npx remotion still V1-CircuitChipBlue out/V1_CircuitChipBlue.png --frame=150 --scale=1
```

## How it works

- `src/network.ts` generates the whole board **once at module level** from a
  seeded PRNG (`src/rng.ts`). Routes leave the ring and walk outward in
  Manhattan and 45° steps only, biased towards continuing straight and towards
  the compass direction they left on, avoiding each other through a coarse
  occupancy grid. Each route is stored as a polyline with its cumulative arc
  length, so a pulse position is a lookup, never a re-walk.
- Each quadrant is generated **independently with the same rules and density**,
  never mirrored. The result is near-symmetric rather than symmetric — an exact
  mirror reads as a wallpaper tile.
- Everything that moves is a pure function of `useCurrentFrame()`. There is no
  state and no `Math.random()` at render time, because Remotion renders frames
  out of order across threads.
- Every animated quantity uses an integer number of cycles across the 600-frame
  loop (pulse traversals, ring rotation, the counter-rotating inner circle, the
  brightness breathe, the ±1% scale pulse, the grain seed), so the loop closes
  exactly.
- Geometry is authored in a fixed 3840×2160 design space and mapped through the
  SVG `viewBox`, so a `--scale=0.5` preview is an exact half-scale copy of the
  4K render.

## Layout

```
src/
  index.ts        registerRoot
  Root.tsx        the two compositions
  CircuitChip.tsx frame composition, loop clock, overlays
  network.ts      seeded board generator + arc-length lookup
  Board.tsx       static traces, pads, vias, components, labels, dust
  Pulses.tsx      travelling pulses (outward, plus inward returns)
  Ring.tsx        central ring, tick sequencer, counter-rotating dashes
  Defs.tsx        gradients, scan lines, bloom, grain, vignette
  theme.ts        the two palettes
  rng.ts          mulberry32
```

The interior of the ring is deliberately dark and empty — that is where a logo
goes.
