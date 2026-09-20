# Microbiology set — six versions

Six 3D motion-graphic loops, one per supplied reference clip. Built with
Remotion + three.js, rendering on WebGPU where it is available and falling
back to WebGL2, then WebGL1.

## The six versions

| Composition | Frames | Length | Reference |
|---|---|---|---|
| `Micro-V1-BlueCells` | 271 | 9.03s | Backlit blue blastocysts in a lit fluid |
| `Micro-V2-VirionAttack` | 419 | 13.97s | Red virions swarm and coat a pale host cell |
| `Micro-V3-CoronaFlythrough` | 572 | 19.07s | Flight through a dense field of spiked virions |
| `Micro-V4-ColourJourney` | 300 | 10.00s | Amber → olive → teal, resolving into clean blue |
| `Micro-V5-AmberField` | 300 | 10.00s | Dense fibrous microbes over a warm amber vignette |
| `Micro-V6-GreenOnBlack` | 250 | 8.33s | Sparse glowing green cells on pure black |

Every version is registered twice:

- `<name>-4K` — the 3840×2160 master, at 30fps. This is the deliverable
  composition.
- `<name>-1080p` — a native 1920×1080 composition, for fast iteration in the
  studio.

## Rendering

The shipped 1080p MP4s are the **4K masters rendered at half scale**, not the
1080p compositions. That way the delivered file is the master, just smaller —
identical framing, motion and timing, with no second code path to keep in sync.

The `render:micro` script wraps this:

```console
npm run render:micro            # all six, 1080p
npm run render:micro -- v3 v5   # just those
npm run render:micro -- --4k    # full 4K masters, roughly 4x the time
```

Or drive the CLI directly:

```console
# 1080p delivery (what ships)
npx remotion render Micro-V1-BlueCells-4K out/v1_1080p.mp4 \
  --scale=0.5 --codec=h264 --crf=16 --gl=angle

# full 4K master
npx remotion render Micro-V1-BlueCells-4K out/v1_4k.mp4 \
  --codec=h264 --crf=16 --gl=angle
```

`--gl=angle` is what gets a hardware GL backend in headless Chrome; without it
the renderer falls back to software and the render slows to a crawl.

## How it is put together

```
src/micro/
  constants.ts          format, fps, per-version durations
  registry.ts           the six versions, consumed by Root.tsx
  gpu/
    createRenderer.ts   WebGPU -> WebGL2 -> WebGL1, each probed with a real draw
    ThreeStage.tsx      frame-locked three.js stage, layered depth of field
  lib/
    rng.ts              seeded PRNG
    noise.ts            3D simplex noise + fbm
    cells.ts            displaced cell geometry, virions, rim glow
    textures.ts         procedural bump maps baked to canvas
    rig.ts              light rigs, drift and wrapping helpers
  components/
    Backdrop.tsx        CSS volumetric background
  versions/             V1..V6
```

### Determinism

Remotion renders frames out of order and across several browser tabs, so
nothing in a scene may animate itself or carry state between frames. Each
version exposes `update(frame)`, which computes the world's absolute state from
the frame number alone — no deltas, no `Math.random()`, no `requestAnimationFrame`.
Randomness comes from a seeded generator that is re-run identically on every
mount. Frame 200 is the same picture whether it is rendered first or last.

`ThreeStage` holds a `delayRender()` handle for each frame until the GPU has
actually finished drawing, so Remotion never screenshots a half-drawn canvas.

### Renderer tiers

`createStageRenderer` tries, in order:

1. `WebGPURenderer` on a real WebGPU device
2. `WebGPURenderer` forced onto its own WebGL2 backend
3. the classic `WebGLRenderer`, the only one that starts on WebGL1

Each tier is **probed with a real draw** before it is accepted. Asking whether
`navigator.gpu` exists is not the same as asking whether it works: headless
Chrome builds regularly expose a WebGPU device that then rejects a descriptor
three sends it, and that only surfaces on the first render. Probing turns what
would otherwise be a dead render into a silent step down a tier. (The container
this set was rendered in does exactly that, and lands on tier 2.)

Because one scene graph has to run on all three tiers, the scenes use only
three's built-in materials. A custom GLSL `ShaderMaterial` would compile on
tier 3 and fail on tiers 1 and 2. Surface detail therefore lives in displaced
geometry and in baked canvas bump maps rather than in shader code.

### Depth of field

V1, V2 and V4 use it. **V3, V5 and V6 are fully in focus** — every body sharp,
no blur anywhere — so those three run as a single layer.

Where it is used, the scene is split into depth layers (far, focus, near).
Every layer gets its own `Scene`, its own renderer and its own canvas, and the
canvases are blurred in CSS and stacked. This gives real, tunable bokeh without
a postprocessing pass, which would have had to be written twice (GLSL for
WebGL, TSL for WebGPU).

Two details make it hold up:

- Blur is authored in **master (4K) pixels** and rescaled by `ThreeStage` to
  whatever resolution the composition is running at, so a native 1080p
  composition and a 4K one at `--scale 0.5` match.
- Each layer's camera is **overscanned** by three times its blur radius, so the
  blur has real picture to pull from at the frame edge instead of dragging in
  transparency and leaving a dark border.

Layers are assigned once at build time.

### What losing the blur changed

Removing depth of field from V3, V5 and V6 is not just deleting a blur value.
A blurred near plane hides things that a sharp one does not:

- **V3** recycled virions right at the lens, where the blur covered the pop. In
  focus that would be a full-frame flash, so bodies are now pushed radially
  outward as they approach and leave the frame through the sides before they
  recycle. (Fading them out instead was the first attempt: a semi-transparent
  body writes depth, so its own spikes show through it and it reads as a ghost
  ring. A fixed exclusion tube was the second, and punched a permanent hole
  through the middle of the corridor.)
- **V3, V5, V6** lit their fields with point lights sitting inside the volume
  the bodies travel through. Sooner or later a body passes within a unit or two
  of one and inverse-square falloff blows it to white — invisible behind a
  blur, obvious without one. Those are directional lights now, which have no
  position to collide with.
- **V5 and V6** carried foreground bodies big enough to fill a third of the
  frame, which works as a soft framing shape and does not work sharp. Their
  foreground scale ranges came down accordingly.
