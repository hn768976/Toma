# Global network — project handoff

Remotion project for the 15s "global network" motion graphic, delivered in
two colourways at 1080p with matching 4K compositions.

## What's in the box

```
src/global-network/     the scene (see src/global-network/README.md)
src/Root.tsx            composition registry
remotion.config.ts      render defaults
package.json            pinned dependency versions
```

`node_modules/` is not included — run `npm install` first.

The project also carries two unrelated earlier compositions
(`BluetoothExplainer`, `ParticleRingHalo`). They are registered in
`src/Root.tsx` alongside these, so leave them in place unless you also
remove their entries there.

## Setup

```console
npm install
npm run dev        # opens Remotion Studio at http://localhost:3000
```

## Compositions

| id | resolution | fps | frames | colourway |
| --- | --- | --- | --- | --- |
| `GlobalNetwork` | 1920x1080 | 30 | 451 | v1 — gold into cyan/azure (reference match) |
| `GlobalNetwork4K` | 3840x2160 | 30 | 451 | v1 |
| `GlobalNetworkBlue` | 1920x1080 | 30 | 451 | v2 — dark blue |
| `GlobalNetworkBlue4K` | 3840x2160 | 30 | 451 | v2 |

451 frames at 30fps is 15.033s — the nearest whole frame count to the
15.04s reference, which was 25fps.

## Rendering 4K

The delivered MP4s are the 1080p pair. To render the 4K masters:

```console
npx remotion render GlobalNetwork4K     out/global-network-v1-reference-4k.mp4 \
  --codec=h264 --crf=18 --muted --pixel-format=yuv420p --color-space=bt709

npx remotion render GlobalNetworkBlue4K out/global-network-v2-darkblue-4k.mp4 \
  --codec=h264 --crf=18 --muted --pixel-format=yuv420p --color-space=bt709
```

Add `--concurrency=N` to match the render machine's core count. On a 4-core
box a 1080p pass takes a couple of minutes; 4K is roughly 4x that.

`--muted` matters: without it Remotion attaches a silent AAC track. The
reference clip has no audio and neither should these.

## Changing the look

Every tunable number lives in `src/global-network/constants.ts` —
durations, radii, motion periods, and the two `Palette` objects. Because
the scene is authored in a fixed 1920x1080 SVG viewBox and stretched to the
composition size, a change there applies identically at 1080p and 4K. There
are no separate 4K constants to keep in sync.

To add a third colourway: add a `Palette`, add it to the `PALETTES` map and
the `variant` enum in `src/global-network/GlobalNetwork.tsx`, and register
the compositions in `src/Root.tsx`.
