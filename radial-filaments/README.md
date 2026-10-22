# Radial Filaments (Remotion + Three.js)

A recreation of a glowing radial-filament motion background: a few hundred
luminous strands radiate from a hot core across a gently domed disc, rippling
and drifting in a seamless loop.

- **Compositions:** 3840×2160 (4K), 30 fps, 320 frames (10.667 s, the reference length)
- **Technology:** Three.js (WebGL 2) with custom GLSL shaders. Every strand is a
  ribbon whose path is computed on the GPU each frame. It renders into an HDR
  buffer with a hue-preserving tone map, then gets a Canvas 2D bloom on top.

| Composition ID        | Description                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| `FilamentsReference`  | Matches the reference: low, locked-off camera, electric blue with a cyan/violet core. Loops seamlessly. |
| `FilamentsCraneOrbit` | Alternative: the same field, but the camera cranes up and orbits ~65° from the grazing view to a high three-quarter view that reveals the full radial structure. |

## Commands

```console
npm i
npm run dev          # Remotion Studio
```

Render a 1080p H.264 delivery from the 4K composition (supersampled):

```console
npx remotion render FilamentsReference out/FilamentsReference-1080p.mp4 --scale=0.5 --crf=16
npx remotion render FilamentsCraneOrbit out/FilamentsCraneOrbit-1080p.mp4 --scale=0.5 --crf=16
```

Render the full 4K master by dropping `--scale`.

On machines without a GPU (CI, containers), add `--gl=swangle` so Chromium
uses SwiftShader for WebGL.

## Layout

- `src/Root.tsx`: the two compositions and their camera rigs
- `src/filaments/FilamentScene.tsx`: Three.js renderer, HDR target, tone map pass, bloom
- `src/filaments/shaders.ts`: strand, floor, backdrop and tone-map GLSL
- `src/filaments/strands.ts`: deterministic strand geometry (per-strand constants only)
- `src/filaments/palettes.ts`: colour palette
