# Plexus Network on White

Drifting network of dark grey nodes joined by triangulating hairlines over a
flat white field, with depth-of-field softening the nearest and furthest nodes.
Seamless 18-second loop.

Two versions, identical in structure:

| Composition id        | Look                                                    |
| --------------------- | ------------------------------------------------------- |
| `V1-PlexusWhiteMono`  | Greyscale on white — neutral, editorial                 |
| `V2-PlexusWhiteBlue`  | Same field, ~20% of nodes in `#1f6feb`; lines stay grey |

Both compositions are **3840×2160, 30fps, 540 frames (18s)**.

## Setup

```sh
npm install
npx remotion studio
```

## Rendering at 4K

The compositions are authored at full 4K, so a 4K render is just `--scale=1`:

```sh
npx remotion render V1-PlexusWhiteMono out/V1_PlexusWhiteMono.mp4 --scale=1 --crf=16
npx remotion render V2-PlexusWhiteBlue out/V2_PlexusWhiteBlue.mp4 --scale=1 --crf=16
```

Stills:

```sh
npx remotion still V1-PlexusWhiteMono out/V1_PlexusWhiteMono.png --scale=1 --frame=90
npx remotion still V2-PlexusWhiteBlue out/V2_PlexusWhiteBlue.png --scale=1 --frame=90
```

A 1080p preview is the same composition at `--scale=0.5`.

`remotion.config.ts` already sets lossless PNG intermediate frames, `yuv420p`
and CRF 16. Thin near-black lines on flat white are the case H.264 handles
worst in the opposite direction from banding — if the white immediately around
the nodes ever looks dirty, lower the CRF rather than touching the artwork.

## How it works

`src/plexus/` is a 2D canvas renderer with a depth model, not a 3D scene. Each
node carries a `z` that drives its size, darkness and blur; connections are
computed in that 3D space but drawn as flat lines. Hairlines stay genuinely
crisp that way, and it renders far faster at 4K than a real 3D line pass.

- **`constants.ts`** — every tunable value, in "reference pixels" at 3840 wide.
  Draw code multiplies by `width / 3840`, so blur radii and line weights scale
  correctly at any output size.
- **`random.ts`** — seeded mulberry32. Nothing uses `Math.random()`: Remotion
  renders frames out of order across threads, so anything not a pure function of
  `(node, frame)` would flicker.
- **`field.ts`** — node placement (jittered-grid knots plus best-candidate
  blue-noise scatter) and per-frame positions. Each node's path is a sum of
  sines whose periods divide 540 frames exactly, so every node returns precisely
  to its start and the loop is seamless.
- **`draw.ts`** — connection search, depth bucketing, batched strokes, and the
  depth-of-field composite.
- **`grain.ts`** — six pre-rendered noise tiles cycled by frame (540 ÷ 6 = 90,
  so the grain loops too).

### Things worth knowing before changing it

- Connections use **3D** distance. A screen-space test joins nodes at wildly
  different depths and looks wrong immediately.
- Line opacity falls off smoothly with pair separation. Without that gradual
  fade the whole field flickers as links snap on and off — it is the single
  most important detail in a plexus.
- Depth of field is per-bucket, not global: six buckets are composited far to
  near, each blurred at its own radius. A global blur flattens the field.
- The connection search is O(n²), which is nothing at 260 nodes. If you raise
  `NODE_COUNT` a lot, add a spatial grid — don't drop the 3D distance test.
