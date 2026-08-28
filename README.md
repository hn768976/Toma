# DNA Microarray — Rack Focus

A 4K Remotion piece: a printed microarray slide of fluorescent spots that resolves
from soft bokeh into sharp circles and back, on a seamless 12-second loop. The
focus pull is the subject; everything else is texture.

## Composition

| | |
|---|---|
| Composition id | `MicroarrayRackFocus` |
| Resolution | **3840 × 2160 (4K)** |
| Duration | 360 frames @ 30 fps = **12.0 s** |
| Loop | seamless — frame 0 and frame 360 are pixel-identical |
| Audio | none |

## Render

4K master:

```bash
npx remotion render MicroarrayRackFocus out/microarray.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

1080p preview from the same 4K composition (`--scale=0.5` renders the page at
half device scale; the canvas backing store stays 3840 × 2160):

```bash
npx remotion render MicroarrayRackFocus out/microarray-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

Studio: `npm start`. Typecheck: `npm run typecheck`.

**Keep the CRF low.** More than half of the loop is a smooth colour gradient
sitting on a near-black background, which is the worst case for an 8-bit encoder:
at default settings the soft passages band into visible contour rings and the
near-black background posterises into blocks. CRF 12 for the master and CRF 18
for the preview are deliberate. `remotion.config.ts` also raises the intermediate
JPEG quality to 95 for the same reason — the encoder should be the only place
anything is quantised.

## Structure

```
src/
  Root.tsx        composition registration
  Microarray.tsx  builds the seeded spot field once, drives the three passes
  SpotGrid.tsx    draws the sharp spot field into an offscreen buffer
  FocusPass.tsx   one filtered composite of that buffer + bloom + vignette
  GrainPass.tsx   sensor grain, on its own layer above everything
  theme.ts        THEME / THEMES — every colour in the piece
  config.ts       CONFIG — every tunable number, including the focus curve
  animation.ts    all frame-dependent maths, as pure functions
  spots.ts        seeded spot field, sprites and flash schedule
  colors.ts       hex parsing
```

Determinism: every value is a pure function of `useCurrentFrame()`, and every
random draw goes through Remotion's `random()` with a stable string seed. There is
no `Date.now()`, no `requestAnimationFrame`, no component state and no CSS
animation, so repeated renders are byte-for-byte identical. (`GrainPass` seeds a
small local PRNG *from* `random()` to fill its noise tiles — the seed is stable, so
the tiles are too.)

The spot field — positions, jitter, colours, radii, brightness, flicker periods,
flash schedule — is generated once in a `useMemo` and reused for every frame.
Regenerating it per frame would make the array boil.

## The focus curve

Frames | Blur | What happens
---|---|---
0 – 90 | 64px | Soft hold. Bokeh discs bleed into continuous colour fields.
90 – 170 | 64px → 2px | The pull in, on `Easing.inOut(Easing.cubic)`.
170 – 250 | 2px | Sharp hold. The grid is fully legible.
250 – 330 | 2px → 64px | The mirrored pull back out.
330 – 360 | 64px | Soft hold, matching frames 0–90 exactly.

It lives in `CONFIG.focus`, so a different rack focus is a data change.

The spot field is drawn sharp, once per frame, into a single offscreen buffer, and
the blur is one `ctx.filter` application on that whole buffer when it is composited
— never per spot. The buffer is larger than the frame on every side so off-screen
spots still bleed inwards. Compositing is `lighter`, so overlapping soft discs add
rather than occlude.

**Brightness compensation.** Blur redistributes each spot's energy, so the soft and
sharp halves of the loop do not read at the same exposure on their own. A gain that
rises with the blur amount rides in the same filter chain
(`blur(Npx) brightness(g)`), tuned so mean frame luminance stays flat across the
whole pull — measured at 47.6–48.5 / 255 end to end, i.e. within ±1%. Without it the
piece reads as an exposure change or a dissolve rather than a focus change.

**Bokeh edge.** Each spot is drawn from a pre-rendered sprite whose radial profile
is marginally brighter at 80% of the radius than at its centre. Invisible when
sharp; the classic bokeh rim once defocused.

**Performance.** Above 24px of blur the spot buffer is drawn at half resolution and
upscaled. Measured at the switch frame, that costs a maximum channel difference of
3/255 and a mean of 0.1/255 — invisible — and makes the expensive filter four times
cheaper. The sharp section is always drawn at full resolution.

## Secondary motion

- **Drift.** The whole field drifts on the diagonal at ~14 px/s. `CONFIG.drift.mode`
  picks how the drift closes the loop:
  - `closedDiagonal` *(default)* — the field walks a very thin ellipse whose long
    axis is the diagonal, one lap per loop. Frame 0 and frame 360 land on the same
    offset, and the spot field never has to repeat spatially.
  - `linearTiled` — the literal one-way translation: exactly `tileCells` grid cells
    per loop, with the seeded field made periodic along that axis so the
    translation closes. Note the trade-off this mode makes — a *constant* one-way
    pan can only close a 12-second loop if the content repeats over the distance it
    travels, so at 14 px/s (168px, under 1.5 cells) the field visibly repeats along
    the drift axis. Raising `tileCells` buys variety at the cost of drift speed.
- **Flicker.** Every spot breathes ±8% on a seeded sine whose period divides 360
  exactly, so all of them close the loop.
- **Flashes.** One or two spots per second lift ~35% brighter for 3–4 frames on a
  raised-cosine envelope, seeded per second of the loop and wrapped across the loop
  point.
- The camera is locked: no shake, no zoom, no rotation. Only the focus moves.

## Palette

`THEME.palette` in `src/theme.ts` is weighted like a real two-channel scan rather
than evenly: red (Cy5) 30%, green (Cy3) 30%, yellow 18%, blue 14%, orange 6%, white
2%. Roughly 12% of grid positions are empty or barely printed, brightness varies
widely per spot, and the seeded draw biases towards small clusters of 2–4
same-coloured neighbours, the way regional patterns show up on a real slide.

## Variants

`Microarray` takes a `variant` prop. A new look is a `THEMES` entry in `theme.ts`
plus an optional `VARIANT_OVERRIDES` entry in `config.ts` — the render code does not
change. `standard` is the only variant currently built.
