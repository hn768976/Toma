# Workflow Graph — 3D automation node graph (Remotion + Three.js)

A recreation of a 14-second motion graphic: an AI-agent style workflow graph
on a dark perspective stage. Ghost tiles appear in mid-air, drop onto the
plane, a wire draws in from the parent node, and the tile lights up with its
icon, while the camera tracks along the growing graph.

- Scaffolded with the Remotion CLI (`npx create-video --three`)
- Rendered with **Three.js** through `@remotion/three` / React Three Fiber
- Tile faces, icons, ground grid and labels are procedural Canvas 2D textures
- **4K master**: 3840×2160, 30 fps, 420 frames (14.0 s)
- Seamless loop: the layout is periodic and the camera moves exactly one
  period over the 14 s, so the last frame flows into the first

## Compositions

| ID | Description |
| --- | --- |
| `WorkflowGraph` | Matches the reference: navy stage, blue tiles, white wires |
| `WorkflowGraphEmber` | Variant with a warm "ember" palette (plum stage, copper tiles, gold wires) |

Both are 3840×2160. Palettes live in `src/theme.ts`, the camera rig in
`src/Root.tsx`, and the graph layout and timing in `src/graph.ts`.

## Commands

```console
npm i
npm run dev                     # Remotion Studio

# 1080p H.264 delivery renders from the 4K compositions
npx remotion render WorkflowGraph out/workflow-graph-reference-1080p.mp4 --scale=0.5 --codec=h264 --crf=16
npx remotion render WorkflowGraphEmber out/workflow-graph-ember-1080p.mp4 --scale=0.5 --codec=h264 --crf=16

# Full 4K master
npx remotion render WorkflowGraph out/workflow-graph-4k.mp4 --codec=h264
```

The bundled font is JetBrains Mono (SIL Open Font License).
