# Fibre optic corridor

A 4K fibre-optic animation built in Remotion, in three versions that share one
component and one config object. 2D canvas only — no 3D, no Three.js.

| Composition id | Version | Palette | Geometry |
| --- | --- | --- | --- |
| `FibreRising` | rising | blue | strands run along a floor and bend **up** into a wall behind the corridor |
| `FibreDescending` | descending | amber | strands run along a ceiling and bend **down** into a wall in front of it |
| `FibreTunnel` | tunnel | violet | no bend; strands wrap a full tube receding to the vanishing point |

All three are 3840x2160, 375 frames at 30fps (12.5s), and loop seamlessly —
frame 0 and frame 375 are pixel-identical, verified by render.

```bash
npm install
npm run dev                       # studio

# 4K
npx remotion render FibreRising     out/fibre-rising.mp4     --codec=h264 --crf=12 --concurrency=8
npx remotion render FibreDescending out/fibre-descending.mp4 --codec=h264 --crf=12 --concurrency=8
npx remotion render FibreTunnel     out/fibre-tunnel.mp4     --codec=h264 --crf=12 --concurrency=8

# 1080p preview
npx remotion render FibreRising out/preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

`--concurrency` is capped at the machine's core count; lower it if Remotion
complains.

## One config object

Everything that distinguishes a version lives in `VARIANTS`
(`src/fibre/variants.ts`): palette, a **signed** bend direction, the horizon
height as a number, strand density, packet behaviour, the depth-of-field band
and the floor treatment. No colour literal appears anywhere else, and nothing
downstream assumes a floor rising into a wall — `descending` is `rising` with
the sign flipped, and `tunnel` changes the geometry mode.

## The strand

Each strand is **one continuous curve**, not two element groups:

1. a run along a plane, from the frame's near edge toward the horizon, with
   lanes spreading as `d²` so the plane recedes rather than fanning out;
2. a **circular fillet arc** of a seeded radius — a true smooth arc, never a
   corner, built from the cubic bezier that matches a circular turn;
3. a straight run perpendicular to the plane, out through the far edge.

Bend radii and bend depths are **decorrelated**. If a larger radius always
began bending proportionally earlier, every strand would reach the wall at the
same height and leave a visible seam across the frame.

Strands are mirrored about the vertical centre in arrangement but not in seed,
so the two halves share a structure without being a butterfly.

## Determinism

* All motion is a pure function of `useCurrentFrame()`. No `Date.now()`, no
  `requestAnimationFrame`, no CSS animation, no state driving motion.
* All randomness goes through Remotion's `random()` with stable string seeds.
* Every periodic term closes on 375: undulation frequencies are integers,
  packet cycles are divisors of 375, the sheen tiles exactly, the grain is
  seeded on `frame % 375`.

## Performance at 4K

* Strand geometry is generated once, seeded and memoised. Only the undulation
  offset and an ambient camera drift are applied per frame.
* Curves are sampled once, so packet placement is a lookup rather than a bezier
  evaluation per packet per frame.
* Depth of field uses three offscreen buffers bucketed by depth — each blurred
  exactly once, never per strand. Heavily blurred buckets are allocated at half
  resolution.
* Strands are drawn as chunked tapered polygon fills rather than per-segment
  strokes, so width and brightness vary along a curve without the cost.

## `src/lib`

Vendored from a shared component library (`remotion-lib`, mirrored at
`../remotion-lib` in this repository) so each packaged copy of this project
ships standalone. Those modules are palette-agnostic and subject-agnostic;
keep them in sync with the library copy rather than editing them here.
