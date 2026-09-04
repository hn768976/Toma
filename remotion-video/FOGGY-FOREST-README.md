# Foggy Forest at Night — Remotion project

Three versions of a locked, seamlessly looping 30-second shot: bare trees
receding into thick fog, with a pale light glowing from deep in the woods.

| Composition id | Look |
|---|---|
| `V1-FoggyForestTeal` | Teal night fog (reference match) |
| `V2-FoggyForestAmber` | Warm amber dawn through mist |
| `V3-FoggyForestMono` | Neutral monochrome grey, for grading |

All three are defined at **3840×2160, 30 fps, 900 frames (30s)** and loop
seamlessly: every drift, sway, pulse and density cycle completes a whole number
of cycles over the 900 frames, so frame 900 is identical to frame 0.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

The compositions are authored at 4K, so a full-resolution render is just
`--scale=1`:

```bash
npx remotion render V1-FoggyForestTeal  out/V1_FoggyForestTeal.mp4  --scale=1 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted
npx remotion render V2-FoggyForestAmber out/V2_FoggyForestAmber.mp4 --scale=1 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted
npx remotion render V3-FoggyForestMono  out/V3_FoggyForestMono.mp4  --scale=1 --crf=16 --pixel-format=yuv420p --image-format=png --color-space=bt709 --muted
```

The flags past `--scale` matter more than they look:

- `--image-format=png` keeps the frames out of a JPEG round-trip on the way
  into H.264. Remotion's default JPEG intermediates would mush the grain and
  block up the dark gradients — the two things this piece is made of.
- `--color-space=bt709` with `--pixel-format=yuv420p` tags limited range.
  Without it, JPEG frames yield full-range `yuvj420p`, which some players
  read as limited and show with crushed blacks.
- `--muted` drops the silent audio track Remotion adds by default.

Stills:

```bash
npx remotion still V1-FoggyForestTeal out/V1_FoggyForestTeal.png --frame=210 --scale=1
```

1080p previews are the same commands with `--scale=0.5`; `tools/render-all.sh`
renders all three previews and their stills in one go.

> Large soft gradients in a dark frame are the worst case for H.264 banding.
> The scene carries ~2.5% grain specifically to dither them apart — judge
> banding on the **encoded file**, never on the studio preview.

## How it is built

The shot is 2D. There is no camera and no parallax; depth comes entirely from
scale, tone, blur and how much fog sits in front of each tier.

Everything is composited back to front onto a single 2D canvas
(`src/foggy-forest/render.ts`):

1. Sky, lightest around the distant glow and falling off to the frame edges.
2. The distant light — a soft vertical column left of centre, no visible source.
3. Five tree tiers, far to near, each **followed by** the fog plane that sits in
   front of it. That interleaving is the whole illusion: distant trees are
   genuinely inside the fog rather than under a global overlay.
4. Ground band and the mist hugging it.
5. Bloom on the glow only, vignette, grain.

| File | Role |
|---|---|
| `src/foggy-forest/constants.ts` | Frame size, fps, duration, glow placement |
| `src/foggy-forest/palettes.ts` | The three colour schemes |
| `src/foggy-forest/prng.ts` | Seeded PRNG and the looping oscillator |
| `src/foggy-forest/assets.ts` | Loading and rasterising the traced tree |
| `src/foggy-forest/noise.ts` | Seamlessly tiling fog textures, grain tiles |
| `src/foggy-forest/forest.ts` | Depth tiers and seeded tree placement |
| `src/foggy-forest/render.ts` | The per-frame compositing pipeline |
| `src/foggy-forest/FoggyForest.tsx` | The Remotion component |

Nothing uses `Math.random()` at render time and no state is carried between
frames: every placement, scale, flip and sway phase comes from a seeded stream,
so any frame renders identically in isolation.

## The tree

The whole forest is **one tree**, drawn 48 times.

`public/trees/tree-dense-oak.svg` is a vector trace of the dense bare oak
silhouette. Tracing rather than keying a bitmap buys two things:

- **Real gaps.** Every enclosed space between the branches is a hole in the
  path (`fill-rule="evenodd"`), not white paint — so fog and the distant glow
  show *through* the crown instead of being blocked by it. This is most of why
  the canopies read as bare branches rather than dark masses.
- **Sharpness at any scale.** The near-tier trunks are drawn at up to 1.6x the
  frame height. Each tier rasterises the vector at the size it actually needs,
  and a near-tier crop rasterises only its window — so a slab of trunk is
  rendered at full resolution for a slab, not at whatever a whole tree would
  have to be to contain one.

Using a single asset means variation has to be earned. It comes from scale,
horizontal flip, ±3° rotation, irregular trunk spacing, and per-tier **crop
windows** — trimming different parts of the tree so no two read alike. Crops
anchor on the trunk rather than on the middle of the artwork, so an off-centre
crop still stands its trunk on the ground line.

### Regenerating or replacing it

```bash
node tools/render-trees.mjs                            # silhouette PNG
node tools/trace-svg.mjs public/trees/tree-dense-oak.png   # PNG -> SVG
```

The PNG in `public/trees/` is a **procedural stand-in** for
`Untitled_design__2_.png` (`tools/tree-gen.html`), because the original was not
available in the environment this was built in. To use the original, drop it in
as `public/trees/tree-dense-oak.png` and re-run the trace — the tracer only
assumes what the original already is: a black subject on a white background
with the trunk base at the bottom centre.

## Tools

| Command | What it does |
|---|---|
| `node tools/render-trees.mjs` | Regenerates the silhouette PNG |
| `node tools/check-neutral.mjs out/V3_FoggyForestMono.png` | Asserts the mono version is genuinely neutral (R=G=B) |
| `node tools/check-loop.mjs out/V1_FoggyForestTeal.mp4` | Asserts the wrap (last frame → first) is no more abrupt than an ordinary frame step |
| `./tools/render-all.sh` | Renders all three 1080p previews and stills |
| `npm run lint` | ESLint + `tsc` |
