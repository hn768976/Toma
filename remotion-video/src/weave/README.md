# Woven texture films

Two 10-second abstract texture films, one per supplied reference clip, rendered
with Remotion + PixiJS v8 and a custom WebGL fragment shader.

| Composition | Reference | Cloth |
|---|---|---|
| `WovenTexture-01-CanvasWhite-1080p` / `-4K` | istock 2233990621 | bright cotton canvas, loose and irregular |
| `WovenTexture-02-WeaveGrey-1080p` / `-4K` | istock 2268264442 | dense mid-grey weave, tight and regular |

All four are 30fps, 300 frames (10.000s), and loop seamlessly.

## What the references actually were

Worth stating, because it drove the whole design. Both clips are 768x432 at
60fps, and neither contains continuous motion. Each is a **short cycle of macro
stills, hard-cut on a fixed hold** -- the "boiling" texture look. Measured off
the files:

| | Ref A | Ref B |
|---|---|---|
| Distinct stills in 600 frames | 50 | 60 |
| Hold per still | ~12 frames @60 (5.00/s) | ~11 frames @60 (5.45/s) |
| Unique states before repeating | **5**, cycling 10x | **10**, cycling 6x |
| Luma mean / sigma | 226 / 31.7 | 176 / 48.3 |
| Thread pitch | ~3.5px (=> ~220 across) | ~3.2px (=> ~246 across) |
| Autocorrelation peak | 0.38 (irregular) | 0.85 (very regular) |
| Field lighting | flat; rows all 226 | rows 192 -> 163 top to bottom |

At 30fps the holds halve. `holdInFrames` is picked per variant so that
`300 / hold` is a whole number of states *and* a whole number of cycles, which
is what makes the clip loop: variant 01 holds 6 frames (50 steps, 10 cycles of
5 states), variant 02 holds 5 frames (60 steps, 6 cycles of 10 states).

Nothing is sampled from the reference footage. The references supplied
measurements; the cloth itself is generated.

## How the cloth is built

`shader/weave.frag.ts` models the fabric the way it is actually woven rather
than drawing a pattern:

- **Two thread sets.** Warp runs vertically, weft horizontally. Each thread is a
  cylinder with its own twist, slub (thickness drift along its length) and shade.
- **Cell parity decides who passes over whom**, which *is* a plain weave. The
  checkerboard is never drawn -- it emerges.
- **The checkerboard's contrast is a lighting effect.** A cylinder lit across
  its axis is much brighter than one lit along it (the response goes as
  `sqrt(1 - (l.a)^2)`). Warp and weft sit at right angles, so a raking light
  separates them. `axisContrast` dials this.
- **`relief`** is the normal's z term. Domed crowns shade the middle of a cell
  differently from its edges, which muddies the two-cell alternation; flat
  crowns let it through cleanly. Ref B needs flat, Ref A less so.
- **Fibre fuzz, wander and mottle** supply the irregularity. `wanderScale` is
  deliberately high: low-frequency wander sweeps whole regions together and
  reads as banding across the frame rather than as cloth.
- **`ambientRamp`** thins the fill light down the frame. Ref B goes both darker
  *and* higher-contrast toward the bottom (sigma 43 -> 56), which is what a
  light raking from above does; ramping the ambient term reproduces both, where
  a plain brightness gradient would only darken.
- **The boil** (`boil.ts`) quantises the frame to a state index and derives the
  cloth offset, noise seed and exposure from that index alone. Because the index
  cycles within the clip length, the loop closes exactly.

## Resolution independence

The shader is authored against a 1920x1080 reference frame and every length is
in thread-cell units, so the 4K compositions are the *same framing at higher
fidelity* -- not a wider crop and not a retune. Edge softness tracks the pixel
footprint (`uPixelScale`) so the weave neither shimmers at 1080p nor goes
plasticky-sharp at 4K, and a 2x2 rotated-grid supersample inside the shader
handles the moire that a ~9px thread pitch would otherwise produce.

## Rendering

WebGL in headless Chrome has no GPU here, so `remotion.config.ts` sets
`setChromiumOpenGlRenderer("swangle")` (ANGLE's SwiftShader backend). It is
CPU-bound and slow; budget accordingly. `PixiWeave.tsx` creates the Pixi
application with `autoStart: false` and draws each frame synchronously from a
layout effect keyed to `useCurrentFrame()`, with `preserveDrawingBuffer: true`
so Chrome cannot discard the buffer before Remotion reads it back.

```bash
npx remotion render WovenTexture-01-CanvasWhite-1080p out.mp4 --codec=h264 --crf=14
npx remotion render WovenTexture-02-WeaveGrey-4K      out.mp4 --codec=h264 --crf=12
npx remotion studio    # tweak any preset value live
```

Every look parameter is a validated prop (`presets.ts`), so both variants can be
re-graded from the Studio sidebar without touching the shader.
