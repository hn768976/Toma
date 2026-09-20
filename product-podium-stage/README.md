# Product Podium Stage

Eight empty product display stages — a plinth on a lit backdrop, with the podium
top left completely clear so a buyer can composite their own product onto it.

Four looks, each in two palettes, built as one template: the camera rig, shadow
setup and post chain are fixed, and each stage is a data row in
`src/looks/data.ts`.

- **3840×2160, 30 fps, 300 frames (10 s), seamless loop.**
- Remotion + three.js via `@remotion/three` / react-three-fiber.
- No text, watermark, logo, product or brand mark anywhere.

---

## Completion checklist

| # | Look | Palette A | Palette B |
|---|------|-----------|-----------|
| 1 | **Blind Shadow** — warm plaster wall, venetian blind gobo drifting across wall and floor, matte charcoal disc | ✅ `BlindShadow-PodiumA` (Terracotta) — configured, checked, **preview + still rendered** | ✅ `BlindShadow-PodiumB` (Grey-green) — configured, checked, **not rendered** |
| 2 | **Halo Ring** — glowing neon ring over a dark disc in a fogged void, volumetric light cone | ✅ `HaloRing-PodiumCyan` (Cyan / blue) — configured, checked, **preview + still rendered** | ✅ `HaloRing-PodiumMagenta` (Magenta / violet) — configured, checked, **not rendered** |
| 3 | **Neon Tier** — two-tier black plinth with neon edge strips, polished floor, slab wall | ✅ `NeonTier-PodiumCyan` (Cyan neon) — configured, checked, **preview + still rendered** | ✅ `NeonTier-PodiumAmber` (Amber neon) — configured, checked, **not rendered** |
| 4 | **Bubble Drift** — high-key lilac void, white cylinder plinth, translucent spheres drifting down | ✅ `BubbleDrift-PodiumLilac` (Lilac) — configured, checked, **preview + still rendered** | ✅ `BubbleDrift-PodiumMint` (Mint) — configured, checked, **not rendered** |

All eight are configured and were rendered and visually checked at reduced
scale. The four palette-A compositions additionally ship as 1080p preview
clips and 1080p stills. The four palette-B compositions ship configured and
render-ready but unrendered, as specified — each is a colour change on a
verified scene, sharing its look's geometry, lighting and seeded layout
exactly.

**A note on composition ids.** Remotion only accepts `a-z A-Z 0-9 -` in a
composition id, so the ids are hyphenated (`HaloRing-PodiumCyan`) while the
delivered files keep the underscored spelling (`HaloRing_PodiumCyan.mp4`).
Every command below passes the hyphenated id and the underscored output path.

---

## Quick start

```bash
npm install
npx remotion studio
```

The studio lists all eight compositions. Nothing else needs fetching — the
environment map is generated into `public/hdri/` and is committed.

---

## Render commands

### 4K masters (the delivery render)

```bash
npx remotion render BlindShadow-PodiumA     out/BlindShadow_PodiumA.mp4     --scale=1 --crf=16
npx remotion render BlindShadow-PodiumB     out/BlindShadow_PodiumB.mp4     --scale=1 --crf=16
npx remotion render HaloRing-PodiumCyan     out/HaloRing_PodiumCyan.mp4     --scale=1 --crf=16
npx remotion render HaloRing-PodiumMagenta  out/HaloRing_PodiumMagenta.mp4  --scale=1 --crf=16
npx remotion render NeonTier-PodiumCyan     out/NeonTier_PodiumCyan.mp4     --scale=1 --crf=16
npx remotion render NeonTier-PodiumAmber    out/NeonTier_PodiumAmber.mp4    --scale=1 --crf=16
npx remotion render BubbleDrift-PodiumLilac out/BubbleDrift_PodiumLilac.mp4 --scale=1 --crf=16
npx remotion render BubbleDrift-PodiumMint  out/BubbleDrift_PodiumMint.mp4  --scale=1 --crf=16
```

Codec, pixel format and CRF default to H.264 / `yuv420p` / 16 in
`remotion.config.ts`; the `--crf=16` above is explicit so the command is
complete on its own. Output has no audio track.

### 1080p previews

Same compositions, half scale. `--scale` sets Chromium's device scale factor,
so this renders a genuine 1920×1080 buffer from the 3840×2160 composition
rather than downscaling a 4K frame:

```bash
npx remotion render BlindShadow-PodiumA out/BlindShadow_PodiumA.mp4 --scale=0.5 --crf=18
```

### Stills

Every composition is also a saleable still. The frame to export is stored per
look as `stillFrame` in the data row, chosen where that look's motion sits at
a good point:

```bash
npx remotion still BlindShadow-PodiumA     out/BlindShadow_PodiumA.png     --frame=96  --scale=1.5625
npx remotion still HaloRing-PodiumCyan     out/HaloRing_PodiumCyan.png     --frame=38  --scale=1.5625
npx remotion still NeonTier-PodiumCyan     out/NeonTier_PodiumCyan.png     --frame=120 --scale=1.5625
npx remotion still BubbleDrift-PodiumLilac out/BubbleDrift_PodiumLilac.png --frame=150 --scale=1.5625
```

`--scale=1.5625` renders **6000×3375** from the 3840×2160 composition
(3840 × 1.5625 = 6000). PNG is lossless, so nothing is added by the encode;
the gradient is dithered in-shader before it is written, so any banding that
did appear would be coming from the render rather than the file format.

Palette-B stills use the same frame numbers — `stillFrame` is a property of
the look, not the palette.

### Chromium GL flag

WebGL needs a real GL backend in headless Chromium:

```bash
npx remotion render <id> <out> --gl=angle
```

`angle` is already set in `remotion.config.ts`, so the flag is only needed if
you render through the Node APIs (where the config file does not apply).
`angle` picks the platform default and uses a GPU where one exists;
`swiftshader` is the CPU fallback, which works on a headless box with no GPU
and is **much** slower — see the timings below.

---

## Measured render time

Measured on the build machine for this delivery: **4 cores, 15 GB RAM, no
GPU** — Chromium fell back to `ANGLE (Vulkan 1.3.0 SwiftShader Device)`, i.e.
CPU rasterisation. At 1080p, `--concurrency=3`:

<!--TIMINGS-->

These are a worst case. On a machine with a real GPU the same renders are
substantially faster, and the ratios between looks matter more than the
absolute numbers:

- **Halo Ring is the expensive look** — the volumetric cone is a raymarch, and
  it dominates its frame time. If the cost is unworkable, lower
  `volumetricSteps` on that look's data row before touching the fog quality:
  the cone matters more than the ground haze. It is a compile-time constant in
  the shader, so changing it costs nothing at runtime.
- **Neon Tier** is next, because the polished floor is a real planar reflector
  that re-renders the scene each frame.
- 4K is roughly 4× the pixels of 1080p; budget accordingly when scheduling the
  four unrendered palette-B compositions.

---

## Environment map

`public/hdri/neutral-studio-gradient.hdr` — 1024×512 equirectangular Radiance
RGBE, generated by `scripts/make-hdri.mjs` (`node scripts/make-hdri.mjs`).

**Licence: CC0 / public domain.** It is generated by the script in this
project from an analytic formula, so there is no third-party asset in the
delivery and nothing to attribute.

It is generated rather than downloaded on purpose. The environment shows up in
look 3's polished floor and in every plinth bevel, so a captured studio HDRI
with a recognisable window, softbox or object in it would be both visibly
wrong and a licensing question. A smooth analytic gradient — bright overhead
dome, neutral horizon band, dim warm floor bounce, one very broad key lobe for
directional cue — cannot contain a recognisable shape.

To swap in a different one (for example a neutral studio gradient from
[Poly Haven](https://polyhaven.com/hdris), CC0): drop the `.hdr` into
`public/hdri/` and change `HDRI_URL` in `src/PodiumStage.tsx`. Keep it free of
recognisable objects for the reasons above.

---

## The locked camera

**This is the commercial constraint of the whole project, not a stylistic
choice.** Buyers license these to composite their own product onto the plinth.
If the camera orbits, dollies, arcs or eases, they have to motion-track their
product onto a moving stage — and most will not bother, at which point the
clip stops doing the one job it exists for.

So: **the camera does not move.** All eight compositions share one camera
(`CAMERA` in `src/looks/data.ts`) — position, an 8° downward pitch, and a
27° field of view that reads as a real product lens with no wide-angle bow on
the plinth. All the motion comes from light, atmosphere and props.

Looks differ in plinth height, so rather than move the camera to reframe, each
look carries a `stageOffsetY` that shifts the whole stage vertically. That is
solved so every podium's top surface lands at the same point in frame.

### Podium placement

The podium's top surface sits at ~55% of frame height from the top — i.e. 45%
of the way up the frame — leaving the 55% above it clear for the buyer's
product. A product about one plinth-diameter tall tops out around 10% of frame
height, well clear of the edge.

### The permitted push-in

Each look has a `pushIn` field, **shipped at 0 on all eight.**

Set it to `0.04` for a 4% linear push over the clip. It is implemented as an
FOV zoom, not a dolly: a zoom scales the image about its centre with no
parallax, so a buyer matches it with a single linear scale keyframe, and it
stays sharp because it is rendered rather than upscaled.

**It is off by default because a push cannot loop.** A push-in does not return
to where it started, so a clip with `pushIn > 0` has a visible jump at the
loop point. Buyers extend these under a product shot for as long as they need,
so the seamless loop wins and the push is left as a documented option for a
non-looping hero cut.

---

## How the loop is guaranteed

Everything animated is a pure function of `t = frame / durationInFrames`,
which runs 0 → 1 across the clip. Nothing reads a clock and nothing carries
state between frames — Remotion renders frames out of order across threads, so
anything accumulated would both flicker and break the loop.

- **Light paths and pulses** are whole-cycle sines of `t`.
- **The venetian blind** translates by exactly one slat pitch. The rack is
  periodic and longer than the shadow camera, so one pitch of travel is
  indistinguishable from none.
- **Fog and cone noise** use a tileable value noise whose lattice wraps at a
  fixed period; each field drifts by exactly one world period across the clip,
  so it moves continuously and returns exactly.
- **The drifting spheres** each derive their height from
  `(frame + offset) mod cycleLength` with a fixed seeded offset. `cycleLength`
  divides evenly into 300 and the travel span runs from above the top of frame
  to below the bottom, so every sphere resets off-screen, staggered.
- **The travelling glow** on look 3's wall line completes exactly one pass.

---

## Adding a new look

A new stage is a row in `LOOKS` in `src/looks/data.ts`, plus a scene component
only if its structure is genuinely new. Adding a **palette** to an existing
look is one entry in that look's `palettes` array and nothing else.

### 1. Add the data row

```ts
{
  id: "my-look",            // Stable. Seeds the PRNG, so it fixes the layout
                            // for BOTH palettes — never key it on the palette.
  name: "MyLook",           // PascalCase. Becomes the composition id prefix:
                            // MyLook-PodiumA, MyLook-PodiumB.
  description: "...",       // One line, for this checklist.
  scene: "blindShadow",     // Which scene component renders it.
  plinth: { ... },          // See below.
  stageOffsetY: -0.18,      // See below.
  post: { ... },            // See below.
  volumetricSteps: 48,      // Only read by the haloRing scene.
  stillFrame: 96,           // Frame exported by `npx remotion still`.
  pushIn: 0,                // Leave at 0 unless you want a non-looping cut.
  palettes: [ paletteA, paletteB ],   // Exactly two.
}
```

### 2. What each field controls

**`plinth`** — the geometry is lathed from these, never hand-modelled
(`src/rig/plinthGeometry.ts`):

| Field | Controls |
|---|---|
| `radius` | Radius of the widest (bottom) tier, in world units. ~2 fills about half the frame width. |
| `tierHeight` | Height of one tier. `radius / tierHeight` around 3–4 reads as a disc; 2 reads as a cylinder. |
| `tiers` | `1` = plain disc, `2` = the stepped stack in look 3. |
| `tierInset` | How much narrower each tier above the first is, as a fraction of `radius`. Ignored when `tiers` is 1. |
| `bevel` | Rounded fillet on the top edge. This is the edge a buyer reads as "machined" — do not set it to 0. |
| `radialSegments` | Radial subdivision. 256 is smooth at 4K; lower and the silhouette facets. |
| `bevelSegments` | Subdivision across the fillet. |

**`stageOffsetY`** — vertical shift of the whole stage, in world units. This is
how a look with a taller plinth keeps its top surface at the same point in
frame without moving the shared camera. Solve it for a new plinth height:
negative moves the stage down, and roughly `-(newTopY - 0.6)` keeps it in line
with the existing looks.

**`post`**:

| Field | Controls |
|---|---|
| `bloom` | `null` for the photographic looks. Bloom on a look without a neon subject reads as a glow filter rather than as light. |
| `vignette` | `0` for none. Used only on the two dark looks. |
| `dof.focusRange` | World units either side of the focus plane that stay sharp. The focus plane is always pinned to the podium top. Big enough that the whole plinth is crisp — ~2× `radius`. |
| `dof.bokehScale` | How far the backdrop softens. **Calibrated at 1080p** and scaled by buffer height at render time, so previews and 4K masters match. Mild: 3–6. |
| `grain` | ~0.015. Also gives the encoder something to hold on to. |
| `dither` | Triangular-PDF noise in 8-bit steps, applied before the encode. Raise it for a look with large flat gradients — look 4 uses 0.9. |
| `toneMapping` | `"neutral"` (Khronos PBR Neutral) holds pastel hues without desaturating them — the photographic looks. `"aces"` gives neon highlights a filmic rolloff — the neon looks. |
| `exposure` | Renderer exposure. |
| `envIntensity` | Strength of the image-based lighting. Low (0.1–0.3) for the dark looks, high (0.75–0.9) for the light ones. |

**`palettes`** — `suffix` becomes the composition id suffix and the delivered
filename. Each look reads the subset of colour slots it needs; a slot left
undefined is simply unused.

### 3. If the structure is new

Add a scene component in `src/looks/`, add its name to the `SceneKind` union
in `src/looks/types.ts`, and add a case to the switch in `src/PodiumStage.tsx`.
The scene receives `{ look, palette, t }` and should:

- render its own backdrop, lights and `<Plinth spec={look.plinth} …>`,
- wrap stage content in `<group position={[0, look.stageOffsetY, 0]}>`,
- pick its own `<StageShadows>` softness — that is a property of the look's
  lighting, not of the rig,
- **leave the podium top completely empty.** No product, no placeholder, no
  text, no logo. The moment something sits on it, the clip becomes one
  person's product shot instead of a stage anyone can license.

`Root.tsx` picks the new compositions up automatically.

---

## Notes on the build

**Shadows are PCSS (`<SoftShadows>`), never `<AccumulativeShadows>`.** drei's
accumulative shadows build their result over successive frames; Remotion
renders frames out of order across threads, so they produce inconsistent,
flickering output. They are the right tool for a still and the wrong one here.
PCSS is evaluated fresh every frame from the shadow map, so frame 200 looks
the same whoever renders it and whenever.

**Look 1's venetian blind is real geometry**, not a texture projected through
the light: a rack of tilted slats between the key and the stage, invisible to
the camera but present in the shadow pass. That way the penumbra grows
correctly with distance from the occluder — crisper high on the wall, softer
where the slats run out across the floor — and the drift is done by
translating the blind, so the light *direction* never changes and a buyer has
one fixed shadow direction to match for the whole clip.

**Look 2's cone is a raymarch** through an actual density field, terminated
analytically against the ground plane and the plinth rather than against a
depth buffer. The scene it has to respect is a plane and a capped cylinder,
both of which have closed-form intersections.

**Look 3's floor is a real planar reflector.** A gradient environment map has
nothing in it to reflect — which is exactly why it is right for the plinth
bevels and wrong for the floor.

**Grain and dither are one pass, last in the chain**, keyed on the frame
*number* rather than on `postprocessing`'s built-in `time` uniform, which
accumulates from a clock and would make the grain depend on when a frame was
rendered rather than which frame it is.

---

## Project layout

```
public/hdri/            Generated environment map (CC0)
scripts/make-hdri.mjs   Regenerates it
src/
  Root.tsx              Registers all eight compositions from the data
  PodiumStage.tsx       The template: canvas, HDRI, camera, focus, post
  looks/
    data.ts             ← the look list. Start here.
    types.ts            The data contract, field by field
    BlindShadow.tsx  HaloRing.tsx  NeonTier.tsx  BubbleDrift.tsx
    volumetric.ts       Raymarch shaders for look 2
  rig/
    Rig.tsx             Locked camera, tone mapping, soft shadows, scene fog
    Plinth.tsx  plinthGeometry.ts   Parametric plinth
    Backdrop.tsx  Glow.tsx  textures.ts  environment.tsx
  post/
    Post.tsx  GrainDither.tsx
  lib/
    random.ts           mulberry32 + look-id seeding
    loop.ts             Loop-safe time helpers
```
