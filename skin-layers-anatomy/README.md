# Skin Layers Anatomy – exploded 3D model (Remotion + Three.js)

A floating block of skin separates into its layers (stratum corneum, squamous
cells, basal cells, dermis with vessels / hairs / follicles, adipose layer,
muscle), callout labels animate in, then the block closes again.

| Composition    | Size      | FPS | Length            | Description                                              |
| -------------- | --------- | --- | ----------------- | -------------------------------------------------------- |
| `SkinLayersV1` | 3840x2160 | 30  | 360 frames (12 s) | Version 1 – matches the reference (locked-off 3/4 view)  |
| `SkinLayersV2` | 3840x2160 | 30  | 360 frames (12 s) | Version 2 – same model/timing, orbiting + craning camera |

Both compositions are authored in 4K. The 1080p deliverables are rendered from
the same 4K compositions with `--scale=0.5`.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- No GPU needed (software WebGL is used on Linux; ANGLE elsewhere)

## Commands

```console
npm install

# 1080p H.264 MP4 (the delivered files)
npm run render:v1      # -> out/skin-layers-v1-1080p.mp4
npm run render:v2      # -> out/skin-layers-v2-1080p.mp4

# native 4K H.264 MP4
npm run render:v1:4k   # -> out/skin-layers-v1-4k.mp4
npm run render:v2:4k   # -> out/skin-layers-v2-4k.mp4

# interactive preview
npm run dev
```

Equivalent raw CLI call:

```console
npx remotion render SkinLayersV1 out/skin-layers-v1-1080p.mp4 --scale=0.5
```

Codec (H.264), pixel format (yuv420p), CRF and the WebGL backend are set in
`remotion.config.ts`.

## Project layout

```
src/
  Root.tsx            composition registration (4K, 30 fps, 360 frames)
  SkinLayers.tsx      Three.js canvas + label overlay, one draw per frame
  Labels.tsx          SVG callouts, projected from the 3D model every frame
  timeline.ts         timing, explode curve, camera for both versions
  load-fonts.ts       loads the bundled Montserrat font
  scene/
    buildScene.ts     layers, adipose globules, vessels, hairs, shadow
    layers.ts         layer stack definition (interfaces, explode offsets)
    slab.ts           wavy slab geometry
    textures.ts       procedural canvas textures (no image assets)
    util.ts           seeded RNG, easing, tapered tube geometry
public/fonts/         Montserrat 500/700 (SIL OFL, licence included)
```

Everything is procedural and deterministic (seeded RNG, frame-driven
animation), so every render is identical. There is no audio.
