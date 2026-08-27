# Particle Figure — three 4K Remotion compositions

Three seamless 16-second 4K loops, each a figure drawn as a field of ~7000
particles on a single 2D `<canvas>`. No 3D, no WebGL, no `requestAnimationFrame`,
no component state: every value on screen is a pure function of the frame number.

| Composition | Subject | Palette | Background | Subject animation |
| --- | --- | --- | --- | --- |
| `ParticleFigureFront` | head and shoulders, front | cyan on deep blue | circuit fragments | shimmer |
| `ParticleFigureProfile` | head and shoulders, left profile | indigo | drifting characters | data streams |
| `ParticleFigureHands` | two cupped hands + orbiting sphere | green on near-black | sparse dot grid | rotating sphere |

All three are 3840 × 2160, 480 frames, 30 fps, silent.

## Render

```bash
npm install

# 4K
npx remotion render ParticleFigureFront   out/figure-front-4k.mp4   --codec=h264 --crf=18
npx remotion render ParticleFigureProfile out/figure-profile-4k.mp4 --codec=h264 --crf=18
npx remotion render ParticleFigureHands   out/figure-hands-4k.mp4   --codec=h264 --crf=18

# 1080p previews (a true downsample: the canvas backing store stays 4K)
npx remotion render ParticleFigureFront   out/figure-front-preview.mp4   --codec=h264 --crf=18 --scale=0.5
npx remotion render ParticleFigureProfile out/figure-profile-preview.mp4 --codec=h264 --crf=18 --scale=0.5
npx remotion render ParticleFigureHands   out/figure-hands-preview.mp4   --codec=h264 --crf=18 --scale=0.5
```

`npm run dev` opens Remotion Studio.

## The technique

The piece hangs on one idea. A silhouette is rasterised to a mask, and particles
are sampled against it once, weighted toward the boundary so the interior stays
sparse and dark. Then those particles are snapped onto a **distorted grid**:
vertical lines are spaced evenly in a surface *angle*, and `sin` of that angle is
where they land on screen. That is exactly what happens when a cylinder is
projected flat, so the lines bunch up as they approach the left and right edges
of the form and spread across its middle. The bunching is computed per scanline
against the run of silhouette each particle actually sits in, so every arm, every
hand and each side of the head gets its own wrap. One non-linearity is the whole
reason a flat mask reads as a body with volume.

Horizontal lines use one global mapping over the figure's bounding box so they
stay continuous straight across the form, compressed toward its top and bottom
but only half as hard — foreshortening rather than a second competing wrap.

## Layout

```
src/variants.ts             the only file with a hex literal or a path string
src/ParticleFigure.tsx      owns the 4K canvas, runs the finish pass
src/components/             BackgroundLayer, GridOverlay, SubjectParticles
src/lib/mask.ts             rasterise silhouette -> edge / crease / span fields
src/lib/grid.ts             the distorted grid: snapping and drawable lines
src/lib/particles.ts        one seeded sample of the particle field
src/lib/streams.ts          profile only: ribbons off the back of the skull
src/lib/sphere.ts           hands only: the orbiting shell
src/lib/timing.ts           the 480-frame envelope, breath, loop-safe frame
tools/verify-loop.sh        asserts frame 0 === frame 480, pixel for pixel
tools/mirror-hand.mjs       authoring aid: mirrors one hand about x = 960
tools/package.mjs           builds the three single-version zips
```

Each layer paints into the one shared canvas from a layout effect. React flushes
child layout effects in tree order and before the parent's, which is what fixes
the compositing order: background, then grid, then particles, then vignette and
grain.

## Timeline (all three variants)

| Frames | |
| --- | --- |
| 0 – 30 | background only |
| 30 – 120 | the figure assembles out of a wide scatter |
| 120 – 420 | idle: never rotates or translates, breathes at ±0.8% scale on a 4 s sine |
| 420 – 480 | dissolves back to the scatter it came from |

Every period in the piece divides 480 — twinkle, respawn, stream travel, sphere
rotation, background drift — and the frame number is wrapped into `[0, 480)`
before any periodic maths, so `sin(8π)` never has to equal `sin(0)` in floating
point. `tools/verify-loop.sh <composition>` renders frame 0 and frame 480 and
compares them; all three are byte-identical at full 4K.

The dissolve is what makes that possible. A loop whose first frame is "empty
background only" can only be seamless if the figure leaves again, so the idle
runs to 420 rather than to 480 and the last two seconds mirror the assembly.

## Packaging

```bash
node tools/package.mjs
```

Writes `dist/particle-figure-{front,profile,hands}.zip`. Each is a standalone
Remotion project holding **only** its own version: `src/variants.ts` is rewritten
down to a single entry with the mode unions narrowed to match, `Root.tsx`
registers one composition, and the code paths for the other backgrounds and
subject modes are stripped out via the `// @only:` markers in the source.
