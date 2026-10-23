# Composition 1 – Light Waves (Remotion · Canvas 2D)

Glowing dotted light arcs bouncing along a diagonal circuit rail, shot on a
long lens with shallow depth of field and an out-of-frame light source.

| Composition       | Size        | FPS | Frames | Duration | Variant |
| ----------------- | ----------- | --- | ------ | -------- | ------- |
| `LightWaves-V1`   | 3840 × 2160 | 30  | 601    | 20.033 s | Electric-blue palette, matches the reference |
| `LightWaves-V2`   | 3840 × 2160 | 30  | 601    | 20.033 s | Alternative **"ember" magenta/amber palette**, same scene and camera |

The reference is 20.02 s (600 frames @ 29.97 fps). At exactly 30 fps the
closest whole-frame length is 601 frames (20.033 s, +13 ms).

## Technology

* Remotion 4 (project created with `npx create-video --blank`)
* Canvas 2D: a small camera-space 3D projection (`src/light-waves/scene.ts`),
  depth-of-field via per-depth layers blurred at reduced resolution, additive
  blending and a two-stage bloom (`src/light-waves/LightWaves.tsx`).
* Fully deterministic (seeded PRNG); no external assets are required.

## Commands

```console
npm i                  # install dependencies (Node 20.19+ / 22.13+)
npm run dev            # Remotion Studio preview
npm run render:v1      # 1080p H.264 delivery file of V1 -> out/
npm run render:v2      # 1080p H.264 delivery file of V2 -> out/
npm run render:v1:4k   # full 3840x2160 master of V1
npm run render:v2:4k   # full 3840x2160 master of V2
```

The 1080p deliverables are rendered from the 4K compositions with Remotion's
`--scale=0.5`. `remotion.config.ts` sets H.264 / yuv420p with lossless PNG intermediate frames.
