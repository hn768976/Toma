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

## Measured render times (this machine)

MEASURED_TIMES

## Verification

VERIFICATION

## Completion checklist

CHECKLIST
