# HUD Marks

A minimal HUD-marks animation for Remotion, in three versions, all 4K
(3840 x 2160), 300 frames at 30fps, one-shot — **none of them loop**.

| Version | Composition id | Character |
|---|---|---|
| v1 `sparse` | `HudMarksSparse` | White on pure black, weighted to the frame's edges, centre empty |
| v2 `dense` | `HudMarksDense` | A dense overlapping cluster around frame centre, edges empty, three coral accents |
| v3 `print` | `HudMarksPrint` | Inverted — black on warm off-white, arranged as press registration |

Each version has its own README, which is the one shipped in that version's
zip: [`README.sparse.md`](README.sparse.md),
[`README.dense.md`](README.dense.md), [`README.print.md`](README.print.md).

```
npm install
npm run dev                       # Remotion Studio

npx remotion render HudMarksSparse out/hudmarks-sparse.mp4 --codec=h264 --crf=14 --concurrency=8
npx remotion render HudMarksDense  out/hudmarks-dense.mp4  --codec=h264 --crf=14 --concurrency=8
npx remotion render HudMarksPrint  out/hudmarks-print.mp4  --codec=h264 --crf=14 --concurrency=8
```

`--concurrency` should not exceed the machine's CPU core count.

## Layout

```
src/hud/
  variants.ts      the one VARIANTS object: palette, vocabulary, layout mode,
                   grid pitch, stroke weight and phase schedule per version
  fields/          one MarkSpec[] data array per version — the marks themselves
  Mark.tsx         one component, one switch: draws a shape into a sprite
  MarkField.tsx    walks the array, blits sprites with transforms
  GlitchPass.tsx   horizontal slice tearing (v1 and v2 only)
  shapes.ts        the drawing primitives for the mark vocabulary
  timing.ts        fade windows, flicker, ink variation, glitch schedule
  texture.ts       grain tiles and the print variant's paper mottling
  grid.ts          the coarse grid every mark snaps to
```
