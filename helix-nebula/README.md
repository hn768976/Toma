# Helix Nebula push-in (Remotion + WebGL 2)

This is a procedural recreation of a 20-second stock shot of the Helix ("Eye of God")
nebula, with a slow push-in, rotation and drift. The whole frame is one WebGL 2
fragment shader rendered inside a Remotion composition. It uses no bitmaps or
video assets.

| | |
|---|---|
| Resolution | 3840 × 2160 (4K UHD) composition |
| Frame rate | 30 fps |
| Duration | 600 frames (20.0 s). The reference has 600 frames at 29.97 fps (20.02 s), so frames map 1:1. |
| Tech | Remotion 4, WebGL 2 / GLSL ES 3.00 |

## Compositions

- `HelixNebula4K` (Version A) matches the reference: navy space, blue
  clouds, a lavender-white ring and a magenta core.
- `HelixNebulaEmber4K` (Version B) uses the same camera move with a warm
  "ember" palette: a gold ring and a cyan-white core in crimson and teal-black
  space.

## Commands

```console
npm i
npm run dev            # Remotion Studio

# Final 1080p H.264 deliverables, rendered from the 4K compositions
npx remotion render HelixNebula4K out/helix-nebula-reference-1080p.mp4 --scale=0.5 --codec=h264 --crf=16
npx remotion render HelixNebulaEmber4K out/helix-nebula-ember-1080p.mp4 --scale=0.5 --codec=h264 --crf=16

# Full 4K master
npx remotion render HelixNebula4K out/helix-nebula-reference-4k.mp4 --codec=h264
```

The canvas backing store follows `devicePixelRatio`. With `--scale=0.5` the
shader shades 1920 × 1080 pixels directly instead of shading 4K and
downsampling. All geometry is resolution-independent, and noise octaves are
added only when the pixel size can resolve them.

## How it is built

- `src/nebula/camera.ts` holds the camera path measured from the reference.
  Zoom and rotation come from ECC registration of star-free frames, checked
  against SIFT star matches: 1.0× → about 1.56×, and 0° → about −11.4°. The
  drift is solved per frame so the core follows the reference's core centroid.
  Stars and nebula move together, with no parallax.
- `src/nebula/shader.ts` builds the frame from these parts:
  - fbm clouds in a diagonal band
  - the outer helix shell and its left loop
  - a lumpy, domain-warped inner ring with fine radial grain
  - a dark annulus
  - a spiky magenta core with drifting sparks
  - four hashed star layers
- `src/nebula/flyby.ts` adds the soft foreground motes that drift past the
  lens between about 15 and 19 seconds.
- `src/nebula/palettes.ts` holds the two colour palettes.

`remotion.config.ts` selects the ANGLE GL backend, so headless rendering works
with or without a GPU.
