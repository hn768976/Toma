# Retro Field — Retro Mountains · Glass Spiral · Particle Smoke · Fibre Tunnel

Seven seamless 20 s loops (600 frames at 30 fps, 16:9, compositions defined at
3840×2160) built in code with Remotion. three.js on WebGL2 via
`@remotion/three` for the 3D looks; PixiJS 8 on WebGL2 for the particle smoke.
No text, logos or external assets.

| # | Composition ID | Output name | Look | Engine |
|---|----------------|-------------|------|--------|
| 1 | `RetroMountains-Sunset` | `RetroMountains_Sunset` | 3D synthwave valley flight | three.js |
| 2 | `RetroMountains-Midnight` | `RetroMountains_Midnight` | same, blue on black | three.js |
| 3 | `GlassSpiral-Blue` | `GlassSpiral_Blue` | 3D spiral of glass plates | three.js |
| 4 | `GlassSpiral-Amber` | `GlassSpiral_Amber` | same, amber/gold | three.js |
| 5 | `ParticleSmoke-White` | `ParticleSmoke_White` | 2D grain-smoke overlay | PixiJS 8 |
| 6 | `FibreTunnel-RedCyan` | `FibreTunnel_RedCyan` | 3D filament tunnel rush | three.js |
| 7 | `FibreTunnel-VioletGold` | `FibreTunnel_VioletGold` | same, violet/gold | three.js |

Remotion composition IDs may not contain underscores, so IDs use a hyphen;
the rendered files use the underscore names above.

## Setup

```bash
npm install
npx remotion studio        # preview in the browser
```

Node 18+ (tested with Node 22). Versions are pinned in `package.json`.

## Chromium GL flag

All renders must use ANGLE so WebGL2 works in headless Chromium:

```
--gl=angle
```

It is already set in `remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`),
so the commands below work with or without it. On a machine without a GPU,
ANGLE falls back to SwiftShader (software), which is slow but deterministic.

## 4K render commands (one per composition)

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16 and PNG
intermediate frames; the flags are repeated here so the commands stand alone.

```bash
npx remotion render RetroMountains-Sunset   out/RetroMountains_Sunset_4K.mp4   --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png --muted
npx remotion render RetroMountains-Midnight out/RetroMountains_Midnight_4K.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png --muted
npx remotion render GlassSpiral-Blue        out/GlassSpiral_Blue_4K.mp4        --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png --muted
npx remotion render GlassSpiral-Amber       out/GlassSpiral_Amber_4K.mp4       --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png --muted
npx remotion render ParticleSmoke-White     out/ParticleSmoke_White_4K.mp4     --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png --muted
npx remotion render FibreTunnel-RedCyan     out/FibreTunnel_RedCyan_4K.mp4     --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png --muted
npx remotion render FibreTunnel-VioletGold  out/FibreTunnel_VioletGold_4K.mp4  --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16 --image-format=png --muted
```

For a ProRes master instead, use `--codec=prores --prores-profile=4444`.

## 6K stills (6000×3375)

`--scale=1.5625` turns the 3840×2160 composition into 6000×3375:

```bash
npx remotion still RetroMountains-Sunset out/RetroMountains_Sunset_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Swap in any composition ID and frame (0–599).

## 720p previews

```bash
scripts/render-previews.sh            # all seven, plus a PNG still of each
scripts/render-previews.sh GlassSpiral-Blue
```

These use `--scale=0.3333333333333333`, which gives exactly 1280×720.

## Notes per look

- **Particle Smoke is an overlay.** It is white grains on exact black
  (0,0,0), with no grain, dither or vignette. Put it over footage in
  **Screen** or **Add** mode and tint it there.
- **Particle Smoke grain size scales with resolution.** Grains are specified
  as 0.6–1.6 px at 720p and scale with the output height, so they are
  1.8–4.8 px at 4K and keep the same look at every size. The soft glow layer
  (a blurred copy of the same grains) scales the same way.
- **Line widths, star sizes and blur radii** in the three.js looks are all
  given in pixels at 720p and scale with the output height.
- **Retro Mountains:** the terrain tile repeats every 64 grid cells; the
  camera flies exactly one tile per loop.
- **Glass Spiral:** plates slide along the helix (a screw motion), 8 plates
  per loop. Refraction is screen-space: plates are drawn back to front and
  each one refracts, tints and Fresnel-weights the image already drawn behind
  it.
- **Fibre Tunnel:** the filament tile is 110 tunnel radii long and the camera
  covers exactly one tile per loop. The colour sectors rotate one full turn
  per loop.

## How to add a colourway (one data row)

Every version is one object in `src/versions.ts`. To add one:

1. Copy an existing row in the right array (`RETRO_VERSIONS`,
   `GLASS_VERSIONS`, `SMOKE_VERSIONS` or `FIBRE_VERSIONS`).
2. Give it a new `id` (letters, digits and hyphens only), for example
   `GlassSpiral-Emerald`.
3. Change the colours (hex sRGB) and, if needed, the intensities.

`Root.tsx` registers every row automatically, so nothing else needs editing.
For example:

```ts
{
  id: "FibreTunnel-MintPink",
  colorA: "#3AFFB0",
  colorB: "#FF5AC8",
  hazeA: "#0A5A40",
  hazeB: "#5A1040",
  centre: "#060408",
  intensity: 0.8,
},
```

## Determinism

Remotion renders frames out of order across several tabs, so every value on
screen is computed from `useCurrentFrame()` alone:

- All randomness comes from `mulberry32` seeded at module level or at scene
  build time (terrain, plates, grain homes, filament paths, stars, dust). The
  code contains no `Math.random()`, `Date.now()`, `useFrame` clock reads, or
  state carried between frames.
- The R3F canvas is only the WebGL host. A priority-1 `useFrame` callback
  renders, but it reads only the Remotion frame (folded into 0–599).
- Generated textures and the PMREM environment are built synchronously while
  a `delayRender` handle is held. PixiJS initialises inside a `delayRender`.
- There is no TAA and nothing accumulates across frames.
- Grain and dither come from an integer hash of pixel position and loop frame.

## Banding

- The scene and bloom chain use half-float render targets.
- Every three.js composition gets ±1/255 triangular dither in its final pass
  and about 1 % luminance grain, faded out below about 3 % luminance. Both
  come from a fixed hash of pixel and frame.
- Particle Smoke has **no** grain and **no** dither.
- Previews are encoded from PNG frames, not JPEG.

## Measured results

Measured in a 4-core cloud container **with no GPU**: Chromium's WebGL2 ran on
SwiftShader (software). Expect a machine with a real GPU to be many times
faster, the three.js looks especially.

### Render time per frame at 720p (`--scale=0.3333…`, 4 tabs)

| Composition | Full 600-frame render | Wall time per frame | Per tab per frame |
|---|---|---|---|
| RetroMountains-Sunset | 537 s | 0.89 s | ≈3.6 s |
| RetroMountains-Midnight | 521 s | 0.87 s | ≈3.5 s |
| GlassSpiral-Blue | 1875 s | 3.13 s | ≈12.5 s |
| GlassSpiral-Amber | 1865 s | 3.11 s | ≈12.4 s |
| ParticleSmoke-White | 570 s | 0.95 s | ≈3.8 s |
| FibreTunnel-RedCyan | 2688 s | 4.48 s | ≈17.9 s |
| FibreTunnel-VioletGold | 2626 s | 4.38 s | ≈17.5 s |

The Glass Spiral is costly because every plate is drawn on its own: each one
refracts the resolved image behind it, so about 35 plates means about 35
render-plus-resolve passes per frame. The Fibre Tunnel's cost is fill rate:
thousands of overlapping additive line quads.

### Two real 4K frames (3840×2160, frame 300, one tab)

Each was timed as a 3-frame render minus a 1-frame render, divided by 2, so
browser start-up cancels out.

| Composition | 1 frame (incl. start-up) | 3 frames | **Per 4K frame** |
|---|---|---|---|
| GlassSpiral-Blue | 56.0 s | 121.2 s | **≈32.6 s** |
| ParticleSmoke-White | 7.0 s | 19.9 s | **≈6.5 s** |

### 4K estimates for a full 600-frame render (this CPU-only machine)

Estimates use the measured 4K frames, and about 9× the 720p cost (the pixel
ratio) where no 4K frame was timed. The range runs from ideal 4-tab
parallelism to none, since SwiftShader already uses every core.

| Composition | Estimate |
|---|---|
| Retro Mountains (each) | ≈1.5–5 h |
| Glass Spiral (each) | ≈1.4–5.4 h (32.6 s × 600 / 4 … ×1) |
| Particle Smoke | ≈16–65 min (6.5 s × 600 / 4 … ×1) |
| Fibre Tunnel (each) | ≈7–25 h |

On a workstation GPU these should come down to minutes per composition. GPU
rasterisation, MSAA resolves and additive fill are exactly what SwiftShader
is slow at. For a CPU-only render farm, raise `--concurrency` to the number of
cores divided by 2 or 3.

## Verification log

All checks below were run on the delivered 720p previews and on stills from
the same bundle.

| Check | Result |
|---|---|
| 1. ffprobe: 1280×720, 30/1, H.264, yuv420p, no audio, 20.0 s | **Pass, all 7** |
| 2. Loop: 601-frame comps, frame 600 vs frame 0 | **Pixel and byte identical, all 7**. The seam step (599→600) equals an ordinary step (598→599) to within 1 %. |
| 3. Cold-start frame 300 vs the same frame from a 4-tab, out-of-order render | **Byte identical, all 7** |
| 4. Banding, from frames decoded out of the MP4s | Sunset sky changes 1–2 levels per row with no plateaus. 5–8× contrast-stretched crops of the sky, the Fibre haze and the dark glass show no contour lines. |
| 4. Particle Smoke black level, 50 points in empty areas | **0 or 1 on every channel: pass** |
| 5. Contact sheets (frames 0/120/240/360/480) | Every look shows its required features. Smoke failed first time (it filled to the bottom edge at frames 360–480); fixed with a vertical envelope and re-rendered. |
| 6. Motion, 2 s around frame 300 | Frame-to-frame change is steady: no pops, stutter or line crawl. Glass failed first time with two bugs: draw-order swaps that popped, and a NaN that blanked blades for one frame. Both fixed and re-rendered. A full 600-frame scan of every MP4 finds no one-frame glitches. |
| Clean copy: `npm install && npx remotion studio` | **Pass**: studio serves, and `tsc` is clean |

## Completion checklist

- [x] 7 compositions, each one data row, 3840×2160 at 30 fps, 600 frames, seamless
- [x] three.js on WebGL2 via `@remotion/three`; PixiJS 8 on WebGL2 for the smoke; no WebGPU
- [x] No text, logos or brands; no MCP servers used
- [x] Seeded `mulberry32` only; no `Math.random()`, `Date.now()`, clock or state-driven visuals
- [x] Half-float post chain; ±1/255 dither and ~1 % grain on 1, 2, 3, 4, 6, 7; none on 5
- [x] 720p previews of all 7 (H.264, yuv420p, CRF 16) and a 720p PNG still of each
- [x] README: 4K commands, still command, GL flag, Screen/Add note, grain-scaling note, timings, checks, colourway how-to
- [x] Zip without `node_modules`, `.git`, `refs/` or render output

## Deviations from the brief

- **Glass plate step is 14°, not about 9°.** With 9°, about 40 plates
  overlapped into a dense rosette. Every reference comparison flagged this as
  the largest difference, since the reference shows about 12–15 large,
  separate slabs per turn. There are still 60 plates; about one turn is
  visible.
- **Glass transmission is screen-space.** three.js's built-in transmission
  pass only sees opaque objects, so glass plates could not refract one
  another. The plates still use `MeshPhysicalMaterial` (IOR 1.5, low
  roughness, thin-film iridescence, PMREM environment with two strip lights).
  Transmission is computed in the shader from the image already drawn behind
  each plate, with bevel refraction, a little dispersion, path-length
  absorption and Fresnel.
- **Particle Smoke time loop.** The noise is periodic Perlin noise whose
  lattice tiles in x (for the one-period sideways drift) and in time, rather
  than 4D noise sampled on a `cos`/`sin` circle. Both loop exactly; the tiled
  lattice is about 4× cheaper per grain. A blurred, dimmer copy of the grains
  adds the soft glow under the wisps; blurring empty black leaves it exactly
  black.
- **Retro Mountains mountain mesh** uses a coarser jittered lattice (cells
  about 2.5 × 2.7 floor cells) on top of the 1-cell floor grid. The reference
  has large facets, and a 1-cell triangulation read as busy shards.
- **Sunset sky colours** follow the brief's hex values (`#2A0A5A` →
  `#5A2ADA` → `#E83A8A`). The reference is darker and more saturated at the
  top (close to black); the brief's colours were kept.
