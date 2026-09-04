# Black Hole — Edge-On Lensing

Two 15-second seamless loops of a warm, nearly edge-on black hole: the
accretion disc gravitationally lensed into a broad arc over the shadow and a
tighter, hotter crescent beneath it.

| Composition ID | Look |
| --- | --- |
| `V1-BlackHoleEdgeOnGold` | Warm gold, edge-on, centred (reference match) |
| `V2-BlackHoleEdgeOnMono` | Identical framing, luminance-matched greyscale, no tint |

Compositions are defined at **3840×2160, 30 fps, 450 frames (15 s)**.

## Running it

```bash
npm install
npx remotion studio
```

## Rendering

4K, one command per composition:

```bash
npx remotion render V1-BlackHoleEdgeOnGold out/V1_BlackHoleEdgeOnGold.mp4 --scale=1 --crf=16
npx remotion render V2-BlackHoleEdgeOnMono out/V2_BlackHoleEdgeOnMono.mp4 --scale=1 --crf=16
```

1080p preview — `--scale=0.5` renders natively at 1920×1080 rather than
downsampling, because the canvas is sized from `devicePixelRatio`:

```bash
npx remotion render V1-BlackHoleEdgeOnGold out/V1_BlackHoleEdgeOnGold.mp4 --scale=0.5 --crf=16
```

Stills:

```bash
npx remotion still V1-BlackHoleEdgeOnGold out/V1_BlackHoleEdgeOnGold.png --frame=120 --scale=0.5
```

### Measured render time

<!--RENDERTIME-->

## How it works

A single GLSL fragment shader over a full-screen triangle. There is no mesh,
no camera object and no texture asset: every pixel traces a light ray.

**`src/shader/lensing.frag.ts`** integrates null geodesics of the
Schwarzschild metric in Cartesian coordinates, in units where the
Schwarzschild radius is 1. The arcs are not faked — the far side of the disc
bending up over the shadow, the thin secondary crescent below it, and the
photon ring all fall out of the integration. A drift-kick-drift leapfrog
integrator puts the rendered shadow within 0.4% of the analytic
3√3/2 · r_s at the step size used; plain Euler needs roughly twice the steps
for the same error.

**`src/shader/post.frag.ts`** is the post chain: a downsample/upsample bloom
pyramid (seven levels at 1080p, so the glow reaches most of the frame),
luminance-Reinhard tonemapping, 2% grain and sub-LSB dither.

Two deliberate choices worth knowing about:

- Tonemapping is luminance-Reinhard rather than ACES. ACES desaturates the hot
  core toward white and loses the orange the whole look is built on.
- Intermediate frames are PNG, not JPEG. A very bright object on a large dark
  falloff is the worst case for banding, and JPEG's chroma subsampling puts
  blocking into that falloff before H.264 ever sees it. The dither in the
  composite pass is what stops the encoder finding flat plateaus to band —
  judge it on the encoded file, not the Studio preview.

### The loop

`uTime` is `useCurrentFrame() / durationInFrames`, so it runs 0 → 1 across the
composition. No wall clock, no frame deltas. Every time-varying term is
periodic in it, which makes any frame reproducible in isolation and lets
Remotion render frames in any order.

Differential rotation is the one part that needs care. Keplerian shear wants
an angular velocity of r^−3/2, but an arbitrary real number of turns per loop
cannot return the noise field to its start. So the turn count at each radius
is split into the integer band it falls in and the fraction between bands:
both neighbouring bands advance by a whole number of turns and are therefore
exactly periodic, and the fraction blends between them. Because the filaments
are stretched so far along the orbit, blending two copies a fraction of a turn
apart costs nothing visually — a rotated near-ring still looks like the same
near-ring.

Verified empirically: frame 0 and frame 450 differ only by the ±1/255 dither
(max 2/255), against max 87/255 for a single adjacent-frame step.

### Sharing the shader with the wider-tilt project

Everything that defines a look is a uniform, so the shader never branches on
which version it is drawing, and the sibling black-hole project's
compositions can run off this same file. `src/presets.ts` is the whole
surface: camera (`tiltDeg`, `camDist`, `zoom`), disc structure (`aniso`,
`angScale`, `spinTurns`, `secondary`, `opacity`), and the five-stop colour
`ramp`, plus the bloom controls. To add a composition, add a `Look` and
register it in `src/Root.tsx`.

`zoom` is an inverse focal length. The shadow's impact parameter is
3√3/2 · r_s = 2.589, so at camera distance D it subtends `atan(2.589 / D)` and
lands at screen height `atan(2.589/D) / zoom` in units of frame height. At
D = 40 and zoom = 0.5885 that is 0.110 — a shadow 0.22 × frame height, as
specified. (The reference plate is framed tighter, nearer 0.33; the brief
gives 0.22 explicitly and that is what this matches.)
