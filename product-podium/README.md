# Product Podium Stages — Set 2

Eight empty product-display stages, built as one Remotion + three.js project:
a plinth on a lit backdrop, podium top left clear so a buyer can composite
their own product onto it.

**4 looks × 2 variants = 8 compositions**, all 3840×2160, 30fps, 300 frames
(10s), seamless.

| # | Look | Variant A | Variant B |
|---|------|-----------|-----------|
| 1 | Duotone Glass | `DuotoneGlass-PodiumMagentaCyan` | `DuotoneGlass-PodiumAmberTeal` |
| 2 | Neon Double Ring | `NeonRing-PodiumBlue` | `NeonRing-PodiumMagenta` |
| 3 | Fluted Plaster | `FlutedPlaster-PodiumCylinder` | `FlutedPlaster-PodiumColumnPair` |
| 4 | Wood and Leaf | `WoodLeaf-PodiumCool` | `WoodLeaf-PodiumWarmWalnut` |

Look 3's two variants are two plinth geometries in one identical stage — same
lighting, same shadow, same camera, same material. A second thumbnail for the
cost of a data row.

---

## Quick start

```bash
npm install
npx remotion studio
```

All eight compositions appear in the sidebar.

## Rendering

### 4K video, per composition

```bash
npx remotion render DuotoneGlass-PodiumMagentaCyan   out/DuotoneGlass_PodiumMagentaCyan.mp4   --scale=1 --crf=16
npx remotion render DuotoneGlass-PodiumAmberTeal     out/DuotoneGlass_PodiumAmberTeal.mp4     --scale=1 --crf=16
npx remotion render NeonRing-PodiumBlue              out/NeonRing_PodiumBlue.mp4              --scale=1 --crf=16
npx remotion render NeonRing-PodiumMagenta           out/NeonRing_PodiumMagenta.mp4           --scale=1 --crf=16
npx remotion render FlutedPlaster-PodiumCylinder     out/FlutedPlaster_PodiumCylinder.mp4     --scale=1 --crf=16
npx remotion render FlutedPlaster-PodiumColumnPair   out/FlutedPlaster_PodiumColumnPair.mp4   --scale=1 --crf=16
npx remotion render WoodLeaf-PodiumCool              out/WoodLeaf_PodiumCool.mp4              --scale=1 --crf=16
npx remotion render WoodLeaf-PodiumWarmWalnut        out/WoodLeaf_PodiumWarmWalnut.mp4        --scale=1 --crf=16
```

`remotion.config.ts` already pins PNG intermediates, h264, `yuv420p` and
CRF 16. PNG rather than JPEG is deliberate: look 1's dark gradient, look 2's
true-black field and look 3's soft near-white are all things a JPEG
intermediate would band.

### Stills — 6000×3375

Every composition is also a saleable still. The frame to hold is stored per
row as `stillFrame` in `src/podium/looks.ts`.

```bash
npx remotion still DuotoneGlass-PodiumMagentaCyan  out/stills/DuotoneGlass_PodiumMagentaCyan.png  --frame=42  --width=6000 --height=3375
npx remotion still DuotoneGlass-PodiumAmberTeal    out/stills/DuotoneGlass_PodiumAmberTeal.png    --frame=42  --width=6000 --height=3375
npx remotion still NeonRing-PodiumBlue             out/stills/NeonRing_PodiumBlue.png             --frame=96  --width=6000 --height=3375
npx remotion still NeonRing-PodiumMagenta          out/stills/NeonRing_PodiumMagenta.png          --frame=96  --width=6000 --height=3375
npx remotion still FlutedPlaster-PodiumCylinder    out/stills/FlutedPlaster_PodiumCylinder.png    --frame=150 --width=6000 --height=3375
npx remotion still FlutedPlaster-PodiumColumnPair  out/stills/FlutedPlaster_PodiumColumnPair.png  --frame=150 --width=6000 --height=3375
npx remotion still WoodLeaf-PodiumCool             out/stills/WoodLeaf_PodiumCool.png             --frame=210 --width=6000 --height=3375
npx remotion still WoodLeaf-PodiumWarmWalnut       out/stills/WoodLeaf_PodiumWarmWalnut.png       --frame=210 --width=6000 --height=3375
```

PNG is lossless, so any banding in a still came out of the render, not the
file. The 1.5% grain doubles as a dither and is applied before the write.

### 1080p preview

```bash
npx remotion render <id> out/<name>.mp4 --scale=0.5 --crf=16
```

### Chromium GL flag

WebGL in headless Chromium needs an explicit renderer. `remotion.config.ts`
reads `PODIUM_GL` and defaults to `swangle`:

```bash
PODIUM_GL=angle    npx remotion render ...   # machines with a GPU
PODIUM_GL=swangle  npx remotion render ...   # no GPU — ANGLE over SwiftShader (default)
```

`--gl=angle` is the documented flag; on a machine without a GPU it is
`swangle` that actually gets a context, and that is what the timings below
were measured with. Set `PODIUM_CONCURRENCY` to cap parallel tabs — software
GL is memory-hungry.

---

## How it is built

```
src/
  Root.tsx                     all 8 compositions, registered from the data table
  podium/
    looks.ts                   THE DATA TABLE — 4 looks × 2 variants
    types.ts                   config shapes + composition constants
    PodiumStage.tsx            the fixed rig: camera, renderer, tone, post
    SoftShadows.tsx            PCSS, patched into three's shadow shader
    Canopy.tsx                 the foliage gobo (a real occluder, not an overlay)
    ContactAO.tsx              occlusion crease where a plinth meets the ground
    Grade.tsx                  depth of field, vignette, grain
    environment.ts             procedural neutral studio environment map
    textures.ts                procedural foliage, wood, plaster, gradients
    random.ts                  mulberry32 + value noise
    loop.ts                    loop-safe time
    plinths/geometry.ts        parametric disc and fluted-shaft builders
    plinths/Plinths.tsx        disc / fluted cylinder / classical column
    scenes/                    one component per look
tools/
  px.mjs, png.mjs              pixel inspection for the verify loop
  check.mjs                    the per-look criteria, as code
  render-previews.sh           the preview batch
```

The camera rig, the shadow technique and the post chain are fixed and live in
`PodiumStage.tsx`. A look supplies geometry, materials and lights; it does not
get to move the camera or change the post chain. That is what keeps eight
compositions looking like one product.

### The camera is locked

Buyers license these to composite their own product onto the plinth. If the
camera orbits they have to motion-track to a moving stage, so: no orbit, no
rotation, no roll, no arc, no parallax, no easing. Every composition uses the
same 23° vertical field of view — about a 50mm lens on 16:9 full frame, so
there is no wide-angle bow on the plinth — tilted about 7° below horizontal,
with the podium top between 40% and 50% of frame height.

`camera.push` in each data row is the one permitted exception: a perfectly
linear zoom that a buyer matches with a single scale keyframe. **It ships at
0 on every row**, because a push cannot also be a seamless loop — frame 300
would not equal frame 0 — and for a clip that sits under a product shot for
minutes at a time the loop is the harder requirement. Set it to `0.04` for a
4% push if you want one, and accept that the clip then has a seam.

Note that `push` is applied as a change of focal length, never as a dolly. A
zoom scales the image about its centre with no parallax at all; a dolly would
shift the plinth against its backdrop and defeat the point.

### Looping

`LOOP_FRAMES` (300) is the animation period and is deliberately a separate
constant from the composition's duration. Every animated quantity — gobo
sway, key-light breathing, ring pulse, travelling ring segment — completes a
whole number of cycles over it, and noise is sampled on a circle in time
(`noise(x, cos 2πt, sin 2πt)`) so that it returns exactly to where it
started. Frame 300 is byte-identical to frame 0, verified.

Keeping the period separate from the duration is what lets you run the
closure test properly: set `DURATION_IN_FRAMES = LOOP_FRAMES + 1`, render
frames 0 and 300, compare, set it back. Tying the period to
`durationInFrames` would move the finish line the test is trying to check.

### Shadows

PCSS — a blocker search followed by a variable-width filter, so the penumbra
grows with the distance between occluder and receiver. Not
`<AccumulativeShadows>`: that builds its result over successive frames, and
Remotion renders frames out of order across threads, so it flickers.

`src/podium/SoftShadows.tsx` patches three's shadow chunk directly rather
than using drei's `<SoftShadows>`, which is written against an older three:
it anchors on the first `#if defined( SHADOWMAP_TYPE_PCF )` in the chunk,
which in three 0.182 is a uniform declaration rather than the body of
`getShadow`, and it still unpacks RGBA-encoded depth, which three no longer
writes. **The patch throws if it cannot find its anchor**, so a three upgrade
that moves the shader fails loudly instead of quietly shipping hard shadows.

The sample rotation comes from a per-pixel hash of `gl_FragCoord`. With a
locked camera a given screen pixel keeps the same rotation on every frame, so
the sampling pattern never crawls.

### The foliage gobo

Looks 3 and 4 put a **real occluder in the light path** — a plane carrying a
procedurally generated leaf alpha, hung between the key and the stage and
above the camera frustum — not a shadow layer painted over the wall. A
painted layer is the obvious tell: it sits flat on the wall, stops at the
wall/floor seam and slides straight over the plinth. A real occluder gives
all three for free:

* the pattern crosses wall **and** floor and bends at the seam, because it is
  one projection through one occluder onto both surfaces;
* it wraps over the plinth, because the plinth stands in the same light;
* it softens with distance from the occluder, because the shadow is PCSS.

It sways as a rigid rotation and drift of the whole canopy, so the pattern
moves as one coherent thing rather than scrolling.

Two things worth knowing if you retune it. The occluder plane **must be large
enough to cover the key's whole cone** — light that misses it reaches the
stage unobstructed and leaves a clean quadrant with no shadow at all. And the
canopy is described in **world units** (`leafSize`, `branchSize`, `blur` on
the occluder plane) precisely so `planeSize` can change without resizing
every leaf.

The difference between look 3's very soft out-of-focus foliage and look 4's
defined leaf edges is only where the canopy hangs and how big the source is —
same component, same generator, two data rows.

### Depth of field

A screen-space blur whose radius varies across the frame, run as a WebGL
pass (`src/podium/DepthOfFieldPass.tsx`). Because the camera is locked the
far field occupies a fixed region of frame, so the radius can be a function
of screen position alone — no depth buffer, nothing sampled temporally,
nothing that could differ between two render threads. `dof.layers` ramp the
blur by frame height, `dof.sharp` punches out the elliptical pocket the
plinth lives in, and `sharp.keepMin` leaves a trace of blur inside that
pocket so the plinth's silhouette is not razor-sharp against a soft field.

**Do not reach for CSS here.** This began as a masked `backdrop-filter`,
which is the obvious and much cheaper way to do it, and it does not work:
Remotion's headless capture does not carry CSS paint effects applied to or
over a WebGL canvas. Raising the blur radius 5.5× moved the wall's measured
detail by 10%; a plain `filter: blur(20px)` wrapped round the canvas moved
it by 8%. Both were doing nothing. DOM overlays that merely paint — the
grain and the vignette — do survive, which is why those are still DOM.

The file's header comment records the other three dead ends, all of which
present as "the effect is just too weak": taking over the render loop with
a priority-1 `useFrame`, `addAfterEffect` never firing, and redirecting the
scene into a render target (which silently loses tone mapping, because
three compiles materials with `NoToneMapping` whenever they render into
one).

### Grain, vignette, bloom

Grain is a 1.5% deviation blended with `overlay`. Overlay leaves a black
pixel black, which is what lets look 2 carry grain over its lit areas and
still encode true 0,0,0 in the corners, and it keeps look 1's dark field from
being lifted. The cost is that overlay scales the deviation by the local
contrast: measured on a lossless 1080p still, look 3's near-white wall (level
205) carries about ±1.5 levels, and a midtone carries up to ±3.8. That is
ample as a dither — banding steps are one level — and it is why the grain
reads as a surface rather than as a layer sitting on top.

Judge banding on the **encoded file**, not the studio preview. Note that
h264 at CRF 16 smooths fine grain: the same wall measures ±1.5 levels in the
PNG still and about ±0.25 after encoding. The stills keep the full grain.

There is **no bloom pass anywhere**. Looks 1, 3 and 4 are photographic and
should have none — look 1's glow is real light scatter in the glass. Look 2's
neon glow is built as a volume: nested shells around the tube, drawn
additively, each carrying the value of the glow field at its own radius, so a
view ray accumulates the shells it crosses. A screen-space bloom would have
been easier and would have bled a few levels into every pixel of frame,
destroying look 2's second use case.

### Look 2 screen-blends

Look 2's field is true `#000000` outside the glow — verified in the encoded
file, not just the preview. That makes the composition usable as a
**screen-blend overlay**: a buyer can lay it over their own background in any
editor set to Screen or Add, and only the rings and their glow carry through.
It is a second use case for free, and it is the reason the look has no
environment map, no fill light, a black-diffuse floor and no bloom pass —
every one of those would lift the field off zero.

### Environment map

The reflections in look 1's glass and look 2's floor need something to
reflect. This project **generates** a neutral studio gradient as a
floating-point equirectangular map (`src/podium/environment.ts`): a broad
overhead source, a soft front fill, a darker floor, and no object of any kind.

That is a deliberate substitution for a downloaded HDRI. Any real studio HDRI
— Poly Haven's included — has recognisable softboxes or windows in it, and
those turn up in the reflections on a stage a buyer is going to composite
onto: visibly wrong, and a licence question on top. Generating the map means
there is nothing to attribute, nothing to download at render time and nothing
recognisable in any reflection.

**Licence: none required.** The map is generated by project source at runtime;
no third-party asset ships in this project, and there is no image, HDRI,
texture or plate of any kind in `public/`.

To use a real HDRI instead, drop an `.hdr` in `public/`, load it with
`@react-three/drei`'s `<Environment files="..." />` in place of the
`<primitive object={env} attach="environment" />` line in each scene, and
pick something without a recognisable window, softbox or object in it.

### Everything is procedural and deterministic

Every random value is a pure function of a seed (mulberry32, keyed on the
look id) and every animated value is a pure function of `useCurrentFrame()`.
No `useFrame` clock, no delta accumulation, no `Math.random`, nothing that
depends on call order — because Remotion renders frames out of order across
threads. The leaf masks, the wood grain, the plaster tooth and the
environment map are all generated in-project; there is no photographic plate
anywhere in the set.

---

## Adding a look or a geometry variant

**A new variant of an existing look** is one row in `src/podium/looks.ts` and
nothing else. Copy the row, change `id`, `outName`, `variant`,
`variantLabel`, and whatever palette or geometry fields the variant is about.
It appears in the studio on save. That is what look 3's column pair is: the
same stage, the same lighting, the same shadow, a different plinth.

**A new plinth geometry** goes in `src/podium/plinths/`. The two builders in
`geometry.ts` cover most of it — `discGeometry` (radius, height, bevel,
planar UVs on the top face) and `flutedGeometry` (radius, height, flute
count, flute depth, flute sharpness, taper). Compose them in a component the
way `FlutedCylinder` and `Column` do, then branch on a field in the look's
`params`.

**A whole new look** is four steps:

1. Add a `params` shape to `src/podium/types.ts` and put it in the
   `LookParams` union. The union is exhaustively switched, so TypeScript will
   now tell you everywhere that needs the new case.
2. Write `src/podium/scenes/<Name>Scene.tsx`. It receives `params` and
   returns lights, geometry and materials — no camera, no post.
3. Add the case to the `Scene` switch in `PodiumStage.tsx`, and a softness
   value to `shadowSoftness()`.
4. Add two rows to `STAGES`.

`Root.tsx` never changes; it registers whatever is in the table.

Things a new look should not do: move the camera (the whole set is one rig),
add its own post chain (`Grade` is shared), put anything on the podium top,
or animate from anything other than `useCurrentFrame()`.

---

## Verifying

```bash
# per-look criteria, on a rendered frame or straight off the mp4
node tools/check.mjs out/preview/WoodLeaf_PodiumCool.mp4 WoodLeaf-PodiumCool

# container, frame rate, duration, audio
npx remotion ffprobe out/preview/<file>.mp4
```

`tools/check.mjs` encodes the per-look criteria as code: where the podium top
sits in frame, whether the colours mix across look 1's disc, whether look 2's
corners are truly 0,0,0, whether look 3's flutes have a lit and a shaded
side, whether look 4's plinth is warmer than its field. `tools/px.mjs` and
`tools/png.mjs` do the decoding — Remotion's bundled ffmpeg is a reduced
build with no rawvideo muxer, so frames come out as PNG and are decoded
in-process.

### Loop-closure test

```bash
# in src/podium/types.ts
export const DURATION_IN_FRAMES = LOOP_FRAMES + 1;
```

Render frames 0 and 300 as stills, confirm they are pixel-identical, set the
duration back.

---

## Measured render times

4 vCPU, no GPU, `PODIUM_GL=swangle` (ANGLE over SwiftShader), default
concurrency, 1920×1080 (`--scale=0.5`), including bundle and encode:

| Composition | 1080p s/frame | 1080p, 300 frames | 4K estimate |
|---|---|---|---|
| `NeonRing-PodiumBlue` | 2.5 | ~13 min | ~50 min |
| `FlutedPlaster-PodiumCylinder` | 5.5 | ~28 min | ~1h 50m |
| `WoodLeaf-PodiumCool` | 7.0 | ~35 min | ~2h 20m |
| `DuotoneGlass-PodiumMagentaCyan` | 11.1 | ~55 min | ~3h 40m |

The 4K column is the 1080p figure ×4, since these are fill-rate bound under
software rasterisation — PCSS taps, the transmission pass and the shell stack
all scale with pixel count. On a GPU with `PODIUM_GL=angle` expect it to be
one to two orders of magnitude faster; treat the table as a worst case.

Look 1 is the expensive one: transmission costs a second full render of the
scene every frame. `TransmissionBudget` in `DuotoneGlassScene.tsx` halves the
resolution of that pass, which is invisible through 0.45-roughness frost. If
you need to cut further, cut transmission resolution again before you cut the
frost quality — the scatter is what the look is made of, the refraction
accuracy is not.

## Anti-aliasing

MSAA is on (`antialias: true`), and the fluted plinth's ridges and the wood
disc's silhouette are where stair-stepping shows first. The 1080p previews
get a second free pass: at `--scale=0.5` the page lays out at 3840 and is
captured at 1920, so the frame is downsampled 2×. A 4K render at `--scale=1`
has only MSAA. If you want the same margin at 4K, render at `--scale=2` and
downscale — expect four times the render time.

## No audio

These are silent by design, and `remotion.config.ts` turns the audio track
off explicitly (`setEnforceAudioTrack(false)` + `setMuted(true)`). Left to
itself Remotion writes a silent AAC stream into the mp4, which costs more
than a stream a buyer has to strip: AAC frames do not land on the 300th
video frame, so the container reports 10.048s instead of exactly 10.000s and
the loop point moves.

```bash
npx remotion ffprobe out/preview/<file>.mp4
```

should show exactly one stream, `codec_type=video`, and `duration=10.000000`.
If an audio stream ever appears, fix the render config — do not trim the
finished file.

---

## Completion checklist

| Look | Variant | Configured | Verified in studio | 1080p preview | 1080p still |
|---|---|---|---|---|---|
| 1 — Duotone Glass | A · magenta / cyan | ☑ | ☑ | ☑ | ☑ |
| 1 — Duotone Glass | B · amber / teal | ☑ | ☑ | — by design | — by design |
| 2 — Neon Double Ring | A · electric blue | ☑ | ☑ | ☑ | ☑ |
| 2 — Neon Double Ring | B · magenta | ☑ | ☑ | — by design | — by design |
| 3 — Fluted Plaster | A · single fluted cylinder | ☑ | ☑ | ☑ | ☑ |
| 3 — Fluted Plaster | B · classical column pair | ☑ | ☑ | — by design | — by design |
| 4 — Wood and Leaf | A · cool blue-white, light oak | ☑ | ☑ | ☑ | ☑ |
| 4 — Wood and Leaf | B · warm sand, dark walnut | ☑ | ☑ | — by design | — by design |

"— by design" means the variant ships configured and verified but unrendered,
as scoped: each look is previewed once in variant A, which is where the
structural risk is (refraction, emissive on pure black, gobo shadow, wood
grain). Variant B is then a palette or geometry change on a scene that has
already been proved.

All eight are 4K-render-ready with the commands at the top of this file.

## What is not in here

No text, no watermark, no logo, no product, no placeholder and no brand mark
appears in any composition. No audio track. No third-party asset of any kind:
no HDRI, no texture, no photographic plate, no font.
