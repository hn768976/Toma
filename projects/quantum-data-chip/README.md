# Quantum Data Chip — Remotion project (4K UHD)

A glowing processor chip ignites on a dark circuit plane. A "fader" data lane
draws out of it in both directions, and dense waveform data bands, memory-cell
clusters and amber sparks fill the plane under a shallow depth of field.

| Composition | Description | Resolution | FPS | Frames | Duration |
|---|---|---|---|---|---|
| `QuantumDataChip-V1` | Matches the reference: navy / cyan-blue, amber sparks | 3840×2160 | 30 | 301 | 10.033 s |
| `QuantumDataChip-V2` | Alternative **colour palette**: "Ember Gold" (molten amber data, cyan sparks) with the same motion and camera | 3840×2160 | 30 | 301 | 10.033 s |

## Technology

* **Remotion 4** (CLI) hosts the composition. Each frame is a pure function of
  `frame / fps`, so frames can render in any order and in parallel.
* **Three.js (WebGL 2) with custom GLSL shaders**:
  * `engine/SegmentBatch.ts`: one instanced draw call for tens of thousands of
    analytically anti-aliased bars and lines lying on the ground plane. Reveal,
    growth, twinkle and fade-out are animated on the GPU.
  * `engine/SpriteBatch.ts`: camera-facing sparks, dust and chip glow.
  * `engine/PlaneDofPass.ts`: tilt-shift depth of field. Depth is computed
    analytically from the ground plane, then blended through four gaussian blur
    levels.
  * `UnrealBloomPass` for glow, and `engine/GradePass.ts` for the vignette,
    linear→sRGB conversion and anti-banding dither.
* Blur and glow sizes are fractions of the frame height, so the 4K render and the
  1080p render (`--scale=0.5`) look identical.
* No external assets: everything is procedural and seeded, so renders are
  deterministic.

## Commands

```bash
npm install            # or: npm ci  (package-lock.json is included)
npm run dev            # Remotion Studio preview

# Final delivery renders (1080p H.264 MP4, rendered from the 4K composition):
npm run render:v1:1080p   # -> out/v1-1080p.mp4
npm run render:v2:1080p   # -> out/v2-1080p.mp4

# Full 4K UHD renders:
npm run render:v1:4k      # -> out/v1-4k.mp4
npm run render:v2:4k      # -> out/v2-4k.mp4

# Single 4K still:
npx remotion still QuantumDataChip-V1 out/still-4k.png --frame=300
```

`remotion.config.ts` sets H.264, yuv420p, CRF 16, PNG intermediate frames and
`--gl=swangle`: software WebGL that works on any machine, with or without a GPU.
On a GPU machine, add `--gl=angle` to the render command for faster renders.
If Remotion cannot download its Chrome Headless Shell (for example on an
offline machine), set `REMOTION_BROWSER_EXECUTABLE` to a local
chrome-headless-shell.

Requires Node.js 20.19+ or 22.13+.
