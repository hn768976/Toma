# hyperspace-warp

A 4K hyperspace / warp-jump clip, built in [Remotion](https://remotion.dev).

Pure 2D: the whole frame is drawn into a single `<canvas>` from
`useCurrentFrame()`. No Three.js, no WebGL scene, no physics, no simulation
state. Every pixel is a closed-form function of the frame number, so frames
can be rendered in any order, on any number of workers, and always match.

---

## Quick start

```bash
npm install
npm run studio        # interactive preview at http://localhost:3000
```

## 4K render commands

Each version is a separate composition at **3840 x 2160, 30 fps**. Run these
locally to produce the full-resolution masters:

```bash
# v1 — blue, speed arc, 450 frames (15s)
npx remotion render v1-blue-arc   out/v1-blue-arc-4k.mp4   --codec=h264 --crf=14 --concurrency=2

# v2 — violet, speed arc, 450 frames (15s)
npx remotion render v2-violet-arc out/v2-violet-arc-4k.mp4 --codec=h264 --crf=14 --concurrency=2

# v3 — blue, sustained peak, seamless loop, 600 frames (20s)
npx remotion render v3-blue-loop  out/v3-blue-loop-4k.mp4  --codec=h264 --crf=14 --concurrency=2
```

Or via the npm scripts, which wrap exactly those commands:

```bash
npm run render:4k:v1
npm run render:4k:v2
npm run render:4k:v3
npm run render:4k:all
```

**Notes on the 4K renders**

- `--concurrency=2` is a safe default: each worker holds several full-size
  canvases (the scene buffer plus the bloom taps). Raise it if you have RAM
  to spare; drop to `1` if a worker is killed.
- `--crf=14` is close to visually lossless. For a delivery master rather than
  a viewing copy, use `--prores-profile=4444 --codec=prores` instead.
- Add `--gl=angle` if your machine picks a software renderer and the render
  crawls.

### 4K stills

```bash
npm run still:4k:v1   # frame 225 — middle of the sustained peak
npm run still:4k:v2   # frame 225
npm run still:4k:v3   # frame 300 — loop is at peak throughout
```

### 1080p previews

Three extra compositions (`v1-blue-arc-preview`, `v2-violet-arc-preview`,
`v3-blue-loop-preview`) run the same component with the same props at
1920 x 1080. They exist purely so a preview render is fast:

```bash
npm run render:preview:v1
```

These target 10 Mbps rather than a CRF. Constant-quality encoding is a poor
fit here: the 1.5% grain and the thousands of thin high-contrast lines are
close to incompressible, so CRF 22 lands the 20-second loop at over 100 MB.
10 Mbps holds up with no visible artifacts and keeps the previews portable.
Use `--crf=14`, as in the 4K commands above, when quality is what matters.

---

## The versions

Palette and arc/loop mode are single props on one component
(`src/HyperspaceWarp.tsx`), so all three versions are the same code.

| Composition     | Size        | Frames    | `palette` | `mode` |
| --------------- | ----------- | --------- | --------- | ------ |
| `v1-blue-arc`   | 3840 x 2160 | 450 (15s) | `blue`    | `arc`  |
| `v2-violet-arc` | 3840 x 2160 | 450 (15s) | `violet`  | `arc`  |
| `v3-blue-loop`  | 3840 x 2160 | 600 (20s) | `blue`    | `loop` |

### Palettes

| Slot                 | blue      | violet    |
| -------------------- | --------- | --------- |
| `core` (hot core)    | `#ffffff` | `#ffffff` |
| `inner` (inner body) | `#d6f1ff` | `#e0ccff` |
| `mid` (mid body)     | `#2ea8f0` | `#b06cff` |
| `outer` (tail)       | `#1550a0` | `#4a1f9e` |

The violet brief gives three stops (core / body / tail). `#b06cff` is the
body, so it sits in the `mid` slot to mirror blue's structure, and `inner` is
a pale tint of it so both ramps have the same four-stop shape.

---

## How it works

### The particle

Each star lives in polar coordinates around the frame centre:

```
r(t) = R0 * exp(K * frac(u + D(t)))       K = ln(RMAX / R0)
```

- `u` is the particle's fixed random phase offset in `[0, 1)`.
- `D(t)` is the travelled distance in **traversals** — one traversal is the
  whole trip from the birth radius out past the frame diagonal.
- `floor(u + D(t))` is the cycle count. It increments when the particle
  passes `RMAX`, which is the respawn: the new angle is
  `hash(index, cycle mod 12)`, deterministic and with no state carried
  between frames.

`RMAX` is 0.63 of the frame width; the half-diagonal at 16:9 is 0.5734, so a
particle is fully off-frame before it respawns.

### The streak is the motion blur

Every particle is drawn as one line segment from `r(t - 1)` to `r(t)` — the
position it held on the previous frame to the position it holds now. Because
`r` grows exponentially, that segment is a sub-pixel dot at calm speed and a
long streak at peak warp, with no separate blur pass anywhere. The segment
gets a gradient along its length (transparent tail, body, hot head), which is
what gives it the comet falloff.

When a particle respawns mid-frame the segment starts at `R0` on the new
angle instead of stretching across the frame.

### The speed arc (v1, v2)

| Frames    | Behaviour                                     |
| --------- | --------------------------------------------- |
| 0 – 60    | calm starfield, faint slow radial drift        |
| 60 – 150  | cubic ease in to full speed                    |
| 150 – 300 | sustained peak warp                            |
| 300 – 390 | cubic ease out                                 |
| 390 – 450 | calm starfield again, matching the opening     |

The ramps use `easeInOutCubic`. It is a genuine cubic, its steep middle reads
as acceleration rather than a crossfade, and — unlike a bare `x^3` — its
derivative is zero at both ends, so there is no velocity kink at frames 60,
150, 300 or 390.

`D(t)` is the integral of that curve, and it is evaluated in **closed form**:
`src/math.ts` carries the exact antiderivative of `easeInOutCubic`, so no
frame ever has to accumulate over the frames before it.

**On "frame 0 and frame 450 look the same".** They match in every property
you would cut on — same population, same speed, same density, same brightness
(mean luma differs by 0.003%) — but they are not pixel-identical, and cannot
be: the field genuinely travels ~29 traversals over the 15 seconds in
between, and no choice of rate returns it to its exact starting phase while
also satisfying the loop composition's constraints. The head and tail are
statistically indistinguishable, which is what topping and tailing needs.
Version 3 is the one that is exact.

### The loop (v3)

Constant peak speed, and seamless by construction rather than by crossfade:

- `PEAK_RATE = 0.12` traversals/frame, so the population cycles
  `0.12 * 600 = 72` times across the composition — a whole number.
- Respawn angles key off `cycle mod 12`, and `72 mod 12 == 0`, so every
  particle is back on its frame-0 angle.
- The twinkle frequency is a whole number of cycles per 600 frames.
- Grain cycles through 12 tiles, and `600 mod 12 == 0`.
- Field rotation is **omitted** in loop mode. At 1 deg/sec it would be 20
  degrees over 20 seconds, which is not a whole number of revolutions; any
  rate that would loop is far too fast to be subtle.

**Verified, not asserted.** `npm run verify:loop` renders frame 0 and frame
600 from `v3-blue-loop-seamcheck` (the same component at 601 frames) and you
can diff them:

```bash
npm run verify:loop
cmp out/seam-000.png out/seam-600.png && echo "seamless"
```

The two PNGs come out byte-identical.

### The look

- Background is `#000000`. A dark vanishing-point hole ~3.6% of the frame
  width sits at the centre; particles fade in as they leave it. Particle
  density goes as `1/r` (they are uniform in log-radius), so the fade-in
  reaches well past the hole itself — otherwise the centre packs into a white
  blob instead of reading as depth.
- Colour is a four-stop ramp indexed by radius and speed. The body of the
  field sits on `mid`; only the brightest particles, in the middle third of
  the frame, at speed, get pushed far enough up the ramp to blow out to
  white. That minority is deliberate: a flat hot head on every streak turns
  an additive field grey instead of blue.
- Additive (`lighter`) compositing throughout. Line widths 1.5–4 px at 4K,
  with the brightest ~8% getting a wider soft underlay.
- ~4500 particles at peak. ~1200 are on during the calm phases as faint
  1–2 px points with a slow independent twinkle; the rest stagger in across
  the ramp.
- Bloom: threshold 0.55, strength 1.1, two taps (1/4 and 1/8 scale) for a
  wide radius.
- One horizontal anamorphic flare across the centre, gated on
  `smoothstep(0.9, 1.0, speed)` so it only appears in the fastest ~2 seconds
  of the arc. Peak opacity 0.24.
- Field rotation ~1 deg/sec, during the warp only (see the loop note above).
- Fine grain at 1.5%, slight vignette. No chromatic aberration.

### Determinism

`mulberry32` and an integer hash in `src/random.ts`; the population is built
once in a `useMemo` keyed on the seed. There is no `Math.random()` and no
`Date.now()` anywhere in the render path. Change `SEED` in `src/Root.tsx` for
a different field with the same character.

---

## Layout

```
src/
  index.ts             registerRoot
  Root.tsx             compositions: 3 x 4K, 3 x 1080p preview, 1 seam check
  HyperspaceWarp.tsx   the component — canvas + the per-frame draw order
  field.ts             particle model and the streak draw
  speed.ts             the speed arc, D(t), field rotation
  palette.ts           the four-stop colour ramps
  post.ts              bloom, anamorphic flare, vignette, grain
  math.ts              easing and the closed-form integral
  random.ts            mulberry32 + integer hash
```
