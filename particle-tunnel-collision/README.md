# Particle Tunnel Collision (Remotion, 4K)

Two 3840×2160 compositions at 30 fps, 300 frames (10.000 s), recreating a glowing
particle-string tunnel whose concentric rings bend, curl and finally tangle into each other.

| Composition ID | What it is |
| --- | --- |
| `ParticleTunnelCollision-V1-Match` | Version 1: matches the reference (cyan/teal strings on deep navy) |
| `ParticleTunnelCollision-V2-EmberPalette` | Version 2: same motion and camera with an "ember" palette (amber → red-orange → crimson on warm black) |

**Technology:** Canvas 2D, drawn per frame at full composition resolution. The renderer
uses manual 3D perspective projection, seeded simplex-noise displacement and a
quarter-resolution blur for bloom. Every frame depends only on time, so Remotion can
render frames in parallel and get the same result each run.

## Requirements
- Node.js 20.19+ or 22.13+ (tested with Node 22)
- No GPU needed

## Commands
```bash
npm install                 # or: npm ci
npm run dev                 # Remotion Studio preview

# 4K masters (3840x2160, H.264)
npm run render:v1:4k
npm run render:v2:4k

# 1080p deliverables (rendered from the 4K compositions with --scale=0.5)
npm run render:v1:1080p
npm run render:v2:1080p

# Single still frame check
npm run still:v1
```
Output goes to `out/`. Codec, pixel format (yuv420p) and quality (CRF 16) are set in `remotion.config.ts`.

## Project layout
```
src/index.ts                  registerRoot
src/Root.tsx                  the two 4K compositions (30 fps, 300 frames)
src/tunnel/ParticleTunnel.tsx Remotion component (one <canvas> at composition size)
src/tunnel/drawTunnel.ts      tunnel renderer (rings, beads, bloom, vignette)
src/tunnel/palettes.ts        V1 cyan palette and V2 ember palette
src/tunnel/noise.ts           seeded 3D simplex noise
src/tunnel/random.ts          seeded PRNG
remotion.config.ts            render settings (H.264, CRF 16, JPEG 95 frames)
```

`remotion.config.ts` points Remotion at a Playwright headless-shell binary only when that
file exists (sandboxed CI). On a normal machine Remotion downloads and uses its own browser.
