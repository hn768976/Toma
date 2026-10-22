# Server Corridor (Remotion + Three.js)

A 3D dolly shot down a white data-centre aisle lined with glass server
cabinets and blinking status LEDs, recreated from a reference clip.

Built with the Remotion CLI (`create-video --three`) and React Three Fiber
(`@remotion/three`). Everything is procedural: geometry is generated from
`src/corridor/layout.ts` and the cabinet interiors / LEDs are drawn into
canvas textures with a seeded PRNG, so every render is identical.

## Compositions (all 3840x2160, 30 fps, 478 frames = 15.93 s)

| ID | Description |
| --- | --- |
| `ServerCorridor4K` | Matches the reference: white hall, smoked glass, white LEDs, constant-speed dolly toward the far wall. |
| `ServerCorridorMidnight4K` | Same camera move, alternate "midnight" palette: graphite hall, cyan light strips, cyan/green/amber LEDs, stronger floor reflection. |

## Commands

```bash
npm i
npm run dev                      # Remotion Studio

# Final 1080p H.264 deliveries, rendered from the 4K compositions
npx remotion render ServerCorridor4K out/ServerCorridor4K-1080p.mp4 --scale=0.5 --codec=h264 --crf=16
npx remotion render ServerCorridorMidnight4K out/ServerCorridorMidnight4K-1080p.mp4 --scale=0.5 --codec=h264 --crf=16

# Native 4K master (no --scale)
npx remotion render ServerCorridor4K out/ServerCorridor4K-2160p.mp4 --codec=h264
```

`remotion.config.ts` enables the ANGLE GL backend so WebGL works in headless
Chrome. The canvas `dpr` follows `--scale`, so a scaled render draws the
WebGL buffer at the output resolution directly.

## Layout

- `src/Root.tsx` – composition registry
- `src/constants.ts` – fps / duration / 4K size
- `src/corridor/layout.ts` – room dimensions and camera path
- `src/corridor/palette.ts` – reference and midnight palettes
- `src/corridor/Corridor.tsx` – cabinets, end wall, ceiling
- `src/corridor/glass-textures.ts`, `glass-material.ts` – cabinet interiors + LED shader
- `src/corridor/ServerCorridor.tsx` – lights, mirrored floor reflection, camera rig
