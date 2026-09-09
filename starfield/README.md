# Deep-space starfield — 4K seamless loop (Remotion)

A pure-2D, deterministic 3840×2160 starfield background. 30 fps, 600 frames
(20 s), seamless: frame 600 is byte-identical to frame 0.

Two palette versions ship as separate compositions:

| Version | Nebula | Star mix |
| --- | --- | --- |
| `v1-violet-teal` | violet/magenta upper right, teal/green lower left | 65% blue-white, 20% warm white, 10% pale cyan, 5% pale magenta |
| `v2-amber-cyan` | amber/rust upper right, cyan lower left | shifted warmer — 50 / 33 / 9 / 8 |

---

## Install

```bash
npm install
```

Node 18+ required. Remotion downloads a Chrome Headless Shell on first render;
if your machine already has one, point at it with `--browser-executable=<path>`.

## Preview in the studio

```bash
npm run dev
```

## Render the 4K masters

These are the exact commands for the 3840×2160 deliverables. Each is ~20 s of
4K H.264 and takes a while — run them locally, not in a sandbox.

```bash
# v1 — violet / teal
npx remotion render Starfield4K-v1-violet-teal out/starfield-v1-violet-teal-4k.mp4

# v2 — amber / cyan
npx remotion render Starfield4K-v2-amber-cyan  out/starfield-v2-amber-cyan-4k.mp4
```

Codec, pixel format and CRF come from `remotion.config.ts` (H.264 / yuv420p /
CRF 16). To trade size for quality, override per render:

```bash
npx remotion render Starfield4K-v1-violet-teal out/v1.mp4 --crf=20
```

If your machine has spare cores, add `--concurrency=8` (or higher). If a render
runs out of memory at 4K, lower it instead — each worker holds a full 4K frame.

## Render the 4K stills

```bash
npx remotion still Starfield4K-v1-violet-teal out/v1-frame300.png --frame=300
npx remotion still Starfield4K-v2-amber-cyan  out/v2-frame300.png --frame=300
```

## Render the 1080p previews

```bash
npx remotion render StarfieldPreview-v1-violet-teal out/v1-1080p.mp4
npx remotion render StarfieldPreview-v2-amber-cyan  out/v2-1080p.mp4
```

The preview compositions are exactly half the master's linear size and share its
design-space geometry, so they are true miniatures rather than a separate look.

## Compositions

| ID | Size | Frames |
| --- | --- | --- |
| `Starfield4K-v1-violet-teal` | 3840×2160 | 600 |
| `Starfield4K-v2-amber-cyan` | 3840×2160 | 600 |
| `StarfieldPreview-v1-violet-teal` | 1920×1080 | 600 |
| `StarfieldPreview-v2-amber-cyan` | 1920×1080 | 600 |
| `StarfieldLoopCheck` | 1920×1080 | 601 |

Both palettes are also reachable as a prop, so you can render a version at any
size without adding a composition:

```bash
npx remotion still Starfield4K-v1-violet-teal out/x.png --frame=120 \
  --props='{"version":"v2-amber-cyan","seed":99}'
```

`seed` is optional and defaults to the palette's own seed. Changing it reshuffles
every star, the dust band's clumping and the grain, and nothing else.

---

## Verifying the loop

`StarfieldLoopCheck` is 601 frames long on purpose: frame 600 is the wrap point.
All time in the project is normalised against a fixed 600-frame period rather
than the composition length, so frame 600 must reproduce frame 0 exactly.

```bash
npx remotion still StarfieldLoopCheck out/f0.png   --frame=0
npx remotion still StarfieldLoopCheck out/f600.png --frame=600
cmp out/f0.png out/f600.png && echo "loop is exact"
```

This passes byte-for-byte. Continuity across the seam was checked separately:
the frame-to-frame delta from 599→600 (PSNR 32.69 dB) matches a mid-clip pair
299→300 (32.66 dB), so the wrap is not just equal, it is smooth.

---

## How it works

Back to front:

**Base** — near-black `#01010a` with a small blue lift toward frame centre.

**Nebula** — two colour regions, each a CSS gradient shown through a seamlessly
tileable fbm cloud mask, screen-blended at 0.25–0.30. Region placement is a
radial-gradient mask, which is what keeps the frame centre and the lower right
clear. Each region stacks two cloud layers at different tile scales; the layers
walk circular offset paths of different radius, direction and phase. Only the
offset animates — the shape parameters are constant — and because the paths are
circles closed over the 600 frames, the clouds return exactly to where they
started. Two layers interfering is what makes them *morph* rather than slide.

**Dust band** — no shape is ever drawn. Star spawn probability is weighted by a
Gaussian falloff from a diagonal axis at −32° (lower-left to upper-right),
multiplied by a low-frequency fbm so the field clumps instead of reading as an
even sprinkle. Rejection sampling turns that weight into actual density. Stars
that land in the band also get a small brightness boost. Back planes use a
flattened exponent on the same weight, which softens the band's edges with
distance.

**Star planes** — four planes, ~12,000 stars, drifting at 1.0 / 0.85 / 0.7 /
0.55× for parallax. Point stars are 1–3 px cores (4K scale) with a soft halo, at
0.2–0.95 opacity. 25 hero stars carry an 8–16 px core, a wide radial halo and a
faint four-point diffraction cross; two are noticeably brighter than the rest.
Every star twinkles on a sine whose period is drawn from {600, 300, 200, 150,
120} frames — all exact divisors of 600 — with a per-star phase and depth.

Stars are drawn to a single canvas with `lighter` compositing, from four
pre-rendered sprites per tint. Building a gradient per star would cost more than
the whole rest of the frame.

**Grade** — vignette, then ~1 LSB of static dither, then ~2% fine grain from a
tiled near-black noise texture, screen-blended so the black point lifts by about
one part in a hundred and no more. At 4K the dither is not optional: a near-black
radial gradient bands into visible onion rings without it. Measured corner black
in the delivered stills is RGB (6, 6, 11).

**Camera** — constant slow drift down and slightly left, 7% of frame height over
the 20 s; 0.3° peak-to-peak roll; 1.5% zoom. Roll and zoom are full sine cycles
(`sin(2πt)` and a raised cosine), never linear ramps, so both land back on their
starting value at the wrap. A constant 1.03 overscan keeps the roll from swinging
an empty corner into frame. No forward dolly, no radial streaming, no lens
flares, no shooting stars.

### Closing the loop on a 7% drift

This is the one genuinely awkward constraint, and it is worth explaining because
the obvious implementation does not work.

The drift covers 151 px over the clip — 7% of 2160. Wrapping that positionally
means tiling each plane on a lattice containing a 151 px vector, so the same
constellation repeats roughly 14 times down the frame. At 4K that is clearly
visible, and no choice of lattice avoids it: any lattice containing a short
vector repeats over that short distance, by definition.

So the plane is not tiled. Instead each star carries its own phase in the
600-frame cycle and a `respawnEnvelope` — opacity is zero at the instant its
drift resets and one for ~90% of the cycle in between. Stars move at a constant
linear velocity the whole time; each one silently returns to its start while
fully transparent, and phases are spread uniformly, so only a few percent of the
field is in transition at any moment. The result is a constant drift, a
positionally exact loop, and no lattice repetition anywhere. Hero stars use a
longer fade and evenly staggered phases so no two fade together.

The nebula does tile — smooth low-contrast cloud has no constellations to
recognise — and loops via the closed circular offset paths described above.

### Determinism

Every random value comes from a seeded `mulberry32` in a `useMemo`. Nothing calls
`Math.random()` at render time, so frame N is identical on every machine and on
every re-render. That is also what makes the byte-level loop check meaningful.

### Resolution independence

Everything is authored in a fixed 3840×2160 design space and scaled at draw time.
One exception: a sprite is never allowed below ~1.35 *output* pixels. At 1080p a
1 px 4K star would otherwise land on half a pixel and vanish, so the size is
clamped and the lost energy is paid back in alpha — which is why the 1080p
preview keeps the master's apparent star density.

## Layout

```
src/
  index.ts               registerRoot
  Root.tsx               compositions
  starfield/
    Starfield.tsx        composes the layers, applies the camera
    StarCanvas.tsx       draws all ~12,000 stars to one canvas
    Nebula.tsx           cloud regions
    Grade.tsx            vignette, dither, grain
    stars.ts             star generation, band weighting, respawn envelope
    sprites.ts           pre-rendered star sprites
    noise.ts             tileable fbm, cloud/grain/dither textures
    camera.ts            roll and zoom
    palettes.ts          the two versions
    constants.ts         every tunable number, in one place
    rng.ts               mulberry32
```

Most look changes are one number in `constants.ts` or `palettes.ts`.
