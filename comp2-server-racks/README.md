# Composition 2 – Server Racks (Remotion · Three.js)

A close, oblique view of data-centre server racks: drive trays with silver
latches, green/blue activity LEDs, blue LED strips on the rack posts and
cable-management hoops, rendered with physically based materials, an
image-based environment, Bokeh depth of field and bloom.

| Composition       | Size        | FPS | Frames | Duration | Variant |
| ----------------- | ----------- | --- | ------ | -------- | ------- |
| `ServerRacks-V1`  | 3840 × 2160 | 30  | 360    | 12.000 s | Oblique close-up with a slow, steady crane-down move, matches the reference |
| `ServerRacks-V2`  | 3840 × 2160 | 30  | 360    | 12.000 s | Alternative **camera angle + movement**: low-angle lateral tracking shot along the rack row |

The reference is 12.0 s (300 frames @ 25 fps) = 360 frames @ 30 fps.

## Technology

* Remotion 4 (project created with `npx create-video --three`; the React Three
  Fiber starter was replaced by an imperative Three.js renderer)
* Three.js r178: instanced geometry (`src/server-racks/build.ts`), canvas-
  generated textures (`textures.ts`), `RoomEnvironment` PMREM lighting,
  `EffectComposer` with `BokehPass`, `UnrealBloomPass` and `OutputPass`
  (`ServerRacks.tsx`). Camera moves are in `cameras.ts`.
* Fully deterministic; no external assets are required.

## Commands

```console
npm i                  # install dependencies (Node 20.19+ / 22.13+)
npm run dev            # Remotion Studio preview
npm run render:v1      # 1080p H.264 delivery file of V1 -> out/
npm run render:v2      # 1080p H.264 delivery file of V2 -> out/
npm run render:v1:4k   # full 3840x2160 master of V1
npm run render:v2:4k   # full 3840x2160 master of V2
```

`remotion.config.ts` enables the ANGLE OpenGL backend so WebGL works in
headless Chrome (it falls back to SwiftShader on machines without a GPU).
When rendering with `--scale=0.5` the renderer follows `devicePixelRatio`
and rasterises directly at the output size.

On a machine without a GPU, full-resolution 4K frames are rendered in
software and can take 30–60 s each; the config raises Remotion's frame
timeout to 10 minutes. Add `--concurrency=1` to the 4K scripts if memory
is tight.
