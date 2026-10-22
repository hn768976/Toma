# Chess King — Remotion + Three.js

A 3D motion piece recreated from a reference clip: a gold king drops through a hazy
stage onto a reflective chessboard; the impact blasts the black army into the air,
the pieces hang in slow motion, then crash down around the king while the camera
pushes in for the hero shot.

- **Tech:** Remotion 4 (`create-video --three` template), React Three Fiber, Three.js
  (procedural lathe/extruded chess pieces, PBR materials, mirror board via `Reflector`,
  soft shadows, depth of field, bloom, film grain).
- **Compositions (authored at 3840×2160, 30 fps, 241 frames ≈ 8.03 s):**
  - `ChessKing-Reference` — gold king, black army, warm grey stage (matches the reference).
  - `ChessKing-PlatinumCrimson` — alternate colour grade: platinum king, crimson army,
    midnight-blue stage and cool lighting. Same choreography and camera.

## Commands

```console
npm i
npm run dev                         # Remotion Studio

# Final 1080p H.264 deliverables, rendered from the 4K compositions
npx remotion render ChessKing-Reference out/ChessKing-Reference-1080p.mp4 --scale=0.5
npx remotion render ChessKing-PlatinumCrimson out/ChessKing-PlatinumCrimson-1080p.mp4 --scale=0.5

# Full 4K master
npx remotion render ChessKing-Reference out/ChessKing-Reference-4k.mp4
```

`remotion.config.ts` uses the `swangle` (SwiftShader) GL backend so it renders on
machines without a GPU; switch to `"angle"` on a GPU host for much faster renders.
Set `REMOTION_BROWSER_EXECUTABLE` to use a locally installed Chrome Headless Shell.

## Layout

- `src/Root.tsx` – composition registry (4K, 30 fps).
- `src/ChessKing.tsx` – `ThreeCanvas` wrapper.
- `src/World.tsx` – stage, lights, board + reflection, king, army, flash, dust.
- `src/Effects.tsx` – post-processing (DOF, bloom, tone mapping, lens finish).
- `src/sim.ts` – deterministic choreography: time-warp (slow motion), ballistic
  flights that land in computed resting poses, bounce/roll settle, camera path.
- `src/geometry.ts` – procedural chess piece meshes and resting-pose solver.
- `src/palettes.ts` – the two colour palettes.
