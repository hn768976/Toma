# Composition 1 — "YES among NOs" keyboard (Remotion + Three.js)

A 3D keyboard of dark-teal **NO** keys with a single yellow **YES** key that is
pressed and released, recreated from the reference clip.

| Composition id     | Version | Size        | FPS | Frames | Duration |
| ------------------ | ------- | ----------- | --- | ------ | -------- |
| `YesKey-V1-Match`  | V1 – matches the reference (locked-off camera) | 3840×2160 | 30 | 170 | 5.667 s |
| `YesKey-V2-Orbit`  | V2 – alternative camera move: a slow orbit/push-in from a low wide angle onto the YES key | 3840×2160 | 30 | 170 | 5.667 s |

Technology: React Three Fiber via `@remotion/three` (WebGL 2). Keycaps are
procedural tapered extrusions; labels are canvas textures drawn with the
bundled Liberation Sans Bold font (`public/fonts`, SIL Open Font License).

Key timing measured from the reference: press frames 71→88 (eased), hold 88–90,
release 90→98.

## Commands

```console
npm i                      # install dependencies
npm run dev                # Remotion Studio preview
npm run render:v1:1080p    # out/Composition1_V1_Match_1080p.mp4 (4K comp rendered at --scale=0.5)
npm run render:v2:1080p    # out/Composition1_V2_Orbit_1080p.mp4
npm run render:v1:4k       # full 3840x2160 master
npm run render:v2:4k
```

Output: H.264 MP4, yuv420p, CRF 16 (see `remotion.config.ts`).

Remotion downloads its own headless Chrome on first render. On an offline
machine point it at an installed Chromium instead:

```console
REMOTION_BROWSER_EXECUTABLE=/path/to/chrome npm run render:v1:1080p
```

Source layout: `src/Root.tsx` (compositions), `src/KeyboardScene.tsx`
(scene, lights, camera rigs, press animation), `src/keycap.ts` (keycap
geometry), `src/labels.ts` (font loading + label textures).
