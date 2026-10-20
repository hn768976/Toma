# Perpetual Motion Machines — five isometric loops (Remotion)

Five seamless 20-second loops (600 frames, 30 fps) of the classic historical
perpetual-motion designs, drawn as detailed isometric machines with
[anatomy](https://github.com/wheresryan22/anatomy) and animated in Remotion. Each
composition is defined at 3840 × 2160 (16:9). Real perpetual motion is impossible:
these are illustrations of famous designs, as museums and textbooks show them, but
every movement is physically believable from frame to frame.

| Composition id (Remotion)            | Output file                              | Design |
|--------------------------------------|------------------------------------------|--------|
| `PerpetualMotion-OverbalancedWheel`  | `PerpetualMotion_OverbalancedWheel.mp4`  | Overbalanced hammer wheel |
| `PerpetualMotion-WaterScrewMill`     | `PerpetualMotion_WaterScrewMill.mp4`     | Robert Fludd's water-screw mill |
| `PerpetualMotion-SelfFlowingFlask`   | `PerpetualMotion_SelfFlowingFlask.mp4`   | Boyle's self-flowing flask |
| `PerpetualMotion-MagnetRamp`         | `PerpetualMotion_MagnetRamp.mp4`         | John Wilkins' magnetic ramp |
| `PerpetualMotion-RollingBallWheel`   | `PerpetualMotion_RollingBallWheel.mp4`   | Rolling-ball overbalanced wheel |

Remotion only allows letters, digits and `-` in composition ids, so the ids use a hyphen
where the requested names use `_`. The render scripts write the files with the
underscore names.

## Setup

```sh
npm ci            # Node 20.10+ (built on 22.22); versions are pinned in package.json
npm run art       # optional: regenerate the SVG art from the anatomy kit (already committed)
npm run studio    # preview in Remotion Studio
```

## Render at 4K

Each loop is 600 frames. Render with no `--scale` for 3840 × 2160:

```sh
npx remotion render src/index.ts PerpetualMotion-OverbalancedWheel out/PerpetualMotion_OverbalancedWheel.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render src/index.ts PerpetualMotion-WaterScrewMill    out/PerpetualMotion_WaterScrewMill.mp4    --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render src/index.ts PerpetualMotion-SelfFlowingFlask  out/PerpetualMotion_SelfFlowingFlask.mp4  --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render src/index.ts PerpetualMotion-MagnetRamp        out/PerpetualMotion_MagnetRamp.mp4        --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render src/index.ts PerpetualMotion-RollingBallWheel  out/PerpetualMotion_RollingBallWheel.mp4  --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

For ProRes masters use `--codec=prores --prores-profile=4444`. The 720p previews are
`bash scripts/render-previews.sh` (`--scale=0.3333333333333333`, 1280 × 720, CRF 16).

## 6K stills

```sh
node scripts/render-stills.mjs 0              # all 10: 6000 × 3375 PNG + vector SVG, frame 0
python3 scripts/stills-sheet.py               # StillsSheet.png (all 10 at 640 × 360, labelled)
```

One still from the command line:

```sh
npx remotion still src/index.ts PerpetualMotion-MagnetRamp out/magnet-6k.png --frame=0 --scale=1.5625 --props='{"look":"blueprint","verify":false}'
```

## Switching to Blueprint

Every composition takes a `look` prop: `"workshop"` (the default, Inventor's Workshop:
aged brass, dark oak, iron and water on warm parchment) or `"blueprint"` (white and
pale-cyan lines on `#0E3A6A`). The videos are rendered in Workshop; Blueprint is one switch
away:

```sh
npx remotion render src/index.ts PerpetualMotion-WaterScrewMill out/WaterScrewMill_Blueprint.mp4 --props='{"look":"blueprint","verify":false}' --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

or change `defaultProps` in `src/Root.tsx`. Both palettes are data rows in
`src/lib/look.ts`.

## Timings

Measured on the build machine (4 vCPU, 15 GB, Chromium headless shell, Remotion 4.0.515):

| Clip | 720p preview, whole clip | per frame (wall, concurrency 4, incl. bundling) |
|---|---|---|
| OverbalancedWheel | 134 s | 223 ms |
| WaterScrewMill | 154 s | 256 ms |
| SelfFlowingFlask | 120 s | 200 ms |
| MagnetRamp | 122 s | 203 ms |
| RollingBallWheel | 133 s | 221 ms |

One 4K frame (3840 × 2160, single frame, warm browser, median of 3): OverbalancedWheel
2.94 s, WaterScrewMill 3.13 s. A full 600-frame 4K clip at concurrency 4 is therefore roughly
8–10 minutes on a similar machine. A 6K still takes 6–9 s.

## How it is built

- `vendor/anatomy/` — anatomy, pinned (see `vendor/anatomy/PINNED_COMMIT`), MIT
  (`LICENSES/anatomy-MIT.txt`).
- `scripts/build-art.mjs` + `scripts/art/*.mjs` — each machine drawn with the kit at build
  time; turning parts drawn flat in their own plane.
- `scripts/split-parts.mjs` — splits anatomy's flat SVG into named part groups with pivots,
  fixes two kit quirks, writes `art/svg/<machine>.svg` and `src/generated/<machine>.ts`.
  `docs/anatomy-notes.md` explains what anatomy's SVG looks like and what was changed.
- `src/machines/*.spec.ts` — one shared geometry/model per machine, used by both the build
  and the video.
- `src/lib/sim.ts` — the hammers and rolling balls are simulated as real damped systems
  (gravity, hinge pegs and stops, rolling at 5/7 g, bounces) until their motion repeats
  each revolution; the result is a table indexed by wheel angle.
- `src/lib/Backdrop.tsx` — parchment, vignette and soft floor shadows computed per pixel in
  floating point with ±1/255 dither, plus ~1% grain from a fixed hash of pixel and frame.
- Rotation in isometric: every wheel, gear and the lantern turn in their own plane with
  `transform = isoFace · rotate(θ)` (`src/lib/iso.ts`, `src/lib/Planar.tsx`).
- Determinism: everything comes from `useCurrentFrame()`; no `Math.random()`, `Date.now()`
  or state; the only PRNG is `mulberry32`, seeded at module level for ripple variety.

Checks:

- `bash scripts/verify.sh` — renders the 601-frame variant (`verify: true`) as PNGs; frame 0
  must equal frame 600 pixel for pixel, and a cold-start still of frame 300 must equal the
  full render's frame 300 byte for byte.
- `node scripts/check-mechanisms.mjs` — reads each machine's own model: hammers out on the
  descending side and folded on the rising side; balls out on the descending side; spur
  gears opposite with the 32:16 ratio; crown 36 : lantern 9; the screw's water pockets rising;
  the magnet ramp's closed path with two balls half a cycle apart; and that `isoFace · rotate(θ)`
  keeps a rim point on its face ellipse at every angle.
- `node scripts/time-4k.mjs` — times one 4K frame; `node scripts/contact.mjs` renders review strips.

A note on Wilkins' ramp: its natural cycle is 6.5 s and it plays over 300 frames (10 s). Nothing
in the frame fixes the scale, so this is the same physics on a machine about 2.4× the modelled
size (a ~24 cm iron ball), and it keeps the fall and the roll down the chute readable.

## The designs (for stock descriptions)

**Overbalanced hammer wheel.** The oldest family of perpetual-motion claims. Bhāskara II
(India, c. 1150, *Siddhānta Śiromaṇi*) described a wheel whose curved spokes were part-filled
with mercury so that one side would always be heavier; Villard de Honnecourt's sketchbook
(France, c. 1230) shows a wheel ringed with hinged mallets, an odd number of them, "that turns
by itself". The hammers swing out past the top on the descending side and fold against the
rim on the rising side, so the falling side always seems heavier. It never turns: there are
more hammers on the rising side, and their torques cancel exactly.

**Robert Fludd's water-screw mill (1618).** The English physician and mystic Robert Fludd
published this closed-cycle water mill in *Utriusque Cosmi … Historia* (1618), after a design
of the Italian engineer Jacopo Strada (1575). Water from an upper tank turns an overshot
waterwheel; gears from the wheel turn an Archimedes screw that lifts the same water back to
the tank, with power to spare for a millstone. Friction and the energy taken by the screw
mean the wheel always delivers less than the screw needs.

**Boyle's self-flowing flask (17th century).** Attributed to Robert Boyle, the father of
modern chemistry: a flask whose long, narrowing neck leads out of the bowl, climbs and
bends back over its mouth. The claim was that the liquid would climb the thin neck
(as in a capillary or siphon) and drip back into the bowl for ever. Capillary rise or
pressure can lift the liquid into the neck, but the same forces hold it there: it never
drips out.

**John Wilkins' magnetic ramp.** John Wilkins, Bishop of Chester and a founder of the Royal
Society, described it in *Mathematical Magick* (1648; often dated to his later works, c. 1670)
— and explained why it fails. A lodestone on a pillar draws an iron ball up an inclined
ramp; just before the top the ball drops through a hole onto a curved trough that returns it
to the foot of the ramp, to be drawn up again. A magnet strong enough to pull the ball up the
ramp is too strong to let it fall through the hole.

**Rolling-ball overbalanced wheel.** The most often re-invented design, best known from the
Marquess of Worcester's great wheel with forty weights (demonstrated in the 1640s and listed
in his *Century of Inventions*, 1663) and from many 17th–19th-century variants. Heavy balls
in curved spoke channels roll out to the rim on the descending side and back toward the hub
on the rising side, so the falling side seems to have more leverage. It stops: more balls
always sit on the rising side, and the moments balance.
