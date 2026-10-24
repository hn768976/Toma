# Tube Bloom — two 4K Remotion compositions (Three.js / WebGL 2)

Two abstract 3D motion-graphics loops built with Remotion + Three.js, each in two
versions. Every composition is authored at **3840×2160 (4K UHD), 30 fps,
305 frames (10.1667 s)** — the exact frame count and duration of the references.

| Composition id | Description |
| --- | --- |
| `Ember-V1` | Composition 1, version 1 — glossy orange hooked tubes on black around a dark vortex core; rings spiral clockwise and drift inward down a narrowing horn, looping seamlessly (matches reference 1). |
| `Ember-V2` | Composition 1, version 2 — same design, look and flow; **new camera movement**: opens wide on the whole bloom, then slowly pushes in while arcing around the vortex axis. |
| `Pearl-V1` | Composition 2, version 1 — close-up of a ball of pearl-white hooks with violet curled tips on a lavender-grey studio backdrop, rolling at constant speed with shallow depth of field (matches reference 2). |
| `Pearl-V2` | Composition 2, version 2 — same shot, geometry and motion; **new colour palette**: cream-pearl hooks with coral tips on a sage-mint backdrop. |

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- npm
- A Chromium that Remotion can drive (Remotion downloads its own Chrome Headless
  Shell automatically on first render). No GPU is needed: rendering uses ANGLE /
  SwiftShader when no GPU is present.

## Install

```bash
npm ci
```

## Preview

```bash
npm run dev          # Remotion Studio
```

## Render

```bash
# Final deliverables: 1080p H.264 MP4s rendered from the 4K compositions
npm run render:1080            # all four, into out/
npm run render:ember-v1        # or one at a time (ember-v2, pearl-v1, pearl-v2)

# Full 4K UHD H.264 renders of the same compositions
npm run render:4k

# Any single composition by hand
npx remotion render Ember-V1 out/ember-4k.mp4               # 3840x2160
npx remotion render Ember-V1 out/ember-1080.mp4 --scale=0.5 # 1920x1080
```

Encoding defaults live in `remotion.config.ts`: H.264, `yuv420p`, CRF 16,
PNG intermediate frames, concurrency 2, ANGLE GL backend.

`--scale=0.5` renders the 4K composition natively at 1920×1080: the WebGL
canvas follows Remotion's device-pixel-ratio, and all blur sizes are defined
relative to frame height, so framing, depth of field and timing are identical at
both resolutions.

Rendering is CPU-heavy without a GPU (roughly 1–2 s per 1080p frame, about 4×
that at 4K, on a 4-core machine).

## How it works

- `src/Root.tsx` registers the four 4K compositions.
- `src/tube-bloom/TubeBloom.tsx` — the Remotion component. Builds a Three.js
  scene once, then renders deterministically per frame (no wall-clock time):
  scene → HDR multisampled render target → depth-of-field pass → canvas.
- `src/tube-bloom/cluster.ts` — procedural geometry. Rings of identical tubes:
  free-floating hooked arcs (Ember) or hooks rooted on a sphere (Pearl), with
  a vertex-colour gradient along each tube and flat cut caps.
- Motion is loop-exact: Ember's rings slide one ring spacing down a
  narrowing helical horn (fading in with a gamma-corrected alpha ramp, then
  sinking into the dark core) a whole number of times per 152.5-frame cycle;
  Pearl's ball turns a whole number of tube spacings per cycle. Both
  305-frame animations therefore loop seamlessly, like the references.
- `src/tube-bloom/dof.ts` — bokeh depth of field: a tile-max circle-of-confusion
  prepass, then a golden-angle "scatter-as-gather" blur, plus a soft-shoulder
  tone curve and sRGB encode.
- `src/tube-bloom/scenes.ts` — the four looks, camera shots and motion.

All assets are procedural; there are no external images, fonts or audio.
