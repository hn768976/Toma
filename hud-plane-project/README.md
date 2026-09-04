# HUD Interface Plane

Two looping 4K motion-graphic plates: a HUD laid on a single angled plane over a
near-black field. Built with [Remotion](https://remotion.dev).

| Composition        | Look                        | Size      | Length          |
| ------------------ | --------------------------- | --------- | --------------- |
| `V1-HUDPlaneBlue`  | Dark blue, "system nominal" | 3840×2160 | 360f @ 30fps    |
| `V2-HUDPlaneAmber` | Amber/tactical, "alert"     | 3840×2160 | 360f @ 30fps    |

Both loop seamlessly: every animated value is a pure function of
`frame % durationInFrames`, and every cycle count over the loop is an integer.
Frame 360 is identical to frame 0, so the clip can be looped end to end with no
visible cut.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering

Render at full 4K:

```bash
npx remotion render V1-HUDPlaneBlue  out/V1_HUDPlaneBlue.mp4  --scale=1 --crf=16
npx remotion render V2-HUDPlaneAmber out/V2_HUDPlaneAmber.mp4 --scale=1 --crf=16
```

A 1080p preview from the same 4K composition — layout is identical, only the
raster scale changes:

```bash
npx remotion render V1-HUDPlaneBlue  out/V1_HUDPlaneBlue.mp4  --scale=0.5 --crf=18
npx remotion render V2-HUDPlaneAmber out/V2_HUDPlaneAmber.mp4 --scale=0.5 --crf=18
```

CRF 18 is used for previews rather than 16 only to keep the files a sensible
size; measured on the encoded output the grain — and therefore the dither that
keeps the gradient smooth — survives both settings equally. Render the 4K
masters at CRF 16.

Stills:

```bash
npx remotion still V1-HUDPlaneBlue  out/V1_HUDPlaneBlue.png  --scale=0.5 --frame=90
npx remotion still V2-HUDPlaneAmber out/V2_HUDPlaneAmber.png --scale=0.5 --frame=150
```

`remotion.config.ts` already pins the encode: H.264, `yuv420p`, PNG frames (so
nothing is quantised before the encoder sees it) and CRF 16.

## Banding

The plate is very dark and very smooth, which is the exact condition H.264 bands
in — more so than most clips of this kind. Two things guard against it:

- **Grain.** `src/hud/Grain.tsx` lays animated noise over the whole frame at
  ~2%. It is a look, but it is mainly the dither that stops the background
  gradient from ringing. Its mean is 0.5, so it would lift the black floor;
  `HUDPlane` pre-darkens the background gradient by exactly `grain / 2` to
  compensate, which is why the corners still land on the specified near-black.
- **CRF 16 with lossless PNG frames.**

If you still see rings in an encoded file at full size, raise the `grain` prop
on the composition (or drop the CRF) rather than brightening the background.

## Notes on the build

- **One plane, no engine.** Everything sits on a single flat SVG raked away from
  the camera with `perspective` + `rotateX`/`rotateZ`. There is no
  inter-element occlusion and no parallax between depths, which is what the
  look actually is. Keeping it as one SVG under one perspective container is
  also what keeps the hairlines crisp.
- **Resolution independence.** Sizes are viewBox units or fractions of the frame
  from `useVideoConfig()`, never raw pixels. `HAIR` (0.6 viewBox units) is ~2px
  at 4K and ~1px at 1080p.
- **Determinism.** Layout comes from a module-level seeded PRNG
  (`src/hud/layout.ts`); per-frame values come from `loopWave` and
  `hash01(elementId, frame % durationInFrames)`. No `Math.random()` at render
  time and no state between frames — Remotion renders frames out of order
  across threads.
- **Depth of field** is a screen-space cross-fade between a sharp copy and a
  lightly blurred copy of the plane, so only the extreme top and bottom soften.
- **No text anywhere**, by design: numbers or labels would fight the titles a
  buyer keys over the plate.

## Layout

```
src/
  index.ts              registerRoot
  Root.tsx              the two compositions
  hud/
    constants.ts        fps, duration, plane rake, drift, HAIR
    palette.ts          the two colour sets
    layout.ts           seeded, frame-independent element placement
    random.ts           PRNG, seeded hash, loop-safe waves
    svg.ts              arc / wedge path helpers
    PlaneContent.tsx    every element drawn on the plane
    HUDPlane.tsx        background, perspective stage, depth of field, vignette
    Grain.tsx           animated dither/grain
    color.ts            hex maths for the grain compensation
```

## Tuning

The compositions take props, editable live in the studio:

| Prop          | Default  | What it does                                    |
| ------------- | -------- | ----------------------------------------------- |
| `paletteName` | per comp | `blue` or `amber`                               |
| `grain`       | `0.05`   | Grain amplitude — raise it if you see banding    |
| `dofBlur`     | `0.0013` | Depth-of-field blur, as a fraction of frame width |
| `vignette`    | `0.55`   | Vignette strength                               |
