# DNA Emerald Plexus Helix (Remotion, 4K)

Remotion project containing **two 4K (3840x2160) compositions at 30 fps** that recreate the
reference clip "istockphoto-619018892" (801 frames = 26.700 s) as a procedural Three.js / WebGL2
motion graphic. No external images, video or audio are used: every particle, line and glow is
generated from a fixed random seed, so renders are fully deterministic.

| Composition id | Version | What it is |
| --- | --- | --- |
| `V1-EmeraldPlexusHelix-4K` | Version 1 | Match of the reference: black void, white wire-frame plexus strands, neon-green base-pair bars with yellow-green hot spots, green volumetric glow, ring-marker plexus nodes; tracking camera that trucks along the helix while the axis rolls from a left to a right lean. |
| `V2-EmeraldPlexusHelixOrbit-4K` | Version 2 | Alternative **camera move** ("Orbital crane"): starts low and close in a worm's-eye view looking up the molecule, then orbits ~150 degrees around the helix while craning up and pulling back to a level side view. Same palette and design. |

## Requirements

- Node.js 20.19+ or 22.13+ (tested with Node 22)
- ~2 GB free disk for `node_modules` and renders
- FFmpeg is **not** required (Remotion ships its own)

## Install

```bash
npm install
```

## Preview (Remotion Studio)

```bash
npm run dev
```

## Render

All renders are H.264 MP4, yuv420p, 30 fps (set in `remotion.config.ts` and on the compositions).

```bash
# native 4K masters (3840x2160) -> out/
npm run render:v1:4k
npm run render:v2:4k
npm run render:all:4k

# 1080p deliverables (same 4K compositions, rendered at --scale=0.5)
npm run render:v1:1080p
npm run render:v2:1080p
npm run render:all:1080p

# or directly with the CLI
npx remotion render V1-EmeraldPlexusHelix-4K out/v1.mp4
```

The delivered 1080p files were made from the 4K masters with a Lanczos downscale:

```bash
ffmpeg -i "out/<name> (4K).mp4" -vf scale=1920:1080:flags=lanczos -c:v libx264 -preset slow \
  -crf 16 -pix_fmt yuv420p -r 30 -movflags +faststart "<name> (1080p).mp4"
```

### WebGL / GPU note

The scene is WebGL2. `remotion.config.ts` sets `--gl=swangle` (ANGLE on SwiftShader, CPU only),
which works on any machine including headless Linux servers without a GPU (about 1.5 s per 4K
frame on 4 CPU cores). On a machine with a GPU you can render faster with `--gl=angle`, e.g.
`npx remotion render V1-EmeraldPlexusHelix-4K out/v1.mp4 --gl=angle`.

If a Playwright Chrome Headless Shell exists at `/opt/pw-browsers/...` (sandboxed CI images),
the config uses it; otherwise Remotion downloads its own browser automatically.

## Project structure

```
src/
  index.ts              registerRoot
  Root.tsx              the two 4K compositions (fps, duration, size)
  dna/
    DnaHelixScene.tsx   React/Remotion component: canvas + per-frame render
    engine.ts           Three.js renderer, scene graph, camera rig per frame
    shaders.ts          GLSL: DOF bokeh points, AA thick lines, facets, background, glow
    build.ts            procedural helix + plexus + dust generation (seeded)
    presets.ts          looks, palettes and camera animation for V1 / V2
    types.ts, random.ts
remotion.config.ts      codec, pixel format, CRF, GL backend
```

Everything that changes over time is a pure function of the frame number (`engine.render(t)`),
so frames can be rendered in any order and in parallel.
