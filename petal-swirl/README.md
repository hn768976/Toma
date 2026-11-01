# Petal Swirl — Remotion + Three.js (4K)

An overhead view of overlapping, fluted "swirl rosette" discs that slowly
turn in place. All geometry is procedural (no external assets), built with
Three.js through `@remotion/three`.

| Composition ID            | Size        | FPS | Frames | Duration | Notes |
|---------------------------|-------------|-----|--------|----------|-------|
| `PetalSwirl-V1-Reference` | 3840 × 2160 | 30  | 270    | 9.000 s  | Matches the reference: pearl-white discs, lavender shadows |
| `PetalSwirl-V2-Blush`     | 3840 × 2160 | 30  | 270    | 9.000 s  | Alternative colour palette: blush rose discs, champagne key light |

The reference clip has 270 frames at 29.97 fps (9.009 s). At exactly 30 fps
the same 270 frames last 9.000 s.

The disc rotation travels exactly three flute periods per clip, so the video
loops seamlessly, like the reference.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- About 2 GB of free RAM per render tab

## Install

```bash
npm ci        # or: npm install
```

## Preview

```bash
npm run dev   # opens Remotion Studio
```

## Render

4K masters (native composition size):

```bash
npx remotion render PetalSwirl-V1-Reference out/PetalSwirl-V1-4K.mp4
npx remotion render PetalSwirl-V2-Blush     out/PetalSwirl-V2-4K.mp4
```

1080p deliverables (the 4K composition rendered at half scale):

```bash
npx remotion render PetalSwirl-V1-Reference out/PetalSwirl-V1-1080p.mp4 --scale=0.5
npx remotion render PetalSwirl-V2-Blush     out/PetalSwirl-V2-1080p.mp4 --scale=0.5
```

`remotion.config.ts` sets H.264, `yuv420p`, CRF 16 and the `swangle`
(software) WebGL backend, which works on any machine. On a machine with a
GPU, add `--gl=angle` for much faster renders. `--concurrency=N` controls how
many frames are rendered in parallel.

## Source layout

- `src/Root.tsx` — registers both 4K compositions
- `src/PetalSwirl.tsx` — scene: camera, lights, soft VSM shadows, disc layout traced from the reference
- `src/discGeometry.ts` — procedural fluted disc mesh with analytic normals
- `src/palettes.ts` — V1 (pearl) and V2 (blush) colour palettes
