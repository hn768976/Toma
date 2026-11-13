# Data Sequence Analysis HUD — Remotion project (4K)

A locked-off sci-fi "DATA SEQUENCE ANALYSIS" interface: a flip-style digit
counter, a 22-row number matrix with jumping highlight boxes, gauges, bars,
glitch feeds, file-processing counters and progressive status cards.
Built with **Remotion 4 + Canvas 2D**.

| Composition ID | Resolution | FPS | Frames | Duration | Description |
| --- | --- | --- | --- | --- | --- |
| `DataSequenceHUD-V1-Reference` | 3840 × 2160 | 30 | 600 | 20.000 s | Matches the reference: charcoal screen, white/grey data, orange and teal accents, steel-blue bars. |
| `DataSequenceHUD-V2-NeonPalette` | 3840 × 2160 | 30 | 600 | 20.000 s | Alternative **colour palette**: deep navy screen, ice-cyan text, hot-magenta accents, electric-cyan secondary, violet bars, stronger phosphor glow. Identical layout and animation. |

## Quick start

```bash
npm install            # Node 20.19+ / 22.13+ / 24+
npm run dev            # Remotion Studio preview

# Deliverables (1080p, H.264, rendered from the 4K compositions at --scale=0.5)
npm run render:v1      # -> out/Data-Sequence-HUD_Version-1_Reference-Match_1080p.mp4
npm run render:v2      # -> out/Data-Sequence-HUD_Version-2_Neon-Palette_1080p.mp4

# Full 4K masters
npm run render:v1:4k
npm run render:v2:4k

# Single frame check
npx remotion still DataSequenceHUD-V1-Reference out/frame.png --frame=150
```

Codec settings (H.264, yuv420p, CRF 20) live in `remotion.config.ts`.
If Remotion cannot download its Chrome Headless Shell, point it at any local
Chromium with `--browser-executable=/path/to/chrome`.

## How it works

```
src/
  Root.tsx              two 4K compositions (V1 / V2), 30 fps, 600 frames
  DataSequenceHud.tsx   React wrapper: draws one frame on a 3840×2160 canvas + phosphor glow pass
  hud/draw.ts           the whole HUD, authored on a 768×432 design grid and scaled ×5
  lib/palettes.ts       REFERENCE (V1) and NEON (V2) colour palettes
  lib/random.ts         stateless deterministic hashing + per-element "tick" epochs
  lib/fonts.ts          loads the bundled fonts (public/fonts) before rendering
public/fonts/           Rajdhani + Share Tech Mono (SIL OFL 1.1, licences included)
```

Animation timing follows the reference: counter digits flip one at a time at
irregular 4–22 frame intervals, matrix cells tick every 25–140 frames, highlight
boxes jump every 6–20 frames, the file icons count 0 → 100 one after another
(~4 s each, five by the end), and the six bottom-right cards wipe in and out on
a ~4 s cycle. Every value is a pure function of the frame number, so renders
are deterministic.
