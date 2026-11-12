# Plexus Data Network (Remotion, 4K)

An abstract plexus network: glowing nodes joined by thin light lines, floating
numeric data labels and tiny code readouts, and a deep bokeh "floor". The
camera drifts slowly through the 3D network with a breathing rack focus.

| Composition ID | Version | Resolution | FPS | Frames | Duration |
| --- | --- | --- | --- | --- | --- |
| `PlexusNetwork-V1-Reference` | Version 1: matches the reference (electric blue) | 3840x2160 (4K UHD) | 30 | 850 | 28.333 s |
| `PlexusNetwork-V2-AmberPalette` | Version 2: alternative **colour palette** (molten amber/gold) | 3840x2160 (4K UHD) | 30 | 850 | 28.333 s |

Version 2 uses the same scene, camera move and timing as Version 1, with a new
colour palette. A palette change was chosen for this reference because the
concept is carried by light and colour: a free-floating fly-through has no
single subject that a new camera angle would reframe.

## Technology

- **Remotion 4** (project created with `npx create-video --blank`)
- **Canvas 2D** renderer (`src/plexus/renderer.ts`). Each frame is drawn
  from a seeded, static 3D world (`src/plexus/world.ts`) and a camera that is a
  pure function of time, so renders are frame-exact and repeatable.
- Depth of field: every node, line and particle gets a circle-of-confusion
  size from its distance to the focus plane. Out-of-focus elements become
  soft lens bokeh, and their brightness is scaled so total light stays the
  same.
- Font: Roboto Mono (bundled in `public/fonts`, SIL OFL 1.1).

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- About 2 GB of free RAM. Remotion downloads its own Chrome Headless Shell on
  the first render. To use a local Chrome instead, set
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.

## Commands

```bash
npm install                 # install dependencies (exact versions from package-lock.json)
npm run dev                 # open Remotion Studio to preview both 4K compositions

# Final deliverables: H.264 MP4, 1920x1080, 30 fps (4K composition rendered at scale 0.5)
npm run render:v1           # -> out/Version 1 - Plexus Data Network - Reference Match (1080p).mp4
npm run render:v2           # -> out/Version 2 - Plexus Data Network - Amber Palette (1080p).mp4
npm run render:all

# Full 4K UHD masters (optional)
npm run render:v1:4k
npm run render:v2:4k

npm run lint                # eslint + TypeScript type check
```

Equivalent raw CLI command:

```bash
npx remotion render PlexusNetwork-V1-Reference out/v1.mp4 --scale=0.5
```

Output settings (codec H.264, yuv420p, CRF 16, bt709, JPEG frames at quality 95)
live in `remotion.config.ts`.

## Structure

```
src/
  index.ts               registerRoot
  Root.tsx               both 4K compositions (850 frames @ 30 fps)
  plexus/
    PlexusNetwork.tsx    React component: canvas + font loading
    renderer.ts          per-frame Canvas 2D renderer + camera path
    world.ts             seeded 3D world: nodes, edges, bokeh, labels, code blocks
    palettes.ts          BLUE (V1) and AMBER (V2) palettes
    random.ts            deterministic PRNG
public/fonts/            Roboto Mono (OFL)
```
