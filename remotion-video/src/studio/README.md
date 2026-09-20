# White-studio podium backplates

Three photographic-style 3D product-podium backplates, built with **Remotion +
three.js + WebGPU (TSL node materials)**. Each one reproduces a supplied
reference clip.

| Variant | Composition ids | Duration | Reference |
|---|---|---|---|
| V1 — thin disc, warm greige studio | `PodiumDisc4K` / `PodiumDisc1080` | 7.40s (222f) | `istockphoto-1354114168` |
| V2 — square plinth, cool white studio | `PodiumSlab4K` / `PodiumSlab1080` | 16.80s (504f) | `istockphoto-1596392432` |
| V3 — cylinder, cool white studio | `PodiumCylinder4K` / `PodiumCylinder1080` | 16.80s (504f) | `istockphoto-1596376637` |

All six compositions run at **30fps**. The 4K compositions (3840×2160) are the
masters; the 1080p ones (1920×1080) are the same scene at a different raster,
so a 1080p render is a true downscale of the 4K framing, not a re-layout.

## Rendering

```bash
npm run render:all        # three 1080p H.264 MP4s into out/
npm run render:all-4k     # the same three at 3840x2160
npm run studio            # interactive preview
```

Both use `--color-space=bt709` (limited range, matching the references' own
tagging) and PNG intermediates — these gradients are flat enough that JPEG
intermediates would show artefacts.

## How the look was derived

Nothing here was eyeballed. The references were measured and the scene solved
to match:

- **Camera.** Reference podium silhouettes were measured as a percentage of
  frame, and the top-face ellipse ratio gave the camera elevation (≈3.9° for
  V2/V3). Focal length and height follow from those. All three references are
  **locked off** — podium bounds are pixel-identical across every frame — so
  the cameras here are static too.
- **Lighting.** Each reference was probed at fixed points (floor, backdrop,
  lit prop face, shadowed prop face), the sRGB values converted to linear and
  divided by albedo, and the ambient / key / fill terms fitted by least
  squares. The cool rig matches its six probes to **0.76 sRGB levels RMS**; the
  warm rig matches its eight to **1.29**.
- **Backdrop.** V1's backdrop measures warm (156,149,142) high up but a dead
  neutral (208,208,208) underfoot — a warm paper sweep standing on a white
  floor — so its tint blends with height. The tint is normalised to unit
  luminance so it shifts hue without disturbing the fitted exposure.
- **Gobo.** V2 and V3 share one animation: their wall-quadrant luminances agree
  to within 0.2 of a level at every timestamp, so they are the same shoot with
  a different prop. The bands were measured at **26.6° from horizontal with
  ~115px perpendicular spacing**, and the bright pool located as the
  brightness-weighted centroid of the backdrop's top decile. Note the in-plane
  rotation stored in `variants.ts` (78.94°) is *not* the on-screen tilt — it is
  the rotation that projects to 26.6°, solved rather than guessed.
- **Motion.** The references' gobos do not translate; they **undulate in
  place**, swinging regions by up to 18 levels. That is what is reproduced.

`spec.ts` documents every field. Re-measuring a render with the same code that
probed the references is how these values stay checkable.

## Seamless looping

Time enters the shader only as `sin(2π · phase)` where `phase = frame /
durationInFrames`, and every spatial frequency is an integer harmonic. Frame 0
and frame N are therefore identical by construction — measured seam difference
is 0.446 mean absolute luminance versus 0.442 for an ordinary frame step, i.e.
indistinguishable. All three clips loop cleanly.

## Architecture notes

**Why imperative three.js instead of react-three-fiber.** Remotion needs one
deterministic, fully-settled render per frame. Driving three directly makes
every frame `set uniforms → await renderAsync → continueRender`, with no
reconciler or animation loop that could land a frame early or late.

**Why it renders to an offscreen target.** Headless Chrome on a machine with no
GPU cannot back a WebGPU swap chain — it fails with `Could not find
SharedImageBackingFactory ... WebgpuSwapChainTexture` — so a presented canvas
screenshots as fully transparent. Rendering into a `RenderTarget` and blitting
the readback into a 2D canvas sidesteps presentation entirely, and has the side
benefit of being bit-deterministic: the frame Remotion captures is exactly the
frame the GPU produced, with no compositor in between.

**WebGPU vs WebGL.** `WebGPURenderer` falls back to its own WebGL2 backend when
`navigator.gpu` is absent. The TSL node graph is identical either way — only
the compiled shader language differs (WGSL vs GLSL) — so both paths produce the
same image. Pass `forceWebGL: true` to A/B them.

**three is pinned to 0.184.0.** r185+ unconditionally sets a `swizzle` field on
`GPUTextureViewDescriptor` that Chromium 141's Dawn rejects
(`Failed to read the 'swizzle' property ... not of type
'GPUTextureComponentSwizzle'`). 0.184 is the newest release without it. Once
the bundled Chrome is newer than the feature, this pin can be lifted.

## Using these as backplates

The podiums are deliberately empty and product-placement ready. To put
something on one, add a mesh to the scene in `rig.ts` at `y = podium.height`
(0.10 for V1, 0.62 for V2/V3), centred on the origin — the contact shadow and
cove occlusion in `shading.ts` are driven by the podium footprint SDF, so a new
prop needs its own entry in `footprintSdf` to cast correctly.
