# Data Sphere HUD

A 15-second (450 frames @ 30 fps) futuristic HUD: a rotating wireframe
"data sphere" that starts as a dotted network, unravels into a looping
tangle of strands, and settles back — framed by rulers with numeric
labels, crosses, a live bar chart and flickering data readouts.

## Compositions

| ID                            | Size      | Palette                         |
| ----------------------------- | --------- | ------------------------------- |
| `DataSphereHUD-Mono-4K`       | 3840x2160 | White on black (reference look) |
| `DataSphereHUD-Mono-1080p`    | 1920x1080 | same                            |
| `DataSphereHUD-Ember-4K`      | 3840x2160 | Amber sphere, teal HUD, coral accent |
| `DataSphereHUD-Ember-1080p`   | 1920x1080 | same                            |

The 4K compositions are the masters. Everything is laid out in a
1920x1080 design space and scaled, so the 1080p versions are the exact
same frame at half resolution.

## Render (Remotion CLI)

```console
npm i

# 4K masters (H.264 MP4)
npx remotion render DataSphereHUD-Mono-4K  out/DataSphereHUD-Mono-4K.mp4  --codec=h264 --crf=16
npx remotion render DataSphereHUD-Ember-4K out/DataSphereHUD-Ember-4K.mp4 --codec=h264 --crf=16

# 1080p
npx remotion render DataSphereHUD-Mono-1080p  out/DataSphereHUD-Mono-1080p.mp4  --codec=h264 --crf=16
npx remotion render DataSphereHUD-Ember-1080p out/DataSphereHUD-Ember-1080p.mp4 --codec=h264 --crf=16

# Preview / tweak in Remotion Studio
npm run dev
```

## Where to tweak

- `src/data-sphere/constants.ts` — duration, sphere size/position,
  strand & dot counts, rotation speed, when the tangle starts/ends, and
  both color palettes (`MONO_PALETTE`, `EMBER_PALETTE`). Add a palette
  there and to the `palette` enum in `DataSphereHud.tsx` for a new look.
- `src/data-sphere/geometry.ts` — strand shape (curvature, bulge, lengths).
- `src/data-sphere/Hud.tsx` — ruler labels, readout text, bar chart.

Fonts (JetBrains Mono) are self-hosted in `public/fonts`, so rendering
needs no network access.
