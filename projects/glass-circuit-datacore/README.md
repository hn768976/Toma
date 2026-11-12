# Glass Circuit Datacore — Remotion project (4K compositions)

A macro shot of a data-core landscape: rows of chrome heat-sink plates that
rise, fall and light up white, with floating glass data panels, shot on a
long lens with a very shallow depth of field and a cool steel-blue grade. It is
a recreation of reference clip `istockphoto-1678653645` (7.300 s), plus one
alternative version.

| Composition id                | Version | Resolution | FPS | Frames | Duration |
| ----------------------------- | ------- | ---------- | --- | ------ | -------- |
| `GlassCircuit-V1-Reference`   | V1: matches the reference (almost locked-off long-lens shot, ~30° down) | 3840×2160 | 30 | 219 | 7.300 s |
| `GlassCircuit-V2-CraneOrbit`  | V2: alternative camera move (low crane-and-orbit sweeping ~54° around the rising core, craning up from 19° to 40°, with a rack focus from a foreground panel onto the core) | 3840×2160 | 30 | 219 | 7.300 s |

## Technology
* **Remotion 4** (React) drives the timeline deterministically (seeded PRNG, pure functions of time).
* **three.js / WebGL 2**:
  * ~7,200 instanced plates (`InstancedMesh`) with a per-instance glow
    attribute injected into `MeshStandardMaterial`. They use PBR shading
    with a PMREM room environment.
  * Glass panels use a custom **GLSL shader**: a signed-distance chip
    outline, rim, bevel and Fresnel, plus a Canvas 2D-generated data read-out
    texture.
  * `src/circuit/post.ts` implements a **layered depth of field**. The
    landscape and the glass are rendered into separate targets, each with
    its own depth texture, and blurred with a golden-angle
    scatter-as-gather bokeh, so anything seen through a sharp panel is
    still correctly defocused. This is followed by UnrealBloom, ACES tone
    mapping and a display-referred grade (desaturation, split-tone, lift,
    vignette, fine grain).
* The choreography in `src/circuit/timeline.ts` follows the reference beats:
  glowing fin groups (0–1.2 s), the glass core block rising (1.6–3.1 s), the
  white flare (2.8–4.4 s), and tall data blocks rising on the right (4–7.3 s).

## Commands
No external media assets are needed: the map, textures and data read-outs are all generated procedurally in code.

```bash
npm install
npm run dev                 # Remotion Studio preview
npm run render:v1           # out/Version-1_Glass-Circuit-Datacore_1080p.mp4 (4K comp → 1080p, H.264)
npm run render:v2           # out/Version-2_Glass-Circuit-Datacore-Crane-Orbit_1080p.mp4
npm run render:v1:4k        # full 3840×2160 master
npm run render:v2:4k
```
Then master the 1080p files (conversion to standard limited-range BT.709
`yuv420p`, written to `out/final/`, using Remotion's bundled ffmpeg):
```bash
npm run finalize:v1 && npm run finalize:v2
# or everything in one go:
npm run render:all
```
Remotion's JPEG frame pipeline otherwise tags the H.264 stream as full-range
`yuvj420p`. The finalize pass changes only the colour encoding, not the picture.

The 1080p deliverables are rendered from the 4K compositions with `--scale=0.5`
(2×2 supersampling).

### WebGL backend
The default is `swangle` (software WebGL, which works anywhere). It is slow:
roughly 10–30 s per 4K frame on a 4-core CPU. With a GPU, use
`REMOTION_GL=angle npm run render:v1`.

## Structure
```
scripts/finalize.mjs             1080p mastering (BT.709 limited range)
remotion.config.ts               codec H.264, yuv420p, CRF 16, WebGL backend, timeouts
src/Root.tsx                     the two 4K compositions
src/circuit/GlassCircuitDatacore.tsx  React component
src/circuit/scene.ts             three.js scene, instancing, glass shader, render passes
src/circuit/post.ts              layered DOF + grade shaders
src/circuit/timeline.ts          cell / glow / panel choreography
src/circuit/camera.ts            V1 and V2 camera rigs (+ focus distance)
src/circuit/glyphs.ts            Canvas 2D data read-out textures
src/circuit/palette.ts           look / grade settings
```
