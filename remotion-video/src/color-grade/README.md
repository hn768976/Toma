# Colour-Grading Dashboard

Two macro shots of a colour-grading suite, built as one Remotion project.
Both are 30fps and 569 frames (18.97s), matched to the reference clip.

| Composition        | Size      | Purpose               |
| ------------------ | --------- | --------------------- |
| `ColorGradeA1080p` | 1920x1080 | Variant A, delivery   |
| `ColorGradeA4K`    | 3840x2160 | Variant A, 4K master  |
| `ColorGradeB1080p` | 1920x1080 | Variant B, delivery   |
| `ColorGradeB4K`    | 3840x2160 | Variant B, 4K master  |

Variant **A** matches the reference framing: the screen rises to the
right, trackballs near and low-left, scopes far and high-right, locked-off
with a slow creep in. Variant **B** mirrors the rig — the screen rises to
the left, a node tree sits upper-right — and adds a lateral dolly plus a
real focus rack from the node tree down onto the trackballs.

## Rendering

```bash
npm install

# 1080p deliverables
npx remotion render ColorGradeA1080p out/grade-a-1080p.mp4 \
  --codec=h264 --muted --color-space=bt709 --concurrency=4
npx remotion render ColorGradeB1080p out/grade-b-1080p.mp4 \
  --codec=h264 --muted --color-space=bt709 --concurrency=4

# 4K masters (same command, 4K composition ids)
npx remotion render ColorGradeA4K out/grade-a-4k.mp4 \
  --codec=h264 --muted --color-space=bt709 --concurrency=4
```

`--muted` matters: the reference has no audio stream, and without it
Remotion writes a silent AAC track. Drop `--concurrency` to match the
machine — it must not exceed the CPU core count.

## How the resolutions stay in sync

Every value in this folder is authored in **1920x1080 "base pixels"**.
`<Stage>` wraps the whole tree in a `scale(resolutionScale)`, so the 4K
compositions are the same component with `resolutionScale: 2`. There is no
second set of numbers to keep in step, and since the content is DOM and
SVG rather than raster, it resolves natively at 4K.

To add a resolution, register a composition at `BASE_WIDTH * n` /
`BASE_HEIGHT * n` with `resolutionScale: n`. Nothing else changes.

## Architecture

The shot is assembled in the order a real one is: the display, then the
glass in front of it, then the lens.

```
ColorGradeDashboard        picks variant, evaluates the pointer script
└── Stage                  resolution scale -> perspective -> tilted plane
    ├── Backdrop           the grading monitor behind, heavily defocused
    ├── LayoutA / LayoutB  the UI itself, positioned in plane space
    │   └── DepthLayer     per-panel defocus, sampled from optics.ts
    └── ScreenSurface      pixel grid + glass sheen, still on the plane
└── FilmLook               vignette, chromatic fringing, grain (screen space)
```

Key modules:

- **`optics.ts`** — the camera/lens model. Turns a plane-space `(x, y)`
  into a camera distance and a blur radius. Because the entire UI is one
  tilted plane, depth is not a per-panel choice; it falls out of position.
  Blur is computed in dioptres, not linear distance, so defocus ramps
  steeply just off the focal plane and then flattens — the asymmetry that
  reads as a lens rather than as a gradient.
- **`camera.ts`** — per-variant rigs. Slow sine drift on periods that are
  deliberately not multiples of each other, so the breathe never visibly
  repeats inside 19 seconds.
- **`cursor.ts`** — the scripted pointer. Segments (`move`, `drag`,
  `click`, `scrub`, `dwell`) are bound to named controls, so a drag really
  does change the value the wheels and scopes render from.
- **`grade.ts`** — the shot being graded and what the grade does to it.
  Every scope reads from here, so they can never disagree with each other
  or with the trackballs.
- **`Stage.tsx`** — `<DepthLayer bands={n}>` draws a wide panel several
  times at different blur radii and cross-fades them with overlapping
  masks, giving a blur that ramps across the panel instead of one flat
  value over 500px of depth.

## Re-timing

`DURATION_IN_FRAMES` and `FPS` in `constants.ts` set the length. The
pointer scripts (`SCRIPT_A`, `SCRIPT_B`) are lists of segment durations in
frames that currently sum to 569; if you change the length, re-balance
them or the pointer will finish early and hold.

## Editing the layouts

Panels are placed in plane coordinates on a `PLANE_WIDTH x PLANE_HEIGHT`
surface that is much larger than the frame — the perspective drags a lot
of off-camera UI into the corners, and `PlaneBleed` keeps going past even
that so the plane's own edge is never visible as a hard diagonal.

Two things to check after moving anything:

1. **Pointer targets must stay inside the crop.** The trackball row runs
   off both edges of frame at this focal length; both scripts note which
   controls they avoid for this reason.
2. **Wide panels need `bands`.** A full-width panel with `bands={1}` will
   read as a flat sticker lying on top of the shot.
