# Glass Circles — V1 to V7

Seven abstract motion backgrounds built on **Remotion + three.js**, rendering through
**WebGPU with an automatic WebGL2 fallback**.

| | Field | Light | Rig | Length |
|---|---|---|---|---|
| **V1** | Near-black | Intense blue rim, neon glow | Three sheet-glass discs | 10 s |
| **V2** | Bright sky blue | Soft neutral key, airy | Three sheet-glass discs | 10 s |
| **V3** | Violet | Cyan and green crescents | Field of thick spheres | 15 s |
| **V4** | Near-black | Cyan crescents, crimson rims | Field of thick spheres | 15 s |
| **V5** | White | Overlapping coloured film | Field of sheet-glass discs | 15 s |
| **V6** | Near-black | Violet glass light | Three sheet-glass discs | 10 s |
| **V7** | Near-black | Soft red gradient | Three sheet-glass discs | 10 s |

Every piece shares one 3D rig, one animation system and one rim shader. What differs
is the look definition in `variants.ts` and the field of discs each one puts on screen.

**Three families.** V1, V2, V6 and V7 are the same three hero circles in four
palettes — V6 and V7 are V2's layout and motion recoloured onto a dark field. V3 and
V4 are a dense field of thick, sphere-like bodies. V5 is that same field in sheet
glass, tinted, on white.

## Delivery specs

- **30 fps**, 300 frames (10.000 s) for V1/V2/V6/V7, 450 frames (15.000 s) for
  V3/V4/V5 — each matching its reference clip frame for frame
- **1920×1080** delivery renders, **3840×2160** compositions included
- **H.264 / MP4**, `yuv420p`, silent (no audio track)
- **Seamless loop** — every animated channel is a sine of the loop position at a
  whole number of cycles, so the last frame lands exactly on the first

## Rendering

```bash
npm install

# Any of V1..V7, at 1080p or 4K
npx remotion render GlassCircles-V3-1080p out/GlassCircles_V3_1080p.mp4 \
  --codec=h264 --muted --image-format=png --pixel-format=yuv420p --crf=17

npx remotion render GlassCircles-V7-4K out/GlassCircles_V7_4K.mp4 \
  --codec=h264 --muted --image-format=png --pixel-format=yuv420p --crf=17
```

Cost varies a lot between pieces. V5 renders several times faster than V3 or V4
despite being the same length and field: tinted film needs no transmission pass at
all, where clear glass re-renders the scene to refract it.

Add `--gl=swangle` on a machine with no GPU. `--image-format=png` keeps the
intermediate frames lossless, which matters here because the piece is mostly wide,
smooth gradients that JPEG intermediates would band.

Open the studio with `npm run dev` to art-direct interactively.


## What each family needed

**Sheet glass cannot grade a body.** A flat disc has a single normal, so a
directional light shades it uniformly and its rim is only ever a thin band. V3 and
V4's references are carried by a wide crescent inside each circle and a body graded
from lit to dark, so those two use thick, sphere-like glass where the outer quarter
of every disc is curved. V1, V2, V6 and V7 stay on sheet glass, which is what their
own references show.

**A bright field and a dark field want different light budgets.** On V2's near-white
field a rim can carry very large values and still read as a thin line. On a dark
field the same numbers clip to white and the colour goes with them — which is why V6
and V7 follow V1's budget rather than V2's, and why V3 and V4's cyan and crimson only
appeared once their peaks came down far enough for the channel ratios to survive tone
mapping. Brightness there is carried by bloom, which spreads colour instead of
flattening it.

**Bodies and rims need separate lights.** The environment has to stay dim for the
rims to keep their colour, but a body needs real irradiance to read as solid. Since
the rim is a custom shader sampling the environment texture directly while the bodies
go through the prefiltered map and the scene lights, the two can be set independently
— `bodyLight` reaches the bodies only. A light broad enough to fill a body will also
reach every part of a rim at once and close the crescent into a ring, so the
environment stays directional.

**Overlapping colour is a multiply, not a refraction.** V5's circles compound where
they cross, the way gels do. Physical transmission cannot do that: a transmissive
mesh only samples the opaque scene, so the disc in front hides the one behind rather
than tinting it. Its bodies are tinted film blended as `dst = src * dst`, written out
as explicit blend factors — the `MultiplyBlending` preset measured as a normal blend
at partial alpha and left the circles washed out.

## Graphics backend

The engine asks for WebGPU first and falls back to WebGL2. The fallback is not just
an error handler: a WebGPU adapter and device can initialise successfully on machines
where the canvas swap chain still cannot be allocated — headless and software-rendered
environments in particular — and that failure is silent, leaving a blank canvas.

So `probeWebGPUPresentation()` in `engine.ts` builds a throwaway 64×64 WebGPU surface,
clears it to a known colour and reads the pixel back. Only if the colour survives does
the real renderer get built on WebGPU. The probe is disposed first, so a rejected
attempt never holds a graphics context that the WebGL2 fallback then fails to acquire.

Set the `preferWebGPU` prop to `false` to force WebGL2.

Three.js is pinned to **0.180.0** deliberately: 0.186 sends a `swizzle` texture-view
property that Chromium 141 — the version Remotion renders with — rejects, which breaks
the WebGPU path outright.

## How it is put together

```
src/glass-circles/
  constants.ts   Frame rate, duration, delivery sizes
  loop.ts        The periodic oscillators every animated channel is built from
  variants.ts    The look definitions for V1 and V2 — the art-direction panel
  layout.ts      Camera framing, the three discs, and frame -> transform
  geometry.ts    The glass lens blank and the rim shell laid over its edge
  environment.ts The HDR lighting environment, generated as a float equirect map
  materials.ts   Backdrop, glass body, and the dispersive rim shader (TSL)
  engine.ts      Renderer selection, scene assembly, post chain, per-frame render
  GlassCircles.tsx  The Remotion composition
```

### Where the look comes from

**The rim does the work.** Both references get their signature from the rounded edge
of the glass: a thin blown-out arc where the edge catches a light, with a rainbow
fringe just inside it. `createRimMaterial` reproduces that with two lobes — a tight
specular line on the silhouette, and a refracted band sampled three times through
slightly different indices (red bends least, blue most) sitting just inside it.
Suppressing the outermost sliver of that second lobe opens the gap between them.

It draws **additively with depth testing off**, which is why every circle's edge stays
readable through the circles in front of it — as in both references, where the
overlapping rims all remain visible.

**The glass body is physically based.** Transmission with volumetric dispersion, so
the backdrop is genuinely refracted through each disc rather than faked.

**Lighting is generated, not loaded.** `environment.ts` paints soft-box strips into a
float equirectangular map at radiance values well above 1.0. That headroom is what
produces the blown-out arcs and feeds the bloom, and it keeps light placement
art-directable per variant. The environment also decides the *rainbow*: dispersion
only separates into visible colour when the three samples land on genuinely different
radiance, so V2's environment is deliberately higher-contrast than its bright field
suggests — the visible field comes from the backdrop plane, not the lighting.

**Bloom thresholds sit above the backdrop's own level.** Otherwise the entire field
blooms and the image washes to white — the single most destructive failure mode when
retuning V2.

### Art direction

`variants.ts` is the panel. Everything that distinguishes V1 from V2 lives there:
field colours, light placement and radiance, glass IOR and dispersion, rim gains,
bloom, grain, tone mapping. `layout.ts` owns composition and motion.

Glass thickness is **constant across all three discs** (`GLASS_HALF_THICKNESS`) —
they are cut from the same sheet, which is why the small circle's rim reads
proportionally thicker than the hero circle's, exactly as in the references.

## Two rendering details worth keeping

**The 3D canvas is never in the DOM.** It renders offscreen and is blitted into a 2D
canvas each frame. A detached canvas is never composited, so its drawing buffer
survives, and a 2D canvas always screenshots correctly — which removes the whole class
of `preserveDrawingBuffer` problems Remotion warns about with WebGL.

**The engine warms up with a paint wait.** A canvas drawn to within a single task may
not have been composited yet, and a screenshot taken at that point captures nothing.
Without the warm-up in `createEngine`, the first frame of *every* parallel render tab
comes out blank — four black frames scattered through the clip at `--concurrency=4`.
