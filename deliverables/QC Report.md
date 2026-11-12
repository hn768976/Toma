# Quality-control report

Two Remotion projects (created with the Remotion CLI, rendered with Three.js /
WebGL 2 and custom GLSL shaders), each with two 4K compositions, delivered as
four 1080p H.264 MP4 files plus two project ZIPs.

## Deliverables

| # | File | Composition (4K master) |
|---|------|-------------------------|
| 1 | `Version 1 - Neural Network Synapses (Reference Match) 1080p.mp4` | `NeuralNetwork-V1-Reference` |
| 2 | `Version 2 - Neural Network Synapses (Rose-Gold Amber Palette) 1080p.mp4` | `NeuralNetwork-V2-EmberPalette` |
| 3 | `Version 1 - Holographic Data Cubes (Reference Match) 1080p.mp4` | `DataCubes-V1-Reference` |
| 4 | `Version 2 - Holographic Data Cubes (Cyan-Amber Palette) 1080p.mp4` | `DataCubes-V2-CyanAmber` |
| 5 | `Neural Network Synapses - Remotion Project (4K compositions).zip` | both neural compositions |
| 6 | `Holographic Data Cubes - Remotion Project (4K compositions).zip` | both data-cube compositions |

Version 2 choice: an alternative **colour palette** for both. In both
references the camera move is the content of the shot (a continuous macro
drift; a choreographed single-take move), so the palette was changed and the
camera kept, which preserves the concept and makes the versions comparable
frame for frame.

## Technical checks (measured with ffprobe / ffmpeg on the final files)

| Check | Neural V1 | Neural V2 | Data Cubes V1 | Data Cubes V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Container | MP4 | MP4 | MP4 | MP4 |
| Resolution | 1920x1080 | 1920x1080 | 1920x1080 | 1920x1080 |
| Frame rate (r / avg) | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 |
| Frames decoded | 401 | 401 | 900 | 900 |
| Duration | 13.366667 s | 13.366667 s | 30.000000 s | 30.000000 s |
| Reference | 401 fr, 13.366667 s | same | 900 fr, 30.000000 s | same |
| Pixel format | yuv420p, BT.709, tv range | same | same | same |
| Audio | none (reference has none) | none | none | none |
| Decode errors (full decode) | 0 | 0 | 0 | 0 |
| Largest 1-frame luma jump | 2.10 | 2.09 | 2.09 | 1.62 |
| Black sections | none | none | 0-0.5 s and 26.6-30 s (intended, as in reference) | same |
| Frozen sections | none | none | only inside the black intro / end hold | same |
| File size | 67.3 MB | 61.8 MB | 83.5 MB | 78.5 MB |

For comparison, the references' largest 1-frame luma jumps are 14 (neural) and
2.4 (data cubes), so none of the renders contains a flash, pop or cut that the
reference does not have.

## Project ZIP checks

Both ZIPs pass `unzip -t`. Each contains the full source (`src/`), both 4K
compositions, `package.json`, `package-lock.json`, `remotion.config.ts`,
`tsconfig.json`, ESLint/Prettier config, `.gitignore` and a README with the
commands. Neither project needs external assets (geometry, textures and text
are generated in code); `node_modules` and render output are excluded.

Each ZIP was extracted into an empty directory and tested with the documented
commands:

| Step | Neural project | Data-cubes project |
|---|---|---|
| `npm install` | ok | ok |
| `npx remotion compositions` | 2 compositions, 3840x2160, 30 fps, 401 frames | 2 compositions, 3840x2160, 30 fps, 900 frames |
| 1080p clip render (`--scale=0.5`) | ok, H.264 yuv420p 1920x1080 30 fps | ok, H.264 yuv420p 1920x1080 30 fps |
| Native 4K still (`--scale=1`) | ok, 3840x2160 | ok, 3840x2160 |
| `tsc --noEmit`, `eslint src` | pass | pass |

Not done: a full-length native 4K video render of each composition (only 4K
stills and 1080p video were rendered; the code path is the same, the cost on
this CPU-only machine is roughly 4x the 1080p render time).

Render-environment note: on a headless machine without a GPU, add
`--gl=swangle` to the render commands (documented in each README). On this
machine Remotion could not download its own browser, so the pre-installed
Chrome Headless Shell was used via `REMOTION_BROWSER`.

## Independent visual review

A separate reviewer agent compared the renders with the references at matching
frame indices over three passes; its findings drove two rounds of fixes.

| File | Reviewer score | Verdict |
|---|---|---|
| Neural V1 | 4.5 -> 5.5 -> 6 / 10 | deliverable with caveats |
| Data Cubes V1 | 7 -> 8 / 10 | deliverable with caveats |
| Neural V2 | clearly distinct, same timing as V1 | deliverable with caveats |
| Data Cubes V2 | clearly distinct, same timing as V1 | deliverable as-is |

Fixed after review: neural depth of field, impulse clustering and bokeh,
hero-cell timing, tube faceting, and a hero cell that snapped in over half the
frame near frame 320 (luma jump 43, now 2.1); data-cubes ending, lattice
density and brightness, and a washed-out transition near frame 320.

### Known remaining differences from the references

Neural network (a loose match, not a frame-accurate one):
- The reference's two bright foreground sweeps (around frames 260 and 322-340)
  are not reproduced.
- Depth of field is shallower on mid/far filaments than in the reference.
- Dendrites read as smoother, less branching tubes than the reference's
  tapering, wet-looking ones; a few tube ends show small kinks
  (e.g. frames 120-125, 316-326).
- Hero-cell framing differs at frame 0 (top-centre vs centred) and frame 350.
- Version 2 is about 13 luma levels darker than Version 1 and its palette
  reads closer to dusty rose / maroon with amber than to bright rose-gold.

Data cubes:
- Lines and text are slightly crisper and thinner than the reference.
- The multi-cube section is a few luma levels brighter (56-60 vs 50-52) and
  the neighbour cubes are seeded, not copied one-to-one.
- The inner object at frame 360 and the end framing at frame 780 differ
  slightly.
- No depth of field in this project; softness comes from bloom.

Both: the stock watermark in the references is intentionally not reproduced.

### Not assessed

- Real-time playback on a display (shimmer on fine parallel lines, motion
  smoothness, banding on a calibrated monitor): checks were done on stills,
  consecutive-frame runs and per-frame luma curves.
