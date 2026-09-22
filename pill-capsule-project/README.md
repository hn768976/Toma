# Pills & Capsules

Six looping 3D compositions of pharmaceutical capsules and tablets, built with
Remotion + three.js (`@remotion/three` / react-three-fiber, WebGL2). 30 fps,
16:9, authored at 3840×2160.

| Composition id | Delivered file | Length | Loop |
|---|---|---|---|
| `SinglePill-CapsuleGrey` | `SinglePill_CapsuleGrey.mp4` | 10s / 300f | seamless |
| `SinglePill-TabletBlue` | `SinglePill_TabletBlue.mp4` | 10s / 300f | seamless |
| `SinglePill-BlackMatte` | `SinglePill_BlackMatte.mp4` | 20s / 600f | **not a loop** — see below |
| `FallingPills-MixedWhite` | `FallingPills_MixedWhite.mp4` | 15s / 450f | seamless |
| `FallingPills-BlueCapsule` | `FallingPills_BlueCapsule.mp4` | 15s / 450f | seamless |
| `FallingPills-RedCapsule` | `FallingPills_RedCapsule.mp4` | 15s / 450f | seamless |

---

## ⚠️ Blank-pill constraint — read before editing

Pharmaceutical imagery carries constraints abstract work does not. Every pill in
this project is, and must stay, **completely blank**:

- **No imprint codes, letters, numbers, or logos.** Real pills carry imprints
  identifying the manufacturer and the drug; adding one turns a generic clip
  into a depiction of a specific product.
- **No brand names, packaging, blister packs or labels** anywhere in frame.
- **No famous shape-plus-colour combination.** A distinctive silhouette in a
  distinctive colour can be protected trade dress. The colourways here are
  ordinary capsule and tablet forms in ordinary colours.
- **No implied medical claim.** Nothing in the framing suggests efficacy, a
  condition, or a treatment.

The one modelled surface feature is look 1B's **score line** — a plain shallow
groove across the tablet face, with no lettering. If you add a pill shape or a
colourway, keep it blank. A plain unbranded pill is also what a buyer wants,
because it works for any story.

---

## Running it

```bash
npm install
npx remotion studio
```

Verified from a clean copy of this archive.

### Rendering

```bash
npm run render:previews          # all six at 1920×1080
npm run render:previews -- "" SinglePill-CapsuleGrey   # just one
npm run render:stills            # 1080p still + 6000×3375 harvest per comp
```

The 4K render command per composition, run directly:

```bash
npx remotion render SinglePill-CapsuleGrey  out/SinglePill_CapsuleGrey_4K.mp4  --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --concurrency=4
npx remotion render SinglePill-TabletBlue   out/SinglePill_TabletBlue_4K.mp4   --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --concurrency=4
npx remotion render SinglePill-BlackMatte   out/SinglePill_BlackMatte_4K.mp4   --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --concurrency=4
npx remotion render FallingPills-MixedWhite out/FallingPills_MixedWhite_4K.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --concurrency=4
npx remotion render FallingPills-BlueCapsule out/FallingPills_BlueCapsule_4K.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --concurrency=4
npx remotion render FallingPills-RedCapsule out/FallingPills_RedCapsule_4K.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png --concurrency=4
```

Omit `--scale` for 4K (the compositions are already 3840×2160); the previews add
`--scale=0.5`.

### Stills

```bash
npx remotion still SinglePill-CapsuleGrey out/still.png --frame=42 --scale=1.5625
```

`--scale=1.5625` is 6000×3375 from the 3840-wide composition. The harvested
frames per composition are stored in the data rows (`stillFrames` in
`src/data/looks.ts`), three per composition. On look 3 the field is completely
rearranged between those frames, so they are genuinely distinct images. PNG
throughout — no compression artifacts, and the dither survives.

### Chromium

Headless Chromium needs the ANGLE GL backend. `remotion.config.ts` sets it:

```ts
Config.setChromiumOpenGlRenderer("angle");
```

Without it the compositions render black or fall back to a software path and
crawl. If you render through the Node APIs rather than the CLI, pass
`chromiumOptions: { gl: "angle" }` yourself — the config file does not apply
there.

### Measured render time

See **Performance** at the end of this file.

---

## Look 2's matte-pass structure

`SinglePill-BlackMatte` is **600 frames, and is not a loop**. It is two passes
back to back, driven by the same seeded values and the same frame-derived
motion, so they align frame for frame:

- **Frames 0–299 — beauty.** The red/white capsule on pure black, lit by a rim
  and a key, with mild depth of field and film grain.
- **Frames 300–599 — luma matte.** The identical animation as a solid white
  silhouette on pure black: no shading, no highlight, no depth of field, no
  grain, no tone mapping, and no soft edge beyond one pixel of antialiasing.
  A buyer keys the pill over their own footage with it.

**The beauty half is a self-contained 10-second loop** — frame 300 of the
animation equals frame 0 — so it can be cut out and used on its own. Do not
keyword the 20-second file as a loop.

The background in both halves is `#000000` and stays 0,0,0 through the encode
(checked by `npm run verify:encoded`). The grain is luminance-gated for exactly
this reason: it never touches a black pixel.

---

## Adding a colourway or a pill shape

Everything that varies between the six compositions is a row in
`src/data/looks.ts`. Geometry, materials, the motion system, the camera and the
post chain are fixed.

**A new colourway** is one row. Copy the nearest existing row, change `id`,
`fileName`, `colourway` and `backdrop`, and add it to `SINGLE_ROWS` or
`FALLING_ROWS`. `FallingPills-RedCapsule` is exactly this: it shares
`UNIFORM_CAPSULE_FIELD` with the blue one, so the two have identical geometry
and identical pill positions and differ only in colour.

```ts
{
  ...FALLING_ROWS[1],
  id: "FallingPills-GreenCapsule",
  fileName: "FallingPills_GreenCapsule.mp4",
  colourway: { cap: "#1d6b2f", body: "#f4f3ef" },
}
```

**Backdrop colours are authored as the colour the finished file should show.**
They are solved back through the inverse of AgX at build time
(`src/lib/tonemap.ts`), so `#84aef8` renders as `#84aef8`. Deeply saturated
colours are outside what AgX can produce; `preToneMapSolve` returns how far
short it fell, in linear units.

Pill colours are **not** pre-compensated — they are albedos, and the lighting
multiplies them. Expect an albedo to render considerably lighter and less
saturated than it looks as a swatch; `tools/calibrate.mjs` solves for the
albedo that lands on a target colour from one render.

**A new pill shape** is a builder in `src/lib/pill-geometry.ts` added to `GEOM`,
a case in `src/scene/Pill.tsx` (hero) or a bucket in `src/scene/PillField.tsx`
(field), and a `shapes` entry with a weight in a falling row:

```ts
shapes: [
  { shape: "capsule", weight: 0.34 },
  { shape: "tablet", weight: 0.33 },
  { shape: "caplet", weight: 0.33 },
],
```

Shapes are drawn in a fixed order from the seeded PRNG, so adding one to the
table does not reshuffle the pills that were already there.

---

## How the loops close

**Looks 1 and 2** rotate the pill about a fixed axis by an **integer** number of
full turns over the composition, plus a vertical bob of one integer cycle. 1B
tumbles on two axes with one and two turns — a tumble that never visibly repeats
but still closes exactly.

**Look 3 loops by vertical periodicity, not by wrapping individual pills.** The
field is built over a vertical period `P` and repeated at `y + kP` for a range of
`k` wide enough that the outermost copies are off-screen for the whole loop,
with one spare tile at each end. The whole field then translates down by exactly
`P`:

```
yOffset = -P · (frame / loopFrames)
```

At `frame = loopFrames` every pill sits where its own next copy sat at frame 0,
so the image is identical. No pill pops in or out — they pass through. Each pill
also spins an integer number of turns (1, 2 or 3, drawn per pill) so the field
does not move as a block. There is no horizontal drift and no physics solver.

**The spare tile at each end is what makes it exact** rather than nearly exact.
After the shift the top tile has no successor and the bottom has gained one, and
both of those have to be safely outside the frame.

### Checking it

A 300-frame loop means **frame 300 equals frame 0**, not frame 299 — but a
300-frame composition has no frame 300. Each composition therefore has a
`*-loopcheck` twin registered one frame longer, while the motion still uses the
row's own `loopFrames`. These are **verification-only** and are not part of the
delivery.

```bash
npm run verify:loop
```

It renders frame 0 and the last frame of each check composition and compares
them pixel by pixel. If one does not close, check in this order: the rotation
counts (all integers), the field's vertical period `P` against the translation
distance, the size-jitter seeding, and the grain (`frame % loopFrames`). **Look
3's likeliest failure is the field period.**

---

## Determinism

Remotion renders frames out of order across several threads, so every value on
screen is a pure function of `useCurrentFrame()`.

- No `useFrame` clock, no `Date.now()`, no delta accumulation.
- No `Math.random()` at render time. A `mulberry32` is seeded at module level
  and every value — pill positions, rotation axes and counts, size jitter,
  shape assignment — is drawn once, at build time, from the row's `seed`.
- No physics solver. Positions come from `frame`.
- No mutable state between frames. Instance matrices are recomputed from
  `frame` every frame, never advanced from the previous frame's values.
- **No TAA, no temporal motion blur, no temporally-denoised SSAO, no adaptive
  tone mapping** — nothing that accumulates across frames. Anti-aliasing is
  SMAA and the grain is a spatial hash of `(pixel, frame)`.
- **`AccumulativeShadows` is deliberately not used.** It builds its result
  across frames; out-of-order rendering would make it different on every one.
  Look 1's contact shadow is PCSS (`<SoftShadows>`), which is per-frame.

```bash
npm run verify:determinism                       # FallingPills-BlueCapsule
npm run verify:determinism SinglePill-CapsuleGrey
```

Renders frame 150 alone from a cold start, renders a sequential range
containing frame 150, and compares. They must be identical.

---

## Banding

Smooth pastel and mid-blue gradients across a 4K frame band badly in 8-bit
H.264, and looks 1B, 3A and 3B are mostly gradient. Three defences:

1. **Shader dither on the backdrop gradient.** Multiplicative, not additive:
   the gradient shader works in pre-tone-map linear, where an absolute ±1/255
   is a fifth of the red channel and reads as noise rather than dither.
2. **`material.dithering` on the lit surfaces**, which is three's own ±1/255
   ordered dither on the shading.
3. **Film grain, ~2%**, as the last pass, applied in display space together
   with a true 1-LSB dither. It is a hash of screen coordinates and frame index
   — never `Math.random()` — and is fed `frame % loopFrames` so it is periodic
   over the loop and the loop still closes. Look 2's matte half gets no grain,
   and the grain is luminance-gated everywhere so pure black stays pure black.

**Verify on the encoded mp4, not the preview.** Extract a PNG from the rendered
file and inspect the backdrop along a horizontal and a vertical scanline;
stepped plateaus mean banding.

```bash
npx remotion ffmpeg -ss 5 -i out/FallingPills_BlueCapsule.mp4 -frames:v 1 /tmp/band.png
node -e "import('./tools/png.mjs').then(({readPNG,pixel})=>{const i=readPNG('/tmp/band.png');
  console.log([...Array(40)].map((_,k)=>pixel(i,Math.round(k*i.width/40),Math.round(i.height*0.2))[2]).join(' '))})"
```

---

## What is where

```
src/
  Root.tsx                 six compositions + their *-loopcheck twins
  data/looks.ts            THE DATA. Every per-composition value lives here.
  lib/
    random.ts              mulberry32; all randomness is drawn at build time
    revolve.ts             surface of revolution with explicit crease control
    pill-geometry.ts       capsule (body + cap), tablet, score line, caplet
    pill-material.ts       coating: clearcoat + wrapped diffuse, opaque
    field.ts               the falling field and its vertical tiling
    tonemap.ts             AgX, and its numeric inverse for authoring backdrops
    shader-patch.ts        exactly-one-occurrence replacement into three's chunks
  scene/
    Pill.tsx               one hero pill
    PillField.tsx          instanced field, one mesh per part per shape
    Backdrop.tsx           lit cyclorama (look 1) and shader gradient (look 3)
    Rig.tsx                lightformer environment, PCSS shadows
    Post.tsx               depth of field -> AgX -> grain -> SMAA
    GrainEffect.tsx        deterministic grain and dither
  comps/
    SinglePill.tsx         looks 1 and 2, including the matte pass
    FallingPills.tsx       look 3
tools/
  png.mjs                  zero-dependency PNG reader for the checks
  agx.mjs                  AgX + inverse for the CLI tools
  calibrate.mjs            solves backdrop albedo from one render
  render-all.mjs           previews and the stills harvest
  verify-loop.mjs          step 3 — loop closure
  verify-encoded.mjs       step 1 — ffprobe, duration, black level
  verify-determinism.mjs   step 4 — frame 150 alone vs sequential
  package.mjs              builds pill-capsule-project.zip
```

### Notes for whoever edits this next

- **The capsule's cap is 6% wider than its body, and its rim is an annulus
  facing straight down.** Those two things are the join step — a diameter
  change plus a fine dark line — and they are most of what separates a
  convincing capsule from a rounded cylinder. A physically exact 2–3% step is
  under a pixel at 1080p, which is why this one is exaggerated. Do not "clean
  up" the join.
- **Tone mapping runs as a post effect, not on the renderer.** three disables
  renderer tone mapping when drawing into a render target, which is exactly
  what the composer does, so setting `gl.toneMapping` would silently do
  nothing. The canvas is `flat` for the same reason.
- **`replaceOnce` throws rather than patching partially.** three ships two
  copies of every shader chunk — a readable source tree and a build with blank
  lines stripped — and a needle spanning a blank line matches one and not the
  other. Half a patch compiles to a reference to an undeclared variable, the
  program fails to link, and the object renders black with nothing in the
  console.
- **`camera.far` is kept tight.** The depth-of-field pass works in depth
  normalised over `[near, far]`, so a far plane an order of magnitude beyond
  the content flattens the circle of confusion to nothing and the blur silently
  disappears. `worldFocusRange` is converted through the same map, so it must
  also be larger than `camera.near` or it comes out negative.
- **A sweep's `envMapIntensity` only takes effect because the material is
  pointed at `scene.environment` explicitly.** three overwrites the uniform
  with `scene.environmentIntensity` for any lit material that has no envMap of
  its own.

---

## Completion checklist

- [ ] `npm install && npx remotion studio` works from a clean copy
- [ ] `npm run render:previews` — six files, 1920×1080, 30 fps, h264, yuv420p
- [ ] `npm run verify:encoded` — resolution, frame rate, codec, pixel format,
      duration, no audio, and look 2's black at 0,0,0 in both halves
- [ ] `npm run verify:loop` — all six close pixel-for-pixel
- [ ] `npm run verify:determinism` — frame 150 alone matches the sequential render
- [ ] Blank-pill audit at 4K: no imprint, letter, number, logo or branded score
      line on any pill, including the sharp ones in look 3
- [ ] Banding check on the encoded file, along both a horizontal and a vertical
      scanline
- [ ] `npm run render:stills` — one 1080p PNG per composition plus the
      6000×3375 harvest
- [ ] `npm run package` — `pill-capsule-project.zip`, no `node_modules`, no
      `.git`, no render output
