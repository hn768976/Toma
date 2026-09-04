# Aurora Borealis — Remotion

Three procedural aurora borealis clips. Everything on screen is generated in
code: sky gradient, Milky Way, starfield, aurora curtains, horizon glow, mountains and
treeline. There are no photographic assets of any kind — no star maps, no sky
plates, no landscape photos — which is what keeps the clips clean for
royalty-free licensing. No watermark, no logo.

## Compositions

| ID | Description |
| --- | --- |
| `V1-AuroraGreenRidge` | Green curtains over a silhouetted mountain range and treeline, with a gold horizon glow. |
| `V2-AuroraVioletStorm` | A stronger magenta/violet display, more curtains, same landscape. |
| `V3-AuroraSkyPlate` | Sky-only plate: green, full-frame aurora over stars, no landscape and no horizon glow. Composite your own foreground onto this. |

All three are **3840×2160, 30 fps, 900 frames (30 s)** and **loop seamlessly**.

## Setup

```bash
npm install
npx remotion studio
```

## Rendering at 4K

```bash
npx remotion render V1-AuroraGreenRidge out/V1_AuroraGreenRidge.mp4 --scale=1 --crf=16
npx remotion render V2-AuroraVioletStorm out/V2_AuroraVioletStorm.mp4 --scale=1 --crf=16
npx remotion render V3-AuroraSkyPlate    out/V3_AuroraSkyPlate.mp4    --scale=1 --crf=16
```

For a 1920×1080 preview, add `--scale=0.5`. Sizes throughout are fractions of
the frame from `useVideoConfig()`, so the preview matches the 4K render exactly.

Stills:

```bash
npx remotion still V1-AuroraGreenRidge out/V1_AuroraGreenRidge.png --frame=495 --scale=0.5
```

## How it is built

Everything is drawn to a single `<canvas>` in `useLayoutEffect`, keyed on
`useCurrentFrame()`, so each frame is fully painted before Remotion captures
it. All randomness comes from a seeded mulberry32 PRNG — no `Math.random()` at
render time and no state carried between frames, because Remotion renders
frames out of order across threads.

Layers, back to front (`src/aurora/`):

1. **Sky** — vertical gradient with very subtle low-frequency mottling.
2. **Milky Way** — a broad diagonal band of stretched, layered noise with dark
   dust lanes and a violet-pink cast in the brightest region.
3. **Starfield** — ~1900–2400 stars, brightness weighted heavily toward faint,
   denser along the Milky Way, a few with 4-point diffraction crosses, a small
   fraction twinkling on looping cycles. The sky does not rotate.
4. **Aurora curtains** — 8–10 per version, drawn to an offscreen canvas and
   composited additively so bloom can be applied to the aurora alone without
   lifting the stars.
5. **Horizon glow** — gold through amber to a thin band of red, brightest
   centre-right (V1/V2 only).
6. **Landscape** — a jagged mountain range behind a coniferous treeline, plus
   one warm pinpoint light out among the distant trees (V1/V2 only). The
   mountains come from midpoint displacement between hand-placed anchors,
   which is what gives rock its angular, faceted profile; smooth noise alone
   reads as hills. The same profile, flipped, shifted and flattened, forms the
   foothills. Trees are built tier by tier, each branch hanging out and
   slightly up from the notch below it. Everything is a pure black cutout with
   no interior detail, except that the far range is left a shade short of
   black so a little horizon glow bleeds through and the planes separate — a
   thin band of valley haze does the rest.

   These are vector paths rather than traced bitmaps, so the edges stay razor
   sharp at 4K and the project keeps no image assets.

Then a sub-level uniform dither, fine grain at about 2%, and a very slight
corner darkening.

### Curtains

Each curtain is a dense row of vertical strips. Every strip is one `drawImage`
of a pre-baked colour ramp — hot and greenest at the lower lip, cooling upward
through teal to violet-pink as it dissolves — scaled to that column's height.
Column-to-column brightness variation *is* the striation.

Two motions run decoupled, which is what separates a convincing display from a
moving gradient:

1. the **base path** undulates slowly like fabric;
2. the **striations travel along** the curtain at their own speed and
   direction, brightening and dimming as they go.

On top of that, curtains swell and subside on long, staggered cycles — two or
three gentle swells over the 30 seconds, not constant activity.

### Looping

Every source of motion is periodic in `t = frame / durationInFrames`:

- noise is sampled on a **circle in time**, `noise(x, R·cos 2πt, R·sin 2πt)`,
  so the sample point returns exactly to its start;
- striations and swells are sine trains whose phase advances a **whole number
  of cycles** over the loop;
- star twinkle uses integer cycle counts; the grain tiles cycle with the frame.

Stars, Milky Way, horizon glow and landscape are otherwise completely static —
the reference is a locked shot, with no camera move and no parallax.

### Encoding note

Large smooth sky gradients band badly in H.264. Frames are rendered as PNG
(`remotion.config.ts`) and the dither and grain passes give the encoder
something to hold onto. Check the **encoded file**, not the studio preview.

## Layout

```
src/
  index.ts              registerRoot
  Root.tsx              the three compositions
  lib/rng.ts            mulberry32
  lib/noise.ts          value noise, fbm, looping wave trains
  aurora/config.ts      per-version palettes and curtain parameters
  aurora/layers.ts      sky, Milky Way, stars, horizon glow, landscape, grain
  aurora/curtains.ts    the curtain renderer
  aurora/AuroraScene.tsx  per-frame compositing
```
