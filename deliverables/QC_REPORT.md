# Quality-control report

There are two Remotion projects, each holding two 4K compositions. Each composition was rendered to a 1080p H.264 MP4.

## Deliverables

| # | File | Composition (3840×2160) | What it is |
|---|------|-------------------------|------------|
| 1 | `NeonPipes-V1-Reference-1080p.mp4` | `NeonPipes-V1-Reference` | Reference A matched: isometric neon pipe chain, navy/periwinkle/coral/yellow |
| 2 | `NeonPipes-V2-EmberTeal-1080p.mp4` | `NeonPipes-V2-EmberTeal` | Alternative **colour palette**: teal ground, amber bars, aqua wires, warm-white pulses |
| 3 | `SpiralBlooms-V1-Reference-1080p.mp4` | `SpiralBlooms-V1-Reference` | Reference B matched: pleated spiral blooms with shallow depth of field and bokeh |
| 4 | `SpiralBlooms-V2-DollyRackFocus-1080p.mp4` | `SpiralBlooms-V2-DollyRackFocus` | Alternative **camera move**: arcing dolly-in with roll, plus a rack focus from the left bloom to the main bloom |
| 5 | `neon-pipes-4k-remotion-project.zip` | Both Neon Pipes compositions | Source, config, lockfile, README |
| 6 | `spiral-blooms-4k-remotion-project.zip` | Both Spiral Blooms compositions | Source, config, lockfile, README |

**Technology choices.**
- **Neon Pipes:** Three.js on WebGL 2, using real geometry, soft PCF shadows, a custom GLSL light-pulse shader on the wires, bloom and screen-space floor stripes.
- **Spiral Blooms:** custom WebGL 2 shaders driven through Three.js. The bloom surfaces are evaluated on the GPU. Dot instances turn into bokeh discs when out of focus. Each bloom has its own depth-of-field layer with a thin-lens circle of confusion and a guard band beyond the frame.

**How the alternatives were chosen.**
- **Neon Pipes V2 changes the palette.** It is a graphic, colour-driven design, and the reference camera move (a slow track along the chain) is part of its identity.
- **Spiral Blooms V2 changes the camera.** It is a depth-of-field piece, so a dolly with a focus pull uses the scene's 3D depth in a way a palette swap would not.

## Technical checks

The automated checks are in `qc/qc_videos.py`, with full results in `qc/qc_results.json`.

| Check | NP V1 | NP V2 | SB V1 | SB V2 |
|---|---|---|---|---|
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Pixel format / colour | yuv420p, tv, BT.709 | same | same | same |
| Frame rate (r / avg) | 30/1 | 30/1 | 30/1 | 30/1 |
| Frames / duration | 270 / 9.000 s | 270 / 9.000 s | 270 / 9.000 s | 270 / 9.000 s |
| Full decode (`-xerror`) | no errors | no errors | no errors | no errors |
| Black frames (blackdetect) | none | none | none | none |
| Flicker (single-frame luma spike) | none (max step 0.17) | none (0.15) | none (0.23) | none (0.54, smooth dolly) |
| Frozen / duplicate frames | none | none | none | none |
| Transient pops (1–2 frame blobs) | none | none | none | none |
| Audio | none (the references have no audio) | none | none | none |
| Size | 7.9 MB | 8.0 MB | 7.1 MB | 8.4 MB |

**Duration.** Both references are 270 frames at 29.97 fps, which is 9.009 s. At exactly 30 fps no whole number of frames gives 9.009 s: 270 frames is 9.000 s and 271 frames is 9.033 s. All four videos use the reference's frame count of 270, which comes out 9 ms shorter than the reference.

**Loops.**
- **Spiral Blooms V1** repeats exactly every 90 frames, as the reference does.
- **Neon Pipes V1 and V2** loop seamlessly. The last-to-first step is the size of a normal frame step, as measured by the reviewer.
- **Spiral Blooms V2** is a one-way camera move and is not meant to loop.

## Project ZIP checks

- `unzip -t` reports no errors for either ZIP. The extracted files are byte-identical to the repository source.
- Each ZIP contains `src/`, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, eslint/prettier config, an empty `public/` folder and a `README.md` with the commands. All geometry is procedural, so no media assets are needed.
- A clean-room test was run on a fresh extract of each ZIP:
  - `npm ci` and `npm run lint` (eslint and tsc) both pass.
  - `remotion compositions` lists both compositions at 3840×2160, 30 fps, 270 frames.
  - The documented `npm run render:v1`, `render:v2`, `render:v1:4k` and `still` commands all succeed. The 4K command outputs 3840×2160.
  - The clean-room renders match the delivered videos at **46.7–48.4 dB PSNR** on all four. They are the same images apart from encoder noise.

## Independent verification against the references

A separate reviewer agent compared each video with its reference, frame by frame and with measurements. It made several passes, and every issue it raised was fixed and re-rendered before the final pass.

| Video | Final verdict | Notes |
|---|---|---|
| **NP V1** | **Accept, 8/10** | Matches the reference within about 10% on:<ul><li>stripe angle (−43° vs −41°), with identical 18.3 px spacing, fixed on screen</li><li>scale</li><li>pulse coverage</li><li>motion speed</li></ul>The loop is seamless. |
| **NP V2** | **Accept** | Clearly a different palette. The concept, motion and quality are preserved, and the pulses stand out against the wires. |
| **SB V1** | **Accept, 7/10** | Layout and palette match. It repeats every 90 frames like the reference, the loop seam is clean, and no transients were found at the reviewer's most sensitive setting. |
| **SB V2** | **Accept** | Clearly a different camera move, with the same look. The motion is smooth (the largest wobble around the eased path is about 0.2 px at 1080p) and the rack focus reads clearly. |

Issues found by the reviewer and fixed along the way:
- Neon Pipes:
  - The camera used too much perspective, moved too fast and did not loop.
  - The stripe direction was mirrored.
  - Colours, shadows and glow were off.
- Spiral Blooms:
  - It rotated as a rigid body instead of shimmering in place over a 90-frame cycle.
  - Single-frame flashes appeared at the frame edges. The root cause was bloom tips clipped at the edge of the blur layer, fixed with a guard band.
  - The centre disc and rib aliasing were visible.
  - The bokeh and colour balance were wrong.

Remaining small differences, none of them blocking:
- **Neon Pipes V1** sits about 60 px (at 768 px width) lower in frame than the reference, and its floor is slightly more saturated.
- **Spiral Blooms V1** has less crest glitter on the lower half of the focal bloom than the reference, and its top bokeh is slightly darker.
- **Both Spiral Blooms versions** show a faint sawtooth on the pleat ridges at 1080p.

## Checksums (SHA-256)

```
e631c05b86a69b98d997e63b4b9f3d5c59f4b99d16db77a61a5e3492917e5f73  NeonPipes-V1-Reference-1080p.mp4
7a808601d593ce2222e5a3bdcade207b41e459c985a13df59758e3cbe2489d5f  NeonPipes-V2-EmberTeal-1080p.mp4
ad07af55d23ec2be444cf224a38efab69c8ff29e905cb09246ea791286877658  SpiralBlooms-V1-Reference-1080p.mp4
bcf4dcba587f27c18535510ca45d4262b04adda42fdb4040a7400db9f08d822f  SpiralBlooms-V2-DollyRackFocus-1080p.mp4
32709db835e8b344952979bbbf0d69b8ab23cba34b40fdc4322707d6eedce5c3  neon-pipes-4k-remotion-project.zip
b9b90a67dfba062ccfc223ff22104a526cc8ba6a69857aa85b02f7dec21d73e0  spiral-blooms-4k-remotion-project.zip
```
