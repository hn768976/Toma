# Sheet Music Motion — Remotion project (4K compositions)

Two compositions recreated from reference stock clips, each in two versions.
All compositions are authored at **3840×2160 (4K UHD), 30 fps**.
Final deliverables are rendered from these 4K compositions at 1080p with `--scale=0.5`.

| Composition ID | What it is | Tech | Frames | Duration |
| --- | --- | --- | --- | --- |
| `Comp1-V1-ScoreDolly` | Version 1 — matches reference: low grazing camera tracking along a vintage engraved grand staff, shallow depth of field, warm gold light pool, sepia grade | Three.js (`@remotion/three`) + custom WebGL 2 / GLSL 3 shader, Canvas 2D generated score texture | 601 | 20.033 s |
| `Comp1-V2-ScoreCraneOrbit` | Version 2 — alternative **camera move**: near top-down crane that orbits ~80° while descending into a grazing push-in with a rack focus | same | 601 | 20.033 s |
| `Comp2-V1-FloatingNotes` | Version 1 — matches reference: notes fading in/out and drifting at three focus depths over aged rosy staff paper, burnt vignette, flicker, grain | Canvas 2D | 599 | 19.967 s |
| `Comp2-V2-FloatingNotesCyanotype` | Version 2 — alternative **colour palette**: cyanotype / blueprint (Prussian-blue paper, pale ink, deep navy burn) | Canvas 2D | 599 | 19.967 s |

Reference clips run at 29.97 fps (20.020 s and 19.953 s). At exactly 30 fps the
closest whole-frame lengths are 601 and 599 frames (13 ms from each reference).

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- Remotion downloads its own Chrome Headless Shell on first render (internet needed once).
  Composition 1 needs WebGL 2; the project config uses the `angle` GL backend, which
  works with or without a GPU (falls back to SwiftShader on CPU-only machines).

## Commands

```console
npm ci                      # install exact locked dependencies
npm run dev                 # Remotion Studio preview

# Render a composition at native 4K (H.264 MP4)
npx remotion render Comp1-V1-ScoreDolly out/Comp1_V1_4K.mp4

# Render at 1080p from the 4K composition (as delivered)
npx remotion render Comp1-V1-ScoreDolly out/Comp1_V1_1080p.mp4 --scale=0.5

# Render all four 1080p deliverables into ./out
./render-all.sh
```

Codec (H.264), pixel format (yuv420p), CRF and JPEG frame quality are set in
`remotion.config.ts`.

## Structure

```
public/fonts/NotoMusic-Regular.ttf   bundled music font (SIL OFL 1.1, see OFL.txt)
src/Root.tsx                          the four 4K compositions
src/constants.ts                      resolution, fps, durations
src/shared/                           seeded RNG, font loader, Canvas 2D engraving primitives
src/score-dolly/                      Composition 1: score texture, camera paths, GLSL shaders
src/floating-notes/                   Composition 2: palettes, glyph sprites, paper/burn/grain, scene
render-all.sh                         renders the 4 deliverables at 1080p
```

All randomness is seeded, so every render is frame-for-frame deterministic.
No external images or videos are used; every texture is generated procedurally.
