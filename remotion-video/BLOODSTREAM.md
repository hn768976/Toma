# Bloodstream — six 3D versions

Six red-blood-cell flythroughs built with **Remotion + three.js**, rendering
through **WebGPU where it works and WebGL2 otherwise**. Each version matches one
supplied reference clip in look and in length; all six run at **30 fps** and are
delivered as **H.264 / MP4**.

Every composition is registered twice — 1080p and 4K — from the same component
and the same duration, so the 4K master is the identical shot at four times the
pixels, not a separate edit.

## The six versions

| Composition | Reference | Length | Frames | Look |
|---|---|---|---|---|
| `V1-Obsidian` | de3308e7 | 10.03 s | 301 | Near-black field, glossy rim-lit cells, heavy shallow focus |
| `V2-VesselCore` | 022d81ce | 18.53 s | 556 | Vessel tunnel, blown white core, dense fast flow |
| `V3-CrimsonGold` | be5b4ffd | 18.04 s | 541 | Saturated crimson, gold-speckled cells, rising bubbles |
| `V4-Luminous` | 89469653 | 19.63 s | 589 | Blown-out core, large soft cells, pink haze |
| `V5-DeepField` | 8f4c18de | 17.05 s | 511 | Wide deep field, many small cells, flat even light |
| `V6-EmberBokeh` | 617f6ddf | 10.01 s | 300 | Muted brown-red, sparkling bokeh specks |

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

**Cells.** The supplied `public/models/rbc.glb` is used for the foreground
population. Despite its filename it is a genuine biconcave disc — centre
half-thickness 0.13 rising to 0.64 at the rim — so it drops straight in as a red
blood cell. The background swarm runs a much cheaper lathed cell built from the
Evans–Fung biconcave profile; at swarm sizes the silhouette is what reads, and
the saving is what makes the long clips renderable. Both are drawn as instanced
meshes: one draw call per population.

**Distribution.** Cells are placed on a unit disc and scaled to the camera
frustum each frame, so screen density stays even at every depth. Near the lens
the cone flattens into a cylinder — without that clamp the cone converges on the
camera and a single cell swallows the frame.

**Depth of field.** Looks whose reference has a shallow focus render a second,
defocused foreground pass: a handful of near cells at 45% resolution, blurred up
over the main pass. That is what those big soft shapes drifting past the lens
actually are, and it costs a fraction of a real DOF pass.

**The grade** — bloom, colour wash, vignette, grain — is composited in the DOM
rather than as a three.js `EffectComposer` chain. These are broad screen-space
effects that composite identically over the canvas, and skipping the extra
full-resolution passes is the difference between a 4K render that finishes and
one that doesn't.

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
