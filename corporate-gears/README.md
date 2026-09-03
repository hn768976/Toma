# Corporate Gears — looping motion background (Remotion)

Two 10-second seamless loops built for stock: flat vector gears, floating discs
and thin orbit arcs over a diagonal gradient. No 3D camera anywhere — the depth
is entirely shadow and scale, drawn as SVG so it stays crisp at any resolution.

| Composition id  | Colourway  | Centre word | Master size | Duration      |
| --------------- | ---------- | ----------- | ----------- | ------------- |
| `V1-GearsGold`  | gold/amber | BUSINESS    | 3840 × 2160 | 300f @ 30fps  |
| `V2-GearsBlue`  | blue/steel | STRATEGY    | 3840 × 2160 | 300f @ 30fps  |

## Setup

```bash
npm install
npx remotion studio
```

## Render at 4K

The compositions are defined at 3840 × 2160, so `--scale=1` is the 4K master:

```bash
npx remotion render V1-GearsGold out/V1_GearsGold.mp4 --scale=1 --crf=16
npx remotion render V2-GearsBlue out/V2_GearsBlue.mp4 --scale=1 --crf=16
```

1080p preview (what ships alongside this project), and the stills:

```bash
npx remotion render V1-GearsGold out/V1_GearsGold.mp4 --scale=0.5
npx remotion render V2-GearsBlue out/V2_GearsBlue.mp4 --scale=0.5
npx remotion still  V1-GearsGold out/V1_GearsGold.png --scale=0.5
npx remotion still  V2-GearsBlue out/V2_GearsBlue.png --scale=0.5
```

`remotion.config.ts` already pins H.264 / `yuv420p` / crf 16, PNG intermediate
frames and no audio track, so the commands above need no extra flags.

## How the loop is built

Every animated value is derived from `t = frame / durationInFrames`, so frame
300 is identical to frame 0 by construction:

- **Gears** rotate at constant angular velocity, `t * turns * 360`, with an
  integer `turns` per gear (+1, −1, +2 …) and no easing.
- **Discs** either sway `sin(2πt)` degrees along their orbit — which returns
  exactly to the start — or complete exactly one lap.
- **Sweep lines and the wave** drift laterally on the same looping sine.
- **Text never moves.** No fades, no tracking animation, no pulsing: the point
  of the clip is that a client can put their own titles over it.

Motion is deliberately slow; every rate lives in `src/layout.ts` if you want it
slower still.

## Where things live

```
src/
  Root.tsx              compositions (size, fps, duration, default props)
  CorporateGears.tsx    the scene, and all frame -> value maths
  layout.ts             every position, size, rate and label, as frame fractions
  theme.ts              the two colourways
  geometry/gear.ts      procedural gear paths, wireframe mesh, arc helpers
  components/           background + grain, gears, discs, orbits, sweeps, text
public/fonts/           Work Sans Bold (OFL), bundled so renders work offline
```

Nothing is hand-authored path data: gears are generated from tooth count, root
radius and tip radius, so any size is just a parameter. Sizes are fractions of
the frame height read from `useVideoConfig()`, which is why the same layout
holds at 1080p preview scale and at 4K.

## Notes

- **Grain.** A ~1.5% monochrome noise layer sits on top of the frame. Broad
  gradients at this size band badly in H.264; the grain dithers the ramp. Check
  the encoded file rather than the studio preview if you change it.
- **Two deviations from the brief**, both one constant away from being undone:
  - Gear strokes are 8px / 5px / 3px at 4K rather than a flat 4px — 4px reads
    as a hairline against the reference's much heavier outlines. See
    `GEAR_STROKE` in `src/layout.ts`.
  - Keyword labels are 0.42–0.68× the centre word, not 0.2×. The reference sits
    in that range; at 0.2× the labels are illegible in a thumbnail. See
    `LABELS` in `src/layout.ts`.
- V2's centre word is STRATEGY, so its lower-left label is VISION rather than a
  second STRATEGY. See `corporateGearsBlueProps` in `src/CorporateGears.tsx`.
