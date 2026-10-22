# Glitch Collage (Remotion)

A procedural recreation of a dark, stop-motion "data glitch" collage, rendered with
Canvas 2D inside Remotion.

- Compositions are authored at **4K UHD (3840x2160)**, 30 fps, 237 frames (7.9 s).
- Like the reference, each collage image holds for 3 frames (10 images/s) and the
  40-image cycle repeats every 120 frames.
- Every image is generated deterministically from a seed (`src/lib/collage.ts`):
  distressed grunge panel (per-pixel value-noise texture), halftone dots, hairlines,
  tick columns, glyph columns, accent lines, glitch strip displacement, vignette and grain.

| Composition               | Look                                                 |
| ------------------------- | ---------------------------------------------------- |
| `GlitchCollage-Reference` | Teal-black ground, cold grey panel, crimson accents  |
| `GlitchCollage-Amber`     | Midnight indigo ground, ice-cyan panel, amber accents |

## Commands

```console
npm i
npm run dev                     # Remotion Studio
# 4K master
npx remotion render GlitchCollage-Reference out/GlitchCollage-Reference-4k.mp4
# 1080p delivery (renders the 4K composition, downscaled)
npx remotion render GlitchCollage-Reference out/GlitchCollage-Reference-1080p.mp4 --scale=0.5 --crf=16
npx remotion render GlitchCollage-Amber out/GlitchCollage-Amber-1080p.mp4 --scale=0.5 --crf=16
```
