# Composition 1 — Plexus Sphere (Remotion, Canvas 2D)

A rotating low-poly "plexus" wireframe sphere (black vertex dots, hairline
grey edges, floating dust) on a white field, positioned on the right of the
frame — rebuilt from the 20 s reference clip.

| | |
|---|---|
| Composition size | **3840 × 2160 (4K UHD)** |
| Frame rate | 30 fps |
| Duration | 600 frames = **20.000 s** (reference: 20.000 s) |
| Technology | Canvas 2D (crisp anti-aliased hairlines/dots at any resolution, fully deterministic) |
| Audio | none (reference has no audio track) |

## Compositions

| ID | Version | Description |
|---|---|---|
| `PlexusSphere-V1-Reference` | V1 | Matches the reference: white background, black nodes, grey wireframe. |
| `PlexusSphere-V2-Midnight` | V2 | **Alternative colour palette**: midnight-navy radial background, luminous cyan nodes with soft glow. Same geometry, framing and motion. |

## How it matches the reference

* Layout and motion were measured from the reference by tracking vertex
  dots across frames and least-squares fitting rigid rotations over sliding
  2 s windows: the spin rate is constant (|ω| ≈ 0.0149 rad/frame) while the
  spin axis precesses once per clip. This is reproduced exactly as a
  clockwise roll about the view axis composed with a spin about an in-plane
  axis — two whole turns per 20 s, so the clip is a seamless loop like the
  reference (frame 600 ≡ frame 0).
* Sphere centre (0.89 W, 0.447 H), vertex radius 0.33 W, small loop-safe
  per-node drift (integer harmonics of the clip length).
* ~58 vertices on a sphere (Poisson-disk sampled), triangulated via a 3D
  convex hull; ~170 dust particles, mostly in a soft shell halo.
* Depth cueing: back edges/dots are lighter and drawn on a softly blurred
  layer (shallow depth of field); mild perspective.
* V2 background gradient is dithered (±1.5 LSB) to prevent 8-bit banding.

## Commands

```bash
npm install            # install dependencies (Node 20.19+/22.13+/24)
npm run dev            # Remotion Studio preview

# Final deliverables: 4K composition rendered to 1080p H.264 MP4
npm run render:v1      # → out/PlexusSphere-V1-Reference-1080p.mp4
npm run render:v2      # → out/PlexusSphere-V2-Midnight-1080p.mp4

# Optional native 4K masters
npm run render:v1:4k
npm run render:v2:4k
```

Equivalent raw CLI: `npx remotion render PlexusSphere-V1-Reference out/v1.mp4 --scale=0.5`
(`remotion.config.ts` sets H.264, yuv420p, CRF 16, JPEG q95 frames).

## Files

```
src/index.ts                 registerRoot
src/Root.tsx                 the two 4K compositions
src/plexus/PlexusSphere.tsx  renderer (projection, depth cueing, drawing)
src/plexus/geometry.ts       seeded vertices, convex-hull edges, dust
src/plexus/palettes.ts       V1 reference palette, V2 midnight palette
remotion.config.ts           render settings
```
