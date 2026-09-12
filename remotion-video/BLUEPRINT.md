# Blueprint Flyover

A procedurally drafted architectural floor plan drifting under a tilted
camera — a clean-room recreation of the supplied reference clip, delivered in
three cuts.

## Deliverables

| Cut | What it is |
| --- | --- |
| **Reference** | Matches the supplied clip: cyan neon linework on near-black, heavy bloom, two overlapping plan layers. |
| **Light** | Printed-paper inversion. Pale stock, blue ink, no bloom, soft grey dot grid. |
| **Lite** | Stripped-back dark plate. Same world, calmer: wider framing, no bloom, no second layer, a third of the annotation. Built to sit behind overlaid titles. |

Each cut exists as a 4K mastering composition and a 1080p delivery
composition. **Both are the same drawing** — everything is authored in a fixed
1920x1080 design space and scaled by the composition, so the 4K comp is the
1080p comp resolved at 4K rather than a separate layout.

| Composition ID | Size | Duration |
| --- | --- | --- |
| `BlueprintFlyover-Reference-4K` | 3840x2160 | 300f @ 30fps (10.000s) |
| `BlueprintFlyover-Reference-1080p` | 1920x1080 | 300f @ 30fps (10.000s) |
| `BlueprintFlyover-Light-4K` / `-1080p` | 3840x2160 / 1920x1080 | same |
| `BlueprintFlyover-Lite-4K` / `-1080p` | 3840x2160 / 1920x1080 | same |

Rendered deliverables live in `out/`, H.264 / yuv420p in an MP4 container.

## Rendering

```bash
npm install

# Delivery masters (1080p, H.264)
npx remotion render src/index.ts BlueprintFlyover-Reference-1080p \
  out/Blueprint-Reference-1080p.mp4 \
  --codec=h264 --image-format=png --crf=16 --pixel-format=yuv420p

# 4K master — same flags, swap the composition id
npx remotion render src/index.ts BlueprintFlyover-Reference-4K \
  out/Blueprint-Reference-4K.mp4 \
  --codec=h264 --image-format=png --crf=16 --pixel-format=yuv420p
```

`--image-format=png` matters here. The default JPEG intermediate leaves
visible artefacts in the large, nearly flat dark gradients.

Open the studio to scrub or retheme: `npm run dev`.

## How it is built

`src/blueprint/`

- **`planGen.ts`** — the floor plan. A binary space partition lays out the
  rooms; every internal node of the tree contributes exactly one wall segment
  spanning its parent rectangle, which yields a wall graph with no duplicate
  or overlapping runs. That matters because walls are drawn as double lines
  with door and window openings punched through them, and overlapping runs
  would show as doubled strokes. Cut positions are biased toward the middle of
  their span: a uniform cut lets one child keep nearly the whole parent, which
  strands huge un-subdivided rooms deep in the tree. Partitions stop on
  *footprint*, not on tree depth, so room sizes stay consistent across
  branches. A fifth of the interior walls stop short of the far wall, which
  breaks the grid into open-plan and L-shaped spaces.
- **`PlanSvg.tsx`** — draws a plan in plan units (inches). Knows nothing about
  the camera. Walls are split into heavy and light passes so the plan has
  depth rather than reading as a flat mesh; the heavy runs get a hot core
  stroke, which is what makes neon read as neon.
- **`BlueprintFlyover.tsx`** — the camera, the two plan layers, and the grade
  (depth wash, far-field haze, vignette, grain).
- **`constants.ts`** — the three themes, plus frame size and duration.

Randomness runs through a seeded `mulberry32`, so a given seed always draws
the identical building. Remotion renders frames in parallel across processes;
anything non-deterministic would flicker. Change `seed` in the composition
props to draw a different plan.

The grain overlay is not decoration. Large dark gradients band badly in H.264,
and a whisper of noise is what keeps them smooth.

## Fonts

Barlow Condensed (400/500/600) is self-hosted in `public/fonts/` and registered
through `delayRender()` in `src/load-fonts.ts`, so rendering never depends on a
network fetch.
