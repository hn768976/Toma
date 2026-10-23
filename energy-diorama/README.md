# Composition 2 — Isometric renewable-energy diorama (Remotion + Three.js)

A pastel isometric board with a solar panel, wind turbine, charge controller,
battery display, tower block and light bulb. The turbine starts, the
controller LEDs light, the battery charges, the bulb and building switch on,
then everything powers down again — recreated from the reference clip.

| Composition id    | Version | Size        | FPS | Frames | Duration |
| ----------------- | ------- | ----------- | --- | ------ | -------- |
| `Energy-V1-Match` | V1 – matches the reference (pink palette, same framing and timing) | 3840×2160 | 30 | 555 | 18.5 s |
| `Energy-V2-Night` | V2 – alternative colour palette: night scene in indigo/teal with warm light | 3840×2160 | 30 | 555 | 18.5 s |

Technology: React Three Fiber via `@remotion/three` (WebGL 2). All geometry is
procedural; the solar-cell grid and light pool are canvas textures. No
external assets are needed.

Timeline (frames, measured from the reference — see `src/timeline.ts`):
turbine spins 60→495 (15 turns) · LEDs on at 90/105/120/135 · battery charges
136→222 · light-up 241→249 · light-down 321→329 · battery drains 336→420 ·
LEDs off at 436/451/466/481.

## Commands

```console
npm i                      # install dependencies
npm run dev                # Remotion Studio preview
npm run render:v1:1080p    # out/Composition2_V1_Match_1080p.mp4 (4K comp rendered at --scale=0.5)
npm run render:v2:1080p    # out/Composition2_V2_Night_1080p.mp4
npm run render:v1:4k       # full 3840x2160 master
npm run render:v2:4k
```

Output: H.264 MP4, yuv420p, CRF 16 (see `remotion.config.ts`).

Remotion downloads its own headless Chrome on first render. On an offline
machine point it at an installed Chromium instead:

```console
REMOTION_BROWSER_EXECUTABLE=/path/to/chrome npm run render:v1:1080p
```

Source layout: `src/Root.tsx` (compositions), `src/Diorama.tsx` (scene),
`src/palettes.ts` (V1/V2 colour palettes), `src/timeline.ts` (animation timing).
