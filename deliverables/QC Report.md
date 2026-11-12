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
| Largest 1-frame luma jump | 3.83 | 3.33 | 1.88 | 1.54 |
| Mean luma (reference) | 61.4 (69.0) | 51.7 | 49.8 (44.3) | 41.9 |
| Black sections | none | none | 0-0.6 s and 26.6-30 s (intended, as in reference) | 0-0.7 s and 26.5-30 s |
| Frozen sections | none | none | only inside the black intro / end hold | same |
| File size | 51.9 MB | 44.9 MB | 79.4 MB | 75.0 MB |

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

Separate reviewer agents compared the renders with the references at matching
frame indices (side-by-side sheets, consecutive-frame runs, per-frame luma and
frame-difference statistics). The last full review covered all four files.

| File | Reviewer result | Verdict |
|---|---|---|
| Data Cubes V1 | 7 / 10, no defects found | deliverable with caveats |
| Data Cubes V2 | clearly distinct, same geometry and timing, no defects found | deliverable |
| Neural V1 | 4 / 10 on the previous render; reworked afterwards (see below) | loose match, see caveats |
| Neural V2 | clearly distinct, same geometry and timing as V1 | same caveats as V1 |

Client requests from the second round, checked by the reviewer on the final
data-cubes files:
- Multi-cube section (frames 400-780): cubes are axis-aligned on a regular
  grid; apparent skew is camera roll and perspective only. **Pass.**
- Opening (frames 40-150): reads clearly as a cube with corners and several
  faces visible. **Pass.**

Neural network: the reviewer rejected the previous render because foreground
tubes faded on in front of the lens over 2-5 frames (frames 245-248, 315-319)
with a visible dither weave, the background was too sharp and the picture too
dark. All four points were then changed: foreground tubes are now positioned
so they slide in from the frame edge, the dither dissolve is limited to the
last unit before the lens, far focus is softer, haze is brighter and impulses
are smaller. The final files were checked by the author on comparison sheets
and luma statistics (largest 1-frame step 3.8, previously 51), but **the final
neural render has not been re-scored by the independent reviewer.**

### Known remaining differences from the references

Neural network (a loose match in look and motion, not a frame-accurate one):
- Cell-body positions and sizes do not line up frame for frame with the
  reference.
- Filaments are smoother and more uniform than the reference's wet, irregular,
  glossy ones; cell bodies are cleaner spheres.
- Depth of field is still less shallow than the reference, and heavy near blur
  can show slight sample ghosting.
- Mean brightness is lower (61 vs 69); impulses are fewer and larger.
- Version 2 is about 10 luma levels darker than Version 1.

Data cubes:
- Cubes are crisper and more line-dense than the reference's softly glowing
  faces; chart panels are only loosely echoed.
- Slightly brighter overall (mean luma 50 vs 44).
- Framing is more centred than the reference in the opening, and the
  multi-cube camera positions are approximations per beat.
- No depth of field in this project; softness comes from bloom.

Both: the stock watermark in the references is intentionally not reproduced.

### Not assessed

- Real-time playback on a display (shimmer on fine parallel lines, motion
  smoothness, banding on a calibrated monitor): checks were done on stills,
  consecutive-frame runs and per-frame luma curves.
