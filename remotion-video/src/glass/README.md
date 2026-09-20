# Abstract glass motion pieces (V1 / V2)

Two looping 3D motion backgrounds built as Remotion compositions driven by
three.js. Both are authored at 4K and delivered at 1080p; the 4K compositions
are wired up and render-ready.

| Composition | Size | Duration | FPS | Look |
| --- | --- | --- | --- | --- |
| `GlassPanesRow-V1-1080p` | 1920x1080 | 10s / 300f | 30 | Frosted vertical panes on white |
| `GlassPanesRow-V1-4K` | 3840x2160 | 10s / 300f | 30 | as above |
| `GlassCardsFan-V2-1080p` | 1920x1080 | 16s / 480f | 30 | Glossy fanning panels on black |
| `GlassCardsFan-V2-4K` | 3840x2160 | 16s / 480f | 30 | as above |

## Rendering

```bash
npm install
npm run render:v1        # 1080p H.264
npm run render:v2
npm run render:v1-4k     # 3840x2160 H.264
npm run render:v2-4k
npm run dev              # Remotion Studio, with live prop controls
```

`--gl=swangle` selects SwiftShader+ANGLE, which is what makes these render on a
machine with no GPU. On a box with a real GPU, `--gl=angle` is considerably
faster and produces the same image.

## Graphics backend

`renderer.ts` picks, in order:

1. **WebGPU** — three's `WebGPURenderer` on its WebGPU backend. This is the
   path taken in Remotion Studio and the `<Player>`.
2. **WebGL2** — the same `WebGPURenderer` with `forceWebGL: true`. Same node
   materials, same scene graph, different backend. This is the path a CLI
   render takes: Remotion's headless Chromium advertises `navigator.gpu` but
   cannot allocate a canvas swap chain for it, so `ThreeStage` asks for the
   WebGL2 backend whenever `getRemotionEnvironment().isRendering` is true.
3. **Legacy WebGL** — a plain `WebGLRenderer` with classic (non-node)
   materials, if `WebGPURenderer` cannot initialise at all.

`materials.ts` keeps one set of material parameters working across all three
by restricting itself to the properties `MeshPhysicalMaterial` and
`MeshPhysicalNodeMaterial` share.

## Looping

Every animated quantity is a function of `progress = frame / durationInFrames`
built from `sin`/`cos` of `2*PI*progress` (or an integer multiple). The frame
after the last one is therefore identical to frame 0, and both files loop
without a seam. Delivered MP4s are muxed video-only so the container duration
is exactly 10.000s / 16.000s.

## Tuning

Both compositions expose a zod schema, so every parameter below is editable
live in Remotion Studio (`npm run dev`) and overridable per render with
`--props='{"...":...}'`.

- **V2** — `cardCount`, `fanDegrees` (peak splay between neighbouring cards),
  `exposure`.
- **V1** — `paneCount`, `baseAngleDegrees` (resting pivot away from face-on),
  `swingDegrees`, `waveLag` (phase lag down the row), `stepX` / `stepZ` (row
  layout), `rampGamma` (how late the blue arrives), `cameraX` / `cameraZ` /
  `targetX`, `exposure`.

Colour ramps live at the top of each scene file (`CARD_RAMP`, `PANE_RAMP`) and
are sampled in linear space; swapping those arrays re-grades a piece without
touching anything else.

## File map

- `ThreeStage.tsx` — hosts an imperative three.js scene in a Remotion
  composition: renderer lifecycle, per-frame `delayRender` handles,
  supersampling, resize.
- `renderer.ts` — backend selection and tone mapping.
- `materials.ts` — node/classic material factory.
- `environment.ts` — procedurally painted equirectangular studio lighting.
- `geometry.ts` — rounded slab / pane geometry and the cylindrical bend.
- `ramp.ts` — linear-space colour ramp sampling.
- `GlassCardsFan.tsx` — V2 scene.
- `GlassPanesRow.tsx` — V1 scene.
