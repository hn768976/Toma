# 5G Speed Test

A network speed-test dashboard in two versions, built from the same source.

The board runs a test on 4G, flips to 5G half way through, and re-measures:
download and upload climb to near-max while latency collapses. One board, two
looks:

| Version  | Camera             | Treatment                                  |
| -------- | ------------------ | ------------------------------------------ |
| **Flat** | straight on        | solid fills on deep navy, no glow          |
| **Neon** | fixed 3D, off axis | tube-neon bloom over a lit blueprint plane |

## Compositions

| ID                           | Size        | Length     |
| ---------------------------- | ----------- | ---------- |
| `SpeedTest-Flat-4K`          | 3840 x 2160 | 10s (300f) |
| `SpeedTest-Flat-1080p`       | 1920 x 1080 | 10s (300f) |
| `SpeedTest-Flat-Matte-4K`    | 3840 x 2160 | 20s (600f) |
| `SpeedTest-Flat-Matte-1080p` | 1920 x 1080 | 20s (600f) |
| `SpeedTest-Neon-4K`          | 3840 x 2160 | 10s (300f) |
| `SpeedTest-Neon-1080p`       | 1920 x 1080 | 10s (300f) |

All at 30fps. The `-Matte-` compositions are the colour pass followed by the
same 10s again as a white-on-black luma matte, so an editor can key the board
over their own background without an alpha codec.

The 1080p compositions are not downscales - the artwork is a single SVG in a
768 x 432 design space, so every size renders from the same vectors and is
pixel-exact at its own resolution.

## Rendering

```console
npx remotion render SpeedTest-Neon-4K out/speedtest-neon-4k.mp4 \
  --codec=h264 --image-format=png --crf=16
```

The neon version rasterises a large supersampled layer, so give it a low
`--concurrency` (2-3) on a memory-constrained machine.

## Where things live

| File             | What it holds                                                     |
| ---------------- | ----------------------------------------------------------------- |
| `constants.ts`   | Palette, dial geometry, type sizes - the whole layout, measured   |
| `motion.ts`      | Timing: reveal windows, the 4G/5G toggle, needle springs, flutter |
| `Dial.tsx`       | One speedometer: arc, ticks, hub, needle, labels                  |
| `TogglePill.tsx` | The 4G/5G switch                                                  |
| `DotStrip.tsx`   | Throughput meters either side of the ping dial                    |
| `Dashboard.tsx`  | The board: all five elements in one SVG                           |
| `NeonGlow.tsx`   | The bloom filter used by the neon version                         |
| `theme.ts`       | Flat / neon / matte colour sets                                   |
| `SpeedTest*.tsx` | The version wrappers - background, camera, theme                  |

## Retiming or restyling

- Change how long anything takes: `REVEAL`, `TOGGLE` and the ramp lists in
  `motion.ts`. Frames are written as `s(seconds)`.
- Change the readings: the `to` values on each ramp (0 = Min, 1 = Max).
- Change the camera on the neon version: `CAMERA` in `SpeedTestNeon.tsx`.
- Change the colours: `PALETTE` in `constants.ts`, or a theme in `theme.ts`.
