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

All eight compositions are configured, rendered and visually checked — both
palettes of every look. The four palette-A compositions additionally ship as
1080p preview clips and 1080p stills.

| # | Look | Palette A | Palette B |
|---|---|---|---|
| 1 | **Blind Shadow** — warm plaster wall, venetian blind gobo drifting across wall and floor, matte charcoal disc | ✅ `BlindShadow-PodiumA` (Terracotta) — **preview + still rendered** | ✅ `BlindShadow-PodiumB` (Grey-green) — configured, checked, not rendered |
| 2 | **Halo Ring** — glowing neon ring over a dark disc in a fogged void, volumetric light cone | ✅ `HaloRing-PodiumCyan` (Cyan / blue) — **preview + still rendered** | ✅ `HaloRing-PodiumMagenta` (Magenta / violet) — configured, checked, not rendered |
| 3 | **Neon Tier** — two-tier black plinth with neon edge strips, polished floor, slab wall | ✅ `NeonTier-PodiumCyan` (Cyan neon) — **preview + still rendered** | ✅ `NeonTier-PodiumAmber` (Amber neon) — configured, checked, not rendered |
| 4 | **Bubble Drift** — high-key lilac void, white cylinder plinth, translucent spheres drifting down | ✅ `BubbleDrift-PodiumLilac` (Lilac) — **preview + still rendered** | ✅ `BubbleDrift-PodiumMint` (Mint) — configured, checked, not rendered |

The palette-B set ships render-ready but unrendered, as specified. Each is a
colour change on a verified scene: it shares its look's geometry, lighting and
seeded arrangement exactly, because the PRNG is keyed on the look id and never
on the palette.

### What "verified" means here

Every delivered clip was checked on the encoded file, not on the render:

- **Container** — 1920×1080, 30 fps, exactly 300 frames, 10.000 s, one stream
  and no audio track.
- **Colour** — `yuv420p`, `color_range=tv`, BT.709.
- **Frame consistency** — mean pixel value sampled across the clip, to catch
  anything that differs between the first captured frame and the rest (see the
  frame-0 note below; this is how the missing image-based lighting was found).
- **Loop** — the 299→0 step compared against ordinary adjacent-frame steps, on
  *losslessly rendered* frames rather than the encoded file. All four measure
  about 1.0x, i.e. the wrap is indistinguishable from any other frame advance.
- **Banding** — longest run of identical pixel values down a slice of the
  largest gradient, against the same slice of the lossless still.

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
npx remotion render BlindShadow-PodiumA     out/BlindShadow_PodiumA.mp4     --scale=1 --crf=12
npx remotion render BlindShadow-PodiumB     out/BlindShadow_PodiumB.mp4     --scale=1 --crf=12
npx remotion render HaloRing-PodiumCyan     out/HaloRing_PodiumCyan.mp4     --scale=1 --crf=12
npx remotion render HaloRing-PodiumMagenta  out/HaloRing_PodiumMagenta.mp4  --scale=1 --crf=12
npx remotion render NeonTier-PodiumCyan     out/NeonTier_PodiumCyan.mp4     --scale=1 --crf=12
npx remotion render NeonTier-PodiumAmber    out/NeonTier_PodiumAmber.mp4    --scale=1 --crf=12
npx remotion render BubbleDrift-PodiumLilac out/BubbleDrift_PodiumLilac.mp4 --scale=1 --crf=12
npx remotion render BubbleDrift-PodiumMint  out/BubbleDrift_PodiumMint.mp4  --scale=1 --crf=12
```

`remotion.config.ts` supplies the rest: H.264, CRF 12, BT.709 and muted. The
`--crf=12` above is explicit so each command reads completely on its own.

### Why CRF 12 *and* PNG frames

The post chain dithers every gradient before it is written, which is what stops
the large smooth backdrops banding. Two separate stages then throw that away,
and fixing either one alone achieves almost nothing.

**Remotion writes each video frame to disk before encoding it, and the default
format is JPEG** — a lossy step that lands on the output before H.264 sees it.
**Then x264 quantises what low-amplitude noise remains** in flat areas to
nothing.

Measured on look 4's lilac field, the worst case in the set — the longest run
of identical pixel values down a 900 px slice, and the share of adjacent pixels
that differ at all:

| pipeline | longest flat run | adjacent pixels differing |
|---|---|---|
| rendered frame (what the post chain produces) | 9 px | 57% — dither intact |
| JPEG frames, crf 18 | 200 px | 4% |
| JPEG frames, crf 12 | 200 px | 4% — CRF makes no difference at all |
| PNG frames, crf 18 | 502 px | 3% — worse; the encoder now does the damage |
| **PNG frames, crf 12** | **68 px** | **21% — most of the dither survives** |

The JPEG row is the important one: with JPEG frames the CRF is irrelevant,
because the damage is already done by the time the encoder runs. That is why
the project sets **both** `setVideoImageFormat("png")` and `setCrf(12)`.

The dark looks are far less affected — look 3 measures 46 px / 45% even through
the JPEG path — because there is enough detail for both stages to preserve. But
the set ships at one setting.

This matters *more* at 4K, not less: the same gradient spans twice as many
pixels, so each band is twice as wide.

**The cost is file size, and it is not evenly spread.** CRF 12 preserves noise,
and the looks differ enormously in how much noise they contain. The 1080p
10-second previews come out at:

| Look | Shipped: PNG frames, CRF 12 | Earlier: JPEG frames, CRF 18 | Why the gap |
|---|---|---|---|
| Bubble Drift | 11 MB | 12 MB | the look CRF 12 exists for |
| Blind Shadow | 16 MB | — | |
| **Halo Ring** | **45 MB** | 8 MB | volumetric haze, grain and raymarch jitter — all noise, all now preserved |
| **Neon Tier** | **75 MB** | 15 MB | polished-floor reflections plus grain, ditto |

Those two columns are different pipelines, not just different CRFs, so the gap
is the combined effect of both changes — but the direction is clear enough to
act on. 4K masters scale roughly 4x, so Neon Tier's 4K master at CRF 12 is in
the region of 300 MB for ten seconds.

Note that Bubble Drift — the look this setting exists for — barely changes
size. All the cost lands on the looks that did not need it.

One setting for the whole set is the simple choice and what ships, but it is a
simplification: **only look 4 actually needs CRF 12.** The dark looks measure
clean at 18 (look 3: 46 px / 45%) because they have enough detail for both the
JPEG stage and the encoder to keep. If size matters more to you than
uniformity, render look 4 at `--crf=12` and the rest at `--crf=18`, and check
the result with the recipe below — Halo Ring in particular drops by roughly
six times with no visible change, because there is no smooth gradient in it to
protect.

If you change a backdrop, re-run the check on the encoded file rather than the
render:

```bash
ffmpeg -i out/BubbleDrift_PodiumLilac.mp4 -vf "select='eq(n\,40)'" -frames:v 1 /tmp/f.png
# compare a vertical slice of /tmp/f.png against the same slice of the PNG still;
# a long run of identical values is a band
```

### Settings that are easy to lose

Two of the config defaults are easy to lose if you render through the Node APIs
(where the config file does not apply) and must then be passed explicitly:

- **`setColorSpace("bt709")`** — without it the encoder emits `yuvj420p` with
  `color_range=pc`. That is self-consistent full-range video, but any tool
  that ignores the range flag reads it as limited range and crushes the blacks
  and clips the highlights. With it, output is `yuv420p`, `color_range=tv`,
  BT.709. Note that `setPixelFormat("yuv420p")` on its own does **not** fix
  this — it leaves the full-range tag in place.
- **`setMuted(true)`** — these have no audio by design, but Remotion otherwise
  muxes a silent AAC track into the output. With it, the files carry a video
  stream and nothing else.

Verify both on a delivered file:

```bash
ffprobe -v error -show_entries stream=codec_type,pix_fmt,color_range -of csv=p=0 out/BlindShadow_PodiumA.mp4
# video,yuv420p,tv      <- one line only; no audio stream
```

### 1080p previews

Same compositions, half scale. `--scale` sets Chromium's device scale factor,
so this renders a genuine 1920×1080 buffer from the 3840×2160 composition
rather than downscaling a 4K frame:

```bash
npx remotion render BlindShadow-PodiumA out/BlindShadow_PodiumA.mp4 --scale=0.5 --crf=12
```

### Stills

Every composition is also a saleable still. The frame to export is stored per
look as `stillFrame` in the data row, chosen where that look's motion sits at
a good point:

```bash
npx remotion still BlindShadow-PodiumA     out/BlindShadow_PodiumA.png     --frame=96  --scale=1.5625
npx remotion still HaloRing-PodiumCyan     out/HaloRing_PodiumCyan.png     --frame=38  --scale=1.5625
npx remotion still NeonTier-PodiumCyan     out/NeonTier_PodiumCyan.png     --frame=120 --scale=1.5625
npx remotion still BubbleDrift-PodiumLilac out/BubbleDrift_PodiumLilac.png --frame=40  --scale=1.5625
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

| Look | Per frame (1080p) | Whole 300-frame clip | Still |
|---|---|---|---|
| Bubble Drift | 5.5 s | 28 min | 16 s |
| Blind Shadow | 9.3 s | 46 min | 21 s |
| Neon Tier | 11.1 s | 55 min | 28 s |
| **Halo Ring** | **30.7 s** | **2 h 33 min** | 66 s |

Whole preview set: about 4 h 40 min on this machine.

Measured at `--scale=0.5 --concurrency=3`. Note that concurrency buys almost
nothing here: SwiftShader already saturates every core on a single frame, so
three tabs each take three times as long and throughput is unchanged. On a
machine with a GPU, raise it.

The profile is lopsided, and worth understanding before scheduling a 4K run:

- **Halo Ring is 3-6x every other look**, entirely because of the raymarched
  light cone. If the cost is unworkable, lower `volumetricSteps` on its data
  row before touching fog quality - the cone is the point of the look, the
  ground haze is not. It is a compile-time constant in the shader, so the
  saving is close to linear: 48 -> 32 steps is roughly a third off.
- **Neon Tier** is next, because the polished floor is a real planar reflector
  and re-renders the scene every frame.
- 4K is 4x the pixels of 1080p. On hardware like this that puts a single 4K
  Halo Ring master in the region of ten hours, which is really a statement
  about rendering WebGL on a CPU rather than about the project - a GPU changes
  the picture completely.

One more thing worth knowing if you profile this yourself: **the 3D scene is
not the expensive part.** With the post chain disabled the scene renders in
about 0.2 s per frame; depth of field alone accounted for roughly 87% of the
total. That is why `DOF_RESOLUTION_SCALE` in `src/post/Post.tsx` is the single
most effective performance dial in the project, and why the shadow sample
count and shadow map size - the obvious suspects - turned out not to matter
measurably.

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

### Checking a loop, and the trap in checking it

The useful measure is not whether frame 299 equals frame 0 - it should not,
they are one step apart - but whether the step *from* 299 *to* 0 is the same
size as any other step. Compare the mean absolute difference across the wrap
against the difference between two ordinary adjacent frames; a ratio near 1
means the wrap is indistinguishable from a normal frame advance.

**Measure it on losslessly rendered frames, not on the encoded file.** Frame 0
is an IDR keyframe, encoded independently of everything around it, so a
299-to-0 comparison in an H.264 file always includes a quantisation delta that
299-to-298 does not. On this project that confound alone reads as roughly 5x,
which is large enough to look exactly like a real seam:

```bash
npx remotion still <id> /tmp/f0.png   --frame=0   --scale=0.25
npx remotion still <id> /tmp/f298.png --frame=298 --scale=0.25
npx remotion still <id> /tmp/f299.png --frame=299 --scale=0.25
# then compare mean |f299 - f0| against mean |f299 - f298|
```

Measured that way, all four looks sit at about 1.0x.

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

**A still is not a preview of the clip — be careful extending this.** Remotion
captures frame 0 as soon as every `delayRender` handle is released, which can
be *before* React's passive effects have run. Anything a component sets up in
a plain `useEffect` — an environment map, a renderer setting, a global shader
patch — may therefore be absent from frame 0 and present in frames 1 onward.
Because `npx remotion still` and the studio only ever render frame 0, that
failure is invisible in every check short of rendering the clip and comparing
frames. This project hit it with the environment map: stills showed a scene
with no image-based lighting while the clip had it, and the looks were lit
against the wrong image.

The rule this project follows: anything that must be true of the rendered
frame is installed in a **layout** effect, and the `delayRender` handle is not
released until it is actually in place (see `src/rig/environment.tsx`). If you
add something similar, do the same, and sanity-check by rendering a handful of
frames and comparing their mean pixel value — frame 0 should match frame 5.

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
