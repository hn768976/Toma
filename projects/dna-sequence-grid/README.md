# DNA Sequencing Grid — Remotion project (4K)

An endless sequencing-gel plane: lanes of glowing bars and thin bands seen
through a long lens with shallow depth of field, slowly trucking sideways while
the bands slide and pulse inside their lanes.

| Composition ID | Version | Size | FPS | Frames | Duration |
|---|---|---|---|---|---|
| `DnaSequence-V1-Match` | V1: matches the reference | 3840×2160 | 30 | 751 | 25.033 s |
| `DnaSequence-V2-FluorescentPalette` | V2: alternative colour palette | 3840×2160 | 30 | 751 | 25.033 s |

**V1** reproduces the reference: steel-blue / white bars with grey-blue
variants and rare red and cyan calls, near-black background, camera ~38°
above the plane, lateral truck to the right with a gentle forward drift.

**V2 (colour palette)** keeps the exact same camera, layout and motion but
recolours the read-out with a four-dye fluorescent sequencer palette
(emerald / azure dominant, amber and magenta base calls) on deep teal-black.
A palette change suits this piece best: the reference's camera is a slow,
almost static observational move, and the bars are colour-coded data, so a
colour remap changes the feel completely while preserving the concept.

## Technology
- Remotion 4 (scaffolded with `npx create-video@4.0.515 --blank`)
- Raw WebGL 2 fragment shader (`src/dna/shader.ts`) that ray-casts the plane.
  Every bar is an analytic rectangle; anti-aliasing and depth of field are
  computed by box-filtering each rectangle with the pixel footprint plus the
  circle of confusion, so focus falloff is noise-free and flicker-free.
- CSS bloom pass (low-res copy, blurred and screened on top)
- Deterministic integer hashing: identical output on every render worker

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
(SwiftShader) GL backend so it renders without a GPU; add `--gl=angle` on a
GPU machine for much faster renders. No external assets are needed.

## Files
```
src/Root.tsx               compositions (4K, 30 fps, 751 frames)
src/dna/DnaSequence.tsx    component: WebGL 2 setup, camera keys, palettes, bloom
src/dna/shader.ts          the GLSL ES 3.00 shader
src/lib/spline.ts          monotone cubic interpolation
```
