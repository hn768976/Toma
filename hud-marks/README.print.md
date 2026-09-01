# HUD Marks — v3 "print"

Inverted: black marks on warm off-white, arranged as press registration.

The inversion changes the meaning. Black on paper stops reading as a HUD and
starts reading as print registration, so the version leans into that. Corner
brackets become crop marks — pairs of thin lines that stop short of meeting —
sitting near the frame's true corners. Registration targets (a circle with a
cross running past it on all four sides) sit at the middle of each margin, and
a colour bar of seven filled squares runs along the bottom, with the accent
blue as one of them. The background carries a faint paper mottling at 3%,
fixed to the frame.

Positions are mirror-symmetric about the frame's centre column and centre row
— far more ordered than either previous version. The centre is empty as in v1,
but the emptiness reads as a page rather than as space.

Two things are removed rather than restyled. **The glitch pass is gone**:
horizontal slice tearing is a screen artefact and reads as an error on a
printed page. In its place, one or two marks occasionally render a shade
lighter for a few frames, as though under-inked. **Nothing rotates** — a
spinning registration mark makes no sense, so the crossed X is static.

**Palette** — background `#F4F2EE`, mark black `#14120E`, mark grey `#8A867E`,
accent blue `#1A5CD4` on two marks, panel fill `#2A2620` (the panel inverts to
dark). **Grid pitch** 130px. **Layout** `registration`.

**Phases** — the most orderly of the three: no waves, no pauses.

| Frames | |
|---|---|
| 0-20 | blank paper |
| 20-120 | a single clean stagger in |
| 120-250 | long hold |
| 250-300 | a clean stagger out |


## What it is

A minimal HUD-marks animation drawn on a single 2D canvas — no 3D, no
Three.js, no external assets. All three versions share one mark vocabulary,
one renderer and one 300-frame structure; they differ only in the exported
`VARIANTS` entry that drives them.

| | |
|---|---|
| Composition id | `HudMarksPrint` |
| Resolution | 4K — 3840 x 2160 |
| Duration | 300 frames |
| Frame rate | 30 fps |
| Length | 10.0 seconds |
| Loops | **No.** The phase structure is one-shot: frames 0 and 300 differ by design, so it must not be looped. |

## Render at 4K

```
npx remotion render HudMarksPrint out/hudmarks-print.mp4 --codec=h264 --crf=14 --concurrency=8
```

A 1080p preview, which is much faster:

```
npx remotion render HudMarksPrint out/hudmarks-print-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
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
