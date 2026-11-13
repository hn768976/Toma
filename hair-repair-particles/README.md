# Hair Repair Particles – molecule ring sealing a damaged strand (Remotion + Three.js)

A macro shot of a rough, damaged hair strand. A ring of glossy molecules with
an anamorphic lens flare travels up the strand and leaves it smooth and glossy
while the camera pulls back to reveal the whole strand against soft bokeh.

| Composition    | Size      | FPS | Length           | Description                                             |
| -------------- | --------- | --- | ---------------- | ------------------------------------------------------- |
| `HairRepairV1` | 3840x2160 | 30  | 270 frames (9 s) | Version 1 – matches the reference (olive / amber)       |
| `HairRepairV2` | 3840x2160 | 30  | 270 frames (9 s) | Version 2 – same animation, cool sapphire / ice palette |

Both compositions are authored in 4K. The 1080p deliverables are rendered from
the same 4K compositions with `--scale=0.5`.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- No GPU needed (software WebGL is used on Linux; ANGLE elsewhere)

## Commands

```console
npm install

# 1080p H.264 MP4 (the delivered files)
npm run render:v1      # -> out/hair-repair-v1-1080p.mp4
npm run render:v2      # -> out/hair-repair-v2-1080p.mp4

# native 4K H.264 MP4
npm run render:v1:4k   # -> out/hair-repair-v1-4k.mp4
npm run render:v2:4k   # -> out/hair-repair-v2-4k.mp4

# interactive preview
npm run dev
```

Equivalent raw CLI call:

```console
npx remotion render HairRepairV1 out/hair-repair-v1-1080p.mp4 --scale=0.5
```

Codec (H.264), pixel format (yuv420p), CRF and the WebGL backend are set in
`remotion.config.ts`.

## Project layout

```
src/
  Root.tsx         composition registration (4K, 30 fps, 270 frames)
  HairRepair.tsx   Three.js canvas, one synchronous draw per frame
  scene.ts         strand, molecule ring, lens flare, bokeh, background
  shaders.ts       GLSL: damaged/healthy hair, beads, background
  timeline.ts      timing, strand shape, ring travel, camera move
  palettes.ts      colour palettes for Version 1 and Version 2
  util.ts          seeded RNG, easing, tapered tube geometry
```

Everything is procedural (WebGL 2 shaders, no image or font assets) and
deterministic, so every render is identical. There is no audio.
