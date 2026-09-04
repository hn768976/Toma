# Neon Corridor

A seamlessly looping corridor of concentric neon rectangles receding to a
vanishing point over a wet, reflective floor. Real 3D — `@remotion/three` /
react-three-fiber — with a mirrored-camera floor reflection and a bloom / DOF /
grain post chain.

Two versions, identical geometry:

| Composition id           | Look                                     |
| ------------------------ | ---------------------------------------- |
| `V1-NeonCorridorMagenta` | magenta `#e026c0` → violet `#7a3ce8`     |
| `V2-NeonCorridorCyan`    | cyan `#22d3ee` → teal-blue `#1e6fd9`     |

Both are defined at **3840×2160, 30fps, 300 frames (10s)**.

## Render

Install once:

```bash
npm install
```

### 4K masters

```bash
npx remotion render V1-NeonCorridorMagenta out/V1_NeonCorridorMagenta.mp4 --scale=1 --crf=16
npx remotion render V2-NeonCorridorCyan    out/V2_NeonCorridorCyan.mp4    --scale=1 --crf=16
```

### 1080p previews

```bash
npx remotion render V1-NeonCorridorMagenta out/V1_NeonCorridorMagenta.mp4 --scale=0.5 --crf=16
npx remotion render V2-NeonCorridorCyan    out/V2_NeonCorridorCyan.mp4    --scale=0.5 --crf=16
```

### Stills

```bash
npx remotion still V1-NeonCorridorMagenta out/V1_NeonCorridorMagenta.png --frame=0 --scale=0.5
npx remotion still V2-NeonCorridorCyan    out/V2_NeonCorridorCyan.png    --frame=0 --scale=0.5
```

`npm run render:v1` / `render:v2` (4K) and `preview:v1` / `preview:v2` (1080p)
wrap the same commands.

Codec settings — H.264, `yuv420p`, CRF 16 — are pinned in `remotion.config.ts`,
so they do not need to be passed on the command line.

### Chromium GL flag

The scene is WebGL, so headless Chromium needs a GL backend:

```
--gl=angle
```

This is already set as the default in `remotion.config.ts`; pass it explicitly
only if you override the config. On a machine with **no GPU**, ANGLE falls back
to SwiftShader on its own — you can also ask for it directly:

```
--gl=swiftshader
```

On the reference machine below the two produced byte-identical output, ANGLE
having fallen back to the same software rasteriser.

## Measured render time

Measured on this project, **1080p (`--scale=0.5`), 300 frames**, 4 vCPU / 15 GB,
**no GPU** (software rasterisation), Chrome Headless Shell 149:

| Composition              | Wall clock | Per frame |
| ------------------------ | ---------- | --------- |
| `V1-NeonCorridorMagenta` | _see below_ | _see below_ |
| `V2-NeonCorridorCyan`    | _see below_ | _see below_ |

Expect 4K (`--scale=1`) to cost roughly 4× that per frame for the same
concurrency, and far less on a machine with a real GPU — almost all of the
per-frame cost here is fragment work (bloom mip chain, 9-tap reflection blur,
4× MSAA) that a GPU eats for breakfast.

## How it works

### The loop

`src/loop.ts` is the whole mechanism, and it is worth reading before changing
anything visual.

The camera travels forward exactly **one frame-spacing over the 300 frames**,
with tubes recycled from the back to the front. That is modelled with the
camera pinned at the origin and the corridor sliding past it — equivalent, and
it keeps the reflection and DOF maths in a fixed frame.

Tube `k` sits at slot `m = (k − t) mod FRAME_COUNT`, `t` running 0 → 1 across
the loop, and slot `m` sits at `z = Z_SLOT0 − m · SPACING`. At `t = 1` every
tube has advanced exactly one slot, so the *set* of occupied positions is
identical to `t = 0`. Hence the invariant everything else obeys:

> Any visual property that is a pure function of a tube's camera-relative
> position loops perfectly.

So colour, brightness, the bottom-bar fade and the flicker are all keyed off
depth or slot — never off a tube's identity `k`. Keying colour off `k` would
break the loop, because at `t = 1` a *different* tube stands where tube `k`
stood at `t = 0`.

The same rule drives the floor: its mottling scrolls with the corridor, and
every noise octave tiles with a period of exactly one frame-spacing in world z,
so the texture lands back on itself at the end of the loop.

Everything is a pure function of `useCurrentFrame()`. There is no `useFrame`
clock and no delta accumulation anywhere, because Remotion renders frames out
of order across threads. The one `useFrame` callback that does exist (the
reflection pass) reads only the camera's current transform, and the grain seed
comes from the frame number.

### The reflection

`src/scene/ReflectiveFloor.tsx`. A real mirrored-camera pass into a half-float
render target, sampled back projectively on the floor plane and blurred there —
cheaper and far more controllable than screen-space reflections at this scale.
Because the target is half-float, reflected neon stays above 1.0 and blooms
too.

The pass runs on `useFrame(…, -1)`. Negative priority runs before every other
subscriber and before the render, and — unlike a positive priority — does not
take over the render loop, so it slots in ahead of the post chain without
disturbing it.

The blur is vertical-biased and world-constant, so it is wide underfoot and
tight down the corridor. The noise warp matters more than it looks: reflected
top bars arrive as clean horizontal lines, and a vertical displacement that
varies along x is what breaks them into the interrupted banding a wet slab
actually gives.

### The post chain

`src/scene/Effects.tsx` drives `postprocessing` directly rather than going
through `<EffectComposer>` from `@react-three/postprocessing`. That wrapper
builds its composer inside a passive effect, so on the very first `advance()`
there is no composer yet and nothing reaches the canvas — which, under
Remotion, is exactly the frame each render thread starts on, and the result is
a black frame. Building it in `useMemo` means it exists before any render runs.

Half-float buffers throughout, so neon above 1.0 survives to the bloom and
clips only in the final 8-bit write; that clipping is where the white-hot tube
cores come from. Grain is applied in the display domain, where H.264 banding
actually lives — a flat linear-space dither would swamp the blacks and vanish
in the highlights.

### Departures from the reference

- The reference clip loops every **30** frames — it travels one frame-spacing
  per second. This build travels one frame-spacing per **300** frames as
  specified, so the drift is about 10× slower and reads as a slow push rather
  than a flight.
- The rectangles' bottom bars fade out over the last few metres
  (`baseBarGain` in `src/scene/Corridor.tsx`). Down the corridor they give the
  faint floor ladder the reference has; up close the same bar is seen almost
  edge-on and lays a solid stripe across the lower third, which the reference
  does not have.

## Layout

```
src/
  config.ts                  corridor geometry, timing, camera
  loop.ts                    the loop mechanism and its invariant
  palette.ts                 the two colour ramps
  flicker.ts                 seeded failing-tube events
  Root.tsx                   composition registration
  NeonCorridor.tsx           canvas, camera rig, scene assembly
  scene/
    Corridor.tsx             neon rectangles + wall strips
    geometry.ts              shared merged tube geometry
    Shell.tsx                walls and ceiling, with light spill
    ReflectiveFloor.tsx      mirrored-camera reflection + wet floor shader
    Effects.tsx              bloom / DOF / grain / vignette
    GrainVignetteEffect.ts   custom final-pass effect
```

## Development

```bash
npm run studio   # Remotion Studio
npm run lint     # tsc --noEmit
```
