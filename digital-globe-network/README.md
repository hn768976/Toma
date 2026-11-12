# Digital Globe Network (Remotion + Three.js, 4K)

A see-through holographic data globe: a regular halftone grid of bright
continent dots with warm glowing coastlines. The translucent body shows the
far side faintly. A soft, fuzzy rim glow and silhouette spikes surround it,
with a plexus mesh hugging the surface, padlocks with halo circles and map
pins, self-drawing orange great-circle arcs, and dotted orbital rings with
bright beads. Further out are a large dotted outer shell, plexus fragments,
light streaks and floating dust.

| Composition ID | Version | Resolution | FPS | Frames | Duration |
| --- | --- | --- | --- | --- | --- |
| `DigitalGlobe-V1-Reference` | Version 1: matches the reference camera (defocused surface close-up, then a continuous pull-back) | 3840x2160 (4K UHD) | 30 | 890 | 29.667 s |
| `DigitalGlobe-V2-OrbitCamera` | Version 2: alternative **camera angle and movement** | 3840x2160 (4K UHD) | 30 | 890 | 29.667 s |

Version 2 keeps the look and palette but changes the camera. It opens wide and
low, looking up at the globe from below the ring plane. It then orbits about
110° around the globe while rising above the rings, and ends on a close,
high-angle push-in onto the glowing limb. This reverses the reference's
close-to-wide reveal. A camera change was chosen for this reference because
the globe is a single strong subject, so a new orbit and angle reframe it
clearly while the colour identity stays intact.

## Technology

- **Remotion 4** + **@remotion/three** (project created with `npx create-video --three`)
- **Three.js / React Three Fiber** with custom **WebGL 2 GLSL shaders**
  (`src/globe/shaders.ts`):
  - one point-sprite shader drives every particle layer, with modes for
    static/twinkle, dashed rotating rings, self-drawing arcs and pulsing spikes
  - per-point depth of field (circle of confusion + energy conservation)
    produces the lens bokeh in close-ups
  - Fresnel atmosphere shaders for the rim light, inner haze and outer glow
  - an analytic ray/sphere test in the vertex shader dims rings, arcs and
    particles that pass behind the translucent globe body
- Continents: `src/data/land-dots.json` is generated from Natural Earth land
  polygons (via `world-atlas`) by `scripts/generate-land-dots.mjs`. The
  generated file is committed, so rendering needs no network access.
- The camera is a pure function of time, built from C1-continuous
  monotone-cubic keyframes (`src/globe/cameraPaths.ts`). Every frame is
  deterministic.

## Requirements

- Node.js 20.19+ / 22.13+ / 24+
- About 3 GB of free RAM. Remotion downloads its own Chrome Headless Shell on
  the first render. To use a local Chrome instead, set
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`.
- WebGL uses the `swangle` renderer by default (ANGLE on SwiftShader, on the
  CPU). It works on any machine, including headless servers without a GPU.
  On a machine with a GPU you can render faster with `REMOTION_GL=angle`.

## Commands

```bash
npm install                 # install dependencies (exact versions from package-lock.json)
npm run dev                 # open Remotion Studio to preview both 4K compositions

# Final deliverables: H.264 MP4, 1920x1080, 30 fps (4K composition rendered at scale 0.5;
# the WebGL canvas still renders at the full 3840x2160 internally, then is downsampled)
npm run render:v1           # -> out/Version 1 - Digital Globe Network - Reference Match (1080p).mp4
npm run render:v2           # -> out/Version 2 - Digital Globe Network - Orbit Camera (1080p).mp4
npm run render:all

# Full 4K UHD masters (optional)
npm run render:v1:4k
npm run render:v2:4k

npm run generate:land       # optional: regenerate src/data/land-dots.json
npm run lint                # eslint + TypeScript type check
```

Output settings (codec H.264, yuv420p, CRF 16, bt709, JPEG frames at quality 95,
WebGL backend) live in `remotion.config.ts`.

## Structure

```
src/
  index.ts                registerRoot
  Root.tsx                both 4K compositions (890 frames @ 30 fps)
  data/land-dots.json     18,249 continent dots on a 0.8 deg grid [lon, lat, coast] (generated)
  globe/
    DigitalGlobe.tsx      background, ThreeCanvas (dpr 1 at 4K), vignette
    GlobeScene.tsx        scene graph + per-frame uniform/camera updates
    layers.ts             geometry builders (land, ocean grid, haze, rim fuzz,
                          surface mesh, spikes, rings, arcs, sparks, shell,
                          dust, triangles, rays, icons)
    shaders.ts            GLSL point, atmosphere and icon shaders
    cameraPaths.ts        V1 reference camera (incl. roll + rack focus), V2 orbit camera, globe spin
    math.ts, random.ts    helpers (monotone cubic, seeded PRNG)
scripts/generate-land-dots.mjs
```
