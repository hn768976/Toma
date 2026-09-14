# Global network

A 15s abstract "global communications" motion graphic: a dark globe ringed
by speckled city lights, surrounded by line-art communication icons on
leader lines, inside two sweeping neon circles over a bokeh night sky.
Modelled on a stock reference clip.

## Compositions

| id | resolution | notes |
| --- | --- | --- |
| `GlobalNetwork` | 1920x1080 | Version 1 — gold/amber sweeping into cyan and azure |
| `GlobalNetwork4K` | 3840x2160 | Same, at 4K |
| `GlobalNetworkBlue` | 1920x1080 | Version 2 — deep navy/azure rings and sky, icons keep their accent hues |
| `GlobalNetworkBlue4K` | 3840x2160 | Same, at 4K |

All four are 30fps, 451 frames (15.033s — the nearest whole frame count
to the 15.04s reference at 30fps rather than 25).

## Why 4K is free

The entire scene is one `<svg viewBox="0 0 1920 1080">` stretched to the
composition size. Radii, stroke weights and `feGaussianBlur`
`stdDeviation` are all in viewBox user units, so they scale with the
canvas: the 4K compositions are exact vector upscales of the 1080p ones —
identical framing, timing, particle counts and glow falloff, with no
per-resolution constants to keep in sync.

The variant is a prop (`variant: "reference" | "darkBlue"`) that selects a
`Palette`, so both colourways run the same geometry and timing code.

## Rendering

```console
npx remotion render GlobalNetwork      out/global-network-1080p.mp4      --codec=h264 --crf=16
npx remotion render GlobalNetworkBlue  out/global-network-blue-1080p.mp4 --codec=h264 --crf=16
npx remotion render GlobalNetwork4K    out/global-network-4k.mp4         --codec=h264 --crf=18
npx remotion render GlobalNetworkBlue4K out/global-network-blue-4k.mp4   --codec=h264 --crf=18
```

## Layout

- `constants.ts` — timing, geometry and the two `Palette`s. Every tunable
  number lives here.
- `scene-data.ts` — seeded, frame-independent scatter for the city-light
  dots, the bokeh field and the icon ring. Nothing here reads the frame;
  Remotion renders frames out of order across workers, so anything that
  isn't a pure function of `(index, frame)` would flicker.
- `icons.tsx` — paint-free line-art glyphs in a shared 0..24 box.
- `Defs.tsx` — the shared rotating neon gradient plus the glow filters.
  One gradient serves every ring and the globe rim, which is what keeps
  their colours locked together as the sweep travels round.
- `Backdrop` / `Bokeh` / `NeonRings` / `Globe` / `IconRing` — the layers,
  back to front.
- `GlobalNetwork.tsx` — camera move and assembly.
