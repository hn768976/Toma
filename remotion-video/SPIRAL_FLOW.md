# Spiral Flow — 3D abstract loop

A spiral-fluted sphere turning slowly under a hot core light, built with
Three.js (`WebGPURenderer`) and driven frame-by-frame by Remotion.

Delivered in two grades — **Violet** (matched to the supplied reference plate)
and **Blue** (electric royal blue sibling) — as a **6.000 s seamless loop at
30 fps**, mastered at **3840×2160** and delivered at **1920×1080**, H.264 / MP4.

## Compositions

| ID | Size | Frames | Notes |
|---|---|---|---|
| `SpiralFlow-4K-Violet` | 3840×2160 | 180 | Master. `meshDetail: 1.4` |
| `SpiralFlow-4K-Blue` | 3840×2160 | 180 | Master. `meshDetail: 1.4` |
| `SpiralFlow-1080-Violet` | 1920×1080 | 180 | Preview / direct 1080p render |
| `SpiralFlow-1080-Blue` | 1920×1080 | 180 | Preview / direct 1080p render |

180 frames at 30 fps is exactly 6.000 s — the same runtime as the reference
clip, which is 150 frames at 25 fps.

## Running it

```bash
npm install
npm run dev                 # Remotion Studio, live-tweak every prop
./render-all.sh             # both 4K masters -> out/master/
./deliver.sh                # 1080p deliverables -> out/deliver/
```

`render-all.sh` picks up a Playwright Chromium and software GL if it finds one,
which is what makes it work on a headless box. On a machine with a GPU you can
drop those flags entirely:

```bash
npx remotion render SpiralFlow-4K-Violet out/master/SpiralFlow_4K_Violet.mp4 \
  --codec=h264 --crf=15 --muted
```

## How the loop is built

The trick is that **nothing is re-computed per frame**. The surface is a radial
displacement over a sphere:

```
radius(a, p) = sphereRadius + amplitude(a) * lobe(psi)
psi          = p + twist * (a / PI)^twistPower
amplitude(a) = ribAmplitude * sin(a)^ribGrowth
lobe(psi)    = |cos(ribs * psi / 2)| ^ ribSharpness
```

`a` is the polar angle from the pole the flutes converge at, `p` the azimuth.
Raising `|cos|` to a power below 1 gives fat rounded tubes with thin creases
between them; amplitude vanishing at both poles is what tapers the tubes to
nothing exactly where they converge, which is what reads as the bright core.

Every term is invariant under `psi -> psi + 2*PI/ribs`. So spinning the finished
mesh about its pole by exactly **one rib period** over the 180 frames returns it
to its starting appearance — a rigid rotation, no morphing, no per-frame
geometry work. Every other motion (camera orbit, light breathing, dither seed)
is a full-cycle sinusoid in the normalised loop position, so it lands back on
its starting value too. Frame 180 is frame 0.

## Camera

The camera orbits at a fixed elevation and always aims at the sphere's centre.
Framing is a **lens shift** (`camera.setViewOffset`), not an off-centre aim:
sliding the principal point puts the convergence point where the reference has
it without skewing the perspective of the foreground tubes. `RIG.roll` turns the
sphere's limb in frame so it exits the top-left, leaving the backdrop wedge.

## Post chain

All TSL nodes, so it runs identically on either backend:

1. **Depth of field** — two Gaussian taps at different sigmas, cross-faded on a
   circle of confusion derived from the pass's view-Z. Reduced-resolution taps.
2. **Bloom** — the broad glow off the core.
3. **Vignette** — very gentle.
4. **Dither** — a sub-LSB of per-frame noise. Gradients this smooth band badly
   in 8-bit H.264 and this is the cheapest fix. Seeded from the wrapped frame,
   so it loops with everything else.

## WebGPU and the fallback

The renderer is `WebGPURenderer` from `three/webgpu`. On a machine with a GPU it
runs the **WebGPU** backend; the node materials and the whole post chain are
backend-agnostic.

`WebGPURenderer` already falls back to WebGL 2 when `navigator.gpu` is missing.
That is not enough on a headless Linux box with a software Dawn build: it hands
out a working adapter *and* device, and only fails when the canvas asks for a
swap chain — deep inside the backend, as an unhandled rejection no `try`/`catch`
around the renderer can see. So `src/spiral-flow/backend.ts` exercises the swap
chain first, at the real output size, and the answer picks the backend. Set the
`forceWebGL` prop to pin WebGL 2 when you want identical output across machines.

Which backend actually initialised is logged per render:
`[spiral-flow] three.js backend: webgpu | webgl2`.

## Props

| Prop | Default | What it does |
|---|---|---|
| `grade` | `violet` | `violet` or `blue` — see `palette.ts` |
| `meshDetail` | `1` (4K comps: `1.4`) | Polar grid density multiplier |
| `samples` | `4` | MSAA samples on the scene pass |
| `forceWebGL` | `false` | Pin the WebGL 2 backend |

## Files

```
src/spiral-flow/
  constants.ts     fps, duration, the two frame sizes
  palette.ts       the two colour grades
  surface.ts       the fluted-sphere geometry builder
  scene.ts         camera rig, lights, materials, post chain, per-frame update
  backend.ts       WebGPU swap-chain capability probe
  SpiralFlow.tsx   Remotion component — drives the scene off the frame clock
```

## Re-grading

`palette.ts` is the only file to touch for colour. Nothing is vertex-coloured —
the look comes from coloured lights on a near-white soft-touch material — so
changing a grade re-lights the shot rather than repainting it, and the shading
stays physically consistent. Add a key to `GRADES` and it shows up in the
schema's enum automatically.
