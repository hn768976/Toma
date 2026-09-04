# Airport Departure Boards

Two Remotion compositions of an airport departures board, rendered from one
shared row list and one shared `<DepartureBoard>` component:

| Composition ID | Look | Layout |
| --- | --- | --- |
| `DeparturesLCD` | Modern blue LCD panel, rows typing in | one column, 12 flights |
| `DeparturesSplitFlap` | Classic black split-flap board | two columns, 32 flights |

Both are authored at **3840 × 2160, 30 fps, 420 frames (14 s)** and both loop
seamlessly: the content at frame 420 is exactly the content at frame 0.

## Running it

```bash
npm install
npx remotion studio
```

## Rendering at 4K

```bash
npx remotion render DeparturesLCD out/V1_DeparturesLCD.mp4 --scale=1 --crf=16
npx remotion render DeparturesSplitFlap out/V2_DeparturesSplitFlap.mp4 --scale=1 --crf=16
```

For a 1920 × 1080 preview, render the same compositions with `--scale=0.5`. The
previews shipped alongside this project were made with `--scale=0.5 --crf=23`:
both boards carry real per-frame grain, which is the most expensive thing an
H.264 encoder can be asked to keep, and `--crf=18` at 1080p spends 60 MB on
noise without making the type any sharper.

Stills:

```bash
npx remotion still DeparturesLCD out/V1_still.png --frame=315 --scale=1
npx remotion still DeparturesSplitFlap out/V2_still.png --frame=150 --scale=1
```

## How it is put together

```
src/
  Root.tsx                    the two <Composition>s
  load-fonts.ts               loads the embedded woff2 faces before frame 1
  DeparturesLCD.tsx           theme + column count for V1
  DeparturesSplitFlap.tsx     theme + column count for V2
  board/
    constants.ts              size, fps, duration
    data.ts                   the single row list, the status model
    theme.ts                  colours and layout metrics for both looks
    DepartureBoard.tsx        the shared board component
    lcdPlan.ts                V1: what is typed, erased and retyped when
    flapPlan.ts               V2: which flap flips to what, and when
    Effects.tsx               grain, scanlines, screen glow, vignette
    Plane.tsx                 the header aeroplane, drawn as a path
public/fonts/                 Inter, Roboto Mono, Space Mono (latin subsets)
```

A few things worth knowing before changing it:

- **Everything is a pure function of `useCurrentFrame()`.** There is no state
  and no timer anywhere. Remotion renders frames out of order across threads,
  so the split-flap riffle characters come from a seeded FNV-1a hash of
  `(cell id, frame)` rather than from a random number generator.
- **The loop is enforced, not eyeballed.** Every LCD remark and every flap
  change is scheduled in a pair that returns the cell to its frame-0 value, and
  `flapPlan.ts` throws at module load if any flip would still be moving when
  the loop cuts back.
- **The fonts are embedded on purpose.** Both boards are fixed-width grids; a
  substituted font would change the glyph widths and visibly break the columns.
- **All sizes are fractions of the frame** taken from `useVideoConfig()`, so the
  1080p preview and the 4K render are the same layout.
- **The grain is a real noise plate**, tiled from `public/textures/grain.png` and
  offset per frame. It is calibrated by measurement rather than by eye: roughly
  1.6% of full range on the LCD's blue field and on the split-flap cell faces.
  One noise pixel covers four frame pixels at 4K, which is where it stops
  reading as digital noise and starts reading as film.

No airline names, IATA carrier prefixes, logos or watermarks appear anywhere;
the flight codes are invented letter pairs with invented numbers.
