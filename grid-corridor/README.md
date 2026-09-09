# Neon Grid Corridor

A looping synthwave perspective grid: two mirrored planes, floor and ceiling,
converging on a vanishing point at the exact centre of frame, with transverse
lines travelling toward the viewer. Three colourways.

Authored at **3840×2160, 30fps, 450 frames (15s)**, and built to loop seamlessly.

| Composition ID | Colourway |
| --- | --- |
| `V1-GridCorridorRed` | Neon red (reference match) |
| `V2-GridCorridorCyan` | Cyan / blue |
| `V3-GridCorridorMagenta` | Magenta / violet |

## Setup

```bash
npm install
npx remotion studio
```

Remotion downloads its own Chromium on first render. If you already have one and
want to skip that, add `--browser-executable=/path/to/chrome` to any command below.

## Render at 4K

The compositions are 3840×2160, so `--scale=1` is the 4K master:

```bash
npx remotion render V1-GridCorridorRed      out/V1_GridCorridorRed.mp4      --scale=1 --crf=15
npx remotion render V2-GridCorridorCyan     out/V2_GridCorridorCyan.mp4     --scale=1 --crf=15
npx remotion render V3-GridCorridorMagenta  out/V3_GridCorridorMagenta.mp4  --scale=1 --crf=15
```

For 1080p previews, swap in `--scale=0.5`. Because the canvas backing store is
always the composition's full 3840×2160 and `--scale` only changes how the
browser samples it, a 1080p render is a supersampled 4K frame — the glow, line
weights and grain stay pixel-proportional between the two, and the preview is
if anything cleaner than the master.

Stills:

```bash
npx remotion still V1-GridCorridorRed out/V1_GridCorridorRed.png --frame=0 --scale=0.5
```

There is no audio in any composition, and `remotion.config.ts` sets `muted`.

## How it works

No 3D engine. The planes are perfectly flat and the camera never moves, so the
projection is exact closed-form maths and the lines stay razor-sharp — which
matters, because thin bright lines on black at 4K are where aliasing shows most.

* `src/geometry.ts` — the projection. The camera sits at the origin looking down
  `+z` with the planes one world unit above and below it, so a transverse line at
  depth `z` sits `u = f / z` pixels from the horizon. That single relation gives
  the bunching toward the horizon and the on-screen acceleration for free; neither
  is an easing curve. Longitudinal lines are straight rays from the vanishing
  point, and since their world width is constant while their screen width grows
  with `u`, each is drawn as a filled triangle with its apex on the vanishing
  point rather than a stroke — the taper *is* the perspective.
* `src/config.ts` — timing. `SPACINGS_PER_LOOP` is the whole loop mechanism and
  **must stay a whole number**: over 450 frames the corridor advances by that many
  transverse spacings, so every line has taken over a neighbour's position and
  frame 450 is identical to frame 0. Slowing the corridor down is a one-line
  change here.
* `src/draw.ts` — the render. Lines are drawn once into an offscreen plane, which
  is then composited twice (once flipped) to make the ceiling, so the mirror is
  exact and the grid is only rasterised once per frame. Bloom is three blurred,
  downscaled copies composited additively under the crisp cores.
* `src/palettes.ts` — the three colourways as a far → mid → near ramp.
* `src/grain.ts` — deterministic dither. Remotion renders frames out of order
  across threads, so the tiles are generated once from a fixed seed and the frame
  only picks which one to use; the 25-field cycle divides 450, so the grain loops
  with everything else.

Every length used while drawing is a fraction of frame height, and every value is
a pure function of `useCurrentFrame()` — no state, no `Math.random()` at render
time.

### Where a line's weight drops below a pixel

Distant lines thin toward hairlines. Below `MIN_LINE_PX` the width is held and
alpha is scaled by the shortfall instead (`src/draw.ts`), which keeps the line's
total energy right and stops it flickering on and off between frames. A
shimmering hairline is far worse on a 4K black field than a faint steady one.

### Tuning

| What | Where |
| --- | --- |
| Corridor speed | `SPACINGS_PER_LOOP` in `src/config.ts` (keep it a whole number) |
| Brightness pulse | `PULSE_PERIOD` / `PULSE_AMOUNT` in `src/config.ts` (period must divide 450) |
| Size of the dark horizon band | `Z_FAR` in `src/geometry.ts` — the grid stops at `u = H / Z_FAR` |
| Number of rays per plane | `LONGITUDINAL_SPACING` / `LONGITUDINAL_COUNT` in `src/geometry.ts` |
| Transverse line density | `WORLD_SPACING` in `src/geometry.ts` |
| Glow strength | `BLOOM_PASSES` in `src/draw.ts` |
| Colours | `src/palettes.ts` |
