# Fire Embers — looping ember overlay plates

Three 15-second, seamlessly looping ember plates, built in
[Remotion](https://remotion.dev). The compositions are defined at **3840×2160,
30 fps, 450 frames** and can be rendered straight to 4K.

| Composition id    | Look                                                          |
| ----------------- | ------------------------------------------------------------- |
| `V1-EmbersWarm`   | Reference match — fire, campfire, forge, autumn.               |
| `V2-EmbersCool`   | Cool blue-white — magic, frost sparks, fantasy.                |
| `V3-EmbersDense`  | V1's palette at ~3× the density with stronger upward drift.    |

## How to use the plates

These are **overlay plates**, not finished shots. The embers and haze sit on a
true `#000000` background, so the mp4 keys perfectly with a **Screen** or **Add**
blend mode over your own footage — no alpha channel, no rotoscoping, no keying:

- **Premiere Pro** — drop the clip on a track above your footage, then
  *Effect Controls → Opacity → Blend Mode → Screen*.
- **After Effects** — set the layer's blend mode to *Screen* or *Add*.
- **DaVinci Resolve** — in the Edit page, *Composite Mode → Screen*; on the
  Fusion page, a `Merge` node with *Apply Mode: Screen*.
- **Final Cut Pro** — *Video Inspector → Blend Mode → Screen*.

Black areas contribute nothing under a screen blend, so only the embers and the
warm haze show through. There is deliberately **no vignette** — a vignette in an
overlay darkens the corners of *your* shot and gives the comp away.

The plates loop seamlessly: frame 450 is identical to frame 0, so you can
repeat the clip end-to-end for any duration.

There is **no audio track** on any of the renders.

## Rendering

```bash
npm install
npx remotion studio          # interactive preview
```

Full 4K renders — one per composition:

```bash
npx remotion render V1-EmbersWarm  out/V1_EmbersWarm.mp4  --scale=1 --crf=14
npx remotion render V2-EmbersCool  out/V2_EmbersCool.mp4  --scale=1 --crf=14
npx remotion render V3-EmbersDense out/V3_EmbersDense.mp4 --scale=1 --crf=14
```

1080p previews are the same command with `--scale=0.5`; the composition is
rendered at half resolution, giving 1920×1080.

Stills (the frame number is arbitrary — every frame is a valid poster frame):

```bash
npx remotion still V1-EmbersWarm out/V1_EmbersWarm.png --frame=120 --scale=0.5
```

`remotion.config.ts` already sets the pieces that matter for this plate:
PNG frame capture (a JPEG intermediate bands the near-black gradients before
x264 ever sees them), CRF 14, and no audio track. Keep the CRF at 14 or lower —
at higher values H.264 lifts the black floor off zero and the grey veil shows up
the moment the plate is screened over footage.

If you are rendering somewhere that cannot download Remotion's managed Chrome
Headless Shell, point it at an existing Chrome build:

```bash
REMOTION_BROWSER_EXECUTABLE=/path/to/chrome npx remotion render V1-EmbersWarm ...
```

## How it is built

- `src/embers/field.ts` — the particle field. Every ember is generated once from
  a seeded PRNG at module scope and is then immutable; position, heat,
  brightness and orientation at any frame are pure functions of the frame
  number. Remotion renders frames out of order across worker threads, so a
  mutable particle array would both flicker and fail to loop.
- `src/embers/noise.ts` — curl-noise turbulence, sampled on a *circle* through
  two extra noise dimensions so the field itself repeats exactly over 450
  frames.
- `src/embers/sprites.ts` — cached sprites per (shape, softness, colour) bucket.
  Blurring hundreds of elements individually is hopeless; these are rasterised
  once and scaled and rotated per particle. Gradients carry a dither in the
  alpha channel, which is what stops the large orbs ringing after H.264.
- `src/embers/haze.ts` — the warm haze, drawn into its own buffer so its grain
  can be composited *through its own alpha*. Outside the haze there is no alpha
  to write into, so the black floor stays at a true 0,0,0 by construction.
- `src/embers/palette.ts` — the heat ramp. Embers cool as they rise, so the top
  of the frame is redder than the bottom.

Three particle classes are mixed roughly 60% sharp pinpoints, 25% motion-blurred
streaks (oriented along their own velocity vector, turbulence included) and 15%
large defocused orbs. Each ember carries a depth value that drives its size,
blur, brightness and speed — the speed difference is what reads as parallax
without any camera in the scene.

Every particle cycle length divides 450 exactly, and each ember's phase offset
is staggered, so resets are invisible in aggregate.

## Tuning

Density, palette, drift and haze strength for each version live in
`src/embers/variants.ts`. Adding a fourth look is a matter of adding an entry
there — everything else is shared.
