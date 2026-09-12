# Cyber shield

A 25s (750 frames @ 30fps) cyber-security emblem: a mosaic shield with a
keyhole, nested inside a stack of HUD rings, swinging from a steep
three-quarter view to near-frontal while an instrumentation dashboard
assembles around it.

## Compositions

| Composition id      | Size      | Version                                  |
| ------------------- | --------- | ---------------------------------------- |
| `CyberShieldNavy`   | 1920x1080 | A — glowing cyan emblem on deep navy     |
| `CyberShieldNavy4K` | 3840x2160 | A at 4K                                  |
| `CyberShieldCyan`   | 1920x1080 | B — dark blue shield on cyan, new layout |
| `CyberShieldCyan4K` | 3840x2160 | B at 4K                                  |

All four run 750 frames at 30fps. The 1080p and 4K entries are the same
component at different raster sizes, so they can never drift apart.

## Rendering

```console
npm i
npx remotion render CyberShieldNavy4K out/cyber-shield-v1-navy-4k.mp4 --codec=h264 --crf=17
npx remotion render CyberShieldCyan4K out/cyber-shield-v2-cyan-4k.mp4 --codec=h264 --crf=17
```

Swap the composition id for the 1080p masters. A 4K pass is roughly 4x
the work of a 1080p one; `--concurrency=<n>` trades RAM for wall time.

## How it is built

Everything is authored in a fixed 1920x1080 SVG user space
(`DESIGN_WIDTH`/`DESIGN_HEIGHT` in `constants.ts`) and the `<svg>` is
stretched to whatever the composition size is. That is the whole 4K
story: the output is true vector geometry rasterised natively at the
target size, with no per-resolution constants to keep in sync.

The one thing that would have broken that is CSS 3D — a `rotateY()` on a
wrapper rasterises its subtree at the pre-transform size and goes soft
when upscaled. So `projection.ts` implements a small perspective camera
instead, and the emblem's rings, shield outline, keyhole and mosaic tiles
are each projected to plain SVG geometry per frame. Keystoning comes out
correct for free.

| File                 | Role                                                      |
| -------------------- | --------------------------------------------------------- |
| `constants.ts`       | Timing, intro pose, ring speeds, HUD stagger window       |
| `theme.ts`           | The two palettes, emblem placement, layout selection      |
| `projection.ts`      | Perspective camera, arc/Bezier sampling, path builders    |
| `shield-geometry.ts` | Shield outline, keyhole, mosaic tiling — all local space  |
| `Emblem.tsx`         | Rings, binary ring, tick ring, shield, bloom filters      |
| `Background.tsx`     | Graded backdrop, corner bloom, circuit traces, dot matrix |
| `hud-layout.ts`      | Declarative placement for both layouts                    |
| `hud-text.ts`        | Deterministic ticking readouts and chart series           |
| `HudDeck.tsx`        | Renders every HUD item kind, with staggered fade-ins      |
| `CyberShield.tsx`    | Pose animation and layer assembly                         |

Every value that varies per element or per frame is a pure function of
(index, frame) via the seeded PRNG in `src/shared/random.ts`. Remotion
renders frames out of order across workers, so anything drawn from
`Math.random()` would flicker between frames.

## Changing the look

- Palettes and emblem placement: `THEMES` in `theme.ts`.
- Dashboard arrangement: the `CENTERED` / `OFFSET` arrays in
  `hud-layout.ts`. Each entry is `{kind, x, y, ..., delay}`; `delay` is
  frames after `HUD_FIRST_IN_FRAME` at which that item fades in.
- Opening swing: `INTRO_*` / `REST_*` in `constants.ts`.
- Runtime: `DURATION_IN_FRAMES`. The piece does not loop, so any length
  works; the HUD stagger window (`HUD_LAST_IN_FRAME`) should stay inside
  it.
