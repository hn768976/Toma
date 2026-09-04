# Fluted Glass — light through ribs

A 2D light-modulation texture: soft blurred blooms drift across a near-black
field, and a fixed vertical rib pattern in front of them modulates the light
into highlights. No camera, no 3D — the ribs never move, all the motion is
light passing behind them.

Three versions, identical motion, different colour:

| Composition id        | Look                                        |
| --------------------- | ------------------------------------------- |
| `V1-FlutedGlassBlue`  | Cool blue / steel (reference match)          |
| `V2-FlutedGlassGold`  | Warm champagne / gold, reads as brushed brass |
| `V3-FlutedGlassMono`  | Monochrome white / graphite, no hue at all    |

Each is **3840×2160, 30fps, 360 frames (12s), and loops seamlessly** — every
bloom is back exactly where it started at frame 360, so the clip can be cut
end-to-start with no visible join.

## Install

```console
npm install
```

Requires Node 18+. Remotion downloads its own Chrome Headless Shell on the
first render.

## Preview

```console
npx remotion studio
```

## Render at 4K

One command per composition. These write 3840×2160 H.264 mp4s:

```console
npx remotion render V1-FlutedGlassBlue out/V1_FlutedGlassBlue.mp4 --scale=1 --crf=16
npx remotion render V2-FlutedGlassGold out/V2_FlutedGlassGold.mp4 --scale=1 --crf=16
npx remotion render V3-FlutedGlassMono out/V3_FlutedGlassMono.mp4 --scale=1 --crf=16
```

`remotion.config.ts` already pins the codec (`h264`), pixel format
(`yuv420p`) and PNG intermediate frames, so nothing else needs passing.

A 1080p preview is the same command with `--scale=0.5`. Stills:

```console
npx remotion still V1-FlutedGlassBlue out/V1_FlutedGlassBlue.png --frame=0 --scale=1
```

## How it is built

Everything is drawn to one canvas in a `useLayoutEffect` keyed on
`useCurrentFrame()`, so each frame is fully painted before Remotion captures
it. Back to front (`src/fluted-glass/FlutedGlass.tsx`):

1. **Light layer** — six large, heavily blurred blooms on a near-black field
   (`blooms.ts`). Two are bright and near-white, the rest dimmer and tinted;
   one crosses the upper left, another the lower right, and only dim ones
   pass near the middle, which stays the dark part of the frame. They are
   drawn into a 480×270 buffer and upscaled to the frame — bilinear
   upscaling by 8× is itself a very wide blur, and unlike a gaussian filter
   it cannot band.
2. **Rib pattern** — 64 ribs across the width (`ribs.ts`). Each rib face is
   shaded like a convex lens: dark at both edges, brightest just past centre,
   with a slow ramp up and a fast fall away. Multiplied over the light layer,
   so a rib only shows a bright band where a bloom sits behind it.
3. **Rib edges** — a near-black line at every rib boundary and a thin bright
   specular line at the highlight position, plus one extra additive pass of
   the specular cores so the hottest points reach near-white.
4. **Depth wash** — a soft vertical gradient, slightly darker at the top and
   bottom, then a light bloom over the whole frame and ~1.5% grain.

### Notes for re-rendering

- **The rib profile is a continuous function of x**, sub-sampled 4× per pixel
  column and stored as a 1px-tall strip that is stretched vertically. Nothing
  is drawn as a rectangle, so the ribs cannot alias. 64 ribs also divides
  3840, 1920, 960 and 480 evenly, so a rib boundary always lands on a whole
  pixel at every scale.
- **Grain is not optional.** The gradients between the ribs band visibly in
  H.264 without it. Judge it on the encoded file, never on the studio preview.
- **All motion is periodic over `durationInFrames`** — every drift and breath
  term is a sine of an integer multiple of the loop position. There is no
  cross-fade at the loop point; there is nothing to fade.
- **No `Math.random()` and no state between frames.** Bloom phases and grain
  tiles come from a seeded PRNG (`random.ts`), because Remotion renders frames
  out of order across worker threads.
- Rib count, blur radii and bloom sizes are all fractions of the frame width
  read from `useVideoConfig()`, so the 1080p preview and the 4K render are the
  same image at different resolutions.

## Layout

```
src/
  index.ts                     registerRoot
  Root.tsx                     the three compositions
  fluted-glass/
    FlutedGlass.tsx            per-frame canvas compositing
    constants.ts               composition size + every tunable
    blooms.ts                  bloom layout and their looping paths
    ribs.ts                    the rib shading profile
    grain.ts                   seeded grain tiles
    palettes.ts                the three colour schemes
    random.ts                  seeded PRNG
remotion.config.ts             codec, pixel format, image format
```
