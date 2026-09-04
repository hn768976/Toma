# Starry Night Over Treeline

Two 30-second, seamlessly looping ambient night-sky motion backgrounds, built
with Remotion. Both compositions are **defined at 3840x2160 (4K), 30fps, 900
frames** so they can be rendered at full resolution from this project.

| Composition ID              | Look                                                                   |
| --------------------------- | ---------------------------------------------------------------------- |
| `V1-StarryTreeline`         | Deep blue night — the reference match                                  |
| `V2-StarryTreelineMoonrise` | Same sky with a soft cool glow rising behind the treeline on the right |

## Render

```bash
npm install
npx remotion studio                 # preview

# 4K masters
npx remotion render V1-StarryTreeline out/V1_StarryTreeline.mp4 --scale=1 --crf=16 --image-format=png --muted
npx remotion render V2-StarryTreelineMoonrise out/V2_StarryTreelineMoonrise.mp4 --scale=1 --crf=16 --image-format=png --muted

# 1080p previews
npx remotion render V1-StarryTreeline out/V1_StarryTreeline.mp4 --scale=0.5 --crf=16 --image-format=png --muted
npx remotion render V2-StarryTreelineMoonrise out/V2_StarryTreelineMoonrise.mp4 --scale=0.5 --crf=16 --image-format=png --muted

# Stills
npx remotion still V1-StarryTreeline out/V1_StarryTreeline_still.png --frame=210 --scale=0.5
npx remotion still V2-StarryTreelineMoonrise out/V2_StarryTreelineMoonrise_still.png --frame=210 --scale=0.5
```

`--image-format=png` matters: the project-wide default is JPEG, and JPEG
intermediates visibly band on these large, smooth, very dark sky gradients.
`--muted` drops the silent audio track Remotion adds by default.

## Source layout

```
src/starry-treeline/
  constants.ts        timing, palette, densities — every period divides 900
  noise.ts            seeded value noise + fbm
  sky.ts              sky gradient, mottling, Milky Way band, band geometry
  stars.ts            star generation, twinkle, drawing
  trees.ts            asset loading, tinting, treeline layout
  grain.ts            looping film grain (also the gradient dither)
  StarryTreeline.tsx  the composition
public/trees/         the silhouettes: traced .svg (used) + source .png
tools/trace-png-to-svg.mjs
                      traces a black-on-white PNG to SVG
tools/generate-tree-assets.mjs
                      regenerates the stand-in PNGs (see "Tree assets")
```

## How it stays fast and deterministic

- Every random value comes from a seeded `mulberry32`, never `Math.random()`.
  Remotion renders frames out of order across threads, so anything that isn't a
  pure function of `(index, frame)` would pop between frames.
- The sky gradient, mottling, Milky Way and the ~94% of stars that don't
  twinkle are rasterised into an offscreen canvas **once** and blitted per
  frame. Only the twinkling subset (~6%) is redrawn.
- The mid and far tree tiers never move, so they're baked into a second
  offscreen layer. Only the five near-tier trees are drawn live, for sway.
- The trees are **SVG**, traced from the source PNGs, so the silhouettes stay
  crisp at any output size rather than being locked to the source raster.
  They're rasterised, cropped to their own bounds and cached once at module
  level, so placement doesn't depend on how much padding a source file carries.
- The loader takes either form. A traced SVG is used through its own alpha; a
  raw black-on-white PNG is keyed with a soft luminance ramp (so antialiased
  needle edges survive) — it picks between the two by sampling the source's
  alpha channel, so an untraced PNG can be dropped straight in.

## Loop

Everything periodic divides 900 frames: twinkle cycles (150/180/225/300/450),
near-tier sway (900/450/300), the V2 moon breath (450), and the grain tile
cycle (10). Verified empirically — the difference across the 899 -> 0 seam
matches an ordinary frame-to-frame step.

## Tree assets

`public/trees/` holds three black-on-white silhouettes:

| File                      | Content                                    |
| ------------------------- | ------------------------------------------ |
| `Untitled_design__5_.png` | Single conifer — the primary asset         |
| `Untitled_design__6_.png` | Group of three conifers                    |
| `Untitled_design__4_.png` | Slim bare tree, used sparingly for variety |

**These are stand-ins.** The originally supplied PNGs were not present in the
build environment, so `tools/generate-tree-assets.mjs` generates matching
silhouettes procedurally. To swap in the real artwork, overwrite the three
files above — same names, same black-on-white format. Nothing else needs to
change: the keying pass handles the alpha, and the crop-to-bounds step handles
any difference in framing or padding. Light grey drop shadows in the source art
key out cleanly (the ramp's white point is luminance 0.62).

To regenerate the stand-ins:

```bash
node tools/generate-tree-assets.mjs <output-dir>   # writes three SVGs
# then rasterise each to a 1920x1920 PNG, e.g. with headless Chrome:
#   chrome --headless --screenshot=out.png --window-size=1920,1920 \
#          --default-background-color=ffffffff file:///abs/path/conifer-single.svg
```
