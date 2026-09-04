# Looking Up Through Winter Canopy

Two 20-second seamless loops of bare winter trees seen from directly below,
their trunks converging on a bright point overhead.

| Composition ID | Look |
|---|---|
| `V1-CanopyMonoFog` | Monochrome winter fog — grey-white sky, black trees |
| `V2-CanopyBlueNight` | Cold blue night — deep blue-teal sky, moonlit centre, sparse stars |

Both are defined at **3840×2160, 30 fps, 600 frames (20 s)** and loop
seamlessly: every animated quantity is a whole-numbered sine of the normalised
loop position, so frame 600 lands exactly on frame 0.

## Rendering at 4K

```bash
npm install
npx remotion render V1-CanopyMonoFog out/V1_CanopyMonoFog.mp4 --scale=1 --crf=16
npx remotion render V2-CanopyBlueNight out/V2_CanopyBlueNight.mp4 --scale=1 --crf=16
```

Stills:

```bash
npx remotion still V1-CanopyMonoFog out/V1_CanopyMonoFog.png --frame=90 --scale=1
npx remotion still V2-CanopyBlueNight out/V2_CanopyBlueNight.png --frame=300 --scale=1
```

Codec, pixel format (`yuv420p`) and CRF come from `remotion.config.ts`, so the
4K commands above only need to override the scale. Frames are captured as PNG
rather than JPEG so the fog gradients reach the encoder without picking up
block artefacts first.

The 1080p previews shipped alongside this project were rendered with:

```bash
npx remotion render V1-CanopyMonoFog out/V1_CanopyMonoFog.mp4 --scale=0.5 --crf=21
npx remotion render V2-CanopyBlueNight out/V2_CanopyBlueNight.mp4 --scale=0.5 --crf=21
```

CRF 21 rather than 16 for the previews specifically because of the grain. Film
grain is close to incompressible, and at CRF 16 a 20-second 1080p clip lands
around 190 MB — roughly 78 Mbit/s, which is master-grade bitrate for a preview
file. CRF 21 brings that to about a third with no change in the measured
banding and ~86% of the grain retained. Keep `--crf=16` for the 4K master.

Note the composition IDs use hyphens — Remotion does not allow underscores in
them — while the output filenames use underscores.

Interactive preview:

```bash
npx remotion studio
```

## How it works

There is no 3D camera. The upward fisheye look is a **radial arrangement**: 18
tree silhouettes are placed around the frame perimeter with their feet just
off-frame, each rotated so its trunk runs inward toward a shared vanishing
point, each given a little perspective taper so the crown end recedes. The
whole arrangement then rotates about that point by 3.5° out and back across the
loop — no more, because the restraint is what makes it read as a locked upward
shot rather than a turntable.

| File | Role |
|---|---|
| `src/layout.ts` | The radial arrangement — instance bearings, scales, tiers, sway phases |
| `src/keying.ts` | Luminance-keys the black-on-white source PNGs to alpha masks, once per browser context |
| `src/Tree.tsx` | One instance: placement transform, depth blur, alpha mask |
| `src/Canopy.tsx` | Layer order, global rotation and push |
| `src/palette.ts` | Both looks. Every V1 value is strictly neutral (R = G = B) |
| `src/Fog.tsx` `src/Stars.tsx` `src/Grain.tsx` `src/Overlays.tsx` | Atmosphere |
| `tools/make-trees.mjs` | Generates the silhouette source PNGs (see below) |

Depth is four tiers: near trees are pure black and sharp, and each tier further
back is lighter and softer as the fog washes it out. The drifting fog masses are
drawn *between* the far and near tiers, not on top of everything, which is what
actually separates the planes.

Nothing samples `Math.random()` or holds state between frames. Every instance
property is drawn once at module scope from a seeded generator, and every
animated value is a pure function of `useCurrentFrame()`.

## Verifying a render

`tools/qc.mjs` measures the encoded output rather than the preview, which is
where the real risks are — chroma drift from the `yuv420p` round-trip, and
banding across the long, near-flat fog gradients.

```bash
node tools/qc.mjs out/V1_CanopyMonoFog.mp4 --neutral   # add --neutral for V1
node tools/qc.mjs out/V1_CanopyMonoFog.png             # stills work too
```

It reports:

- **neutral** — max spread between R, G and B. V1 must be `0`; the palette is
  defined so every V1 value has R = G = B.
- **banding** — longest run of one identical value along a radial through the
  sky. Single-digit is fine; a hard contour would be tens of pixels.
- **grain-sp** — grain standard deviation, measured as the residual after
  subtracting a local plane from the quietest patch of open sky. Tuned to
  ~2.4%, and equal at 1080p and 4K because the grain has a 2px cell that
  survives the downscale.
- **loop** — the frame 599 → 0 step against the comparable 0 → 1 step. A ratio
  near 1.0 means no seam; it does not reach exactly 1.0 only because frame 0 is
  the keyframe and carries different quantisation noise.

## Tree assets

`public/trees/` holds three bare-tree silhouettes as **black artwork on an
opaque white background** — not transparent PNGs. `src/keying.ts` converts them
to alpha masks at runtime, once per browser context, using a soft luminance
ramp rather than a hard threshold so the finest twigs survive.

| File | Content | Use |
|---|---|---|
| `Untitled_design__4_.png` | Slim bare tree, long clean trunk | Two thirds of all instances, and all four dominant ones |
| `Untitled_design__2_.png` | Dense bare oak, many fine twigs | Crown tangle in the middle distance |
| `Untitled_design__3_.png` | Wide spreading dead tree | Once, far back, where the fog takes most of it |

> **Note on these files.** The three PNGs here were generated by
> `tools/make-trees.mjs`, which draws the same three archetypes procedurally.
> To use different artwork, drop it into `public/trees/` under the same
> filenames — anything black-on-white works, and no code changes are needed.
> `src/layout.ts` sizes each instance from its own image's aspect ratio, so
> replacements do not have to match the current dimensions.
