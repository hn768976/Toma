# Glass Lattice

A 3D motion graphic: a woven lattice of bevelled glass diamonds raking through a
key light, dissolving into fog on the far side. Built with **three.js
(WebGPURenderer + TSL node materials)** and rendered through the **Remotion
CLI**.

Two variants ship from the same scene:

| Variant | Look |
| --- | --- |
| `Blue` | Matches the supplied reference — lattice on the left, cool blue neon. |
| `VioletMirror` | Horizontally flipped (lattice on the right), dark violet palette. |

## Specs

* 3840 × 2160 (mastering) and 1920 × 1080 (delivery)
* 30 fps, 300 frames = **10.000 s**, seamless loop
* H.264 / MP4, yuv420p, no audio track

## Compositions

| ID | Size |
| --- | --- |
| `GlassLattice-Blue-4K` | 3840 × 2160 |
| `GlassLattice-VioletMirror-4K` | 3840 × 2160 |
| `GlassLattice-Blue-1080p` | 1920 × 1080 |
| `GlassLattice-VioletMirror-1080p` | 1920 × 1080 |
| `GlassLattice-Preview` | 640 × 360 — same framing, for fast iteration |

## Usage

```bash
npm install

# Interactive preview
npm run dev

# Renders
npm run render:blue-1080p
npm run render:violet-1080p
npm run render:blue-4k
npm run render:violet-4k
```

Or drive the CLI directly:

```bash
npx remotion render GlassLattice-Blue-4K out/blue-4k.mp4 --codec=h264
```

## Renderer

The scene is written against `three/webgpu`'s `WebGPURenderer`, with TSL node
materials and node-based bloom post-processing. The same node graph runs on
either backend, so the two produce visually equivalent output.

`src/three/backend.ts` chooses between them:

| `REMOTION_RENDERER_BACKEND` | Behaviour |
| --- | --- |
| unset / `auto` | WebGPU in Studio and the browser, WebGL2 for headless CLI renders |
| `webgpu` | Always WebGPU — use this when rendering on a machine with a real GPU |
| `webgl` | Always the WebGL2 fallback |

The `auto` default is deliberate. A GPU-less headless Chromium still advertises
`navigator.gpu` and lets `WebGPURenderer.init()` resolve, and then **crashes the
renderer process** when the swap chain cannot be backed — so probing for an
adapter is not enough to rule WebGPU out, and the safe assumption for a headless
render is WebGL2.

`remotion.config.ts` sets `swangle` as the Chromium GL renderer, which is what
makes the software path work headlessly. On a GPU box, `--gl=angle` is much
faster.

If Chromium cannot be downloaded (restricted network), point Remotion at a local
build:

```bash
npx remotion render GlassLattice-Blue-4K out/blue-4k.mp4 \
  --browser-executable=/path/to/chrome
```

## Layout of the scene

| File | Responsibility |
| --- | --- |
| `src/three/lattice.ts` | The extruded rounded-diamond frame and the woven grid. |
| `src/three/environment.ts` | PMREM studio environment — the source of the glass reflections. |
| `src/three/animation.ts` | Pose per frame. Every term is periodic over the 300-frame loop. |
| `src/three/scene.ts` | Renderer, materials, lights, fog, bloom. |
| `src/GlassLattice.tsx` | Drives one deterministic three.js render per Remotion frame. |
| `src/theme.ts` | The two palettes and the props schema. |

## Why it loops

`motionAtFrame()` expresses every animated value as `sin`/`cos` of
`frame / 300`, so frame 300 is identical in pose to frame 0. There is no
`requestAnimationFrame` loop anywhere — each Remotion frame renders exactly one
deterministic three.js frame, which is what keeps the render frame-accurate.
