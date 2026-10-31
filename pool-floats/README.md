# Pool Floats — Remotion + Three.js (WebGL 2 / GLSL)

Two compositions recreating the reference clips (a pool float drifting on
sunlit water, casting a shadow on the pool floor). Each composition has two
versions. All four are authored at **4K UHD (3840×2160), 30 fps, 300 frames
(10.0 s)**. The 10.0 s length matches each reference exactly.

| Composition ID | Description |
| --- | --- |
| `Comp1-StripedFloat-V1` | Red/white candy-stripe float. Matches the reference look, framing and motion. |
| `Comp1-StripedFloat-V2` | Alternative **colour palette**: golden-hour light, deep turquoise pool, navy/sunflower stripes. Same camera and motion. |
| `Comp2-WatermelonFloat-V1` | Watermelon float. Matches the reference look, framing and motion. |
| `Comp2-WatermelonFloat-V2` | Alternative **camera movement**: a slow crane-down orbit, from nearly overhead to a low three-quarter angle, with a push-in. |

Why these alternatives: candy stripes work in any colour pair, so a new
palette keeps the idea intact. The watermelon float is defined by its
red/green/yellow colours, so its alternative keeps the palette and moves the
camera instead, showing the float and its floor shadow in 3D.

## Technology

* **Remotion 4** (scaffolded with `npx create-video --blank`) handles the
  timeline, rendering and encoding.
* **Three.js 0.187** with custom **GLSL 3 (WebGL 2)** `ShaderMaterial`s:
  * Water (one pass): an analytic wave height field. Each pixel's view ray is
    refracted to the pool floor. The floor has animated Voronoi caustics, and
    a soft ray-marched shadow of the float is traced through the wavy
    surface. Submerged parts of the float are ray-marched, and a Fresnel sky
    reflection is added on top.
  * Float: a torus mesh with a procedural pattern (S-curved candy stripes, or
    watermelon flesh/rind/skin with teardrop seeds) and glossy-PVC lighting.
* Every frame is a pure function of the frame number, so renders are
  deterministic and can run in parallel. No external image assets are used.

## Commands

```bash
npm install                # install dependencies (Node 20.19+ / 22.13+ / 24+)
npm run dev                # Remotion Studio preview

# Render one composition at full 4K:
npx remotion render Comp1-StripedFloat-V1 out/comp1_v1_4k.mp4

# Render the four delivery files (4K canvas downscaled to 1080p, H.264):
./render-all.sh out        # or: npm run render:all
```

The H.264 codec, yuv420p and the WebGL backend (`swangle` = ANGLE +
SwiftShader, so it works without a GPU) are set in `remotion.config.ts`. On
a machine with a GPU you can try `--gl=angle` for faster renders.

If Remotion cannot download its headless Chrome (offline or sandboxed
machines), point it at an existing Chromium:

```bash
REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npx remotion render ...
```

## Layout

```
src/
  index.ts             registerRoot
  Root.tsx             4 compositions, 3840x2160 @ 30 fps, 300 frames
  pool/config.ts       sizes, durations, palettes and per-version settings
  pool/motion.ts       float bob/drift/tilt and the camera paths (static + crane orbit)
  pool/shaders.ts      GLSL: water, caustics, shadow, float pattern and lighting
  pool/PoolScene.tsx   Three.js renderer driven by useCurrentFrame()
remotion.config.ts     codec / pixel format / GL backend / browser settings
render-all.sh          renders the four 1080p delivery MP4s
```
