# Four Looks × Two Versions (Remotion, 30 fps, 3840×2160)

Eight compositions in one Remotion project. Everything is built in code: no MCP servers,
no icon libraries, no logos, no stock assets. Fonts are Montserrat and Inter (SIL OFL,
shipped in `public/fonts/` with their licences).

| # | Look | 2D/3D | Compositions | Length |
|---|------|-------|--------------|--------|
| 1 | Grain Gradient Glow | 2D (WebGL2 fragment shader) | `GrainGlow-Violet`, `GrainGlow-Sunset` | 600 f (20 s loop) |
| 2 | Plexus Sphere | 3D (`@remotion/three`) | `PlexusSphere-BlueViolet`, `PlexusSphere-TealWhite` | 450 f (15 s) |
| 3 | Hex Mosaic Transition | 2D (canvas) | `HexMosaic-Blue`, `HexMosaic-Gold` | 240 f (8 s) |
| 4 | Neon Badge | 3D (`@remotion/three`) | `NeonBadge-MadeByHuman`, `NeonBadge-MakePeace` | 600 f (20 s loop) |

## Setup

```bash
npm install          # Node 18+; versions are pinned in package.json / package-lock.json
npx remotion studio  # preview (the studio renders 3D looks at half resolution to stay responsive)
```

**Chromium GL flag:** WebGL2 in headless Chromium needs ANGLE. It is set in
`remotion.config.ts` (`Config.setChromiumOpenGlRenderer("angle")`), equivalent to passing
`--gl=angle` on every `render` / `still` command. On a machine without a GPU, ANGLE falls
back to SwiftShader (software); results are identical, just slower.

## Render commands

4K masters (H.264, yuv420p, CRF 16 and lossless PNG intermediates come from `remotion.config.ts`):

```bash
npx remotion render GrainGlow-Violet        out/GrainGlow_Violet_4K.mp4        --gl=angle
npx remotion render GrainGlow-Sunset        out/GrainGlow_Sunset_4K.mp4        --gl=angle
npx remotion render PlexusSphere-BlueViolet out/PlexusSphere_BlueViolet_4K.mp4 --gl=angle
npx remotion render PlexusSphere-TealWhite  out/PlexusSphere_TealWhite_4K.mp4  --gl=angle
npx remotion render HexMosaic-Blue          out/HexMosaic_Blue_4K.mp4          --gl=angle
npx remotion render HexMosaic-Gold          out/HexMosaic_Gold_4K.mp4          --gl=angle
npx remotion render NeonBadge-MadeByHuman   out/NeonBadge_MadeByHuman_4K.mp4   --gl=angle
npx remotion render NeonBadge-MakePeace     out/NeonBadge_MakePeace_4K.mp4     --gl=angle
```

For a mastering codec instead of H.264 add e.g. `--codec=prores --prores-profile=4444`.

1080p previews: add `--scale=0.5` (or run `scripts/render_previews.sh`).

Stills (6000×3375 = 3840×2160 × 1.5625):

```bash
npx remotion still PlexusSphere-BlueViolet out/plexus_sphere.png --frame=440 --scale=1.5625 --gl=angle
```

`scripts/render_stills_6000.sh` renders the two stills per composition used for delivery.

`--scale` really changes the render resolution (the WebGL drawing buffer and the 2D canvas
follow `devicePixelRatio`), so a 6000 px still is rendered at 6000 px, not upscaled.

## Measured render time

TIMING_TABLE

## How it is built

- **Determinism.** Every value on screen is a function of `useCurrentFrame()` only. All
  randomness comes from `mulberry32` seeded at module level (`src/lib/random.ts`); per-pixel
  noise uses integer hashes (`pcg3d` in GLSL, an integer mixer in JS). No `Math.random()`,
  no `Date.now()`, no `useState` driving visuals, no CSS animation, no R3F clock: the 3D
  looks take over R3F's render with a priority-1 `useFrame` whose callback ignores the clock
  and draws the Remotion frame (`src/lib/gl/GLStage.tsx`). No TAA / temporal effects.
- **Loops** (looks 1 and 4). Time enters as `2π·((frame·k) mod 600)/600` with integer `k`
  (`src/lib/loop.ts`), so frame 600 produces bit-identical inputs to frame 0. Look 1's noise is
  sampled on a circle in time; grain uses `frame % 600`. Look 4's hologram streak pattern is
  3 badge-heights tall and scrolls exactly one pattern repeat per loop; glitch windows sit
  inside one loop. Each looping composition accepts `{"loopCheck": true}` to become 601 frames.
- **Post pipeline (looks 2 and 4, `src/lib/gl/post.ts`).** HDR scene (4× MSAA + depth
  texture) → depth of field (48-tap scatter-as-gather with a per-tile reach map that skips
  pixels with no out-of-focus geometry nearby) → bloom (soft threshold + dual-filter mip chain)
  → composite (background, highlight roll-off, ~2% grain from pixel position + frame,
  ±1/255 triangular dither).
- **Look 1** is one fragment shader: Gaussian blobs on closed Lissajous paths, a soft
  moving dark wedge, deep corners, three tapered light streaks, a 5-stop colour ramp,
  ~7% monochrome grain + dither.
- **Look 2**: 3,000 instanced cubes and ~6,500 links (3–4 nearest neighbours in the final
  sphere, computed once at module level) drawn as screen-space quads in one instanced draw
  call, so lines keep the same visual weight at 1080p, 4K and 6000 px. Each node has a
  column position derived from its sphere position (polar angle → height, azimuth kept),
  so sphere neighbours are already near each other in the column.
- **Look 3**: one canvas, one path per tile, tile timings from distance to centre plus
  seeded angular noise and jitter. Grain is multiplicative and only touches lit pixels,
  so black stays exactly 0,0,0.
- **Look 4**: `TubeGeometry` along the rounded hexagon, face text drawn to a 4096×2617
  canvas texture (after the fonts load, behind `delayRender`), hologram streaks in a shader
  layer, glitch smear / stretched copy / RGB split / brightness dip in the composite.

## Add a version (one data row)

Each look has a `versions.ts`; `src/Root.tsx` maps over it, so a new row is a new composition.

```ts
// src/looks/neon-badge/versions.ts
{
  id: "NeonBadge-StayCurious",
  top: { kind: "text", text: "100%" },      // or { kind: "icon", icon: "dove" }
  line1: "STAY",
  line2: "CURIOUS",
  strip: "ASK MORE",
  ring: "CURIOUS · ",
  neon: "#5FD8FF",
  stripColor: "#E8343C",
  stripText: "#1A0A12",
  background: "#0A1A5A",
},
```

The other looks work the same way: `grain-glow/versions.ts` (5 ramp stops),
`plexus/versions.ts` (node palette, link colour, background), `hex-mosaic/versions.ts`
(tile dark/light, flash colour).

## Banding check

BANDING_SECTION

## Completion checklist

CHECKLIST_SECTION

## Project layout

```
remotion.config.ts         GL flag, codec, CRF, pixel format
src/Root.tsx               8 compositions from the version rows
src/lib/                   seeded RNG, loop phase, fonts, GL stage, post pipeline
src/looks/grain-glow/      look 1
src/looks/plexus/          look 2
src/looks/hex-mosaic/      look 3
src/looks/neon-badge/      look 4 (icons.ts holds the self-drawn dove path)
public/fonts/              Montserrat 700/800, Inter 500/600 (woff2) + OFL licences
scripts/                   render + verification scripts (bash + python3/Pillow/numpy)
```
