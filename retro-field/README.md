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

(see sections below; filled in from the verification run)
