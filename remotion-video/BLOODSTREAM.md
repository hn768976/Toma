# Bloodstream — six 3D versions

Six red-blood-cell flythroughs built with **Remotion + three.js**, rendering
through **WebGPU where it works and WebGL2 otherwise**. Each version matches one
supplied reference clip in look and in length; all six run at **30 fps** and are
delivered as **H.264 / MP4**.

Every composition is registered twice — 1080p and 4K — from the same component
and the same duration, so the 4K master is the identical shot at four times the
pixels, not a separate edit.

## The six versions

| Composition | Reference | Length | Frames | Motion | Look |
|---|---|---|---|---|---|
| `V1-Obsidian` | de3308e7 | 10.03 s | 301 | Toward camera | Near-black field, packed with rim-lit cells from frame 0 |
| `V2-VesselCore` | 022d81ce | 18.53 s | 556 | Left → right | Dense crossing flow, minimal horizontal light blended into the background |
| `V3-CrimsonGold` | be5b4ffd | 18.04 s | 541 | Out of the upper left | White corner light, cells streaming from it, gold-speckled |
| `V4-Luminous` | 89469653 | 19.63 s | 589 | Turning in place | Dark red field, cells holding position and slowly spinning |
| `V5-DeepField` | 8f4c18de | 17.05 s | 511 | Toward camera | Wide field of many small cells, light sunk into the background |
| `V6-EmberBokeh` | 617f6ddf | 10.01 s | 300 | Right → left | Muted ember field, crisp sparkle |

Add `-4K` to any id for the 3840×2160 composition (`V2-VesselCore-4K`).

Two notes on how the reference durations were read:

- The references run at 25, 30 and variable frame rates. Durations above are the
  reference **wall-clock** lengths re-expressed at 30 fps.
- **Reference 5 is not a 34 s shot.** It is 17.05 s of colour footage followed by
  17.05 s of its own black-and-white alpha matte — a standard stock "with alpha"
  asset. V5 is therefore delivered as the 17.05 s colour clip, with the matte
  available as its own composition: `V5-DeepField-Matte` (and `-Matte-4K`).

None of the six references loop seamlessly — measured by comparing each clip's
first and last frames against a mid-clip baseline — so all six versions are
one-way flythroughs with hard in and out points, matching them.

## Rendering

```bash
npm install

node scripts/render.mjs                    # all six, 1080p → out/deliverables
node scripts/render.mjs --uhd              # all six, 4K
node scripts/render.mjs V2 V5              # just those two
node scripts/render.mjs --matte            # include the V5 matte pass
node scripts/render.mjs --uhd --concurrency=8
```

Delivery settings are fixed in `scripts/render.mjs` so the set stays consistent:
H.264, CRF 16, `x264` preset `slow`, JPEG frame capture at quality 95,
`yuv420p` / BT.709, and no audio track.

Two of those deserve a note. A JPEG frame pipeline tags output `yuvj420p`
(full range) by default, which shifts levels when the file lands in an NLE —
hence the explicit `pixelFormat`/`colorSpace`. And without `muted: true`,
an empty AAC track gets muxed in.

For interactive work: `npx remotion studio`.

To dial in a look without re-bundling each time:

```bash
node scripts/stills.mjs '[{"id":"V1-Obsidian","frame":60}]'
```

### 4K

The 4K compositions are registered and ready; render them with `--uhd` on a
machine with a GPU. On a software renderer 4K is roughly four times the
per-frame cost of 1080p — workable, but slow enough that it wants real
hardware.

## Rendering backends

`AdaptiveThreeCanvas` negotiates the backend once per render page:

1. **WebGPU** — via `ThreeWebGPUCanvas` from `@remotion/three/webgpu`, which
   synchronises with the GPU each frame.
2. **WebGL2** — via `ThreeCanvas`, with `preserveDrawingBuffer` so Remotion can
   screenshot the canvas after the draw call returns.

Selection is not based on `navigator.gpu` being defined. Chrome exposes that
namespace on machines where `requestAdapter()` then returns null, *and* on
machines where it returns an adapter that fails on the first real frame. So the
probe requests an adapter and then renders a textured quad through a throwaway
8×8 WebGPU renderer; only if that succeeds does the real canvas use WebGPU.

Pin the backend to compare them:

```bash
node scripts/stills.mjs '[{"id":"V1-Obsidian","frame":60,"props":{"backend":"webgl2","showBackend":true}}]'
```

`showBackend: true` prints the live backend into the corner of frame.

Both backends are set up identically — no post-processing passes and no shader
injection — so they produce the same image and the fallback is a performance
decision, not a visual one.

**On WebGL1:** three.js removed its WebGL1 renderer in r163, so on a WebGL1-only
host there is no renderer left to construct. That case is detected and reported
with an actionable message (pin three to 0.162.x, or render on a WebGL2 host)
rather than failing obscurely. Every browser that can run a Remotion render
today has WebGL2.

**Known incompatibility:** three r186's WebGPU backend stamps a `swizzle` field
onto every `GPUTextureViewDescriptor`, which current Chromium rejects
(`Failed to read the 'swizzle' property`). On such a host the smoke test fails
and the render proceeds on WebGL2 — which is exactly what happens in this
project's own render container, whose only WebGPU adapter is a software one.

## How a scene is built

```
src/blood/
  looks.ts               6 look presets — palette, populations, camera, grade
  BloodFlow.tsx          composition root: 3D passes + grade
  Scene.tsx              contents of the canvas
  AdaptiveThreeCanvas    WebGPU/WebGL2 negotiation
  CellField.tsx          instanced tumbling cells
  Motes.tsx              plasma sparkle / bokeh
  Vessel.tsx             vessel wall + core glow
  Rig.tsx                camera motion and lighting
  Grade.tsx              bloom, tint, vignette, grain
  flow.ts                the drift model shared by cells and motes
  assets.ts              procedural geometry and canvas textures
  useGlbGeometry.ts      loads the supplied .glb
  rng.ts                 seeded randomness
```

**Nothing is out of focus, and no two cells ever touch.** Both are guarantees of
the model rather than settings, and they are the reason it looks the way it
does — see below.

**Cells.** The supplied `public/models/rbc.glb` is used for the foreground
population. Despite its filename it is a genuine biconcave disc — centre
half-thickness 0.13 rising to 0.64 at the rim — so it drops straight in as a red
blood cell. The background swarm runs a much cheaper lathed cell built from the
Evans–Fung biconcave profile; at swarm sizes the silhouette is what reads, and
the saving is what makes the long clips renderable. Both are drawn as instanced
meshes: one draw call per population.

**Motion, and why no two cells collide.** The whole population is a rigid body:
one box, one direction, one speed, wrapping on each axis. A rigid motion on a
3-torus is an isometry, so whatever separation the cells are given when they are
placed, they keep for every frame, forever. Placement is dart-throwing against
the toroidal metric — a candidate is kept only if its centre clears every
already-placed centre by the sum of the two radii plus a margin. A cell is a
disc whose bounding sphere equals its radius at any orientation, so the cells
can tumble freely without that guarantee weakening.

This is why the obvious embellishments are absent. Per-cell speed jitter lets a
fast cell overtake and pass through a slow one. Per-cell wobble changes the
distances between neighbours. Scaling positions to the camera frustum — which is
how an earlier version kept screen density even with depth — *converges* cells
as they approach the lens, squeezing them together. Each is a collision the
moment two cells are close, so none of them are in the model; depth comes from
perspective and fog instead.

Cells are also routed around the lens rather than through it. A cell that drifts
through the camera position is not a collision, but the near clip plane slices
it and it renders as a hard-edged slab across the frame, so each cell's whole
path is checked against a keep-out sphere at placement time.

`verify-spacing` (see the git history) walks every frame of every version and
reports the closest pair and the closest approach to the lens; both stay
positive on all six.

**Everything stays sharp.** There is no defocus pass and no motion blur. An
earlier version composited a second, deliberately blurred foreground layer to
fake a shallow depth of field; it is gone. Motes are kept small and crisp for
the same reason — a mote wide enough to read as a defocused disc looks like a
blurred cell.

**Determinism.** Every cell position, speckle and grain tile comes from a seeded
PRNG, and each frame is computed from the current time alone — never from the
previous frame's state. This matters more than it looks: Remotion renders frames
across several browser tabs in parallel, so anything built with `Math.random()`
would differ per tab and flicker in the finished file.

## Adjusting a look

Everything visual lives in `src/blood/looks.ts`. Each preset is one typed object
— palette, fog, cell counts and sizes, flow speed, vessel, core glow, motes,
lights, camera, grade. Change a value there and every resolution follows, since
the pixel-based numbers scale off the composition width.
