# Meditation Cosmos

Four looping meditation motion backgrounds, built as one Remotion project.

Everything on screen is procedural — seeded noise, gradients and canvas drawing.
The only asset is the supplied lotus silhouette. There is no photographic space
imagery anywhere in the project, no stock footage, no logo and no watermark.

| Composition ID          | Look         | Length         | Output name                 |
| ----------------------- | ------------ | -------------- | --------------------------- |
| `V1-MeditationHilltop`  | Hilltop      | 600f  (20s)    | `V1_MeditationHilltop.mp4`  |
| `V2-MeditationOrb`      | Radiant orb  | 600f  (20s)    | `V2_MeditationOrb.mp4`      |
| `V3-MeditationChakra`   | Chakra       | 720f  (24s)    | `V3_MeditationChakra.mp4`   |
| `V4-MeditationVortex`   | Vortex       | 600f  (20s)    | `V4_MeditationVortex.mp4`   |

All four are defined at **3840x2160, 30fps** and every one is a seamless loop.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

The compositions are authored at 4K, so a full-resolution render is just
`--scale=1`:

```bash
npx remotion render V1-MeditationHilltop out/V1_MeditationHilltop.mp4 --scale=1 --crf=16
npx remotion render V2-MeditationOrb      out/V2_MeditationOrb.mp4      --scale=1 --crf=16
npx remotion render V3-MeditationChakra   out/V3_MeditationChakra.mp4   --scale=1 --crf=16
npx remotion render V4-MeditationVortex   out/V4_MeditationVortex.mp4   --scale=1 --crf=16
```

Stills, at whatever frame reads best:

```bash
npx remotion still V1-MeditationHilltop out/V1_MeditationHilltop.png --frame=180 --scale=1
```

`--scale=0.5` gives the 1920x1080 preview instead. Because every size in the
project is a fraction of the frame, the preview is a pixel-exact half of the 4K
render — nothing shifts or re-flows between the two.

### Render speed

`remotion.config.ts` sets the Chromium GL renderer to `angle`. Remotion's Linux
default, `swangle`, pins the software rasteriser and was about **seven times
slower** on these layered 4K compositions for a pixel-identical result. If a
machine has trouble with `angle`, `--gl=swangle` still works — it is only slow.

Rendering is CPU-bound on the compositing, so `--concurrency` up to the core
count helps.

## How it is put together

```
src/
  Root.tsx                  the four <Composition> registrations
  lib/
    rng.ts                  mulberry32 + hashes; no Math.random() at render time
    noise.ts                value noise, fbm, ridged noise, and the loop `orbit`
    figure.ts               keys the silhouette to alpha once, at module level
    palette.ts              colour ramps
  components/               <Layer>, <Starfield>, <NebulaField>, <RadialGlow>,
                            <MeditationFigure>, <Bloom>, <Grain>, <Vignette>
  compositions/             Hilltop, Orb, Chakra, Vortex
public/
  figure.png                the lotus silhouette (black on white)
  figure.svg                the vector it was rasterised from
```

**The silhouette is black on an opaque white background, not transparent.**
`lib/figure.ts` keys it to alpha through a soft luminance ramp — wide and
near-linear, so the anti-aliased pixels along the fingers and the topknot
survive instead of being chewed off by a hard threshold. The result is cropped
to its bounding box and memoised at module level, so the key runs once per
renderer thread and is shared by all four compositions rather than repeating a
full-resolution `getImageData` pass on all 2520 frames.

**Looping.** Every animated quantity is a pure function of `useCurrentFrame()`
that is periodic over its composition's `durationInFrames`. The nebulae loop by
keeping the noise field static and orbiting the *sampling window* around a
circle in the domain (`noise.ts` → `orbit`), which returns exactly to its start
with no cross-fade. Rotations are whole numbers of turns; oscillators use whole
numbers of cycles; the chakra activation cycle is 120 frames, an exact divisor
of 720.

**No render-time randomness.** Remotion renders frames out of order across
several threads, so star positions, nebula seeds, ray angles and filament layout
all come from seeded PRNGs and nothing is carried between frames.

**Layer order.** Each composition is a stack of canvases composited with
`screen` for anything additive. The silhouette sits *above* every nebula, ray,
glow and bloom, so light only ever passes behind and around it. The two
deliberate exceptions are on the body by design: the seven chakra points, whose
halos bleed onto the silhouette, and the vortex heart glow.

**Bloom** is a selective pass — only the brightest cores are drawn into it, and
it is composited *below* the figure. These are already bright compositions;
blooming the whole frame, or blooming over the figure, washes out the crisp
black edge against the light, and that edge is the entire read of every shot.

**Resolution.** Soft layers (nebulae, glows, bloom) use small backing stores and
let the browser upscale them, which costs nothing on smooth gradients. Layers
that need a hard edge — the starfield, the silhouette — are full resolution.
Draw callbacks always work in composition coordinates whatever the backing store
is, so sizes stay expressible as fractions of the frame.

**Grain** runs at about 2%. Large smooth nebula gradients band badly in H.264
and the grain dithers the steps away — check the encoded file rather than the
studio preview, which never shows the banding it fixes.
