# Machine Loops: Steampunk Frame, Robot Walk, Machine Blueprint, Ocean Depth

One Remotion project with 8 compositions, all defined at **3840×2160, 30 fps**. Everything is
built in code: no image textures, no stock assets, no `Math.random()`.

| Composition id (CLI) | Output file | Length | Engine | Background |
|---|---|---|---|---|
| `SteampunkFrame-White` | `SteampunkFrame_White.mp4` | 10 s loop (300 f) | three.js / WebGL2 | white, screen `#00FF00` |
| `SteampunkFrame-Green` | `SteampunkFrame_Green.mp4` | 10 s loop (300 f) | three.js / WebGL2 | `#00FF00`, screen `#00FF00` |
| `RobotWalk-Turnaround` | `RobotWalk_Turnaround.mp4` | 12 s loop (360 f) | three.js / WebGL2 | white |
| `RobotWalk-Loop` | `RobotWalk_Loop.mp4` | 10 s loop (300 f) | three.js / WebGL2 | white |
| `RobotWalk-Green` | `RobotWalk_Green.mp4` | 10 s loop (300 f) | three.js / WebGL2 | `#00FF00` |
| `MachineBlueprint-Beam` | `MachineBlueprint_Beam.mp4` | 20 s loop (600 f) | Canvas 2D | black `(0,0,0)` |
| `OceanDepth-Labelled` | `OceanDepth_Labelled.mp4` | 15 s (450 f) | Canvas 2D + SVG + WebGL2 shader | — |
| `OceanDepth-Clean` | `OceanDepth_Clean.mp4` | 15 s (450 f) | Canvas 2D + SVG + WebGL2 shader | — |

Remotion only allows `a-z A-Z 0-9 -` in composition ids, so the ids use a hyphen and the
files an underscore.

## Setup

```sh
npm ci          # versions are pinned in package.json / package-lock.json
npm run dev     # Remotion Studio
```

Node 20.10+ (tested on 22). Use the ANGLE GL backend for the three.js clips (`--gl=angle`,
already set in `remotion.config.ts`).

## Render at 4K

```sh
npx remotion render src/index.ts SteampunkFrame-White out/SteampunkFrame_White.mp4 --gl=angle --image-format=png --codec=h264 --pixel-format=yuv420p --crf=16 --muted --timeout=120000
npx remotion render src/index.ts SteampunkFrame-Green out/SteampunkFrame_Green.mp4 --gl=angle --image-format=png --codec=h264 --pixel-format=yuv420p --crf=16 --muted --timeout=120000
npx remotion render src/index.ts RobotWalk-Turnaround out/RobotWalk_Turnaround.mp4 --gl=angle --image-format=png --codec=h264 --pixel-format=yuv420p --crf=16 --muted --timeout=120000
npx remotion render src/index.ts RobotWalk-Loop       out/RobotWalk_Loop.mp4       --gl=angle --image-format=png --codec=h264 --pixel-format=yuv420p --crf=16 --muted --timeout=120000
npx remotion render src/index.ts RobotWalk-Green      out/RobotWalk_Green.mp4      --gl=angle --image-format=png --codec=h264 --pixel-format=yuv420p --crf=16 --muted --timeout=120000
npx remotion render src/index.ts MachineBlueprint-Beam out/MachineBlueprint_Beam.mp4 --gl=angle --image-format=png --codec=h264 --pixel-format=yuv420p --crf=16 --muted --timeout=120000 --x264-preset=veryslow
npx remotion render src/index.ts OceanDepth-Labelled  out/OceanDepth_Labelled.mp4  --gl=angle --image-format=png --codec=h264 --pixel-format=yuv420p --crf=16 --muted --timeout=120000
npx remotion render src/index.ts OceanDepth-Clean     out/OceanDepth_Clean.mp4     --gl=angle --image-format=png --codec=h264 --pixel-format=yuv420p --crf=16 --muted --timeout=120000
```

- `--image-format=png` matters: JPEG frames would shift the keying colours.
- For a master you can also render ProRes 4444 (`--codec=prores --prores-profile=4444`).
- Every canvas renders at the output size (`devicePixelRatio`), so 4K is drawn at 4K, not upscaled.
- 720p previews: `bash scripts/render-previews.sh` (adds `--scale=0.3333333333333333`).

## Keying the green clips

`SteampunkFrame_Green` (background **and** screen) and `RobotWalk_Green` use exact `#00FF00`
with no grain, dither, glow or shadow on it. `SteampunkFrame_White` has an exact `#00FF00` screen
on pure white.

- **After Effects:** Keylight 1.2, Screen Colour `#00FF00`, Screen Gain 100, Clip Black 5,
  Clip White 95, Screen Despill Bias default. Or Effect > Keying > Color Key (tolerance 20,
  edge thin 1).
- **Premiere Pro:** Ultra Key, Key Color `#00FF00`, Setting: Default; raise Choke slightly if
  you need a harder edge.
- **DaVinci Resolve:** 3D Keyer (or Qualifier), pick `#00FF00`, Despill on.
- **ffmpeg:** `chromakey=0x00FF00:0.12:0.05` (the verify test uses exactly this).

Edges are anti-aliased (4× MSAA), so a 1-pixel edge carries a little green mixed with the
metal or outline. Leave despill on in your keyer. The materials themselves contain no green:
the oxidised copper is a muted brown-grey and the robot's teal is far from the key in hue.

To use the **screen** in `SteampunkFrame_White`, key the green and place your footage
underneath. It is unlit, with no reflection or glare, so it keys to a clean rounded rectangle.

## Blend modes

| Clip | Suggested mode |
|---|---|
| `MachineBlueprint_Beam` | **Screen** or **Add** (Linear Dodge). Background is exactly `(0,0,0)`. |
| `SteampunkFrame_White`, `RobotWalk_Turnaround/Loop` | **Multiply** works for a quick overlay (white drops out). For a clean composite, key or luma-matte instead, since white parts of the subject would also drop out. |
| Green clips | Normal, after keying. |
| `OceanDepth_*` | Normal (full-frame). |

## Changing the robot colours

Edit one row each in `data/robot.json` and re-render:

```json
"body":    "#D9F2F7",
"panel":   "#1F7A80",
"accent":  "#F2B32A",
"outline": "#141414"
```

The toon shader derives the second (shadow) tone automatically. For the green clip keep each
colour away from pure green (green should not exceed both red and blue by much).

## Changing the ocean labels (translations)

All on-screen text is in `data/oceanDepth.json`, one row each:

```json
"badgeFeet": "FT",
"badgeMetres": "M",
"pressureUnit": "MPa",
"zones": [ { "name": "Epipelagic Zone", "topM": 0, "bottomM": 200 }, ... ]
```

Feet values are computed from the metre ticks (×3.28084, rounded). Pressure is depth / 100 MPa
(about 0.1 MPa per 10 m of seawater). `OceanDepth_Clean` has the scales and dashed lines but no
zone names or pressure tag. Inter is bundled with Latin and Latin Extended glyphs; for other
scripts, add a font to `public/fonts` and `src/lib/fonts.ts`.

## How it is built

- `src/lib/pipeline.ts`: three.js scenes render into a **half-float, 4× MSAA** target. The
  final pass applies a tone curve that maps the key colours exactly (1.0 → 255, 0 → 0) and adds
  ±1/255 triangular dither. Dither is skipped on pure white, pure `#00FF00` and pure black.
- `src/steampunk/`: PBR metals with procedural rust, grime, edge wear and copper oxidation in the
  shader (`materials.ts`). Gears are real tooth profiles. Meshing gears turn at the tooth-count
  ratio in opposite directions, with teeth interleaved. The top train advances 24 teeth and the
  bottom 36 per loop, so every gear turns a whole number of teeth in 300 frames. Every other
  motion has a period that divides 300.
- `src/robot/`: original robot. Toon shader (two tones + small highlight) and inverted-hull
  outlines with constant on-screen width. The walk is IK-driven: feet follow ground contact (heel
  strike, flat, toe-off), so the planted foot moves back at constant treadmill speed.
- `src/blueprint/engine.ts`: the beam engine as **named SVG part groups** (`docs/engine-parts.svg`
  is exported from it). One crank angle drives everything:
  - Watt parallel-motion linkage
  - connecting rod and crank
  - flywheel with a toothed rim driving a 5:1 pinion
  - eccentric and valve gear
  - air and feed pumps
  - a 2:1 belt-driven governor with bevel drive, bell lever and throttle rod

  `node scripts/audit-engine.mjs` replays all 601 frames and proves every link length, clearance
  and the loop closure. It follows the method of the wheresryan22/anatomy skill (MIT).
- `src/ocean/`: background shader (surface light, rays, bump-lit rocky wall) rendered into an
  RGBA16F target, then dithered. Seeded marine snow and bubbles go on a 2D canvas; text, scales
  and the submarine are SVG.

## Determinism

Every value comes from `useCurrentFrame()`. Random values come from `mulberry32` seeded at
module level. No `useFrame`, `Date.now()` or state drives visuals. Fonts load behind
`delayRender`. `python3 scripts/verify.py determinism` compares a cold-start still against the
same frame from a running render.

## Verification

```sh
node scripts/audit-engine.mjs   # mechanism audit for the beam engine
python3 scripts/verify.py       # probe, loops, levels, key, numbers, determinism (needs out/ previews)
```

`--props='{"loopCheck":true}'` lengthens every loop by one frame so the extra frame can be
compared with frame 0.

## Timings

Measured on the build machine: 4 CPU cores, **no GPU** (WebGL runs on ANGLE's software
backend), Remotion 4.0.515, Chromium headless shell. A machine with a GPU will be much faster on
the three.js clips.

720p previews (`--scale=0.3333333333333333`, 4 workers, wall clock including bundling and
encoding):

| Clip | Frames | Total | Per frame |
|---|---|---|---|
| SteampunkFrame_White | 300 | 193.6 s | 0.65 s |
| SteampunkFrame_Green | 300 | 186.6 s | 0.62 s |
| RobotWalk_Turnaround | 360 | 91.3 s | 0.25 s |
| RobotWalk_Loop | 300 | 73.0 s | 0.24 s |
| RobotWalk_Green | 300 | 71.9 s | 0.24 s |
| MachineBlueprint_Beam | 600 | 98.3 s | 0.16 s (x264 `veryslow`) |
| OceanDepth_Labelled | 450 | 157.6 s | 0.35 s |
| OceanDepth_Clean | 450 | 157.4 s | 0.35 s |

One 4K frame (scale 1, one worker; start-up and scene build excluded by differencing a 1-frame
and a 10-frame render):

| Clip | Per 4K frame | Estimated full 4K render, 4 workers |
|---|---|---|
| SteampunkFrame_White | 2.97 s | ~4 min for 300 frames |
| MachineBlueprint_Beam | 0.51 s | ~2 min for 600 frames (plus `veryslow` encode) |
