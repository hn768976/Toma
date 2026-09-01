# HUD Marks — v1 "sparse"

White marks on pure black, weighted to the frame's edges.

Marks cluster around the corners and margins and leave the centre empty —
roughly 97% of the frame is untouched black at full state, which is what makes
it usable as an overlay or a title plate. Around 22 marks are present at peak.
The crossed X sits right of centre and turns once over the 300 frames; it is
the only moving element.

**Palette** — background `#000000`, mark white `#FFFFFF`, mark grey `#7A7A7A`,
panel fill `#D8D8D8`. **Grid pitch** 130px. **Layout** `edgeWeighted`.

**Phases**

| Frames | |
|---|---|
| 0-25 | empty black, held |
| 25-90 | marks fade in from the upper-right corner outward, in pairs 5-6 frames apart |
| 90-200 | full state — flicker and glitch only |
| 200-265 | marks fade out in a new order, not a reverse of their arrival |
| 265-300 | four stragglers hold, then black |


## What it is

A minimal HUD-marks animation drawn on a single 2D canvas — no 3D, no
Three.js, no external assets. All three versions share one mark vocabulary,
one renderer and one 300-frame structure; they differ only in the exported
`VARIANTS` entry that drives them.

| | |
|---|---|
| Composition id | `HudMarksSparse` |
| Resolution | 4K — 3840 x 2160 |
| Duration | 300 frames |
| Frame rate | 30 fps |
| Length | 10.0 seconds |
| Loops | **No.** The phase structure is one-shot: frames 0 and 300 differ by design, so it must not be looped. |

## Render at 4K

```
npx remotion render HudMarksSparse out/hudmarks-sparse.mp4 --codec=h264 --crf=14 --concurrency=8
```

A 1080p preview, which is much faster:

```
npx remotion render HudMarksSparse out/hudmarks-sparse-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

`--concurrency` should not exceed the number of CPU cores on the machine.

## Getting started

```
npm install
npm run dev      # Remotion Studio
npm run lint     # TypeScript
```

The other two versions are registered in the same project and render the same
way — `HudMarksSparse`, `HudMarksDense` and `HudMarksPrint`.

## How it is built

- **One data array per version.** `src/hud/fields/*.ts` are plain `MarkSpec[]`
  arrays. Each entry gives a mark type, a grid cell, a size in grid cells, a
  rotation, a palette tone and a fade window. The renderer only walks the
  array, so changing the composition never means changing drawing code.
- **One `VARIANTS` object.** `src/hud/variants.ts` holds every palette, mark
  vocabulary, layout mode, grid pitch, stroke weight and phase schedule. No
  colour value and no mark name appears anywhere else.
- **Three components.** `<Mark>` renders one shape — a single switch over the
  type name — once, into an offscreen sprite. `<MarkField>` walks the array and
  blits those sprites with transforms. `<GlitchPass>` shifts thin horizontal
  slices of the finished frame.
- **Every frame is a pure function of `useCurrentFrame()`.** No `Date.now()`,
  no `requestAnimationFrame`, no CSS animation, no component state. All
  randomness comes from Remotion's `random()` with stable string seeds, so any
  frame can be rendered on its own and still agree with its neighbours.
- **Sprites are built once** per size bracket and cached with `useMemo`. Per
  frame the renderer computes only each mark's current opacity.

## The vocabulary

Corner bracket, dot column, chevron, diagonal pair, crossed X, arc, square
panel, tick row, circle outline and dash — plus, in the print version only, a
registration target and a colour bar. Stroke weight is a uniform 3px at 4K
across the whole set; the crossed X's two primary strokes are the only thick
elements in the piece. Every mark snaps to a coarse grid.

## Finish

Fine grain at 3% alpha. No bloom, no vignette, no text, no logo, no
watermark, no audio.
