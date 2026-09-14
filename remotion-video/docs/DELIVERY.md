# Market Arrow — delivery notes

Two 30 fps financial motion graphics built with Remotion, each matching
one of the supplied reference clips.

| Version | Reference | Length | Frames @ 30 fps |
| --- | --- | --- | --- |
| **V1 — Downturn** | `istockphoto-2246312464` (market crash plate) | 10.0 s | 300 |
| **V2 — Rally** | `istockphoto-2270531732` (market rally plate) | 12.0 s | 360 |

## Compositions

Both pieces are authored at **4K (3840x2160)** and registered at 1080p as
well. Open the studio with `npm run dev` to see all four:

| Composition id | Resolution | fps | Frames |
| --- | --- | --- | --- |
| `MarketDownturn4K` | 3840x2160 | 30 | 300 |
| `MarketDownturn1080` | 1920x1080 | 30 | 300 |
| `MarketRally4K` | 3840x2160 | 30 | 360 |
| `MarketRally1080` | 1920x1080 | 30 | 360 |

## Rendering

```console
npm i                    # once

npm run render:v1        # 1080p H.264 -> out/market-downturn-v1_1080p.mp4
npm run render:v2        # 1080p H.264 -> out/market-rally-v2_1080p.mp4
npm run render:v1:4k     # 4K   H.264 -> out/market-downturn-v1_4k.mp4
npm run render:v2:4k     # 4K   H.264 -> out/market-rally-v2_4k.mp4
```

All four use `--codec=h264 --image-format=png --crf=17 --muted`. PNG
intermediates matter here: these are dark, gradient-heavy plates and the
default JPEG intermediate bands visibly in the background falloff.
`--muted` keeps the container video-only, matching the references.

On a 4-core machine the 1080p cuts take roughly 6-7 minutes each; the 4K
masters are about 4x that.

## The 4K / 1080p relationship

Everything under `src/market-arrow` is authored in **stage units** — a
fixed 1920x1080 design space. `<Stage>` applies one uniform `scale()` to
map that space onto the composition's real resolution, so the 4K
composition is a pixel-exact 2x of the 1080p one: same layout, same
keyframes, no chance of the two drifting apart. Text, the grid, the
arrows and the chart are all vector/CSS, so 4K is genuinely resolved
rather than upscaled.

The only prop either scene takes is `resolutionScale` (2 for 4K, 1 for
1080p). For a 1440p cut, register a third `<Composition>` at 2560x1440
with `resolutionScale: 4 / 3` — nothing else changes.

## Where to change things

`src/market-arrow/constants.ts` holds all timing, geometry and palette
values for both versions; `src/market-arrow/README.md` explains how each
scene is put together. Durations are `DOWNTURN_DURATION_IN_FRAMES` and
`RALLY_DURATION_IN_FRAMES`.

Note the project also contains two unrelated earlier pieces
(`BluetoothExplainer`, `ParticleRingHalo`); they are untouched by this
work and can be deleted if you only want the market-arrow graphics.
