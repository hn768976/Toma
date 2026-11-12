# QC Report: Emboss Circles and Tube Bloom

## Deliverables

| # | File | Composition (4K source) | Version |
|---|------|-------------------------|---------|
| 1 | `01_EmbossCircles_V1_Match_1080p.mp4` | `EmbossCircles-V1-Match` | V1: matches reference A |
| 2 | `02_EmbossCircles_V2_MidnightCopper_1080p.mp4` | `EmbossCircles-V2-MidnightCopper` | V2: new colour palette (midnight navy and copper) |
| 3 | `03_TubeBloom_V1_Match_1080p.mp4` | `TubeBloom-V1-Match` | V1: matches reference B |
| 4 | `04_TubeBloom_V2_LowOrbit_1080p.mp4` | `TubeBloom-V2-LowOrbit` | V2: new camera (low oblique, orbiting, shallow depth of field) |
| 5 | `EmbossCircles_4K_Remotion_Project.zip` | Remotion project, both A compositions at 3840×2160 | |
| 6 | `TubeBloom_4K_Remotion_Project.zip` | Remotion project, both B compositions at 3840×2160 | |

**Technology.** Both projects are built with the Remotion 4.0.539 CLI.

- **A** is a single WebGL 2 fragment shader. It draws signed-distance-field shapes, soft offset shadows and keyframed timing curves.
- **B** uses Three.js 0.178. Instanced tubes are bent along twisted torus loops in the vertex shader. A depth-of-field post pass adds blur, a vignette and grain.

Each video was rendered from its 4K composition with `--scale=0.5`, which produces 1920×1080.

## Technical checks (final files)

| Check | 01 | 02 | 03 | 04 |
|---|---|---|---|---|
| Codec / profile / pixel format | H.264 High yuv420p | same | same | same |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 | 30/1 | 30/1 | 30/1 |
| Frames / duration | 270 / 9.000 s | 270 / 9.000 s | 270 / 9.000 s | 270 / 9.000 s |
| Full decode errors | none | none | none | none |
| Black frames | 0 | 0 | 0 | 0 |
| Frozen frame transitions | 0 | 0 | 0 | 0 |
| Flicker events (luma spikes) | 0 | 0 | 0 | 0 |
| Mean-luma range | 238–252 | 28–43 | 118–172 | 112–168 |
| Loop seam, last frame to first (mean abs diff)¹ | 0.19 | 0.04 | 2.20 | 4.22 |
| Median frame-to-frame diff | 3.74 | 2.48 | 3.71 | 6.55 |
| Bitrate | 2.4 Mb/s | 2.7 Mb/s | 5.9 Mb/s | 7.8 Mb/s |
| Audio | none (references have none) | none | none | none |

¹ Every loop seam is at or below a normal frame step, so all four videos loop seamlessly.

**Duration note.** Each reference has 270 frames at 29.97 fps, which is 9.009 s. At the required 30 fps, the same 270 frames last exactly 9.000 s. This is a frame-for-frame match. Reaching 9.009 s would need a 270.27th frame, which cannot exist.

## Project ZIP checks

The checks below ran on fresh copies of both ZIPs:

- `unzip -t` found no errors.
- Each ZIP contains the full source, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, the ESLint and Prettier configs, `public/` and a README. `node_modules` and render outputs are excluded.
- Both are fully procedural, with no external media assets to go missing.

Each ZIP was then installed and rendered using only the commands in its README:

| Step | A | B |
|---|---|---|
| `npm ci` | ok | ok |
| `tsc --noEmit` | ok | ok |
| `remotion compositions` | 2 compositions at 3840×2160, 30 fps, 270 frames (9.00 s) | same |
| 4K still | 3840×2160 PNG | 3840×2160 PNG |
| 1080p test render (frames 0–29) | PSNR 57.1 dB against the delivered file | 50.4 dB (V2) |

The high PSNR values show that renders made from the ZIPs reproduce the delivered videos.

**Rendering environment.** Rendering needs WebGL. The config uses `swangle` (software WebGL), so it renders on machines without a GPU. On machines with a GPU, add `--gl=angle` to render faster. The config also picks up a locally installed Chrome Headless Shell when Remotion cannot download its own.

## Reference fidelity

An independent review agent compared side-by-side frame sheets and frame-difference strips against both references. Its findings went through two fix rounds. Round one fixed:

- the spin direction
- the stray squares at f74
- the bead shadow dot
- the lens at the start of the loop
- the weave mirroring
- seamless loops
- the hole timing
- the overall tone

Round two fixed:

- the f8–f9 lens-to-pair handoff pop (the step was reduced from 26 to 11 luma levels; the motion is now smooth)
- the end fade in V2
- uneven pacing in Tube Bloom (a stall followed by a burst)
- clipped highlights

Final reviewer scores and remaining notes are in the section below.

**V2 choices.**

- **Emboss Circles V2** keeps the identical motion and shapes but moves to a dark navy and copper palette. The shadows become deep, and the copper edges and rims glow warm. The change is unmistakable, and the concept is unchanged.
- **Tube Bloom V2** keeps the same bloom cycle and material but uses a low, oblique, slowly orbiting camera. The lens is wider, and depth of field falls off strongly toward the horizon. This shows the lattice as a 3D landscape instead of a flat top-down plane.

## Known limitations

- **A:** the shadows are slightly softer and wider than in the reference.
- **B:** the reference's crossing grooves form tighter nested-diamond "eyes" than this weave does. The tubes are also a little chunkier than the reference's fine grooves, and the rim of the hole shows slight segmentation when it is wide open.
- The stock-site watermark in reference B was intentionally not reproduced.
