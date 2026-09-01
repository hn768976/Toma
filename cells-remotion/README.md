# Defocused Cells — 4K Remotion loops

Two versions of the same piece, in one project:

| Composition | Look | Cells | Blur ceiling | Drift |
| --- | --- | --- | --- | --- |
| `CellsRed` | dark cells on near-white | ~30, 180-620px | 90px | mostly leftward |
| `CellsBlue` | bright cells on near-black, additive + bloom | ~70, 90-380px | 70px | mostly upward, ~40% further per loop |

Both are 3840 x 2160, 450 frames at 30 fps (15.0 s), and both loop — frame 450
is pixel-identical to frame 0.

## Render

```bash
npm install
npx remotion render CellsRed  out/cells-red.mp4  --codec=h264 --crf=12 --concurrency=8
npx remotion render CellsBlue out/cells-blue.mp4 --codec=h264 --crf=12 --concurrency=8
```

CRF 12 is deliberate: the frame is almost entirely large smooth blurred
gradients, which band severely at default compression settings. `--concurrency`
must not exceed the machine's CPU core count.

1080p previews:

```bash
npx remotion render CellsRed  out/cells-red-preview.mp4  --codec=h264 --crf=18 --scale=0.5
npx remotion render CellsBlue out/cells-blue-preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

## Other commands

```bash
npm run dev           # Remotion Studio
npm run lint          # typecheck
npm run verify-loop   # asserts every drift path, morph and rotation closes at frame 450
npm run package       # writes cells-red.zip and cells-blue.zip
```

## Structure

- `src/cells/variants.ts` — the single `VARIANTS` object, keyed `"red" | "blue"`,
  holding the palette, cell count, size range, blur ceiling and drift settings
  for each version. Every hex literal in the project lives in this file.
- `src/cells/geometry.ts` — seeded cell generation, closed drift paths, and the
  bezier blob builder. Each blob is 5-8 points around a centre with each radius
  varied ±25% from the mean, smoothed through cubic beziers.
- `src/cells/CellField.tsx` — the composition, shared by both versions.
- `src/cells/CellLayer.tsx` — three depth buffers, each blurred exactly once.
  Computed at half resolution and upscaled with `imageSmoothingQuality: 'high'`.
- `src/cells/BackgroundWash.tsx` / `GrainPass.tsx` / `VignettePass.tsx` — the
  background field, ~3% grain, and the v2-only vignette.

Every layer draws to a canvas once per React render as a pure function of
`useCurrentFrame()`: no `Date.now()`, no `requestAnimationFrame`, no CSS
animation, no state, and all randomness through Remotion's `random()` with
stable string seeds. Any frame can be rendered in isolation, and repeated
renders are identical.
