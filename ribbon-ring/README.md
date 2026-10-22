# Fin Dome (Remotion + Three.js)

An abstract loop: a ring of thick violet fins (washer-shaped slices of a
torus) turning slowly around its axis, shot close up with a very
shallow depth of field, sweeping away towards a lavender glow over a
blue backdrop. Rebuilt from a 6-second reference clip.

- **Tech:** Three.js (WebGL 2) driven frame-by-frame from Remotion. Real
  3D fins (bevelled extrusions with a baked lip-to-shadow gradient),
  physical material, rim and glow lights, and a custom depth-of-field
  pipeline (`src/fin-dome/dof.ts`): a round golden-angle bokeh gather at
  quarter resolution composited over the sharp full-res render, plus a
  lens-haze pass. The backdrop glow and haze track the light's
  on-screen position.
- **Composition size:** 3840x2160 (4K), 30 fps, 180 frames (6.0 s, same
  length as the reference).
- **Loop:** the ring turns exactly one fin spacing over the 180
  frames, so version A loops seamlessly, as the reference does.

## Compositions

| ID | Version |
| --- | --- |
| `FinDome4K` | A: matches the reference (locked-off camera, same palette and motion) |
| `FinDomeOrbit4K` | B: same scene and palette, camera cranes up and orbits 40 deg around the near fins, levelling its roll and pulling focus |

Every look parameter (colours, glow, blur, camera start/end poses) is a
zod-typed prop, editable in Remotion Studio.

Geometry constants live in `src/fin-dome/constants.ts`, the scene in
`src/fin-dome/FinDome.tsx`, depth of field in `src/fin-dome/dof.ts`, and
the version B camera in `src/fin-dome/variants.ts`.

## Commands

```console
npm i
npm run dev                       # Remotion Studio

# 4K master
npx remotion render FinDome4K out/FinDome_A_4k.mp4 --codec=h264 --pixel-format=yuv420p --color-space=bt709

# 1080p delivery (renders the 4K composition at half scale)
npx remotion render FinDome4K      out/FinDome_A_reference_1080p.mp4 --codec=h264 --scale=0.5 --pixel-format=yuv420p --color-space=bt709 --image-format=png
npx remotion render FinDomeOrbit4K out/FinDome_B_orbit_1080p.mp4     --codec=h264 --scale=0.5 --pixel-format=yuv420p --color-space=bt709 --image-format=png
```

WebGL uses ANGLE (`remotion.config.ts`). On machines without a GPU it
falls back to SwiftShader, which is slow at 4K. If frames time out, add
`--timeout=240000 --concurrency=2`.
