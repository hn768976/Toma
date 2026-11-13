# Holographic Chess King (Remotion + Three.js)

A low, long-lens shot across a dark chessboard. Every piece stands on a neon
cyan ring; the king carries holographic dashed rings. At ~0.8 s the king ignites
into glowing cyan, its square lights up, light shafts and green "constellation"
networks drift behind the out-of-focus pieces; at ~8.9 s the king powers down.

| Composition    | Size              | FPS | Frames | Duration | Camera |
|----------------|-------------------|-----|--------|----------|--------|
| `ChessKingV1`  | 3840×2160 (4K UHD) | 30  | 300    | 10.000 s | Matches the reference: locked-off low angle, king front-left, near-static push |
| `ChessKingV2`  | 3840×2160 (4K UHD) | 30  | 300    | 10.000 s | Alternative **camera movement**: ~70° crane-down orbit around the king, king held centre-frame |

## Technology

* **Remotion 4** (scaffolded with `npx create-video --blank`).
* **Three.js (WebGL 2)**:
  * Staunton-style pieces turned procedurally with `LatheGeometry`.
  * Glossy board = semi-transparent checker over a mirrored copy of the scene.
  * GLSL shaders for the dashed holographic rings, neon base rings, light shafts
    and twinkling constellation nodes.
  * Post: Bokeh depth of field (focus locked to the king), UnrealBloom,
    ACES tone mapping, vignette grade.
* Fully deterministic (seeded RNG, frame-driven timeline).

## Commands

Requires Node.js 20.19+ / 22.13+ / 24+.

```bash
npm install                 # install dependencies
npm run dev                 # Remotion Studio preview

# Final deliverables: the 4K compositions rendered at 1080p (H.264 MP4)
npm run render:v1           # -> out/Version 1 - Holographic Chess King.mp4
npm run render:v2           # -> out/Version 2 - Holographic Chess King (Orbit Camera).mp4
npm run render:all

# Full 4K masters (slow on CPU-only machines)
npm run render:v1:4k
npm run render:v2:4k
```

`--scale=0.5` renders the 4K composition with a device pixel ratio of 0.5; the
WebGL drawing buffer follows it, so frames rasterise natively at 1920×1080 with
identical framing.

### Rendering notes

* `remotion.config.ts` sets H.264, CRF 16, yuv420p and the `swangle`
  (SwiftShader) OpenGL backend, which works without a GPU. On a machine with a
  GPU add `--gl=angle` for much faster renders.
* If a Playwright Chrome Headless Shell exists at the path in
  `remotion.config.ts` it is used; otherwise Remotion downloads its own.
* No audio (the reference has none).
