# Allergic Skin Spots

Procedural 3D animation: red, itchy allergic wheals swell up out of a skin
surface, starting as smooth domes and breaking into lumpy plateaus, with fine
skin texture, vellus hairs, soft shadows and shallow depth of field. Built with
**Remotion 4** and **Three.js (WebGL 2, custom GLSL shaders)**. No external
assets - everything is generated in code.

| Composition            | Size      | FPS | Frames | Length  | Notes                                                   |
| ---------------------- | --------- | --- | ------ | ------- | ------------------------------------------------------- |
| `SkinAllergySpots-V1`  | 3840x2160 | 30  | 180    | 6.000 s | Reference match: static three-quarter camera             |
| `SkinAllergySpots-V2`  | 3840x2160 | 30  | 180    | 6.000 s | Alternative camera movement: low orbiting push-in        |
| `Preview-V1` / `-V2`   | 1280x720  | 30  | 180    | 6.000 s | Same scenes, light-weight, for Remotion Studio           |

## Commands

```bash
npm install            # or: npm ci

npm run render:v1      # 1080p H.264 MP4 of V1 -> out/skin-allergy-spots-v1-1080p.mp4
npm run render:v2      # 1080p H.264 MP4 of V2 -> out/skin-allergy-spots-v2-1080p.mp4
npm run render:v1:4k   # full 3840x2160 master of V1
npm run render:v2:4k   # full 3840x2160 master of V2
npm run dev            # open Remotion Studio
```

The 1080p files are the 4K compositions rendered with `--scale=0.5`, so they
are a supersampled down-scale of exactly the same frames.

Codec (H.264, yuv420p, CRF 16), JPEG frame quality and the OpenGL backend are
set in `remotion.config.ts`.

### Rendering notes

- The scene needs WebGL 2. The config uses `swangle` (software ANGLE), which
  works on any machine, including servers without a GPU. With a GPU you can add
  `--gl=angle` to a render command for faster renders.
- Remotion downloads its own Chrome Headless Shell on first render. To use an
  existing one instead, set `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.
- Every frame is a pure function of the frame number (seeded PRNG, no
  wall-clock time), so renders are deterministic and can be parallelised.

## Structure

```
src/
  Root.tsx             composition registry (4K masters + previews)
  SkinSpots.tsx        React component, picks the camera
  skin/skinScene.ts    scene: height-map bake, skin shading, hairs, cameras, timing
  gl/GLCanvas.tsx      Remotion <-> WebGL bridge (one synchronous draw per frame)
  gl/post.ts           HDR post chain: depth of field, vignette, grain, tone curve
```

How it works: each frame the wheal relief (height, slopes, redness) is baked
into a float texture; the skin mesh is displaced by it and shaded with wrapped
diffuse light, height-field soft shadows, ambient occlusion and procedural
micro texture. `SPOT_LAYOUT` in `skinScene.ts` holds the position, size and
start frame of each wheal; `REFERENCE_CAMERA` / `ORBIT_CAMERA` define the two
camera versions.
