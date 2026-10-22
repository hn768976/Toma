# AI Agent Workflow — Remotion + Three.js

An isometric "AI agent" data-flow infographic: input sources stream into a
glowing AI Agent card (brain-chip emblem inside HUD rings), which fans out to
a workflow stage, then to output cards and on to the next agent's inputs,
while the camera slowly trucks along the flow.

* Scaffolded with the Remotion CLI (`npx create-video --three`).
* **Compositions are 3840×2160 (4K), 30 fps, 600 frames (20.0 s).**
* Rendering: Three.js via `@remotion/three` (React Three Fiber) for the 3D
  camera/perspective, Canvas 2D for every texture (glass panels, icons,
  brain, rings, labels, counters), and `postprocessing` bloom for glow.

## Versions

| Composition id          | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| `AIAgentWorkflow`       | Version A, matching the reference (deep teal, cyan, violet)        |
| `AIAgentWorkflowSolar`  | Version B, same choreography in a warm "solar" amber/rose palette |

## Commands

```console
npm i
npm run dev            # Remotion Studio
npm run render:a       # Version A → out/…_1080p.mp4 (4K comp rendered at --scale=0.5)
npm run render:b       # Version B → out/…_1080p.mp4
npm run render:a:4k    # optional full 4K renders
npm run render:b:4k
```

All renders are H.264 MP4 (yuv420p).

## Layout of the source

```
src/
  Root.tsx             compositions (4K, 30 fps, 600 frames)
  AIAgentWorkflow.tsx  font loading, ThreeCanvas, vignette, opening fade
  theme.ts             palettes (teal reference, solar alternate)
  layout.ts            timeline (frames), node positions, flow paths
  scene/               R3F components: camera rig, lines, nodes, specks
  draw/                Canvas 2D painters: glass panels, icons, brain, rings
public/fonts/          Rajdhani + JetBrains Mono (OFL)
```
