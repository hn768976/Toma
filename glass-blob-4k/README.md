# Composition 1 — Iridescent Glass Blob (4K, Remotion + Three.js)

A rotating, deforming glass sphere with folded "stacked sheet" ridges and
rainbow thin-film iridescence on black, recreated from reference clip
`istockphoto-2032621597` (10.000 s).

| Composition id  | Size        | FPS | Frames | Duration | Notes |
|-----------------|-------------|-----|--------|----------|-------|
| `GlassBlob-V1`  | 3840 × 2160 | 30  | 300    | 10.000 s | Matches the reference: clear glass, full-spectrum film, black backdrop |
| `GlassBlob-V2`  | 3840 × 2160 | 30  | 300    | 10.000 s | Alternative colour palette: dichroic gold/rose/teal film, smoky amber glass, deep plum backdrop |

Technology: Three.js (WebGL 2) with custom GLSL shaders — vertex-shader
displacement of a 768×512 sphere (simplex-noise bulging + sheared ridge
layers, analytic finite-difference normals) and a fragment shader with a
procedural studio environment, ball-lens refraction, Fresnel reflection and
thin-film interference. No external assets are required.

Motion: two full tumbles plus a wobble, with the ridge sheets sweeping
around the body. Every animated term is periodic over the clip, so frame
299 flows seamlessly back into frame 0 (the reference is a seamless loop).

## Files

- `src/Root.tsx` — registers both 4K compositions
- `src/GlassBlob.tsx` — Three.js scene, camera, per-frame animation
- `src/shaders.ts` — GLSL vertex/fragment shaders
- `src/palettes.ts` — colour palettes for V1 / V2
- `remotion.config.ts` — uses the ANGLE OpenGL renderer (required for WebGL)

## Commands

```bash
npm ci                      # install exact dependency versions (Node 20.19+/22.13+)
npm run dev                 # open Remotion Studio

# 4K master renders
npx remotion render GlassBlob-V1 out/GlassBlob-V1-4K.mp4 --codec=h264
npx remotion render GlassBlob-V2 out/GlassBlob-V2-4K.mp4 --codec=h264

# 1080p delivery renders (same 4K composition, rendered at 0.5 scale)
npx remotion render GlassBlob-V1 out/GlassBlob-V1-1080p.mp4 --scale=0.5 --codec=h264 --crf=16
npx remotion render GlassBlob-V2 out/GlassBlob-V2-1080p.mp4 --scale=0.5 --codec=h264 --crf=16
```

The WebGL canvas allocates its drawing buffer at `composition size × render
scale`, so `--scale=0.5` draws natively at 1920×1080 and the default scale
draws natively at 3840×2160.

If Remotion cannot download its headless Chrome (offline machines), pass an
existing Chromium headless shell: `--browser-executable=/path/to/headless_shell`.
