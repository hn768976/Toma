# Atom Orbits — Remotion + three.js

Three glowing atom models, each a **20-second seamless loop** (600 frames @ 30 fps),
defined at **3840×2160**. 3D (react-three-fiber via `@remotion/three`, WebGL2),
real bloom (`@react-three/postprocessing`), tone mapping, looping noise.

| Composition   | Look                                   | Background                          | Tone map |
|---------------|----------------------------------------|-------------------------------------|----------|
| `ClassicAtom` | 3 crossed light-blue orbits, orange nucleus cluster, star-flare electrons | navy nebula + stars | ACES |
| `EnergyAtom`  | 8 wispy multi-strand orbits, white-cyan core, breathing smoke | **pure black `#000000`** (overlay) | AgX |
| `WispAtom`    | 7 soft wispy orbits, small teal nucleus, depth of field | blue-green nebula, stars, drifting bokeh | AgX |

> **Look 2 (`EnergyAtom`) is a screen-blend overlay.** Everything outside the glow is
> exactly `0,0,0` in the encoded file (checked). Drop it over footage with
> **Screen** (or Add/Linear Dodge) blend mode — black disappears, the atom stays.
> Grain is deliberately not applied to black on this look.

---

## Setup

```bash
npm install          # Node 18+; versions are pinned in package.json
npx remotion studio  # preview
```

`remotion.config.ts` sets the WebGL renderer, PNG intermediate frames, H.264,
yuv420p and CRF 16, so the commands below need no extra flags.

### Chromium GL flag

three.js needs WebGL2 in headless Chromium:

```
--gl=angle
```

It's already set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`);
pass `--gl=angle` explicitly if you render through the Node APIs or a different config.
On a machine with a GPU, ANGLE uses it; without one it falls back to SwiftShader (CPU), which works but is slow.

---

## Render commands

### 4K (3840×2160) — final masters

```bash
npx remotion render ClassicAtom out/ClassicAtom_4K.mp4
npx remotion render EnergyAtom  out/EnergyAtom_4K.mp4
npx remotion render WispAtom    out/WispAtom_4K.mp4
```

(H.264 `-tune grain`, yuv420p, CRF 16, 30 fps, no audio — all from `remotion.config.ts`.
For a mezzanine add `--codec=prores --prores-profile=4444`.)

### 1080p previews

```bash
npx remotion render ClassicAtom out/ClassicAtom.mp4 --scale=0.5
```

The delivered previews were made with `scripts/render-previews.sh`, which renders the
PNG sequence with Remotion at `--scale=0.5` (multi-threaded, frames out of order),
encodes it with ffmpeg (libx264 `-preset slow -tune grain`, CRF 16, yuv420p, BT.709 tags, no audio) and then
re-renders frame 300 from a cold start to prove it is byte-identical.

### Stills (6000×3375 PNG)

`6000 / 3840 = 1.5625`:

```bash
npx remotion still ClassicAtom out/stills/ClassicAtom_f0015.png --frame=15  --scale=1.5625
npx remotion still ClassicAtom out/stills/ClassicAtom_f0333.png --frame=333 --scale=1.5625
npx remotion still ClassicAtom out/stills/ClassicAtom_f0527.png --frame=527 --scale=1.5625
npx remotion still EnergyAtom  out/stills/EnergyAtom_f0004.png  --frame=4   --scale=1.5625
npx remotion still EnergyAtom  out/stills/EnergyAtom_f0244.png  --frame=244 --scale=1.5625
npx remotion still EnergyAtom  out/stills/EnergyAtom_f0443.png  --frame=443 --scale=1.5625
npx remotion still WispAtom    out/stills/WispAtom_f0002.png    --frame=2   --scale=1.5625
npx remotion still WispAtom    out/stills/WispAtom_f0148.png    --frame=148 --scale=1.5625
npx remotion still WispAtom    out/stills/WispAtom_f0564.png    --frame=564 --scale=1.5625
```

The frames were picked by `npx tsx scripts/analyze-frames.ts`, which uses the scene's
own maths to find the frames where the electrons are furthest apart on screen. Grain is
kept on looks 1 and 3. Everything (line widths, star sizes, grain, bloom spread, DoF)
is defined relative to frame height, so stills look the same as the video, only sharper.

---

## Render time

Measured on the machine that built this: **4 CPU cores, no GPU**
(Chromium → ANGLE → SwiftShader software WebGL).

| Composition | 1080p (`--scale=0.5`), full 600-frame render | per frame |
|---|---|---|
| ClassicAtom | 1022 s | **1.70 s** |
| EnergyAtom  | 875 s  | **1.45 s** |
| WispAtom    | 3448 s | **5.74 s** (depth of field at full resolution is the expensive part) |

Concurrency barely matters on this box: SwiftShader already spreads one frame over
all cores (40-frame test: 2.19 s/frame at `--concurrency=1`, 2.11 s at 4).
A 6000×3375 still takes ~35 s (Classic), ~23 s (Energy), ~75 s (Wisp).

**4K estimate:** a 4K frame has 4× the pixels and the cost is almost all per-pixel
shading (noise background, bloom mips, full-res depth of field), so expect
**≈4× the 1080p time on the same CPU-only box**: about 7 s/frame for ClassicAtom,
6 s for EnergyAtom and 23 s for WispAtom, i.e. roughly 70 min, 60 min and
3.8 h for the three 600-frame 4K masters. On a machine with any discrete GPU the
scene is tiny (a few thousand triangles, one full-screen noise shader, bloom) and
should render far faster — typically well under a second per 4K frame, with
Chromium/encoding overhead dominating.

---

## How to change things

All tweakable settings live in one file per look:
`src/looks/classic.ts`, `src/looks/energy.ts`, `src/looks/wisp.ts`
(the type with comments for every field is `src/looks/types.ts`).

**Colours** — `colors` block, plain sRGB hex:
`orbit` (trails/lines), `electronCore`, `electronHalo`, `nucleus`, `nucleusGlow`,
background `bgCenter`/`bgEdge`/`nebulaA`/`nebulaB`/`nebulaWarm`, and look 2's
`smoke`/`smoke2`.

**Number of orbits** — `orbitGroups[].count`. Each group also sets the radius range,
how flat the ellipses are (`flatness`) and the tilt style (`"classic"` = fanned
atom symbol, `"random"` = every which way). Look 2 has two groups: tight inner
rings and big outer ones. Strands per orbit: `strands`; how far they wander:
`wispAmount`. Trail length: `trail` (fraction of the orbit).

**Speeds** — everything is counted in **whole cycles per 20-second loop**, so the
loop always stays seamless:
- `orbitGroups[].laps` — electron laps per loop for each orbit (cycled if shorter
  than `count`). `5` = one lap every 4 s. Negative runs the other way.
- `motion.spinTurns` / `spinAxis` — whole turns of the atom.
- `motion.swayX` / `swayY` — `[amplitude in radians, cycles per loop]`.
- `motion.cameraDrift` / `cameraDriftCycles` — camera drift (look 3).
- `smoke.breathCycles` — look 2 glow breathing.

A non-whole cycle count throws an error at build time rather than silently breaking
the loop. Changing `seed` gives a different but equally deterministic arrangement.

Framing: `atomHeightFraction` (atom diameter as a fraction of frame height);
the camera distance is derived from it.

---

## How it stays deterministic and seamless

- All random-looking data (orbit tilts and sizes, nucleus spheres, strand offsets,
  stars, bokeh paths) is generated **once at module level** from a seeded
  `mulberry32` (`src/scene/model.ts`). No `Math.random()`, `Date.now()`, `useFrame`
  clock or React state drives anything visual.
- Every per-frame value is a function of `useCurrentFrame()` only. Cycle fractions use
  integer maths (`cycleFrac` in `src/lib/loop.ts`), so frame 600 gives *exactly* the
  same numbers as frame 0.
- **Trails are not built from history.** The ribbon shader computes, per vertex and per
  pixel, how far that point sits behind the electron's *current* phase
  (`fract(dir·(head − u))`) and fades it over the trail length.
- Animated noise (nebulas, smoke) samples 4D simplex noise around a circle in time:
  `noise(x, y, cos 2πt · r, sin 2πt · r)`.
- Grain / dither are a hash of `(pixel x, pixel y, frame % 600)`.
- `ComposerReady` (in `src/scene/AtomScene.tsx`) holds each cold-started render tab
  until the post-processing passes exist, so the first frame a thread renders is never
  captured without bloom.
- Orbit curves have 1024 points each (≥ 256 required), evaluated analytically in the
  vertex shader, so trails stay smooth at 4K and in the 6000 px stills.

---

## Checks (and how to re-run them)

`scripts/verify.mjs` needs only ffmpeg/ffprobe.

| Step | Command |
|------|---------|
| 1. format | `node scripts/verify.mjs probe out/previews/ClassicAtom.mp4` |
| 1. look 2 black | `node scripts/verify.mjs black out/previews/EnergyAtom.mp4` |
| 2. loop | `npx remotion still <Comp> out/a.png --frame=0 --scale=0.5 --props='{"loopCheck":true}'` then `--frame=600`, then `node scripts/verify.mjs same out/a.png out/b.png` |
| 3. determinism | `scripts/render-previews.sh` (compares a cold frame 300 with frame 300 of the full multi-threaded render) |
| 4. banding | `node scripts/verify.mjs banding out/previews/WispAtom.mp4 300 out/banding.png` |

`--props='{"loopCheck":true}'` temporarily makes every composition 601 frames long.
To bisect a loop mismatch, switch groups off with
`--props='{"loopCheck":true,"disable":["grain","nebula"]}'`
(groups: `electrons trails rotation camera nebula stars smoke bokeh grain bloom dof nucleus`).

### Banding check

Banding is checked **on the encoded mp4, not the preview**: a frame is extracted to PNG
and the luma is read along horizontal lines through the nebula (12 % and 85 % of
frame height). The check fails on long runs of one identical value or on jumps in the
smoothed profile — i.e. steps instead of a smooth ramp. Prevention: ±1/255 dither
plus 2 % grain applied after bloom and tone mapping, in output (sRGB) units, PNG
(not JPEG) intermediate frames, and x264 `-tune grain` (set in `remotion.config.ts`
and in `scripts/render-previews.sh`). Without `-tune grain`, x264 smoothed the grain
away in the darkest blocks and the check failed with 17 px plateaus.

---

## Completion checklist

Results from the delivered 1080p previews (`out/previews/*.mp4`):

- [x] 1920×1080, 30/1 fps, 20.000 s, 600 frames, h264, yuv420p, **no audio stream** — all three
- [x] Look 2: every sampled empty-area pixel is exactly 0,0,0 in the encoded mp4 (frames 0/150/300/450/599); 81 % of the frame is pure black, glow stays within ~450 px of centre
- [x] Loop: frame 600 == frame 0 pixel-for-pixel, byte-identical PNGs — all three (negative control: frame 599 vs 0 differs, as it should)
- [x] Determinism: cold-started frame 300 is byte-identical to frame 300 of the full multi-threaded render — all three
- [x] Banding: no plateaus along lines through the nebula in the encoded mp4 (frames 0/300/450, looks 1 and 3); the same frame without grain fails the check, so it does detect banding
- [x] Electrons pass in front of and behind the nucleus (e.g. ClassicAtom frame 12: one electron and its trail hidden by the cluster)
- [x] Trails fade smoothly; 1024-point curves, no corners at 6000 px
- [x] Only the atom blooms; background sits below the bloom threshold
- [x] Electrons on different orbits with different whole lap counts, never in step
- [x] Look 1: three crossed orbits, nucleus is a cluster of 18 spheres, full ellipses faintly visible
- [x] Look 2: multi-strand wispy ribbons; glow cloud breathes (4 cycles per loop)
- [x] Look 3: softer, calmer wisps; bokeh discs drift; back of the orbits slightly softer (real `DepthOfField`)
- [x] 9 stills at 6000×3375, grain kept on looks 1 and 3
- [x] `npm install && npx remotion studio` works from a clean unzip

Known limitations:
- Look 3's depth of field is a screen-space effect with one depth per pixel. Where two
  see-through strands at different depths cross, a faint notch can appear at 4K and
  above. The blur was kept deliberately slight to keep this minor.
- Look 3's fine stars are very faint because the depth of field also softens the background.

---

## Project layout

```
src/Root.tsx            compositions (3840×2160, 30 fps, 600 frames)
src/looks/*.ts          per-look settings (colours, orbit counts, speeds…)
src/scene/model.ts      seeded build-time data + per-frame maths
src/scene/AtomScene.tsx canvas, camera, post chain (DoF → Bloom → ToneMapping → Grain)
src/scene/Orbit.tsx     ribbon shader: orbit line, wisp strands, trail from current phase
src/scene/Sprites.tsx   electrons (core/halo/star flare), glows
src/scene/Nucleus.tsx   cluster / energy core / teal sphere
src/scene/Background.tsx nebula + bokeh shader, star points
src/scene/Smoke.tsx     look 2 breathing smoke (looping noise)
src/scene/Grain.tsx     dither + film grain effect
scripts/                render + verification helpers
```
