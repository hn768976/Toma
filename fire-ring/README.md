# Fire Ring — Remotion + WebGL 2 shader (4K)

A top-down ring explosion. A torus of fire bursts outward, engulfs the frame,
cools from white-hot cream through orange into grey smoke, then dissipates
to black. It is rendered entirely in a WebGL 2 fragment shader: a raymarched
volume with pyroclastic simplex noise, one self-shadow tap per step, and a
time-varying temperature ramp. There are no external assets.

| Composition ID          | Size        | FPS | Frames | Duration | Notes |
|-------------------------|-------------|-----|--------|----------|-------|
| `FireRing-V1-Reference` | 3840 × 2160 | 30  | 277    | 9.233 s  | Matches the reference: cream/amber fire, grey smoke |
| `FireRing-V2-Plasma`    | 3840 × 2160 | 30  | 277    | 9.233 s  | Alternative colour palette: cold plasma (white-cyan core, electric blue/violet flames, indigo smoke) |

The reference clip has 277 frames at 29.97 fps (9.243 s). At exactly 30 fps
the same 277 frames last 9.233 s.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+

## Install

```bash
npm ci        # or: npm install
```

## Preview

```bash
npm run dev   # opens Remotion Studio
```

## Render

4K masters (native composition size):

```bash
npx remotion render FireRing-V1-Reference out/FireRing-V1-4K.mp4
npx remotion render FireRing-V2-Plasma    out/FireRing-V2-4K.mp4
```

1080p deliverables (the 4K composition rendered at half scale; the shader
renders at device pixel ratio, so this is a native 1920×1080 render):

```bash
npx remotion render FireRing-V1-Reference out/FireRing-V1-1080p.mp4 --scale=0.5
npx remotion render FireRing-V2-Plasma    out/FireRing-V2-1080p.mp4 --scale=0.5
```

`remotion.config.ts` sets H.264, `yuv420p`, CRF 16 and the `swangle`
(software) WebGL backend, which works on any machine. On a machine with a
GPU, add `--gl=angle` for much faster renders.

## Source layout

- `src/Root.tsx` — registers both 4K compositions
- `src/FireRing.tsx` — WebGL 2 canvas, uniform upload per frame
- `src/shader.ts` — GLSL ES 3.0 vertex and fragment shaders (raymarched volume)
- `src/timeline.ts` — animation curves (radius, hole, heat, smoke, thinning) traced from the reference, using monotone cubic interpolation
- `src/palettes.ts` — V1 (inferno) and V2 (plasma) colour palettes
