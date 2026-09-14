# Microscopic bacteria — eleven versions

A Remotion + three.js/WebGL series. Eleven motion clips, one per
reference, all built on the single supplied bacillus model.

## What is authored, and what is delivered

| | |
|---|---|
| Compositions | 11, all **3840×2160 @ 30fps** |
| 1080p delivery | the same compositions rendered with `--scale=0.5` |
| Codec | H.264 / MP4 |
| Length | each version matches its reference clip exactly |

There is no separate 1080p composition. Scale is a render-time
argument, so the two resolutions cannot drift apart.

```bash
npm run render:bacteria:1080p   # 11 × 1920×1080 H.264
npm run render:bacteria:4k      # 11 × 3840×2160 H.264
npm run stills:bacteria         # one colour + one matte frame per version
```

Every composition also appears in `npm run dev` (Remotion Studio).

## The model

`public/models/bacillus.glb` is the supplied Meshy export, byte for
byte. It is a raw trimesh dump: 50,374 positions and an index buffer,
and nothing else — no normals, no UVs, no materials, no textures.

**No vertex position or face in that file is modified anywhere in this
project.** The silhouette that comes out of the GLB is the silhouette
that reaches the screen. What `geometry.ts` adds is the data the file
omits but any shader needs in order to light a surface at all:

- **vertex normals**, computed from the faces already present
- **cylindrical UVs**, projected from the same positions
- a **re-centring translation**, so instances tumble about the rod's
  middle rather than an arbitrary export pivot

All eleven looks are reached by changing material uniforms and layout
only.

## How a version is built

Each preset in `presets.ts` describes one reference: its length, its
backdrop, how its cells are lit, and how thickly they are stacked
through depth.

```
Backdrop      DOM — ground colour, two radial washes, defocused granular field
  ↓
Layer 0       far slice,  many small instances, heavy CSS blur
Layer 1       mid slice,  light blur
Layer 2       near slice, in focus, carries the bloom
  ↓
Grade         vignette + grain
```

Depth of field is real: the swarm is split across three canvases by
depth and the far ones are blurred in CSS. That is what gives the
soft-focus falloff every reference leans on, without paying for a
post-processing pass.

`BacillusMaterial.ts` synthesises the whole cell surface — nodular
relief, ribosome speckle, a fresnel edge, wrap lighting for the
translucent gel, and a bright-field mode where the cell absorbs light
and sits *darker* than the ground (versions 07 and 09).

## Colour pass and matte pass

The reference for version 05 carries its alpha as a white-on-black
matte in the back half of its timeline, time-aligned with the colour
pass. Every version here follows that same contract:

```
frame 0 ────────── colour ──────────┼────────── matte ────────── end
                                  50%
```

The matte replays the colour pass from frame 0 as flat white on black,
so frame *n* of the matte is exactly the alpha of frame *n* of the
colour pass. Total length always equals the reference's.

Version 02 and version 05 answer the same source clip — the two
uploads were byte-identical — so 02 is graded to its colour pass and 05
to its matte pass.

## Rendering notes

A headless render has no GPU: the whole WebGL pipeline runs on
SwiftShader, on the CPU. Four things make that practical, and all four
are worth keeping:

1. **Surface detail is baked** into a small tiling texture
   (`detailTexture.ts`) rather than evaluated as noise per fragment.
   The shader was costing roughly 360 `sin()` calls per pixel.
2. **No MSAA.** The in-focus slice and the matte are drawn oversized
   and downsampled instead. Multisampling alone cost several times more
   than the rest of the frame put together.
3. **Defocused slices draw fewer pixels.** A layer heading for a 20px
   blur cannot show detail finer than that blur.
4. **The matte is one canvas**, not three — it has no depth of field to
   separate.

Resolution is controlled through R3F's `dpr`, never by resizing the
canvas element: R3F measures its own container and sets the GL viewport
from that, so resizing the element underneath it leaves viewport and
drawing buffer disagreeing and the scene gets silently cropped.
