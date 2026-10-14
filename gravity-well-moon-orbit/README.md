# Gravity Well & Moon Orbit — Remotion + three.js (WebGL2)

Five 20-second seamless loops (600 frames @ 30 fps, 3840×2160) built from one
Earth/Moon kit: lit NASA-textured globes, a warped spacetime grid, an orbit
path, stars and a nebula. Everything is drawn in code with
`@remotion/three` (react-three-fiber) on **WebGL2**.

| Composition ID (Remotion) | Output file | What it shows |
|---|---|---|
| `GravityWell-EarthMoon` | `GravityWell_EarthMoon.mp4` | Earth in a funnel-shaped well; the Moon orbits on the slope with its own small dip |
| `GravityWell-EarthOnly` | `GravityWell_EarthOnly.mp4` | Low, wide angle; Earth floats above a deep well with a dark pit; turns and bobs; slow camera swing |
| `GravityWell-SunEarth` | `GravityWell_SunEarth.mp4` | The Sun in a much deeper well; Earth orbits on the slope with its own dip, lit by the Sun |
| `MoonOrbit-Gold` | `MoonOrbit_Gold.mp4` | Earth, dotted orbit, Moon going round (hidden behind Earth on the far side), gold nebula |
| `MoonOrbit-Blue` | `MoonOrbit_Blue.mp4` | Same with a blue/violet nebula |

> Remotion only allows `a-z A-Z 0-9 -` in composition IDs, so the IDs use a
> hyphen; the rendered files keep the underscore names.

## Quick start

```bash
npm install
npx remotion studio          # preview / scrub all five
```

Node 18+ recommended (built and tested with Node 22).

## Chromium GL flag

three.js needs WebGL2 in headless Chromium. Always render with the ANGLE backend:

```
--gl=angle
```

(`remotion.config.ts` also sets `Config.setChromiumOpenGlRenderer("angle")`, plus
H.264, `yuv420p`, PNG frames and **muted** output — no audio stream.)
On a machine with a GPU, ANGLE uses it; without one it falls back to SwiftShader
(software), which is what the timings below were measured on.

## 4K render commands (one per composition)

```bash
npx remotion render GravityWell-EarthMoon out/GravityWell_EarthMoon.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render GravityWell-EarthOnly out/GravityWell_EarthOnly.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render GravityWell-SunEarth  out/GravityWell_SunEarth.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render MoonOrbit-Gold        out/MoonOrbit_Gold.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render MoonOrbit-Blue        out/MoonOrbit_Blue.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

720p preview (what was delivered): add `--scale=0.3333333333333333` (gives exactly 1280×720).

## 6K stills (6000×3375)

```bash
npx remotion still GravityWell-EarthMoon out/GravityWell_EarthMoon_6k.png --frame=300 --scale=1.5625 --gl=angle
# same for GravityWell-EarthOnly, GravityWell-SunEarth, MoonOrbit-Gold, MoonOrbit-Blue
```

The canvas renders at the real output size (`dpr = devicePixelRatio`), and line
widths, star and dot sizes are specified at 720p and scaled with the drawing
buffer, so 720p, 4K and 6K frames have the same look.

## Changing the look — one data row per composition

All per-film settings live in **`src/config.ts`**, one row per composition.

- **Nebula colour** (`MoonOrbit_*` rows): `nebula.inner` (glow / bright dust) and
  `nebula.outer` (dark dust), e.g. `inner: "#C89A3A", outer: "#3A2A10"`.
  `nebula.centre` moves the glow (screen UV, y up), `nebula.strength` scales it.
- **Well depth** (`GravityWell_*` rows): the funnel is
  `y = -depth / sqrt(r² + width²)`. Raise `well.depth` for a deeper well,
  raise `well.width` for a wider, rounder bottom. `well.spacing` / `well.spokes`
  set ring spacing and spoke count (`spokes: 0` gives a square grid);
  `well.opacity`, `well.lineWidth`, `well.colorNear/colorFar` and `well.fade`
  set line brightness, width, tint and distance fade. Bodies re-seat themselves
  on the new surface automatically.

Every row can also be edited live in Remotion Studio (it is the composition's
`row` prop).

## How it is built

- `src/SpaceScene.tsx` — closed-form state for each frame (orbits, spins,
  camera), and the scene graph.
- `src/three/Grid.tsx` — the spacetime grid: instanced screen-space line quads
  with constant pixel width and analytic anti-aliasing; displacement is done in
  the vertex shader. Each vertex measures the on-screen gap to its neighbouring
  line and fades the line before it can moiré, plus a distance fade.
- `src/three/Bodies.tsx` — Earth (day map, cloud shell, atmosphere rim shell),
  Moon (LROC colour + LOLA bump), procedural Sun (granulation noise + limb
  darkening + glow).
- `src/three/Points.tsx` — stars (3,000 points on a far sphere, twinkling in
  whole cycles), dotted orbit, nebula shader + fine dust.
- `src/three/PostFX.tsx` — scene → half-float 4×MSAA target → (bloom for the
  Sun) → final pass: highlight shoulder, sRGB, grain, dither.

### Physics (illustrative, not to scale)

- Moon orbits Earth, Earth orbits the Sun, and Earth spins **counter-clockwise
  seen from above the North Pole** (rotation +y; verified with a top-down render).
- The Moon is **tidally locked**: its near side (texture longitude 0) always
  faces Earth, so it turns once per orbit.
- Moon diameter = **27 %** of Earth's. Axial tilt 23.4°.
- The Sun's well is **3× deeper and 3× wider** than the Earth–Moon well; Earth
  carries its own small travelling dip; the Sun lights Earth (point light at the
  Sun), so the day side always faces the Sun. Earth spins 3 sidereal turns per
  orbit so a day/night cycle is visible.
- Orbits: exactly one per 600 frames; Earth spin: exactly one turn per 600 frames
  (three in the Sun-Earth film); bob in comp 2: two whole cycles.

### Determinism

Remotion renders out of order on several threads, so every value is a pure
function of `useCurrentFrame()`:

- angles are `2π·frame/600` (whole turns), no physics integration;
- star/dust fields come from `mulberry32` seeded **at module level**;
- grain/dither are an integer hash of pixel position and `frame % 600`;
- no `Math.random()`, `Date.now()`, R3F clock, `useState` visuals, TAA or
  accumulation. (`useFrame` is used only as the render hook for the post
  pipeline; its clock/delta are ignored.)
- textures load once and the render waits with `delayRender`/`continueRender`.

## Textures and credits (public domain)

| File | Source |
|---|---|
| `public/textures/earth_day_4k.jpg` | **NASA Visible Earth — Blue Marble** (NASA Earth Observatory). 4096×2048 copy as redistributed in the `three-globe` npm package (`example/img/earth-blue-marble.jpg`). |
| `public/textures/earth_clouds_4k.jpg` | Cloud layer from the `three-globe` npm package (`example/clouds/clouds.png`), converted to a greyscale alpha map. Derived from NASA Blue Marble cloud imagery, but its exact provenance is not documented there; swap in NASA's own Blue Marble cloud map if that matters to you. |
| `public/textures/earth_ocean_mask.png` | Derived in this project from the Blue Marble map (water = blue-dominant pixels). |
| `public/textures/moon_lroc_color_4k.jpg` | **NASA Scientific Visualization Studio, CGI Moon Kit** — LRO **LROC** colour mosaic (`lroc_color_poles`), downsampled from 11469×5734. Credit: NASA's Scientific Visualization Studio / LRO LROC team (ASU). |
| `public/textures/moon_lola_bump_1k.jpg` | NASA SVS CGI Moon Kit — **LRO LOLA** elevation, used as a bump map. |

NASA imagery is not copyrighted (public domain); NASA asks to be credited.
The Sun is fully procedural (no texture).

## Deliberate choices vs. the brief / references

- **Polar grid** (rings + spokes) for the wells: zooming the references shows
  concentric rings and radial spokes around the funnels. `spokes: 0` switches
  to a square grid.
- **Camera elevations:** EarthMoon 30° (brief ≈25°) and EarthOnly 21°
  (brief ≈12°). At 12° the far plane sat above the camera and hid the well;
  the reference is also looking down more steeply.
- **Moon orbit in EarthMoon:** 2.4 Earth radii (the reference is ≈2.6 R).
  The brief's "≈2.2 Earth diameters" (4.4 R) put the Moon far out on the flat
  part of the grid, away from the Earth/Moon overlap the reference shows.
- **Moon size** is 27 % of Earth per the physics rule (the references draw it
  at ≈35–40 %).
- **Key light from the upper left** per the brief (the MoonOrbit reference is
  lit from the right, so its Moon there looks "full").
- **MoonOrbit ellipse** is a circle centred on Earth (inclined/rolled 7°),
  per the brief and `angle = 2π·frame/600`. The reference's ellipse is offset
  to the right like a Kepler orbit with Earth at a focus, and drawn with dashes,
  not dots.
- **Sun-Earth Earth spin:** 3 turns per orbit, so day and night visibly move.
  With 1 turn per orbit it would look tidally locked to the Sun.

## Measured render times (this machine)

Machine: 4 vCPU, 15 GB RAM, **no GPU** — ANGLE fell back to SwiftShader
(software WebGL2). Remotion default concurrency (2×). A GPU machine will be
much faster.

**720p (1280×720, `--scale=0.3333333333333333`), full 600-frame renders:**

| Composition | mp4 wall time | per frame (wall, 2 threads) | warm single frame (`remotion still`) |
|---|---|---|---|
| GravityWell-EarthMoon | 328 s | 0.55 s | 3.9 s |
| GravityWell-EarthOnly | 437 s | 0.73 s | 3.7 s |
| GravityWell-SunEarth  | 535 s | 0.89 s | 4.2 s |
| MoonOrbit-Gold        | 362 s | 0.60 s | 4.0 s |
| MoonOrbit-Blue        | 357 s | 0.60 s | 4.1 s |

(The warm single-frame time includes ~3 s of fixed page/seek overhead per still.)

**Two real 4K frames (3840×2160, warm browser, frame 301):**

| Composition | 4K frame |
|---|---|
| GravityWell-EarthMoon | **11.1 s** |
| MoonOrbit-Gold        | **13.6 s** |

**4K estimates (this CPU-only box, 2 threads):** ≈ 11–14 s per frame per thread
→ ≈ 6–7 s/frame wall → **≈ 55–70 min per composition** for EarthMoon,
EarthOnly, Gold and Blue, and **≈ 90 min** for SunEarth (bloom + heavier
grid, 1.6× the 720p cost). All five ≈ 5.5 h. With a real GPU (ANGLE on
hardware) expect a small fraction of that.

## Verification

All checks were run on the delivered 720p renders.

1. **File checks (ffprobe)** — all five: h264, 1280×720, `yuv420p`, 30/1,
   20.000 s, 600 frames, **no audio stream** (first test render had a silent AAC
   track; fixed with `--muted` / `Config.setMuted(true)`).
2. **Loop** — each composition rendered at 601 frames (`--props
   '{"durationOverride":601}'`): frame 0 and frame 600 are **pixel-identical** (5/5).
3. **Determinism** — frame 300 rendered alone from a cold start (fresh browser)
   vs frame 300 of the full multi-threaded PNG-sequence render: **byte-for-byte
   identical PNGs** (5/5).
4. **Banding** (frames decoded from the encoded mp4s, stars/lines removed with
   a median filter):
   - gold / blue nebula gradients: largest step between adjacent averaged pixels
     < 1 code value in every channel, no plateaus;
   - Sun glow (radial median, r = 95…330 px): smooth fall-off 253 → 80, largest
     step 2.7 code values (that is the slope, not a band edge);
   - atmosphere rim: smooth fall-off to 0;
   - empty space: median 0, mean < 0.5, 95th percentile ≤ 1.
   Grain fades out below ~3 % luminance, so space stays clean black.
5. **Contact sheets** (five frames each, `renders/contact_*.png` in the
   deliverables): Earth sits in a smooth funnel with the Moon riding the slope,
   passing behind and in front; low-angle deep well with a dark pit, Earth
   turning and bobbing; glowing Sun in the deep well with Earth's day side toward
   it; dotted ellipse with the Moon hidden behind Earth on the far side, gold and
   blue nebulae. Orbit order (left → front → right → back from the camera, and a
   dedicated top-down render) confirms counter-clockwise motion seen from above
   the North Pole; Earth shows longitudes further west over time (eastward spin);
   continents upright; the Moon's near side always faces Earth.
6. **Motion** — 2 s clips (frames 285–344) per composition: grid line energy
   changes < 0.1 % frame to frame in the fixed-camera wells (0.25 % with the
   swinging camera in EarthOnly), the dotted ellipse is fixed geometry (only
   grain/dither vary), the Moon passes behind Earth with a clean depth cut.

## Completion checklist

- [x] 5 compositions, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] three.js on WebGL2 via `@remotion/three`, `--gl=angle`
- [x] NASA textures, credited; procedural Sun
- [x] CCW orbits/spin from above the North Pole; tidal locking; Moon 27 % of Earth
- [x] Sun well 3× deeper/wider; Earth carries its own dip; Sun lights Earth
- [x] One data row per composition (`src/config.ts`)
- [x] Half-float targets, ±1/255 dither, ~1.5 % frame-hashed grain faded below 3 % luminance
- [x] No `Math.random()` at render time; seeded at module level; closed-form motion
- [x] Loop check, determinism check, banding check, contact sheets, motion check
- [x] 720p previews (1280×720 exact) + 720p stills; 4K command + 6K still command
- [x] Render times measured; two real 4K frames timed
- [x] Clean `npm install && npx remotion studio` from the zip
