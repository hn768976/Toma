# Nebula Clouds (Remotion + WebGL 2)

A 10-second, 30 fps motion background of soft nebula clouds: billowing blue
cloud masses, lilac filaments along the cloud edges, a small bright core
top-right, and a lilac wash that blooms from the bottom over the second half.

Scaffolded with the Remotion CLI (`npx create-video@latest --blank`).

## Compositions

| ID                     | Size          | FPS | Frames | Palette                      |
| ---------------------- | ------------- | --- | ------ | ---------------------------- |
| `NebulaClouds4K`       | 3840 × 2160   | 30  | 300    | Reference (blue / lilac)     |
| `NebulaCloudsAurora4K` | 3840 × 2160   | 30  | 300    | Alternate (teal / gold)      |

Both share one component; only the `palette` prop differs. Palettes live in
`src/nebula/palettes.ts`, so adding another colour grade is one object.

## How it works

- `src/nebula/shader.ts` is a single full-screen WebGL 2 fragment shader:
  - softly domain-warped fractal noise for the cloud masses,
  - billow turbulence for the puffy texture inside them,
  - thin noise zero-crossings (jagged by fine turbulence) for the filaments,
  - a hand-placed lighting layout and time-driven lilac wash / core glow.
- `src/nebula/NebulaClouds.tsx` draws one frame per `useCurrentFrame()`, so
  every frame is deterministic. The noise clock follows the pacing measured in
  the reference: calm at the start, faster through the middle, easing off at
  the end.
- All coordinates are resolution-independent, so 4K and 1080p renders show the
  same image at different pixel densities.

## Commands

```console
npm i
npm run dev        # Remotion Studio
```

Render the 1080p deliverables from the 4K compositions (H.264 MP4):

```console
npx remotion render NebulaClouds4K out/nebula-clouds-reference-1080p.mp4 --scale=0.5 --codec=h264
npx remotion render NebulaCloudsAurora4K out/nebula-clouds-aurora-1080p.mp4 --scale=0.5 --codec=h264
```

Render at full 4K by dropping `--scale=0.5`.

On a machine without a GPU, add `--gl=swangle` (software WebGL).
