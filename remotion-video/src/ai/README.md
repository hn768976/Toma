# Neural Circuitry — nine 4K motion-graphic versions

Nine abstract AI/neural motion graphics built on one supplied 3D asset, each
designed against one reference clip. Rendered with Remotion driving three.js
over WebGL; no text, no branding, no audio.

## The set

| # | Composition | Length | Frames | What it does |
|---|-------------|--------|--------|--------------|
| 1 | `V01Halo` | 25s | 750 | Orbiting halo rings resolve into the circuitry over a drifting data grid. |
| 2 | `V02Projection` | 25s | 750 | Hologram thrown up a light cone from an emitter on a reflective wire floor. |
| 3 | `V03Fibers` | 20s | 600 | Filament brain with a hot core, over a circuit field streaking past. |
| 4 | `V04Pedestal` | 15s | 450 | Circuitry hovering over a raked circuit floor, lit by falling shafts. |
| 5 | `V05Flythrough` | 15s | 450 | Rush through PCB traces that decelerates into the reveal. |
| 6 | `V06Amber` | 10s | 300 | The warm outlier: amber circuitry against teal data streams. |
| 7 | `V07Hud` | 25s | 750 | Targeting reticle of counter-rotating rings locking onto the board. |
| 8 | `V08Chevron` | 20s | 600 | Symmetrical chevron bus pulsing outward to both edges. |
| 9 | `V09Assembly` | 13.97s | 419 | A scattered particle ring converges into the solid circuitry. |

All nine are 3840×2160 at 30fps. Durations match each reference clip's
wall-clock length; references shot at 25fps or 29.97fps are re-timed to 30fps at
the same length, so `durationInFrames` is always `round(referenceSeconds * 30)`.

## Rendering

The compositions are authored at 4K. The delivered 1080p files are the same
compositions rendered at half scale, so there is only ever one definition of a
version to keep in sync.

```console
npm i

# 1080p H.264 (what ships in out/1080p)
node scripts/render-all.mjs out/1080p 0.5

# 4K masters
node scripts/render-all.mjs out/4k 1

# a single version
node scripts/render-all.mjs out/4k 1 V06Amber

# or straight from the CLI
npx remotion render V01Halo out/V01Halo.mp4 --codec=h264 --crf=16          # 4K
npx remotion render V01Halo out/V01Halo.mp4 --codec=h264 --crf=16 --scale=0.5
```

`npm run dev` opens the Remotion Studio to scrub any version.

4K renders are roughly 4× the cost of 1080p, and on a machine without GPU
acceleration three.js falls back to software rasterisation — budget accordingly.

## How it is put together

`public/models/neural-circuitry.glb` is the supplied asset: a shallow relief
panel, ~1.75 × 1.90 units across but only 0.04 deep, 220k triangles, and no
materials at all. It is the hero of all nine versions; they differ in what is
built around it and how it is lit.

**The shading trick.** With no materials to work from, `shaders/hero.ts` derives
the look from the surface itself. In view space, a normal's `z` component says
how squarely a face points at camera: the flat tops of the traces and the board
floor face the lens, while the near-vertical walls of every raised trace turn
away. Lighting on that one term outlines every trace in the artwork and leaves
the rest dark, which is what turns a grey mesh into glowing circuitry.

### Layers

Each version composes from the same kit, differing in parameters, not code:

- `HeroCircuitry` — the GLB, shaded as above, with a radial wipe-in, a scan
  sweep and energy pulses.
- `Backdrop` — background gradient, drawn in-scene (see below).
- `Glow` — the bloom chain.
- `CircuitField` / `circuitTraces` — procedurally generated PCB runs that turn
  on a grid and end in pads, with pulses driven from distance-along-run so one
  draw call animates every trace.
- `HaloRings` — concentric HUD arcs drawn analytically in one fragment shader.
- `DataStreams` — wrapping horizontal light streaks.
- `GridFloor` — perspective wireframe floor with sonar rings.
- `Beams` — `LightCone`, `LightShafts`, `Flare`.
- `Filaments` — radiating fibre bundles.
- `AssemblySwarm` — particles that converge onto points sampled from the hero
  mesh, so the swarm resolves into the real board layout.
- `ParticleField` — ambient drifting motes.
- `CameraRig` — camera as a pure function of the frame.

### Three things that are deliberate

**Everything is a pure function of the frame.** Remotion renders frames in
parallel and out of order, so nothing integrates over time and nothing calls
`Math.random()` at render time. Scatter is seeded (`rng.ts`), and motion is
computed from the frame number. Re-rendering any frame in isolation reproduces
it exactly.

**The canvas waits for the GLB.** `@remotion/three` runs the renderer with
`frameloop="demand"`. A mesh that arrives asynchronously *after* the frame has
been drawn never triggers a redraw and silently renders nothing, so
`NeuralCanvas` does not mount the canvas until the geometry has parsed, and
hands it down through a render prop — @react-three/fiber renders children with
its own reconciler and outside contexts do not reliably cross it.

**Colour is pass-through, and it took some getting there.** Every palette entry
in `palette.ts` is a final display value, so the pipeline must not re-grade it.
Two things were quietly doing so:

- `gl.setClearColor` put the background through three's colour-management
  plumbing and landed `#020818` on screen as `#00204e`. The background is now
  painted by `Backdrop` as one in-scene shader quad, and the clear colour is
  left at pure black, which cannot drift.
- three's `UnrealBloomPass` shifted colour badly — `#00ff00` came out of the
  composer as `#93e459` — while the same colours rendered directly were
  pixel-exact. `Glow` replaces it with an explicit render-target chain: bright
  pass, two separable blur octaves, composite, every pass a `RawShaderMaterial`
  (which three does not inject tone-mapping or colour-space chunks into) on 8-bit
  `NoColorSpace` targets. It is also cheaper and its bright-pass curve and blur
  spread are tunable per version.

`AiProbe.tsx` is the diagnostic that pinned both down: it renders a known colour
through each path so the output can be sampled and compared. It is kept because
it is the thing to reach for if the colour pipeline ever drifts again.

## Tuning

`scripts/preview.mjs` bundles once and renders any number of
`(composition, frame, props)` stills from that single bundle — much faster than
`remotion still`, which re-bundles every invocation.

```console
echo '[{"name":"a","id":"V06Amber","frame":195,"scale":0.25}]' > /tmp/spec.json
node scripts/preview.mjs /tmp/out /tmp/spec.json
```
