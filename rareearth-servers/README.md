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

## Measured render times (this build machine)

Measured on a 4-core cloud VM with **no GPU** (Chromium headless shell, ANGLE
falling back to SwiftShader software GL), concurrency 1. Per-frame times are
amortised from a 10-frame sequence minus a 1-frame run (which removes the
~6–8 s of browser/bundle start-up).

| Composition | 720p s/frame | 720p 1-frame still (incl. start-up) |
|---|---|---|
| ElementRing-Teal | 3.4 | 14.4 s |
| ElementRing-Violet | 3.0 | 14.4 s |
| ChipOnOre-Blue | 2.7 | 13.0 s |
| EVBatteryPack-Story | 3.2 | 14.2 s |
| ServerStreams-Blue | 2.3 | 9.6 s |
| ServerStreams-TealMirrored | 2.4 | 9.5 s |
| AIRacks-Blue | 2.2 | 9.7 s |
| AIRacks-Violet | 2.3 | 9.3 s |

**Real 4K frames (3840×2160):**
- ElementRing-Teal frame 300: 52.6 s as a one-off still (with start-up). Amortised over a 3-frame sequence: **20.1 s/frame**.
- AIRacks-Blue frame 300: 41.5 s as a one-off still. Amortised: **18.4 s/frame**.

**4K estimates on this CPU-only machine** (4K ≈ 6–8× the 720p cost):
- ElementRing-Teal / -Violet: 600 × ~20 s ≈ 3.3 h each.
- ChipOnOre-Blue: ≈ 3.0 h.
- EVBatteryPack-Story (300 f): ≈ 1.8 h.
- ServerStreams ×2: ≈ 2.7 h each.
- AIRacks ×2: 600 × 18.4 s ≈ 3.1 h each.
- All eight: ≈ 23 h serial.

On a machine with a real GPU, expect these to drop by one to two orders of
magnitude; raise `--concurrency` there.

## Verification results

| Check | Result |
|---|---|
| Model check (fresh sub-agent, 3 rounds on grey stills: nugget, chip, battery pack, rack) | Nugget went from "crumpled low-poly blob, random tint per face" to "rock or ore nugget, metallic mineral"; the battery pack gained cells, busbar and terminations; the rack gained real 3D units. |
| Loop: 601-frame build, frame 0 vs 600 (all 7 loops) | **Identical pixel for pixel** |
| Determinism: frame 300 (150 for the story), two separate cold processes | **Byte-identical** for all 8 |
| Determinism: frame 300/150 out of a multi-frame sequence vs cold single frame | **Byte-identical** for all 8 |
| Banding: still → H.264 yuv420p CRF 16 → decoded, luminance read along the at-risk areas | Smooth: every gradient line has short runs (8–21 of 400 samples) with no stair-steps; the one long run is a genuinely flat fog area |
| Text / data | Tile text matches the element table (checked at 4K); no brand names; the chip has no markings |
| Motion (10 consecutive frames per comp) | Frame-to-frame change steady (max/median 1.01–1.10, the 1.10 is an LED hold switching) |

Reproduce: `REMOTION_LOOP_CHECK=1` (env var at **render** time) makes the
loops 601 frames long, so `--frame=600` can be compared with `--frame=0`.

## Banding

The final pass adds ±1/255 triangular dither and ~1.5 % grain. The grain is a
fixed hash of (pixel, `frame % 600`), or `frame % 300` for the story.
`Math.random()` is never used. Dark floors (looks 1–2), blue fog (4), the
white studio falloff (3) and the gaps between racks (5) were all checked
after H.264 encoding, as above.

## Completion checklist

- [x] 8 compositions, 3840×2160, 30 fps; 7 × 600-frame loops, 1 × 300-frame story; one data row per version
- [x] three.js on WebGL2 via `@remotion/three`; no PixiJS, no WebGPU, no MCP servers
- [x] OFL fonts only (Inter 400/600/700 + licence)
- [x] Element data exactly as the brief's table
- [x] No logos, brands or manufacturer names; chip unmarked
- [x] No `Math.random()`, `Date.now()`, `useFrame` clock, frame-to-frame state, TAA or `AccumulativeShadows`
- [x] Loop, determinism, banding, content and smoothness checks (above)
- [x] 720p PNG still of each composition
- [ ] 720p mp4 previews: not rendered (dropped by request)

