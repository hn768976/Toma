# teal-waves

A dark, glassy liquid surface seen from just above the water line: black wave
faces, thin teal rim-light filaments on the crests, shallow depth of field
(sharp band in the middle, soft far field, heavily blurred foreground), pure
black background. 37.533 s, 1126 frames at 30 fps, does not loop.

Built with Remotion + three.js (`@remotion/three`, React Three Fiber, WebGL 2).
Everything is procedural: there are no textures, fonts, models or other assets.

| Composition     | Size      | Frames | What it is                                             |
| --------------- | --------- | ------ | ------------------------------------------------------ |
| `V1-teal-waves` | 3840×2160 | 1126   | Matches the reference: black → deep teal → pale cyan   |
| `V2-teal-waves` | 3840×2160 | 1126   | Same scene, **warm ember palette** (see below)         |
| `LookDev`       | 3840×2160 | still  | One of three key moments, used to tune the look        |

## Install

```
npm ci
```

Node 20.19+ / 22.13+. Remotion downloads its own Chrome Headless Shell on the
first render. (`remotion.config.ts` only points at a local headless shell if
`/opt/pw-browsers/chromium_headless_shell` exists, which is the case on the
sandbox this was built in and nowhere else.)

## Render

4K masters (the compositions' native size):

```
npx remotion render V1-teal-waves out/01-V1-teal-waves-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-teal-waves out/02-V2-teal-waves-4k.mp4 --codec=h264 --scale=1 --gl=angle --crf=16 --pixel-format=yuv420p
```

1080p (how the delivered MP4s were made):

```
npx remotion render V1-teal-waves out/01-V1-teal-waves.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
npx remotion render V2-teal-waves out/02-V2-teal-waves.mp4 --codec=h264 --scale=0.5 --gl=angle --crf=16 --pixel-format=yuv420p
```

One 4K frame (quick check):

```
npx remotion still V1-teal-waves out/v1-4k.png --frame=563 --scale=1 --gl=angle
npx remotion still V2-teal-waves out/v2-4k.png --frame=563 --scale=1 --gl=angle
```

Preview: `npm run dev`.

All internal buffers follow the output size, and every blur is a fraction of
the frame height, so 1080p and 4K show the same picture at different detail.

## What Version 2 changes, and why

Version 2 changes **only the colour palette**: the teal ramp is replaced by a
warm ember ramp (black → oxblood → amber → pale gold) with the same brightness
steps. Geometry, motion, camera, light, depth of field, glow and grain are the
same code and the same numbers; the two compositions differ in one prop
(`palette: "teal"` / `"ember"` in `src/Root.tsx`).

Palette is the change that suits this reference: the picture is a single hue
mapped over brightness on pure black, so a new ramp is visible at a glance and
leaves the design untouched. A different camera angle or move would change
which crests catch the light and where the focus band sits, i.e. it would
change the look itself rather than give a variation of it.

## Where to change things

| What                                   | File            | Setting                                             |
| -------------------------------------- | --------------- | --------------------------------------------------- |
| Colours (both palettes)                | `src/look.ts`   | `PALETTES.teal.ramp`, `PALETTES.ember.ramp`         |
| Which palette a composition uses       | `src/Root.tsx`  | `defaultProps.palette`                              |
| Exposure, black point                  | `src/look.ts`   | `LOOK.exposure`, `LOOK.blackPoint`                  |
| Rim-light hardness, near/far light     | `src/look.ts`   | `LOOK.light`                                        |
| Depth of field (focus, blur sizes)     | `src/look.ts`   | `LOOK.dof`                                          |
| Glow, grain, dither, vignette, haze    | `src/look.ts`   | `LOOK.glow`, `grain`, `dither`, `vignette`, `haze`  |
| Duration, fps, size                    | `src/config.ts` | `DURATION_IN_FRAMES`, `FPS`, `WIDTH`, `HEIGHT`      |
| Camera height / pitch / lens           | `src/config.ts` | `CAMERA`                                            |
| Wave size, drift speed, morph speed    | `src/config.ts` | `WAVES.size`, `WAVES.drift`, `WAVES.tempo`          |
| Wave layers (count, scale, amplitude)  | `src/config.ts` | `WAVES.swells`, `WAVES.filaments`, warps            |
| Mesh / height-map density, MSAA        | `src/config.ts` | `GRID`                                              |
| Look-dev key moments                   | `src/config.ts` | `MOMENTS`                                           |

A palette is a ramp of sRGB colours indexed by displayed brightness
(0 = black, 1 = brightest highlight). Keep the first stop `#000000`: the
background must stay exactly black.

## How a frame is made

All values come from `useCurrentFrame()`. Nothing uses `Math.random()`,
`Date.now()`, `requestAnimationFrame`, `useFrame`, `useState` or temporal
anti-aliasing; the only random numbers are layer offsets drawn once at module
level from a seeded `mulberry32`. A frame rendered on its own is byte-identical
to the same frame inside a full render.

`src/WavesScene.tsx` runs these passes in a layout effect keyed on the frame
(half-float targets throughout), then `<ThreeCanvas>` draws the last one:

1. **Height** – wave height for every texel of a screen-aligned "projected
   grid" (simplex noise layers: broad swells, chop, stretched filaments, three
   domain warps; fine layers fade out where they would be only a few texels
   wide).
2. **Shade** – per grid cell: fresnel rim light (the surface is a dark mirror
   lit edge-on from the far end), dimmed in the near field, with analytic
   specular anti-aliasing for hairline crests; plus a 4-row pre-averaged copy
   for long footprints.
3. **Surface** – the displaced mesh (4× MSAA). Each pixel averages the shading
   over the cells it covers along the view direction, so crests seen edge-on
   stay continuous. Outputs light + distance.
4. **Anti-alias / depth of field** – small gaussian for the in-focus picture;
   three-pass disc gather at half resolution for the blurred picture.
5. **Glow** – quarter-resolution gaussian.
6. **Final** – blend by circle of confusion, exposure, filmic shoulder, palette
   ramp, grain and ±1/255 dither (both fade to nothing on pure black).

## Look development

`scripts/measure-look.py` measures exposure, black level, hue per tonal band,
glow falloff, haze, grain, detail and vignette of a frame, and compares two
frames (reference, attempt) against ±10 % / ±10° targets:

```
python3 scripts/measure-look.py REF.png MINE.png --mask 285,170,480,260 --side-by-side compare.png
```

`scripts/ld.sh` renders the three `LookDev` moments and compares each with the
matching reference frame (`REF=<folder with f0.png f563.png f844.png>`);
`scripts/match.sh` does the same for frames 0, 563 and 1125 of a composition.
The reference clip itself is not part of this project. `lookdev/` holds the last
comparison images and numbers.

## Render time

Measured on the build machine: 4 CPU cores and **no GPU** (software WebGL
through ANGLE/SwiftShader), `--concurrency=2`.

| Output                | Per frame, machine otherwise idle | Whole video (1126 frames) |
| --------------------- | --------------------------------- | ------------------------- |
| 1080p (`--scale=0.5`) | 2.8 s (measured over 40 frames)   | about 53 min              |
| 4K (`--scale=1`)      | 12.2 s (measured over 8 frames)   | about 3 h 50 min (estimate) |

The delivered 1080p files were rendered while two other renders shared the
machine and took 6.7 s per frame (each half of 563 frames took about 63 min).
On a machine with a GPU expect a small fraction of these times. Setting
`GRID.samples` to `0` in `src/config.ts` saves roughly 30 % at the cost of
slightly rougher crest lines.

A render that would run longer than your job limit can be split with
`--frames=0-562` / `--frames=563-1125` and joined without re-encoding:
`ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4` (that is how the
delivered files were made).
