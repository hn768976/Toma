# HUD Data Grid — Remotion project (4K)

A cinematic, depth-of-field shot of a holographic data plane: LED dot matrices,
ticking serial-number readouts, gauges, travelling data pulses and glints.

| Composition id | Size | FPS | Frames | Duration | Description |
| --- | --- | --- | --- | --- | --- |
| `HudDataGrid-V1-Reference` | 3840×2160 | 30 | 600 | 20.000 s | Version 1 — matches the reference: locked-off telephoto camera, tilted focal plane, navy/steel palette |
| `HudDataGrid-V2-CraneMove` | 3840×2160 | 30 | 600 | 20.000 s | Version 2 — same scene and palette, shot with a slow crane + orbit camera move with focus travelling along |

## Technology

* **Remotion 4** (scaffolded with `npx create-video --three`), React 19, TypeScript.
* **Three.js / WebGL 2** rendering driven frame-by-frame from `useCurrentFrame()`
  (`src/engine/ThreeStage.tsx`) — every frame is deterministic.
* **WebGL 2 shaders**: the data plane is a procedural, analytically anti-aliased
  GLSL shader (`src/hud/hudMaterial.ts`), so it stays sharp at 4K without textures.
* **Custom GLSL post chain** (`src/engine/post.ts`): half-resolution gather
  depth of field with a tilted (tilt-shift) focal plane, 3-level bloom,
  chromatic aberration, vignette, grain and colour grade.
* **Canvas 2D** for the readouts, gauges and telemetry text (`src/hud/overlays.ts`).
* Fonts (Orbitron, Share Tech Mono — SIL OFL) are bundled in `public/fonts`; no network access is needed.

## Commands

```bash
npm install                      # install dependencies (Node 20.19+ / 22.13+)
npm run dev                      # Remotion Studio preview

# 4K masters (native composition size)
npx remotion render HudDataGrid-V1-Reference out/hud-v1-4k.mp4
npx remotion render HudDataGrid-V2-CraneMove out/hud-v2-4k.mp4

# 1080p deliverables (the 4K composition rendered at scale 0.5)
npx remotion render HudDataGrid-V1-Reference out/hud-v1-1080p.mp4 --scale=0.5
npx remotion render HudDataGrid-V2-CraneMove out/hud-v2-1080p.mp4 --scale=0.5

# single 4K still for a quick check
npx remotion still HudDataGrid-V1-Reference out/frame.png --frame=120
```

Encoding defaults live in `remotion.config.ts`: H.264, yuv420p, CRF 18, JPEG 95 intermediates.

### Rendering notes

* WebGL defaults to `--gl=swangle` (CPU / SwiftShader) so it renders on any
  machine, including headless servers. On a workstation with a GPU, render
  much faster with `REMOTION_GL=angle npx remotion render …`.
* If Remotion cannot download its Chrome Headless Shell (offline / firewalled
  machine), point it at a local Chromium headless shell:
  `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npx remotion render …`.
* Debug props: `--props='{"variant":"reference","debug":true}'` renders the raw
  scene without post-processing; `"profile":true` logs per-pass timings.

## Layout

```
src/
  Root.tsx              compositions (4K, 30 fps, 600 frames)
  HudDataGrid.tsx       composition component
  engine/               reusable WebGL stage, post chain, fonts, RNG
  hud/hudMaterial.ts    procedural data-plane shader
  hud/overlays.ts       Canvas 2D readouts, gauges, text blocks, glints
  hud/scene.ts          scene assembly, camera rigs (V1 locked-off, V2 crane), grade
public/fonts/           bundled woff2 fonts + OFL licence
```
