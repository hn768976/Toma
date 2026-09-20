# Chip Activation — 3D title sequences

Three 16:9 sequences of a processor descending into a socket, seating, and
powering the board around it — one per reference clip. Built with
**Remotion + three.js (WebGPURenderer + TSL)**.

| Composition | Look | Duration | Frames @ 30fps |
|---|---|---|---|
| `V1-4K` / `V1-1080p` | Dark navy PCB, high angle, dense cyan data streams | 9.60s | 288 |
| `V2-4K` / `V2-1080p` | Bright white studio board, pastel glass parts, iridescent package | 8.03s | 241 |
| `V3-4K` / `V3-1080p` | Near-black board, bright silver socket, cyan beams and a hard flash | 8.03s | 241 |

Durations match the reference clips, which were 25fps; the frame counts above
are those same running times re-timed to 30fps. All three are silent, as the
references are.

## Quick start

```bash
npm install

# interactive studio
npm run studio

# render the 1080p deliverables (all three)
npm run render:1080

# render the 4K masters (all three) — much slower
npm run render:4k

# one version only
node scripts/render.mjs 1080 v2

# a single frame, for look development
node scripts/render.mjs still v3 195
```

Output lands in `out/`.

## Layout

```
src/
  Root.tsx              compositions: 4K + 1080p for each version
  themes.ts             ALL per-version art direction lives here
  timeline.ts           seconds -> FrameState, the animation's only clock
  engine/
    stage.ts            WebGPURenderer setup, offscreen render + blit
    WebGPUStage.tsx     bridges Remotion's frame clock to the renderer
    rng.ts, easing.ts   deterministic helpers
  scene/
    buildScene.ts       assembles everything, owns update()
    board.ts            PCB planes + the TSL energy wave
    parts.ts            instanced SMD components, capacitors, headers
    socket.ts           LGA socket
    chip.ts             package, die, "AI" label, light shafts
    energy.ts           streams, rays, shockwaves, halftone, motes
    lighting.ts         three-point rig
    camera.ts           keyframed camera with handheld drift
    post.ts             DOF, bloom, tone map, grade
    textures.ts         every texture, drawn procedurally
scripts/
  render.mjs            render driver (programmatic Remotion API)
  preview.mjs           fast look-dev harness, bypasses Remotion
  chrome-webgpu.sh      Chrome launcher shim (see below)
```

### Changing the look

`src/themes.ts` is the single place to edit. Each version is one object
covering palette, materials, lighting, camera keyframes, grade and beat
timings. Nothing else is version-specific.

### Changing the label

The "AI" on the die is drawn from explicit vector paths in `drawAI()` in
`src/scene/textures.ts` — not from a system font, so it is identical on every
machine and at every resolution. Edit that function to change the lettering.

## Determinism

Every frame is a pure function of its timestamp:

- one seeded PRNG (`engine/rng.ts`) drives all layout — component placement,
  trace routing, ray angles, dust motes;
- `timeline.ts` derives the whole scene state from `seconds` alone, with
  nothing carried between frames;
- no `Date.now()`, no `Math.random()`, no TSL `time` node at render time;
- textures are drawn in normalised coordinates, so the 4K and 1080p
  compositions lay out identically and differ only in texel density.

That is what makes it safe for Remotion to render frames out of order across
several browser tabs, and it means the 1080p files are natively rendered
rather than downscaled from the 4K masters.

## Rendering with WebGPU: what it takes

three.js `WebGPURenderer` needs a real WebGPU adapter inside headless Chrome.
Several things quietly prevent that, and when they do, three.js silently falls
back to its WebGL backend and then dies with an unhelpful
`cannot read getSupportedExtensions of null`. `engine/stage.ts` checks the
preconditions up front and fails with an explanation instead.

The working configuration:

1. **A full Chrome, not `chrome-headless-shell`.** Remotion launches the shell
   with `--headless=old`, which has no GPU process. `scripts/render.mjs` sets
   `chromeMode: 'chrome-for-testing'` to get `--headless=new`.
2. **`enableMultiProcessOnLinux: true`.** Otherwise Remotion adds
   `--single-process`, which also removes the GPU process.
3. **No `--no-zygote`.** Remotion always passes it and offers no way to turn
   it off; without the zygote Chrome cannot bring up the GPU process.
   `scripts/chrome-webgpu.sh` strips the flag and execs the real browser.
4. **`--enable-unsafe-swiftshader`** on machines with no GPU, so Chrome will
   expose an adapter backed by its bundled SwiftShader. The shim adds it; it
   is a no-op where real hardware is present.
5. **`gl: 'swangle'`** (`--use-gl=angle --use-angle=swiftshader`). The obvious
   choice for WebGPU looks like `angle-egl`, but that needs a system
   `libEGL.so.1`; without one ANGLE fails to initialise and the GPU process
   exits. Override with `REMOTION_GL=vulkan` on a box with a real GPU.

Point Remotion at the shim:

```bash
export REMOTION_BROWSER_EXECUTABLE=$PWD/scripts/chrome-webgpu.sh
export CHROME_BIN=/path/to/chrome            # optional; autodetected
export REMOTION_CONCURRENCY=3                # tabs; SwiftShader is CPU-bound
npm run render:1080
```

### Offscreen rendering

The scene is drawn into a WebGPU render target and the readback is blitted
into a 2D canvas, rather than being presented through a WebGPU canvas
context. Presenting needs a SharedImage backing that supports WebGPU, which
headless Chrome on a software rasteriser does not have — it logs
`Could not find SharedImageBackingFactory ... WebgpuSwapChainTexture` and then
drops the WebGPU instance mid-frame. Rendering to a texture sidesteps the
swapchain, costs one readback per frame, and guarantees the pixels Remotion
screenshots are exactly the pixels the GPU produced.

On hardware with a real GPU this path still works unchanged.

### Performance

Software rasterisation is the bottleneck, not the scene. On a 4-core
container with SwiftShader, steady state is roughly **3.8s per 1080p frame**
after the first frame of a tab (which also compiles shaders). 4K is about four
times that. On a machine with a real GPU, expect interactive rates.

## Known backend quirks worked around

- `InstancedMesh.setColorAt()` / `instanceColor` is ignored by node materials
  on this backend, and its presence also suppresses `material.color`, leaving
  every instance white. `parts.ts` and `energy.ts` feed explicit instanced
  attributes into `colorNode` instead.
- `scene.environment` must be PMREM-filtered. Assigning a raw texture leaves
  metals with nothing to sample across roughness mips and they render black.
- three's `DepthOfFieldNode` blows out to white here and costs five
  full-screen passes; `post.ts` uses a CoC-masked gaussian blur instead.
- `smoothstep()` with `edge0 > edge1` is undefined in WGSL — it does not flip
  the ramp. Every falling edge is written as a rising smoothstep inverted
  with `.oneMinus()`.
- `RenderPipeline.renderAsync()` is deprecated and throws
  `Instance dropped in popErrorScope` on teardown; use `render()` and await
  `device.queue.onSubmittedWorkDone()` for the frame fence.
- WebGPU pads `copyTextureToBuffer` rows to a 256-byte stride, so readback
  buffers are not always `width * height * 4`. Both delivery widths happen to
  be aligned; preview widths often are not, and a wrong stride shears the
  image.
