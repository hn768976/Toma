# Cell Division

A 3D cell-division (binary fission) motion graphic: one fuzzy cell splits
into two, those split again, and the exponential doubling carries on until
the frame is packed — shot with a shallow lens that pushes slowly in.

Built on **three.js r186** driven through Remotion. Shading is written once
in **TSL**, so the same source compiles to WGSL on the **WebGPU** backend
and to GLSL on the **WebGL2** fallback.

## Compositions

| Composition ID | Grade | Resolution |
| --- | --- | --- |
| `CellDivision-Mono-1080p` | Mono (reference match) | 1920×1080 |
| `CellDivision-Mono-4K` | Mono (reference match) | 3840×2160 |
| `CellDivision-Blue-1080p` | Bright blue | 1920×1080 |
| `CellDivision-Blue-4K` | Bright blue | 3840×2160 |
| `CellDivision-Violet-1080p` | Bright violet | 1920×1080 |
| `CellDivision-Violet-4K` | Bright violet | 3840×2160 |

All six are 30fps, 331 frames (11.03s), no audio.

The scene is described entirely in world units and shaded analytically, so
the 4K compositions are the *same* render at twice the resolution — not a
re-tuned variant. Nothing is baked to a pixel size.

## Rendering

```console
npm i

# 1080p delivery master
npx remotion render CellDivision-Mono-1080p out/mono-1080p.mp4 \
  --codec=h264 --crf=16 --jpeg-quality=95

# 4K master
npx remotion render CellDivision-Mono-4K out/mono-4k.mp4 \
  --codec=h264 --crf=16 --jpeg-quality=95
```

4K is roughly 4× the cost of 1080p per frame. On a machine with a real GPU
the WebGPU backend is used automatically; in a headless container it falls
back to WebGL2, which is considerably slower but pixel-equivalent.

Open the Studio with `npm run dev` to scrub, retheme, or reseed. Each
composition exposes `theme`, `seed` and `backend` as editable props, and
the Studio overlays which backend actually came up (bottom-left). That
overlay is development-only and never appears in a render.

## How it is put together

| File | Role |
| --- | --- |
| `colony.ts` | The fission model. Builds the whole binary tree up front from a seed; a cell's position at time *t* is a closed-form function of its own record and *t*. |
| `cellMaterial.ts` | The TSL node material — billboarded sphere impostors with per-cell depth of field, a fuzzy silhouette, rim light and aerial haze. |
| `background.ts` | The backdrop gradient, evaluated per pixel with a dither so long ramps do not band in 8-bit H.264. |
| `scene.ts` | Camera path, focal plane, per-frame instance buffers and back-to-front sorting. |
| `renderer.ts` | WebGPU bring-up with a real render probe, and the WebGL2 fallback. |
| `themes.ts` | The three grades. Everything that differs between versions lives here. |
| `CellDivision.tsx` | The Remotion component: `delayRender` around an async `renderAsync` per frame. |

### Determinism

Remotion renders frames out of order across worker tabs, so nothing may
carry between frames. The colony is built from a seeded PRNG
(`random.ts`), and `scene.setFrame(n)` is a pure jump — it never reads the
previous frame's state. Re-rendering any frame in isolation reproduces it
exactly.

### Why billboards rather than sphere meshes

The defining feature of the look is a very shallow depth of field. Shading
an analytic sphere inside a camera-facing quad lets every cell carry its
own circle of confusion in the fragment shader: the blur is correct
per-cell even where cells overlap, it costs one quad per cell instead of a
tessellated mesh, and it needs no depth-buffer post-pass. The cells are
drawn back-to-front with depth testing off, so draw order *is* the
occlusion.

Foreground bokeh is rendered semi-transparent and background bokeh is not,
which is what real defocus does — and it is what stops a packed frame from
dissolving into a mush of overlapping ghost outlines.
