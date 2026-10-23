# Composition 1 — Microbe Field (Remotion · Canvas 2D)

A brightfield-microscope shot of filamentous, looping micro-organisms
wriggling on a grey-blue slide, recreated procedurally from a 30.03 s
reference clip.

| Composition ID                 | Version | Look                                                        |
| ------------------------------ | ------- | ----------------------------------------------------------- |
| `MicrobeField-V1-Brightfield`  | V1      | Matches the reference: grey-blue brightfield, slate tubes   |
| `MicrobeField-V2-Fluorescence` | V2      | Alternative colour palette: fluorescence / dark-field green |

- Master resolution: **3840×2160 (4K UHD)**, 30 fps, 901 frames (30.033 s;
  the reference is 30.03 s — 901 frames is the nearest exact 30 fps length).
- Rendered entirely with the Canvas 2D API (`src/microbes/`): no image or
  video assets, so nothing external is required.
- Deterministic: every frame is a pure function of the frame number.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- Remotion downloads its own Chrome Headless Shell on first render.

## Commands

```console
npm install
npm run dev            # Remotion Studio preview
npm run render:v1      # out/Composition1_V1_Brightfield_1080p.mp4  (4K comp, scaled 0.5 → 1080p)
npm run render:v2      # out/Composition1_V2_Fluorescence_1080p.mp4
npm run render:v1:4k   # full 4K master render
npm run render:v2:4k
npm run lint
```

Encoding defaults (H.264, CRF 18, yuv420p, BT.709, PNG intermediates) are
set in `remotion.config.ts`.

## Source layout

- `src/Root.tsx` — the two 4K compositions
- `src/microbes/MicrobeField.tsx` — per-frame canvas renderer (layers, blur,
  vignette, grain, stage drift)
- `src/microbes/worms.ts` — filament layout and curvature-integrated
  centerlines (hooks, loops, figure-eights, coils, travelling wriggle)
- `src/microbes/palettes.ts` — V1 brightfield and V2 fluorescence palettes
- `src/microbes/textures.ts` — cached procedural textures (slide mottling,
  grain, debris)
