# Rare Earths & AI Servers — Remotion + three.js (WebGL2)

Eight 3D motion graphics in one Remotion project, built entirely in code
(three.js via `@remotion/three`, WebGL2). No external assets except the Inter
font (SIL OFL 1.1, in `public/fonts/` with `OFL.txt`).

| Composition id | Look | Length | Reference |
|---|---|---|---|
| `ElementRing-Teal` | 1A Element Ring (as ref) | 20 s loop (600 f) | 2253118983 |
| `ElementRing-Violet` | 1B Element Ring, violet | 20 s loop | 2253118983 |
| `ChipOnOre-Blue` | 2 Chip on Ore | 20 s loop | 2253118973 |
| `EVBatteryPack-Story` | 3 EV Battery Pack | 10 s story (300 f) | 2253118987 |
| `ServerStreams-Blue` | 4A Server Streams (as ref) | 20 s loop | 2293641004 |
| `ServerStreams-TealMirrored` | 4B mirrored, teal | 20 s loop | 2293641004 |
| `AIRacks-Blue` | 5A AI Racks (as ref) | 20 s loop | 2293641049 |
| `AIRacks-Violet` | 5B AI Racks, violet | 20 s loop | 2293641049 |

All compositions are 3840×2160, 30 fps. (`Check-*` compositions are the grey
model-check stills, not deliverables.)

## Setup

```bash
npm install
npx remotion studio
```

Node 18+ (tested on Node 22). Versions are pinned in `package.json`
(Remotion 4.0.515, three 0.180.0, @react-three/fiber 9.3.0, React 19.2.3).

## Chromium GL flag

three.js needs a WebGL2 context in headless Chromium. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the same as passing
`--gl=angle` on the command line. Add `--gl=angle` explicitly if you render via
the Node APIs (where the config file doesn't apply). The config also sets
concurrency to 1 (one WebGL context per tab is the stable choice on GPU-less
machines; raise `--concurrency` on a machine with a real GPU).

## 4K render commands

```bash
npx remotion render ElementRing-Teal           out/ElementRing_Teal.mp4           --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render ElementRing-Violet         out/ElementRing_Violet.mp4         --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render ChipOnOre-Blue             out/ChipOnOre_Blue.mp4             --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render EVBatteryPack-Story        out/EVBatteryPack_Story.mp4        --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render ServerStreams-Blue         out/ServerStreams_Blue.mp4         --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render ServerStreams-TealMirrored out/ServerStreams_TealMirrored.mp4 --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render AIRacks-Blue               out/AIRacks_Blue.mp4               --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
npx remotion render AIRacks-Violet             out/AIRacks_Violet.mp4             --gl=angle --codec=h264 --pixel-format=yuv420p --crf=16
```

720p preview of any composition: add `--scale=0.3333333333333333` (gives exactly
1280×720).

## Stills

6000×3375 still (scale 1.5625 of 3840×2160), e.g. frame 300:

```bash
npx remotion still ElementRing-Teal out/ElementRing_Teal_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(For the 10 s story use a hold frame, e.g. `--frame=270`.) 720p still:
`--scale=0.3333333333333333`.

## Changing a colourway or the ring's elements (one data row)

Every version is one row in `src/data/versions.ts`; `src/Root.tsx` makes one
composition per row.

- **Ring elements:** edit `elements` in an `ELEMENT_RING` row. These are symbols
  from `src/data/elements.ts` (Z, symbol, name, mass), placed around the ring in
  order. To add a new element, add it to `ELEMENTS` first.
- **Colours:** change the hex values in the row (`colorA`/`colorB`/`floorGlow`;
  `glow`; `module`/`tile`; `room`/`lines`; `badge`/`streak`/`head`/`rackTint`).
- **New version:** copy a row and give it a new `id`. A new composition appears
  automatically. For Server Streams, `mirrored: true` mirrors the set and the
  camera.

## How it is built

- `src/engine/Post.tsx` — deterministic post pipeline: HDR scene with 4× MSAA
  and depth → SSAO (fixed 16-tap spiral) → depth-of-field gather (fixed 64-tap
  golden-angle pattern) → bloom mip chain → ACES tonemap, vignette, grain
  (1.5 %, a fixed hash of pixel and `frame % period`) and ±1/255 triangular
  dither. All radii are fractions of frame height, so 720p and 4K match.
- `src/engine/env.ts` — procedural PMREM studio (emissive soft-boxes in a box).
- `src/kit/ore.tsx` — ore nuggets: a cluster of convex rocks, each a sphere
  shrink-wrapped onto seeded half-spaces (flat Voronoi-like facets), plus a
  procedural micro-crumple bump and a smooth thin-film tarnish field driving
  `iridescence` (thickness 250–600 nm). Silver variant for Look 3. Small chips
  are instanced.
- `src/kit/tile.tsx` — hologram element tile: canvas texture (R = ink,
  G = glow) on a double-sided additive plane, so the back reads mirrored.
- `src/kit/flow.ts` — light lines/ribbons with travelling pulses.
- `src/kit/floor.tsx` — soft planar reflection (three's `Reflector` + fixed
  24-tap blur), layered over a lit floor.
- `src/looks/*.tsx` — the five looks.

### Determinism

Every value on screen is a function of `useCurrentFrame()` only: no
`Math.random()` (all randomness is `mulberry32` seeded at module level or a
stateless hash of (id, slot)), no `useFrame` clock, no `Date.now()`, no state
carried between frames, no TAA, no `AccumulativeShadows`. Fonts load once
behind `delayRender`, and canvas textures are built after that. Loop periods
(pulses, LED holds, streaks, bobbing, shimmer, camera drift) all divide 600.

<!-- RESULTS -->
