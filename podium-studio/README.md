# Podium Studio — 3D product-podium plates

Five dark-studio 3D product podium loops, built with **Remotion + three.js (WebGPU)**.
Each version corresponds to one supplied reference.

| Version | Composition | Length | Frames | Reference |
|---|---|---|---|---|
| V1 Slab | `V1-Slab-4K` | 12.00s | 360 | istock 2199961880 |
| V2 Cylinder | `V2-Cylinder-4K` | 12.00s | 360 | istock 2199961442 |
| V3 Wide disc | `V3-WideDisc-4K` | 40.00s | 1200 | istock 1138641437 |
| V4 Glass + beam | `V4-GlassBeam-4K` | 20.00s | 600 | istock 1487257611 |
| V5 Ringed | `V5-Ringed-4K` | 20.00s | 600 | istock 1487260677 |

All compositions are **3840×2160 @ 30fps**. Output is **H.264 / MP4 / yuv420p**.

## 4K master, 1080p deliverable

The compositions are authored natively at 4K. The 1080p files are rendered from
those same compositions with `--scale=0.5`, which maps 3840×2160 to exactly
1920×1080. There is no separate 1080p composition to keep in sync — layout and
motion have one source of truth.

```bash
npm install

# 1080p (the delivered files)
./render-all.sh

# full 4K
SCALE=1 OUT=out/4k ./render-all.sh

# a single composition at 4K
npx remotion render V1-Slab-4K out/V1-4k.mp4 --codec=h264 --pixel-format=yuv420p --crf=16

# interactive preview
npm run dev
```

## WebGPU

Rendering goes through three.js `WebGPURenderer` (`three/webgpu`). Remotion always
launches Chrome with `--enable-unsafe-webgpu`, so on a machine with a real GPU the
WebGPU backend is selected automatically.

`src/core/backend.ts` decides the backend. It does **not** simply check for
`navigator.gpu`, because that check passes in environments where WebGPU does not
actually work:

- A GPU-less container exposes a **software (SwiftShader) adapter**. It returns a
  valid adapter *and* a valid device, and `renderAsync()` resolves without
  throwing — but it never presents a frame. The canvas stays fully transparent and
  you silently render a blank movie.
- The probe must also avoid *creating* a device. When a software WebGPU device is
  lost it takes the shared GPU process down with it, after which
  `getContext('webgl2')` returns `null` and the WebGL2 fallback dies too.

So the probe inspects adapter metadata only — cheap and side-effect free — and
treats any software/fallback adapter as "no usable WebGPU", falling back to the
WebGL2 backend of the same `WebGPURenderer`. Same scene graph, same materials,
same output.

Override with `REMOTION_GPU_BACKEND=webgpu` or `REMOTION_GPU_BACKEND=webgl`.

> The delivered MP4s in `out/1080p/` were rendered in a GPU-less container and
> therefore went through the **WebGL2 fallback path**. On a GPU machine the same
> project renders through WebGPU with identical output.

## Structure

```
src/
  core/
    constants.ts   delivery spec: fps, 4K size, per-version durations
    Stage.tsx      hosts WebGPURenderer inside Remotion, frame-exact
    backend.ts     WebGPU-vs-WebGL2 capability decision
    studio.ts      cyclorama, contact shadows, glows, camera overlays
    textures.ts    canvas-generated gradients, dither, beam, ring maps
    easing.ts      deterministic easing + seeded PRNG
  versions/        one file per version, self-contained scene
```

### Frame-exactness

`Stage.tsx` drives everything off `useCurrentFrame()` — there is no
`requestAnimationFrame` loop and no wall-clock time in any scene. Every frame is
reproducible regardless of how fast the machine draws it. Because
`WebGPURenderer.renderAsync()` is a promise, each frame is wrapped in a
`delayRender()` handle so Remotion only screenshots once the GPU work resolved.

### How the look was matched

Camera and set proportions were solved from landmark positions measured directly
off the reference frames rather than eyeballed. For V1 the measured landmarks were
the wall/floor seam at 0.630 of frame height, the slab top-front edge at 0.632,
top-back at 0.551, front-bottom at ~0.764, and horizontal extent 0.169→0.828.
Solving those gives W:H:D = 3.72 : 0.463 : 1.0, a camera at (0, 2.363, 6.43)
pitched 13.8° down, and a back wall only ~0.5 units behind the podium — a
deliberately tight box set, which is what produces the signature halo.

The cyclorama is intentionally **unlit**: its falloff is baked into a canvas
gradient. That gives pixel-level control over the studio rolloff these plates live
or die on, and costs one texture fetch instead of a multi-light shading pass over
two large planes. Only the podium is actually lit.

Contact shadows and glows are shaped billboards rather than shadow maps and a
bloom pass — cheaper at 4K, and far more art-directable.

### Looping

V1 and V2 are **seamless loops** (the podium rises, settles, then retracts so the
first and last frames match), as in their references. V3, V4 and V5 are long,
calm plates; V5's floor rings use a 200-frame cycle that divides its 600-frame
duration exactly, so it also loops cleanly.
