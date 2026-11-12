# Digital Earth Data Network — Remotion project (4K)

A stylised blue "digital Earth" wrapped in a plexus data network, with floating
HUD read-outs (hex IDs, decimals, boxed values), orange city-light hot spots and
a long camera pull-back from near the surface out to the full rotating globe.

| Composition ID | Version | Size | FPS | Frames | Duration |
|---|---|---|---|---|---|
| `EarthNetwork-V1-Match` | V1: matches the reference | 3840×2160 | 30 | 892 | 29.733 s |
| `EarthNetwork-V2-OrbitalCamera` | V2: alternative camera movement | 3840×2160 | 30 | 892 | 29.733 s |

**V1** opens in deep space among floating data read-outs looking up off the
horizon, tilts down as the limb of the Earth rises from the bottom of frame,
then pulls back in one long move (passing city-light clusters over Europe)
until the planet sits centred and slowly turning — as in the reference.

**V2 (camera movement)** keeps the same look, assets and network but replaces
the move with a continuous ~120° orbital fly-around: the camera starts low and
banked over the night side among the North-American city lights, sweeps across
the terminator and up over the northern hemisphere while pulling out, and ends
on a high three-quarter angle, still orbiting so the network parallaxes past.

## Technology
- Remotion 4 (scaffolded with `npx create-video@4.0.515 --blank`)
- Three.js r181 (WebGL 2) with custom GLSL shaders: earth surface grading,
  city-light glow, atmosphere rim, plexus lines, point sprites and X markers
- HTML overlay for the data labels, projected from 3D every frame, with
  depth-of-field blur, perspective scaling and occlusion by the globe
- Everything is deterministic (seeded PRNG), so any frame renders identically
  on any machine / render worker

## Commands
```bash
npm install
npm run dev                 # Remotion Studio preview
npm run render:v1           # V1 -> out/…_1080p.mp4 (4K comp rendered at --scale=0.5)
npm run render:v2           # V2 -> out/…_1080p.mp4
npm run render:v1:4k        # full 3840x2160 master
npm run render:v2:4k
npm run lint                # eslint + tsc
```
`remotion.config.ts` sets H.264 / yuv420p / CRF 16 and the `swangle`
(SwiftShader via ANGLE) GL backend so it renders on machines without a GPU.
On a GPU machine, add `--gl=angle` for much faster renders.

## Files
```
src/Root.tsx              compositions (4K, 30 fps, 892 frames)
src/earth/EarthNetwork.tsx  component: renderer, per-frame update, label overlay
src/earth/scene.ts        globe, atmosphere, haze, plexus network, nodes, X markers + shaders
src/earth/camera.ts       keyframed camera tracks for V1 and V2 (monotone cubic splines)
src/earth/labels.ts       deterministic HUD read-outs
src/lib/                  spline + seeded random helpers
public/textures/          earth textures (see credits)
```

## Credits
Earth textures (`earth_day_4096.jpg`, `earth_lights_2048.png`,
`earth_clouds_2048_soft.png` [alpha of `earth_clouds_1024.png`, upsampled and softened], `earth_specular_2048.jpg`) are from
the three.js examples (MIT), derived from NASA Blue Marble / Black Marble
public-domain imagery. Font: Roboto Mono (Apache 2.0) via `@fontsource`.
