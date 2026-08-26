# AI Workflow Diagram — Remotion

Two 4K-authored, 10-second one-shot workflow animations sharing a single
`<WorkflowDiagram>` component. The workflow itself — node labels, node icons and
the connection graph — is data, so a new version is a new entry in `WORKFLOWS`
plus a palette in `THEMES`.

| Composition id    | Variant     | Subject           | Connector | Size        | Length            |
| ----------------- | ----------- | ----------------- | --------- | ----------- | ----------------- |
| `WorkflowMeal`    | `"meal"`    | Meal planning     | Pink      | 3840 × 2160 | 300 frames @ 30fps |
| `WorkflowContent` | `"content"` | Content pipeline  | Violet    | 3840 × 2160 | 300 frames @ 30fps |

## Delivered renders

Both files are **1920 × 1080**, H.264, 10.00 s, no audio. They come from the
4K compositions rendered at `--scale=0.5`.

- `out/workflow-meal.mp4`
- `out/workflow-content.mp4`

## Setup

```bash
npm install
npm start          # Remotion Studio
```

## Render commands

1080p (what ships in this package):

```bash
npx remotion render WorkflowMeal    out/workflow-meal.mp4    --codec=h264 --crf=14 --scale=0.5 --concurrency=8
npx remotion render WorkflowContent out/workflow-content.mp4 --codec=h264 --crf=14 --scale=0.5 --concurrency=8
```

Full 4K, if you want it:

```bash
npx remotion render WorkflowMeal    out/workflow-meal-4k.mp4    --codec=h264 --crf=14
npx remotion render WorkflowContent out/workflow-content-4k.mp4 --codec=h264 --crf=14
```

Lighter previews:

```bash
npx remotion render WorkflowMeal    out/workflow-meal-preview.mp4    --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render WorkflowContent out/workflow-content-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

`--concurrency` must not exceed your CPU core count; drop it to `4` (or omit it)
on a smaller machine.

## What happens over the 300 frames

| Frames    | Beat                                                                  |
| --------- | --------------------------------------------------------------------- |
| 10 – ~166 | Build: a card springs in from 0.8 and blooms as it lands, then each of its outgoing connectors draws on via stroke-dash over 12 frames, then the next card. |
| ~166 – 180 | The last card settles.                                               |
| 180 – 300 | Hold. Only the travelling pulses, the ±10% glow breath and the camera keep moving. |

Frames 0 and 300 differ by design — this is a one-shot, not a loop.

## Structure

```
src/
  theme.ts                    THEMES — every colour in the project, per variant
  workflows.ts                WORKFLOWS — labels, icons and graph, per variant
  icons.ts                    Line-art icon paths on a 100×100 grid
  geometry.ts                 Plane transform, orthogonal routing, path maths
  timeline.ts                 Build schedule derived from the workflow data
  WorkflowDiagram.tsx         Composition root: camera, font gate, layers
  components/
    StarPlane.tsx             Background gradient, cluster glow, receding dots
    WorkflowNode.tsx          One card: spring, bloom, breath, label
    NodeIcon.tsx              Glowing line-art icon
    NeonConnector.tsx         Right-angle neon path, arrowhead, pulses
    cardSprite.ts             The card sprite, rasterised once
    Finish.tsx                Vignette and film grain
```

### Notes on the implementation

- **One affine transform** defines the plane: rotate −8°, shear, 6% horizontal
  compression. Cards, connectors and arrowheads all inherit it, so everything
  sits on the same surface.
- **Connectors are right angles only**, with rounded corners, and they pick a
  vertical corridor that avoids the other cards. Because Bézier curves are
  affine-invariant, transforming the control points transforms the curve
  exactly.
- **Arc length is computed, not measured.** Paths are flattened in JS rather
  than read back from the DOM, which keeps dash offsets and pulse positions
  identical on every render.
- **Everything static is rasterised once** to an offscreen canvas via `useMemo`
  and blitted: the ~40k-dot plane, the card sprite, each icon, the grain tile.
- All motion comes from `useCurrentFrame()` with `interpolate()` and `spring()`;
  all jitter comes from Remotion's `random()` with stable string seeds. No
  `Date.now()`, no `Math.random()`, no CSS animation, no component state.
- Inter is loaded through `@remotion/google-fonts` behind
  `delayRender()`/`continueRender()`.

### Adding a third version

1. Add a palette to `THEMES` in `src/theme.ts`.
2. Add nodes, edges and a build `order` to `WORKFLOWS` in `src/workflows.ts`
   (add an icon to `src/icons.ts` if you need a new one).
3. Register a `<Composition>` in `src/Root.tsx` with the new `variant`.

Nothing else needs to change — routing, timing and the build sequence are all
derived from the data.
