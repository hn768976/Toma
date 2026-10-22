# Stem Cells — microscope background (Remotion + Three.js)

A procedural recreation of a "human / embryonic stem cell microscope" background
clip: backlit, lumpy cells with translucent membranes drifting through a glowing
blue field. Everything is generated with GLSL shaders on Three.js meshes
(`@remotion/three` / React Three Fiber) — no footage or textures are used.

| Composition      | Description                                             |
| ---------------- | ------------------------------------------------------- |
| `StemCells`      | Version 1 — matches the reference (blue backlit look)   |
| `StemCellsCoral` | Version 2 — same motion, coral/violet fluorescence palette |

- Authoring resolution: **3840×2160 (4K)**, 30 fps, 271 frames (9.03 s; the
  reference is 9.04 s — the nearest whole frame count at 30 fps).
- Cell positions and sizes are keyframed from measurements of the reference
  (`src/cells.ts`) and drawn with an orthographic camera, so the layout and
  motion line up with the original frame for frame.

## Structure

- `src/Root.tsx` — the two compositions.
- `src/StemCells.tsx` — scene: backdrop plane, cell bodies, rim halos, membranes.
- `src/shaders.ts` — GLSL (simplex + Worley noise, displaced cell surface,
  backlit rim shading, membrane rings, gradient backdrop).
- `src/cells.ts` — measured cell keyframes and Catmull-Rom interpolation.
- `src/palettes.ts` — colour palettes for both versions.

## Commands

```console
npm i
npm run dev          # Remotion Studio (4K canvas)
```

Render the 1080p H.264 deliverables from the 4K compositions:

```console
npx remotion render StemCells      out/stem-cells-reference-1080p.mp4 --scale=0.5 --codec=h264
npx remotion render StemCellsCoral out/stem-cells-coral-1080p.mp4     --scale=0.5 --codec=h264
```

Render native 4K instead by omitting `--scale=0.5`.
