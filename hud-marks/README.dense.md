# HUD Marks — v2 "dense"

A dense cluster packed around frame centre, with the edges left empty.

The distribution inverts v1: about 48 marks concentrate in the middle on a
tighter 85px pitch and are allowed to overlap and layer over each other, where
v1's marks never touch. The extra marks are small ones — dot columns,
chevrons, diagonal pairs, dashes — so the cluster reads as detail rather than
clutter. Exactly three marks carry the coral accent; against an otherwise
monochrome frame those three become the focus.

Two marks rotate, at different rates and in opposite directions: the crossed X
turns once over the 300 frames, and one large circle outline turns 0.6 times
the other way.

**Palette** — background `#030305`, mark white `#FFFFFF`, mark grey `#6A6A72`,
accent coral `#E8452E` on three marks, panel fill `#C8C8D0`. **Grid pitch**
85px. **Layout** `centredCluster`.

**Phases** — arrival comes in three waves with pauses between them, which reads
as a system booting in stages rather than as a single reveal.

| Frames | |
|---|---|
| 0-15 | empty |
| 15-45 | first wave — the largest marks |
| 45-60 | pause |
| 60-95 | second wave — mid-sized marks fill in around them |
| 95-110 | pause |
| 110-140 | third wave — the small detail marks |
| 140-230 | full state |
| 230-250 | everything clears at once over 20 frames |
| 250-300 | black holds |


## What it is

A minimal HUD-marks animation drawn on a single 2D canvas — no 3D, no
Three.js, no external assets. All three versions share one mark vocabulary,
one renderer and one 300-frame structure; they differ only in the exported
`VARIANTS` entry that drives them.

| | |
|---|---|
| Composition id | `HudMarksDense` |
| Resolution | 4K — 3840 x 2160 |
| Duration | 300 frames |
| Frame rate | 30 fps |
| Length | 10.0 seconds |
| Loops | **No.** The phase structure is one-shot: frames 0 and 300 differ by design, so it must not be looped. |

## Render at 4K

```
npx remotion render HudMarksDense out/hudmarks-dense.mp4 --codec=h264 --crf=14 --concurrency=8
```

A 1080p preview, which is much faster:

```
npx remotion render HudMarksDense out/hudmarks-dense-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
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
